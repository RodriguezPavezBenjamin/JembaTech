// Adopta únicamente los 15 objetos existentes pendientes. Nunca apply ni destroy.
import { randomUUID } from 'node:crypto';
import { win32 as path } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROJECT } from './deploy-staging.mjs';
import { ADOPTION_ENVIRONMENT, ADOPTION_SERVICES, AdoptionScopeError, checkAdoptionScope } from './check-railway-adoption-scope.mjs';
import { STATE_ROOT, ioDefault, childEnv, invoke, efsCheck, efsEncrypt, diagnoseImport } from './import-railway-project.mjs';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const PROVIDER = 'provider["registry.terraform.io/terraform-community-providers/railway"]';
const DOMAIN = 'jembatech.up.railway.app';
const settings = ['python-service.PORT', 'python-service.SOLOTODO_MANUAL_PROBE_ENABLED',
  'backend.PORT', 'backend.NODE_ENV', 'backend.DATABASE_URL', 'backend.PYTHON_SERVICE_URL',
  'backend.SOLOTODO_MANUAL_PROBE_ENABLED', 'frontend.PORT', 'frontend.BACKEND_HOST', 'frontend.BACKEND_PORT'];

export const IMPORTS = Object.freeze([
  { address: 'railway_project.staging', importId: PROJECT, attributes: { id: PROJECT }, project: true },
  ...['python-service', 'backend', 'frontend', 'Postgres'].map(name => ({
    address: name === 'Postgres' ? 'railway_service.postgres' : `railway_service.application[${JSON.stringify(name)}]`,
    importId: ADOPTION_SERVICES[name], attributes: { id: ADOPTION_SERVICES[name], name, project_id: PROJECT },
  })),
  { address: 'railway_service_domain.frontend', importId: `${ADOPTION_SERVICES.frontend}:staging:${DOMAIN}`,
    attributes: { project_id: PROJECT, service_id: ADOPTION_SERVICES.frontend,
      environment_id: ADOPTION_ENVIRONMENT, domain: DOMAIN, subdomain: 'jembatech' } },
  ...settings.map(key => {
    const [service, name] = key.split('.');
    return { address: `railway_variable.setting[${JSON.stringify(key)}]`,
      importId: `${ADOPTION_SERVICES[service]}:staging:${name}`,
      attributes: { id: `${ADOPTION_SERVICES[service]}:${ADOPTION_ENVIRONMENT}:${name}`,
        project_id: PROJECT, environment_id: ADOPTION_ENVIRONMENT, service_id: ADOPTION_SERVICES[service], name } };
  }),
].map(item => Object.freeze({ ...item, attributes: Object.freeze(item.attributes) })));

export class ResourceImportError extends Error {
  constructor(code, details = {}) { super(code); Object.assign(this, details); }
}
const ensure = (condition, code) => { if (!condition) throw new ResourceImportError(code); };

// Inspección privada: solo direcciones conocidas y su identidad, nunca valores de variables.
export function inspectState(snapshot) {
  ensure(snapshot?.version === 4 && typeof snapshot.lineage === 'string' && snapshot.lineage.length > 0 &&
    Number.isSafeInteger(snapshot.serial) && snapshot.serial >= 0 && Array.isArray(snapshot.resources), 'STATE_FORMAT_NOT_RECOGNIZED');
  const found = new Set();
  for (const resource of snapshot.resources) {
    ensure(resource.mode === 'managed' && !resource.module && resource.provider === PROVIDER &&
      Array.isArray(resource.instances) && resource.instances.length > 0, 'UNEXPECTED_STATE_RESOURCE');
    for (const instance of resource.instances) {
      const address = `${resource.type}.${resource.name}${instance.index_key === undefined ? '' : `[${JSON.stringify(instance.index_key)}]`}`;
      const expected = IMPORTS.find(item => item.address === address);
      ensure(expected && !found.has(address) && !instance.deposed && !instance.status, 'UNEXPECTED_STATE_RESOURCE');
      const attributes = instance.attributes;
      ensure(attributes && typeof attributes.id === 'string' && attributes.id.length > 0 &&
        Object.entries(expected.attributes).every(([key, value]) => attributes[key] === value), 'STATE_IDENTITY_MISMATCH');
      if (expected.project) ensure(attributes.default_environment?.id === ADOPTION_ENVIRONMENT, 'STATE_ENVIRONMENT_MISMATCH');
      found.add(address);
    }
  }
  ensure(found.has('railway_project.staging'), 'PROJECT_IMPORT_REQUIRED');
  return found;
}

export async function importResources({ env = process.env, platform = process.platform, repo = REPO,
  io = ioDefault, encrypted = file => efsCheck(file, env), encrypt = file => efsEncrypt(file, env),
  execute = invoke, scope = checkAdoptionScope, progress = () => {} } = {}) {
  ensure(platform === 'win32', 'WINDOWS_USER_SESSION_REQUIRED');
  ensure(typeof env.RAILWAY_TOKEN === 'string' && env.RAILWAY_TOKEN.length > 0, 'MISSING_WORKSPACE_TOKEN');
  ensure(!Object.keys(env).some(key => /^(TF_CLI_ARGS|TF_LOG)/i.test(key) || /^(TF_REATTACH_PROVIDERS|TF_CLI_CONFIG_FILE)$/i.test(key)), 'UNEXPECTED_TERRAFORM_OVERRIDES');
  const state = path.join(STATE_ROOT, 'staging.tfstate');
  const meta = path.join(STATE_ROOT, '.terraform', 'terraform.tfstate');
  const exe = path.join(repo, 'reports', 'tools', 'terraform-1.16.4', 'terraform.exe');
  ensure(io.exists(state), 'PROJECT_IMPORT_REQUIRED');
  ensure(encrypted(STATE_ROOT) && encrypted(state) && encrypted(meta), 'PRIVATE_STATE_ENCRYPTION_REQUIRED');
  const readJson = file => {
    try { return JSON.parse(io.read(file).replace(/^\uFEFF/, '')); }
    catch { throw new ResourceImportError('PRIVATE_JSON_NOT_READABLE'); }
  };
  const backend = readJson(meta).backend;
  const matches = (actual, expected) => typeof actual === 'string' && path.resolve(actual).toLowerCase() === path.resolve(expected).toLowerCase();
  ensure(backend?.type === 'local' && matches(backend.config?.path, state) &&
    matches(backend.config?.workspace_dir, path.join(STATE_ROOT, 'workspaces')), 'WRONG_PRIVATE_BACKEND');
  ensure(io.exists(exe), 'PINNED_TERRAFORM_BINARY_MISSING');
  const protectState = () => {
    for (const file of [state, `${state}.backup`].filter(file => io.exists(file))) {
      if (!encrypted(file)) encrypt(file);
      ensure(encrypted(file), 'STATE_ENCRYPTION_NOT_CONFIRMED');
    }
  };
  protectState();
  let snapshot = readJson(state);
  let found = inspectState(snapshot);
  const lineage = snapshot.lineage;
  let imported = 0;
  const skipped = found.size;
  if (found.size === IMPORTS.length) return { status: 'ok', imported, alreadyImported: skipped, total: found.size, stateEncrypted: true };
  await scope(env.RAILWAY_TOKEN);
  for (const item of IMPORTS.filter(item => !found.has(item.address))) {
    // No sobrescribir si otro proceso cambió el estado entre importaciones.
    const current = readJson(state);
    ensure(current.lineage === lineage && current.serial === snapshot.serial, 'STATE_CHANGED_CONCURRENTLY_STOP');
    inspectState(current);
    const logName = `resource-import-${randomUUID()}.log`;
    const log = path.join(STATE_ROOT, logName);
    io.create(log); encrypt(log);
    ensure(encrypted(log), 'LOG_NOT_ENCRYPTED');
    const result = execute(exe, [`-chdir=${path.join(repo, 'infra', 'railway')}`, 'import', '-input=false', '-no-color',
      '-lock-timeout=0s', '-var-file=terraform.tfvars.example', item.address, item.importId], childEnv(env, true));
    protectState();
    io.append(log, `STDOUT\n${result.stdout || ''}\nSTDERR\n${result.stderr || ''}`);
    ensure(encrypted(log), 'LOG_ENCRYPTION_NOT_CONFIRMED');
    if (result.error || result.status !== 0) throw new ResourceImportError(
      result.error?.code === 'ETIMEDOUT' ? 'TF_TIMEOUT_DO_NOT_RETRY' : diagnoseImport(`${result.stdout || ''}\n${result.stderr || ''}`),
      { address: item.address, logName, importedThisRun: imported });
    const next = readJson(state);
    const nextFound = inspectState(next);
    ensure(next.lineage === lineage && next.serial > snapshot.serial && nextFound.size === found.size + 1 &&
      nextFound.has(item.address) && [...found].every(address => nextFound.has(address)), 'UNEXPECTED_STATE_CHANGE_STOP');
    snapshot = next; found = nextFound; imported++;
    progress({ status: 'progress', importedThisRun: imported, total: found.size, expected: IMPORTS.length });
  }
  ensure(found.size === IMPORTS.length, 'INCOMPLETE_ADOPTION_STOP');
  return { status: 'ok', imported, alreadyImported: skipped, total: found.size, stateEncrypted: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    ensure(process.argv.length === 2, 'NO_ARGUMENTS_ALLOWED');
    console.log(JSON.stringify(await importResources({ progress: value => console.log(JSON.stringify(value)) })));
  } catch (error) {
    const known = error instanceof ResourceImportError;
    console.error(JSON.stringify({ status: 'stopped', code: known || error instanceof AdoptionScopeError ? error.message : 'LOCAL_IMPORT_CHECK_FAILED',
      address: known ? error.address : undefined, logName: known ? error.logName : undefined,
      importedThisRun: known ? error.importedThisRun : undefined }));
    process.exitCode = 1;
  }
}

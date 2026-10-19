// Solo plan normal + show JSON local. Sin apply, refresh-only ni cambios cloud.
import { randomUUID } from 'node:crypto';
import { win32 as path } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STATE_ROOT, ioDefault, childEnv, invoke, efsCheck, efsEncrypt, diagnoseImport } from './import-railway-project.mjs';
import { IMPORTS, inspectState } from './import-railway-resources.mjs';
import { ADOPTION_ENVIRONMENT, AdoptionScopeError, checkAdoptionScope } from './check-railway-adoption-scope.mjs';
import { checkAdoption } from './check-terraform-adoption.mjs';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const FIELDS = ['name', 'description', 'private', 'has_pr_deploys', 'default_environment', 'project_id',
  'service_id', 'environment_id', 'value', 'source_repo', 'source_repo_branch', 'source_image',
  'root_directory', 'volume', 'regions', 'cron_schedule', 'config_path', 'subdomain', 'domain', 'suffix',
  'builder', 'build_command', 'start_command', 'restart_policy', 'restart_policy_max_retries',
  'sleep_application', 'healthcheck_path', 'healthcheck_timeout'];
const ACTIONS = new Set(['no-op', 'read', 'create', 'update', 'delete', 'forget']);
export class AdoptionPlanError extends Error {
  constructor(code, details = {}) { super(code); Object.assign(this, details); }
}
const ensure = (condition, code) => { if (!condition) throw new AdoptionPlanError(code); };

// La salida se construye con direcciones/atributos permitidos. Nunca incluye valores.
export function summarizePlan(plan) {
  ensure(typeof plan?.format_version === 'string' && /^1\./.test(plan.format_version) &&
    plan.complete === true && !plan.errored && !plan.deferred_changes?.length &&
    Array.isArray(plan.resource_changes) && plan.resource_changes.length === IMPORTS.length, 'PLAN_INCOMPLETE_OR_UNEXPECTED');
  const seen = new Set(), changes = [];
  for (const resource of plan.resource_changes) {
    const expected = IMPORTS.find(item => item.address === resource.address);
    ensure(expected && !seen.has(resource.address) && resource.mode === 'managed' &&
      !resource.previous_address && !resource.deposed, 'PLAN_RESOURCE_IDENTITY_UNEXPECTED');
    seen.add(resource.address);
    const change = resource.change;
    ensure(Array.isArray(change?.actions) && change.actions.length > 0 &&
      change.actions.every(action => ACTIONS.has(action)), 'PLAN_ACTION_UNRECOGNIZED');
    if (change.actions.length !== 1 || change.actions[0] !== 'no-op') {
      changes.push({ address: expected.address, actions: [...change.actions],
        attributes: FIELDS.filter(field => JSON.stringify(change.before?.[field]) !== JSON.stringify(change.after?.[field]) ||
          (change.after_unknown?.[field] !== undefined && change.after_unknown[field] !== false)) });
    } else {
      // Un no-op solo es válido si sigue siendo exactamente el objeto importado.
      for (const values of [change.before, change.after]) {
        ensure(values && Object.entries(expected.attributes).every(([key, value]) => values[key] === value), 'PLAN_RESOURCE_IDENTITY_UNEXPECTED');
        if (expected.project) ensure(values.default_environment?.id === ADOPTION_ENVIRONMENT, 'PLAN_RESOURCE_IDENTITY_UNEXPECTED');
      }
    }
  }
  if (changes.length) return { status: 'stopped', code: 'TF_PLAN_HAS_CHANGES', resources: IMPORTS.length, changes };
  checkAdoption(plan);
  return { status: 'ok', resources: IMPORTS.length, changes: 0,
    observedDrift: Array.isArray(plan.resource_drift) ? plan.resource_drift.length : 0 };
}

export async function planAdoption({ env = process.env, platform = process.platform, repo = REPO,
  io = ioDefault, encrypted = file => efsCheck(file, env), encrypt = file => efsEncrypt(file, env),
  execute = invoke, scope = checkAdoptionScope } = {}) {
  ensure(platform === 'win32', 'WINDOWS_USER_SESSION_REQUIRED');
  ensure(typeof env.RAILWAY_TOKEN === 'string' && env.RAILWAY_TOKEN.length > 0, 'MISSING_WORKSPACE_TOKEN');
  ensure(!Object.keys(env).some(key => /^(TF_CLI_ARGS|TF_LOG)/i.test(key) || /^(TF_REATTACH_PROVIDERS|TF_CLI_CONFIG_FILE)$/i.test(key)), 'UNEXPECTED_TERRAFORM_OVERRIDES');
  const state = path.join(STATE_ROOT, 'staging.tfstate');
  const meta = path.join(STATE_ROOT, '.terraform', 'terraform.tfstate');
  const exe = path.join(repo, 'reports', 'tools', 'terraform-1.16.4', 'terraform.exe');
  ensure(io.exists(state) && io.exists(meta) && io.exists(exe), 'INITIALIZED_ADOPTION_REQUIRED');
  ensure(encrypted(STATE_ROOT) && encrypted(state) && encrypted(meta), 'PRIVATE_STATE_ENCRYPTION_REQUIRED');
  const parse = text => { try { return JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { throw new AdoptionPlanError('PRIVATE_JSON_NOT_READABLE'); } };
  const backend = parse(io.read(meta)).backend;
  const matches = (actual, expected) => typeof actual === 'string' && path.resolve(actual).toLowerCase() === path.resolve(expected).toLowerCase();
  ensure(backend?.type === 'local' && matches(backend.config?.path, state) &&
    matches(backend.config?.workspace_dir, path.join(STATE_ROOT, 'workspaces')), 'WRONG_PRIVATE_BACKEND');
  const initialState = io.read(state);
  ensure(inspectState(parse(initialState)).size === IMPORTS.length, 'ALL_16_IMPORTS_REQUIRED');
  await scope(env.RAILWAY_TOKEN);

  const stem = `adoption-${randomUUID()}`;
  const plan = path.join(STATE_ROOT, `${stem}.tfplan`);
  const json = path.join(STATE_ROOT, `${stem}.plan.json`);
  const logName = `${stem}.plan.log`, log = path.join(STATE_ROOT, logName);
  for (const file of [plan, json, log]) {
    io.create(file); encrypt(file); ensure(encrypted(file), 'PLAN_FILE_NOT_ENCRYPTED');
  }
  const protect = () => {
    for (const file of [plan, json, log, state, `${state}.backup`].filter(file => io.exists(file))) {
      if (!encrypted(file)) encrypt(file);
      ensure(encrypted(file), 'PRIVATE_FILE_ENCRYPTION_NOT_CONFIRMED');
    }
  };
  const planned = execute(exe, [`-chdir=${path.join(repo, 'infra', 'railway')}`, 'plan', '-input=false', '-no-color',
    '-lock-timeout=0s', '-parallelism=1', '-detailed-exitcode', '-var-file=terraform.tfvars.example', `-out=${plan}`], childEnv(env, true));
  protect();
  io.append(log, `PLAN STDOUT\n${planned.stdout || ''}\nPLAN STDERR\n${planned.stderr || ''}`);
  ensure(io.read(state) === initialState, 'STATE_CHANGED_DURING_PLAN_STOP');
  if (planned.error || ![0, 2].includes(planned.status)) {
    let code = planned.error?.code === 'ETIMEDOUT' ? 'TF_TIMEOUT_DO_NOT_RETRY' : diagnoseImport(`${planned.stdout || ''}\n${planned.stderr || ''}`);
    if (code === 'TF_PROJECT_IMPORT_FAILED') code = 'TF_PLAN_FAILED';
    throw new AdoptionPlanError(code, { logName });
  }
  // Sin token: show solo necesita el plan local y los esquemas ya instalados.
  const shown = execute(exe, [`-chdir=${path.join(repo, 'infra', 'railway')}`, 'show', '-json', plan], childEnv(env));
  io.append(log, `\nSHOW STDERR\n${shown.stderr || ''}`);
  ensure(!shown.error && shown.status === 0, 'TF_PLAN_SHOW_FAILED');
  io.append(json, shown.stdout || '');
  protect();
  ensure(io.read(state) === initialState, 'STATE_CHANGED_DURING_PLAN_STOP');
  return { ...summarizePlan(parse(shown.stdout || '')), filesEncrypted: true, logName };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    ensure(process.argv.length === 2, 'NO_ARGUMENTS_ALLOWED');
    const result = await planAdoption();
    console.log(JSON.stringify(result));
    if (result.status !== 'ok') process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ status: 'stopped', code: error instanceof AdoptionPlanError || error instanceof AdoptionScopeError ? error.message : 'LOCAL_PLAN_CHECK_FAILED',
      logName: error instanceof AdoptionPlanError ? error.logName : undefined }));
    process.exitCode = 1;
  }
}

// Primer import únicamente. Sin shell, apply/destroy, bucles de reintento ni salida CLI privada.
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { win32 as path } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROJECT } from './deploy-staging.mjs';
import { ADOPTION_ENVIRONMENT, AdoptionScopeError, checkAdoptionScope } from './check-railway-adoption-scope.mjs';

export const STATE_ROOT = 'D:\\Accesos HDD\\-.Benja.-\\JembaTech privado\\Terraform';
const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
export class ProjectImportError extends Error {
  constructor(code, logName, statePresent) { super(code); this.logName = logName; this.statePresent = statePresent; }
}
const ensure = (condition, code) => { if (!condition) throw new ProjectImportError(code); };
export const ioDefault = {
  exists: existsSync,
  read: file => readFileSync(file, 'utf8'),
  create: file => writeFileSync(file, '', { flag: 'wx' }),
  append: (file, text) => appendFileSync(file, text, 'utf8'),
};

export function childEnv(env, token = false) {
  const result = { ...env, CHECKPOINT_DISABLE: '1', TF_WORKSPACE: 'default', TF_DATA_DIR: path.join(STATE_ROOT, '.terraform') };
  if (!token) delete result.RAILWAY_TOKEN;
  return result;
}

export function invoke(executable, args, env) {
  return spawnSync(executable, args, { env, shell: false, windowsHide: true, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
}

export function efsCheck(file, env) {
  const literal = file.replaceAll("'", "''");
  const result = invoke('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop'; if ((Get-Item -LiteralPath '${literal}').Attributes -band [IO.FileAttributes]::Encrypted) { [Console]::WriteLine('EFS') } else { exit 3 }`], childEnv(env));
  return result.status === 0 && result.stdout?.trim() === 'EFS';
}

export function efsEncrypt(file, env) {
  const result = invoke('C:\\Windows\\System32\\cipher.exe', ['/e', '/b', file], childEnv(env));
  ensure(result.status === 0 && efsCheck(file, env), 'EFS_ENCRYPTION_FAILED');
}

export function diagnoseImport(text) {
  if (/\b429\b|rate limit|too many requests/i.test(text)) return 'TF_RATE_LIMIT_STOP_AND_WAIT';
  if (/Cannot query field|Unknown argument|Unknown type|Field .* is not defined/i.test(text)) return 'TF_PROVIDER_SCHEMA_INCOMPATIBLE';
  if (/acquiring the state lock|already locked|lock information/i.test(text)) return 'TF_STATE_LOCKED_DO_NOT_FORCE_UNLOCK';
  if (/variable.*file|variables file|variable definitions/i.test(text)) return 'TF_VARIABLE_FILE_FAILED';
  if (/Not Authorized|Unauthorized|\b(?:401|403)\b/i.test(text)) return 'TF_PROVIDER_AUTH_FAILED';
  if (/Failed to load plugin|Failed to instantiate provider|plugin.*permission|Access is denied|permission denied/i.test(text)) return 'TF_PROVIDER_OR_FILE_ACCESS_FAILED';
  if (/redirect|\b(?:301|302|307|308)\b/i.test(text)) return 'TF_PROVIDER_ENDPOINT_REDIRECT';
  if (/Unable to read project|Client Error|\b404\b|Not Found/i.test(text)) return 'TF_PROVIDER_PROJECT_READ_FAILED';
  return 'TF_PROJECT_IMPORT_FAILED';
}

export async function importProject({ env = process.env, platform = process.platform, repo = REPO_ROOT,
  io = ioDefault, encrypted = file => efsCheck(file, env), encrypt = file => efsEncrypt(file, env),
  execute = invoke, scope = checkAdoptionScope } = {}) {
  ensure(platform === 'win32', 'WINDOWS_USER_SESSION_REQUIRED');
  ensure(typeof env.RAILWAY_TOKEN === 'string' && env.RAILWAY_TOKEN.length > 0, 'MISSING_WORKSPACE_TOKEN');
  ensure(!Object.keys(env).some(key => /^(TF_CLI_ARGS|TF_LOG)/i.test(key) || /^(TF_REATTACH_PROVIDERS|TF_CLI_CONFIG_FILE)$/i.test(key)), 'UNEXPECTED_TERRAFORM_OVERRIDES');
  const state = path.join(STATE_ROOT, 'staging.tfstate');
  const meta = path.join(STATE_ROOT, '.terraform', 'terraform.tfstate');
  ensure(!io.exists(state), 'STATE_ALREADY_EXISTS_DO_NOT_REIMPORT');
  ensure(encrypted(STATE_ROOT), 'STATE_DIRECTORY_NOT_ENCRYPTED');
  let backend;
  try { backend = JSON.parse(io.read(meta).replace(/^\uFEFF/, '')).backend; }
  catch { throw new ProjectImportError('INITIALIZED_BACKEND_REQUIRED'); }
  const matches = (actual, expected) => typeof actual === 'string' && path.resolve(actual).toLowerCase() === path.resolve(expected).toLowerCase();
  ensure(backend?.type === 'local' && matches(backend.config?.path, state) &&
    matches(backend.config?.workspace_dir, path.join(STATE_ROOT, 'workspaces')), 'WRONG_PRIVATE_BACKEND');
  const executable = path.join(repo, 'reports', 'tools', 'terraform-1.16.4', 'terraform.exe');
  ensure(io.exists(executable), 'PINNED_TERRAFORM_BINARY_MISSING');
  await scope(env.RAILWAY_TOKEN);

  const logName = `project-import-${randomUUID()}.log`;
  const log = path.join(STATE_ROOT, logName);
  io.create(log);
  encrypt(log); // Cifrar el archivo VACÍO antes de escribir salida potencialmente privada.
  ensure(encrypted(log), 'LOG_NOT_ENCRYPTED');
  const result = execute(executable, [`-chdir=${path.join(repo, 'infra', 'railway')}`, 'import',
    '-input=false', '-no-color', '-lock-timeout=0s', '-var-file=terraform.tfvars.example',
    'railway_project.staging', PROJECT], childEnv(env, true));
  io.append(log, `STDOUT\n${result.stdout || ''}\nSTDERR\n${result.stderr || ''}`);
  ensure(encrypted(log), 'LOG_ENCRYPTION_NOT_CONFIRMED');
  const statePresent = io.exists(state);
  for (const file of [state, `${state}.backup`].filter(file => io.exists(file))) {
    if (!encrypted(file)) encrypt(file);
    ensure(encrypted(file), 'STATE_ENCRYPTION_NOT_CONFIRMED');
  }
  if (result.error || result.status !== 0) {
    const code = result.error?.code === 'ETIMEDOUT' ? 'TF_TIMEOUT_DO_NOT_RETRY' : diagnoseImport(`${result.stdout || ''}\n${result.stderr || ''}`);
    throw new ProjectImportError(code, logName, statePresent);
  }
  ensure(statePresent, 'IMPORTED_STATE_MISSING');
  let snapshot;
  try { snapshot = JSON.parse(io.read(state).replace(/^\uFEFF/, '')); }
  catch { throw new ProjectImportError('STATE_NOT_READABLE_DO_NOT_REIMPORT', logName, true); }
  const resources = snapshot.resources;
  ensure(Array.isArray(resources) && resources.length === 1 && resources[0].mode === 'managed' &&
    resources[0].type === 'railway_project' && resources[0].name === 'staging' && resources[0].instances?.length === 1 &&
    resources[0].instances[0].attributes?.id === PROJECT &&
    resources[0].instances[0].attributes?.default_environment?.id === ADOPTION_ENVIRONMENT,
  'UNEXPECTED_IMPORTED_IDENTITY_DO_NOT_REIMPORT');
  return { status: 'ok', imported: 1, stateEncrypted: true, projectId: PROJECT, environmentId: ADOPTION_ENVIRONMENT };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    ensure(process.argv.length === 2, 'NO_ARGUMENTS_ALLOWED');
    console.log(JSON.stringify(await importProject()));
  } catch (error) {
    const code = error instanceof ProjectImportError || error instanceof AdoptionScopeError ? error.message : 'LOCAL_IMPORT_CHECK_FAILED';
    console.error(JSON.stringify({ status: 'stopped', code, logName: error instanceof ProjectImportError ? error.logName : undefined,
      statePresent: error instanceof ProjectImportError ? error.statePresent : undefined }));
    process.exitCode = 1;
  }
}

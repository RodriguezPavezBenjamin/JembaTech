import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { win32 as path } from 'node:path';
import { test } from 'node:test';
import { PROJECT } from '../../scripts/deploy-staging.mjs';
import { ADOPTION_ENVIRONMENT } from '../../scripts/check-railway-adoption-scope.mjs';
import { STATE_ROOT, diagnoseImport, importProject } from '../../scripts/import-railway-project.mjs';

function harness() {
  const repo = 'S:\\repo';
  const token = randomBytes(24).toString('hex');
  const state = path.join(STATE_ROOT, 'staging.tfstate');
  const meta = path.join(STATE_ROOT, '.terraform', 'terraform.tfstate');
  const exe = path.join(repo, 'reports', 'tools', 'terraform-1.16.4', 'terraform.exe');
  const backend = { type: 'local', config: { path: state, workspace_dir: path.join(STATE_ROOT, 'workspaces') } };
  const files = new Map([[meta, JSON.stringify({ backend })], [exe, 'fixture']]);
  const encrypted = new Set([STATE_ROOT, meta]);
  const events = [];
  const snapshot = () => ({ resources: [{ mode: 'managed', type: 'railway_project', name: 'staging', instances: [
    { attributes: { id: PROJECT, default_environment: { id: ADOPTION_ENVIRONMENT } } },
  ] }] });
  const options = { env: { RAILWAY_TOKEN: token }, platform: 'win32', repo,
    io: { exists: file => files.has(file), read: file => {
      if (!files.has(file)) throw new Error('private read error'); return files.get(file);
    }, create: file => { assert.ok(!files.has(file)); files.set(file, ''); events.push(['create', file]); },
    append: (file, text) => { assert.ok(encrypted.has(file)); files.set(file, files.get(file) + text); events.push(['append', file]); } },
    encrypted: file => encrypted.has(file), encrypt: file => { encrypted.add(file); events.push(['encrypt', file]); },
    scope: async value => { assert.equal(value, token); events.push(['scope']); },
    execute: (binary, args, env) => {
      events.push(['execute', binary, args, env]);
      files.set(state, JSON.stringify(snapshot()));
      return { status: 0, stdout: 'Import successful', stderr: '' };
    } };
  return { options, files, encrypted, events, state, meta, exe, backend, snapshot, token };
}

test('Import proyecto: un único import fijo, log cifrado antes de escribir y estado cifrado después', async () => {
  const qa = harness();
  const result = await importProject(qa.options);
  assert.equal(result.imported, 1);
  assert.equal(result.stateEncrypted, true);
  assert.ok(qa.encrypted.has(qa.state));
  const calls = qa.events.filter(event => event[0] === 'execute');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][2], ['-chdir=S:\\repo\\infra\\railway', 'import', '-input=false', '-no-color', '-lock-timeout=0s',
    '-var-file=terraform.tfvars.example', 'railway_project.staging', PROJECT]);
  assert.equal(calls[0][3].RAILWAY_TOKEN, qa.token);
  assert.equal(calls[0][3].TF_WORKSPACE, 'default');
  assert.equal(calls[0][3].TF_DATA_DIR, path.join(STATE_ROOT, '.terraform'));
  assert.ok(!JSON.stringify(result).includes(qa.token));
  const createdLog = qa.events.find(event => event[0] === 'create')[1];
  assert.ok(qa.events.findIndex(event => event[0] === 'encrypt' && event[1] === createdLog) < qa.events.findIndex(event => event[0] === 'execute'));
});

test('Import proyecto: nunca reimporta si existe cualquier estado, incluso vacío', async () => {
  const qa = harness(); qa.files.set(qa.state, '');
  await assert.rejects(() => importProject(qa.options), /STATE_ALREADY_EXISTS_DO_NOT_REIMPORT/);
  assert.equal(qa.events.length, 0);
});

test('Import proyecto: rechaza otros backends, rutas y metadatos rotos antes de cloud', async () => {
  for (const edit of [b => { b.type = 'remote'; }, b => { b.config.path = 'S:\\plaintext.tfstate'; },
    b => { b.config.workspace_dir = 'S:\\plaintext'; }]) {
    const qa = harness(); edit(qa.backend); qa.files.set(qa.meta, JSON.stringify({ backend: qa.backend }));
    await assert.rejects(() => importProject(qa.options), /WRONG_PRIVATE_BACKEND/);
    assert.equal(qa.events.length, 0);
  }
  const broken = harness(); broken.files.set(broken.meta, 'private-invalid-json');
  await assert.rejects(() => importProject(broken.options), /INITIALIZED_BACKEND_REQUIRED/);
});

test('Import proyecto: bloqueo de overrides, depuración, sesión no Windows y carpeta sin EFS', async () => {
  for (const key of ['TF_LOG', 'tf_log_path', 'TF_CLI_ARGS', 'TF_CLI_ARGS_import', 'TF_REATTACH_PROVIDERS', 'TF_CLI_CONFIG_FILE']) {
    const qa = harness(); qa.options.env[key] = 'private-value';
    await assert.rejects(() => importProject(qa.options), /UNEXPECTED_TERRAFORM_OVERRIDES/);
    assert.equal(qa.events.length, 0);
  }
  const linux = harness(); linux.options.platform = 'linux';
  await assert.rejects(() => importProject(linux.options), /WINDOWS_USER_SESSION_REQUIRED/);
  const noKey = harness(); noKey.options.env = {};
  await assert.rejects(() => importProject(noKey.options), /MISSING_WORKSPACE_TOKEN/);
  const noEfs = harness(); noEfs.encrypted.delete(STATE_ROOT);
  await assert.rejects(() => importProject(noEfs.options), /STATE_DIRECTORY_NOT_ENCRYPTED/);
});

test('Import proyecto: EFS del registro fallido impide ejecutar Terraform', async () => {
  const qa = harness(); qa.options.encrypt = () => {};
  await assert.rejects(() => importProject(qa.options), /LOG_NOT_ENCRYPTED/);
  assert.equal(qa.events.filter(event => event[0] === 'execute').length, 0);
});

test('Import proyecto: guarda stderr privado, entrega solo un código seguro y no reintenta', async () => {
  const qa = harness(); let calls = 0;
  qa.options.execute = () => { calls++; return { status: 1, stdout: '', stderr: `Cannot query field prDeploys ${qa.token}` }; };
  await assert.rejects(() => importProject(qa.options), error => {
    assert.equal(error.message, 'TF_PROVIDER_SCHEMA_INCOMPATIBLE');
    assert.equal(error.statePresent, false);
    assert.ok(!JSON.stringify(error).includes(qa.token)); return true;
  });
  assert.equal(calls, 1);
  const log = qa.events.find(event => event[0] === 'create')[1];
  assert.ok(qa.encrypted.has(log));
  assert.ok(qa.files.get(log).includes(qa.token)); // Solo fixture, almacenada en el registro privado simulado.
});

test('Import proyecto: timeout y estado parcial no provocan reintento ni borrado', async () => {
  const qa = harness();
  qa.options.execute = () => { qa.files.set(qa.state, JSON.stringify(qa.snapshot()));
    return { status: null, error: { code: 'ETIMEDOUT' }, stdout: '', stderr: '' }; };
  await assert.rejects(() => importProject(qa.options), error => error.message === 'TF_TIMEOUT_DO_NOT_RETRY' && error.statePresent === true);
  assert.ok(qa.files.has(qa.state));
  assert.ok(qa.encrypted.has(qa.state));
});

test('Import proyecto: rechaza identidad importada distinta o estado incompleto', async () => {
  const qa = harness();
  qa.options.execute = () => { const value = qa.snapshot(); value.resources[0].instances[0].attributes.id = 'other';
    qa.files.set(qa.state, JSON.stringify(value)); return { status: 0 }; };
  await assert.rejects(() => importProject(qa.options), /UNEXPECTED_IMPORTED_IDENTITY_DO_NOT_REIMPORT/);
  assert.ok(qa.files.has(qa.state));
});

test('Import proyecto: clasifica diagnósticos sin repetir texto de la respuesta', () => {
  for (const [text, code] of [['429: raw-secret', 'TF_RATE_LIMIT_STOP_AND_WAIT'],
    ['Error acquiring the state lock', 'TF_STATE_LOCKED_DO_NOT_FORCE_UNLOCK'],
    ['Failed to read variables file', 'TF_VARIABLE_FILE_FAILED'],
    ['Not Authorized raw-secret', 'TF_PROVIDER_AUTH_FAILED'],
    ['Failed to load plugin schemas', 'TF_PROVIDER_OR_FILE_ACCESS_FAILED'],
    ['HTTP 308 redirect', 'TF_PROVIDER_ENDPOINT_REDIRECT'],
    ['Cannot query field test ab429cd401ef308ab404cd', 'TF_PROVIDER_SCHEMA_INCOMPATIBLE'],
    ['unknown ab429cd401ef308ab404cd', 'TF_PROJECT_IMPORT_FAILED'],
    ['Unable to read project', 'TF_PROVIDER_PROJECT_READ_FAILED'],
    ['unknown-private-value', 'TF_PROJECT_IMPORT_FAILED']]) assert.equal(diagnoseImport(text), code);
});

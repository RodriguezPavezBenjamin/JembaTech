import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { win32 as path } from 'node:path';
import { STATE_ROOT } from '../../scripts/import-railway-project.mjs';
import { ADOPTION_ENVIRONMENT } from '../../scripts/check-railway-adoption-scope.mjs';
import { IMPORTS, inspectState, importResources } from '../../scripts/import-railway-resources.mjs';

function snapshotFor(items = [IMPORTS[0]], serial = 1) {
  const resources = [];
  for (const item of items) {
    const dot = item.address.indexOf('.');
    const type = item.address.slice(0, dot), suffix = item.address.slice(dot + 1);
    const bracket = suffix.indexOf('[');
    const name = bracket < 0 ? suffix : suffix.slice(0, bracket);
    const index_key = bracket < 0 ? undefined : JSON.parse(suffix.slice(bracket + 1, -1));
    let resource = resources.find(value => value.type === type && value.name === name);
    if (!resource) { resource = { type, name, mode: 'managed',
      provider: 'provider["registry.terraform.io/terraform-community-providers/railway"]', instances: [] }; resources.push(resource); }
    resource.instances.push({ ...(index_key === undefined ? {} : { index_key }), attributes: { ...item.attributes,
      id: item.attributes.id || 'fixture-domain-id', ...(item.project ? { default_environment: { id: ADOPTION_ENVIRONMENT } } : {}) } });
  }
  return { version: 4, serial, lineage: 'fixture-lineage', resources };
}

function harness(items) {
  const state = path.join(STATE_ROOT, 'staging.tfstate');
  const meta = path.join(STATE_ROOT, '.terraform', 'terraform.tfstate');
  const exe = 'S:\\repo\\reports\\tools\\terraform-1.16.4\\terraform.exe';
  const token = randomBytes(24).toString('hex');
  const files = new Map([[state, JSON.stringify(snapshotFor(items))], [exe, 'fixture'], [meta, JSON.stringify({
    backend: { type: 'local', config: { path: state, workspace_dir: path.join(STATE_ROOT, 'workspaces') } },
  })]]);
  const encrypted = new Set([state, meta, STATE_ROOT]);
  const calls = [], events = [], progress = [];
  const options = { repo: 'S:\\repo', platform: 'win32', env: { RAILWAY_TOKEN: token },
    io: { exists: file => files.has(file), read: file => { if (!files.has(file)) throw Error('private'); return files.get(file); },
      create: file => { assert.ok(!files.has(file)); files.set(file, ''); events.push(['create', file]); },
      append: (file, text) => { assert.ok(encrypted.has(file)); files.set(file, files.get(file) + text); } },
    encrypted: file => encrypted.has(file), encrypt: file => { encrypted.add(file); events.push(['encrypt', file]); },
    scope: async value => { assert.equal(value, token); events.push(['scope']); },
    progress: value => progress.push(value),
    execute: (binary, args, env) => {
      const address = args.at(-2);
      const expected = IMPORTS.find(value => value.address === address);
      assert.ok(expected);
      assert.equal(args.at(-1), expected.importId);
      assert.equal(binary, exe);
      assert.equal(env.RAILWAY_TOKEN, token);
      const lastLog = events.filter(value => value[0] === 'create').at(-1)[1];
      assert.ok(encrypted.has(lastLog));
      calls.push(args);
      const previous = JSON.parse(files.get(state));
      const found = inspectState(previous);
      files.set(`${state}.backup`, files.get(state));
      encrypted.delete(`${state}.backup`);
      files.set(state, JSON.stringify(snapshotFor(IMPORTS.filter(value => found.has(value.address) || value === expected), previous.serial + 1)));
      encrypted.delete(state);
      return { status: 0, stdout: 'private native output', stderr: '' };
    } };
  return { options, state, meta, exe, token, files, encrypted, calls, events, progress };
}

test('Import restantes: 15 imports fijos, sin repetir proyecto, estado y backup cifrados, solo resumen público', async () => {
  const qa = harness();
  const result = await importResources(qa.options);
  assert.deepEqual(result, { status: 'ok', imported: 15, alreadyImported: 1, total: 16, stateEncrypted: true });
  assert.equal(qa.calls.length, 15);
  assert.equal(new Set(qa.calls.map(args => args.at(-2))).size, 15);
  for (const args of qa.calls) {
    assert.deepEqual(args.slice(0, 7), ['-chdir=S:\\repo\\infra\\railway', 'import', '-input=false', '-no-color',
      '-lock-timeout=0s', '-var-file=terraform.tfvars.example', args.at(-2)]);
    assert.notEqual(args.at(-2), 'railway_project.staging');
  }
  assert.ok(qa.encrypted.has(qa.state) && qa.encrypted.has(`${qa.state}.backup`));
  assert.equal(qa.events.filter(value => value[0] === 'scope').length, 1);
  assert.equal(qa.progress.length, 15);
  assert.ok(!JSON.stringify([result, qa.progress]).includes(qa.token));
});

test('Import restantes: reanudación omite identidades correctas y estado completo no consulta cloud', async () => {
  const partial = harness(IMPORTS.slice(0, 6));
  assert.equal((await importResources(partial.options)).imported, 10);
  const complete = harness(IMPORTS);
  assert.deepEqual(await importResources(complete.options), { status: 'ok', imported: 0, alreadyImported: 16, total: 16, stateEncrypted: true });
  assert.equal(complete.calls.length, 0);
  assert.equal(complete.events.length, 0);
});

test('Import restantes: rechaza identidades ajenas, duplicados, módulos, taint y formatos antes de cloud', async () => {
  const edits = [s => { s.resources[0].instances[0].attributes.id = 'other'; },
    s => { s.resources[0].instances[0].attributes.default_environment.id = 'other'; },
    s => { s.resources[0].instances.push(s.resources[0].instances[0]); },
    s => { s.resources[0].module = 'module.other'; }, s => { s.resources[0].provider = 'other'; },
    s => { s.resources[0].instances[0].status = 'tainted'; }, s => { s.version = 3; },
    s => { s.resources[0].name = 'other'; }, s => { s.resources = []; }];
  for (const edit of edits) {
    const qa = harness(); const s = JSON.parse(qa.files.get(qa.state)); edit(s); qa.files.set(qa.state, JSON.stringify(s));
    await assert.rejects(() => importResources(qa.options));
    assert.equal(qa.events.length, 0);
  }
  const variable = snapshotFor(IMPORTS);
  variable.resources.find(r => r.type === 'railway_variable').instances[0].attributes.environment_id = 'other';
  assert.throws(() => inspectState(variable), /STATE_IDENTITY_MISMATCH/);
});

test('Import restantes: backend incorrecto, token ausente, overrides, EFS ausente o sesión Linux bloquean', async () => {
  for (const edit of [q => { q.files.delete(q.state); }, q => { q.encrypted.delete(q.state); },
    q => { q.encrypted.delete(q.meta); }, q => { q.options.env = {}; }, q => { q.options.env.TF_LOG = 'TRACE'; },
    q => { q.options.platform = 'linux'; }, q => { q.files.set(q.meta, '{"backend":{"type":"remote"}}'); }]) {
    const qa = harness(); edit(qa);
    await assert.rejects(() => importResources(qa.options));
    assert.equal(qa.calls.length, 0);
    assert.equal(qa.events.length, 0);
  }
});

test('Import restantes: falla primer import, preserva estado y registro privado; no reintenta ni filtra stderr', async () => {
  const qa = harness(); let count = 0;
  qa.options.execute = () => { count++; return { status: 1, stderr: `429 secret ${qa.token}` }; };
  await assert.rejects(() => importResources(qa.options), error => {
    assert.equal(error.message, 'TF_RATE_LIMIT_STOP_AND_WAIT');
    assert.equal(error.address, IMPORTS[1].address);
    assert.equal(error.importedThisRun, 0);
    assert.ok(!JSON.stringify(error).includes(qa.token)); return true;
  });
  assert.equal(count, 1);
  assert.equal(inspectState(JSON.parse(qa.files.get(qa.state))).size, 1);
  const log = qa.events.find(value => value[0] === 'create')[1];
  assert.ok(qa.encrypted.has(log) && qa.files.get(log).includes(qa.token));
});

test('Import restantes: timeout con estado parcial se cifra y detiene; no sigue al siguiente recurso', async () => {
  const qa = harness(); const success = qa.options.execute;
  qa.options.execute = (...args) => { success(...args); return { status: null, error: { code: 'ETIMEDOUT' } }; };
  await assert.rejects(() => importResources(qa.options), /TF_TIMEOUT_DO_NOT_RETRY/);
  assert.equal(qa.calls.length, 1);
  assert.equal(inspectState(JSON.parse(qa.files.get(qa.state))).size, 2);
  assert.ok(qa.encrypted.has(qa.state) && qa.encrypted.has(`${qa.state}.backup`));
});

test('Import restantes: serial/linaje/identidad alterados o import sin estado nuevo detienen el lote', async () => {
  for (const edit of [s => { s.lineage = 'different'; }, s => { s.serial = 1; },
    s => { s.resources[1].instances[0].attributes.id = 'wrong'; }]) {
    const qa = harness(); const success = qa.options.execute;
    qa.options.execute = (...args) => { const result = success(...args); const s = JSON.parse(qa.files.get(qa.state)); edit(s);
      qa.files.set(qa.state, JSON.stringify(s)); return result; };
    await assert.rejects(() => importResources(qa.options));
    assert.equal(qa.calls.length, 1);
  }
  const unchanged = harness(); unchanged.options.execute = () => ({ status: 0 });
  await assert.rejects(() => importResources(unchanged.options), /UNEXPECTED_STATE_CHANGE_STOP/);
});

test('Import restantes: EFS fallido en log impide incluso el primer import', async () => {
  const qa = harness(); qa.options.encrypt = () => {};
  await assert.rejects(() => importResources(qa.options), /LOG_NOT_ENCRYPTED/);
  assert.equal(qa.calls.length, 0);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { win32 as path } from 'node:path';
import { STATE_ROOT } from '../../scripts/import-railway-project.mjs';
import { IMPORTS } from '../../scripts/import-railway-resources.mjs';
import { ADOPTION_ENVIRONMENT } from '../../scripts/check-railway-adoption-scope.mjs';
import { summarizePlan, planAdoption } from '../../scripts/plan-railway-adoption.mjs';

const values = item => ({ id: 'fixture-domain-id', ...item.attributes,
  ...(item.project ? { default_environment: { id: ADOPTION_ENVIRONMENT } } : {}) });
function planFixture() {
  return { format_version: '1.2', complete: true, errored: false, resource_changes: IMPORTS.map(item => ({
    address: item.address, mode: 'managed', change: { actions: ['no-op'], before: values(item), after: values(item) },
  })) };
}
function stateFixture() {
  return { version: 4, serial: 16, lineage: 'fixture-lineage', resources: IMPORTS.map(item => {
    const dot = item.address.indexOf('.'), bracket = item.address.indexOf('[');
    return { mode: 'managed', type: item.address.slice(0, dot),
      name: item.address.slice(dot + 1, bracket < 0 ? undefined : bracket),
      provider: 'provider["registry.terraform.io/terraform-community-providers/railway"]', instances: [{
        ...(bracket < 0 ? {} : { index_key: JSON.parse(item.address.slice(bracket + 1, -1)) }), attributes: values(item),
      }] };
  }) };
}
function harness() {
  const token = randomBytes(24).toString('hex');
  const state = path.join(STATE_ROOT, 'staging.tfstate'), meta = path.join(STATE_ROOT, '.terraform', 'terraform.tfstate');
  const exe = 'S:\\repo\\reports\\tools\\terraform-1.16.4\\terraform.exe';
  const files = new Map([[state, JSON.stringify(stateFixture())], [exe, 'fixture'], [meta, JSON.stringify({ backend: {
    type: 'local', config: { path: state, workspace_dir: path.join(STATE_ROOT, 'workspaces') },
  } })]]);
  const encrypted = new Set([STATE_ROOT, state, meta]);
  const calls = [], events = [];
  const plan = planFixture();
  const options = { env: { RAILWAY_TOKEN: token }, platform: 'win32', repo: 'S:\\repo',
    io: { exists: file => files.has(file), read: file => { if (!files.has(file)) throw Error('private'); return files.get(file); },
      create: file => { assert.ok(!files.has(file)); files.set(file, ''); events.push(['create', file]); },
      append: (file, text) => { assert.ok(encrypted.has(file)); files.set(file, files.get(file) + text); } },
    encrypted: file => encrypted.has(file), encrypt: file => { encrypted.add(file); events.push(['encrypt', file]); },
    scope: async value => { assert.equal(value, token); events.push(['scope']); },
    execute: (binary, args, env) => {
      assert.equal(binary, exe);
      calls.push({ args, env });
      assert.equal(events.filter(e => e[0] === 'create').length, 3);
      for (const [, file] of events.filter(e => e[0] === 'create')) assert.ok(encrypted.has(file));
      if (args[1] === 'plan') {
        const file = args.at(-1).slice('-out='.length); files.set(file, 'binary fixture');
        return { status: 0, stdout: `private ${token}`, stderr: '' };
      }
      assert.equal(args[1], 'show');
      return { status: 0, stdout: JSON.stringify(plan), stderr: '' };
    } };
  return { options, files, encrypted, state, meta, exe, calls, events, token, plan };
}

test('Plan adopción: plan normal y show sin shell ni apply; archivos cifrados antes, estado intacto y show sin token', async () => {
  const qa = harness(), initial = qa.files.get(qa.state);
  const result = await planAdoption(qa.options);
  assert.equal(result.status, 'ok'); assert.equal(result.resources, 16); assert.equal(result.changes, 0);
  assert.equal(result.filesEncrypted, true);
  assert.equal(qa.files.get(qa.state), initial);
  assert.equal(qa.calls.length, 2);
  assert.deepEqual(qa.calls[0].args.slice(0, -1), ['-chdir=S:\\repo\\infra\\railway', 'plan', '-input=false', '-no-color',
    '-lock-timeout=0s', '-parallelism=1', '-detailed-exitcode', '-var-file=terraform.tfvars.example']);
  assert.deepEqual(qa.calls[1].args.slice(0, -1), ['-chdir=S:\\repo\\infra\\railway', 'show', '-json']);
  assert.equal(qa.calls[0].env.RAILWAY_TOKEN, qa.token);
  assert.equal(qa.calls[1].env.RAILWAY_TOKEN, undefined);
  assert.ok(!JSON.stringify(result).includes(qa.token));
  const log = qa.events.find(e => e[0] === 'create' && e[1].endsWith('.log'))[1];
  assert.ok(qa.files.get(log).includes(qa.token) && qa.encrypted.has(log));
});

test('Plan adopción: código 2 admite inspección pero bloquea cambios, solo publica nombres de atributos', async () => {
  const qa = harness(), native = qa.options.execute;
  const variable = qa.plan.resource_changes.at(-1);
  variable.change = { actions: ['update'], before: { ...variable.change.before, value: qa.token },
    after: { ...variable.change.after, value: `different-${qa.token}`, arbitrarySecretKey: qa.token } };
  qa.options.execute = (...args) => { const result = native(...args); if (args[1][1] === 'plan') result.status = 2; return result; };
  const result = await planAdoption(qa.options);
  assert.equal(result.status, 'stopped'); assert.equal(result.code, 'TF_PLAN_HAS_CHANGES');
  assert.deepEqual(result.changes, [{ address: IMPORTS.at(-1).address, actions: ['update'], attributes: ['value'] }]);
  assert.ok(!JSON.stringify(result).includes(qa.token) && !JSON.stringify(result).includes('arbitrarySecretKey'));
});

test('Plan adopción: rechaza plan vacío, parcial, errores, diferidos, duplicados, dirección ajena y acciones desconocidas', () => {
  for (const edit of [p => { p.resource_changes = []; }, p => { p.complete = false; }, p => { delete p.complete; },
    p => { p.errored = true; }, p => { p.deferred_changes = [{}]; }, p => { p.format_version = '2.0'; },
    p => { p.resource_changes[1] = p.resource_changes[0]; }, p => { p.resource_changes[0].address = 'private-value'; },
    p => { p.resource_changes[0].change.actions = ['private-action']; },
    p => { p.resource_changes[0].change.after.id = 'other'; }]) {
    const plan = planFixture(); edit(plan); assert.throws(() => summarizePlan(plan));
  }
});

test('Plan adopción: creación, borrado y reemplazo nunca se presentan como cero cambios', () => {
  for (const actions of [['create'], ['delete'], ['delete', 'create'], ['read'], ['forget']]) {
    const p = planFixture(); p.resource_changes[0].change.actions = actions;
    assert.equal(summarizePlan(p).code, 'TF_PLAN_HAS_CHANGES');
  }
});

test('Plan adopción: no oculta drift observado aunque no haya escrituras propuestas', () => {
  const p = planFixture(); p.resource_drift = [{ private: 'not-public' }];
  assert.equal(summarizePlan(p).observedDrift, 1);
  assert.ok(!JSON.stringify(summarizePlan(p)).includes('not-public'));
});

test('Plan adopción: estado incompleto, backend ajeno, EFS ausente, overrides y token ausente bloquean antes de cloud', async () => {
  for (const edit of [q => { const s = stateFixture(); s.resources.pop(); q.files.set(q.state, JSON.stringify(s)); },
    q => { q.files.set(q.meta, '{"backend":{"type":"remote"}}'); }, q => { q.encrypted.delete(q.state); },
    q => { q.options.env = {}; }, q => { q.options.env.TF_CLI_ARGS_plan = '-destroy'; },
    q => { q.options.platform = 'linux'; }]) {
    const qa = harness(); edit(qa); await assert.rejects(() => planAdoption(qa.options));
    assert.equal(qa.calls.length, 0); assert.equal(qa.events.length, 0);
  }
});

test('Plan adopción: errores nativos y timeout no reintentan ni muestran texto privado', async () => {
  for (const result of [{ status: 1, stderr: '429 private-response' }, { status: null, error: { code: 'ETIMEDOUT' } }]) {
    const qa = harness(); let count = 0;
    qa.options.execute = () => { count++; return result; };
    await assert.rejects(() => planAdoption(qa.options), e => {
      assert.ok(!JSON.stringify(e).includes('private-response')); return true;
    }); assert.equal(count, 1);
  }
});

test('Plan adopción: EFS de salida fallido impide ejecutar y estado concurrente detiene antes de show', async () => {
  const noEfs = harness(); noEfs.options.encrypt = () => {};
  await assert.rejects(() => planAdoption(noEfs.options), /PLAN_FILE_NOT_ENCRYPTED/);
  assert.equal(noEfs.calls.length, 0);
  const qa = harness(), native = qa.options.execute;
  qa.options.execute = (...args) => { const result = native(...args); qa.files.set(qa.state, 'changed-state'); return result; };
  await assert.rejects(() => planAdoption(qa.options), /STATE_CHANGED_DURING_PLAN_STOP/);
  assert.equal(qa.calls.length, 1);
});

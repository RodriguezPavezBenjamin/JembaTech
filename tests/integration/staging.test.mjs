// Contratos y red simulada. No lee secrets ni despliega recursos reales.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkAdoption } from '../../scripts/check-terraform-adoption.mjs';
import { PROJECT, REPOSITORY, ORIGIN, deployStaging, railwayClient, checkPublicHealth } from '../../scripts/deploy-staging.mjs';
import { version } from '../../frontend/scripts/write-version.mjs';

function harness({ reuse = false, rounds = 0 } = {}) {
  const sha = randomBytes(20).toString('hex');
  const environmentId = randomUUID();
  const names = ['python-service', 'backend', 'frontend', 'Postgres'];
  const services = names.map(name => ({ name, id: randomUUID() }));
  const token = randomBytes(24).toString('hex');
  const report = { status: 'pending', services: [] };
  const requested = [], mutations = [], polls = new Map();
  let waits = 0;
  const state = Object.fromEntries(names.map(name => {
    const deployment = { id: randomUUID(), status: 'SUCCESS', meta: { commitHash: reuse ? sha : 'b'.repeat(40) } };
    return [name, { rootDirectory: `/${name}`, healthcheckPath: name === 'python-service' ? '/health' : '/api/health',
      preDeployCommand: name === 'backend' ? ['node node_modules/prisma/build/index.js migrate deploy'] : null,
      source: { repo: REPOSITORY }, domains: { serviceDomains: name === 'frontend' ? [{ domain: new URL(ORIGIN).hostname }] : [], customDomains: [] },
      latestDeployment: deployment, activeDeployments: [deployment] }];
  }));
  const run = { head_sha: sha, status: 'completed', conclusion: 'success', event: 'push', head_branch: 'main',
    path: '.github/workflows/ci.yml', head_repository: { full_name: REPOSITORY } };
  const health = { status: 'ok', service: 'jemba-api', database: 'ok', python: 'ok', commit: sha, pythonCommit: sha };
  const scope = { projectId: PROJECT, environmentId };
  const inventory = { environment: { name: 'staging' }, project: { id: PROJECT, name: 'JembaTech Staging',
    services: { edges: services.map(node => ({ node })) } } };
  const json = value => new Response(JSON.stringify(value), { status: 200 });
  const fetcher = async (url, options = {}) => {
    requested.push({ url, options });
    if (url.startsWith('https://api.github.com/')) {
      assert.equal(options.headers.Authorization, `Bearer ${token}`);
      return json(url.endsWith('/commits/main') ? { sha } : run);
    }
    if (url.startsWith(ORIGIN)) {
      assert.equal(options.headers.Authorization, undefined);
      if (url.endsWith('/version.json')) return json({ service: 'jemba-web', commit: sha });
      if (url.endsWith('/api/health')) return json(health);
      return new Response('<title>JembaTech</title>');
    }
    assert.equal(url, 'https://backboard.railway.com/graphql/v2');
    assert.equal(options.headers['Project-Access-Token'], token);
    assert.equal(options.headers.Authorization, undefined);
    const body = JSON.parse(options.body);
    if (body.query.includes('query Scope')) return json({ data: { projectToken: scope } });
    if (body.query.includes('query Inventory')) return json({ data: inventory });
    if (body.query.includes('mutation Deploy')) {
      mutations.push(body.variables);
      assert.equal(body.variables.commitSha, sha);
      assert.equal(body.variables.environmentId, environmentId);
      const service = services.find(service => service.id === body.variables.serviceId);
      assert.notEqual(service.name, 'Postgres');
      const deployment = { id: randomUUID(), status: 'BUILDING', meta: { commitHash: sha } };
      state[service.name].latestDeployment = deployment;
      polls.set(service.name, rounds);
      return json({ data: { serviceInstanceDeployV2: deployment.id } });
    }
    assert.match(body.query, /query Instances/);
    for (const [name, remaining] of polls) {
      if (remaining <= 0) {
        state[name].latestDeployment.status = 'SUCCESS';
        state[name].activeDeployments = [state[name].latestDeployment];
      } else polls.set(name, remaining - 1);
    }
    return json({ data: Object.fromEntries(names.map((name, index) => [`service${index}`, state[name]])) });
  };
  const execute = () => deployStaging({ sha, runId: '123', githubToken: token, railwayToken: token, fetcher,
    pause: async () => { waits++; }, report });
  return { sha, scope, inventory, services, state, run, health, report, token, requested, mutations, execute, fetcher,
    get waits() { return waits; } };
}

test('CD: despliega solo los tres servicios de código con SHA exacto; prueba stack completo', async () => {
  const qa = harness({ rounds: 1 });
  const report = await qa.execute();
  assert.equal(report.status, 'success');
  assert.equal(qa.mutations.length, 3);
  assert.equal(qa.waits, 3);
  assert.equal(report.health.commit, qa.sha);
  assert.ok(!JSON.stringify(report).includes(qa.token));
  assert.ok(!JSON.stringify(report).includes('DATABASE_URL'));
});

test('CD: reutiliza el autodeploy del mismo commit sin duplicar builds', async () => {
  const qa = harness({ reuse: true });
  assert.equal((await qa.execute()).status, 'success');
  assert.equal(qa.mutations.length, 0);
});

for (const change of [{ conclusion: 'failure' }, { event: 'pull_request' }, { head_branch: 'another' },
  { path: '.github/workflows/other.yml' }, { head_sha: 'c'.repeat(40) }, { head_repository: { full_name: 'untrusted/fork' } }]) {
  test(`CD: CI no apta bloquea cloud: ${JSON.stringify(change)}`, async () => {
    const qa = harness(); Object.assign(qa.run, change);
    await assert.rejects(qa.execute, /UNTRUSTED_OR_FAILED_CI/);
    assert.equal(qa.requested.length, 1);
    assert.equal(qa.mutations.length, 0);
  });
}

test('CD: token de otro proyecto se rechaza antes de consultar servicios', async () => {
  const qa = harness(); qa.scope.projectId = randomUUID();
  await assert.rejects(qa.execute, /WRONG_RAILWAY_SCOPE/);
  assert.equal(qa.mutations.length, 0);
});

test('CD: un commit ya superado en main no consulta ni modifica Railway', async () => {
  const qa = harness();
  const fetcher = async (url, options) => url.endsWith('/commits/main')
    ? new Response(JSON.stringify({ sha: 'f'.repeat(40) })) : qa.fetcher(url, options);
  await assert.rejects(() => deployStaging({ sha: qa.sha, runId: '123', githubToken: qa.token,
    railwayToken: qa.token, fetcher }), /SUPERSEDED_COMMIT/);
  assert.equal(qa.mutations.length, 0);
  assert.equal(qa.requested.filter(request => request.url.includes('backboard')).length, 0);
});

test('CD: una construcción que no termina agota un presupuesto acotado, no queda esperando siempre', async () => {
  const qa = harness({ rounds: 100 });
  await assert.rejects(qa.execute, /DEPLOYMENT_TIMEOUT/);
  assert.ok(qa.waits <= 45);
  assert.equal(qa.mutations.length, 1);
});

test('CD: no se acepta un entorno production ni nombres de servicio ambiguos', async () => {
  const qa = harness(); qa.inventory.environment.name = 'production';
  await assert.rejects(qa.execute, /WRONG_RAILWAY_ENVIRONMENT/);
  const duplicate = harness(); duplicate.inventory.project.services.edges.push(duplicate.inventory.project.services.edges[0]);
  await assert.rejects(duplicate.execute, /MISSING_OR_AMBIGUOUS_SERVICE/);
});

for (const setting of ['health', 'root', 'migration', 'domain', 'database']) {
  test(`CD: configuración insegura o incompleta impide desplegar: ${setting}`, async () => {
    const qa = harness();
    if (setting === 'health') qa.state.backend.healthcheckPath = null;
    if (setting === 'root') qa.state.frontend.rootDirectory = '/';
    if (setting === 'migration') qa.state.backend.preDeployCommand = ['npx prisma migrate deploy'];
    if (setting === 'domain') qa.state['python-service'].domains.serviceDomains = [{ domain: 'public.example.invalid' }];
    if (setting === 'database') qa.state.Postgres.activeDeployments = [];
    await assert.rejects(qa.execute);
    assert.equal(qa.mutations.length, 0);
  });
}

test('CD: un build fallido no se presenta como despliegue aprobado', async () => {
  const qa = harness({ reuse: true });
  qa.state['python-service'].latestDeployment.status = 'FAILED';
  await assert.rejects(qa.execute, /DEPLOYMENT_FAILED/);
  assert.notEqual(qa.report.status, 'success');
});

test('CD: salud correcta de una versión antigua no valida el commit nuevo', async () => {
  const qa = harness({ reuse: true }); qa.health.pythonCommit = 'b'.repeat(40);
  await assert.rejects(qa.execute, /BACKEND_OR_PYTHON_VERSION_MISMATCH/);
});

test('CD: Python o PostgreSQL caídos no producen verde', async () => {
  const qa = harness(); qa.health.python = 'failed';
  await assert.rejects(() => checkPublicHealth(qa.sha, qa.fetcher), /STACK_NOT_HEALTHY/);
});

test('CD: HTTP 200 con error GraphQL no expone la respuesta privada ni se considera éxito', async () => {
  const call = railwayClient('qa-token', async () => new Response(JSON.stringify({ errors: [{ message: 'private-raw-details' }] })));
  await assert.rejects(() => call('query Scope { projectToken { projectId } }'), /RAILWAY_GRAPHQL_FAILED/);
});

test('CD: 429 se detiene, no repite mutaciones ni bombardea el API', async () => {
  let requests = 0;
  const call = railwayClient('qa-token', async () => { requests++; return new Response('', { status: 429 }); });
  await assert.rejects(() => call('query Scope { projectToken { projectId } }'), /RATE_LIMIT/);
  assert.equal(requests, 1);
});

test('Versión frontend: solo SHA de build o marcador local, nunca variables completas', () => {
  assert.deepEqual(version('a'.repeat(40)), { service: 'jemba-web', commit: 'a'.repeat(40) });
  assert.equal(version('local').commit, 'local');
  assert.throws(() => version('invalid-private-value'));
});

test('Terraform: primera adopción exige plan completo sin escrituras', () => {
  assert.equal(checkAdoption({ complete: true, resource_changes: [{ change: { actions: ['no-op'] } }] }).changes, 0);
  for (const actions of [['create'], ['update'], ['delete'], ['delete', 'create']]) {
    assert.throws(() => checkAdoption({ resource_changes: [{ change: { actions } }] }));
  }
  assert.throws(() => checkAdoption({ complete: false, resource_changes: [] }));
  assert.throws(() => checkAdoption({ resource_changes: [{ change: { actions: [] } }] }));
  assert.throws(() => checkAdoption({ resource_changes: [{}] }));
});

test('Workflow staging: separado de CI, nunca PR, sin código/artifacts no confiables', () => {
  const source = readFileSync(new URL('../../.github/workflows/staging.yml', import.meta.url), 'utf8');
  assert.match(source, /workflow_run:/);
  assert.match(source, /workflows: \[CI EP2\]/);
  assert.match(source, /workflow_run\.event == 'push'/);
  assert.match(source, /workflow_run\.conclusion == 'success'/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(source, /RAILWAY_STAGING_TOKEN: \$\{\{ secrets\.RAILWAY_STAGING_TOKEN \}\}/);
  assert.doesNotMatch(source, /pull_request_target|download-artifact|continue-on-error|secrets: inherit|railway up/);
});

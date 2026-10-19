// Evaluación pura del SDK y dobles del CLI: sin credenciales ni consultas cloud.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import program from '../.railway/railway.ts';
import { applications, domain, migration, postgresImage, repository, scope } from '../.railway/contract.mjs';
import { validateNativePlan } from '../validate-plan.mjs';
import { checkNativePlan } from '../plan.mjs';
import { ADOPTION_ENVIRONMENT, ADOPTION_SERVICES } from '../../../scripts/check-railway-adoption-scope.mjs';
import { ORIGIN, PROJECT, REPOSITORY } from '../../../scripts/deploy-staging.mjs';

const context = { command: 'plan', ...scope };
const definition = () => program(context);
const fixture = () => ({ ok: true, command: 'plan', currentEnvironment: { ...scope },
  changeSet: { changes: [] }, diagnostics: [], applyResult: null, stagedPatch: null,
  stagedPatchId: null, deploymentId: null, variablePolicy: { managed: false },
  desiredGraph: { project: { name: scope.projectName }, resources: definition().resources } });

test('IaC nativa: declaración completa, variables no gestionadas y contrato de salud/migración/puerto', () => {
  const project = definition();
  assert.equal(project.name, scope.projectName);
  assert.deepEqual(project.variables, { managed: false });
  assert.equal(validateNativePlan(fixture(), 0).healthchecks, 3);
  for (const name of applications) {
    const service = project.resources.find(resource => resource.name === name);
    assert.equal(service.source.checkSuites, false);
    assert.equal(service.source.repo, repository);
  }
  assert.equal(project.resources.find(r => r.name === 'frontend').networking.serviceDomains[domain].port, 80);
  assert.deepEqual(project.resources.find(r => r.name === 'backend').deploy.preDeployCommand, [migration]);
});

for (const change of [{ command: 'apply' }, { command: 'pull' }, { command: undefined }, { projectId: 'other' },
  { environmentId: 'other' }, { environment: 'production' }]) {
  test(`IaC nativa: contexto no autorizado bloquea antes de construir recursos: ${JSON.stringify(change)}`, () => {
    assert.throws(() => program({ ...context, ...change }), /READ_ONLY_STAGING_PLAN_ONLY/);
  });
}

const badPlans = [
  data => { data.ok = false; }, data => { data.command = 'apply'; },
  data => { data.currentEnvironment.environmentId = 'other'; },
  data => { data.currentEnvironment.projectId = 'other'; },
  data => { data.changeSet.changes.push({ action: 'delete', value: 'private' }); },
  data => { data.diagnostics.push({ message: 'private' }); },
  data => { data.stagedPatchId = 'private'; }, data => { data.deploymentId = 'private'; },
  data => { data.applyResult = {}; }, data => { delete data.stagedPatch; },
  data => { data.variablePolicy.managed = true; },
  data => { data.desiredGraph.resources.pop(); },
  data => { data.desiredGraph.resources[0] = data.desiredGraph.resources[1]; },
  data => { data.desiredGraph.resources[0].variables = { PRIVATE: 'private' }; },
  data => { data.desiredGraph.resources[0].source.checkSuites = true; },
  data => { data.desiredGraph.resources[0].deploy.healthcheckPath = '/wrong'; },
  data => { data.desiredGraph.resources.find(r => r.name === 'backend').deploy.preDeployCommand = ['other']; },
  data => { data.desiredGraph.resources[0].networking.serviceDomains[domain].port = 3000; },
  data => { data.desiredGraph.resources[1].networking = { customDomains: { 'public.invalid': {} } }; },
  data => { data.desiredGraph.resources.find(r => r.name === 'postgres-volume').config.sizeMB = 1000; },
];
test('IaC nativa: planes incompletos, escrituras, inventario, variables y ajustes ajenos se rechazan sin filtrar valores', () => {
  for (const change of badPlans) {
    const data = fixture(); change(data);
    assert.throws(() => validateNativePlan(data, 0), error => !error.message.includes('private'));
  }
  assert.throws(() => validateNativePlan(fixture(), 2));
});

function harness({ failAt, status = 0, malformed = false, policyEnabled = false } = {}) {
  const calls = [];
  const cli = 'C:\\tools\\railway.exe';
  const run = (exe, args, options) => {
    calls.push({ exe, args, options });
    if (calls.length === failAt) return { status, stdout: malformed ? '{private' : 'private', stderr: 'private-token-value' };
    let value;
    if (args[0] === 'status') value = { id: scope.projectId, name: scope.projectName };
    else if (args[0] === 'config') value = fixture();
    else {
      assert.equal(args[0], 'api'); assert.ok(args[1].startsWith('query Instances('));
      value = { data: Object.fromEntries(['python-service', 'backend', 'frontend', 'Postgres'].flatMap((name, index) => [
        [`service${index}`, { rootDirectory: `/${name}`, source: { repo: repository, image: name === 'Postgres' ? postgresImage : null },
          healthcheckPath: name === 'python-service' ? '/health' : '/api/health',
          preDeployCommand: name === 'backend' ? [migration] : null,
          domains: { serviceDomains: name === 'frontend' ? [{ domain }] : [], customDomains: [] },
          activeDeployments: [{ status: 'SUCCESS' }] }],
        [`auto${index}`, { enabled: policyEnabled }], [`triggers${index}`, { edges: [], pageInfo: { hasNextPage: false } }],
      ])) };
    }
    return { status: 0, stdout: JSON.stringify(value) };
  };
  const execute = () => checkNativePlan({ cli, run, environment: {
    RAILWAY_TOKEN: 'project-private', railway_api_token: 'workspace-private', KEEP: 'safe',
  } });
  return { calls, execute, cli };
}

test('IaC nativa: lanzador solo status/query/plan, alcance fijo, sin tokens, shell, salida persistida ni apply', async () => {
  const qa = harness();
  assert.equal((await qa.execute()).autodeployServices, 0);
  assert.equal(qa.calls.length, 4);
  for (const call of qa.calls) {
    assert.equal(call.exe, qa.cli); assert.equal(call.options.shell, false);
    assert.equal(call.options.windowsHide, true); assert.equal(call.options.timeout, 45000);
    assert.equal(call.options.env._, qa.cli);
    assert.ok(!Object.keys(call.options.env).some(key => /^RAILWAY_(?:API_)?TOKEN$/i.test(key)));
    assert.ok(!call.args.some(arg => ['apply', '--out', '--show-values', '--include-variables', '--yes'].includes(arg)));
  }
  assert.ok(qa.calls[2].args.includes(scope.environmentId));
});

test('IaC nativa: error CLI/JSON/política se detiene sin reintentar ni mostrar respuesta privada', async () => {
  for (const options of [{ failAt: 1, status: 1 }, { failAt: 3, status: 2 }, { failAt: 2, malformed: true }, { policyEnabled: true }]) {
    const qa = harness(options);
    await assert.rejects(qa.execute, error => !error.message.includes('private'));
    assert.ok(qa.calls.length <= 3);
  }
  await assert.rejects(() => checkNativePlan({ cli: 'railway.cmd' }), /ABSOLUTE_RAILWAY_EXECUTABLE_REQUIRED/);
});

test('IaC nativa: IDs y contrato no contradicen adopción Terraform ni habilitan secrets/apply en CI', () => {
  assert.equal(scope.projectId, PROJECT);
  assert.equal(scope.environmentId, ADOPTION_ENVIRONMENT);
  assert.equal(repository, REPOSITORY);
  assert.equal(domain, new URL(ORIGIN).hostname);
  assert.equal(Object.keys(ADOPTION_SERVICES).length, 4);
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(manifest.dependencies.railway, '3.12.0');
  assert.equal(lock.packages['node_modules/railway'].version, '3.12.0');
  const workflow = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const job = workflow.split('  railway-native:')[1]?.split(/^  [a-z][a-z-]+:/m)[0];
  assert.ok(job);
  assert.match(job, /npm ci --ignore-scripts/);
  assert.match(job, /npm test/);
  assert.doesNotMatch(job, /secrets\.|config apply|config plan|plan:check|pull_request_target/);
});

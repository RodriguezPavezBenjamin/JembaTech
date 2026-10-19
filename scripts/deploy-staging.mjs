// No crea recursos, modifica variables ni despliega PostgreSQL. API oficial Railway.
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

export const PROJECT = '8aa2ee89-8dfa-4251-a8f3-7a6f35adf9c2';
export const REPOSITORY = 'RodriguezPavezBenjamin/JembaTech';
export const ORIGIN = 'https://jembatech.up.railway.app';
const API = 'https://backboard.railway.com/graphql/v2';
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const names = ['python-service', 'backend', 'frontend', 'Postgres'];
const terminal = new Set(['FAILED', 'CRASHED', 'REMOVED', 'REMOVING', 'SKIPPED', 'SLEEPING', 'NEEDS_APPROVAL']);
export class DeploymentError extends Error {}
const ensure = (condition, code) => { if (!condition) throw new DeploymentError(code); };

export async function githubGate({ sha, runId, token, fetcher = fetch }) {
  ensure(/^[a-f0-9]{40}$/.test(sha || '') && /^\d+$/.test(runId || ''), 'INVALID_CI_IDENTITY');
  ensure(Boolean(token), 'MISSING_GITHUB_TOKEN');
  const get = async path => {
    const response = await fetcher(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    ensure(response.ok, 'GITHUB_CHECK_FAILED');
    return response.json();
  };
  const run = await get(`actions/runs/${runId}`);
  ensure(run.head_sha === sha && run.status === 'completed' && run.conclusion === 'success' &&
    run.event === 'push' && run.head_branch === 'main' && run.path === '.github/workflows/ci.yml' &&
    run.head_repository?.full_name === REPOSITORY, 'UNTRUSTED_OR_FAILED_CI');
  const latest = await get('commits/main');
  ensure(latest.sha === sha, 'SUPERSEDED_COMMIT');
}

export function railwayClient(token, fetcher = fetch) {
  ensure(Boolean(token), 'MISSING_RAILWAY_STAGING_TOKEN');
  let requests = 0;
  return async (query, variables = {}) => {
    ensure(++requests <= 60, 'API_REQUEST_BUDGET_EXHAUSTED');
    const response = await fetcher(API, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token }, body: JSON.stringify({ query, variables }) });
    // No repetir mutaciones de resultado incierto ni imprimir errores de la API.
    ensure(response.status !== 429, 'RAILWAY_RATE_LIMIT_WAIT_BEFORE_RETRY');
    ensure(response.ok, 'RAILWAY_HTTP_FAILED');
    const data = await response.json();
    ensure(!data.errors?.length && data.data, 'RAILWAY_GRAPHQL_FAILED');
    return data.data;
  };
}

export async function discover(call) {
  const { projectToken: scope } = await call('query Scope { projectToken { projectId environmentId } }');
  ensure(scope?.projectId === PROJECT && UUID.test(scope.environmentId), 'WRONG_RAILWAY_SCOPE');
  const result = await call(`query Inventory($projectId: String!, $environmentId: String!) {
    project(id: $projectId) { id name services { edges { node { id name } } } }
    environment(id: $environmentId) { name }
  }`, { projectId: PROJECT, environmentId: scope.environmentId });
  ensure(result.environment?.name === 'staging' && result.project?.name === 'JembaTech Staging', 'WRONG_RAILWAY_ENVIRONMENT');
  const services = names.map(name => {
    const matches = result.project.services.edges.map(edge => edge.node).filter(service => service.name === name);
    ensure(matches.length === 1 && UUID.test(matches[0].id), 'MISSING_OR_AMBIGUOUS_SERVICE');
    return matches[0];
  });
  return { environmentId: scope.environmentId, services };
}

export async function instances(call, inventory, tracked) {
  const variables = { projectId: PROJECT, environmentId: inventory.environmentId };
  const definitions = ['$projectId: String!', '$environmentId: String!'];
  const fields = inventory.services.map((service, index) => {
    variables[`service${index}`] = service.id;
    definitions.push(`$service${index}: String!`);
    return `service${index}: serviceInstance(environmentId: $environmentId, serviceId: $service${index}) {
      rootDirectory healthcheckPath preDeployCommand source { repo image }
      domains { serviceDomains { domain } customDomains { domain } }
      latestDeployment { id status meta }
      activeDeployments { id status meta }
    }${service.name === 'Postgres' ? '' : `
    auto${index}: serviceInstanceAutoDeployStatus(projectId: $projectId, environmentId: $environmentId, serviceId: $service${index}) { enabled }
    triggers${index}: deploymentTriggers(projectId: $projectId, environmentId: $environmentId, serviceId: $service${index}, first: 10) {
      edges { node { checkSuites } } pageInfo { hasNextPage }
    }`}`;
  });
  if (tracked) {
    variables.deploymentId = tracked.id;
    definitions.push('$deploymentId: String!');
    fields.push('tracked: deployment(id: $deploymentId) { id status meta serviceId environmentId }');
  }
  const result = await call(`query Instances(${definitions.join(', ')}) { ${fields.join('\n')} }`, variables);
  return Object.fromEntries(inventory.services.map((service, index) => [service.name, {
    ...result[`service${index}`], autoDeploy: result[`auto${index}`], triggers: result[`triggers${index}`],
    ...(tracked?.service === service.name ? { trackedDeployment: result.tracked } : {}),
  }]));
}

export function validateSettings(state) {
  for (const name of names) {
    const instance = state[name];
    ensure(instance && instance.domains, 'INCOMPLETE_SERVICE_SETTINGS');
    const domains = [...instance.domains.serviceDomains, ...instance.domains.customDomains];
    if (name !== 'frontend') ensure(domains.length === 0, 'PRIVATE_SERVICE_HAS_PUBLIC_HTTP_DOMAIN');
    if (name === 'Postgres') {
      ensure(instance.activeDeployments.some(deploy => deploy.status === 'SUCCESS'), 'DATABASE_NOT_RUNNING');
      continue;
    }
    // Un solo dueño de CD: no permitir autodeploy sin gate ni esperar este mismo workflow.
    ensure(instance.autoDeploy?.enabled === false, 'AUTODEPLOY_MUST_BE_DISABLED');
    ensure(instance.triggers?.pageInfo?.hasNextPage === false && Array.isArray(instance.triggers.edges) &&
      instance.triggers.edges.every(edge => edge.node?.checkSuites === false), 'RAILWAY_CI_WAIT_MUST_BE_DISABLED');
    ensure(instance.source?.repo === REPOSITORY && instance.rootDirectory === `/${name}`, 'SOURCE_CONFIGURATION_DRIFT');
    ensure(instance.healthcheckPath === (name === 'python-service' ? '/health' : '/api/health'), 'HEALTHCHECK_CONFIGURATION_DRIFT');
    if (name === 'backend') {
      const commands = Array.isArray(instance.preDeployCommand) ? instance.preDeployCommand : [instance.preDeployCommand];
      ensure(commands.length === 1 && commands[0] === 'node node_modules/prisma/build/index.js migrate deploy', 'MIGRATION_CONFIGURATION_DRIFT');
    }
    if (name === 'frontend') ensure(domains.some(domain => domain.domain === new URL(ORIGIN).hostname), 'FRONTEND_DOMAIN_DRIFT');
  }
}

export async function checkPublicHealth(sha, fetcher = fetch) {
  const get = async path => {
    const response = await fetcher(`${ORIGIN}${path}`, { signal: AbortSignal.timeout(10000), redirect: 'error',
      headers: { 'Cache-Control': 'no-cache' } });
    ensure(response.status === 200, 'PUBLIC_HEALTH_HTTP_FAILED');
    return response;
  };
  ensure(/<title>JembaTech<\/title>/.test(await (await get('/')).text()), 'FRONTEND_NOT_JEMBATECH');
  const web = await (await get('/version.json')).json();
  ensure(web.service === 'jemba-web' && web.commit === sha, 'FRONTEND_VERSION_MISMATCH');
  const api = await (await get('/api/health')).json();
  ensure(api.status === 'ok' && api.service === 'jemba-api' && api.database === 'ok' && api.python === 'ok', 'STACK_NOT_HEALTHY');
  ensure(api.commit === sha && api.pythonCommit === sha, 'BACKEND_OR_PYTHON_VERSION_MISMATCH');
  return { frontend: 'ok', backend: 'ok', python: 'ok', database: 'ok', commit: sha };
}

export async function deployStaging({ sha, runId, githubToken, railwayToken, fetcher = fetch,
  pause = () => sleep(30000), progress = () => {}, report = { status: 'pending', services: [] } }) {
  await githubGate({ sha, runId, token: githubToken, fetcher });
  const call = railwayClient(railwayToken, fetcher);
  const inventory = await discover(call);
  let state = await instances(call, inventory);
  validateSettings(state);
  report.commit = sha;
  report.ciRun = `https://github.com/${REPOSITORY}/actions/runs/${runId}`;
  let polls = 0;
  for (const service of inventory.services.filter(service => service.name !== 'Postgres')) {
    // Reutiliza un despliegue del mismo SHA sin crear builds duplicados.
    const instance = state[service.name];
    const previousLatestId = instance.latestDeployment?.id;
    let deployment = [instance.latestDeployment, ...instance.activeDeployments].find(item => item?.meta?.commitHash === sha);
    if (!deployment) {
      await githubGate({ sha, runId, token: githubToken, fetcher });
      const created = await call(`mutation Deploy($environmentId: String!, $serviceId: String!, $commitSha: String!) {
        serviceInstanceDeployV2(environmentId: $environmentId, serviceId: $serviceId, commitSha: $commitSha)
      }`, { environmentId: inventory.environmentId, serviceId: service.id, commitSha: sha });
      ensure(UUID.test(created.serviceInstanceDeployV2), 'INVALID_DEPLOYMENT_ID');
      deployment = { id: created.serviceInstanceDeployV2, status: 'QUEUED' };
    }
    const entry = { service: service.name, deploymentId: deployment.id, status: 'pending' };
    report.services.push(entry);
    let observed = false;
    for (;;) {
      ensure(++polls <= 45, 'DEPLOYMENT_TIMEOUT');
      state = await instances(call, inventory, { id: deployment.id, service: service.name });
      const current = state[service.name];
      // SKIPPED puede desaparecer de latest/active: consultar siempre el ID exacto.
      const found = current.trackedDeployment;
      if (!found) {
        ensure(!observed, 'DEPLOYMENT_NOT_FOUND_OR_SUPERSEDED');
        await pause();
        continue; // Consistencia eventual después de crear el deployment.
      }
      observed = true;
      ensure(found.id === deployment.id && found.serviceId === service.id && found.environmentId === inventory.environmentId,
        'DEPLOYMENT_IDENTITY_MISMATCH');
      ensure(!current.latestDeployment || current.latestDeployment.id === previousLatestId || current.latestDeployment.meta?.commitHash === sha,
        'DEPLOYMENT_NOT_FOUND_OR_SUPERSEDED');
      ensure(found.meta?.commitHash === sha, 'DEPLOYMENT_COMMIT_MISMATCH');
      const changed = entry.status !== found.status;
      entry.status = found.status;
      // No copiar meta, motivos del proveedor ni errores privados a logs/artifacts.
      ensure(/^[A-Z_]{2,32}$/.test(found.status || ''), 'UNKNOWN_DEPLOYMENT_STATUS');
      if (changed || polls % 10 === 0) progress({ service: service.name, status: found.status, poll: polls });
      ensure(found.status !== 'WAITING', 'DEPLOYMENT_WAITING_FOR_CI');
      ensure(!terminal.has(found.status), 'DEPLOYMENT_FAILED_OR_NEEDS_APPROVAL');
      if (found.status === 'SUCCESS' && current.activeDeployments.some(item => item.id === found.id && item.status === 'SUCCESS')) break;
      await pause();
    }
  }
  validateSettings(state);
  await githubGate({ sha, runId, token: githubToken, fetcher });
  report.health = await checkPublicHealth(sha, fetcher);
  report.status = 'success';
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = { status: 'failed', services: [], checkedAt: new Date().toISOString() };
  try {
    await deployStaging({ sha: process.env.TARGET_SHA, runId: process.env.CI_RUN_ID,
      githubToken: process.env.GITHUB_TOKEN, railwayToken: process.env.RAILWAY_STAGING_TOKEN, report,
      progress: event => console.log(JSON.stringify(event)) });
    console.log('Staging verificado: frontend, backend, Python y PostgreSQL; mismo commit aprobado.');
  } catch (error) {
    report.status = 'failed';
    report.error = error instanceof DeploymentError ? error.message : 'DEPLOYMENT_CHECK_FAILED';
    console.error(`Staging no validado: ${report.error}.`);
    process.exitCode = 1;
  } finally {
    mkdirSync('reports/staging', { recursive: true });
    writeFileSync('reports/staging/deployment.json', JSON.stringify(report, null, 2) + '\n');
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Railway staging\n\nResultado: **${report.status}**. ${report.commit ? `Commit: \`${report.commit}\`.` : ''}\n\nVer artifact staging-evidence. No incluye tokens, variables ni logs de clientes.\n`);
  }
}

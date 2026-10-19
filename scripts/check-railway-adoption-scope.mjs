// Una consulta de lectura, sin imports, archivos, despliegues ni mutaciones.
import { pathToFileURL } from 'node:url';
import { PROJECT } from './deploy-staging.mjs';

export const ADOPTION_ENVIRONMENT = '7d352239-5259-4f92-8861-c6855df5ea19';
export const ADOPTION_SERVICES = Object.freeze({
  backend: '6218c32a-38a3-4c63-82a5-e36e44b9a72b',
  frontend: '2d33a057-3733-41b7-b45d-11043750244b',
  'python-service': '4f1950ea-e4b1-4a62-bd0b-3f38861eb5c6',
  Postgres: 'e0c2d481-2475-4ddb-87ea-bb020e09c3a2',
});
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const QUERY = `query AdoptionInventory($id: String!) {
  project(id: $id) {
    id name workspace { id }
    environments { edges { node { id name createdAt } } }
    services { edges { node { id name } } }
  }
}`;
export class AdoptionScopeError extends Error {}
const requireCondition = (condition, code) => { if (!condition) throw new AdoptionScopeError(code); };

export function validateAdoptionInventory(project) {
  requireCondition(project?.id === PROJECT && project.name === 'JembaTech Staging', 'WRONG_PROJECT');
  requireCondition(UUID.test(project.workspace?.id || ''), 'WORKSPACE_NOT_CONFIRMED');
  const environments = project.environments?.edges?.map(edge => edge?.node);
  requireCondition(Array.isArray(environments) && environments.length > 0 &&
    environments.every(item => item && UUID.test(item.id) && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt))) &&
    new Set(environments.map(item => item.id)).size === environments.length, 'INVALID_ENVIRONMENT_INVENTORY');
  const ordered = [...environments].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  requireCondition(ordered[0].id === ADOPTION_ENVIRONMENT && ordered[0].name === 'staging' &&
    environments.filter(item => item.name === 'staging').length === 1, 'STAGING_IS_NOT_PROVIDER_DEFAULT');
  requireCondition(ordered.length < 2 || Date.parse(ordered[0].createdAt) !== Date.parse(ordered[1].createdAt), 'AMBIGUOUS_DEFAULT_ENVIRONMENT');
  const services = project.services?.edges?.map(edge => edge?.node);
  requireCondition(Array.isArray(services) && services.every(item => item && UUID.test(item.id)) &&
    new Set(services.map(item => item.id)).size === services.length, 'INVALID_SERVICE_INVENTORY');
  for (const [name, id] of Object.entries(ADOPTION_SERVICES)) {
    const matches = services.filter(item => item.name === name);
    requireCondition(matches.length === 1 && matches[0].id === id, 'SERVICE_IDENTITY_MISMATCH');
  }
  return { status: 'ok', projectId: PROJECT, environmentId: ADOPTION_ENVIRONMENT, services: 4, providerDefault: 'staging' };
}

export async function checkAdoptionScope(token, fetcher = fetch) {
  requireCondition(typeof token === 'string' && token.length > 0 && token.length <= 4096 && !/\s/.test(token), 'MISSING_OR_INVALID_WORKSPACE_TOKEN');
  let response;
  try {
    response = await fetcher('https://backboard.railway.com/graphql/v2', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: QUERY, variables: { id: PROJECT } }),
    });
  } catch { throw new AdoptionScopeError('RAILWAY_CONNECTION_FAILED'); }
  requireCondition(response.status !== 429, 'RAILWAY_RATE_LIMIT_STOP_AND_WAIT');
  requireCondition(response.ok, 'RAILWAY_AUTH_OR_HTTP_FAILED');
  let body;
  try { body = await response.json(); } catch { throw new AdoptionScopeError('RAILWAY_INVALID_JSON'); }
  requireCondition((body?.errors == null || (Array.isArray(body.errors) && body.errors.length === 0)) &&
    body?.data?.project, 'RAILWAY_QUERY_FAILED');
  return validateAdoptionInventory(body.data.project);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requireCondition(process.argv.length === 2, 'NO_ARGUMENTS_ALLOWED');
    console.log(JSON.stringify(await checkAdoptionScope(process.env.RAILWAY_TOKEN)));
  } catch (error) {
    console.error(`Comprobación detenida: ${error instanceof AdoptionScopeError ? error.message : 'PREFLIGHT_FAILED'}. No se importaron recursos.`);
    process.exitCode = 1;
  }
}

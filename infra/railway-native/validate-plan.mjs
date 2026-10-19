import { applications, domain, migration, repository, scope } from './.railway/contract.mjs';

export class NativePlanError extends Error {}
export const requirePlan = (condition, code) => { if (!condition) throw new NativePlanError(code); };

// No devuelve el grafo, valores de variables, direcciones internas ni cambios propuestos.
export function validateNativePlan(data, exitCode) {
  requirePlan(exitCode === 0 && data?.ok === true && data.command === 'plan', 'NATIVE_PLAN_NOT_SUCCESSFUL');
  requirePlan(data.currentEnvironment?.projectId === scope.projectId &&
    data.currentEnvironment?.environmentId === scope.environmentId, 'NATIVE_PLAN_WRONG_SCOPE');
  requirePlan(Array.isArray(data.changeSet?.changes) && data.changeSet.changes.length === 0 &&
    Array.isArray(data.diagnostics) && data.diagnostics.length === 0, 'NATIVE_PLAN_HAS_CHANGES_OR_DIAGNOSTICS');
  requirePlan(['applyResult', 'stagedPatch', 'stagedPatchId', 'deploymentId'].every(key => data[key] === null),
    'NATIVE_PLAN_HAS_WRITE_RESULT');
  requirePlan(data.variablePolicy?.managed === false && data.desiredGraph?.project?.name === scope.projectName,
    'NATIVE_PLAN_MANAGES_VARIABLES_OR_WRONG_PROJECT');
  const resources = data.desiredGraph.resources;
  const expected = [...applications, 'Postgres', 'postgres-volume'];
  requirePlan(Array.isArray(resources) && resources.length === expected.length &&
    expected.every(name => resources.filter(resource => resource?.name === name).length === 1), 'NATIVE_PLAN_WRONG_INVENTORY');
  for (const resource of resources) {
    requirePlan(resource.variables == null || Object.keys(resource.variables).length === 0, 'NATIVE_GRAPH_CONTAINS_VARIABLES');
  }
  for (const name of applications) {
    const resource = resources.find(item => item.name === name);
    requirePlan(resource.type === 'service' && resource.source?.repo === repository &&
      resource.source.branch === 'main' && resource.source.rootDirectory === `/${name}` && resource.source.checkSuites === false &&
      resource.deploy?.healthcheckPath === (name === 'python-service' ? '/health' : '/api/health'), 'NATIVE_APPLICATION_SETTINGS_MISMATCH');
    const commands = resource.deploy?.preDeployCommand || [];
    requirePlan(JSON.stringify(commands) === JSON.stringify(name === 'backend' ? [migration] : []), 'NATIVE_MIGRATION_MISMATCH');
    const networking = resource.networking || {};
    requirePlan(!Object.keys(networking.customDomains || {}).length && !Object.keys(networking.tcpProxies || {}).length &&
      JSON.stringify(networking.serviceDomains || {}) === JSON.stringify(name === 'frontend' ? { [domain]: { port: 80 } } : {}),
    'NATIVE_NETWORKING_MISMATCH');
  }
  const db = resources.find(resource => resource.name === 'Postgres');
  const storage = resources.find(resource => resource.name === 'postgres-volume');
  requirePlan(db.type === 'database' && db.engine === 'postgres' && storage.type === 'volume' &&
    storage.config?.region === 'iad' && storage.config.sizeMB === 500, 'NATIVE_DATABASE_OR_VOLUME_MISMATCH');
  return { status: 'ok', mode: 'read-only-native-plan', plannedChanges: 0, nativeGraphResources: 5,
    healthchecks: 3, backendPreDeployDeclared: true, frontendDomainPort: 80, variablesManaged: false, remoteWrites: 0 };
}

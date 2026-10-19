import { defineRailway, github, postgres, project, service, volume } from 'railway/iac';
import { applications, assertPlanContext, domain, migration, repository, scope } from './contract.mjs';

// Declaración complementaria de lectura: NO transfiere propiedad desde Terraform.
// No quitar la guarda para ejecutar apply: el grafo incluye servicios y volumen.
export default defineRailway(ctx => {
  assertPlanContext(ctx);
  const services = applications.map(name => service(name, {
    source: github(repository, { branch: 'main', rootDirectory: `/${name}`, checkSuites: false }),
    build: { buildEnvironment: 'V3', builder: 'RAILPACK' },
    healthcheck: name === 'python-service' ? '/health' : '/api/health',
    replicas: { iad: 1 },
    ...(name === 'backend' ? { start: '', preDeploy: migration } : {}),
    ...(name === 'frontend' ? { networking: { serviceDomains: { [domain]: { port: 80 } } } } : {}),
  }));
  const database = postgres('Postgres', { region: 'iad' });
  database.networking = { privateNetworkEndpoint: 'postgres' };
  const storage = volume('postgres-volume', {
    alerts: { usage: { '80': {}, '95': {}, '100': {} } },
    allowOnlineResize: true, region: 'iad', sizeMB: 500,
  });
  // Sin env, generadores, referencias a secretos ni valores descifrados.
  return project(scope.projectName, {
    variables: { managed: false }, resources: [...services, database, storage],
  });
});

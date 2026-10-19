// Solo configuración pública. No copiar variables de entorno, estado ni secretos aquí.
export const scope = Object.freeze({
  projectId: '8aa2ee89-8dfa-4251-a8f3-7a6f35adf9c2',
  projectName: 'JembaTech Staging',
  environmentId: '7d352239-5259-4f92-8861-c6855df5ea19',
  environment: 'staging',
});
export const repository = 'RodriguezPavezBenjamin/JembaTech';
export const domain = 'jembatech.up.railway.app';
export const migration = 'node node_modules/prisma/build/index.js migrate deploy';
export const postgresImage = 'ghcr.io/railwayapp-templates/postgres-ssl:18';
export const postgresMount = '/var/lib/postgresql/data';
export const applications = Object.freeze(['frontend', 'python-service', 'backend']);

export function assertPlanContext(ctx) {
  if (!ctx || ctx.command !== 'plan' || ctx.projectId !== scope.projectId ||
      ctx.environmentId !== scope.environmentId || ctx.environment !== scope.environment) {
    throw new Error('READ_ONLY_STAGING_PLAN_ONLY');
  }
}

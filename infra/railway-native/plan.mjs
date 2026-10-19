import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, win32 } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { instances, validateSettings } from '../../scripts/deploy-staging.mjs';
import { ADOPTION_SERVICES } from '../../scripts/check-railway-adoption-scope.mjs';
import { postgresImage, scope } from './.railway/contract.mjs';
import { NativePlanError, requirePlan, validateNativePlan } from './validate-plan.mjs';
const directory = dirname(fileURLToPath(import.meta.url));

// Llamador inyectable para pruebas sin CLI, credenciales, red ni escrituras.
export async function checkNativePlan({ cli, environment = process.env, run = spawnSync } = {}) {
  requirePlan(typeof cli === 'string' && (isAbsolute(cli) || win32.isAbsolute(cli)) &&
    /^railway(?:\.exe)?$/.test(cli.split(/[\\/]/).at(-1)), 'ABSOLUTE_RAILWAY_EXECUTABLE_REQUIRED');
  const env = { ...environment, _: cli, CI: 'true', DO_NOT_TRACK: '1', NO_COLOR: '1' };
  // Solo login existente del propietario; no reactivar ni exportar tokens de Terraform/CD.
  for (const key of Object.keys(env)) if (/^RAILWAY_(?:API_)?TOKEN$/i.test(key)) delete env[key];
  const call = args => {
    const result = run(cli, args, { cwd: directory, env, encoding: 'utf8', shell: false,
      windowsHide: true, timeout: 45000, maxBuffer: 8 * 1024 * 1024 });
    requirePlan(!result.error && result.status === 0, 'NATIVE_CLI_STOPPED_NO_RETRY');
    try { return JSON.parse(result.stdout); } catch { throw new NativePlanError('NATIVE_CLI_INVALID_JSON'); }
  };
  const linked = call(['status', '--environment', scope.environmentId, '--json']);
  requirePlan(linked?.id === scope.projectId && linked.name === scope.projectName, 'NATIVE_LINKED_PROJECT_MISMATCH');
  const inventory = { environmentId: scope.environmentId,
    services: ['python-service', 'backend', 'frontend', 'Postgres'].map(name => ({ name, id: ADOPTION_SERVICES[name] })) };
  const readSettings = async () => {
    const state = await instances(async (query, variables) => {
      requirePlan(query.startsWith('query Instances('), 'READ_ONLY_QUERY_REQUIRED');
      const body = call(['api', query, '--variables', JSON.stringify(variables), '--compact']);
      requirePlan(!body.errors?.length, 'NATIVE_SETTINGS_QUERY_FAILED');
      return body.data || body;
    }, inventory);
    try { validateSettings(state); } catch { throw new NativePlanError('NATIVE_LIVE_SETTINGS_OR_CD_POLICY_MISMATCH'); }
    requirePlan(state.Postgres.source?.image === postgresImage, 'NATIVE_POSTGRES_IMAGE_MISMATCH');
  };
  await readSettings();
  const data = call(['config', 'plan', '--file', join(directory, '.railway', 'railway.ts'),
    '--environment', scope.environmentId, '--json', '--detailed-exit-code']);
  const result = validateNativePlan(data, 0);
  await readSettings();
  return { ...result, autodeployServices: 0, ciWaitServices: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requirePlan(process.argv.length === 3 && process.argv[2] === '--check', 'READ_ONLY_CHECK_MODE_REQUIRED');
    const cli = process.env.RAILWAY_CLI || (process.platform === 'win32' && process.env.APPDATA
      ? join(process.env.APPDATA, 'npm', 'node_modules', '@railway', 'cli', 'bin', 'railway.exe') : undefined);
    console.log(JSON.stringify(await checkNativePlan({ cli })));
  } catch (error) {
    console.error(JSON.stringify({ status: 'stopped', code: error instanceof NativePlanError ? error.message : 'NATIVE_CHECK_FAILED', remoteWrites: 0 }));
    process.exitCode = 1;
  }
}

// Operación local explícita y finita. No cron, no red al importar este módulo.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export function catalogArgs(args) {
  const targets = JSON.parse(readFileSync(new URL('../python-service/catalog_scope.json', import.meta.url), 'utf8'));
  if (args.length === 2 && args[0] === '--live' && args[1] === '--all') return 'all';
  if (args.length === 3 && args[0] === '--live' && args[1] === '--target' && targets.some(t => t.id === args[2])) return args[2];
  throw Error('Usar --live --all o --live --target con una selección cerrada.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const target = catalogArgs(process.argv.slice(2));
    const worker = readFileSync(new URL('./import-solotodo-catalog.worker.mjs', import.meta.url), 'utf8');
    const child = spawn('docker', ['compose', 'run', '--rm', '-T', '--no-deps', '-e', `EP2_CATALOG_TARGET=${target}`, '-e', 'EP2_CATALOG_API_BASE=http://backend:3000', 'backend', 'node', '--input-type=module'], { stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.end(worker);
    child.stdout.pipe(process.stdout);
    // No propagar trazas de Docker/entorno que pudieran contener configuración.
    child.stderr.resume();
    child.on('error', () => { console.error('No se pudo iniciar la importación local.'); process.exitCode = 1; });
    child.on('close', code => { process.exitCode = code ?? 1; });
  } catch { console.error('Importación no iniciada. Revisa los argumentos y servicios locales.'); process.exitCode = 1; }
}

// Una acción manual sobre un SKU revisado. Sin red ni escritura al importar.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export function parsePriceArgs(args) {
  const ids = ['cpu-7600', 'gpu-4060', 'board-msi-b550-a-pro', 'ram-kingston-ddr4-rgb-16', 'drive-kingston-a400-480', 'drive-samsung-990-pro-1000', 'cpu-9600x', 'gpu-asrock-9060xt-16'];
  if (args.length !== 3 || args[0] !== '--live' || args[1] !== '--target' || !ids.includes(args[2])) throw new Error('Usar --live --target con un modelo vinculado.');
  return args[2];
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const target = parsePriceArgs(process.argv.slice(2));
    const worker = readFileSync(new URL('./update-catalog-price.worker.mjs', import.meta.url), 'utf8');
    const result = execFileSync('docker', ['compose', 'exec', '-T', '-e', `EP2_PRICE_TARGET=${target}`, 'backend', 'node', '--input-type=module'], { input: worker, encoding: 'utf8', timeout: 45000, maxBuffer: 100000, stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(JSON.stringify(JSON.parse(result.trim()), null, 2));
  } catch { console.error('Precio no actualizado. Revisar servicios, confirmación, historial y cooldown; no hay reintento automático.'); process.exitCode = 1; }
}

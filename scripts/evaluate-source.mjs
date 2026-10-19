// Evaluación manual acotada. Nunca se ejecuta como test de CI ni al importar.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseSourceEvaluationArgs(args) {
  let live = false;
  let limit = 1;
  let limitSeen = false;
  let target;
  const targets = ['ryzen-7600', 'ryzen-9600x', 'core-i5-14400', 'core-ultra-245k', 'rtx-4060', 'rtx-5060', 'rx-7600', 'rx-9060xt',
    'msi-b650', 'msi-b760', 'fury-ddr4', 'fury-ddr5', 'barracuda-hdd', 'mx500-sata', 'nv3-pcie',
    'ryzen-5600', 'ryzen-5600g', 'ryzen-7800x3d', 'msi-b550-a-pro', 'msi-4060-ventus', 'fury-rgb-ddr4-kit', 'a400-480-sata', '990-pro-1tb'];
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (value === '--live' && !live) live = true;
    else if (value === '--limit' && !limitSeen && /^[1-5]$/.test(args[index + 1] ?? '')) {
      limit = Number(args[++index]);
      limitSeen = true;
    } else if (value === '--target' && !target && targets.includes(args[index + 1])) target = args[++index];
    else throw new Error('Argumentos inválidos: usar --live con --limit 1..5 o --target de la selección.');
  }
  if (!live) throw new Error('Sin --live no se consulta la fuente ni se crean registros.');
  if (target && limitSeen) throw new Error('--target usa una página fija de hasta 5; no combinar con --limit.');
  return target ? { limit: 5, target } : { limit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { limit, target } = parseSourceEvaluationArgs(process.argv.slice(2));
    const worker = readFileSync(new URL('./evaluate-source.worker.mjs', import.meta.url), 'utf8');
    const output = execFileSync('docker', ['compose', 'exec', '-T', '-e', `EP2_EVAL_LIMIT=${limit}`, '-e', `EP2_EVAL_TARGET=${target ?? ''}`, 'backend', 'node', '--input-type=module'], {
      input: worker, encoding: 'utf8', timeout: 45000, maxBuffer: 250000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Solo el resumen público producido por el worker; nunca errores de Docker/env.
    const result = JSON.parse(output.trim());
    if (result.status !== 'ok') throw new Error('Evaluación incompleta.');
    console.log(JSON.stringify(result, null, 2));
  } catch {
    console.error('Evaluación no completada. Requiere --live con --limit 1..5 o --target de la selección, servicios locales activos y piloto habilitado. No se reintenta; revisar la corrida y el cooldown en el panel admin.');
    process.exitCode = 1;
  }
}

// Evaluación manual acotada. Nunca se ejecuta como test de CI ni al importar.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseSourceEvaluationArgs(args) {
  let live = false;
  let limit = 1;
  let limitSeen = false;
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (value === '--live' && !live) live = true;
    else if (value === '--limit' && !limitSeen && /^[1-5]$/.test(args[index + 1] ?? '')) {
      limit = Number(args[++index]);
      limitSeen = true;
    } else throw new Error('Argumentos inválidos: usar --live --limit 1..5.');
  }
  if (!live) throw new Error('Sin --live no se consulta la fuente ni se crean registros.');
  return { limit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { limit } = parseSourceEvaluationArgs(process.argv.slice(2));
    const worker = readFileSync(new URL('./evaluate-source.worker.mjs', import.meta.url), 'utf8');
    const output = execFileSync('docker', ['compose', 'exec', '-T', '-e', `EP2_EVAL_LIMIT=${limit}`, 'backend', 'node', '--input-type=module'], {
      input: worker, encoding: 'utf8', timeout: 45000, maxBuffer: 250000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Solo el resumen público producido por el worker; nunca errores de Docker/env.
    const result = JSON.parse(output.trim());
    if (result.status !== 'ok') throw new Error('Evaluación incompleta.');
    console.log(JSON.stringify(result, null, 2));
  } catch {
    console.error('Evaluación no completada. Requiere --live --limit 1..5, servicios locales activos y piloto habilitado. No se reintenta; revisar la corrida y el cooldown en el panel admin.');
    process.exitCode = 1;
  }
}

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function checkAdoption(plan) {
  if (!plan || !Array.isArray(plan.resource_changes)) throw new Error('Plan no válido.');
  // Primera adopción: no crear duplicados, actualizar ni reemplazar recursos.
  // terraform import solo debe asociar infraestructura existente al estado.
  const writes = plan.resource_changes.filter(resource => {
    const actions = resource.change?.actions;
    return !Array.isArray(actions) || actions.length !== 1 || !['no-op', 'read'].includes(actions[0]);
  });
  if (writes.length) throw new Error('Adopción bloqueada: el plan propone cambios. Ajustar el código a lo existente; no aplicar.');
  if (plan.errored || plan.complete === false || plan.deferred_changes?.length) throw new Error('Plan incompleto; no aplicar.');
  return { status: 'ok', changes: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(checkAdoption(JSON.parse(readFileSync(process.argv[2], 'utf8')))));
  } catch {
    console.error('Adopción no validada: se requiere un plan completo sin cambios sobre los recursos importados.');
    process.exitCode = 1;
  }
}

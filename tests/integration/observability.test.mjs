// Ejecutar desde la raíz con Compose en marcha. El worker usa cuentas QA propias.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('observabilidad: Nginx-NestJS-FastAPI, roles, concurrencia, errores, tiempos y privacidad', () => {
  const worker = readFileSync(new URL('./observability.worker.mjs', import.meta.url), 'utf8');
  const output = execFileSync('docker', ['compose', 'exec', '-T', 'backend', 'node', '--input-type=module'], {
    input: worker, encoding: 'utf8', timeout: 60000, maxBuffer: 2_000_000,
  });
  const evidence = JSON.parse(output.trim());
  const logs = spawnSync('docker', ['compose', 'logs', '--no-color', '--tail', '500', 'frontend', 'backend', 'python-service'], {
    encoding: 'utf8', timeout: 15000, maxBuffer: 4_000_000,
  });
  assert.equal(logs.status, 0, 'No se pudieron leer los logs de verificación.');
  const raw = logs.stdout + logs.stderr;
  assert.equal(raw.includes(evidence.marker), false, 'Una marca privada de prueba se filtró al log.');
  const events = raw.split('\n').flatMap(line => {
    const start = line.indexOf('{');
    if (start < 0) return [];
    try { return [JSON.parse(line.slice(start))]; } catch { return []; }
  });
  for (const requestId of evidence.correlations) {
    for (const service of ['jemba-web', 'jemba-api', 'jemba-evaluator']) {
      assert.ok(events.some(event => event.requestId === requestId && event.service === service && event.event === 'http_request'), `${service}: falta correlación HTTP.`);
    }
    assert.ok(events.some(event => event.event === 'python_request' && event.requestId === requestId && event.correlated === true));
  }
  assert.ok(events.some(event => event.event === 'sample_started' && event.requestId === evidence.sampleId && event.runId === evidence.runId));
  assert.ok(events.some(event => event.event === 'http_request' && event.requestId === evidence.disabledId && event.status === 503));
  assert.ok(events.some(event => event.service === 'jemba-evaluator' && event.requestId === evidence.pythonId && event.status === 422));
  for (const event of events.filter(event => event.event === 'http_request')) {
    assert.ok(!('body' in event) && !('headers' in event) && !('query' in event) && !('url' in event));
  }
  console.log(JSON.stringify({ observability: 'ok', correlatedRequests: evidence.correlations.length,
    pythonAverageMs: evidence.pythonAverageMs, pythonMaxMs: evidence.pythonMaxMs, privateMarkerLeaked: false }));
});

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function checkHealth({
  api = process.env.TEST_API_URL ?? 'http://127.0.0.1:3000/api',
  frontend = process.env.TEST_FRONTEND_URL ?? 'http://127.0.0.1:4200',
  python = process.env.TEST_PYTHON_URL ?? 'http://127.0.0.1:8000',
} = {}) {
  const [apiResponse, webResponse, pythonResponse, proxyResponse] = await Promise.all([
    fetch(`${api}/health`, { signal: AbortSignal.timeout(3000) }),
    fetch(frontend, { signal: AbortSignal.timeout(3000) }),
    fetch(`${python}/health`, { signal: AbortSignal.timeout(3000) }),
    fetch(`${frontend}/api/health`, { signal: AbortSignal.timeout(3000) }),
  ]);
  for (const response of [apiResponse, webResponse, pythonResponse, proxyResponse]) assert.equal(response.status, 200);
  const backend = await apiResponse.json();
  assert.equal(backend.status, 'ok');
  assert.equal(backend.service, 'jemba-api');
  assert.equal(backend.database, 'ok');
  assert.match(await webResponse.text(), /<title>JembaTech<\/title>/);
  const evaluator = await pythonResponse.json();
  assert.equal(evaluator.status, 'ok');
  assert.equal(evaluator.service, 'jemba-evaluator');
  assert.equal((await proxyResponse.json()).database, 'ok');
  return { status: 'ok', frontend: 'ok', backend: 'ok', python: 'ok', database: 'ok', proxy: 'ok' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await checkHealth()));
  } catch {
    // No imprimir URLs de despliegue, respuestas ni credenciales en un fallo.
    console.error('Falló la comprobación de salud del ambiente.');
    process.exitCode = 1;
  }
}

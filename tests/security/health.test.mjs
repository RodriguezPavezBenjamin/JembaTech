import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { checkHealth } from '../../scripts/check-health.mjs';

const sha = 'a'.repeat(40);

async function withHealthServer(run) {
  const state = { database: 'ok', python: 'ok', apiCommit: sha, evaluatorCommit: sha,
    pythonCommit: sha, webCommit: sha, status: 200 };
  const server = createServer((request, response) => {
    response.statusCode = state.status;
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/') return response.end('<title>JembaTech</title>');
    if (request.url === '/version.json') return response.end(JSON.stringify({ service: 'jemba-web', commit: state.webCommit }));
    if (request.url === '/health') return response.end(JSON.stringify({ status: 'ok', service: 'jemba-evaluator', commit: state.evaluatorCommit }));
    response.end(JSON.stringify({ status: 'ok', service: 'jemba-api', database: state.database,
      python: state.python, commit: state.apiCommit, pythonCommit: state.pythonCommit }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    // Aislar el test de variables del runner; cada caso activa el SHA explícitamente.
    await run(state, { api: `${origin}/api`, frontend: origin, python: origin, expectedCommit: null });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('health: comprueba frontend, proxy, NestJS, FastAPI y PostgreSQL, no solo HTTP 200', async () => {
  await withHealthServer(async (state, options) => {
    assert.equal((await checkHealth(options)).status, 'ok');
    state.database = 'down';
    await assert.rejects(checkHealth(options));
  });
});

test('health: Python caído o ausente en el contrato bloquea aunque HTTP sea 200', async () => {
  await withHealthServer(async (state, options) => {
    for (const python of ['down', undefined]) {
      state.python = python;
      await assert.rejects(checkHealth(options));
    }
  });
});

test('health: exige el mismo SHA en frontend, backend y Python cuando se solicita', async () => {
  await withHealthServer(async (state, options) => {
    const versioned = { ...options, expectedCommit: sha };
    assert.equal((await checkHealth(versioned)).status, 'ok');
    for (const field of ['apiCommit', 'evaluatorCommit', 'pythonCommit', 'webCommit']) {
      state[field] = 'b'.repeat(40);
      await assert.rejects(checkHealth(versioned));
      state[field] = sha;
    }
    assert.equal((await checkHealth(versioned)).status, 'ok');
  });
});

test('health: una respuesta HTTP no saludable también bloquea', async () => {
  await withHealthServer(async (state, options) => {
    state.status = 503;
    await assert.rejects(checkHealth(options));
  });
});

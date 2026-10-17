import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { checkHealth } from '../../scripts/check-health.mjs';

test('health: comprueba frontend, proxy, NestJS, FastAPI y PostgreSQL, no solo HTTP 200', async () => {
  let failDatabase = false;
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/') return response.end('<title>JembaTech</title>');
    if (request.url === '/health') return response.end(JSON.stringify({ status: 'ok', service: 'jemba-evaluator' }));
    response.end(JSON.stringify({ status: 'ok', service: 'jemba-api', database: failDatabase ? 'down' : 'ok' }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await checkHealth({ api: `${origin}/api`, frontend: origin, python: origin })).status, 'ok');
    failDatabase = true;
    await assert.rejects(checkHealth({ api: `${origin}/api`, frontend: origin, python: origin }));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

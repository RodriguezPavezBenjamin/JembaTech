// Se ejecuta dentro de NestJS. Solo usuarios/corridas QA propios; sin red externa.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const require = createRequire(join(process.cwd(), 'package.json'));
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const prisma = new PrismaClient();
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
const marker = `PRIVATE-QA-${randomUUID()}`;
const userIds = [];
const runIds = [];
const correlations = [];
const base = 'http://frontend/api';
async function request(path, { token, id = randomUUID(), body, method = 'GET' } = {}) {
  const response = await fetch(base + path, {
    method, signal: AbortSignal.timeout(15000),
    headers: { 'X-Request-Id': id, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.headers.get('x-request-id'), id);
  return response;
}
async function user(role) {
  const row = await prisma.user.create({ data: { name: marker, email: `qa-${role}-${randomUUID()}@example.invalid`, passwordHash: 'NO_LOGIN_QA_TEMPORAL', role } });
  userIds.push(row.id);
  return jwt.signAsync({ sub: row.id, email: row.email, role }, { expiresIn: '5m' });
}
try {
  const admin = await user('ADMIN');
  const client = await user('CLIENT');
  assert.equal((await request('/admin/observability')).status, 401);
  assert.equal((await request('/admin/observability', { token: client })).status, 403);
  const before = await (await request('/admin/observability', { token: admin })).json();
  assert.equal(before.scope, 'single-process');
  assert.equal(before.resetsOnRestart, true);
  assert.equal(JSON.stringify(before).includes(marker), false);

  const draft = { budget: 1000000, intendedUse: 'gaming', name: marker, cpu: 'cpu-7600', drives: [], extras: [] };
  const ids = [randomUUID(), randomUUID()];
  await Promise.all(ids.map(async id => {
    const response = await request('/builds/preview', { id, method: 'POST', body: draft });
    assert.equal(response.status, 201);
    assert.ok((await response.json()).total_price > 0);
  }));
  correlations.push(...ids);

  const sampleId = randomUUID();
  const sample = await request('/admin/sources/solotodo/cpu/samples', {
    token: admin, id: sampleId, method: 'POST', body: { retrievedAt: new Date().toISOString(), records: [null] },
  });
  assert.equal(sample.status, 201);
  const run = await sample.json();
  runIds.push(run.id);
  assert.notEqual(run.id, sampleId);
  correlations.push(sampleId);

  // Un error real de operación controlado; no se consulta el proveedor.
  const disabledId = randomUUID();
  const disabled = await request('/admin/sources/solotodo/cpu/recover', {
    token: admin, id: disabledId, method: 'POST', body: { limit: 1, acknowledged: true },
  });
  assert.equal(disabled.status, 503);
  assert.equal((await disabled.json()).code, 'MANUAL_PROBE_DISABLED');

  const invalid = await fetch(`${base}/health?email=${marker}`, { headers: { 'X-Request-Id': marker } });
  assert.equal(invalid.status, 200);
  assert.match(invalid.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  assert.notEqual(invalid.headers.get('x-request-id'), marker);

  const pythonId = randomUUID();
  const invalidPython = await fetch('http://python-service:8000/evaluate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': pythonId },
    body: JSON.stringify({ private: marker }), signal: AbortSignal.timeout(10000),
  });
  assert.equal(invalidPython.status, 422);
  assert.equal(invalidPython.headers.get('x-request-id'), pythonId);

  const snapshot = await (await request('/admin/observability', { token: admin })).json();
  const pythonMetric = snapshot.python.find(item => item.route === '/builds/preview');
  assert.ok(pythonMetric.count >= 2);
  assert.ok(Number.isFinite(pythonMetric.averageMs) && pythonMetric.averageMs >= 0);
  assert.ok(pythonMetric.maxMs >= pythonMetric.averageMs);
  assert.ok(snapshot.inbound.some(item => item.route === 'POST /api/admin/sources/solotodo/cpu/recover' && item.errors >= 1));
  assert.equal(JSON.stringify(snapshot).includes(marker), false);
  console.log(JSON.stringify({ marker, correlations, runId: run.id, sampleId, disabledId, pythonId,
    pythonAverageMs: pythonMetric.averageMs, pythonMaxMs: pythonMetric.maxMs }));
} finally {
  try {
    await prisma.sourceRun.deleteMany({ where: { id: { in: runIds }, createdById: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally { await prisma.$disconnect(); }
}

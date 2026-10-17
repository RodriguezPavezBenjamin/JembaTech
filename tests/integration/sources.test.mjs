// Ejecutar dentro del backend. Sin red externa; fixtures sintéticas.
// Crea y limpia SOLO cuentas, muestras y fichas QA de esta ejecución.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(join(process.cwd(), 'package.json'));
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const prisma = new PrismaClient();
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
const suffix = randomUUID();
const qaName = `QA source ${suffix}`;
const externalId = 8000000000000 + Number.parseInt(suffix.slice(0, 8), 16);
const userIds = [];
let qaAdminId;
const base = 'http://127.0.0.1:3000/api/admin/sources/solotodo';

async function request(path, token, method = 'GET', body) {
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
}
async function user(role) {
  const row = await prisma.user.create({ data: { name: 'QA fuente temporal', email: `qa-source-${role}-${suffix}@example.invalid`, passwordHash: 'NO_LOGIN_QA_TEMPORAL', role } });
  userIds.push(row.id); if (role === 'ADMIN') qaAdminId = row.id;
  return jwt.signAsync({ sub: row.id, email: row.email, role }, { expiresIn: '5m' });
}
function record(changes = {}) {
  return { id: externalId, category_id: 3, name: qaName, brand: { name: 'AMD' }, part_number: 'QA-ONLY', last_updated: '2025-01-01T00:00:00Z', specs: { socket_unicode: 'AM4', core_count_value: 6, thread_count_value: 12, tdp: 65 }, ...changes };
}

try {
  const deadline = Date.now() + 60000;
  while (true) {
    try { if ((await fetch('http://127.0.0.1:3000/api/health', { signal: AbortSignal.timeout(2000) })).ok) break; } catch { /* servicio arrancando */ }
    if (Date.now() > deadline) throw new Error('Backend health timeout');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(await prisma.externalReference.count({ where: { source: 'solotodo', externalId: String(externalId) } }), 0, 'No sobrescribir una referencia preexistente');
  const admin = await user('ADMIN');
  const client = await user('CLIENT');
  assert.equal((await request('', null)).status, 401);
  for (const path of ['', '/references', '/runs']) assert.equal((await request(path, client)).status, 403);
  assert.equal((await request('/cpu/samples', client, 'POST', { retrievedAt: '2026-01-01T00:00:00Z', records: [record()] })).status, 403);
  assert.equal((await request('/cpu/recover', client, 'POST', { limit: 1, acknowledged: true })).status, 403);
  const overview = await (await request('', admin)).json();
  assert.equal(overview.synchronizationEnabled, false);
  assert.equal(overview.mode, 'on-demand-pilot');

  const now = Date.now();
  const firstStamp = new Date(now - 20000).toISOString();
  let result = await request('/cpu/samples', admin, 'POST', { retrievedAt: firstStamp, records: [record(), record()] });
  assert.equal(result.status, 201, await result.clone().text());
  const firstRun = await result.json();
  assert.equal(firstRun.status, 'SUCCEEDED');
  assert.deepEqual([firstRun.metrics.received, firstRun.metrics.accepted, firstRun.metrics.duplicates, firstRun.storedCount], [2, 1, 1, 1]);
  assert.equal(await prisma.externalReference.count({ where: { source: 'solotodo', externalId: String(externalId) } }), 1);

  const newerStamp = new Date(now - 10000).toISOString();
  result = await request('/cpu/samples', admin, 'POST', { retrievedAt: newerStamp, records: [record({ name: qaName + ' nueva' })] });
  assert.equal(result.status, 201);
  let stored = await prisma.externalReference.findUnique({ where: { source_externalId: { source: 'solotodo', externalId: String(externalId) } } });
  assert.equal(stored.name, qaName + ' nueva');
  assert.equal(stored.internalCatalogId, null);
  assert.equal(stored.accessStatus, 'reuse-not-confirmed');
  assert.equal(stored.acquisitionMode, 'manual-sample');
  assert.equal(stored.specs.declaredTdpWatts, 65);
  assert.equal(stored.retrievedAt.toISOString(), newerStamp);

  result = await request('/cpu/samples', admin, 'POST', { retrievedAt: firstStamp, records: [record()] });
  assert.equal((await result.json()).staleSkipped, 1);
  result = await request('/cpu/samples', admin, 'POST', { retrievedAt: newerStamp, records: [record({ name: qaName + ' conflicto' })] });
  assert.equal((await result.json()).staleSkipped, 1);
  stored = await prisma.externalReference.findUnique({ where: { source_externalId: { source: 'solotodo', externalId: String(externalId) } } });
  assert.equal(stored.name, qaName + ' nueva');

  result = await request('/cpu/samples', admin, 'POST', { retrievedAt: newerStamp, records: [record({ category_id: 549 }), null] });
  const rejected = await result.json();
  assert.equal(result.status, 201);
  assert.equal(rejected.metrics.rejected, 2);
  assert.equal(rejected.storedCount, 0);
  assert.equal(rejected.issues[1].fields[0], '$');
  assert.equal((await request('/cpu/samples', admin, 'POST', { retrievedAt: newerStamp, records: Array(6).fill(record()) })).status, 400);
  assert.equal((await request('/cpu/samples', admin, 'POST', { retrievedAt: '2099-01-01T00:00:00Z', records: [record()] })).status, 400);
  assert.equal((await request('/references?pageSize=10000', admin)).status, 400);
  const page = await (await request(`/references?q=${encodeURIComponent(qaName)}&pageSize=1`, admin)).json();
  assert.equal(page.total, 1); assert.equal(page.items.length, 1);
  assert.equal(page.items[0].sourceUrl, `https://www.solotodo.cl/products/${externalId}`);
  const runs = await (await request('/runs', admin)).json();
  assert.ok(runs.some(run => run.id === firstRun.id));
  assert.ok(runs.every(run => !('createdById' in run)));
  // Fallo real de transporte en una instancia aislada, sin detener servicios.
  const { SourcesService } = require('./dist/sources/sources.service.js');
  const { HttpService } = require('@nestjs/axios');
  const previousUrl = process.env.PYTHON_SERVICE_URL;
  try {
    process.env.PYTHON_SERVICE_URL = 'http://127.0.0.1:1';
    const isolated = new SourcesService(new HttpService(), prisma);
    await assert.rejects(isolated.prepareSample({ retrievedAt: newerStamp, records: [record()] }, qaAdminId), error => error.getStatus?.() === 503);
  } finally { if (previousUrl === undefined) delete process.env.PYTHON_SERVICE_URL; else process.env.PYTHON_SERVICE_URL = previousUrl; }
  const failed = await prisma.sourceRun.findFirst({ where: { createdById: qaAdminId, status: 'FAILED' } });
  assert.equal(failed.errorCode, 'PYTHON_UNAVAILABLE');
  const afterFailure = await prisma.externalReference.findUnique({ where: { source_externalId: { source: 'solotodo', externalId: String(externalId) } } });
  assert.equal(afterFailure.contentHash, stored.contentHash);
  console.log('EP2 HTTP: permisos, NestJS-Python-PostgreSQL, validación, hash, deduplicación, antigüedad, consulta, auditoría y fallo real de transporte: OK');
} finally {
  // Targets exactos y prefijo exclusivo; nunca borrados globales.
  await prisma.externalReference.deleteMany({ where: { source: 'solotodo', externalId: String(externalId), name: { startsWith: qaName } } });
  if (qaAdminId) await prisma.sourceRun.deleteMany({ where: { createdById: qaAdminId, source: 'solotodo', mode: 'manual-sample' } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds }, name: 'QA fuente temporal' } });
  await prisma.$disconnect();
  console.log('Solo registros QA de esta ejecución retirados; cotizaciones y fichas reales intactas.');
}

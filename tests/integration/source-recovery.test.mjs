// Sin Internet externo. PostgreSQL real + coordinador real + transporte Python simulado.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(join(process.cwd(), 'package.json'));
const { PrismaClient } = require('@prisma/client');
const { HttpService } = require('@nestjs/axios');
const { SourcesService } = require('./dist/sources/sources.service.js');
const { sourceTarget } = require('./dist/sources/source.targets.js');
const { of } = require('rxjs');
const prisma = new PrismaClient();
const suffix = randomUUID();
const qaName = `QA recovery ${suffix}`;
const externalId = String(7000000000000 + Number.parseInt(suffix.slice(0, 8), 16));
const original = { enabled: process.env.SOLOTODO_MANUAL_PROBE_ENABLED, token: process.env.SOURCE_INTERNAL_TOKEN, url: process.env.PYTHON_SERVICE_URL };
const token = randomBytes(32).toString('hex');
let userId;
let calls = 0;
let fail = false;
let componentMode = false;
const gpuId = String(Number(externalId) + 1);

function normalized(stamp, name = qaName) {
  return { schema_version: 'solotodo-cpu-1', access_status: 'reuse-not-confirmed',
    products: [{ source: 'solotodo', external_id: externalId, category: 'cpu', name, brand: 'AMD', part_number: null, socket: 'AM4', cores: 6, threads: 12, declared_tdp_watts: 65, price_clp: null, source_url: `https://www.solotodo.cl/products/${externalId}`, retrieved_at: stamp, source_updated_at: null, content_hash: '1'.repeat(64) }],
    issues: [], metrics: { received: 1, accepted: 1, rejected: 0, duplicates: 0, valid_percent: 100, duplicate_percent: 0, missing_tdp: 0, processing_ms: 1 } };
}
const server = createServer(async (req, res) => {
  try {
    assert.equal(req.headers['x-source-token'], token);
    assert.equal(req.url, componentMode ? '/sources/solotodo/components/recover' : '/sources/solotodo/cpu/recover');
    const parts = []; for await (const part of req) parts.push(part);
    const body = JSON.parse(Buffer.concat(parts).toString());
    if (componentMode) assert.equal(body.target, 'rtx-5060'); else assert.equal(body.limit, 1);
    calls++;
    res.setHeader('Content-Type', 'application/json');
    if (fail) { res.statusCode = 502; res.end(JSON.stringify({ detail: { code: 'SOURCE_ACCESS_DENIED' } })); return; }
    const stamp = new Date().toISOString();
    if (componentMode) {
      res.end(JSON.stringify({ ...normalized(stamp), schema_version: 'solotodo-components-2', category: 'gpu', target: 'rtx-5060',
        products: [{ ...normalized(stamp).products[0], external_id: gpuId, category: 'gpu',
          specs: { chip: 'NVIDIA RTX 5060 QA', chipBrand: 'NVIDIA', vramGb: 16, memoryType: 'GDDR6', declaredTdpWatts: 160, lengthMm: null, slots: null, bus: null },
          source_url: `https://www.solotodo.cl/products/${gpuId}` }],
        request_id: body.request_id, retrieved_at: stamp, source_request_url: sourceTarget('rtx-5060').url, retrieval_ms: 2 }));
      return;
    }
    res.end(JSON.stringify({ ...normalized(stamp), request_id: body.request_id, retrieved_at: stamp, source_request_url: 'https://api.solotodo.com/products/?categories=3&page_size=1', retrieval_ms: 2 }));
  } catch { res.statusCode = 500; res.end('{}'); }
});

try {
  assert.equal(await prisma.externalReference.count({ where: { source: 'solotodo', externalId } }), 0);
  assert.equal(await prisma.externalReference.count({ where: { source: 'solotodo', externalId: gpuId } }), 0);
  assert.equal(await prisma.sourceRun.count({ where: { source: 'solotodo', mode: 'manual-api', OR: [{ status: 'RUNNING' }, { startedAt: { gt: new Date(Date.now() - 60000) } }] } }), 0, 'No ejecutar mientras haya una consulta real activa/reciente');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.PYTHON_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SOLOTODO_MANUAL_PROBE_ENABLED = 'true'; process.env.SOURCE_INTERNAL_TOKEN = token;
  const user = await prisma.user.create({ data: { name: 'QA recovery temporal', email: `qa-recovery-${suffix}@example.invalid`, role: 'ADMIN', passwordHash: 'NO_LOGIN_QA_TEMPORAL' } });
  userId = user.id;
  const service = new SourcesService(new HttpService(), prisma);
  const dto = { limit: 1, acknowledged: true };
  await prisma.externalReference.create({ data: { source: 'solotodo', externalId, category: 'cpu', name: qaName + ' declarada', brand: 'AMD', specs: {}, sourceUrl: `https://www.solotodo.cl/products/${externalId}`, retrievedAt: new Date(Date.now() + 60000), contentHash: '0'.repeat(64), accessStatus: 'reuse-not-confirmed', acquisitionMode: 'manual-sample' } });
  const run = await service.recoverCpu(dto, userId);
  assert.equal(run.status, 'SUCCEEDED'); assert.equal(run.retrievalMs, 2); assert.ok(run.durationMs >= 0);
  let stored = await prisma.externalReference.findUnique({ where: { source_externalId: { source: 'solotodo', externalId } } });
  assert.equal(stored.acquisitionMode, 'manual-api'); assert.equal(stored.name, qaName);
  assert.equal(stored.lastRunId, run.id);
  await assert.rejects(service.recoverCpu(dto, userId), error => error.getStatus?.() === 429);
  assert.equal(calls, 1);

  const manualStamp = new Date(Date.now() + 90000).toISOString();
  const manualHttp = { post: () => of({ data: normalized(manualStamp, qaName + ' intento JSON') }) };
  const manual = new SourcesService(manualHttp, prisma);
  const skipped = await manual.prepareSample({ retrievedAt: manualStamp, records: [{ id: Number(externalId) }] }, userId);
  assert.equal(skipped.staleSkipped, 1);
  assert.equal((await prisma.externalReference.findUnique({ where: { id: stored.id } })).name, qaName);

  async function rewindQaRuns() {
    await prisma.sourceRun.updateMany({ where: { createdById: userId, source: 'solotodo', mode: 'manual-api', status: { not: 'RUNNING' } }, data: { startedAt: new Date(Date.now() - 180000) } });
  }
  await rewindQaRuns();
  const parallel = await Promise.allSettled([service.recoverCpu(dto, userId), service.recoverCpu(dto, userId)]);
  assert.equal(parallel.filter(result => result.status === 'fulfilled').length, 1);
  const denied = parallel.find(result => result.status === 'rejected');
  assert.ok([409, 429].includes(denied.reason.getStatus()));
  assert.equal(calls, 2);
  assert.equal(await prisma.externalReference.count({ where: { source: 'solotodo', externalId } }), 1);

  await rewindQaRuns(); fail = true;
  stored = await prisma.externalReference.findUnique({ where: { id: stored.id } });
  await assert.rejects(service.recoverCpu(dto, userId), error => error.getResponse?.().code === 'SOURCE_ACCESS_DENIED');
  const after = await prisma.externalReference.findUnique({ where: { id: stored.id } });
  assert.equal(after.contentHash, stored.contentHash); assert.equal(after.lastRunId, stored.lastRunId);

  await rewindQaRuns(); fail = false;
  const interrupted = await prisma.sourceRun.create({ data: { source: 'solotodo', mode: 'manual-api', status: 'RUNNING', createdById: userId, retrievedAt: new Date(), startedAt: new Date(Date.now() - 180000) } });
  await service.recoverCpu(dto, userId);
  assert.equal((await prisma.sourceRun.findUnique({ where: { id: interrupted.id } })).errorCode, 'INTERRUPTED');
  await rewindQaRuns(); componentMode = true;
  const gpuRun = await service.recoverComponents({ target: 'rtx-5060', acknowledged: true }, userId);
  assert.equal(gpuRun.storedCount, 1);
  const gpu = await prisma.externalReference.findUnique({ where: { source_externalId: { source: 'solotodo', externalId: gpuId } } });
  assert.equal(gpu.category, 'gpu'); assert.equal(gpu.specs.vramGb, 16); assert.equal(gpu.acquisitionMode, 'manual-api');
  await assert.rejects(service.recoverCpu(dto, userId), error => error.getStatus?.() === 429);
  await rewindQaRuns(); fail = true;
  await assert.rejects(service.recoverComponents({ target: 'rtx-5060', acknowledged: true }, userId), error => error.getResponse?.().code === 'SOURCE_ACCESS_DENIED');
  assert.equal((await prisma.externalReference.findUnique({ where: { id: gpu.id } })).lastRunId, gpuRun.id);
  console.log('Recuperación: clave interna, procedencia, tiempos, cooldown, exclusión concurrente, prioridad API, fallo y auditoría interrumpida: OK');
} finally {
  server.close();
  await prisma.externalReference.deleteMany({ where: { source: 'solotodo', externalId: { in: [externalId, gpuId] }, name: { startsWith: qaName } } });
  if (userId) {
    await prisma.sourceRun.deleteMany({ where: { createdById: userId, source: 'solotodo' } });
    await prisma.user.deleteMany({ where: { id: userId, name: 'QA recovery temporal' } });
  }
  await prisma.$disconnect();
  for (const [key, value] of Object.entries({ SOLOTODO_MANUAL_PROBE_ENABLED: original.enabled, SOURCE_INTERNAL_TOKEN: original.token, PYTHON_SERVICE_URL: original.url })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  console.log('QA retirado; sin llamadas a SoloTodo ni cambios de cotizaciones.');
}

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
const gpuId = externalId + 1;
const hardwareIds = [externalId + 2, externalId + 3, externalId + 4, externalId + 5];
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
  assert.equal(await prisma.externalReference.count({ where: { source: 'solotodo', externalId: String(gpuId) } }), 0, 'No sobrescribir una GPU preexistente');
  assert.equal(await prisma.externalReference.count({ where: { source: 'solotodo', externalId: { in: hardwareIds.map(String) } } }), 0, 'No sobrescribir hardware preexistente');
  const admin = await user('ADMIN');
  const client = await user('CLIENT');
  assert.equal((await request('', null)).status, 401);
  for (const path of ['', '/references', '/runs', '/targets']) assert.equal((await request(path, client)).status, 403);
  assert.equal((await request('/components/samples', client, 'POST', { category: 'gpu', retrievedAt: '2026-01-01T00:00:00Z', records: [{}] })).status, 403);
  assert.equal((await request('/components/recover', client, 'POST', { target: 'rtx-5060', acknowledged: true })).status, 403);
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
  const targets = await (await request('/targets', admin)).json();
  assert.ok(targets.some(target => target.category === 'gpu' && target.brand === 'NVIDIA'));
  assert.ok(targets.some(target => target.category === 'cpu' && target.brand === 'Intel'));
  assert.equal((await request('/components/recover', admin, 'POST', { target: 'https://localhost/', acknowledged: true })).status, 400);
  assert.equal((await request('/references?category=unknown', admin)).status, 400);
  const gpuRecord = { id: gpuId, category_id: 2, name: qaName + ' GPU', brand: { name: 'Ensamblador QA' }, part_number: null,
    specs: { gpu_unicode: 'NVIDIA GPU QA', gpu_brand_unicode: 'NVIDIA', memory_quantity_value: 16384, memory_type_unicode: 'GDDR6', gpu_tdp: 160 } };
  result = await request('/components/samples', admin, 'POST', { category: 'gpu', retrievedAt: newerStamp, records: [gpuRecord] });
  assert.equal(result.status, 201, await result.clone().text());
  assert.equal((await result.json()).storedCount, 1);
  const gpuPage = await (await request(`/references?category=gpu&brand=NVIDIA&q=${encodeURIComponent(qaName)}`, admin)).json();
  assert.equal(gpuPage.total, 1);
  assert.equal(gpuPage.items[0].brand, 'Ensamblador QA'); assert.equal(gpuPage.items[0].category, 'gpu');
  assert.equal(gpuPage.items[0].specs.vramGb, 16); assert.equal(gpuPage.items[0].specs.lengthMm, null);
  assert.equal(gpuPage.items[0].internalCatalogId, null);
  const cpuPage = await (await request(`/references?category=cpu&q=${encodeURIComponent(qaName)}`, admin)).json();
  assert.equal(cpuPage.total, 1);
  assert.equal((await (await request(`/references?category=gpu&brand=AMD&q=${encodeURIComponent(qaName)}`, admin)).json()).total, 0);
  const hardware = [
    ['motherboard', 5, { chipset_northbridge_family_socket_unicode: 'AM5', chipset_unicode: 'AMD B650', format_unicode: 'ATX', memory_slots_mtype_itype_type_name: 'DDR5', memory_slots_quantity: 4, storage_ports: [{ quantity: 2, port_connector_name: 'M.2 2280' }, { quantity: 4, port_connector_name: 'SATA' }] }],
    ['ram', 7, { capacity_total_capacity_value: 32768, capacity_dimm_capacity_value: 16384, capacity_dimm_quantity_value: 2, bus_bus_bus_type_name: 'DDR5', bus_bus_bus_format_name: 'DIMM', bus_frequency_value: 6000 }],
    ['storage', 8, { capacity_value: 2000, type_name: 'HDD', bus_bus_bus_with_version_bus_name: 'SATA', bus_unicode: 'SATA 3', size_unicode: '3.5"', rpm_value: 7200 }],
    ['storage', 39, { capacity_value: 1000, ssd_type_bus_bus_with_version_bus_name: 'PCIe', ssd_type_bus_unicode: 'PCIe 4.0', ssd_type_format_unicode: 'M.2 (2280)' }],
  ];
  for (const [index, [category, category_id, specs]] of hardware.entries()) {
    const row = { id: hardwareIds[index], category_id, name: `${qaName} ${category}`, brand: { name: 'Marca QA' }, specs };
    result = await request('/components/samples', admin, 'POST', { category, retrievedAt: newerStamp, records: [row] });
    assert.equal(result.status, 201, await result.clone().text());
    const run = await result.json(); assert.equal(run.storedCount, 1); assert.equal(run.metrics.missingTdp, 0); assert.equal(run.metrics.category, category);
  }
  const listHardware = async category => (await (await request(`/references?category=${category}&q=${encodeURIComponent(qaName)}`, admin)).json()).items;
  const [motherboard] = await listHardware('motherboard');
  assert.equal(motherboard.specs.ramSlots, 4); assert.equal(motherboard.specs.m2Slots, 2); assert.equal(motherboard.specs.sataPorts, 4);
  const [memory] = await listHardware('ram');
  assert.equal(memory.specs.capacityGb, 32); assert.equal(memory.specs.modules, 2); assert.equal(memory.specs.moduleCapacityGb, 16);
  const drives = await listHardware('storage'); assert.equal(drives.length, 2);
  assert.equal(drives.find(drive => drive.specs.storageType === 'SSD').specs.capacityGb, 1000);
  assert.equal(drives.find(drive => drive.specs.storageType === 'SSD').specs.protocol, null);
  assert.equal(drives.find(drive => drive.specs.storageType === 'HDD').specs.rpm, 7200);
  assert.ok([...drives, motherboard, memory].every(row => row.internalCatalogId === null && row.acquisitionMode === 'manual-sample'));
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
  await prisma.externalReference.deleteMany({ where: { source: 'solotodo', externalId: { in: [externalId, gpuId, ...hardwareIds].map(String) }, name: { startsWith: qaName } } });
  if (qaAdminId) await prisma.sourceRun.deleteMany({ where: { createdById: qaAdminId, source: 'solotodo', mode: 'manual-sample' } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds }, name: 'QA fuente temporal' } });
  await prisma.$disconnect();
  console.log('Solo registros QA de esta ejecución retirados; cotizaciones y fichas reales intactas.');
}

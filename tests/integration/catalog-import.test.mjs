// SOLO QA/CI aislado. Datos sintéticos, PostgreSQL real, sin consultas a SoloTodo.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
assert.equal(process.env.EP2_ISOLATED_CATALOG_QA, 'true', 'Requiere base QA/CI aislada.');
const require = createRequire(join(process.cwd(), 'package.json'));
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const { CatalogImportService } = require('./dist/catalog/catalog-import.service.js');
const { CatalogService } = require('./dist/catalog/catalog.service.js');
const { CatalogPricingService } = require('./dist/catalog/catalog-pricing.service.js');
const { CATALOG_TARGETS, catalogUrl } = require('./dist/catalog/catalog.import.js');
const { of } = require('rxjs');
const p = new PrismaClient(), ids = [];
const original = { enabled: process.env.SOLOTODO_MANUAL_PROBE_ENABLED, token: process.env.SOURCE_INTERNAL_TOKEN };
try {
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  async function account(role) {
    const user = await p.user.create({ data: { name: 'QA catálogo aislado', email: `qa-import-${randomUUID()}@example.invalid`, passwordHash: 'NO_LOGIN_QA_TEMPORAL', role } }); ids.push(user.id);
    return { id: user.id, token: await jwt.signAsync({ sub: user.id, role, email: user.email }, { expiresIn: '5m' }) };
  }
  const admin = await account('ADMIN'), client = await account('CLIENT');
  const base = 'http://127.0.0.1:3000/api/admin/sources/solotodo/catalog';
  const request = (path, token, body) => fetch(base + path, { method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await request('', null)).status, 401);
  assert.equal((await request('', client.token)).status, 403);
  assert.equal((await request('/recover', client.token, { target: 'cpu-intel-11', acknowledged: true })).status, 403);
  assert.equal((await (await request('', admin.token)).json()).caps.cpu, 35);
  assert.equal((await request('/recover', admin.token, { target: 'https://localhost', acknowledged: true })).status, 400);
  assert.equal((await request('/recover', admin.token, { target: 'cpu-intel-11', acknowledged: false })).status, 400);
  assert.equal((await request('/recover', admin.token, { target: 'cpu-intel-11', acknowledged: true })).status, 503);
  process.env.SOLOTODO_MANUAL_PROBE_ENABLED = 'true'; process.env.SOURCE_INTERNAL_TOKEN = randomBytes(32).toString('hex');
  const target = CATALOG_TARGETS.find(t => t.id === 'cpu-intel-11');
  let empty = false;
  const http = { post: (_url, body) => {
    const now = new Date().toISOString();
    return of({ data: { schemaVersion: 'solotodo-catalog-1', target: target.id, requestId: body.request_id, sourceRequestUrl: catalogUrl(target), retrievedAt: now, received: empty ? 0 : 1, issues: [], products: empty ? [] : [{ id: 'solotodo-cpu-115591', externalId: 115591, category: 'cpu', name: 'Intel Core i9-11900 [BX8070811900]', description: 'LGA1200 · 8 núcleos / 16 hilos', image: 'https://media.solotodo.com/media/products/1422914_picture_1626472440.jpg', partNumber: 'BX8070811900', specs: { brand: 'Intel', socket: 'LGA1200', ramTypes: ['DDR4'], cores: 8, threads: 16, integrated: true, stockCooler: true, declaredTdpWatts: 65, power: 300, unverified: [], mountNote: 'Perfil QA, consumo estimado.' }, prices: { schemaVersion: 'solotodo-prices-1', target: 'solotodo-cpu-115591', productId: 115591, sourceRequestUrl: 'https://publicapi.solotodo.com/entities/?products=115591&is_available=1&page_size=5', retrievedAt: now, currency: 'CLP', scope: 'first-page', received: 1, rejected: 0, issues: [], offers: [{ entityId: 123, productId: 115591, storeId: 12, storeHost: 'tienda.example.cl', offerUrl: 'https://tienda.example.cl/qa', normalPriceClp: 100000, offerPriceClp: 99000, sourceUpdatedAt: now, available: true, condition: 'new', currency: 'CLP', conditional: false }] } }] } });
  } };
  const quoteCount = await p.quote.count();
  const importer = new CatalogImportService(p, http); await importer.onModuleInit();
  const result = await importer.recover(target.id, true, admin.id); assert.equal(result.imported, 1);
  const stored = await p.sourceRun.findUnique({ where: { id: result.runId } }); assert.equal(stored.metrics.kind, 'armador-catalog');
  const restarted = new CatalogImportService(p, http); await restarted.onModuleInit();
  const catalog = new CatalogService(undefined, restarted);
  assert.equal(catalog.list().products.find(row => row.id === 'solotodo-cpu-115591').priceInfo.kind, 'observed');
  const draft = { budget: 1000000, intendedUse: 'gaming', cpu: 'solotodo-cpu-115591', drives: [], extras: [] };
  assert.equal(catalog.resolve(draft).components[0].price, 100000);
  const preview = await fetch('http://python-service:8000/builds/preview', { method: 'POST', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catalog.resolve(draft)) });
  assert.equal(preview.status, 200); assert.equal((await preview.json()).level, 'Revisión preliminar');
  await assert.rejects(importer.recover(target.id, true, admin.id), error => error.getStatus() === 429);
  await assert.rejects(new CatalogPricingService(p, http).recover('cpu-7600', true, admin.id), error => error.getStatus() === 429);
  // Envejecer SOLO auditoría sintética propia; nunca ejecutar sobre la base local.
  await p.sourceRun.updateMany({ where: { id: result.runId, createdById: admin.id }, data: { startedAt: new Date(Date.now() - 180000) } });
  empty = true;
  await importer.recover(target.id, true, admin.id);
  const lastRestart = new CatalogImportService(p, http); await lastRestart.onModuleInit();
  const lastCatalog = new CatalogService(undefined, lastRestart);
  assert.equal(lastCatalog.list().products.find(row => row.id === 'solotodo-cpu-115591').priceInfo.kind, 'unavailable');
  assert.throws(() => lastCatalog.resolve(draft));
  assert.equal(await p.quote.count(), quoteCount);
  console.log('OK: catálogo QA, permisos, DTO, PostgreSQL, restauración, ausencia de oferta y espera compartida; sin red externa ni cambios a cotizaciones.');
} finally {
  await p.sourceRun.deleteMany({ where: { createdById: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  if (original.enabled === undefined) delete process.env.SOLOTODO_MANUAL_PROBE_ENABLED; else process.env.SOLOTODO_MANUAL_PROBE_ENABLED = original.enabled;
  if (original.token === undefined) delete process.env.SOURCE_INTERNAL_TOKEN; else process.env.SOURCE_INTERNAL_TOKEN = original.token;
  await p.$disconnect();
}

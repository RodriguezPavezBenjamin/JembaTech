// Solo QA/CI aislado: PostgreSQL real, ofertas sintéticas y ninguna petición a SoloTodo.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
assert.equal(process.env.EP2_ISOLATED_PRICE_QA, 'true', 'Solo ejecutar en un proyecto QA/CI aislado.');
const require = createRequire(join(process.cwd(), 'package.json'));
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const { CatalogPricingService } = require('./dist/catalog/catalog-pricing.service.js');
const { CatalogService } = require('./dist/catalog/catalog.service.js');
const { SourcesService } = require('./dist/sources/sources.service.js');
const { PRICE_TARGETS } = require('./dist/catalog/catalog.pricing.js');
const { of } = require('rxjs');
const p = new PrismaClient(), ids = [];
const original = { enabled: process.env.SOLOTODO_MANUAL_PROBE_ENABLED, token: process.env.SOURCE_INTERNAL_TOKEN };
let admin;
try {
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  async function account(role) {
    const u = await p.user.create({ data: { name: 'QA precios temporal', email: `qa-prices-${randomUUID()}@example.invalid`, passwordHash: 'NO_LOGIN_QA_TEMPORAL', role } }); ids.push(u.id); if (role === 'ADMIN') admin = u.id;
    return jwt.signAsync({ sub: u.id, role, email: u.email }, { expiresIn: '5m' });
  }
  const adminJwt = await account('ADMIN'), clientJwt = await account('CLIENT');
  const base = 'http://127.0.0.1:3000/api/admin/sources/solotodo/prices';
  const request = (suffix, token, method = 'GET', body) => fetch(base + suffix, { method, signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await request('', null)).status, 401);
  assert.equal((await request('', clientJwt)).status, 403);
  assert.equal((await request('/recover', clientJwt, 'POST', { target: 'cpu-7600', acknowledged: true })).status, 403);
  const targets = await (await request('', adminJwt)).json(); assert.equal(targets.length, 8);
  assert.equal((await request('/recover', adminJwt, 'POST', { target: 'https://localhost/', acknowledged: true })).status, 400);
  assert.equal((await request('/recover', adminJwt, 'POST', { target: 'cpu-7600', acknowledged: false })).status, 400);
  assert.equal((await request('/recover', adminJwt, 'POST', { target: 'cpu-7600', acknowledged: true })).status, 503, 'La fuente real debe estar desactivada en QA');
  process.env.SOLOTODO_MANUAL_PROBE_ENABLED = 'true'; process.env.SOURCE_INTERNAL_TOKEN = randomBytes(32).toString('hex');
  const target = PRICE_TARGETS[0]; let empty = false;
  const http = { post: (_url, body) => {
    const now = new Date().toISOString();
    return of({ data: { schemaVersion: 'solotodo-prices-1', target: target.id, productId: target.productId, requestId: body.request_id, retrievedAt: now, sourceRequestUrl: target.url, currency: 'CLP', scope: 'first-page', received: empty ? 0 : 1, rejected: 0, issues: [], offers: empty ? [] : [{ entityId: 123, productId: target.productId, storeId: 12, storeHost: 'tienda.example.cl', offerUrl: 'https://tienda.example.cl/qa', normalPriceClp: 230000, offerPriceClp: 210000, sourceUpdatedAt: now, available: true, condition: 'new', currency: 'CLP', conditional: false }] } });
  } };
  const quoteCount = await p.quote.count();
  const pricing = new CatalogPricingService(p, http); await pricing.onModuleInit();
  const result = await pricing.recover(target.id, true, admin); assert.equal(result.applied, true);
  assert.equal((await p.sourceRun.findUnique({ where: { id: result.runId } })).metrics.kind, 'price-quote');
  assert.equal(new CatalogService(pricing).resolve({ budget: 1000000, intendedUse: 'gaming', cpu: target.id, drives: [], extras: [] }).components[0].price, 230000);
  const restarted = new CatalogPricingService(p, http); await restarted.onModuleInit();
  assert.equal(new CatalogService(restarted).list().products.find(product => product.id === target.id).price, 230000);
  await assert.rejects(pricing.recover(target.id, true, admin), error => error.getStatus() === 429);
  await assert.rejects(new SourcesService(http, p).recoverCpu({ limit: 1, acknowledged: true }, admin), error => error.getStatus() === 429, 'Cooldown compartido también con fichas técnicas');
  // Solo auditoría QA propia; no eludir esperas ni modificar auditorías en el sistema principal.
  await p.sourceRun.updateMany({ where: { createdById: admin, id: result.runId }, data: { startedAt: new Date(Date.now() - 180000) } });
  empty = true;
  const missing = await pricing.recover(target.id, true, admin); assert.equal(missing.applied, false);
  assert.equal(new CatalogService(pricing).list().products.find(product => product.id === target.id).priceInfo.kind, 'estimated');
  const lastRestart = new CatalogPricingService(p, http); await lastRestart.onModuleInit();
  assert.equal(new CatalogService(lastRestart).list().products.find(product => product.id === target.id).priceInfo.kind, 'estimated');
  assert.equal(await p.quote.count(), quoteCount);
  console.log('OK: precios QA, permisos 401/403, contrato, PostgreSQL, reinicio, caducidad/ausencia y cooldown compartido; sin red externa ni cambios de cotizaciones.');
} finally {
  await p.sourceRun.deleteMany({ where: { createdById: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  if (original.enabled === undefined) delete process.env.SOLOTODO_MANUAL_PROBE_ENABLED; else process.env.SOLOTODO_MANUAL_PROBE_ENABLED = original.enabled;
  if (original.token === undefined) delete process.env.SOURCE_INTERNAL_TOKEN; else process.env.SOURCE_INTERNAL_TOKEN = original.token;
  await p.$disconnect();
}

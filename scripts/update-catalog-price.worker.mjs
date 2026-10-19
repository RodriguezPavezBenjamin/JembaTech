import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const require = createRequire(join(process.cwd(), 'package.json'));
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const { PRICE_TARGETS } = require('./dist/catalog/catalog.pricing.js');
const target = PRICE_TARGETS.find(t => t.id === process.env.EP2_PRICE_TARGET);
assert.ok(target);
const p = new PrismaClient();
let userId, result, failed = false;
try {
  const user = await p.user.create({ data: { name: 'QA evaluación acotada de fuente', email: `qa-source-${randomUUID()}@example.invalid`, passwordHash: 'NO_LOGIN_QA_TEMPORAL', role: 'ADMIN' } });
  userId = user.id;
  const token = await new JwtService({ secret: process.env.JWT_SECRET }).signAsync({ sub: user.id, email: user.email, role: 'ADMIN' }, { expiresIn: '2m' });
  const requestId = randomUUID();
  const response = await fetch('http://127.0.0.1:3000/api/admin/sources/solotodo/prices/recover', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Request-Id': requestId }, body: JSON.stringify({ target: target.id, acknowledged: true }) });
  assert.equal(response.status, 201);
  const data = await response.json();
  const run = await p.sourceRun.findUnique({ where: { id: data.runId } });
  assert.equal(run.status, 'SUCCEEDED'); assert.equal(run.metrics.kind, 'price-quote');
  const catalog = await (await fetch('http://127.0.0.1:3000/api/catalog', { signal: AbortSignal.timeout(5000) })).json();
  const product = catalog.products.find(row => row.id === target.id);
  assert.ok(product);
  assert.equal(product.priceInfo.kind, data.applied ? 'observed' : 'estimated');
  if (data.applied) assert.equal(product.price, data.priceInfo.normalPriceClp);
  result = { ...data, requestId, sourceRequestUrl: run.sourceRequestUrl, persistedAndApplied: true, currentCatalogPrice: product.price, historicalQuotesUpdated: false };
} catch { failed = true; }
finally {
  try { if (userId) await p.user.deleteMany({ where: { id: userId } }); } catch { failed = true; }
  try { await p.$disconnect(); } catch { failed = true; }
}
if (failed) { console.error('Validación incompleta; revisar historial y posible cuenta QA pendiente.'); process.exitCode = 1; }
else console.log(JSON.stringify(result));

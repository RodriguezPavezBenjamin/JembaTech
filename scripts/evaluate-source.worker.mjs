// Solo mediante evaluate-source.mjs --live. Una adquisición API; sin reintentos.
// Conserva referencias/corrida públicas y retira exclusivamente su cuenta QA.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const require = createRequire(join(process.cwd(), 'package.json'));
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const limit = Number(process.env.EP2_EVAL_LIMIT);
assert.ok(Number.isInteger(limit) && limit >= 1 && limit <= 5);
const target = process.env.EP2_EVAL_TARGET || null;
const { sourceTarget } = require('./dist/sources/source.targets.js');
const selection = target ? sourceTarget(target) : null;
assert.ok(!target || selection);
const prisma = new PrismaClient();
let userId;
let result;
let failed = false;
try {
  const user = await prisma.user.create({ data: {
    name: 'QA evaluación acotada de fuente', email: `qa-source-${randomUUID()}@example.invalid`,
    passwordHash: 'NO_LOGIN_QA_TEMPORAL', role: 'ADMIN',
  } });
  userId = user.id;
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const token = await jwt.signAsync({ sub: user.id, email: user.email, role: user.role }, { expiresIn: '2m' });
  const base = 'http://127.0.0.1:3000/api/admin/sources/solotodo';
  const requestId = randomUUID();
  const response = await fetch(`${base}/${target ? 'components' : 'cpu'}/recover`, {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    body: JSON.stringify(target ? { target, acknowledged: true } : { limit, acknowledged: true }),
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('x-request-id'), requestId);
  const run = await response.json();
  assert.equal(run.status, 'SUCCEEDED');
  assert.equal(run.mode, 'manual-api');
  const rows = await prisma.externalReference.findMany({ where: { lastRunId: run.id }, orderBy: { externalId: 'asc' } });
  assert.equal(rows.length, run.storedCount);
  const listing = await fetch(`${base}/references?page=1&pageSize=50${selection ? `&category=${selection.category}` : ''}`, {
    signal: AbortSignal.timeout(5000), headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(listing.status, 200);
  const page = await listing.json();
  assert.ok(rows.every(row => page.items.some(item => item.id === row.id && item.contentHash === row.contentHash)));
  const m = run.metrics;
  assert.equal(m.received, m.accepted + m.rejected + m.duplicates);
  const references = rows.map(row => ({
    externalId: row.externalId, category: row.category, name: row.name, brand: row.brand, partNumber: row.partNumber,
    specs: row.specs, sourceUrl: row.sourceUrl, contentHash: row.contentHash,
    retrievedAt: row.retrievedAt.toISOString(), sourceUpdatedAt: row.sourceUpdatedAt?.toISOString() ?? null,
    sourceAgeDays: row.sourceUpdatedAt ? Math.floor((row.retrievedAt.getTime() - row.sourceUpdatedAt.getTime()) / 86400000) : null,
    acquisitionMode: row.acquisitionMode, accessStatus: row.accessStatus,
  }));
  const dated = references.filter(row => row.sourceAgeDays !== null);
  result = {
    status: 'ok', kind: 'bounded-live-source-evaluation', requestId, runId: run.id,
    source: 'solotodo', sourceRequestUrl: run.sourceRequestUrl, retrievedAt: run.retrievedAt,
    limit, target, metrics: m, storedCount: run.storedCount, staleSkipped: run.staleSkipped,
    retrievalMs: run.retrievalMs, durationMs: run.durationMs,
    observedBrands: [...new Set(references.map(row => row.brand))].sort(),
    sourceAgeDays: { known: dated.length, unknown: references.length - dated.length,
      min: dated.length ? Math.min(...dated.map(row => row.sourceAgeDays)) : null,
      max: dated.length ? Math.max(...dated.map(row => row.sourceAgeDays)) : null },
    persistedAndListed: true, quotesModified: false, representative: false,
    sampleMethod: target ? 'Selección dirigida por modelo; primera página de candidatos y variantes, no coincidencias SKU aprobadas ni cobertura garantizada.' : 'Primera página CPU, muestra de conveniencia; no aleatoria, sin cobertura garantizada.',
    references,
  };
} catch { failed = true; }
finally {
  try {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  } catch { failed = true; }
  try { await prisma.$disconnect(); } catch { failed = true; }
}
if (failed) {
  console.error('Evaluación incompleta; no se imprime información privada. Revisar panel/auditoría y posible cuenta QA pendiente.');
  process.exitCode = 1;
} else console.log(JSON.stringify(result));

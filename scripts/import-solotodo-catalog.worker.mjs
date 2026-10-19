import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const require = createRequire(join(process.cwd(), 'package.json'));
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const { CATALOG_TARGETS } = require('./dist/catalog/catalog.import.js');
const requested = process.env.EP2_CATALOG_TARGET;
assert.ok(requested === 'all' || CATALOG_TARGETS.some(t => t.id === requested));
const prisma = new PrismaClient();
const apiBase = process.env.EP2_CATALOG_API_BASE === 'http://backend:3000' ? 'http://backend:3000' : 'http://127.0.0.1:3000';
let userId;
let failed = false;
const emit = value => console.log(JSON.stringify(value));
try {
  const user = await prisma.user.create({ data: { name: 'QA importación local acotada', email: `qa-catalog-${randomUUID()}@example.invalid`, passwordHash: 'NO_LOGIN_QA_TEMPORAL', role: 'ADMIN' } });
  userId = user.id;
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  async function request(path, body) {
    const token = await jwt.signAsync({ sub: user.id, email: user.email, role: 'ADMIN' }, { expiresIn: '2m' });
    const response = await fetch(`${apiBase}/api/admin/sources/solotodo${path}`, { method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(85000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) { emit({ status: 'stopped', code: result.code ?? 'IMPORT_FAILED', target: body?.target }); throw Error('Import stopped without retry'); }
    return result;
  }
  const snapshot = await request('/catalog');
  let targets = requested === 'all' ? CATALOG_TARGETS.filter(t => {
    const saved = snapshot.targets.find(v => v.id === t.id);
    return !saved?.lastImport || Date.parse(saved.lastImport.at) < Date.now() - 86400000 || (saved.lastImport.count === 0 && (saved.lastImport.sourceRequestUrl !== saved.sourceRequestUrl || (t.category !== 'cpu' && saved.lastImport.schemaVersion !== saved.schemaVersion)));
  }) : CATALOG_TARGETS.filter(t => t.id === requested);
  const categories = ['cpu', 'gpu', 'ram', 'board', 'case'];
  // Alternar categorías, no llenar primero todas las variantes de una sola.
  targets = categories.flatMap(category => targets.filter(t => t.category === category)).map((target, index, arr) => ({ target, rank: categories.indexOf(target.category) + 5 * arr.filter((t, i) => i < index && t.category === target.category).length })).sort((a, b) => a.rank - b.rank).map(t => t.target);
  emit({ status: 'started', remainingTargets: targets.length, finite: true });
  for (const target of targets) {
    const overview = await request('');
    if (!overview.manualProbeEnabled || overview.probeRunning) throw Error('Source disabled or busy');
    const delay = Math.max(0, Date.parse(overview.nextAllowedAt ?? '') + 250 - Date.now()) || 0;
    if (delay) { emit({ status: 'cooldown', seconds: Math.ceil(delay / 1000), next: target.id }); await new Promise(resolve => setTimeout(resolve, delay)); }
    emit({ status: 'importing', target: target.id });
    const result = await request('/catalog/recover', { target: target.id, acknowledged: true });
    emit({ status: 'imported', ...result });
  }
  emit({ status: 'complete', counts: (await request('/catalog')).counts });
} catch { failed = true; emit({ status: 'incomplete', message: 'Sin reintentos. Revisar historial antes de continuar.' }); }
finally {
  try { if (userId) await prisma.user.deleteMany({ where: { id: userId } }); } catch { failed = true; }
  await prisma.$disconnect();
}
if (failed) process.exitCode = 1;

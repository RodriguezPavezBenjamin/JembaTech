// Ejecutar dentro del backend local; usa su DATABASE_URL y JWT_SECRET.
// Crea únicamente cuentas QA temporales y las limpia al finalizar.
// PowerShell: Get-Content -Raw tests/integration/edit-builds.test.mjs | docker compose exec -T backend node --input-type=module
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const require = createRequire(join(process.cwd(), 'package.json'));
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const prisma = new PrismaClient();
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
const ids = [];
const base = 'http://127.0.0.1:3000/api';
const suffix = randomUUID();

async function request(path, token, method = 'GET', body) {
  return fetch(base + path, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function temporaryUser() {
  const user = await prisma.user.create({ data: { name: 'QA editor temporal', email: `qa-editor-${ids.length}-${suffix}@example.invalid`, passwordHash: 'NO_LOGIN_QA_TEMPORAL', role: 'CLIENT' } });
  ids.push(user.id);
  return jwt.signAsync({ sub: user.id, email: user.email, role: 'CLIENT' }, { expiresIn: '5m' });
}
const draft = {
  name: 'QA editor original', budget: 1000000, intendedUse: 'gaming',
  cpu: 'cpu-7600', gpu: 'gpu-integrated', board: 'board-msi-b650-s',
  memory: [{ id: 'ram-kingston-ddr5-16', quantity: 1 }],
  drives: [{ id: 'drive-samsung-990-pro-1000', quantity: 1 }],
  cooler: 'cooler-stock', extras: [], case: 'case-corsair-4000d', psu: 'psu-650-Modular-completa-ATX',
};

try {
  const owner = await temporaryUser();
  const other = await temporaryUser();
  const saved = await request('/builds', owner, 'POST', draft);
  assert.equal(saved.status, 201);
  const id = (await saved.json()).quoteId;
  const before = (await (await request('/quotes', owner)).json()).find(q => q.id === id);
  assert.ok(before);
  const changes = { ...draft, name: 'QA editor actualizado', memory: [{ id: 'ram-kingston-ddr5-16', quantity: 2 }], drives: [{ id: 'drive-samsung-990-pro-1000', quantity: 2 }], expectedUpdatedAt: before.updatedAt };
  const updated = await request(`/builds/${id}`, owner, 'PATCH', changes);
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).quoteId, id);
  const ownList = await (await request('/quotes', owner)).json();
  assert.equal(ownList.length, 1);
  const quote = ownList[0];
  assert.equal(quote.name, changes.name);
  assert.equal(quote.ramGb, 32);
  assert.equal(quote.storageGb, 2000);
  assert.equal(quote.configuration.components.find(p => p.category === 'ram').quantity, 2);
  assert.notEqual(quote.totalPrice, before.totalPrice);

  const current = { ...changes, expectedUpdatedAt: quote.updatedAt };
  assert.equal((await request(`/builds/${id}`, other, 'PATCH', current)).status, 404);
  assert.equal((await request(`/builds/${id}`, owner, 'PATCH', { ...current, expectedUpdatedAt: '2020-01-01T00:00:00Z' })).status, 409);
  assert.equal((await request(`/builds/${id}`, owner, 'PATCH', { ...current, board: 'board-AM4-DDR4-ATX' })).status, 400);
  const unchanged = (await (await request('/quotes', owner)).json())[0];
  assert.deepEqual(unchanged.configuration, quote.configuration);

  assert.equal((await request(`/quotes/${id}/request`, owner, 'PATCH', { customerNote: 'Consulta QA temporal' })).status, 200);
  const consulted = (await (await request('/quotes', owner)).json())[0];
  assert.equal((await request(`/builds/${id}`, owner, 'PATCH', { ...current, expectedUpdatedAt: consulted.updatedAt })).status, 409);
  assert.equal((await request('/builds', owner, 'POST', { ...draft, name: 'QA editor copia' })).status, 201);
  const withCopy = await (await request('/quotes', owner)).json();
  assert.equal(withCopy.length, 2);
  assert.equal(withCopy.find(q => q.id === id).status, 'REQUESTED');
  assert.deepEqual(withCopy.find(q => q.id === id).configuration, quote.configuration);
  console.log('Edición HTTP autenticada: cantidades, persistencia, propiedad, concurrencia, incompatibilidades y copia: OK');
} finally {
  // Solo IDs devueltos por nuestras inserciones en esta ejecución.
  if (ids.length) {
    await prisma.quote.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids }, name: 'QA editor temporal', email: { startsWith: 'qa-editor-' } } });
  }
  await prisma.$disconnect();
  console.log('Registros temporales QA retirados; cotizaciones reales no modificadas.');
}

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PROJECT } from '../../scripts/deploy-staging.mjs';
import { ADOPTION_ENVIRONMENT, ADOPTION_SERVICES, checkAdoptionScope, validateAdoptionInventory } from '../../scripts/check-railway-adoption-scope.mjs';

function projectFixture() {
  return { id: PROJECT, name: 'JembaTech Staging', workspace: { id: randomUUID() },
    environments: { edges: [{ node: { id: ADOPTION_ENVIRONMENT, name: 'staging', createdAt: '2026-10-01T00:00:00Z' } }] },
    services: { edges: Object.entries(ADOPTION_SERVICES).map(([name, id]) => ({ node: { id, name } })) } };
}

test('Adopción: una sola consulta al destino fijo con Bearer, sin mutaciones ni token en el resumen', async () => {
  const token = randomBytes(24).toString('hex');
  let calls = 0;
  const result = await checkAdoptionScope(token, async (url, options) => {
    calls++;
    assert.equal(url, 'https://backboard.railway.com/graphql/v2');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.headers['Project-Access-Token'], undefined);
    assert.equal(options.redirect, 'error');
    const request = JSON.parse(options.body);
    assert.deepEqual(request.variables, { id: PROJECT });
    assert.match(request.query, /^query /);
    assert.doesNotMatch(request.query, /mutation|variableCollection|DATABASE_URL/);
    return new Response(JSON.stringify({ data: { project: projectFixture() } }));
  });
  assert.equal(calls, 1);
  assert.equal(result.services, 4);
  assert.equal(result.providerDefault, 'staging');
  assert.ok(!JSON.stringify(result).includes(token));
});

test('Adopción: rechaza proyecto equivocado, sin workspace, servicios ausentes, cambiados o ambiguos', () => {
  for (const alter of [p => { p.id = randomUUID(); }, p => { p.name = 'another'; },
    p => { p.workspace = null; }, p => { p.services.edges.pop(); },
    p => { p.services.edges[0].node.id = randomUUID(); },
    p => { p.services.edges.push({ node: { name: 'backend', id: randomUUID() } }); },
    p => { p.services.edges.push(p.services.edges[0]); }]) {
    const project = projectFixture(); alter(project);
    assert.throws(() => validateAdoptionInventory(project));
  }
});

test('Adopción: ordena por antigüedad como el proveedor; nunca adopta otro entorno por defecto', () => {
  const project = projectFixture();
  project.environments.edges.unshift({ node: { id: randomUUID(), name: 'production', createdAt: '2026-10-02T00:00:00Z' } });
  assert.equal(validateAdoptionInventory(project).providerDefault, 'staging');
  project.environments.edges[0].node.createdAt = '2026-09-30T00:00:00Z';
  assert.throws(() => validateAdoptionInventory(project), /STAGING_IS_NOT_PROVIDER_DEFAULT/);
});

test('Adopción: bloquea fechas inválidas, empate, IDs duplicados y staging ambiguo', () => {
  for (const extra of [
    { id: randomUUID(), name: 'later', createdAt: 'invalid' },
    { id: randomUUID(), name: 'other', createdAt: '2026-10-01T00:00:00Z' },
    { id: ADOPTION_ENVIRONMENT, name: 'other', createdAt: '2026-10-02T00:00:00Z' },
    { id: randomUUID(), name: 'staging', createdAt: '2026-10-02T00:00:00Z' },
  ]) {
    const project = projectFixture(); project.environments.edges.push({ node: extra });
    assert.throws(() => validateAdoptionInventory(project));
  }
});

test('Adopción: token ausente o inválido no autoriza ni una consulta', async () => {
  for (const token of [undefined, '', 'with whitespace', 'x'.repeat(4097)]) {
    await assert.rejects(() => checkAdoptionScope(token, () => { throw new Error('unexpected network'); }), /MISSING_OR_INVALID/);
  }
});

test('Adopción: HTTP y errores GraphQL no filtran detalles ni se reintentan', async () => {
  const privateDetail = randomBytes(24).toString('hex');
  for (const response of [new Response(privateDetail, { status: 401 }),
    new Response(privateDetail, { status: 429 }), new Response(privateDetail),
    new Response(JSON.stringify({ errors: { message: privateDetail }, data: { project: projectFixture() } })),
    new Response(JSON.stringify({ errors: [{ message: privateDetail }], data: { project: projectFixture() } }))]) {
    let calls = 0;
    await assert.rejects(() => checkAdoptionScope('qa-token', async () => { calls++; return response; }), error => !error.message.includes(privateDetail));
    assert.equal(calls, 1);
  }
});

test('Adopción: errores de conexión se sustituyen por un código seguro', async () => {
  await assert.rejects(() => checkAdoptionScope('qa-token', async () => { throw new Error('private-raw-error'); }), /RAILWAY_CONNECTION_FAILED/);
});

test('Adopción: el comprobador no persiste respuestas ni ejecuta Terraform', () => {
  const source = readFileSync(new URL('../../scripts/check-railway-adoption-scope.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /writeFile|appendFile|child_process|execFile|spawn/);
  assert.match(source, /NO_ARGUMENTS_ALLOWED/);
});

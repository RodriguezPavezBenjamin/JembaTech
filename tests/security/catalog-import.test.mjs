import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { catalogArgs } from '../../scripts/import-solotodo-catalog.mjs';
test('manifiestos de Python y Nest idénticos; cuotas 35/30/20/20/15', () => {
  const load = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const backend = load('../../backend/src/catalog/catalog-scope.json');
  assert.deepEqual(backend, load('../../python-service/catalog_scope.json'));
  for (const [category, cap] of Object.entries({ cpu: 35, gpu: 30, ram: 20, board: 20, case: 15 })) assert.equal(backend.filter(t => t.category === category).reduce((n, t) => n + t.take, 0), cap);
  assert.equal(new Set(backend.map(t => t.id)).size, backend.length);
});
test('CLI sin red al importar y requiere autorización literal y destino cerrado', () => {
  assert.equal(catalogArgs(['--live', '--all']), 'all');
  assert.equal(catalogArgs(['--live', '--target', 'cpu-intel-11']), 'cpu-intel-11');
  for (const args of [[], ['--all'], ['--live', '--target', 'http://127.0.0.1'], ['--live', '--target', 'cpu-intel-11', '--retry']]) assert.throws(() => catalogArgs(args));
});

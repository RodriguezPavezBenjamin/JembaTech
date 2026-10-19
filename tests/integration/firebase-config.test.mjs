import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const lock = JSON.parse(readFileSync(new URL('../../frontend/package-lock.json', import.meta.url), 'utf8'));

test('Firebase: SDK y peers comparten una versión compatible con Node 22', () => {
  assert.equal(lock.packages['node_modules/firebase'].version, '12.19.0');
  const apps = Object.entries(lock.packages).filter(([path]) => /node_modules\/@firebase\/app$/.test(path));
  assert.ok(apps.length > 0);
  for (const [path, entry] of apps) assert.equal(entry.version, '0.16.2', path);
  for (const [path, entry] of Object.entries(lock.packages).filter(([path]) => path.includes('node_modules/@firebase/'))) {
    const minimum = /^>=(\d+)\./.exec(entry.engines?.node ?? '');
    if (minimum) assert.ok(Number(minimum[1]) <= 22, `${path} no debe exigir un Node posterior al de CI`);
  }
});

test('Firebase: gRPC conserva la versión corregida, sin bajar el gate de auditoría', () => {
  const grpc = Object.entries(lock.packages).filter(([path]) => /node_modules\/@grpc\/grpc-js$/.test(path));
  assert.ok(grpc.length > 0);
  for (const [, entry] of grpc) assert.equal(entry.version, '1.14.6');
});

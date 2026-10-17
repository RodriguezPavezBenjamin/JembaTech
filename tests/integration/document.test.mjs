// Sin red ni sesión: verifica resolución de assets en entradas directas a rutas.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../../frontend/src/index.html', import.meta.url), 'utf8');
const built = readFileSync(new URL('../../frontend/dist/jemba-cotiza/browser/index.html', import.meta.url), 'utf8');

for (const [name, html] of [['fuente', source], ['build', built]]) {
  test(`${name}: base única en raíz antes de recursos relativos`, () => {
    const bases = [...html.matchAll(/<base\s+href="([^"]+)"\s*\/?\s*>/g)];
    assert.equal(bases.length, 1);
    assert.equal(bases[0][1], '/');
    const relativeResources = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"[^>]*>/g)]
      .filter(match => !/^(?:https?:|\/|data:)/.test(match[1]));
    for (const resource of relativeResources) assert.ok(bases[0].index < resource.index);
    assert.match(html, /<title>JembaTech<\/title>/);
    assert.match(html, /<link rel="icon" type="image\/svg\+xml" sizes="any" href="\/media\/brand\/jemba-tech-favicon\.svg">/);
  });
}

test('favicon: amplía el logo con un viewport sin modificar la imagen original', () => {
  const favicon = readFileSync(new URL('../../frontend/public/media/brand/jemba-tech-favicon.svg', import.meta.url), 'utf8');
  const original = readFileSync(new URL('../../frontend/public/media/brand/jemba-tech-logo-circular.png', import.meta.url));
  assert.match(favicon, /viewBox="100 55 880 880"/);
  const embedded = favicon.match(/href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  assert.ok(embedded);
  assert.deepEqual(Buffer.from(embedded[1], 'base64'), original);
  assert.equal(readFileSync(new URL('../../frontend/dist/jemba-cotiza/browser/media/brand/jemba-tech-favicon.svg', import.meta.url), 'utf8'), favicon);
});

const assets = [...built.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"[^>]*>/g)]
  .map(match => match[1]).filter(url => !/^https?:/.test(url));
const builtBase = built.match(/<base\s+href="([^"]+)"/)[1];
for (const path of ['/admin/fuentes', '/admin/cotizaciones-clientes', '/perfil', '/login']) {
  test(`entrada directa ${path}: arranque e imágenes se resuelven igual que en inicio`, () => {
    const base = new URL(builtBase, `http://localhost:4200${path}`);
    assert.ok(assets.some(asset => asset === 'main.js'));
    for (const asset of [...assets, './media/brand/jemba-tech-logo-circular.png']) {
      const resolved = new URL(asset, base);
      assert.equal(resolved.href, new URL(asset, 'http://localhost:4200/').href);
      assert.ok(!resolved.pathname.startsWith('/admin/'));
    }
  });
}

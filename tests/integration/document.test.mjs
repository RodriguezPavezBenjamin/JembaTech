// Sin red ni sesión: verifica resolución de assets en entradas directas a rutas.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { JSDOM } = createRequire(new URL('../../frontend/package.json', import.meta.url))('jsdom');

const source = readFileSync(new URL('../../frontend/src/index.html', import.meta.url), 'utf8');
const built = readFileSync(new URL('../../frontend/dist/jemba-cotiza/browser/index.html', import.meta.url), 'utf8');

const instagramPostIds = ['CgCuAqsu5Ph', 'CVocA74lHD8', 'CTTRZEbL9n9', 'CnQzTZQONxr', 'CudDs9GJqBR', 'CvssFaaJRx7', 'C5CK9F_JbCD', 'DepvUVoGPre'];

function instagramCarousel(html, reducedMotion = false, observed = true) {
  const dom = new JSDOM(html, { url: 'http://localhost:4200/', runScripts: 'outside-only' });
  const { window } = dom, doc = window.document;
  const track = doc.getElementById('instagramPosts'), root = doc.getElementById('instagramCarousel');
  let now = 0, sequence = 0, hidden = false, intersection, motionChange;
  const timers = new Map();
  const motion = { matches: reducedMotion, addEventListener: (_, callback) => { motionChange = callback; } };
  window.matchMedia = () => motion;
  Object.defineProperty(doc, 'hidden', { get: () => hidden });
  window.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; };
  window.clearTimeout = id => timers.delete(id);
  if (observed) window.IntersectionObserver = class {
    constructor(callback) { intersection = callback; }
    observe() {}
  };
  const script = html.match(/\/\/ ─── INSTAGRAM CAROUSEL ───([\s\S]*?)\/\/ ─── WHATSAPP FORM ───/);
  assert.ok(script);
  window.eval(script[1]);
  function inView(value) { intersection?.([{ isIntersecting: value }]); }
  inView(true);
  return {
    dom, track, root,
    // Índice derivado de la tarjeta activa, no de un contador visible.
    get counter() { return `${[...track.children].findIndex(card => card.getAttribute('aria-current') === 'true') + 1} / 8`; },
    get scheduled() { return timers.size; },
    inView,
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at; timers.delete(next[0]); next[1].callback();
      }
      now = end;
    },
    hidden(value) { hidden = value; doc.dispatchEvent(new window.Event('visibilitychange')); },
    reduce(value) { motion.matches = value; motionChange(); },
    touch(type, x, y) {
      const event = new window.Event(type);
      Object.defineProperty(event, type === 'touchstart' ? 'touches' : 'changedTouches', { value: [{ clientX: x, clientY: y }] });
      track.dispatchEvent(event);
    },
  };
}

for (const [name, html] of [['fuente', source], ['build', built]]) {
  test(`${name}: ocho publicaciones originales, todas con foto local, fecha y enlaces seguros`, () => {
    const dom = new JSDOM(html, { url: 'http://localhost:4200/' });
    try {
      const doc = dom.window.document;
      const cards = [...doc.querySelectorAll('[data-instagram-post]')];
      assert.deepEqual(cards.map(card => card.dataset.instagramPost), instagramPostIds);
      assert.equal(doc.querySelectorAll('iframe').length, 0);
      assert.equal(doc.querySelector('script[src*="instagram"]'), null);
      assert.equal(doc.getElementById('portfolioArchive'), null);
      assert.equal(doc.querySelector('.carousel-wrapper, .work-modal, .carousel-thumbs'), null);
      assert.doesNotMatch(html, /carouselTrack|workModal|carThumbs|const trabajos/);
      for (const card of cards) {
        assert.match(card.querySelector('time').dateTime, /^20\d{2}-\d{2}-\d{2}$/);
        for (const link of card.querySelectorAll('a')) {
          assert.equal(link.href, `https://www.instagram.com/jemba_tech/p/${card.dataset.instagramPost}/`);
          assert.equal(link.target, '_blank');
          assert.equal(link.rel, 'noopener noreferrer');
        }
        assert.equal(card.querySelector('button'), null, 'Cada trabajo tiene acceso directo al original, sin vista incrustada no verificada.');
        const photo = card.querySelector('.instagram-cover > img');
        assert.ok(photo, `Falta foto de ${card.dataset.instagramPost}`);
        const bytes = readFileSync(new URL(`../../frontend/public${decodeURIComponent(new URL(photo.src).pathname)}`, import.meta.url));
        assert.ok(bytes.length > 1000);
        const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
        const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        assert.ok(jpeg || webp || png, 'El respaldo debe tener firma raster válida, no HTML de Instagram; no asumir formato por la extensión.');
        assert.ok(photo.alt.length > 10);
        assert.equal(card.querySelector('.instagram-brand'), null, 'Las tarjetas no llevan el logo superpuesto.');
        assert.equal(card.querySelectorAll('img').length, 1, 'Solo se conserva la foto del trabajo.');
        assert.equal(card.querySelector('.instagram-cover-label')?.textContent, 'VER EN INSTAGRAM ↗');
      }
      assert.match(html, /\.instagram-cover-label\s*\{[^}]*top:\s*0\.75rem;\s*left:\s*0\.75rem/);
      assert.doesNotMatch(html, /instagram-brand/);
    } finally { dom.window.close(); }
  });

  test(`${name}: acceso al original sin JavaScript, sin widgets o recursos de Instagram en la portada`, () => {
    const dom = new JSDOM(html, { url: 'http://localhost:4200/' });
    try {
      const doc = dom.window.document;
      assert.equal(doc.querySelectorAll('.instagram-card .instagram-original').length, 8);
      assert.equal(doc.getElementById('instagramDialog'), null);
      assert.equal(doc.querySelectorAll('iframe, .instagram-preview').length, 0);
      assert.equal(doc.querySelector('.instagram-privacy'), null);
      for (const resource of doc.querySelectorAll('[src], link[href]')) {
        const url = new URL(resource.getAttribute('src') ?? resource.getAttribute('href'), 'http://localhost:4200/');
        assert.ok(!/(?:instagram|cdninstagram|fbcdn)\./.test(url.hostname), 'No cargar recursos de Meta antes de visitar el original.');
      }
      assert.doesNotMatch(html, /embed\.js|embed\/captioned|instagramDialog/);
    } finally { dom.window.close(); }
  });

  test(`${name}: efecto 3D circular, flechas y teclado sin interceptar enlaces`, () => {
    const c = instagramCarousel(html);
    try {
      const doc = c.dom.window.document, cards = [...doc.querySelectorAll('.instagram-card')];
      assert.equal(doc.getElementById('instagramToolbar').hidden, false);
      assert.equal(c.track.classList.contains('is-ready'), true);
      assert.equal(c.counter, '1 / 8');
      assert.equal(cards[0].style.getPropertyValue('--offset'), '0');
      assert.equal(cards.at(-1).style.getPropertyValue('--offset'), '-1');
      assert.equal(cards.filter(card => !card.hasAttribute('inert')).length, 1);
      assert.equal(cards.filter(card => card.getAttribute('aria-hidden') === 'false').length, 1);
      doc.getElementById('instagramPrev').click();
      assert.equal(c.counter, '8 / 8');
      doc.getElementById('instagramNext').click();
      assert.equal(c.counter, '1 / 8');
      c.track.dispatchEvent(new c.dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      assert.equal(c.counter, '8 / 8');
      c.track.dispatchEvent(new c.dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      assert.equal(c.counter, '1 / 8');
      const nested = new c.dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
      cards[0].querySelector('a').dispatchEvent(nested);
      assert.equal(nested.defaultPrevented, false);
      assert.equal(c.counter, '1 / 8');
      assert.equal(c.scheduled, 1, 'Navegar reinicia el temporizador; no deja autoplay bloqueado sin botón de reanudar.');
      assert.match(html, /perspective:\s*1100px/);
      assert.match(html, /rotateY\(calc\(var\(--offset\)/);
    } finally { c.dom.window.close(); }
  });

  test(`${name}: título de JembaTech fuera del panel, cifras y ventajas independientes`, () => {
    const dom = new JSDOM(html);
    try {
      const why = dom.window.document.querySelector('#why > .container');
      assert.equal(why.querySelector(':scope > h2').textContent, '¿POR QUÉ JEMBATECH?');
      assert.equal(why.querySelector('.why-panel h2'), null);
      assert.equal(why.querySelectorAll(':scope > .why-panel .why-item').length, 4);
      assert.equal(why.querySelector('.why-panel .service-card'), null);
      assert.equal(why.querySelectorAll(':scope > .why-benefits > .service-card').length, 3);
      assert.deepEqual([...why.querySelectorAll('.why-num')].map(item => item.textContent), ['905+', '20+', '100%', '2']);
      assert.match(html, /\.why-panel\s*\{[^}]*background:\s*var\(--bg2\)[^}]*border:\s*1px solid var\(--border\)/);
      assert.match(html, /\.why-benefits \.service-card\s*\{\s*background:\s*var\(--bg2\)/);
      assert.match(html, /\.why-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
    } finally { dom.window.close(); }
  });

  test(`${name}: presentación sin marco ni textos extra, título centrado, Instagram circular y flechas laterales`, () => {
    const dom = new JSDOM(html);
    try {
      const doc = dom.window.document, gallery = doc.querySelector('#gallery');
      assert.equal(gallery.querySelector('h2').textContent, 'TRABAJOS DE JEMBATECH');
      assert.ok(gallery.querySelector('.instagram-heading > .divider'));
      assert.equal(gallery.querySelector('.instagram-heading p, .instagram-privacy, .instagram-play, .instagram-counter'), null);
      assert.equal(doc.getElementById('instagramPlay'), null);
      assert.equal(doc.getElementById('instagramCounter'), null);
      const profile = gallery.querySelector('.instagram-profile');
      assert.equal(profile.textContent.trim(), '');
      assert.equal(profile.getAttribute('aria-label'), 'Visitar Instagram de JembaTech');
      assert.equal(profile.href, 'https://www.instagram.com/jemba_tech/');
      assert.equal(profile.rel, 'noopener noreferrer');
      assert.ok(profile.querySelector('svg'));
      assert.equal(gallery.querySelectorAll('.instagram-toolbar > button').length, 2);
      assert.match(html, /\.instagram-heading\s*\{\s*text-align:\s*center/);
      const presentation = html.match(/\.instagram-carousel\s*\{([^}]+)\}/)[1];
      assert.match(presentation, /min\(520px, 76%\)/);
      assert.doesNotMatch(presentation, /border:|background:|box-shadow:/);
      assert.match(html, /\.instagram-nav\s*\{[^}]*top:\s*50%[^}]*translateY\(-50%\)/);
      assert.match(html, /#instagramPrev\s*\{\s*left:\s*calc\(50% - var\(--work-card-width\) \/ 2/);
      assert.match(html, /#instagramNext\s*\{\s*right:\s*calc\(50% - var\(--work-card-width\) \/ 2/);
    } finally { dom.window.close(); }
  });

  test(`${name}: autoplay cada cinco segundos, vuelta completa y pausa con Espacio sin botón visible`, () => {
    const c = instagramCarousel(html);
    try {
      assert.equal(c.scheduled, 1);
      c.advance(4999); assert.equal(c.counter, '1 / 8');
      c.advance(1); assert.equal(c.counter, '2 / 8');
      c.advance(35000); assert.equal(c.counter, '1 / 8');
      const pause = new c.dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      c.track.dispatchEvent(pause);
      assert.equal(pause.defaultPrevented, true);
      assert.equal(c.scheduled, 0);
      c.advance(20000); assert.equal(c.counter, '1 / 8');
      c.track.dispatchEvent(new c.dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      c.advance(5000);
      assert.equal(c.counter, '2 / 8');
    } finally { c.dom.window.close(); }
  });

  test(`${name}: pausa por cursor, foco, pestaña oculta y fuera de vista sin acumular timers`, () => {
    const c = instagramCarousel(html);
    try {
      const { window } = c.dom, doc = window.document;
      c.root.dispatchEvent(new window.Event('pointerenter'));
      assert.equal(c.scheduled, 0);
      c.advance(10000); assert.equal(c.counter, '1 / 8');
      c.root.dispatchEvent(new window.Event('pointerleave'));
      assert.equal(c.scheduled, 1);
      doc.querySelector('.instagram-original').focus();
      assert.equal(c.scheduled, 0);
      c.advance(10000); assert.equal(c.counter, '1 / 8');
      doc.querySelector('.instagram-original').blur();
      assert.equal(c.scheduled, 1);
      c.hidden(true); assert.equal(c.scheduled, 0);
      c.hidden(false); assert.equal(c.scheduled, 1);
      c.inView(false); assert.equal(c.scheduled, 0);
      c.inView(true); c.inView(true); assert.equal(c.scheduled, 1);
      c.advance(5000); assert.equal(c.counter, '2 / 8');
      // Las flechas no dejan el avance pausado permanentemente al abandonar el control.
      doc.getElementById('instagramNext').focus();
      doc.getElementById('instagramNext').click();
      assert.equal(c.scheduled, 0);
      doc.getElementById('instagramNext').blur();
      assert.equal(c.scheduled, 1);
    } finally { c.dom.window.close(); }
  });

  test(`${name}: movimiento reducido desactiva autoplay inicial y cambios de preferencia`, () => {
    const c = instagramCarousel(html, true, false);
    try {
      const doc = c.dom.window.document;
      assert.equal(c.scheduled, 0);
      c.advance(10000); assert.equal(c.counter, '1 / 8');
      doc.getElementById('instagramNext').click(); assert.equal(c.counter, '2 / 8');
      c.track.dispatchEvent(new c.dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      assert.equal(c.scheduled, 0, 'Espacio no debe saltarse la preferencia de movimiento reducido.');
      c.reduce(true); assert.equal(c.scheduled, 0);
      c.reduce(false); assert.equal(c.scheduled, 1);
      assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.is-ready \.instagram-card\s*\{\s*transition:\s*none/);
    } finally { c.dom.window.close(); }
  });

  test(`${name}: deslizar cambia tarjeta y reinicia autoplay, sin interceptar scroll vertical`, () => {
    const c = instagramCarousel(html);
    try {
      c.touch('touchstart', 200, 100); c.touch('touchend', 100, 105);
      assert.equal(c.counter, '2 / 8');
      assert.equal(c.scheduled, 1);
      c.touch('touchstart', 100, 100); c.touch('touchend', 200, 105);
      assert.equal(c.counter, '1 / 8');
      c.touch('touchstart', 200, 100); c.touch('touchend', 100, 300);
      assert.equal(c.counter, '1 / 8');
      c.touch('touchstart', 200, 100);
      c.track.dispatchEvent(new c.dom.window.Event('touchcancel'));
      c.touch('touchend', 100, 105);
      assert.equal(c.counter, '1 / 8');
    } finally { c.dom.window.close(); }
  });
}

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

test('separadores más amplios en todos los títulos y compartidos por Arma tu PC', () => {
  for (const html of [source, built]) {
    assert.match(html, /\.divider\s*\{\s*width:\s*min\(240px, 60%\);\s*height:\s*4px/);
    const dom = new JSDOM(html);
    try {
      for (const id of ['services', 'why', 'gallery', 'contact']) {
        assert.ok(dom.window.document.querySelector(`#${id} h2 + .divider`));
      }
    } finally { dom.window.close(); }
  }
  const template = readFileSync(new URL('../../frontend/src/app/pages/cotizador/cotizador.component.html', import.meta.url), 'utf8');
  const dom = new JSDOM(template);
  try {
    assert.equal(dom.window.document.querySelector('.cabecera h2 + .divider')?.getAttribute('aria-hidden'), 'true');
  } finally { dom.window.close(); }
});

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

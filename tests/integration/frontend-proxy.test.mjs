// Red y contenedores efímeros propios. Nunca usa servicios, cuentas o volúmenes reales.
// TEST_FRONTEND_IMAGE=<imagen recién construida> node --test tests/integration/frontend-proxy.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

const image = process.env.TEST_FRONTEND_IMAGE;
const fixture = fileURLToPath(new URL('./fixtures/proxy-backend.conf', import.meta.url));
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 45000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

async function eventually(check, timeout = 30000) {
  const end = Date.now() + timeout;
  let error;
  do {
    try { return await check(); } catch (cause) { error = cause; }
    await delay(300);
  } while (Date.now() < end);
  throw error;
}

test('proxy Docker: valores locales, variables Railway, rutas, logs y renovación DNS', {
  skip: !image && 'Define TEST_FRONTEND_IMAGE para ejecutar esta prueba Docker.', timeout: 150000,
}, async () => {
  const prefix = `jemba-proxy-qa-${randomBytes(6).toString('hex')}`;
  const network = `${prefix}-net`;
  const backend = `${prefix}-api`;
  const blocker = `${prefix}-blocker`;
  const frontends = [];
  let networkCreated = false;
  const startBackend = () => docker('run', '-d', '--name', backend, '--network', network,
    '--network-alias', 'backend', '--network-alias', 'api.railway.internal',
    '--mount', `type=bind,source=${fixture},target=/etc/nginx/conf.d/default.conf,readonly`,
    '--entrypoint', 'nginx', image, '-g', 'daemon off;');
  try {
    docker('network', 'create', network);
    networkCreated = true;
    startBackend();
    for (const custom of [false, true]) {
      const name = `${prefix}-${custom ? 'railway' : 'local'}`;
      const port = custom ? 8080 : 80;
      frontends.push(name);
      const env = custom ? ['-e', 'PORT=8080', '-e', 'BACKEND_HOST=api.railway.internal', '-e', 'BACKEND_PORT=4567'] : [];
      // Estas variables no deben sustituir $host/$uri de Nginx.
      docker('run', '-d', '--name', name, '--network', network, '-p', `127.0.0.1::${port}`,
        ...env, '-e', 'host=incorrect.example', '-e', 'uri=/incorrect', image);
      const published = docker('port', name, `${port}/tcp`);
      const base = `http://${published}`;
      await eventually(async () => {
        const response = await fetch(`${base}/ruta-angular`, { signal: AbortSignal.timeout(2000) });
        assert.equal(response.status, 200);
        assert.match(await response.text(), /<title>JembaTech<\/title>/);
      });
      await eventually(async () => {
        const response = await fetch(`${base}/api/health?probe=proxy-qa`, { method: 'POST', signal: AbortSignal.timeout(2000) });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('x-request-id'), 'proxy-qa-correlation');
        assert.deepEqual(await response.json(), { path: '/api/health', query: 'probe=proxy-qa', method: 'POST' });
      });
      const config = docker('exec', name, 'nginx', '-T');
      assert.ok(config.includes('proxy_set_header Host $host;'));
      assert.ok(config.includes('try_files $uri $uri/ /index.html;'));
      assert.ok(!/\$\{(?:PORT|BACKEND_HOST|BACKEND_PORT|NGINX_LOCAL_RESOLVERS)\}/.test(config));
      const logs = docker('logs', name);
      assert.ok(logs.includes('"requestId":"proxy-qa-correlation"'));
      assert.ok(!logs.includes('probe=proxy-qa'), 'No registrar el query privado.');
    }
    // Reservar la IP antigua fuerza un cambio real de DNS sin reiniciar los frontends.
    const inspectAddress = '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}';
    const previousIp = docker('inspect', '-f', inspectAddress, backend);
    assert.ok(previousIp);
    docker('rm', '-f', backend);
    docker('run', '-d', '--name', blocker, '--network', network, '--ip', previousIp, '--entrypoint', 'sleep', image, '120');
    startBackend();
    assert.notEqual(docker('inspect', '-f', inspectAddress, backend), previousIp);
    for (const [index, name] of frontends.entries()) {
      const published = docker('port', name, `${index === 0 ? 80 : 8080}/tcp`);
      await eventually(async () => {
        const response = await fetch(`http://${published}/api/health`, { signal: AbortSignal.timeout(2000) });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).path, '/api/health');
      });
    }
  } finally {
    // Solo nombres únicos creados en esta prueba; no eliminar volúmenes del usuario.
    for (const name of [...frontends, backend, blocker]) {
      try { docker('rm', '-f', name); } catch { /* Puede no haberse creado. */ }
    }
    if (networkCreated) docker('network', 'rm', network);
  }
});

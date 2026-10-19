// Contrato estático: la prueba Docker complementaria comprueba el proxy real.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dockerfile = readFileSync(new URL('../../frontend/Dockerfile', import.meta.url), 'utf8');
const template = readFileSync(new URL('../../frontend/nginx.conf', import.meta.url), 'utf8');
const runtimeTest = readFileSync(new URL('./frontend-proxy.test.mjs', import.meta.url), 'utf8');

test('proxy: conserva los valores predeterminados de Docker Compose', () => {
  for (const setting of ['BACKEND_HOST=backend', 'BACKEND_PORT=3000', 'PORT=80']) {
    assert.ok(dockerfile.includes(setting), setting);
  }
  assert.match(dockerfile, /COPY nginx\.conf \/etc\/nginx\/templates\/default\.conf\.template/);
  assert.match(template, /listen \$\{PORT\};/);
  assert.match(template, /server \$\{BACKEND_HOST\}:\$\{BACKEND_PORT\} resolve;/);
});

test('proxy: sustituye solo variables de despliegue, sin alterar variables Nginx', () => {
  assert.ok(dockerfile.includes('NGINX_ENVSUBST_FILTER="^(BACKEND_HOST|BACKEND_PORT|PORT|NGINX_LOCAL_RESOLVERS)$"'));
  for (const variable of ['$host', '$proxy_add_x_forwarded_for', '$uri', '$request_method', '$upstream_http_x_request_id']) {
    assert.ok(template.includes(variable), variable);
  }
});

test('proxy: renueva DNS y conserva el prefijo API, la SPA y los logs sin URI', () => {
  assert.match(dockerfile, /NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1/);
  assert.match(template, /zone jemba_api 64k;/);
  assert.match(template, /resolver \$\{NGINX_LOCAL_RESOLVERS\} valid=10s;/);
  assert.match(template, /location \/api\/ \{\s+proxy_pass http:\/\/jemba_api;/);
  assert.match(template, /try_files \$uri \$uri\/ \/index\.html/);
  const logFormat = template.split(/\r?\n/).find(line => line.startsWith('log_format '));
  assert.ok(logFormat.includes('$upstream_http_x_request_id'));
  assert.doesNotMatch(logFormat, /\$request_uri|\$args|\$http_authorization/);
});

test('proxy QA: reserva IP solo después de crear una subred explícita compatible con Linux', () => {
  const inspect = runtimeTest.indexOf("docker('network', 'inspect'");
  const remove = runtimeTest.indexOf("docker('network', 'rm', network); // Red QA propia");
  const recreate = runtimeTest.indexOf("docker('network', 'create', '--subnet', subnet, network)");
  const staticIp = runtimeTest.indexOf("'--ip', previousIp");
  assert.ok(inspect >= 0 && remove > inspect && recreate > remove && staticIp > recreate);
  assert.match(runtimeTest, /assert\.notEqual\(docker\('inspect', '-f', inspectAddress, backend\), previousIp\)/);
});

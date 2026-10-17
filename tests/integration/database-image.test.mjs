// Contenedor efímero, sin puertos ni volúmenes persistentes. No toca la base actual.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8', timeout: 15000 });
test('PostgreSQL: inicializa desde cero y el proceso final no es root', async t => {
  const image = process.env.TEST_DATABASE_IMAGE;
  assert.ok(image, 'Define TEST_DATABASE_IMAGE con el ID de la imagen construida.');
  const name = `jembatech-db-qa-${randomUUID()}`;
  const started = docker('run', '--rm', '--detach', '--name', name,
    '--tmpfs', '/var/lib/postgresql/data:rw,size=128m',
    '--env', 'POSTGRES_USER=jemba', '--env', 'POSTGRES_DB=security_qa',
    '--env', `POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}`, image);
  t.after(() => {
    const stopped = docker('stop', '--time', '5', name);
    assert.equal(stopped.status, 0, 'No se pudo retirar el contenedor QA.');
  });
  assert.equal(started.status, 0, 'No se pudo iniciar la imagen temporal.');
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    // No confundir el servidor temporal de initdb con el proceso final.
    const processName = docker('exec', name, 'cat', '/proc/1/comm');
    if (processName.status === 0 && processName.stdout.trim() === 'postgres') {
      ready = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, 'PostgreSQL no terminó la inicialización.');
  const status = docker('exec', name, 'cat', '/proc/1/status');
  assert.equal(status.status, 0);
  const uid = status.stdout.match(/^Uid:\s+(\d+)/m);
  assert.ok(uid && Number(uid[1]) > 0, 'PostgreSQL debe ejecutar como usuario no root.');
  const query = docker('exec', name, 'psql', '-U', 'jemba', '-d', 'security_qa', '-Atc', 'SELECT current_user');
  assert.equal(query.status, 0, 'La base recién creada no responde.');
  assert.equal(query.stdout.trim(), 'jemba');
});

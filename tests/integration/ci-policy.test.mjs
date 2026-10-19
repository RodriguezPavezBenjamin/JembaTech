// Controles estáticos del workflow; no ejecutan ni certifican GitHub Actions.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const actions = {
  'actions/checkout': '3d3c42e5aac5ba805825da76410c181273ba90b1',
  'actions/setup-node': '949feb2413d6458794dcd2491c4babbbce0c15c1',
  'actions/setup-python': '5fda3b95a4ea91299a34e894583c3862153e4b97',
  'actions/upload-artifact': 'cf430e030ddbb5b0abf93d22962f4752f3646cd9',
};

test('CI: cada acción migrada queda fijada al SHA oficial revisado para Node 24', () => {
  for (const [name, sha] of Object.entries(actions)) {
    const references = [...workflow.matchAll(/uses:\s+([^\s@]+)@([^\s#]+)/g)].filter(match => match[1] === name);
    assert.ok(references.length, name + ' debe estar presente');
    for (const reference of references) assert.equal(reference[2], sha, name);
  }
});

test('CI: los ocho jobs fijan Ubuntu 24.04 sin cambiar Node 22 ni Python 3.12 de la app', () => {
  const runners = [...workflow.matchAll(/^\s+runs-on:\s+([^\r\n]+)/gm)];
  assert.equal(runners.length, 8);
  for (const runner of runners) assert.equal(runner[1].trim(), 'ubuntu-24.04');
  const nodes = [...workflow.matchAll(/node-version:\s*(\d+)/g)];
  assert.equal(nodes.length, 5);
  for (const node of nodes) assert.equal(node[1], '22');
  assert.equal([...workflow.matchAll(/python-version: "3\.12"/g)].length, 2);
});

test('CI: se conservan gates, informes y dependencia de Docker sin ocultar fallos', () => {
  assert.match(workflow, /needs: \[frontend, backend, python, security-python, codeql, secrets, terraform\]/);
  for (const gate of ['npm audit --omit=dev --audit-level=high', 'npm audit --audit-level=critical', 'python -m bandit', 'python -m pip_audit --strict', 'node scripts/check-codeql.mjs', 'bash scripts/scan-secrets.sh', 'bash scripts/scan-images.sh']) {
    assert.ok(workflow.includes(gate), gate);
  }
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /language: \[javascript-typescript, python\]/);
  assert.match(workflow, /retention-days: 14/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true|pull_request_target:/);
  assert.match(workflow, /node --test \.\.\/tests\/integration\/android-config\.test\.mjs \.\.\/tests\/integration\/ci-policy\.test\.mjs/);
});

test('CI: la imagen final Nginx aplica los parches de libexpat y libx11', () => {
  const dockerfile = readFileSync(new URL('../../frontend/Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /FROM nginx:1\.30-alpine\r?\nRUN apk upgrade --no-cache libexpat libx11/);
});

test('CI: el proveedor Terraform conserva checksums oficiales de Linux y Windows', () => {
  const lock = readFileSync(new URL('../../infra/.terraform.lock.hcl', import.meta.url), 'utf8');
  assert.ok(lock.includes('"h1:qGLHCuYSus+uHNnoEL4SuJqOs5yrNOcB7gnuHoVqizo="'));
  assert.ok(lock.includes('"h1:tX/GU6iR6pP5XMj3zo22mIsZEIW2GUZ9GxfVdo2KjoI="'));
  assert.match(lock, /version\s+= "2\.9\.1"/);
});

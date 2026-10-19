// Verifica la imagen runtime real, sin red, certificados falsos ni claves privadas.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('Firebase SDK real en Node 22: config pública y rechazo de algoritmos/audience ajenos sin ADC', {
  skip: !process.env.TEST_BACKEND_IMAGE && 'Define TEST_BACKEND_IMAGE con la imagen recién construida.', timeout: 45000,
}, () => {
  const worker = `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const { FirebaseAuthService } = require('./dist/firebase-auth.service.js');
    const service = new FirebaseAuthService();
    assert.equal(service.publicConfig().firebase.projectId, 'jemba-qa');
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const claims = { sub: 'qa-subject', aud: 'another-project', iss: 'https://securetoken.google.com/another-project',
      iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 };
    const unsignedFixtures = [
      'invalid',
      [encode({alg:'HS256',kid:'qa'}), encode(claims), encode('not-a-signature')].join('.'),
      [encode({alg:'RS256',kid:'qa'}), encode(claims), encode('not-a-signature')].join('.'),
    ];
    for (const token of unsignedFixtures) await assert.rejects(service.verifyGoogleToken(token), error => error.getStatus() === 401);
    console.log('FIREBASE_RUNTIME_REJECTION_OK');
  `;
  const output = execFileSync('docker', ['run', '--rm', '--network', 'none',
    '-e', 'FIREBASE_AUTH_ENABLED=true', '-e', 'FIREBASE_PROJECT_ID=jemba-qa',
    '-e', 'FIREBASE_WEB_API_KEY=public-sdk-config-qa', '-e', 'FIREBASE_WEB_APP_ID=qa-app-id',
    '--entrypoint', 'node', process.env.TEST_BACKEND_IMAGE, '--input-type=module', '-e', worker],
  { encoding: 'utf8', timeout: 40000, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(output, /FIREBASE_RUNTIME_REJECTION_OK/);
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { checkSecretResults } from '../../scripts/check-secrets.mjs';

const fixture = () => {
  const raw = 'synthetic-unit-marker-not-a-credential';
  const entry = { detector: 'Postgres', commit: 'a'.repeat(40), file: 'tests/example.yml', line: 16,
    sha256: createHash('sha256').update(raw).digest('hex'), reason: 'Unit test only.' };
  const row = { DetectorName: 'Postgres', Verified: false, Raw: raw,
    SourceMetadata: { Data: { Git: { file: entry.file, line: entry.line, commit: entry.commit } } } };
  return { baseline: { version: 1, findings: [entry] }, row };
};

test('secretos: pasa limpio o solo la aparición histórica exacta revisada', () => {
  const { baseline, row } = fixture();
  assert.deepEqual(checkSecretResults('', baseline, 0).blocked, []);
  const result = checkSecretResults(JSON.stringify(row), baseline, 183);
  assert.equal(result.acceptedHistoricalQa, 1);
  assert.deepEqual(result.blocked, []);
  assert.equal(JSON.stringify(result).includes(row.Raw), false);
});

test('secretos: credencial distinta, commit nuevo, otro archivo/línea o verificada bloquean', () => {
  for (const change of [
    row => { row.Raw += '-different'; }, row => { row.Verified = true; },
    row => { row.DetectorName = 'AWS'; }, row => { row.SourceMetadata.Data.Git.commit = 'b'.repeat(40); },
    row => { row.SourceMetadata.Data.Git.file = 'backend/config.yml'; },
    row => { row.SourceMetadata.Data.Git.line = 19; },
  ]) {
    const { baseline, row } = fixture();
    change(row);
    assert.equal(checkSecretResults(JSON.stringify(row), baseline, 183).blocked.length, 1);
  }
});

test('secretos: un permitido no oculta otro hallazgo del mismo reporte', () => {
  const { baseline, row } = fixture();
  const other = structuredClone(row);
  other.Raw = 'another-synthetic-unit-marker';
  const result = checkSecretResults([row, other].map(item => JSON.stringify(item)).join('\n'), baseline, 183);
  assert.equal(result.acceptedHistoricalQa, 1);
  assert.equal(result.blocked.length, 1);
});

test('secretos: error del escáner, JSON roto, baseline o identidad ausentes bloquean', () => {
  const { baseline, row } = fixture();
  for (const status of [1, 2, 125, 127]) assert.throws(() => checkSecretResults('', baseline, status));
  assert.throws(() => checkSecretResults('not-json', baseline, 183));
  assert.throws(() => checkSecretResults('', {}, 0));
  assert.throws(() => checkSecretResults('{}', baseline, 183));
  assert.throws(() => checkSecretResults(JSON.stringify(row), baseline, 0));
  assert.throws(() => checkSecretResults('', baseline, 183));
  row.SourceMetadata.Data.Git.line = '16';
  assert.throws(() => checkSecretResults(JSON.stringify(row), baseline, 183));
});

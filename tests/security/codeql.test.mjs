import assert from 'node:assert/strict';
import { test } from 'node:test';
import { highSecurityFindings } from '../../scripts/check-codeql.mjs';

const report = (severity, results = [{ ruleId: 'test/rule' }]) => ({
  version: '2.1.0',
  runs: [{ tool: { driver: { rules: [{ id: 'test/rule', properties: { 'security-severity': severity } }] } }, results }],
});

test('CodeQL: un análisis limpio pasa y medio queda en el reporte', () => {
  assert.deepEqual(highSecurityFindings(report('9.8', [])), []);
  assert.deepEqual(highSecurityFindings(report('6.9')), []);
});
test('CodeQL: hallazgos altos y críticos bloquean', () => {
  assert.equal(highSecurityFindings(report('7.0')).length, 1);
  assert.equal(highSecurityFindings(report('9.8')).length, 1);
});
test('CodeQL: no acepta reportes rotos, reglas ausentes ni ejecución fallida', () => {
  for (const malformed of [{}, { version: '2.1.0', runs: [] }, report('NaN'), report('11'), report('8', [{ ruleId: 'unknown' }])]) {
    assert.throws(() => highSecurityFindings(malformed));
  }
  const failed = report('5');
  failed.runs[0].invocations = [{ executionSuccessful: false }];
  assert.throws(() => highSecurityFindings(failed));
});

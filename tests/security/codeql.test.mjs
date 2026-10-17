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

const pythonReport = () => ({
  version: '2.1.0',
  runs: [{
    tool: { driver: { name: 'CodeQL', rules: [] }, extensions: [{
      name: 'codeql/python-queries', guid: 'python-queries-guid',
      rules: [{ id: 'py/partial-ssrf', properties: { 'security-severity': '9.1', tags: ['security'] } }],
    }] },
    results: [{ ruleId: 'py/partial-ssrf', rule: { id: 'py/partial-ssrf', index: 0, toolComponent: { index: 0 } } }],
  }],
});

test('CodeQL: resuelve el formato Python real con reglas de extensión y bloquea 9.1', () => {
  assert.deepEqual(highSecurityFindings(pythonReport()), [{ ruleId: 'py/partial-ssrf', severity: 9.1 }]);
});

test('CodeQL: referencias por GUID e ID, índice heredado y reporte sin hallazgos', () => {
  const python = pythonReport();
  python.runs[0].results[0].rule = { id: 'py/partial-ssrf', toolComponent: { guid: 'python-queries-guid' } };
  assert.equal(highSecurityFindings(python).length, 1);
  const legacy = report('7', [{ ruleIndex: 0 }]);
  assert.equal(highSecurityFindings(legacy).length, 1);
  python.runs[0].results = [];
  assert.deepEqual(highSecurityFindings(python), []);
});

test('CodeQL: rechaza referencias ambiguas, índices inválidos y contradicciones sin omitir alertas', () => {
  for (const change of [
    value => { value.rule.toolComponent.index = 8; },
    value => { value.rule.toolComponent.index = -1; },
    value => { value.rule.toolComponent.guid = 'wrong-guid'; },
    value => { value.rule.toolComponent.name = 'wrong-component'; },
    value => { value.rule.id = 'different-id'; },
    value => { value.rule.index = 9; },
    value => { value.rule.index = 0.5; },
    value => { value.ruleIndex = 1; },
  ]) {
    const python = pythonReport();
    change(python.runs[0].results[0]);
    assert.throws(() => highSecurityFindings(python));
  }
  const duplicate = pythonReport();
  duplicate.runs[0].tool.extensions.push(structuredClone(duplicate.runs[0].tool.extensions[0]));
  duplicate.runs[0].results[0].rule.toolComponent = { guid: 'python-queries-guid' };
  assert.throws(() => highSecurityFindings(duplicate));
});

test('CodeQL: no convierte severidades nulas o ausentes de seguridad en análisis limpio', () => {
  for (const severity of [null, true, '', ' ', 'NaN', Infinity, -1, 11, undefined]) {
    const python = pythonReport();
    python.runs[0].tool.extensions[0].rules[0].properties['security-severity'] = severity;
    assert.throws(() => highSecurityFindings(python));
  }
});

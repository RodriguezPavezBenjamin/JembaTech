import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSourceEvaluationArgs } from '../../scripts/evaluate-source.mjs';

test('evaluación de fuente: sin --live no autoriza red o persistencia', () => {
  for (const args of [[], ['--limit', '5']]) assert.throws(() => parseSourceEvaluationArgs(args));
});
test('evaluación de fuente: una página de 1 a 5 y valor conservador por defecto', () => {
  assert.deepEqual(parseSourceEvaluationArgs(['--live']), { limit: 1 });
  for (let limit = 1; limit <= 5; limit++) {
    assert.deepEqual(parseSourceEvaluationArgs(['--live', '--limit', String(limit)]), { limit });
  }
});
test('evaluación de fuente: rechaza URLs, duplicados y límites ajenos', () => {
  for (const args of [
    ['--live', '--url', 'https://example.invalid'], ['--live', '--live'],
    ['--live', '--limit', '0'], ['--live', '--limit', '6'], ['--live', '--limit', '-1'],
    ['--live', '--limit', '1.5'], ['--live', '--limit', '01'], ['--live', '--limit'],
    ['--live', '--limit', '1', '--limit', '2'],
  ]) assert.throws(() => parseSourceEvaluationArgs(args));
});

test('evaluación dirigida de componentes: solo selecciones conocidas, sin URLs o mezcla de límites', () => {
  for (const target of ['ryzen-7600', 'ryzen-9600x', 'core-i5-14400', 'core-ultra-245k', 'rtx-4060', 'rtx-5060', 'rx-7600', 'rx-9060xt', 'msi-b650', 'msi-b760', 'fury-ddr4', 'fury-ddr5', 'barracuda-hdd', 'mx500-sata', 'nv3-pcie', 'ryzen-5600', 'ryzen-5600g', 'ryzen-7800x3d', 'msi-b550-a-pro', 'msi-4060-ventus', 'fury-rgb-ddr4-kit', 'a400-480-sata', '990-pro-1tb']) {
    assert.deepEqual(parseSourceEvaluationArgs(['--live', '--target', target]), { limit: 5, target });
  }
  for (const args of [ ['--target', 'rtx-5060'], ['--live', '--target', 'unknown'], ['--live', '--target', 'https://localhost/'],
    ['--live', '--target', 'rtx-5060', '--target', 'rx-7600'], ['--live', '--limit', '1', '--target', 'rtx-5060'] ]) {
    assert.throws(() => parseSourceEvaluationArgs(args));
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePriceArgs } from '../../scripts/update-catalog-price.mjs';
test('precios: sin live, URL, otro ID o argumentos extra no consultan ni escriben', () => {
  for (const args of [[], ['--target', 'cpu-7600'], ['--live', '--target', 'https://localhost'], ['--live', '--target', 'gpu-4060ti'], ['--live', '--target', 'cpu-7600', '--all']]) assert.throws(() => parsePriceArgs(args));
});
test('precios: una acción explícita por modelo exacto', () => {
  for (const id of ['cpu-7600', 'gpu-4060', 'board-msi-b550-a-pro', 'ram-kingston-ddr4-rgb-16', 'drive-kingston-a400-480', 'drive-samsung-990-pro-1000', 'cpu-9600x', 'gpu-asrock-9060xt-16']) assert.equal(parsePriceArgs(['--live', '--target', id]), id);
});

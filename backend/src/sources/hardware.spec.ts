import { validateSync } from 'class-validator';
import { parseComponentRecovery, parseComponentResult } from './source.contract';
import { ComponentSampleDto } from './source.dto';
import { sourceTarget, SourceCategory } from './source.targets';

const stamp = '2026-01-01T12:00:00Z';
const board = { socket: 'AM5', chipset: 'AMD B650', formFactor: 'ATX', ramType: 'DDR5', ramSlots: 4, m2Slots: 2, sataPorts: 4, declaredTdpWatts: null };
const ram = { capacityGb: 32, moduleCapacityGb: 16, modules: 2, ramType: 'DDR5', formFactor: 'DIMM', speedMt: 6000, casLatency: null, declaredTdpWatts: null };
const storage = { storageType: 'SSD', capacityGb: 1000, interface: 'PCIe', bus: 'PCIe 4.0 x4', formFactor: 'M.2 (2280)', connector: 'M.2 2280', protocol: null, rpm: null, readMbps: 6000, writeMbps: 4000, declaredTdpWatts: null };
function data(category: SourceCategory, specs: Record<string, unknown>, name = 'QA', retrievedAt = stamp) {
  return { schema_version: 'solotodo-components-2', category, access_status: 'reuse-not-confirmed',
    products: [{ source: 'solotodo', external_id: '456', category, name, brand: 'Marca QA', part_number: 'QA-ONLY', specs,
      price_clp: null, source_url: 'https://www.solotodo.cl/products/456', retrieved_at: retrievedAt, source_updated_at: null, content_hash: 'a'.repeat(64) }],
    issues: [], metrics: { received: 1, accepted: 1, rejected: 0, duplicates: 0, valid_percent: 100, duplicate_percent: 0, missing_tdp: 0, processing_ms: 1 } };
}

describe('Placas, kits RAM y almacenamiento: frontera independiente NestJS', () => {
  it.each([['motherboard', board], ['ram', ram], ['storage', storage]] as const)('admite y proyecta solo campos del contrato %s', (category, specs) => {
    const parsed = parseComponentResult(data(category, { ...specs, image: 'never-copy' }), 1, stamp, category);
    expect(parsed.products[0].specs).toEqual(specs);
    expect(parsed.metrics).toMatchObject({ category, missingTdp: 0 });
    expect(JSON.stringify(parsed)).not.toContain('never-copy');
    expect(validateSync(Object.assign(new ComponentSampleDto(), { category, retrievedAt: stamp, records: [{}] }))).toHaveLength(0);
  });
  it.each([
    ['motherboard', board, 'ramSlots', true], ['motherboard', board, 'm2Slots', -1], ['motherboard', board, 'ramType', 'DDR3'],
    ['ram', ram, 'modules', 3], ['ram', ram, 'capacityGb', 32768], ['ram', ram, 'speedMt', '6000'],
    ['storage', storage, 'protocol', 'NVMe'], ['storage', storage, 'rpm', 7200], ['storage', storage, 'capacityGb', true],
  ] as const)('rechaza %s.%s inválido', (category, specs, field, value) => {
    expect(() => parseComponentResult(data(category, { ...specs, [field]: value }), 1, stamp, category)).toThrow();
  });
  it('RAM total = módulos × capacidad; discos conservan GB comerciales y M.2 SATA no se convierte a NVMe', () => {
    expect(parseComponentResult(data('ram', ram), 1, stamp, 'ram').products[0].specs.capacityGb).toBe(32);
    const sata = { ...storage, interface: 'SATA', bus: 'SATA 3' };
    const p = parseComponentResult(data('storage', sata), 1, stamp, 'storage').products[0];
    expect(p.specs).toMatchObject({ capacityGb: 1000, formFactor: 'M.2 (2280)', interface: 'SATA', protocol: null });
  });
  it('un TDP no aplicable no se convierte en cinco datos faltantes ni se acepta un valor inventado', () => {
    const value = data('ram', ram); value.metrics.missing_tdp = 1;
    expect(() => parseComponentResult(value, 1, stamp, 'ram')).toThrow();
    expect(() => parseComponentResult(data('ram', { ...ram, declaredTdpWatts: 5 }), 1, stamp, 'ram')).toThrow();
  });
  it('puertos desconocidos se conservan como null, distinto de cero explícito', () => {
    const unknown = parseComponentResult(data('motherboard', { ...board, m2Slots: null }), 1, stamp, 'motherboard');
    const none = parseComponentResult(data('motherboard', { ...board, m2Slots: 0 }), 1, stamp, 'motherboard');
    expect(unknown.products[0].specs.m2Slots).toBeNull(); expect(none.products[0].specs.m2Slots).toBe(0);
  });
  it('audita resultados de búsqueda no pertinentes sin almacenar fichas ni ocultar rechazos', () => {
    const value = { ...data('storage', storage), products: [], issues: [{ index: 0, code: 'target_mismatch', fields: ['name'] }],
      metrics: { received: 1, accepted: 0, rejected: 1, duplicates: 0, valid_percent: 0, duplicate_percent: 0, missing_tdp: 0, processing_ms: 1 } };
    expect(parseComponentResult(value, 1, stamp, 'storage').products).toHaveLength(0);
  });
  it('revalida pertinencia en NestJS y no acepta un SSD como resultado de categoría HDD', () => {
    const now = new Date().toISOString();
    const runId = '11111111-1111-4111-8111-111111111111';
    const target = sourceTarget('nv3-pcie')!;
    const value = { ...data('storage', storage, 'Kingston NV3 QA', now), retrieved_at: now, target: target.id, request_id: runId, source_request_url: target.url, retrieval_ms: 1 };
    expect(parseComponentRecovery(value, target.id, runId, new Date()).result.products).toHaveLength(1);
    value.products[0].name = 'Samsung 970 Evo';
    expect(() => parseComponentRecovery(value, target.id, runId, new Date())).toThrow('Unrelated source candidate');
    const hddTarget = sourceTarget('barracuda-hdd')!;
    Object.assign(value, { target: hddTarget.id, source_request_url: hddTarget.url });
    value.products[0].name = 'Seagate Barracuda QA';
    expect(() => parseComponentRecovery(value, hddTarget.id, runId, new Date())).toThrow('Unexpected storage category');
  });
});

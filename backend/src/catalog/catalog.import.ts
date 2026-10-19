import scope from './catalog-scope.json';
import { CatalogProduct } from './catalog.types';
import { observedPrice, parsePrices, PriceIdentity } from './catalog.pricing';

export const CATALOG_TARGETS = scope;
export const CATALOG_CAPS: Record<string, number> = { cpu: 35, gpu: 30, ram: 20, board: 20, case: 15 };
export function catalogUrl(target: typeof scope[number]) { return `https://api.solotodo.com/products/?categories=${target.categoryId}&search=${encodeURIComponent(target.query)}${target.category === 'cpu' ? '' : '&ordering=-id'}&page_size=${target.category === 'cpu' ? 25 : 10}`; }
// Alias cerrados del piloto, exclusivamente para restaurar auditorías previas.
const legacyQueries: Record<string, string> = { 'case-nzxt': 'NZXT H5', 'case-montech': 'Montech AIR', 'case-lian-li': 'Lian Li LANCOOL', 'case-cooler-master': 'Cooler Master MasterBox' };
function catalogUrls(target: typeof scope[number]) {
  return [catalogUrl(target), ...[target.query, legacyQueries[target.id]].filter(Boolean).flatMap(query => {
    const base = `https://api.solotodo.com/products/?categories=${target.categoryId}&search=${encodeURIComponent(query)}`;
    return [`${base}&ordering=-id&page_size=5`, `${base}&page_size=5`];
  })];
}
type Obj = Record<string, unknown>;
function obj(value: unknown): Obj { if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid catalog object'); return value as Obj; }
function text(value: unknown, max = 200): string { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f<>]/.test(value)) throw Error('Invalid catalog string'); return value; }
function num(value: unknown, min = 0, max = 1000000): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw Error('Invalid catalog number'); return value; }
function whole(value: unknown, min = 0, max = 1000000) { const n = num(value, min, max); if (!Number.isInteger(n)) throw Error('Invalid catalog integer'); return n; }
function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw Error('Invalid catalog boolean'); return value; }
function strings(value: unknown, max = 12): string[] { if (!Array.isArray(value) || value.length > max) throw Error('Invalid catalog list'); return value.map(v => text(v, 160)); }
const ramBySocket: Record<string, string[]> = { AM4: ['DDR4'], AM5: ['DDR5'], LGA1200: ['DDR4'], LGA1700: ['DDR4', 'DDR5'], LGA1851: ['DDR5'] };
export function parseCatalog(value: unknown, targetId: string, runId: string, startedAt: Date) {
  const target = scope.find(t => t.id === targetId);
  if (!target) throw Error('Unknown catalog target');
  const r = obj(value), stamp = text(r.retrievedAt, 40);
  const limit = r.sourceRequestUrl === catalogUrl(target) ? (target.category === 'cpu' ? 25 : 10) : 5;
  if (!['solotodo-catalog-1', 'solotodo-catalog-2', 'solotodo-catalog-3'].includes(r.schemaVersion as string) || r.requestId !== runId || r.target !== targetId || !catalogUrls(target).includes(r.sourceRequestUrl as string) || !/(Z|[+-]\d{2}:\d{2})$/.test(stamp) || !Number.isFinite(Date.parse(stamp)) || Date.parse(stamp) < startedAt.getTime() - 60000 || Date.parse(stamp) > Date.now() + 300000 || !Array.isArray(r.products) || r.products.length > target.take || !Array.isArray(r.issues) || whole(r.received, 0, limit) !== r.products.length + r.issues.length) throw Error('Invalid catalog provenance');
  const seen = new Set<number>();
  const products: CatalogProduct[] = r.products.map(value => {
    const p = obj(value), raw = obj(p.specs), id = whole(p.externalId, 1), name = text(p.name), image = text(p.image, 300);
    if (seen.has(id) || p.id !== `solotodo-${target.category}-${id}` || p.category !== target.category || !/^https:\/\/media\.solotodo\.com\/media\/products\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/.test(image) || /notebook|laptop|port[aá]til|SO[ -]?DIMM|Xeon|Threadripper/i.test(name)) throw Error('Invalid catalog identity/image');
    seen.add(id);
    const normal = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!target.query.split(/\s+/).every(term => normal(name).includes(normal(term)))) throw Error('Catalog family mismatch');
    const specs: CatalogProduct['specs'] = { brand: text(raw.brand, 80), mountNote: text(raw.mountNote, 1000), unverified: strings(raw.unverified) };
    if (target.category === 'cpu') {
      const socket = text(raw.socket, 20), ram = strings(raw.ramTypes, 2);
      const expectedSocket = name.startsWith('Intel ') ? (name.includes('Core Ultra') ? 'LGA1851' : /Core i[3579]-11/.test(name) ? 'LGA1200' : 'LGA1700') : /Ryzen [3579] 5/.test(name) ? 'AM4' : 'AM5';
      if (socket !== expectedSocket) throw Error('CPU platform mismatch');
      if (!ramBySocket[socket] || JSON.stringify(ram) !== JSON.stringify(ramBySocket[socket]) || !/Intel Core i[3579]-(11|12|13|14)\d{3}[FKST]*(\s|\[|$)|Intel Core Ultra [579] \d{3}[KFT]*(\s|\[|$)|AMD Ryzen [3579] [579]\d{3}(X3D2|X3D|XT|X|GE|GT|G|F)?(\s|\[|$)/.test(name)) throw Error('Unsupported desktop CPU');
      Object.assign(specs, { socket, ramTypes: ram, cores: whole(raw.cores, 1, 256), threads: whole(raw.threads, 1, 512), integrated: bool(raw.integrated), stockCooler: bool(raw.stockCooler), power: whole(raw.power, 1, 1000), declaredTdpWatts: num(raw.declaredTdpWatts, 1, 1000) });
      if (specs.stockCooler && (/\b(Tray|WOF)\b/i.test(name) || (typeof p.partNumber === 'string' && p.partNumber.toUpperCase().endsWith('WOF')))) {
        specs.stockCooler = false;
        (specs.unverified as string[]).push('cooler de la presentación: no se considera incluido en Tray/WOF');
        specs.mountNote += ' Confirmar cooler: Tray/WOF no se considera incluido.';
      }
    } else if (target.category === 'gpu') {
      const chip = text(raw.chip, 160), brand = text(raw.brand, 20);
      if (!['NVIDIA', 'AMD'].includes(brand) || !/RTX [345]0[678]0|RX [679][0678]\d{2}/.test(chip) || raw.integrated !== false) throw Error('Unsupported desktop GPU');
      Object.assign(specs, { chip, manufacturer: text(raw.manufacturer, 80), integrated: false, vramGb: num(raw.vramGb, 1, 256), lengthMm: num(raw.lengthMm, 1, 1000), power: whole(raw.power, 1, 1500), declaredTdpWatts: num(raw.declaredTdpWatts, 1, 1000), pcie8: whole(raw.pcie8, 0, 8), twelveV: whole(raw.twelveV, 0, 8) });
    } else if (target.category === 'ram') {
      const ram = text(raw.ram, 4), capacity = whole(raw.capacityGb, 8, 64), modules = whole(raw.modules, 1, 4);
      if (raw.formFactor !== 'DIMM' || !['DDR4', 'DDR5'].includes(ram) || ![8, 16, 32, 64].includes(capacity) || capacity % modules) throw Error('Unsupported RAM');
      Object.assign(specs, { ram, formFactor: 'DIMM', capacityGb: capacity, modules, speed: whole(raw.speed, 100, 12000), power: whole(raw.power, 1, 50) });
      if (raw.rgb !== undefined) specs.rgb = bool(raw.rgb);
    } else if (target.category === 'board') {
      const socket = text(raw.socket, 20), ram = text(raw.ram, 4), form = text(raw.form, 20);
      if (!ramBySocket[socket]?.includes(ram) || !['ATX', 'Micro-ATX', 'Mini-ITX'].includes(form)) throw Error('Unsupported motherboard');
      Object.assign(specs, { socket, ram, form, chipset: text(raw.chipset, 100), ramSlots: whole(raw.ramSlots, 1, 8), m2: whole(raw.m2, 0, 16), sata: whole(raw.sata, 0, 16), cpuEps: whole(raw.cpuEps, 0, 4), power: 45 });
      if (!(specs.unverified as string[]).includes('capacidad RAM máxima')) throw Error('Missing RAM capacity caveat');
    } else {
      const forms = strings(raw.forms, 3);
      if (!forms.length || forms.some(f => !['Mini-ITX', 'Micro-ATX', 'ATX'].includes(f)) || !(specs.unverified as string[]).includes('formatos de fuente')) throw Error('Unsupported case');
      Object.assign(specs, { forms, gpuClearanceMm: num(raw.gpuClearanceMm, 1, 1000), coolerClearanceMm: num(raw.coolerClearanceMm, 1, 1000), bays25: whole(raw.bays25, 0, 30), bays35: whole(raw.bays35, 0, 30) });
      if (raw.included120 !== undefined && raw.included140 !== undefined) Object.assign(specs, { included120: whole(raw.included120, 0, 20), included140: whole(raw.included140, 0, 20) });
      for (const key of ['color', 'sidePanel', 'caseSize']) if (raw[key] !== undefined) specs[key] = text(raw[key], 80);
    }
    const part = p.partNumber === null ? null : text(p.partNumber, 120);
    if (part) specs.partNumber = part;
    const identity: PriceIdentity = { id: p.id as string, productId: id, partNumber: part, label: name, url: `https://publicapi.solotodo.com/entities/?products=${id}&is_available=1&page_size=5` };
    const prices = parsePrices({ ...obj(p.prices), requestId: runId }, identity, runId, startedAt), priceInfo = observedPrice(identity, prices);
    if (!priceInfo) throw Error('Imported product without an observed price');
    return { id: identity.id, category: target.category as CatalogProduct['category'], name, description: text(p.description, 300), price: priceInfo.normalPriceClp, priceInfo, icon: target.category, image, imageSource: priceInfo.sourceUrl, imageLabel: 'Foto de la ficha · SoloTodo · puede ser de familia', specs };
  });
  const indices = new Set<number>();
  const issues = r.issues.map(value => { const i = obj(value), index = whole(i.index, 0, (r.received as number) - 1), code = text(i.code, 40); if (indices.has(index) || !['invalid_or_out_of_scope', 'no_eligible_offer', 'target_quota', 'candidate_limit'].includes(code)) throw Error('Invalid catalog issue'); indices.add(index); return { index, code }; });
  return { products, issues, received: r.received as number, retrievedAt: stamp, sourceRequestUrl: r.sourceRequestUrl as string, target: target.id };
}

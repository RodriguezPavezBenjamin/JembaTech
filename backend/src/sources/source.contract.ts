// Frontera Python-NestJS: no persistir ni exponer objetos HTTP sin validar.
import { matchesSourceTarget, sourceTarget, SOURCE_CATEGORIES, SourceCategory } from './source.targets';
type Obj = Record<string, unknown>;
function object(value: unknown): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object");
  return value as Obj;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[<>\u0000-\u001f]/.test(value)) throw new Error("Invalid text");
  return value;
}
function numeric(value: unknown, min: number, max: number, integer = true): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error("Invalid number");
  return value;
}
function date(value: unknown): string {
  const result = text(value, 40);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) throw new Error("Invalid date");
  return new Date(result).toISOString();
}
export function parseCpuResult(value: unknown, received: number, retrievedAt: string) {
  return parseResult(value, received, retrievedAt, 'cpu', false);
}
export function parseComponentResult(value: unknown, received: number, retrievedAt: string, category: SourceCategory) {
  return parseResult(value, received, retrievedAt, category, true);
}
function parseResult(value: unknown, received: number, retrievedAt: string, category: SourceCategory, components: boolean) {
  if (!(SOURCE_CATEGORIES as readonly string[]).includes(category)) throw new Error('Invalid category');
  numeric(received, 0, 50);
  const root = object(value);
  if (root.schema_version !== (components ? 'solotodo-components-2' : 'solotodo-cpu-1') || (components && root.category !== category) || root.access_status !== "reuse-not-confirmed" || !Array.isArray(root.products) || root.products.length > received || !Array.isArray(root.issues)) throw new Error("Invalid schema");
  const ids = new Set<string>();
  const products = root.products.map(item => {
    const p = object(item);
    const id = text(p.external_id, 40);
    if (!/^[1-9]\d*$/.test(id) || ids.has(id) || p.source !== "solotodo" || p.category !== category || p.price_clp !== null || p.source_url !== `https://www.solotodo.cl/products/${id}`) throw new Error("Invalid product identity");
    ids.add(id);
    const hash = text(p.content_hash, 64);
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid hash");
    const retrieved = date(p.retrieved_at);
    if (Date.parse(retrieved) !== Date.parse(retrievedAt)) throw new Error("Incorrect retrieval date");
    const updated = p.source_updated_at === null ? null : date(p.source_updated_at);
    if (updated && Date.parse(updated) > Date.parse(retrieved) + 300000) throw new Error("Future source date");
    const s = components ? object(p.specs) : { socket: p.socket, cores: p.cores, threads: p.threads, declaredTdpWatts: p.declared_tdp_watts };
    const tdpApplicable = category === 'cpu' || category === 'gpu';
    if (!tdpApplicable && s.declaredTdpWatts !== null) throw new Error('TDP not applicable');
    const specs: Record<string, string | number | null> = { declaredTdpWatts: s.declaredTdpWatts === null ? null : numeric(s.declaredTdpWatts, 0.001, category === 'cpu' ? 1000 : 1500, false) };
    if (category === 'cpu') {
      const cores = numeric(s.cores, 1, 256);
      Object.assign(specs, { socket: text(s.socket, 40), cores, threads: numeric(s.threads, cores, 512) });
      if (components) {
        const performance = numeric(s.performanceCores, 1, 256);
        const efficiency = numeric(s.efficiencyCores, 0, 256);
        if (performance + efficiency !== cores) throw new Error('Inconsistent hybrid cores');
        Object.assign(specs, { performanceCores: performance, efficiencyCores: efficiency });
      }
    } else if (category === 'gpu') {
      if (!['AMD', 'NVIDIA'].includes(String(s.chipBrand))) throw new Error('Unsupported GPU chip');
      Object.assign(specs, {
        chip: text(s.chip, 160), chipBrand: text(s.chipBrand, 10),
        vramGb: numeric(s.vramGb, 0.5, 256, false), memoryType: text(s.memoryType, 40),
        lengthMm: s.lengthMm === null ? null : numeric(s.lengthMm, 0.001, 1000, false),
        slots: s.slots === null ? null : numeric(s.slots, 0.001, 8, false),
        bus: s.bus === null ? null : text(s.bus, 80),
      });
    } else if (category === 'motherboard') {
      if (!['DDR4', 'DDR5'].includes(String(s.ramType))) throw new Error('Unsupported memory type');
      Object.assign(specs, { socket: text(s.socket, 40), chipset: text(s.chipset, 100), formFactor: text(s.formFactor, 40),
        ramType: text(s.ramType, 10), ramSlots: numeric(s.ramSlots, 1, 32),
        m2Slots: s.m2Slots === null ? null : numeric(s.m2Slots, 0, 2560),
        sataPorts: s.sataPorts === null ? null : numeric(s.sataPorts, 0, 2560) });
    } else if (category === 'ram') {
      if (!['DDR4', 'DDR5'].includes(String(s.ramType))) throw new Error('Unsupported memory type');
      const capacity = numeric(s.capacityGb, 0.25, 4096, false);
      const moduleCapacity = numeric(s.moduleCapacityGb, 0.25, 1024, false);
      const modules = numeric(s.modules, 1, 16);
      if (capacity !== moduleCapacity * modules) throw new Error('Inconsistent RAM kit');
      Object.assign(specs, { capacityGb: capacity, moduleCapacityGb: moduleCapacity, modules,
        ramType: text(s.ramType, 10), formFactor: text(s.formFactor, 30), speedMt: numeric(s.speedMt, 100, 20000),
        casLatency: s.casLatency === null ? null : numeric(s.casLatency, 1, 200) });
    } else {
      if (!['HDD', 'SSD'].includes(String(s.storageType)) || s.protocol !== null) throw new Error('Invalid storage type or unverified protocol');
      if (s.storageType === 'SSD' && s.rpm !== null) throw new Error('SSD cannot have RPM');
      if (s.storageType === 'HDD' && (s.readMbps !== null || s.writeMbps !== null)) throw new Error('Unexpected HDD transfer speed');
      Object.assign(specs, { storageType: text(s.storageType, 10), capacityGb: numeric(s.capacityGb, 1, 1000000),
        interface: text(s.interface, 40), bus: text(s.bus, 100), formFactor: text(s.formFactor, 40),
        connector: s.connector === null ? null : text(s.connector, 80), protocol: null,
        rpm: s.rpm === null ? null : numeric(s.rpm, 1, 30000),
        readMbps: s.readMbps === null ? null : numeric(s.readMbps, 1, 100000),
        writeMbps: s.writeMbps === null ? null : numeric(s.writeMbps, 1, 100000) });
    }
    return {
      category, externalId: id, name: text(p.name, 200), brand: text(p.brand, 80),
      partNumber: p.part_number === null ? null : text(p.part_number, 120),
      specs,
      sourceUrl: p.source_url as string, retrievedAt: retrieved,
      sourceUpdatedAt: updated, contentHash: hash,
    };
  });
  const m = object(root.metrics);
  const accepted = numeric(m.accepted, 0, received);
  const rejected = numeric(m.rejected, 0, received);
  const duplicates = numeric(m.duplicates, 0, received);
  const validPercent = numeric(m.valid_percent, 0, 100, false);
  const duplicatePercent = numeric(m.duplicate_percent, 0, 100, false);
  const missingTdp = numeric(m.missing_tdp, 0, accepted);
  if (m.received !== received || accepted !== products.length || accepted + rejected + duplicates !== received || validPercent !== (received ? Math.round((received - rejected) * 10000 / received) / 100 : 0) || duplicatePercent !== (received ? Math.round(duplicates * 10000 / received) / 100 : 0) || missingTdp !== (['cpu', 'gpu'].includes(category) ? products.filter(p => p.specs.declaredTdpWatts === null).length : 0) || root.issues.length !== rejected + duplicates) throw new Error("Inconsistent metrics");
  const issueIndexes = new Set<number>();
  const issues = root.issues.map(item => {
    const issue = object(item);
    const index = numeric(issue.index, 0, received - 1);
    if (issueIndexes.has(index) || !["invalid_record", ...(components ? ['target_mismatch'] : []), "duplicate_id", "conflicting_duplicate"].includes(String(issue.code)) || !Array.isArray(issue.fields) || issue.fields.length > 20) throw new Error("Invalid issue");
    issueIndexes.add(index);
    return { index, code: issue.code as string, fields: issue.fields.map(f => text(f, 100)) };
  });
  if (issues.filter(i => i.code === "invalid_record" || i.code === 'target_mismatch').length !== rejected) throw new Error("Inconsistent issues");
  return {
    products, issues,
    metrics: { received, accepted, rejected, duplicates, validPercent, duplicatePercent, missingTdp, processingMs: numeric(m.processing_ms, 0, 60000, false), ...(components ? { category } : {}) },
  };
}

export function parseCpuRecovery(value: unknown, limit: number, runId: string, startedAt: Date) {
  const root = object(value);
  const retrievedAt = date(root.retrieved_at);
  if (root.request_id !== runId || root.source_request_url !== `https://api.solotodo.com/products/?categories=3&page_size=${limit}` || Date.parse(retrievedAt) < startedAt.getTime() - 60000 || Date.parse(retrievedAt) > Date.now() + 300000) throw new Error('Invalid acquisition provenance');
  const received = numeric(object(root.metrics).received, 0, limit);
  return { result: parseCpuResult(value, received, retrievedAt), retrievedAt, retrievalMs: numeric(root.retrieval_ms, 0, 60000, false) };
}

export function parseComponentRecovery(value: unknown, targetId: string, runId: string, startedAt: Date) {
  const target = sourceTarget(targetId);
  const root = object(value);
  const retrievedAt = date(root.retrieved_at);
  if (!target || root.target !== target.id || root.request_id !== runId || root.source_request_url !== target.url || Date.parse(retrievedAt) < startedAt.getTime() - 60000 || Date.parse(retrievedAt) > Date.now() + 300000) throw new Error('Invalid acquisition provenance');
  const received = numeric(object(root.metrics).received, 0, 5);
  const result = parseComponentResult(value, received, retrievedAt, target.category);
  if (result.products.some(p => !matchesSourceTarget(p.name, typeof p.specs.chip === 'string' ? p.specs.chip : '', target.terms))) throw new Error('Unrelated source candidate');
  if (target.category === 'storage' && result.products.some(p => p.specs.storageType !== (target.categoryId === 8 ? 'HDD' : 'SSD'))) throw new Error('Unexpected storage category');
  return { result, retrievedAt, retrievalMs: numeric(root.retrieval_ms, 0, 60000, false) };
}

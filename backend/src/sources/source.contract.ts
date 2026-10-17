// Frontera Python-NestJS: no persistir ni exponer objetos HTTP sin validar.
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
  numeric(received, 0, 50);
  const root = object(value);
  if (root.schema_version !== "solotodo-cpu-1" || root.access_status !== "reuse-not-confirmed" || !Array.isArray(root.products) || root.products.length > received || !Array.isArray(root.issues)) throw new Error("Invalid schema");
  const ids = new Set<string>();
  const products = root.products.map(item => {
    const p = object(item);
    const id = text(p.external_id, 40);
    if (!/^[1-9]\d*$/.test(id) || ids.has(id) || p.source !== "solotodo" || p.category !== "cpu" || p.price_clp !== null || p.source_url !== `https://www.solotodo.cl/products/${id}`) throw new Error("Invalid product identity");
    ids.add(id);
    const hash = text(p.content_hash, 64);
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid hash");
    const retrieved = date(p.retrieved_at);
    if (Date.parse(retrieved) !== Date.parse(retrievedAt)) throw new Error("Incorrect retrieval date");
    const updated = p.source_updated_at === null ? null : date(p.source_updated_at);
    if (updated && Date.parse(updated) > Date.parse(retrieved) + 300000) throw new Error("Future source date");
    const cores = numeric(p.cores, 1, 256);
    return {
      externalId: id, name: text(p.name, 200), brand: text(p.brand, 80),
      partNumber: p.part_number === null ? null : text(p.part_number, 120),
      specs: { socket: text(p.socket, 40), cores, threads: numeric(p.threads, cores, 512), declaredTdpWatts: p.declared_tdp_watts === null ? null : numeric(p.declared_tdp_watts, 0.001, 1000, false) },
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
  if (m.received !== received || accepted !== products.length || accepted + rejected + duplicates !== received || validPercent !== (received ? Math.round((received - rejected) * 10000 / received) / 100 : 0) || duplicatePercent !== (received ? Math.round(duplicates * 10000 / received) / 100 : 0) || missingTdp !== products.filter(p => p.specs.declaredTdpWatts === null).length || root.issues.length !== rejected + duplicates) throw new Error("Inconsistent metrics");
  const issueIndexes = new Set<number>();
  const issues = root.issues.map(item => {
    const issue = object(item);
    const index = numeric(issue.index, 0, received - 1);
    if (issueIndexes.has(index) || !["invalid_record", "duplicate_id", "conflicting_duplicate"].includes(String(issue.code)) || !Array.isArray(issue.fields) || issue.fields.length > 20) throw new Error("Invalid issue");
    issueIndexes.add(index);
    return { index, code: issue.code as string, fields: issue.fields.map(f => text(f, 100)) };
  });
  if (issues.filter(i => i.code === "invalid_record").length !== rejected) throw new Error("Inconsistent issues");
  return {
    products, issues,
    metrics: { received, accepted, rejected, duplicates, validPercent, duplicatePercent, missingTdp, processingMs: numeric(m.processing_ms, 0, 60000, false) },
  };
}

export function parseCpuRecovery(value: unknown, limit: number, runId: string, startedAt: Date) {
  const root = object(value);
  const retrievedAt = date(root.retrieved_at);
  if (root.request_id !== runId || root.source_request_url !== `https://api.solotodo.com/products/?categories=3&page_size=${limit}` || Date.parse(retrievedAt) < startedAt.getTime() - 60000 || Date.parse(retrievedAt) > Date.now() + 300000) throw new Error('Invalid acquisition provenance');
  const received = numeric(object(root.metrics).received, 0, limit);
  return { result: parseCpuResult(value, received, retrievedAt), retrievedAt, retrievalMs: numeric(root.retrieval_ms, 0, 60000, false) };
}

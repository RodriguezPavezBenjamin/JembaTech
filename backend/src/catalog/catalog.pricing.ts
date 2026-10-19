export const PRICE_TARGETS = [
  { id: 'cpu-7600', productId: 166287, label: 'AMD Ryzen 5 7600 · BOX', partNumber: '100-100001015BOX', url: 'https://publicapi.solotodo.com/entities/?products=166287&is_available=1&page_size=5' },
  { id: 'gpu-4060', productId: 211481, label: 'MSI RTX 4060 Ventus 2X Black 8G OC', partNumber: 'RTX 4060 VENTUS 2X BLACK 8G OC', url: 'https://publicapi.solotodo.com/entities/?products=211481&is_available=1&page_size=5' },
  { id: 'board-msi-b550-a-pro', productId: 85687, label: 'MSI B550-A PRO', partNumber: null, url: 'https://publicapi.solotodo.com/entities/?products=85687&is_available=1&page_size=5' },
  { id: 'ram-kingston-ddr4-rgb-16', productId: 118735, label: 'Kingston FURY Beast RGB · 16 GB (2 × 8)', partNumber: 'KF432C16BBAK2/16', url: 'https://publicapi.solotodo.com/entities/?products=118735&is_available=1&page_size=5' },
  { id: 'drive-kingston-a400-480', productId: 33675, label: 'Kingston A400 · 480 GB · 2.5 pulgadas', partNumber: 'SA400S37/480G', url: 'https://publicapi.solotodo.com/entities/?products=33675&is_available=1&page_size=5' },
  { id: 'drive-samsung-990-pro-1000', productId: 157430, label: 'Samsung 990 PRO · 1 TB · sin disipador', partNumber: 'MZ-V9P1T0BW', url: 'https://publicapi.solotodo.com/entities/?products=157430&is_available=1&page_size=5' },
  { id: 'cpu-9600x', productId: 252401, label: 'AMD Ryzen 5 9600X · WOF', partNumber: '100-100001405WOF', url: 'https://publicapi.solotodo.com/entities/?products=252401&is_available=1&page_size=5' },
  { id: 'gpu-asrock-9060xt-16', productId: 278239, label: 'ASRock RX 9060 XT Challenger · 16 GB OC', partNumber: 'RX9060XT CL 16GO', url: 'https://publicapi.solotodo.com/entities/?products=278239&is_available=1&page_size=5' },
] as const;
export type PriceTarget = typeof PRICE_TARGETS[number];
export interface PriceIdentity { id: string; productId: number; label: string; partNumber: string | null; url: string; }
export interface PriceOffer {
  available: true; condition: 'new'; currency: 'CLP'; conditional: false;
  entityId: number; productId: number; storeId: number; storeHost: string; offerUrl: string;
  normalPriceClp: number; offerPriceClp: number; sourceUpdatedAt: string;
}
export interface ObservedPrice {
  kind: 'observed'; source: 'SoloTodo'; currency: 'CLP'; externalId: string; partNumber: string | null;
  storeHost: string; offerUrl: string; sourceUrl: string; observedAt: string; offerUpdatedAt: string;
  expiresAt: string; normalPriceClp: number; offerPriceClp: number; scope: 'first-page';
}
export type PriceInfo = ObservedPrice | { kind: 'estimated' | 'included' | 'unavailable' };
type Obj = Record<string, unknown>;
function obj(v: unknown): Obj { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid price object'); return v as Obj; }
function integer(v: unknown, max = 100_000_000): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0 || v > max) throw new Error('Invalid price number'); return v; }
function stamp(v: unknown): string {
  if (typeof v !== 'string' || v.length > 40 || !/(Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v))) throw new Error('Invalid price date');
  return new Date(v).toISOString();
}
export function offerHost(value: unknown) {
  if (typeof value !== 'string' || value.length > 2000 || /[\s\\\u0000-\u001f]/.test(value)) throw new Error('Invalid offer URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,63}$/.test(url.hostname) || /\.(local|localhost|invalid|internal)$/.test(url.hostname)) throw new Error('Unsafe offer URL');
  return url.hostname;
}
export function parsePrices(value: unknown, target: PriceIdentity, runId: string, startedAt: Date) {
  const r = obj(value), retrievedAt = stamp(r.retrievedAt);
  if (r.schemaVersion !== 'solotodo-prices-1' || r.target !== target.id || r.productId !== target.productId || r.requestId !== runId || r.sourceRequestUrl !== target.url || r.currency !== 'CLP' || r.scope !== 'first-page' || Date.parse(retrievedAt) < startedAt.getTime() - 60000 || Date.parse(retrievedAt) > Date.now() + 300000 || !Array.isArray(r.offers) || !Array.isArray(r.issues) || typeof r.received !== 'number' || !Number.isInteger(r.received) || r.received < 0 || r.received > 5 || r.rejected !== r.issues.length || r.offers.length + r.issues.length !== r.received) throw new Error('Invalid price provenance');
  const seen = new Set<number>();
  const offers: PriceOffer[] = r.offers.map(value => {
    const o = obj(value), id = integer(o.entityId, Number.MAX_SAFE_INTEGER), updated = stamp(o.sourceUpdatedAt);
    const host = offerHost(o.offerUrl), normal = integer(o.normalPriceClp), offer = integer(o.offerPriceClp);
    if (seen.has(id) || o.productId !== target.productId || o.available !== true || o.condition !== 'new' || o.currency !== 'CLP' || o.conditional !== false || o.storeHost !== host || offer > normal || Date.parse(updated) < Date.parse(retrievedAt) - 86400000 || Date.parse(updated) > Date.parse(retrievedAt) + 300000) throw new Error('Invalid price offer');
    seen.add(id);
    return { entityId: id, productId: target.productId, storeId: integer(o.storeId), storeHost: host, offerUrl: o.offerUrl as string, normalPriceClp: normal, offerPriceClp: offer, sourceUpdatedAt: updated, available: true, condition: 'new', currency: 'CLP', conditional: false };
  });
  const issues = r.issues.map(value => { const i = obj(value); if (i.code !== 'ineligible_offer' || typeof i.index !== 'number' || !Number.isInteger(i.index) || i.index < 0 || i.index >= (r.received as number)) throw new Error('Invalid price issue'); return { index: i.index, code: 'ineligible_offer' }; });
  if (new Set(issues.map(i => i.index)).size !== issues.length) throw new Error('Repeated price issue');
  return { schemaVersion: 'solotodo-prices-1', target: target.id, productId: target.productId, requestId: runId, sourceRequestUrl: target.url, currency: 'CLP', scope: 'first-page', retrievedAt, offers, issues, received: r.received as number, rejected: issues.length };
}
export function observedPrice(target: PriceIdentity, result: ReturnType<typeof parsePrices>): ObservedPrice | null {
  const selected = [...result.offers].sort((a, b) => a.normalPriceClp - b.normalPriceClp || a.entityId - b.entityId)[0];
  if (!selected) return null;
  return { kind: 'observed', source: 'SoloTodo', currency: 'CLP', externalId: String(target.productId), partNumber: target.partNumber,
    storeHost: selected.storeHost, offerUrl: selected.offerUrl, sourceUrl: `https://www.solotodo.cl/products/${target.productId}`,
    observedAt: result.retrievedAt, offerUpdatedAt: selected.sourceUpdatedAt,
    expiresAt: new Date(Math.min(Date.parse(result.retrievedAt), Date.parse(selected.sourceUpdatedAt)) + 86400000).toISOString(),
    normalPriceClp: selected.normalPriceClp, offerPriceClp: selected.offerPriceClp, scope: 'first-page' };
}

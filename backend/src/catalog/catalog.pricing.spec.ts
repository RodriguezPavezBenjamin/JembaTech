import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { of, throwError } from 'rxjs';
import { CatalogPricingService } from './catalog-pricing.service';
import { CatalogService } from './catalog.service';
import { observedPrice, parsePrices, PRICE_TARGETS } from './catalog.pricing';

const target = PRICE_TARGETS[0];
const runId = '11111111-1111-4111-8111-111111111111';
function offerUrlWithCredentials() {
  // Dato negativo efímero: no corresponde a un servicio real.
  const url = new URL('https://tienda.example.cl/producto');
  url.username = 'qa';
  url.password = randomBytes(16).toString('hex');
  return url.href;
}
function payload() {
  const now = new Date().toISOString();
  return { schemaVersion: 'solotodo-prices-1', target: target.id, productId: target.productId, requestId: runId,
    sourceRequestUrl: target.url, retrievedAt: now, currency: 'CLP', scope: 'first-page', received: 1, rejected: 0, issues: [],
    offers: [{ entityId: 123, productId: target.productId, storeId: 12, storeHost: 'tienda.example.cl', offerUrl: 'https://tienda.example.cl/producto', normalPriceClp: 230000, offerPriceClp: 210000, sourceUpdatedAt: now, available: true, condition: 'new', currency: 'CLP', conditional: false }] };
}
describe('Precios consultados: identidad, procedencia y conservación', () => {
  it('rechaza credenciales efímeras sin cambiar el host ni invalidar otros atributos', () => {
    const data = payload();
    expect(() => parsePrices(data, target, runId, new Date())).not.toThrow();
    data.offers[0].offerUrl = offerUrlWithCredentials();
    expect(new URL(data.offers[0].offerUrl).hostname).toBe(data.offers[0].storeHost);
    expect(() => parsePrices(data, target, runId, new Date())).toThrow('Unsafe offer URL');
  });
  it('coinciden las ocho URLs cerradas Python/NestJS y cada ID existe en el catálogo', () => {
    const python = readFileSync('../python-service/solotodo_prices.py', 'utf8');
    const products = new CatalogService().list().products;
    for (const t of PRICE_TARGETS) { expect(python).toContain(`'${t.id}': (${t.productId}, '${t.url}')`); expect(products.some(p => p.id === t.id)).toBe(true); }
  });
  it('elige el menor precio NORMAL solo entre ofertas de esta página; no el efectivo ni un mínimo global', () => {
    const data = payload(); data.received = 2;
    data.offers.push({ ...data.offers[0], entityId: 124, normalPriceClp: 225000, offerPriceClp: 220000 });
    const result = parsePrices(data, target, runId, new Date());
    expect(observedPrice(target, result)).toMatchObject({ normalPriceClp: 225000, offerPriceClp: 220000, scope: 'first-page' });
  });
  it.each([
    ['productId', 151869], ['currency', 'USD'], ['available', false], ['condition', 'used'], ['conditional', true],
    ['normalPriceClp', '230000'], ['normalPriceClp', 0], ['offerPriceClp', 999999], ['storeId', true],
    ['offerUrl', 'http://127.0.0.1/'], ['offerUrl', offerUrlWithCredentials()], ['offerUrl', 'https://example.local/x'],
    ['sourceUpdatedAt', '2026-01-01T00:00:00Z'], ['sourceUpdatedAt', '2099-01-01T00:00:00Z'],
  ])('rechaza atributo de oferta inválido: %s', (field, value) => {
    const data = payload(); Object.assign(data.offers[0], { [field as string]: value });
    expect(() => parsePrices(data, target, runId, new Date())).toThrow();
  });
  it('rechaza URL/fecha/requestId ajenos y repetidos, no acepta un mínimo global inventado', () => {
    for (const change of [{ sourceRequestUrl: 'https://localhost/' }, { requestId: 'different' }, { retrievedAt: '2099-01-01T00:00:00Z' }, { received: 6 }, { scope: 'entire-market' }]) expect(() => parsePrices({ ...payload(), ...change }, target, runId, new Date())).toThrow();
    const data = payload(); data.received = 2; data.offers.push({ ...data.offers[0] });
    expect(() => parsePrices(data, target, runId, new Date())).toThrow();
  });
  it('página sin ofertas válidas produce ausencia de precio, no cero', () => {
    const data = { ...payload(), received: 1, rejected: 1, offers: [], issues: [{ index: 0, code: 'ineligible_offer' }] };
    expect(observedPrice(target, parsePrices(data, target, runId, new Date()))).toBeNull();
  });
  function setup() {
    const prisma = { sourceRun: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 0 }), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: runId, startedAt: new Date() }), update: jest.fn().mockResolvedValue({}) } };
    const http = { post: jest.fn().mockReturnValue(of({ data: payload() })) };
    return { prisma, http, pricing: new CatalogPricingService(prisma as never, http as never) };
  }
  it('aplica el precio en listado y resolución del servidor sin mutar productos o cotizaciones', async () => {
    const { prisma, pricing } = setup();
    prisma.sourceRun.findMany.mockResolvedValue([{ id: runId, startedAt: new Date(), metrics: { priceQuote: payload() } }]);
    await pricing.onModuleInit();
    const catalog = new CatalogService(pricing);
    expect(catalog.list().source).toBe('reference-mixed-prices');
    const resolved = catalog.resolve({ budget: 1000000, intendedUse: 'gaming', cpu: target.id, drives: [], extras: [] });
    expect(resolved.components[0]).toMatchObject({ price: 230000, quantity: 1, priceInfo: { kind: 'observed', normalPriceClp: 230000 } });
    expect(new CatalogService().resolve({ budget: 1000000, intendedUse: 'gaming', cpu: target.id, drives: [], extras: [] }).components[0].price).toBe(209990);
    expect(Object.keys(prisma)).not.toContain('quote');
  });
  it('oferta vencida o última consulta vacía no revive un precio antiguo', async () => {
    const { prisma, pricing } = setup();
    const old = payload(); old.retrievedAt = new Date(Date.now() - 86400001).toISOString(); old.offers[0].sourceUpdatedAt = old.retrievedAt;
    prisma.sourceRun.findMany.mockResolvedValue([{ id: runId, startedAt: new Date(old.retrievedAt), metrics: { priceQuote: old } }]); await pricing.onModuleInit();
    expect(new CatalogService(pricing).list().products.find(p => p.id === target.id)?.priceInfo?.kind).toBe('estimated');
    const fresh = payload();
    prisma.sourceRun.findMany.mockResolvedValue([{ id: runId, startedAt: new Date(), metrics: { priceQuote: { ...fresh, offers: [], received: 0, rejected: 0 } } }, { id: runId, startedAt: new Date(), metrics: { priceQuote: fresh } }]);
    const restarted = new CatalogPricingService(prisma as never, {} as never); await restarted.onModuleInit();
    expect(new CatalogService(restarted).list().products.find(p => p.id === target.id)?.priceInfo?.kind).toBe('estimated');
  });
  it('exige confirmación/habilitación, comparte cooldown y conserva auditoría de fallos sin cambiar el catálogo', async () => {
    const previousEnabled = process.env.SOLOTODO_MANUAL_PROBE_ENABLED, previousToken = process.env.SOURCE_INTERNAL_TOKEN;
    try {
      const { prisma, http, pricing } = setup();
      await expect(pricing.recover(target.id, false, 'qa')).rejects.toThrow(); expect(http.post).not.toHaveBeenCalled();
      process.env.SOLOTODO_MANUAL_PROBE_ENABLED = 'true'; process.env.SOURCE_INTERNAL_TOKEN = 'a'.repeat(64);
      prisma.sourceRun.findFirst.mockResolvedValue({ startedAt: new Date() });
      await expect(pricing.recover(target.id, true, 'qa')).rejects.toThrow(); expect(http.post).not.toHaveBeenCalled();
      prisma.sourceRun.findFirst.mockResolvedValue(null); http.post.mockReturnValue(throwError(() => new Error('private error')));
      await expect(pricing.recover(target.id, true, 'qa')).rejects.toThrow('No se cambió');
      expect(prisma.sourceRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', errorCode: 'PYTHON_UNAVAILABLE' }) }));
      http.post.mockReturnValue(of({ data: payload() }));
      const result = await pricing.recover(target.id, true, 'qa'); expect(result.applied).toBe(true);
      expect(prisma.sourceRun.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED', metrics: expect.objectContaining({ kind: 'price-quote' }) }) }));
    } finally {
      if (previousEnabled === undefined) delete process.env.SOLOTODO_MANUAL_PROBE_ENABLED; else process.env.SOLOTODO_MANUAL_PROBE_ENABLED = previousEnabled;
      if (previousToken === undefined) delete process.env.SOURCE_INTERNAL_TOKEN; else process.env.SOURCE_INTERNAL_TOKEN = previousToken;
    }
  });
});

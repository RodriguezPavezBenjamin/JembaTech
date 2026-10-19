import { of, throwError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { CatalogImportService } from './catalog-import.service';
import { CATALOG_CAPS, CATALOG_TARGETS, catalogUrl, parseCatalog } from './catalog.import';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma.service';

const runId = '11111111-1111-4111-8111-111111111111';
function batch() {
  const now = new Date().toISOString(), target = CATALOG_TARGETS.find(t => t.id === 'cpu-intel-11')!;
  return { schemaVersion: 'solotodo-catalog-1', target: target.id, requestId: runId, sourceRequestUrl: catalogUrl(target), retrievedAt: now, received: 1, issues: [], products: [{ id: 'solotodo-cpu-115591', externalId: 115591, category: 'cpu', name: 'Intel Core i9-11900 [BX8070811900]', description: 'LGA1200 · 8 núcleos / 16 hilos', image: 'https://media.solotodo.com/media/products/1422914_picture_1626472440.jpg', partNumber: 'BX8070811900', specs: { brand: 'Intel', socket: 'LGA1200', ramTypes: ['DDR4'], cores: 8, threads: 16, integrated: true, stockCooler: true, power: 300, declaredTdpWatts: 65, unverified: [], mountNote: 'Consumo estimado, no TDP máximo.' }, prices: { schemaVersion: 'solotodo-prices-1', target: 'solotodo-cpu-115591', productId: 115591, sourceRequestUrl: 'https://publicapi.solotodo.com/entities/?products=115591&is_available=1&page_size=5', retrievedAt: now, currency: 'CLP', scope: 'first-page', received: 1, rejected: 0, issues: [], offers: [{ entityId: 1, productId: 115591, storeId: 1, storeHost: 'tienda.example.cl', offerUrl: 'https://tienda.example.cl/p', normalPriceClp: 100000, offerPriceClp: 99000, sourceUpdatedAt: now, available: true, condition: 'new', currency: 'CLP', conditional: false }] } }] };
}
function dependencies() {
  const startedAt = new Date();
  const prisma = { sourceRun: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 0 }), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: runId, startedAt }), update: jest.fn().mockResolvedValue({}) } };
  const http = { post: jest.fn().mockReturnValue(of({ data: batch(), status: 200 })) };
  const service = new CatalogImportService(prisma as unknown as PrismaService, http as unknown as HttpService);
  return { prisma, http, service, startedAt };
}
describe('Catálogo SoloTodo: importación acotada', () => {
  const enabled = process.env.SOLOTODO_MANUAL_PROBE_ENABLED, token = process.env.SOURCE_INTERNAL_TOKEN;
  beforeEach(() => { process.env.SOLOTODO_MANUAL_PROBE_ENABLED = 'true'; process.env.SOURCE_INTERNAL_TOKEN = 'a'.repeat(64); });
  afterEach(() => { if (enabled === undefined) delete process.env.SOLOTODO_MANUAL_PROBE_ENABLED; else process.env.SOLOTODO_MANUAL_PROBE_ENABLED = enabled; if (token === undefined) delete process.env.SOURCE_INTERNAL_TOKEN; else process.env.SOURCE_INTERNAL_TOKEN = token; });
  it('mantiene topes por categoría y cuotas explícitas, no URLs libres', () => {
    for (const [category, cap] of Object.entries(CATALOG_CAPS)) expect(CATALOG_TARGETS.filter(t => t.category === category).reduce((sum, t) => sum + t.take, 0)).toBe(cap);
    expect(new Set(CATALOG_TARGETS.map(t => t.id)).size).toBe(CATALOG_TARGETS.length);
  });
  it('valida foto, modelo, oferta y precio normal de una CPU Intel 11', () => {
    const result = parseCatalog(batch(), 'cpu-intel-11', runId, new Date());
    expect(result.products[0]).toMatchObject({ id: 'solotodo-cpu-115591', price: 100000, priceInfo: { kind: 'observed', externalId: '115591', source: 'SoloTodo' }, specs: { socket: 'LGA1200', ramTypes: ['DDR4'] } });
  });
  it('admite fotografías AVIF del mismo proveedor en el contrato actual', () => {
    const data = batch(); data.schemaVersion = 'solotodo-catalog-2'; data.products[0].image = 'https://media.solotodo.com/media/products/1422914_picture_1626472440.avif';
    expect(parseCatalog(data, 'cpu-intel-11', runId, new Date()).products[0].image).toContain('.avif');
  });
  it('acepta el lote acotado v3 y rechaza exceder 25 candidatas CPU', () => {
    const data = { ...batch(), schemaVersion: 'solotodo-catalog-3', received: 25, issues: Array.from({ length: 24 }, (_, index) => ({ index: index + 1, code: 'candidate_limit' })) };
    expect(parseCatalog(data, 'cpu-intel-11', runId, new Date()).received).toBe(25);
    data.received = 26; data.issues.push({ index: 25, code: 'candidate_limit' });
    expect(() => parseCatalog(data, 'cpu-intel-11', runId, new Date())).toThrow();
  });
  it('restaura la URL cerrada anterior, sin aceptar un tamaño arbitrario', () => {
    const data = batch();
    data.sourceRequestUrl = data.sourceRequestUrl.replace('&page_size=25', '&ordering=-id&page_size=5');
    expect(parseCatalog(data, 'cpu-intel-11', runId, new Date()).products).toHaveLength(1);
    data.sourceRequestUrl = data.sourceRequestUrl.replace('page_size=5', 'page_size=500');
    expect(() => parseCatalog(data, 'cpu-intel-11', runId, new Date())).toThrow();
  });
  it('no ofrece cooler gratis para una presentación Tray aunque la ficha de familia lo diga', () => {
    const data = batch(); data.products[0].name += ' Tray';
    expect(parseCatalog(data, 'cpu-intel-11', runId, new Date()).products[0].specs.stockCooler).toBe(false);
  });
  it.each(['image', 'mobile', 'target', 'price', 'socket', 'platform', 'replay', 'duplicate'])('rechaza datos manipulados: %s', mutation => {
    const data = batch();
    if (mutation === 'image') data.products[0].image = 'https://media.solotodo.com@evil.test/image.png';
    if (mutation === 'mobile') data.products[0].name = 'Intel Core i9-11900H';
    if (mutation === 'target') data.sourceRequestUrl = 'https://127.0.0.1/private';
    if (mutation === 'price') data.products[0].prices.offers[0].normalPriceClp = 0;
    if (mutation === 'socket') data.products[0].specs.socket = 'BGA1440';
    if (mutation === 'platform') data.products[0].specs.socket = 'LGA1700';
    if (mutation === 'replay') data.requestId = 'other-run';
    if (mutation === 'duplicate') { data.products.push(structuredClone(data.products[0])); data.received++; }
    expect(() => parseCatalog(data, 'cpu-intel-11', runId, new Date())).toThrow();
  });
  it('exige confirmación, habilitación y espera global sin llamar Python', async () => {
    const { service, prisma, http } = dependencies();
    await expect(service.recover('cpu-intel-11', false, 'admin')).rejects.toThrow();
    await expect(service.recover('https://evil.test', true, 'admin')).rejects.toThrow();
    process.env.SOLOTODO_MANUAL_PROBE_ENABLED = 'false';
    await expect(service.recover('cpu-intel-11', true, 'admin')).rejects.toThrow();
    process.env.SOLOTODO_MANUAL_PROBE_ENABLED = 'true';
    prisma.sourceRun.findFirst.mockResolvedValue({ startedAt: new Date() });
    await expect(service.recover('cpu-intel-11', true, 'admin')).rejects.toThrow();
    expect(http.post).not.toHaveBeenCalled();
  });
  it('persiste antes de publicar, conserva IDs antiguos y bloquea el precio vencido', async () => {
    const { service, prisma } = dependencies();
    await service.recover('cpu-intel-11', true, 'admin');
    expect(prisma.sourceRun.update.mock.calls[0][0].data.metrics.kind).toBe('armador-catalog');
    const catalog = new CatalogService(undefined, service);
    expect(catalog.list().products.find(p => p.id === 'cpu-7600')?.specs.legacy).toBe(true);
    expect(catalog.resolve({ budget: 1000000, intendedUse: 'gaming', cpu: 'solotodo-cpu-115591', drives: [], extras: [] }).components[0].price).toBe(100000);
    jest.useFakeTimers(); jest.setSystemTime(Date.now() + 86400001);
    try { expect(catalog.list().products.find(p => p.id === 'solotodo-cpu-115591')?.priceInfo?.kind).toBe('unavailable'); expect(() => catalog.resolve({ budget: 1000000, intendedUse: 'gaming', cpu: 'solotodo-cpu-115591', drives: [], extras: [] })).toThrow('venció'); } finally { jest.useRealTimers(); }
  });
  it('restaura desde auditoría válida al reiniciar y no realiza red al listar', async () => {
    const { service, prisma, http, startedAt } = dependencies();
    prisma.sourceRun.findMany.mockResolvedValue([{ id: runId, startedAt, metrics: { catalogBatch: batch() } }]);
    await service.onModuleInit();
    expect(service.overview().counts.cpu).toBe(1);
    service.merge([]); service.merge([]);
    expect(http.post).not.toHaveBeenCalled();
  });
  it('un fallo de persistencia o proveedor no publica candidatos', async () => {
    const { service, prisma, http } = dependencies();
    prisma.sourceRun.update.mockRejectedValueOnce(new Error('database'));
    await expect(service.recover('cpu-intel-11', true, 'admin')).rejects.toThrow();
    expect(service.overview().counts.cpu).toBe(0);
    http.post.mockReturnValue(throwError(() => new Error('offline')));
    await expect(service.recover('cpu-intel-11', true, 'admin')).rejects.toThrow();
    expect(service.overview().counts.cpu).toBe(0);
  });
});

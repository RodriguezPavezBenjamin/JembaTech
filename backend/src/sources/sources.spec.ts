import { HttpService } from '@nestjs/axios';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { PrismaService } from '../prisma.service';
import { SourcesService } from './sources.service';
import { parseCpuRecovery, parseCpuResult } from './source.contract';

const stamp = '2026-01-01T12:00:00Z';
function response() {
  return {
    schema_version: 'solotodo-cpu-1', access_status: 'reuse-not-confirmed',
    products: [{ source: 'solotodo', external_id: '123', category: 'cpu', name: 'CPU QA', brand: 'AMD', part_number: null,
      socket: 'AM4', cores: 6, threads: 12, declared_tdp_watts: 65, price_clp: null,
      source_url: 'https://www.solotodo.cl/products/123', retrieved_at: stamp, source_updated_at: null, content_hash: 'a'.repeat(64) }],
    issues: [], metrics: { received: 1, accepted: 1, rejected: 0, duplicates: 0, valid_percent: 100, duplicate_percent: 0, missing_tdp: 0, processing_ms: 1 },
  };
}

describe('Contrato CPU Python-NestJS', () => {
  it('solo proyecta campos permitidos, sin inventar precio ni vínculo al catálogo', () => {
    const data = response();
    Object.assign(data.products[0], { password: 'never-copy' });
    const result = parseCpuResult(data, 1, stamp);
    expect(result.products[0]).toMatchObject({ externalId: '123', name: 'CPU QA', specs: { socket: 'AM4' } });
    expect(JSON.stringify(result)).not.toContain('never-copy');
    expect(result.products[0]).not.toHaveProperty('price');
    expect(result.products[0]).not.toHaveProperty('internalCatalogId');
  });
  it.each([
    ['source_url', 'https://evil.test/123'], ['content_hash', 'bad'],
    ['retrieved_at', '2020-01-01T00:00:00Z'], ['source_updated_at', '2099-01-01T00:00:00Z'],
    ['cores', -1], ['threads', 1], ['price_clp', 1000], ['name', '<script>x</script>'],
  ])('rechaza respuesta inválida en %s', (field, value) => {
    const data = response();
    Object.assign(data.products[0], { [field]: value });
    expect(() => parseCpuResult(data, 1, stamp)).toThrow();
  });
  it('rechaza métricas falsas y productos duplicados', () => {
    const data = response();
    data.metrics.valid_percent = 80;
    expect(() => parseCpuResult(data, 1, stamp)).toThrow();
    const repeated = response(); repeated.products.push(repeated.products[0]);
    expect(() => parseCpuResult(repeated, 2, stamp)).toThrow();
  });
  it('acepta lote rechazado con incidencia raíz, sin almacenar fichas', () => {
    const data = { ...response(), products: [], issues: [{ index: 0, code: 'invalid_record', fields: ['$'] }], metrics: { received: 1, accepted: 0, rejected: 1, duplicates: 0, valid_percent: 0, duplicate_percent: 0, missing_tdp: 0, processing_ms: 1 } };
    expect(parseCpuResult(data, 1, stamp).products).toHaveLength(0);
  });
});

describe('Muestras privadas y persistencia', () => {
  const http = { post: jest.fn() };
  const sourceRun = { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() };
  const externalReference = { upsert: jest.fn(), updateMany: jest.fn() };
  const prisma = { sourceRun, externalReference, $transaction: jest.fn() };
  const service = new SourcesService(http as unknown as HttpService, prisma as unknown as PrismaService);
  const sample = { retrievedAt: stamp, records: [{ id: 123 }] };
  beforeEach(() => {
    jest.clearAllMocks();
    http.post.mockReturnValue(of({ data: response() }));
    sourceRun.create.mockImplementation(async args => ({ id: 'run', startedAt: new Date(), ...args.data }));
    sourceRun.findFirst.mockResolvedValue(null);
    sourceRun.updateMany.mockResolvedValue({ count: 0 });
    sourceRun.update.mockImplementation(async args => ({ id: 'run', ...args.data }));
    externalReference.upsert.mockResolvedValue({ id: 'reference' });
    externalReference.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async task => task(prisma));
  });
  it('pasa por Python con timeout, transacción y hash; no toca cotizaciones', async () => {
    const run = await service.prepareSample(sample, 'admin');
    expect(sourceRun.create.mock.calls[0][0].data).toMatchObject({ mode: 'manual-sample', createdById: 'admin' });
    expect(http.post.mock.calls[0][0]).toMatch(/\/sources\/solotodo\/cpu\/normalize$/);
    expect(http.post.mock.calls[0][1]).toEqual({ retrieved_at: stamp, results: sample.records });
    expect(http.post.mock.calls[0][2]).toMatchObject({ timeout: 5000 });
    expect(run).toMatchObject({ status: 'SUCCEEDED', storedCount: 1, staleSkipped: 0 });
    const write = externalReference.updateMany.mock.calls[0][0];
    expect(write.where.OR[0].retrievedAt.lt).toEqual(new Date(stamp));
    expect(write.where.OR[1].contentHash).toBe('a'.repeat(64));
    expect(write.data).not.toHaveProperty('internalCatalogId');
    expect(prisma).not.toHaveProperty('quote');
  });
  it('una muestra antigua se registra sin pisar la última ficha', async () => {
    externalReference.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.prepareSample(sample, 'admin')).toMatchObject({ storedCount: 0, staleSkipped: 1 });
  });
  it('Python caído queda auditado, no cambia fichas previas', async () => {
    http.post.mockReturnValue(throwError(() => new Error('sensitive diagnostic')));
    await expect(service.prepareSample(sample, 'admin')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(externalReference.upsert).not.toHaveBeenCalled();
    expect(sourceRun.update.mock.calls[0][0].data).toMatchObject({ status: 'FAILED', errorCode: 'PYTHON_UNAVAILABLE' });
  });
  it('respuesta inválida nunca llega a persistencia', async () => {
    http.post.mockReturnValue(of({ data: { products: [] } }));
    await expect(service.prepareSample(sample, 'admin')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sourceRun.update.mock.calls[0][0].data.errorCode).toBe('INVALID_PYTHON_RESPONSE');
  });
  it('rechaza identidades que Python no recibió en esta solicitud', async () => {
    await expect(service.prepareSample({ ...sample, records: [{ id: 456 }] }, 'admin')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('sin historial disponible no llama a Python ni modifica fichas', async () => {
    sourceRun.create.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.prepareSample(sample, 'admin')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(http.post).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('fallo de persistencia revierte la transacción y registra error seguro', async () => {
    prisma.$transaction.mockRejectedValue(new Error('database credentials must not leak'));
    await expect(service.prepareSample(sample, 'admin')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sourceRun.update.mock.calls[0][0].data.errorCode).toBe('PERSISTENCE_FAILED');
  });
  it('fecha futura o sin zona se rechaza antes de crear corrida', async () => {
    await expect(service.prepareSample({ ...sample, retrievedAt: '2099-01-01T00:00:00Z' }, 'admin')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.prepareSample({ ...sample, retrievedAt: '2026-01-01T12:00:00' }, 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(sourceRun.create).not.toHaveBeenCalled();
  });
});

describe('Recuperación API acotada y autenticada', () => {
  const previousEnabled = process.env.SOLOTODO_MANUAL_PROBE_ENABLED;
  const previousToken = process.env.SOURCE_INTERNAL_TOKEN;
  const runId = '11111111-1111-4111-8111-111111111111';
  const http = { post: jest.fn() };
  const sourceRun = { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() };
  const externalReference = { upsert: jest.fn(), updateMany: jest.fn() };
  const prisma = { sourceRun, externalReference, $transaction: jest.fn() };
  const service = new SourcesService(http as unknown as HttpService, prisma as unknown as PrismaService);
  const dto = { limit: 1, acknowledged: true };
  function recovered() {
    const retrieved_at = new Date().toISOString();
    const data = response(); data.products[0].retrieved_at = retrieved_at;
    return { ...data, retrieved_at, request_id: runId, source_request_url: 'https://api.solotodo.com/products/?categories=3&page_size=1', retrieval_ms: 12 };
  }
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SOLOTODO_MANUAL_PROBE_ENABLED = 'true';
    process.env.SOURCE_INTERNAL_TOKEN = 'b'.repeat(64);
    sourceRun.updateMany.mockResolvedValue({ count: 0 });
    sourceRun.findFirst.mockResolvedValue(null);
    sourceRun.create.mockImplementation(async args => ({ id: runId, startedAt: new Date(), ...args.data }));
    sourceRun.update.mockImplementation(async args => ({ id: runId, ...args.data }));
    externalReference.upsert.mockResolvedValue({ id: 'reference' });
    externalReference.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async task => task(prisma));
    http.post.mockImplementation(() => of({ data: recovered() }));
  });
  afterEach(() => {
    if (previousEnabled === undefined) delete process.env.SOLOTODO_MANUAL_PROBE_ENABLED; else process.env.SOLOTODO_MANUAL_PROBE_ENABLED = previousEnabled;
    if (previousToken === undefined) delete process.env.SOURCE_INTERNAL_TOKEN; else process.env.SOURCE_INTERNAL_TOKEN = previousToken;
  });
  it('sin habilitación ni clave real no consulta ni inicia auditoría', async () => {
    process.env.SOLOTODO_MANUAL_PROBE_ENABLED = 'false';
    await expect(service.recoverCpu(dto, 'admin')).rejects.toBeInstanceOf(ServiceUnavailableException);
    process.env.SOLOTODO_MANUAL_PROBE_ENABLED = 'true'; process.env.SOURCE_INTERNAL_TOKEN = 'generate_placeholder';
    await expect(service.recoverCpu(dto, 'admin')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sourceRun.create).not.toHaveBeenCalled(); expect(http.post).not.toHaveBeenCalled();
  });
  it('sin confirmación o con límite inválido no llama a Python', async () => {
    await expect(service.recoverCpu({ ...dto, acknowledged: false }, 'admin')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.recoverCpu({ ...dto, limit: 6 }, 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(http.post).not.toHaveBeenCalled();
  });
  it('registra origen y tiempos, transmite clave solo al servicio interno', async () => {
    const run = await service.recoverCpu(dto, 'admin');
    expect(run).toMatchObject({ status: 'SUCCEEDED', retrievalMs: 12, storedCount: 1 });
    expect(sourceRun.create.mock.calls[0][0].data).toMatchObject({ mode: 'manual-api', sourceRequestUrl: 'https://api.solotodo.com/products/?categories=3&page_size=1' });
    expect(http.post.mock.calls[0][1]).toEqual({ limit: 1, request_id: runId });
    expect(http.post.mock.calls[0][2]).toMatchObject({ timeout: 15000, headers: { 'X-Source-Token': 'b'.repeat(64) } });
    expect(externalReference.updateMany.mock.calls[0][0].data.acquisitionMode).toBe('manual-api');
    expect(JSON.stringify(run)).not.toContain('b'.repeat(64));
  });
  it('espera global de 60 segundos, sin tocar la red', async () => {
    sourceRun.findFirst.mockResolvedValue({ startedAt: new Date() });
    await expect(service.recoverCpu(dto, 'admin')).rejects.toMatchObject({ status: 429 });
    expect(http.post).not.toHaveBeenCalled(); expect(sourceRun.create).not.toHaveBeenCalled();
  });
  it('bloqueo de consulta concurrente no crea segundo acceso', async () => {
    sourceRun.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.recoverCpu(dto, 'admin')).rejects.toMatchObject({ status: 409 });
    expect(http.post).not.toHaveBeenCalled();
  });
  it('fuente denegada conserva fichas y no filtra diagnósticos o claves', async () => {
    http.post.mockReturnValue(throwError(() => ({ response: { data: { detail: { code: 'SOURCE_ACCESS_DENIED', secret: 'never-show' } } } })));
    await expect(service.recoverCpu(dto, 'admin')).rejects.toMatchObject({ response: { code: 'SOURCE_ACCESS_DENIED', runId } });
    expect(sourceRun.update.mock.calls[0][0].data).toMatchObject({ status: 'FAILED', errorCode: 'SOURCE_ACCESS_DENIED' });
    expect(externalReference.upsert).not.toHaveBeenCalled();
  });
  it('una respuesta de otro request o endpoint nunca llega a la base', async () => {
    const data = recovered(); data.request_id = 'other';
    http.post.mockReturnValue(of({ data }));
    await expect(service.recoverCpu(dto, 'admin')).rejects.toMatchObject({ response: { code: 'INVALID_PYTHON_RESPONSE' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    data.request_id = runId; data.source_request_url = 'https://evil.test/';
    expect(() => parseCpuRecovery(data, 1, runId, new Date())).toThrow();
  });
  it('acepta una página vacía sin fabricar productos o métricas', () => {
    const data = recovered();
    Object.assign(data, { products: [], metrics: { received: 0, accepted: 0, rejected: 0, duplicates: 0, valid_percent: 0, duplicate_percent: 0, missing_tdp: 0, processing_ms: 1 } });
    expect(parseCpuRecovery(data, 1, runId, new Date()).result.products).toHaveLength(0);
  });
});

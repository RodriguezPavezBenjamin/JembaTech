import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateSync } from 'class-validator';
import { PrismaService } from '../prisma.service';
import { SourcesService } from './sources.service';
import { parseComponentRecovery, parseComponentResult } from './source.contract';
import { ComponentRecoveryDto, ReferenceQueryDto } from './source.dto';
import { SOURCE_TARGETS, sourceTarget } from './source.targets';

const stamp = '2026-01-01T12:00:00Z';
const runId = '11111111-1111-4111-8111-111111111111';
function normalized(retrievedAt = stamp) {
  return {
    schema_version: 'solotodo-components-2', category: 'gpu', access_status: 'reuse-not-confirmed',
    products: [{ source: 'solotodo', external_id: '987', category: 'gpu', name: 'GPU QA', brand: 'Ensamblador QA', part_number: null,
      specs: { chip: 'NVIDIA RTX 5060 QA', chipBrand: 'NVIDIA', vramGb: 16, memoryType: 'GDDR6', declaredTdpWatts: 160, lengthMm: null, slots: 2, bus: null },
      price_clp: null, source_url: 'https://www.solotodo.cl/products/987', retrieved_at: retrievedAt, source_updated_at: null, content_hash: 'a'.repeat(64) }],
    issues: [], metrics: { received: 1, accepted: 1, rejected: 0, duplicates: 0, valid_percent: 100, duplicate_percent: 0, missing_tdp: 0, processing_ms: 1 },
  };
}

describe('Referencias CPU/GPU: contrato y selección', () => {
  it('preserva VRAM y ensamblador sin confundir el chip, descarta campos ajenos', () => {
    const value = normalized();
    Object.assign(value.products[0].specs, { image: 'never-copy' });
    const p = parseComponentResult(value, 1, stamp, 'gpu').products[0];
    expect(p.category).toBe('gpu'); expect(p.brand).toBe('Ensamblador QA');
    expect(p.specs).toMatchObject({ chipBrand: 'NVIDIA', vramGb: 16, lengthMm: null });
    expect(JSON.stringify(p)).not.toContain('never-copy');
    expect(p).not.toHaveProperty('internalCatalogId');
  });
  it.each([['vramGb', 0], ['vramGb', '16'], ['lengthMm', true], ['chipBrand', 'unknown'], ['slots', 0]])('rechaza atributo GPU %s inválido', (field, value) => {
    const data = normalized(); Object.assign(data.products[0].specs, { [field]: value });
    expect(() => parseComponentResult(data, 1, stamp, 'gpu')).toThrow();
  });
  it('rechaza mezcla de categorías, métricas falseadas y fechas futuras', () => {
    const data = normalized(); data.metrics.missing_tdp = 1;
    expect(() => parseComponentResult(data, 1, stamp, 'gpu')).toThrow();
    expect(() => parseComponentResult(normalized(), 1, stamp, 'cpu')).toThrow();
    const future = normalized(); Object.assign(future.products[0], { source_updated_at: '2099-01-01T00:00:00Z' });
    expect(() => parseComponentResult(future, 1, stamp, 'gpu')).toThrow();
  });
  it('selecciones Python/NestJS tienen exactamente las mismas URLs literales', () => {
    const python = readFileSync(join(__dirname, '../../..', 'python-service/probe_solotodo.py'), 'utf8');
    for (const target of SOURCE_TARGETS) {
      expect(python).toContain(`'${target.id}': ('${target.category}', '${sourceTarget(target.id)?.url}')`);
    }
    expect(sourceTarget('https://localhost/')).toBeNull();
    expect(validateSync(Object.assign(new ComponentRecoveryDto(), { target: '../cpu', acknowledged: true }))).not.toHaveLength(0);
    expect(validateSync(Object.assign(new ReferenceQueryDto(), { category: 'unknown' }))).not.toHaveLength(0);
  });
  it('verifica selección, URL, correlación, límite y categoría de adquisición', () => {
    const retrieved_at = new Date().toISOString();
    const data = { ...normalized(retrieved_at), target: 'rtx-5060', request_id: runId, retrieved_at, source_request_url: sourceTarget('rtx-5060')!.url, retrieval_ms: 2 };
    expect(parseComponentRecovery(data, 'rtx-5060', runId, new Date()).result.products).toHaveLength(1);
    for (const change of [{ target: 'rx-7600' }, { category: 'cpu' }, { request_id: 'other' }, { source_request_url: 'https://localhost/' }]) {
      expect(() => parseComponentRecovery({ ...data, ...change }, 'rtx-5060', runId, new Date())).toThrow();
    }
  });
});

describe('CPU/GPU comparten auditoría, cooldown y conservación', () => {
  const original = { enabled: process.env.SOLOTODO_MANUAL_PROBE_ENABLED, token: process.env.SOURCE_INTERNAL_TOKEN };
  const http = { post: jest.fn() };
  const sourceRun = { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() };
  const externalReference = { upsert: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(), count: jest.fn() };
  const prisma = { sourceRun, externalReference, $transaction: jest.fn() };
  const service = new SourcesService(http as unknown as HttpService, prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SOLOTODO_MANUAL_PROBE_ENABLED = 'true'; process.env.SOURCE_INTERNAL_TOKEN = 'b'.repeat(64);
    sourceRun.create.mockImplementation(async args => ({ id: runId, startedAt: new Date(), ...args.data }));
    sourceRun.findFirst.mockResolvedValue(null); sourceRun.updateMany.mockResolvedValue({ count: 0 });
    sourceRun.update.mockImplementation(async args => ({ id: runId, ...args.data }));
    externalReference.upsert.mockResolvedValue({ id: 'reference' });
    externalReference.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async task => typeof task === 'function' ? task(prisma) : Promise.all(task));
    http.post.mockImplementation(() => {
      const retrieved_at = new Date().toISOString();
      return of({ data: { ...normalized(retrieved_at), retrieved_at, request_id: runId, target: 'rtx-5060', source_request_url: sourceTarget('rtx-5060')!.url, retrieval_ms: 2 } });
    });
  });
  afterEach(() => {
    if (original.enabled === undefined) delete process.env.SOLOTODO_MANUAL_PROBE_ENABLED; else process.env.SOLOTODO_MANUAL_PROBE_ENABLED = original.enabled;
    if (original.token === undefined) delete process.env.SOURCE_INTERNAL_TOKEN; else process.env.SOURCE_INTERNAL_TOKEN = original.token;
  });
  it('persiste GPU sin cambiar cotizaciones ni correspondencias del catálogo', async () => {
    const result = await service.recoverComponents({ target: 'rtx-5060', acknowledged: true }, 'admin');
    expect(result.storedCount).toBe(1);
    expect(http.post.mock.calls[0][0]).toMatch(/components\/recover$/);
    expect(http.post.mock.calls[0][1]).toEqual({ target: 'rtx-5060', request_id: runId });
    expect(sourceRun.create.mock.calls[0][0].data.mode).toBe('manual-api');
    const write = externalReference.updateMany.mock.calls[0][0];
    expect(write.data.category).toBe('gpu'); expect(write.where.category).toBe('gpu');
    expect(write.data).not.toHaveProperty('internalCatalogId'); expect(prisma).not.toHaveProperty('quote');
  });
  it('rechaza URL/clave desconocida o falta de confirmación sin red', async () => {
    await expect(service.recoverComponents({ target: 'https://localhost/', acknowledged: true }, 'admin')).rejects.toMatchObject({ status: 400 });
    await expect(service.recoverComponents({ target: 'rtx-5060', acknowledged: false }, 'admin')).rejects.toMatchObject({ status: 400 });
    expect(sourceRun.create).not.toHaveBeenCalled(); expect(http.post).not.toHaveBeenCalled();
  });
  it('aplica cooldown global y bloqueo único a ambas categorías', async () => {
    sourceRun.findFirst.mockResolvedValueOnce({ startedAt: new Date() });
    await expect(service.recoverComponents({ target: 'rtx-5060', acknowledged: true }, 'admin')).rejects.toMatchObject({ status: 429 });
    expect(sourceRun.findFirst.mock.calls[0][0].where).toMatchObject({ mode: 'manual-api' });
    sourceRun.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.recoverComponents({ target: 'rtx-5060', acknowledged: true }, 'admin')).rejects.toMatchObject({ status: 409 });
    expect(http.post).not.toHaveBeenCalled();
  });
  it('un fallo no modifica fichas ni filtra diagnósticos', async () => {
    http.post.mockReturnValue(throwError(() => new Error('private diagnostic')));
    await expect(service.recoverComponents({ target: 'rtx-5060', acknowledged: true }, 'admin')).rejects.toMatchObject({ response: { code: 'PYTHON_UNAVAILABLE' } });
    expect(externalReference.upsert).not.toHaveBeenCalled();
  });
  it('normaliza muestra GPU declarada sin convertirla en adquisición verificada', async () => {
    http.post.mockReturnValue(of({ data: normalized() }));
    const result = await service.prepareSample({ retrievedAt: stamp, records: [{ id: 987 }] }, 'admin', 'gpu');
    expect(result.status).toBe('SUCCEEDED');
    expect(http.post.mock.calls[0][1]).toMatchObject({ category: 'gpu' });
    expect(externalReference.updateMany.mock.calls[0][0].data.acquisitionMode).toBe('manual-sample');
  });
  it('filtra sobre PostgreSQL por categoría y chip además de ensamblador', async () => {
    externalReference.findMany.mockResolvedValue([]); externalReference.count.mockResolvedValue(0);
    await service.references({ page: 1, pageSize: 12, q: 'QA', category: 'gpu', brand: 'NVIDIA' });
    const where = externalReference.findMany.mock.calls[0][0].where;
    expect(where.category).toBe('gpu'); expect(where.AND[0].OR[1]).toEqual({ specs: { path: ['chipBrand'], equals: 'NVIDIA' } });
    expect(http.post).not.toHaveBeenCalled();
  });
});

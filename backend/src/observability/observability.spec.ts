import { Controller, Get, Param, ConflictException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { createRequestMiddleware, currentRequestId, pythonPost, RequestMetrics, withRequestId } from './observability';
import { SafeExceptionFilter } from './safe-exception.filter';

const secret = 'PRIVATE-QA-value-never-in-logs';
@Controller('test')
class TestController {
  @Get('wait/:milliseconds')
  async wait(@Param('milliseconds') milliseconds: string) {
    await new Promise(resolve => setTimeout(resolve, Math.min(50, Number(milliseconds))));
    return { requestId: currentRequestId() };
  }
  @Get('fail') fail() { throw new Error(secret); }
  @Get('conflict') conflict() { throw new ConflictException({ message: 'Estado cambiado', code: 'QA_CONFLICT' }); }
}

describe('Observabilidad HTTP sin datos privados', () => {
  let app: INestApplication;
  let origin: string;
  let metrics: RequestMetrics;
  let events: Array<Record<string, unknown>>;
  let output: jest.SpyInstance;
  beforeAll(async () => {
    metrics = new RequestMetrics();
    const module = await Test.createTestingModule({ controllers: [TestController] }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.use(createRequestMiddleware(metrics));
    app.useGlobalFilters(new SafeExceptionFilter());
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  beforeEach(() => {
    events = [];
    output = jest.spyOn(process.stdout, 'write').mockImplementation(((value: string) => {
      if (typeof value === 'string' && value.startsWith('{')) events.push(JSON.parse(value));
      return true;
    }) as never);
  });
  afterEach(() => output.mockRestore());
  afterAll(async () => { await app.close(); });

  it('genera ID, registra ruta plantilla y nunca query, credenciales o datos de cliente', async () => {
    const response = await fetch(`${origin}/api/test/wait/1?email=${secret}`, {
      headers: { 'X-Request-Id': secret, Authorization: `Bearer ${secret}` },
    });
    const id = response.headers.get('x-request-id');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await response.json()).requestId).toBe(id);
    expect(events[0]).toMatchObject({ event: 'http_request', route: '/api/test/wait/:milliseconds', status: 200 });
    expect(JSON.stringify(events)).not.toContain(secret);
    expect(JSON.stringify(metrics.snapshot())).not.toContain(secret);
  });
  it('mantiene IDs separados en solicitudes concurrentes y no deja contexto global', async () => {
    const ids = [randomUUID(), randomUUID()];
    const result = await Promise.all(ids.map(async (id, index) => {
      const response = await fetch(`${origin}/api/test/wait/${index ? 1 : 25}`, { headers: { 'X-Request-Id': id } });
      return (await response.json()).requestId;
    }));
    expect(result).toEqual(ids);
    expect(currentRequestId()).toBeNull();
  });
  it('conserva errores controlados y oculta excepciones inesperadas sin perder correlación', async () => {
    const failed = await fetch(`${origin}/api/test/fail`);
    expect(failed.status).toBe(500);
    expect(failed.headers.get('x-request-id')).toBeTruthy();
    expect(JSON.stringify(await failed.json())).not.toContain(secret);
    expect(JSON.stringify(events)).not.toContain(secret);
    expect(events.some(event => event.status === 500 && event.code === 'HTTP_SERVER_ERROR')).toBe(true);
    const controlled = await fetch(`${origin}/api/test/conflict`);
    expect(controlled.status).toBe(409);
    expect(await controlled.json()).toEqual({ message: 'Estado cambiado', code: 'QA_CONFLICT' });
  });
  it('una ruta inexistente se registra sin guardar la URL privada', async () => {
    const response = await fetch(`${origin}/api/${secret}`);
    expect(response.status).toBe(404);
    expect(events[0].route).toBe('unmatched');
    expect(JSON.stringify(events)).not.toContain(secret);
  });
  it('propaga el ID a Python sin eliminar la clave interna y clasifica timeouts sin copiar errores', async () => {
    const id = randomUUID();
    const post = jest.fn().mockReturnValue(of({ data: {}, status: 200, headers: { 'x-request-id': id } }));
    await withRequestId(id, () => pythonPost({ post } as never, 'http://python/builds/preview', {}, { timeout: 5000, headers: { 'X-Source-Token': secret } }));
    expect(post.mock.calls[0][2].headers).toMatchObject({ 'X-Request-Id': id, 'X-Source-Token': secret });
    expect(events[0]).toMatchObject({ requestId: id, event: 'python_request', correlated: true, status: 200 });
    post.mockReturnValue(throwError(() => ({ code: 'ECONNABORTED', message: secret })));
    await expect(withRequestId(id, () => pythonPost({ post } as never, 'http://python/evaluate', {}, { timeout: 10 }))).rejects.toMatchObject({ code: 'ECONNABORTED' });
    expect(events.at(-1)).toMatchObject({ code: 'PYTHON_TIMEOUT', status: 0 });
    expect(JSON.stringify(events)).not.toContain(secret);
  });
  it('conserva la correlación de una respuesta de error de Python', async () => {
    const id = randomUUID();
    const post = jest.fn().mockReturnValue(throwError(() => ({
      response: { status: 503, headers: { 'x-request-id': id }, data: { private: secret } },
    })));
    await expect(withRequestId(id, () => pythonPost({ post } as never, 'http://python/evaluate', {}, { timeout: 10 }))).rejects.toBeTruthy();
    expect(events[0]).toMatchObject({ requestId: id, status: 503, correlated: true, code: 'PYTHON_HTTP_ERROR' });
    expect(JSON.stringify(events)).not.toContain(secret);
  });
});

describe('Métricas por proceso', () => {
  it('calcula promedio/máximo y distingue errores/abortos', () => {
    const metrics = new RequestMetrics();
    metrics.record('inbound', 'GET /health', 10, 200);
    metrics.record('inbound', 'GET /health', 30, 503);
    metrics.record('inbound', 'GET /health', 20, 0, true);
    expect(metrics.snapshot().inbound[0]).toMatchObject({ count: 3, errors: 2, aborted: 1, averageMs: 20, maxMs: 30 });
    expect(metrics.snapshot()).toMatchObject({ resetsOnRestart: true, scope: 'single-process' });
  });
  it('limita cardinalidad y no expone su estado mutable', () => {
    const metrics = new RequestMetrics();
    for (let index = 0; index < 500; index++) metrics.record('inbound', String(index), 1, 404);
    expect(metrics.snapshot().inbound.length).toBeLessThanOrEqual(64);
    metrics.snapshot().inbound[0].count = 0;
    expect(metrics.snapshot().inbound[0].count).toBeGreaterThan(0);
  });
});

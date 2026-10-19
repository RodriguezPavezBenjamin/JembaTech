import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('Salud del stack sin exponer Python al público', () => {
  const prisma = { $queryRaw: jest.fn() };
  const previous = { ...process.env };
  let request: jest.SpyInstance;
  beforeEach(() => {
    prisma.$queryRaw.mockReset().mockResolvedValue([{ value: 1 }]);
    process.env.PYTHON_SERVICE_URL = 'http://evaluator.internal:8000/';
    process.env.RAILWAY_GIT_COMMIT_SHA = 'a'.repeat(40);
    request = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: 'ok', service: 'jemba-evaluator', commit: 'a'.repeat(40),
    }), { status: 200 }));
  });
  afterEach(() => { jest.restoreAllMocks(); process.env = { ...previous }; });
  const controller = () => new HealthController(prisma as never);

  it('comprueba SQL y salud Python con timeout y devuelve únicamente estado/versión', async () => {
    expect(await controller().check()).toEqual({ status: 'ok', service: 'jemba-api', database: 'ok',
      python: 'ok', commit: 'a'.repeat(40), pythonCommit: 'a'.repeat(40) });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('http://evaluator.internal:8000/health', expect.objectContaining({
      signal: expect.any(AbortSignal), redirect: 'error',
    }));
  });
  it('base caída no produce un falso verde ni filtra el error SQL', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('private-database-details'));
    await expect(controller().check()).rejects.toThrow(ServiceUnavailableException);
    await expect(controller().check()).rejects.not.toThrow('private-database-details');
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['network', 'status', 'contract', 'json'])('Python no disponible: %s', async scenario => {
    if (scenario === 'network') request.mockRejectedValue(new Error('private-internal-url'));
    else request.mockImplementation(async () => new Response(scenario === 'json' ? 'invalid' : JSON.stringify({
      status: scenario === 'contract' ? 'failed' : 'ok', service: 'jemba-evaluator',
    }), { status: scenario === 'status' ? 503 : 200 }));
    await expect(controller().check()).rejects.toThrow('Una dependencia');
  });
});

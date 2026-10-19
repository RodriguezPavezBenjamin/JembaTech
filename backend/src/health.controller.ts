import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const origin = process.env.PYTHON_SERVICE_URL || 'http://python-service:8000';
      const response = await fetch(`${origin.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(3000), redirect: 'error' });
      const python = await response.json();
      if (!response.ok || python.status !== 'ok' || python.service !== 'jemba-evaluator') throw new Error('Dependency unavailable');
      const commit = process.env.RAILWAY_GIT_COMMIT_SHA || '';
      return { status: 'ok', service: 'jemba-api', database: 'ok', python: 'ok',
        commit: /^[a-f0-9]{40}$/.test(commit) ? commit : 'local',
        pythonCommit: typeof python.commit === 'string' && /^[a-f0-9]{40}$/.test(python.commit) ? python.commit : 'local' };
    } catch {
      // Nunca publicar direcciones internas, errores SQL ni respuestas de dependencias.
      throw new ServiceUnavailableException('Una dependencia del servicio no esta disponible.');
    }
  }
}

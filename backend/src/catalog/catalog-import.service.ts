import { HttpService } from '@nestjs/axios';
import { BadRequestException, ConflictException, HttpException, Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { pythonPost } from '../observability/observability';
import { CATALOG_CAPS, CATALOG_TARGETS, catalogUrl, parseCatalog } from './catalog.import';
import { CatalogProduct } from './catalog.types';

@Injectable()
export class CatalogImportService implements OnModuleInit {
  private readonly products = new Map<string, CatalogProduct>();
  private readonly owners = new Map<string, string>();
  private readonly completed = new Map<string, { at: string; count: number; sourceRequestUrl: string; schemaVersion: string }>();
  constructor(private readonly prisma: PrismaService, private readonly http: HttpService) {}
  async onModuleInit() {
    const runs = await this.prisma.sourceRun.findMany({ where: { source: 'solotodo', mode: 'manual-api', status: 'SUCCEEDED', metrics: { path: ['kind'], equals: 'armador-catalog' } }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: 200 });
    for (const run of runs) {
      try {
        const raw = (run.metrics as Record<string, unknown>)?.catalogBatch as Record<string, unknown>;
        const batch = parseCatalog(raw, raw.target as string, run.id, run.startedAt);
        const latest = !this.completed.has(batch.target);
        if (latest) this.completed.set(batch.target, { at: batch.retrievedAt, count: batch.products.length, sourceRequestUrl: batch.sourceRequestUrl, schemaVersion: raw.schemaVersion as string });
        for (const product of batch.products) if (!this.products.has(product.id)) {
          this.products.set(product.id, latest ? product : { ...product, priceInfo: { kind: 'unavailable' }, specs: { ...product.specs, legacy: true } });
          this.owners.set(product.id, batch.target);
        }
      } catch { /* No publicar auditorías inválidas. */ }
    }
  }
  overview() {
    const counts = Object.fromEntries(Object.keys(CATALOG_CAPS).map(category => [category, [...this.products.values()].filter(p => p.category === category && !p.specs.legacy).length]));
    return { caps: CATALOG_CAPS, counts, targets: CATALOG_TARGETS.map(target => ({ ...target, schemaVersion: 'solotodo-catalog-3', sourceRequestUrl: catalogUrl(target), lastImport: this.completed.get(target.id) ?? null })) };
  }
  merge(manual: CatalogProduct[]): CatalogProduct[] {
    const counts: Record<string, number> = {};
    const imported = [...this.products.values()].map(product => {
      const count = counts[product.category] ?? 0;
      const hidden = !!product.specs.legacy || count >= CATALOG_CAPS[product.category];
      if (!hidden) counts[product.category] = count + 1;
      const fresh = product.priceInfo?.kind === 'observed' && Date.parse(product.priceInfo.expiresAt) > Date.now();
      return { ...product, priceInfo: fresh && !hidden ? product.priceInfo : { kind: 'unavailable' as const }, specs: { ...product.specs, ...(hidden ? { legacy: true } : {}) } };
    });
    const categories = new Set(imported.filter(p => !p.specs.legacy).map(p => p.category));
    return [...manual.map(p => categories.has(p.category) && !(p.category === 'gpu' && p.specs.integrated) ? { ...p, specs: { ...p.specs, legacy: true } } : p), ...imported];
  }
  async recover(targetId: string, acknowledged: boolean, userId: string) {
    const target = CATALOG_TARGETS.find(t => t.id === targetId);
    if (!target || acknowledged !== true) throw new BadRequestException('Confirma una importación de la selección disponible.');
    if (process.env.SOLOTODO_MANUAL_PROBE_ENABLED !== 'true' || !/^[a-f0-9]{64}$/.test(process.env.SOURCE_INTERNAL_TOKEN ?? '')) throw new ServiceUnavailableException({ code: 'MANUAL_PROBE_DISABLED' });
    const start = Date.now();
    await this.prisma.sourceRun.updateMany({ where: { source: 'solotodo', mode: 'manual-api', status: 'RUNNING', startedAt: { lt: new Date(start - 120000) } }, data: { status: 'FAILED', errorCode: 'INTERRUPTED', finishedAt: new Date() } });
    const recent = await this.prisma.sourceRun.findFirst({ where: { source: 'solotodo', mode: 'manual-api', startedAt: { gt: new Date(start - 60000) } }, orderBy: { startedAt: 'desc' } });
    if (recent) throw new HttpException({ code: 'SOURCE_COOLDOWN', nextAllowedAt: new Date(recent.startedAt.getTime() + 60000).toISOString() }, 429);
    let run;
    try { run = await this.prisma.sourceRun.create({ data: { source: 'solotodo', mode: 'manual-api', createdById: userId, retrievedAt: new Date(), sourceRequestUrl: catalogUrl(target) } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Hay una consulta a la fuente en proceso.'); throw new ServiceUnavailableException('No se pudo iniciar la auditoría; no se consultó la fuente.'); }
    let stage = 'PYTHON_UNAVAILABLE';
    try {
      const response = await pythonPost<unknown>(this.http, `${process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'}/sources/solotodo/catalog/recover`, { target: target.id, request_id: run.id }, { timeout: 75000, maxContentLength: 200000, headers: { 'X-Source-Token': process.env.SOURCE_INTERNAL_TOKEN } });
      stage = 'INVALID_CATALOG_RESPONSE';
      const result = parseCatalog(response.data, target.id, run.id, run.startedAt);
      stage = 'PERSISTENCE_FAILED';
      await this.prisma.sourceRun.update({ where: { id: run.id }, data: { status: 'SUCCEEDED', finishedAt: new Date(), retrievedAt: new Date(result.retrievedAt), durationMs: Date.now() - start, storedCount: result.products.length, metrics: { kind: 'armador-catalog', received: result.received, accepted: result.products.length, rejected: result.issues.length, duplicates: 0, missingTdp: 0, processingMs: 0, validPercent: result.received ? Math.round(result.products.length * 10000 / result.received) / 100 : 0, duplicatePercent: 0, catalogBatch: response.data } as Prisma.InputJsonValue, issues: result.issues } });
      for (const [id, owner] of this.owners) if (owner === target.id) {
        const previous = this.products.get(id)!;
        this.products.set(id, { ...previous, priceInfo: { kind: 'unavailable' }, specs: { ...previous.specs, legacy: true } });
      }
      for (const product of result.products) { this.products.set(product.id, product); this.owners.set(product.id, target.id); }
      this.completed.set(target.id, { at: result.retrievedAt, count: result.products.length, sourceRequestUrl: result.sourceRequestUrl, schemaVersion: (response.data as { schemaVersion: string }).schemaVersion });
      return { runId: run.id, target: target.id, received: result.received, imported: result.products.length, issues: result.issues, counts: this.overview().counts, historicalQuotesUpdated: false };
    } catch (error) {
      const code = (error as { response?: { data?: { detail?: { code?: string } } } }).response?.data?.detail?.code;
      if (stage === 'PYTHON_UNAVAILABLE' && ['SOURCE_RATE_LIMITED', 'SOURCE_ACCESS_DENIED', 'SOURCE_UNAVAILABLE', 'SOURCE_HTTP_ERROR', 'INVALID_SOURCE_CONTRACT', 'RESPONSE_TOO_LARGE'].includes(code ?? '')) stage = code!;
      await this.prisma.sourceRun.update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: new Date(), durationMs: Date.now() - start, errorCode: stage } });
      throw new ServiceUnavailableException({ code: stage, runId: run.id, message: 'No se reemplazó el catálogo anterior ni se reintentó la consulta.' });
    }
  }
}

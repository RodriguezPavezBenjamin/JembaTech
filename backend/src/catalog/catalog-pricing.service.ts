import { HttpService } from '@nestjs/axios';
import { BadRequestException, ConflictException, HttpException, Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { pythonPost } from '../observability/observability';
import { CatalogProduct } from './catalog.types';
import { ObservedPrice, observedPrice, parsePrices, PRICE_TARGETS } from './catalog.pricing';

@Injectable()
export class CatalogPricingService implements OnModuleInit {
  private readonly prices = new Map<string, ObservedPrice | null>();
  constructor(private readonly prisma: PrismaService, private readonly http: HttpService) {}
  async onModuleInit() {
    const runs = await this.prisma.sourceRun.findMany({ where: { source: 'solotodo', mode: 'manual-api', status: 'SUCCEEDED', metrics: { path: ['kind'], equals: 'price-quote' } }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: 200 });
    for (const run of runs) {
      try {
        const payload = (run.metrics as Record<string, unknown>)?.priceQuote as Record<string, unknown>;
        const target = PRICE_TARGETS.find(t => t.id === payload?.target);
        if (!target || this.prices.has(target.id)) continue;
        this.prices.set(target.id, null);
        this.prices.set(target.id, observedPrice(target, parsePrices(payload, target, run.id, run.startedAt)));
      } catch { /* Una auditoría inválida no se publica como precio. */ }
    }
  }
  apply(products: CatalogProduct[]): CatalogProduct[] {
    return products.map(product => {
      const price = this.prices.get(product.id);
      return price && Date.parse(price.expiresAt) > Date.now()
        ? { ...product, price: price.normalPriceClp, priceInfo: price }
        : { ...product, priceInfo: { kind: product.price === 0 ? 'included' : 'estimated' } };
    });
  }
  targets() { return PRICE_TARGETS.map(({ id, label, productId, partNumber }) => ({ id, label, productId, partNumber, priceInfo: this.prices.get(id) ?? null })); }
  async recover(targetId: string, acknowledged: boolean, userId: string) {
    const target = PRICE_TARGETS.find(t => t.id === targetId);
    if (!target || acknowledged !== true) throw new BadRequestException('Confirma una consulta de precio del modelo exacto.');
    if (process.env.SOLOTODO_MANUAL_PROBE_ENABLED !== 'true' || !/^[a-f0-9]{64}$/.test(process.env.SOURCE_INTERNAL_TOKEN ?? '')) throw new ServiceUnavailableException({ code: 'MANUAL_PROBE_DISABLED' });
    const start = Date.now();
    await this.prisma.sourceRun.updateMany({ where: { source: 'solotodo', mode: 'manual-api', status: 'RUNNING', startedAt: { lt: new Date(start - 120000) } }, data: { status: 'FAILED', errorCode: 'INTERRUPTED', finishedAt: new Date() } });
    const recent = await this.prisma.sourceRun.findFirst({ where: { source: 'solotodo', mode: 'manual-api', startedAt: { gt: new Date(start - 60000) } }, orderBy: { startedAt: 'desc' } });
    if (recent) throw new HttpException({ code: 'SOURCE_COOLDOWN', nextAllowedAt: new Date(recent.startedAt.getTime() + 60000).toISOString() }, 429);
    let run;
    try { run = await this.prisma.sourceRun.create({ data: { source: 'solotodo', mode: 'manual-api', createdById: userId, retrievedAt: new Date(), sourceRequestUrl: target.url } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Hay una consulta en proceso.'); throw new ServiceUnavailableException('No se pudo iniciar la auditoría; no se consultó la fuente.'); }
    let stage = 'PYTHON_UNAVAILABLE';
    try {
      const response = await pythonPost<unknown>(this.http, `${process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'}/sources/solotodo/prices/recover`, { target: target.id, request_id: run.id }, { timeout: 15000, maxContentLength: 100000, headers: { 'X-Source-Token': process.env.SOURCE_INTERNAL_TOKEN } });
      stage = 'INVALID_PRICE_RESPONSE';
      const result = parsePrices(response.data, target, run.id, run.startedAt);
      const price = observedPrice(target, result);
      stage = 'PERSISTENCE_FAILED';
      await this.prisma.sourceRun.update({ where: { id: run.id }, data: { status: 'SUCCEEDED', finishedAt: new Date(), retrievedAt: new Date(result.retrievedAt), durationMs: Date.now() - start, metrics: { kind: 'price-quote', received: result.received, accepted: result.offers.length, rejected: result.rejected, duplicates: 0, missingTdp: 0, processingMs: 0, validPercent: result.received ? Math.round(result.offers.length * 10000 / result.received) / 100 : 0, duplicatePercent: 0, priceQuote: result } as unknown as Prisma.InputJsonValue, issues: result.issues.map(i => ({ ...i, fields: ['price_or_conditions'] })) } });
      this.prices.set(target.id, price);
      return { runId: run.id, target: target.id, received: result.received, accepted: result.offers.length, rejected: result.rejected, priceInfo: price, applied: !!price && Date.parse(price.expiresAt) > Date.now() };
    } catch (error) {
      const code = (error as { response?: { data?: { detail?: { code?: string } } } }).response?.data?.detail?.code;
      if (stage === 'PYTHON_UNAVAILABLE' && ['SOURCE_RATE_LIMITED', 'SOURCE_ACCESS_DENIED', 'SOURCE_UNAVAILABLE', 'SOURCE_HTTP_ERROR', 'INVALID_SOURCE_CONTRACT', 'RESPONSE_TOO_LARGE'].includes(code ?? '')) stage = code!;
      await this.prisma.sourceRun.update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: new Date(), errorCode: stage, durationMs: Date.now() - start } });
      throw new ServiceUnavailableException({ code: stage, runId: run.id, message: 'No se cambió el precio anterior. Si vence, se mostrará la estimación manual.' });
    }
  }
}

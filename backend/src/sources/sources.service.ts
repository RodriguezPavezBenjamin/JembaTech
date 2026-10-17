import { HttpService } from "@nestjs/axios";
import { BadRequestException, ConflictException, HttpException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Prisma, SourceRun } from "@prisma/client";
import { currentRequestId, emitEvent, pythonPost } from "../observability/observability";
import { PrismaService } from "../prisma.service";
import { CpuRecoveryDto, CpuSampleDto, ReferenceQueryDto } from "./source.dto";
import { parseCpuRecovery, parseCpuResult } from "./source.contract";

@Injectable()
export class SourcesService {
  constructor(private readonly http: HttpService, private readonly prisma: PrismaService) {}

  async overview() {
    const [referenceCount, runCount, latestRun, latestProbe] = await Promise.all([
      this.prisma.externalReference.count({ where: { source: "solotodo" } }),
      this.prisma.sourceRun.count({ where: { source: "solotodo" } }),
      this.prisma.sourceRun.findFirst({ where: { source: "solotodo" }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], select: { id: true, mode: true, status: true, startedAt: true, metrics: true } }),
      this.prisma.sourceRun.findFirst({ where: { source: "solotodo", mode: "manual-api" }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], select: { startedAt: true, status: true } }),
    ]);
    return { source: "solotodo", accessStatus: "reuse-not-confirmed", mode: "on-demand-pilot", synchronizationEnabled: false, manualProbeEnabled: this.probeEnabled(), nextAllowedAt: latestProbe ? new Date(latestProbe.startedAt.getTime() + 60000).toISOString() : null, probeRunning: latestProbe?.status === "RUNNING" && latestProbe.startedAt.getTime() > Date.now() - 120000, referenceCount, runCount, latestRun };
  }

  async references(query: ReferenceQueryDto) {
    const q = query.q?.trim();
    const where: Prisma.ExternalReferenceWhereInput = {
      source: "solotodo", category: "cpu",
      ...(q ? { OR: ["name", "brand", "partNumber"].map(field => ({ [field]: { contains: q, mode: "insensitive" } })) } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.externalReference.findMany({ where, orderBy: [{ retrievedAt: "desc" }, { id: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.externalReference.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  runs() {
    return this.prisma.sourceRun.findMany({ where: { source: "solotodo" }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: 20, omit: { createdById: true } });
  }

  async prepareSample(dto: CpuSampleDto, userId: string) {
    const stamp = Date.parse(dto.retrievedAt);
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(dto.retrievedAt) || !Number.isFinite(stamp) || stamp > Date.now() + 300000) throw new BadRequestException("La fecha debe incluir zona horaria y no ser futura.");
    // El lote es una muestra declarada por admin, NO evidencia de adquisición verificada.
    let run: SourceRun;
    try {
      run = await this.prisma.sourceRun.create({ data: { source: "solotodo", mode: "manual-sample", createdById: userId, retrievedAt: new Date(stamp) } });
    } catch {
      throw new ServiceUnavailableException("No pudimos iniciar el registro de la muestra. No se procesaron ni modificaron fichas.");
    }
    const start = Date.now();
    this.log("sample_started", run.id);
    let stage = "PYTHON_UNAVAILABLE";
    try {
      const response = await pythonPost<unknown>(this.http,
        `${process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000"}/sources/solotodo/cpu/normalize`,
        { retrieved_at: dto.retrievedAt, results: dto.records }, { timeout: 5000, maxContentLength: 200000, maxBodyLength: 100000 },
      );
      stage = "INVALID_PYTHON_RESPONSE";
      const result = parseCpuResult(response.data, dto.records.length, dto.retrievedAt);
      const inputIds = new Set(dto.records.flatMap(row => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return [];
        const id = (row as Record<string, unknown>).id;
        return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? [String(id)] : [];
      }));
      if (result.products.some(p => !inputIds.has(p.externalId))) throw new Error("Unexpected response identity");
      stage = "PERSISTENCE_FAILED";
      const saved = await this.completeRun(run, result, new Date(stamp), null, start);
      this.log("sample_finished", run.id, { durationMs: Date.now() - start, accepted: result.metrics.accepted, stored: saved.storedCount });
      return saved;
    } catch {
      return this.failRun(run.id, stage, start);
    }
  }

  async recoverCpu(dto: CpuRecoveryDto, userId: string) {
    if (dto.acknowledged !== true || !Number.isInteger(dto.limit) || dto.limit < 1 || dto.limit > 5) throw new BadRequestException("Confirma la consulta puntual y elige de 1 a 5 fichas.");
    if (!this.probeEnabled()) throw new ServiceUnavailableException({ message: "La consulta puntual no está habilitada en este ambiente.", code: "MANUAL_PROBE_DISABLED" });
    const start = Date.now();
    // Recuperar auditorías interrumpidas, sin esperar indefinidamente un proceso caído.
    await this.prisma.sourceRun.updateMany({ where: { source: "solotodo", mode: "manual-api", status: "RUNNING", startedAt: { lt: new Date(start - 120000) } }, data: { status: "FAILED", finishedAt: new Date(), errorCode: "INTERRUPTED" } });
    const recent = await this.prisma.sourceRun.findFirst({ where: { source: "solotodo", mode: "manual-api", startedAt: { gt: new Date(start - 60000) } }, orderBy: { startedAt: "desc" } });
    if (recent) throw new HttpException({ message: "Espera un minuto entre consultas a la fuente.", code: "SOURCE_COOLDOWN", nextAllowedAt: new Date(recent.startedAt.getTime() + 60000).toISOString() }, 429);
    let run: SourceRun;
    try {
      run = await this.prisma.sourceRun.create({ data: { source: "solotodo", mode: "manual-api", createdById: userId, retrievedAt: new Date(), sourceRequestUrl: `https://api.solotodo.com/products/?categories=3&page_size=${dto.limit}` } });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("Ya hay una consulta a SoloTodo en proceso.");
      throw new ServiceUnavailableException("No pudimos iniciar la auditoría; no se consultó la fuente.");
    }
    this.log("recovery_started", run.id);
    let stage = "PYTHON_UNAVAILABLE";
    try {
      const response = await pythonPost<unknown>(this.http,
        `${process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000"}/sources/solotodo/cpu/recover`,
        { limit: dto.limit, request_id: run.id },
        { timeout: 15000, maxContentLength: 200000, headers: { "X-Source-Token": process.env.SOURCE_INTERNAL_TOKEN } },
      );
      stage = "INVALID_PYTHON_RESPONSE";
      const acquired = parseCpuRecovery(response.data, dto.limit, run.id, run.startedAt);
      stage = "PERSISTENCE_FAILED";
      const saved = await this.completeRun(run, acquired.result, new Date(acquired.retrievedAt), acquired.retrievalMs, start);
      this.log("recovery_finished", run.id, { durationMs: Date.now() - start, accepted: acquired.result.metrics.accepted, stored: saved.storedCount });
      return saved;
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: { code?: unknown } } } })?.response?.data?.detail?.code;
      const safeCodes = ["SOURCE_UNAVAILABLE", "SOURCE_RATE_LIMITED", "SOURCE_ACCESS_DENIED", "SOURCE_HTTP_ERROR", "INVALID_SOURCE_CONTRACT", "UNEXPECTED_CONTENT_TYPE", "RESPONSE_TOO_LARGE", "MANUAL_PROBE_DISABLED", "INTERNAL_AUTH_REQUIRED"];
      if (stage === "PYTHON_UNAVAILABLE" && typeof detail === "string" && safeCodes.includes(detail)) stage = detail;
      return this.failRun(run.id, stage, start);
    }
  }

  private probeEnabled() {
    return process.env.SOLOTODO_MANUAL_PROBE_ENABLED === "true" && /^[a-f0-9]{64}$/.test(process.env.SOURCE_INTERNAL_TOKEN ?? "");
  }

  private completeRun(run: SourceRun, result: ReturnType<typeof parseCpuResult>, retrievedAt: Date, retrievalMs: number | null, start: number) {
    return this.prisma.$transaction(async tx => {
        let storedCount = 0;
        let staleSkipped = 0;
        // Orden estable para reducir interbloqueos si llegan lotes concurrentes.
        for (const p of [...result.products].sort((a, b) => a.externalId.localeCompare(b.externalId))) {
          const data = {
            source: "solotodo", category: "cpu", externalId: p.externalId,
            name: p.name, brand: p.brand, partNumber: p.partNumber, specs: p.specs,
            sourceUrl: p.sourceUrl, retrievedAt: new Date(p.retrievedAt),
            sourceUpdatedAt: p.sourceUpdatedAt ? new Date(p.sourceUpdatedAt) : null,
            contentHash: p.contentHash, accessStatus: "reuse-not-confirmed", acquisitionMode: run.mode, lastRunId: run.id,
          };
          const reference = await tx.externalReference.upsert({ where: { source_externalId: { source: "solotodo", externalId: p.externalId } }, create: data, update: {} });
          // Una muestra antigua no pisa la ficha recuperada más recientemente.
          const updated = await tx.externalReference.updateMany({ where: { id: reference.id, ...(run.mode === "manual-sample" ? { acquisitionMode: { not: "manual-api" } } : {}), OR: [...(run.mode === "manual-api" ? [{ acquisitionMode: { not: "manual-api" } }] : []), { retrievedAt: { lt: data.retrievedAt } }, { retrievedAt: data.retrievedAt, contentHash: data.contentHash }] }, data });
          if (updated.count) storedCount++; else staleSkipped++;
        }
        return tx.sourceRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", finishedAt: new Date(), retrievedAt, retrievalMs, durationMs: Date.now() - start, metrics: result.metrics, issues: result.issues, storedCount, staleSkipped } });
    });
  }

  private async failRun(runId: string, stage: string, start: number): Promise<never> {
      // La transacción anterior revierte fichas parciales; conservar último dato válido.
      try { await this.prisma.sourceRun.update({ where: { id: runId }, data: { status: "FAILED", finishedAt: new Date(), errorCode: stage, durationMs: Date.now() - start } }); }
      catch { this.log("source_audit_failed", runId); }
      this.log("source_failed", runId, { code: stage, durationMs: Date.now() - start });
      throw new ServiceUnavailableException({ message: "No fue posible procesar la consulta. Las fichas anteriores siguen intactas.", runId, code: stage });
  }

  private log(event: string, runId: string, fields: Record<string, unknown> = {}) {
    emitEvent({ event, requestId: currentRequestId(), runId, source: "solotodo", ...fields });
  }
}

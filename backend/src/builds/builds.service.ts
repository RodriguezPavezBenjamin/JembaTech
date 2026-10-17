import { HttpService } from "@nestjs/axios";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { pythonPost } from "../observability/observability";
import { CatalogService } from "../catalog/catalog.service";
import { PrismaService } from "../prisma.service";
import { BuildDraftDto, UpdateBuildDto } from "./build.dto";

export interface BuildAnalysis {
  total_price: number;
  ram_gb: number;
  storage_gb: number;
  psu_watts: number;
  estimated_consumption_watts: number;
  recommended_watts: number;
  remaining_budget: number;
  missing: string[];
  issues: Array<{
    category: string;
    severity: "block" | "warning";
    message: string;
  }>;
  can_save: boolean;
  score: number;
  level: string;
  warnings: string[];
  recommendations: string[];
  explanation: string;
}

@Injectable()
export class BuildsService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async preview(draft: BuildDraftDto) {
    const configuration = this.catalog.resolve(draft);
    try {
      const { data } = await pythonPost<BuildAnalysis>(
          this.http,
          `${process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000"}/builds/preview`,
          configuration,
          { timeout: 5000 },
      );
      if (
        !data ||
        !Number.isInteger(data.total_price) ||
        !Number.isInteger(data.recommended_watts) ||
        !Array.isArray(data.issues) ||
        !Array.isArray(data.missing) ||
        typeof data.can_save !== "boolean" ||
        !Array.isArray(data.warnings) ||
        !Array.isArray(data.recommendations) ||
        !Number.isInteger(data.score)
      ) {
        throw new Error("Respuesta inválida del evaluador");
      }
      return { analysis: data, configuration };
    } catch {
      throw new ServiceUnavailableException(
        "No pudimos revisar el armado. Tus selecciones siguen guardadas; vuelve a intentar cuando el evaluador esté disponible.",
      );
    }
  }

  async save(draft: BuildDraftDto, userId: string) {
    const { analysis, configuration } = await this.preview(draft);
    if (!analysis.can_save)
      throw new BadRequestException(
        "Completa el armado y resuelve las incompatibilidades antes de guardarlo.",
      );
    try {
      const quote = await this.prisma.quote.create({
        data: {
          userId,
          ...this.snapshot(draft, analysis, configuration),
        },
      });
      return { ...analysis, quoteId: quote.id };
    } catch {
      throw new ServiceUnavailableException(
        "No pudimos guardar la cotización. Conservamos el borrador para que puedas volver a intentarlo.",
      );
    }
  }

  private snapshot(draft: BuildDraftDto, analysis: BuildAnalysis, configuration: ReturnType<CatalogService['resolve']>) {
    return {
      name: draft.name?.trim() || 'Mi cotización', intendedUse: draft.intendedUse,
      budget: draft.budget, totalPrice: analysis.total_price, ramGb: analysis.ram_gb,
      storageGb: analysis.storage_gb, psuWatts: analysis.psu_watts,
      estimatedConsumptionWatts: analysis.estimated_consumption_watts,
      score: analysis.score, level: analysis.level, warnings: analysis.warnings,
      recommendations: analysis.recommendations, explanation: analysis.explanation,
      configuration: configuration as unknown as Prisma.InputJsonValue,
      recommendedPsuWatts: analysis.recommended_watts,
    };
  }

  async update(id: string, draft: UpdateBuildDto, userId: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id, userId, deletedAt: null } });
    if (!quote) throw new NotFoundException('Cotización no disponible.');
    if (quote.status !== 'DRAFT' || quote.requestDeletedAt) {
      throw new ConflictException('Esta cotización tiene una coordinación o historial. Guarda una copia para conservarla.');
    }
    const expectedUpdatedAt = new Date(draft.expectedUpdatedAt);
    if (quote.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new ConflictException('La cotización cambió en otra sesión. Recarga antes de editarla.');
    }
    const { analysis, configuration } = await this.preview(draft);
    if (!analysis.can_save) throw new BadRequestException('Resuelve las incompatibilidades y completa las piezas antes de guardar.');
    const result = await this.prisma.quote.updateMany({
      where: { id, userId, deletedAt: null, requestDeletedAt: null, status: 'DRAFT', updatedAt: expectedUpdatedAt },
      data: this.snapshot(draft, analysis, configuration),
    });
    if (!result.count) throw new ConflictException('La cotización cambió mientras editabas. Recarga antes de guardar.');
    return { ...analysis, quoteId: id };
  }
}

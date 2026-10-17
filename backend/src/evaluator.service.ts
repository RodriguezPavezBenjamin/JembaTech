import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { pythonPost } from './observability/observability';
import { PrismaService } from './prisma.service';

interface EvaluationPayload {
  budget: number;
  intended_use: string;
  total_price: number;
  ram_gb: number;
  storage_gb: number;
  psu_watts: number;
  estimated_consumption_watts: number;
}

export interface EvaluationResponse {
  quoteId?: string;
  score: number;
  level: string;
  warnings: string[];
  recommendations: string[];
  explanation: string;
}

@Injectable()
export class EvaluatorService {
  constructor(private readonly http: HttpService, private readonly prisma: PrismaService) {}

  async evaluate(payload: EvaluationPayload, userId?: string) {
    let evaluation: EvaluationResponse;
    try {
      const response = await pythonPost<EvaluationResponse>(this.http, `${process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'}/evaluate`, payload, { timeout: 4000 });
      evaluation = response.data;
    } catch {
      throw new ServiceUnavailableException('El evaluador no esta disponible. Intenta nuevamente.');
    }

    try {
      const quote = await this.prisma.quote.create({
        data: {
          intendedUse: payload.intended_use,
          budget: payload.budget,
          totalPrice: payload.total_price,
          ramGb: payload.ram_gb,
          storageGb: payload.storage_gb,
          psuWatts: payload.psu_watts,
          estimatedConsumptionWatts: payload.estimated_consumption_watts,
          ...(userId ? { user: { connect: { id: userId } } } : {}),
          ...evaluation,
        },
      });
      evaluation.quoteId = quote.id;
    } catch {
      throw new ServiceUnavailableException('No fue posible guardar la cotizacion en PostgreSQL.');
    }

    return evaluation;
  }
}


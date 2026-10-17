import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth.guard';
import { Roles } from '../roles.decorator';
import { RolesGuard } from '../roles.guard';
import { requestMetrics } from './observability';

@ApiTags('observability')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/observability')
export class ObservabilityController {
  @Get()
  @ApiOperation({ summary: 'Métricas agregadas por proceso; se reinician al reiniciar NestJS, sin datos de clientes' })
  metrics() { return requestMetrics.snapshot(); }
}

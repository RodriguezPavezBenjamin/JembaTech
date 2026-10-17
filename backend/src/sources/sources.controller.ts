import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth.guard";
import { Roles } from "../roles.decorator";
import { RolesGuard } from "../roles.guard";
import { CpuRecoveryDto, CpuSampleDto, ReferenceQueryDto } from "./source.dto";
import { SourcesService } from "./sources.service";

@ApiTags("sources")
@ApiBearerAuth()
@Roles("ADMIN")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin/sources/solotodo")
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}
  @Get() overview() { return this.sources.overview(); }
  @Get("references") references(@Query() query: ReferenceQueryDto) { return this.sources.references(query); }
  @Get("runs") runs() { return this.sources.runs(); }
  @Post("cpu/samples")
  @ApiOperation({ summary: "Preparar muestra CPU declarada por administrador; sin acceso a SoloTodo ni cambios de catálogo" })
  prepare(@Body() dto: CpuSampleDto, @Req() request: AuthenticatedRequest) {
    return this.sources.prepareSample(dto, request.user.sub);
  }
  @Post("cpu/recover")
  @ApiOperation({ summary: "Consulta puntual de 1–5 CPU a SoloTodo; validación y persistencia privadas, sin actualización del cotizador" })
  recover(@Body() dto: CpuRecoveryDto, @Req() request: AuthenticatedRequest) {
    return this.sources.recoverCpu(dto, request.user.sub);
  }
}

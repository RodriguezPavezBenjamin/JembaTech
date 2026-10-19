import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth.guard";
import { Roles } from "../roles.decorator";
import { RolesGuard } from "../roles.guard";
import { ComponentRecoveryDto, ComponentSampleDto, CpuRecoveryDto, CpuSampleDto, PriceRecoveryDto, ReferenceQueryDto } from "./source.dto";
import { CatalogPricingService } from '../catalog/catalog-pricing.service';
import { SourcesService } from "./sources.service";
import { SOURCE_TARGETS } from './source.targets';
import { CatalogImportService } from '../catalog/catalog-import.service';
import { CatalogRecoveryDto } from './source.dto';

@ApiTags("sources")
@ApiBearerAuth()
@Roles("ADMIN")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin/sources/solotodo")
export class SourcesController {
  constructor(private readonly sources: SourcesService, private readonly pricing: CatalogPricingService, private readonly catalogImport: CatalogImportService) {}
  @Get('catalog') catalog() { return this.catalogImport.overview(); }
  @Post('catalog/recover') recoverCatalog(@Body() dto: CatalogRecoveryDto, @Req() request: AuthenticatedRequest) { return this.catalogImport.recover(dto.target, dto.acknowledged, request.user.sub); }
  @Get('prices') prices() { return this.pricing.targets(); }
  @Post('prices/recover') recoverPrice(@Body() dto: PriceRecoveryDto, @Req() request: AuthenticatedRequest) { return this.pricing.recover(dto.target, dto.acknowledged, request.user.sub); }
  @Get() overview() { return this.sources.overview(); }
  @Get("references") references(@Query() query: ReferenceQueryDto) { return this.sources.references(query); }
  @Get("runs") runs() { return this.sources.runs(); }
  @Get('targets') targets() { return SOURCE_TARGETS.map(({ id, category, brand, label }) => ({ id, category, brand, label })); }
  @Post('components/recover')
  @ApiOperation({ summary: 'Una búsqueda CPU/GPU acotada por modelo; solo referencias privadas, sin vincular SKU ni cambiar precios' })
  recoverComponents(@Body() dto: ComponentRecoveryDto, @Req() request: AuthenticatedRequest) {
    return this.sources.recoverComponents(dto, request.user.sub);
  }
  @Post('components/samples')
  prepareComponents(@Body() dto: ComponentSampleDto, @Req() request: AuthenticatedRequest) {
    return this.sources.prepareSample(dto, request.user.sub, dto.category);
  }
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

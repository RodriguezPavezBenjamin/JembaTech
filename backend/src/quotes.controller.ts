import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AuthenticatedRequest, JwtAuthGuard } from './auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class RequestCoordinationDto {
  @IsOptional() @IsString() @MaxLength(30) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(240) serviceAddress?: string;
  @IsOptional() @IsDateString() preferredDate?: string;
  @IsOptional() @IsString() @MaxLength(600) customerNote?: string;
}

class AdminCoordinationDto {
  @IsEnum(QuoteStatus) status!: QuoteStatus;
  @IsOptional() @IsString() @MaxLength(600) adminNote?: string;
  @IsOptional() @IsDateString() preferredDate?: string | null;
}

@Controller('quotes')
export class QuotesController {
  constructor(private readonly prisma: PrismaService) {}

  private visible(id: string, request: AuthenticatedRequest) {
    return { id, deletedAt: null, ...(request.user.role === 'ADMIN' ? {} : { userId: request.user.sub }) };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findLatest(@Req() request: AuthenticatedRequest, @Query('scope') scope?: string) {
    const isAdmin = request.user.role === 'ADMIN' && scope === 'all';
    return this.prisma.quote.findMany({
      where: { deletedAt: null, ...(isAdmin ? {} : { userId: request.user.sub }) },
      include: isAdmin ? { user: { select: { id: true, name: true, email: true, phone: true } } } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const result = await this.prisma.quote.updateMany({
      where: this.visible(id, request), data: { deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Cotización no disponible.');
    return { id, deleted: true };
  }

  @Delete(':id/request')
  @UseGuards(JwtAuthGuard)
  async removeRequest(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const result = await this.prisma.quote.updateMany({
      where: { ...this.visible(id, request), requestDeletedAt: null, status: { not: QuoteStatus.DRAFT } },
      data: { requestDeletedAt: new Date(), status: QuoteStatus.EXPIRED },
    });
    if (!result.count) throw new NotFoundException('Consulta no disponible.');
    return { id, withdrawn: true };
  }

  @Patch(':id/request')
  @UseGuards(JwtAuthGuard)
  async requestCoordination(@Param('id') id: string, @Body() dto: RequestCoordinationDto, @Req() request: AuthenticatedRequest) {
    const result = await this.prisma.quote.updateMany({
      where: { ...this.visible(id, request), status: { in: [QuoteStatus.DRAFT, QuoteStatus.EXPIRED] } },
      data: {
        contactPhone: dto.contactPhone ?? null, serviceAddress: dto.serviceAddress ?? null,
        customerNote: dto.customerNote ?? null,
        preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : null,
        adminNote: null, requestDeletedAt: null, status: QuoteStatus.REQUESTED,
      },
    });
    if (!result.count) throw new NotFoundException('Cotización no disponible.');
    return this.prisma.quote.findUnique({ where: { id } });
  }

  @Patch(':id/coordination')
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async coordinate(@Param('id') id: string, @Body() dto: AdminCoordinationDto) {
    // Un formulario antiguo no puede reactivar una consulta retirada.
    const result = await this.prisma.quote.updateMany({
      where: { id, deletedAt: null, requestDeletedAt: null },
      data: { ...dto, preferredDate: dto.preferredDate === null ? null : dto.preferredDate ? new Date(dto.preferredDate) : undefined },
    });
    if (!result.count) throw new NotFoundException('Cotización eliminada o consulta retirada.');
    return this.prisma.quote.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, email: true, phone: true } } } });
  }
}

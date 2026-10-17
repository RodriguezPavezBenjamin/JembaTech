import { NotFoundException } from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { QuotesController } from './quotes.controller';
import { PrismaService } from './prisma.service';
import { AuthenticatedRequest } from './auth.guard';

// Esta prueba aísla el controlador; la firma/verificación JWT no forma parte del caso.
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

describe('Cotizaciones: aislamiento, borrado lógico y consultas', () => {
  const quote = { findMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() };
  const controller = new QuotesController({ quote } as unknown as PrismaService);
  const client = { user: { sub: 'owner', role: 'CLIENT' } } as AuthenticatedRequest;
  const admin = { user: { sub: 'admin', role: 'ADMIN' } } as AuthenticatedRequest;
  beforeEach(() => { jest.clearAllMocks(); quote.updateMany.mockResolvedValue({ count: 1 }); });

  it('solo el admin puede pedir todos los clientes y nunca incluye eliminados', () => {
    controller.findLatest(client, 'all');
    expect(quote.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, userId: 'owner' });
    controller.findLatest(admin);
    expect(quote.findMany.mock.calls[1][0].where).toEqual({ deletedAt: null, userId: 'admin' });
    controller.findLatest(admin, 'all');
    expect(quote.findMany.mock.calls[2][0].where).toEqual({ deletedAt: null });
  });
  it('borrar exige propiedad y solo marca deletedAt', async () => {
    await controller.remove('q', client);
    expect(quote.updateMany).toHaveBeenCalledWith({ where: { id: 'q', deletedAt: null, userId: 'owner' }, data: { deletedAt: expect.any(Date) } });
  });
  it('el admin puede eliminar una cotización ajena', async () => {
    await controller.remove('q', admin);
    expect(quote.updateMany.mock.calls[0][0].where).not.toHaveProperty('userId');
  });
  it('retirar consulta conserva configuración, contacto y notas', async () => {
    await controller.removeRequest('q', client);
    expect(quote.updateMany.mock.calls[0][0].data).toEqual({ requestDeletedAt: expect.any(Date), status: QuoteStatus.EXPIRED });
    expect(quote.updateMany.mock.calls[0][0].where.userId).toBe('owner');
  });
  it('devuelve 404 sin filtrar existencia o propiedad y sin leer datos ajenos', async () => {
    quote.updateMany.mockResolvedValue({ count: 0 });
    await expect(controller.remove('foreign', client)).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.removeRequest('foreign', client)).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.requestCoordination('foreign', {}, client)).rejects.toBeInstanceOf(NotFoundException);
    expect(quote.findUnique).not.toHaveBeenCalled();
  });
  it('una consulta retirada o cotización borrada no admite un guardado admin antiguo', async () => {
    quote.updateMany.mockResolvedValue({ count: 0 });
    await expect(controller.coordinate('q', { status: QuoteStatus.SCHEDULED })).rejects.toBeInstanceOf(NotFoundException);
    expect(quote.updateMany.mock.calls[0][0].where).toEqual({ id: 'q', deletedAt: null, requestDeletedAt: null });
  });
  it('permite borrar la fecha de coordinación explícitamente', async () => {
    await controller.coordinate('q', { status: QuoteStatus.REVIEWING, preferredDate: null });
    expect(quote.updateMany.mock.calls[0][0].data.preferredDate).toBeNull();
  });
  it('reenviar solo admite guardadas/cerradas, no pisa una consulta activa', async () => {
    await controller.requestCoordination('q', { customerNote: 'Nueva consulta' }, client);
    expect(quote.updateMany.mock.calls[0][0].where.status.in).toEqual(['DRAFT', 'EXPIRED']);
    expect(quote.updateMany.mock.calls[0][0].data.requestDeletedAt).toBeNull();
  });
});

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { of, throwError } from "rxjs";
import { BuildsService } from "./builds.service";
import { CatalogService } from "../catalog/catalog.service";

describe("BuildsService", () => {
  const http = { post: jest.fn() };
  const prisma = { quote: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() } };
  const service = new BuildsService(
    new CatalogService(),
    http as never,
    prisma as never,
  );
  const draft = {
    budget: 1000000,
    intendedUse: "gaming",
    drives: [],
    extras: [],
    cpu: "cpu-7600",
  };
  const analysis = {
    total_price: 209990,
    recommended_watts: 150,
    ram_gb: 0,
    storage_gb: 0,
    psu_watts: 0,
    estimated_consumption_watts: 88,
    remaining_budget: 790010,
    missing: [],
    issues: [],
    can_save: true,
    score: 100,
    level: "Prueba",
    warnings: [],
    recommendations: [],
    explanation: "Prueba",
  };

  beforeEach(() => jest.clearAllMocks());

  const updatedAt = new Date('2026-10-17T03:00:00Z');
  const edit = { ...draft, expectedUpdatedAt: updatedAt.toISOString() };
  function editableQuote(overrides = {}) {
    prisma.quote.findFirst.mockResolvedValue({ id: 'q', userId: 'owner', status: 'DRAFT', requestDeletedAt: null, updatedAt, ...overrides });
    http.post.mockReturnValue(of({ data: analysis }));
    prisma.quote.updateMany.mockResolvedValue({ count: 1 });
  }
  it('actualiza solo la cotización propia y recalcula precios del catálogo en servidor', async () => {
    editableQuote();
    const result = await service.update('q', edit, 'owner');
    expect(result.quoteId).toBe('q');
    expect(prisma.quote.findFirst).toHaveBeenCalledWith({ where: { id: 'q', userId: 'owner', deletedAt: null } });
    expect(prisma.quote.updateMany).toHaveBeenCalledWith({
      where: { id: 'q', userId: 'owner', deletedAt: null, requestDeletedAt: null, status: 'DRAFT', updatedAt },
      data: expect.objectContaining({ totalPrice: 209990, configuration: expect.objectContaining({ components: [expect.objectContaining({ id: 'cpu-7600', price: 209990 })] }) }),
    });
    expect(prisma.quote.create).not.toHaveBeenCalled();
  });
  it('no permite editar una cotización ajena o eliminada', async () => {
    prisma.quote.findFirst.mockResolvedValue(null);
    await expect(service.update('foreign', edit, 'owner')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.quote.updateMany).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
  });
  it('no altera piezas de una consulta activa ni de una retirada', async () => {
    editableQuote({ status: 'REQUESTED' });
    await expect(service.update('q', edit, 'owner')).rejects.toBeInstanceOf(ConflictException);
    editableQuote({ requestDeletedAt: new Date() });
    await expect(service.update('q', edit, 'owner')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.quote.updateMany).not.toHaveBeenCalled();
  });
  it('rechaza versiones desactualizadas y cambios concurrentes', async () => {
    editableQuote({ updatedAt: new Date('2026-10-17T03:00:01Z') });
    await expect(service.update('q', edit, 'owner')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.quote.updateMany).not.toHaveBeenCalled();
    editableQuote();
    prisma.quote.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.update('q', edit, 'owner')).rejects.toBeInstanceOf(ConflictException);
  });
  it('una edición incompatible no sobrescribe el snapshot original', async () => {
    editableQuote();
    http.post.mockReturnValue(of({ data: { ...analysis, can_save: false } }));
    await expect(service.update('q', edit, 'owner')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.quote.updateMany).not.toHaveBeenCalled();
  });

  it("conserva las piezas, precios y presupuesto al guardar el snapshot", async () => {
    http.post.mockReturnValue(of({ data: analysis }));
    prisma.quote.create.mockResolvedValue({ id: "quote-1" });
    const result = await service.save(draft, "user-1");
    expect(result.quoteId).toBe("quote-1");
    expect(prisma.quote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        budget: 1000000,
        recommendedPsuWatts: 150,
        configuration: expect.objectContaining({
          components: [
            expect.objectContaining({ id: "cpu-7600", price: 209990 }),
          ],
        }),
      }),
    });
  });

  it("no persiste un armado incompleto o incompatible", async () => {
    http.post.mockReturnValue(
      of({ data: { ...analysis, can_save: false, missing: ["board"] } }),
    );
    await expect(service.save(draft, "user-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.quote.create).not.toHaveBeenCalled();
  });

  it("retorna un error controlado cuando Python falla o devuelve un contrato inválido", async () => {
    http.post.mockReturnValue(throwError(() => new Error("Timeout")));
    await expect(service.preview(draft)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    http.post.mockReturnValue(of({ data: { can_save: true } }));
    await expect(service.preview(draft)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.quote.create).not.toHaveBeenCalled();
  });
});

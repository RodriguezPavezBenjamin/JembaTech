import 'zone.js';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FuentesComponent } from './fuentes.component';
import { FuentesService } from '../../servicios/fuentes.service';
import { ExternalReference, SourceOverview, SourceRun } from '../../modelos/fuente';

describe('Fuentes y calidad: panel privado', () => {
  it('importar requiere confirmación y abrir el panel nunca consulta al proveedor', () => {
    const { component, service } = render();
    component.resumen = { manualProbeEnabled: true } as SourceOverview;
    component.catalogo = { caps: { cpu: 35 }, counts: { cpu: 0 }, targets: [{ id: 'cpu-intel-11', category: 'cpu', query: 'Intel Core i9-11900', take: 3, lastImport: null }] };
    component.importarCatalogo(); expect(service.importarCatalogo).not.toHaveBeenCalled();
    component.catalogoConfirmado = true;
    service.importarCatalogo.mockReturnValue(of({ imported: 2, received: 5, runId: 'QA' }));
    component.importarCatalogo();
    expect(service.importarCatalogo).toHaveBeenCalledExactlyOnceWith('cpu-intel-11');
    expect(component.mensaje).toContain('Las cotizaciones guardadas no cambiaron');
    expect(component.catalogoConfirmado).toBe(false);
  });
  it('precio requiere confirmación, no consulta al abrir y distingue ausencia de ofertas', () => {
    const { component, service, fixture } = render();
    component.resumen = { manualProbeEnabled: true, nextAllowedAt: null, probeRunning: false } as SourceOverview;
    component.precios = [{ id: 'cpu-7600', label: 'Ryzen 7600 BOX', productId: 166287, partNumber: 'QA', priceInfo: null }];
    component.consultarPrecio(); expect(service.recuperarPrecio).not.toHaveBeenCalled();
    component.precioConfirmado = true;
    service.recuperarPrecio.mockReturnValue(of({ applied: false, priceInfo: null, received: 5, accepted: 0 }));
    component.consultarPrecio(); fixture.detectChanges();
    expect(service.recuperarPrecio).toHaveBeenCalledExactlyOnceWith('cpu-7600');
    expect(component.mensaje).toContain('No hubo ofertas aptas'); expect(component.precioConfirmado).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No se recorren otras páginas');
  });
  it('actualización de precio informa tienda y que no cambió cotizaciones; fallo no reintenta', () => {
    const { component, service } = render();
    component.resumen = { manualProbeEnabled: true } as SourceOverview;
    component.precios = [{ id: 'cpu-7600', label: 'Ryzen 7600', productId: 166287, partNumber: null, priceInfo: null }];
    component.precioConfirmado = true;
    service.recuperarPrecio.mockReturnValue(of({ applied: true, priceInfo: { normalPriceClp: 230000, storeHost: 'tienda.example.cl' } }));
    component.consultarPrecio(); expect(component.mensaje).toContain('las cotizaciones guardadas no cambiaron');
    component.precios = [{ id: 'cpu-7600', label: 'Ryzen 7600', productId: 166287, partNumber: null, priceInfo: null }];
    component.resumen = { manualProbeEnabled: true } as SourceOverview; component.precioConfirmado = true;
    service.recuperarPrecio.mockReturnValue(throwError(() => new Error('offline')));
    component.consultarPrecio(); expect(component.errorConsulta).toContain('No pudimos actualizar');
    expect(service.recuperarPrecio).toHaveBeenCalledTimes(2); expect(component.guardando).toBe(false);
  });
  afterEach(() => TestBed.resetTestingModule());
  function render() {
    const service = {
      resumen: vi.fn(() => of({ referenceCount: 0, runCount: 0, latestRun: null })),
      referencias: vi.fn(() => of({ items: [], total: 0, page: 1, pageSize: 12 })),
      ejecuciones: vi.fn(() => of([])), preparar: vi.fn(), recuperar: vi.fn(),
      precios: vi.fn(() => of([])), recuperarPrecio: vi.fn(),
      catalogo: vi.fn(() => of({ caps: {}, counts: {}, targets: [] })), importarCatalogo: vi.fn(),
      objetivos: vi.fn(() => of([
        { id: 'ryzen-7600', category: 'cpu', brand: 'AMD', label: 'Ryzen 5 7600' },
        { id: 'rtx-5060', category: 'gpu', brand: 'NVIDIA', label: 'GeForce RTX 5060' },
        { id: 'msi-b650', category: 'motherboard', brand: 'MSI', label: 'B650' },
        { id: 'fury-ddr5', category: 'ram', brand: 'Kingston', label: 'FURY Beast DDR5' },
        { id: 'nv3-pcie', category: 'storage', brand: 'Kingston', label: 'NV3' },
      ])),
    };
    TestBed.configureTestingModule({ imports: [FuentesComponent], providers: [provideRouter([]), { provide: FuentesService, useValue: service }] });
    const fixture = TestBed.createComponent(FuentesComponent); fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, service };
  }
  it('explica la limitación y no genera productos ficticios ni consulta la fuente', () => {
    const { fixture, service } = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Sincronización desactivada');
    expect(root.textContent).toContain('no se generarán productos ficticios');
    expect(root.querySelectorAll('.referencia-fuente')).toHaveLength(0);
    expect(root.textContent).toContain('Sin datos');
    expect(root.textContent).not.toContain('null%');
    expect(root.textContent).not.toContain('Volver a clientes');
    expect(service.preparar).not.toHaveBeenCalled();
    expect(service.recuperar).not.toHaveBeenCalled();
  });
  it('sin métricas o con porcentaje nulo muestra Sin datos, nunca null%', () => {
    const { component, fixture } = render();
    for (const metrics of [null, { received: 1, validPercent: null }, { received: 0, validPercent: 0 }, { received: 1, validPercent: undefined }]) {
      component.resumen = { latestRun: { metrics } } as unknown as SourceOverview;
      fixture.detectChanges();
      const value = (fixture.nativeElement as HTMLElement).querySelector('.metricas-fuente > div:nth-child(3) strong');
      expect(value?.textContent).toBe('Sin datos');
    }
  });
  it('un cero real de fichas válidas se muestra como 0%, no como dato ausente', () => {
    const { component } = render();
    for (const validPercent of [0, 80, 100]) {
      component.resumen = { latestRun: { metrics: { received: 5, validPercent } } } as unknown as SourceOverview;
      expect(component.validezUltimoLote).toBe(`${validPercent}%`);
    }
  });
  it('rechaza JSON inválido y muestras excesivas sin enviarlas', () => {
    const { component, service } = render();
    for (const text of ['no json', '{}', JSON.stringify({ retrievedAt: '2026-01-01T00:00:00', records: [{}] }), JSON.stringify({ retrievedAt: '2099-01-01T00:00:00Z', records: [{}] }), JSON.stringify({ retrievedAt: '2026-01-01T00:00:00Z', records: Array(6).fill({}) })]) {
      component.muestra = text; component.preparar(); expect(component.errorMuestra).not.toBe('');
    }
    expect(service.preparar).not.toHaveBeenCalled();
  });
  it('evita doble envío y muestra métricas reales tras guardar', () => {
    const { component, service } = render();
    const request = new Subject<SourceRun>(); service.preparar.mockReturnValue(request);
    component.muestra = JSON.stringify({ retrievedAt: '2026-01-01T00:00:00Z', records: [{}] });
    component.preparar(); component.preparar(); expect(service.preparar).toHaveBeenCalledTimes(1);
    request.next({ metrics: { accepted: 1, rejected: 0, duplicates: 0 }, storedCount: 1, staleSkipped: 0 } as SourceRun);
    expect(component.guardando).toBe(false); expect(component.muestra).toBe('');
    expect(component.mensaje).toContain('1 fichas guardadas');
  });
  it('conserva el JSON al fallar y permite reintentar', () => {
    const { component, service } = render();
    service.preparar.mockReturnValue(throwError(() => new Error('unavailable')));
    const input = JSON.stringify({ retrievedAt: '2026-01-01T00:00:00Z', records: [{}] });
    component.muestra = input; component.preparar();
    expect(component.muestra).toBe(input); expect(component.guardando).toBe(false);
    expect(component.errorMuestra).toContain('Conservamos tu JSON');
  });
  it('buscar reinicia paginación y limita enlaces al origen esperado', () => {
    const { component, service } = render();
    component.busqueda = ' AMD '; component.cargar();
    expect(service.referencias).toHaveBeenLastCalledWith('AMD', 1, '', '');
    const unsafe = { externalId: '123', sourceUrl: 'javascript:alert(1)' };
    expect(component.origenSeguro(unsafe as Parameters<typeof component.origenSeguro>[0])).toBeNull();
  });
  it('consulta requiere habilitación, confirmación y espera cumplida', () => {
    const { component, service } = render();
    component.consultarFuente(); expect(service.recuperar).not.toHaveBeenCalled();
    component.resumen = { manualProbeEnabled: true, probeRunning: false, nextAllowedAt: null } as unknown as SourceOverview;
    component.consultarFuente(); expect(service.recuperar).not.toHaveBeenCalled();
    component.consultaConfirmada = true;
    component.resumen.nextAllowedAt = new Date(Date.now() + 60000).toISOString();
    component.consultarFuente(); expect(service.recuperar).not.toHaveBeenCalled();
  });
  it('un clic recupera y guarda sin JSON ni doble envío', () => {
    const { component, service } = render();
    component.resumen = { manualProbeEnabled: true, probeRunning: false, nextAllowedAt: null } as unknown as SourceOverview;
    component.consultaConfirmada = true;
    const request = new Subject<SourceRun>(); service.recuperar.mockReturnValue(request);
    component.consultarFuente(); component.consultarFuente();
    expect(service.recuperar).toHaveBeenCalledExactlyOnceWith('ryzen-7600');
    request.next({ metrics: { received: 1, accepted: 1 }, storedCount: 1 } as SourceRun);
    expect(component.mensaje).toContain('Consulta API completada');
    expect(component.guardando).toBe(false); expect(component.consultaConfirmada).toBe(false);
  });
  it('al denegar la fuente no reintenta y conserva los resultados anteriores', () => {
    const { component, service } = render();
    component.resumen = { manualProbeEnabled: true, probeRunning: false, nextAllowedAt: null } as unknown as SourceOverview;
    component.consultaConfirmada = true;
    service.recuperar.mockReturnValue(throwError(() => ({ error: { code: 'SOURCE_ACCESS_DENIED' } })));
    component.consultarFuente();
    expect(service.recuperar).toHaveBeenCalledTimes(1);
    expect(component.errorConsulta).toContain('No intentaremos eludir');
    expect(component.guardando).toBe(false);
  });
  it('cambiar de CPU a GPU selecciona un modelo válido y exige nueva confirmación', () => {
    const { component, service } = render();
    component.consultaConfirmada = true;
    component.categoriaConsulta = 'gpu'; component.cambiarCategoriaConsulta();
    expect(component.objetivoConsulta).toBe('rtx-5060'); expect(component.consultaConfirmada).toBe(false);
    expect(service.recuperar).not.toHaveBeenCalled();
    component.categoriaFiltro = 'gpu'; component.marcaFiltro = 'NVIDIA'; component.cargar();
    expect(service.referencias).toHaveBeenLastCalledWith('', 1, 'gpu', 'NVIDIA');
    expect(service.recuperar).not.toHaveBeenCalled();
  });
  it('renderiza VRAM, ensamblador, chip, faltantes y antigüedad sin inventar ceros', () => {
    const { component, fixture } = render();
    const item = {
      id: 'qa', externalId: '987', category: 'gpu', name: 'GPU QA', brand: 'Ensamblador QA', partNumber: null,
      specs: { chip: 'NVIDIA GPU QA', chipBrand: 'NVIDIA', vramGb: 16, memoryType: 'GDDR6', lengthMm: null, slots: null, bus: null, declaredTdpWatts: null },
      sourceUrl: 'https://www.solotodo.cl/products/987', retrievedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2025-01-01T00:00:00Z', contentHash: 'a'.repeat(64), acquisitionMode: 'manual-api',
    } as ExternalReference;
    component.referencias.items = [item]; fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Ensamblador QA'); expect(root.textContent).toContain('NVIDIA GPU QA');
    expect(root.textContent).toContain('16 GB GDDR6'); expect(root.textContent).toContain('Revisar vigencia');
    expect(root.textContent).toContain('Sin dato: Part Number, TDP, largo, slots, interfaz');
    expect(root.textContent).not.toContain('0 mm'); expect(root.textContent).not.toContain('null W');
  });
  it('muestras GPU usan categoría explícita; desconocidas se rechazan sin petición', () => {
    const { component, service } = render();
    service.preparar.mockReturnValue(new Subject<SourceRun>());
    component.muestra = JSON.stringify({ category: 'gpu', retrievedAt: '2026-01-01T00:00:00Z', records: [{}] });
    component.preparar(); expect(service.preparar).toHaveBeenCalledWith({ category: 'gpu', retrievedAt: '2026-01-01T00:00:00Z', records: [{}] });
    component.guardando = false; service.preparar.mockClear();
    component.muestra = JSON.stringify({ category: 'psu', retrievedAt: '2026-01-01T00:00:00Z', records: [{}] });
    component.preparar(); expect(service.preparar).not.toHaveBeenCalled();
  });
  it('muestra placas, kits RAM y almacenamiento sin fingir atributos CPU o TDP faltante', () => {
    const { component, fixture } = render();
    const base = { externalId: '456', name: 'Hardware QA', brand: 'Marca QA', partNumber: 'QA-ONLY', sourceUrl: 'https://www.solotodo.cl/products/456', retrievedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: null, contentHash: 'a'.repeat(64), acquisitionMode: 'manual-sample' };
    component.referencias.items = [
      { ...base, id: 'board', category: 'motherboard', specs: { socket: 'AM5', chipset: 'AMD B650', formFactor: 'ATX', ramType: 'DDR5', ramSlots: 4, m2Slots: 2, sataPorts: 4, declaredTdpWatts: null } },
      { ...base, id: 'ram', category: 'ram', specs: { capacityGb: 32, moduleCapacityGb: 16, modules: 2, ramType: 'DDR5', formFactor: 'DIMM', speedMt: 6000, casLatency: 30, declaredTdpWatts: null } },
      { ...base, id: 'drive', category: 'storage', specs: { storageType: 'SSD', capacityGb: 1000, interface: 'PCIe', formFactor: 'M.2 (2280)', bus: 'PCIe 4.0', protocol: null, connector: null, readMbps: null, writeMbps: null, declaredTdpWatts: null } },
    ] as ExternalReference[];
    fixture.detectChanges();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.referencia-fuente');
    expect(rows[0].textContent).toContain('4 slots'); expect(rows[0].textContent).toContain('M.2: 2 · SATA: 4');
    expect(rows[1].textContent).toContain('32 GB · 2 × 16 GB · DDR5'); expect(rows[1].textContent).toContain('6000 MT/s');
    expect(rows[2].textContent).toContain('1000 GB'); expect(rows[2].textContent).toContain('protocolo NVMe por confirmar');
    for (const row of Array.from(rows)) { expect(row.textContent).not.toContain('TDP declarado'); expect(row.textContent).not.toContain('núcleos /'); }
  });
  it('un M.2 SATA no se presenta como PCIe/NVMe; desconocido es distinto de cero', () => {
    const { component } = render();
    const item = { category: 'storage', partNumber: 'QA', specs: { storageType: 'SSD', interface: 'SATA', formFactor: 'M.2', readMbps: 500, writeMbps: 400, connector: 'M.2', protocol: null, declaredTdpWatts: null } } as ExternalReference;
    expect(component.faltantes(item)).not.toContain('NVMe');
    expect(component.faltantes(item)).not.toContain('TDP');
    expect(component.aplicaTdp('motherboard')).toBe(false);
    expect(component.aplicaTdp(undefined)).toBe(true); // Historial CPU anterior.
    expect(component.incidencia('target_mismatch')).toBe('No coincide con la búsqueda');
  });
  it('las cinco categorías seleccionan sus objetivos sin consultar la fuente', () => {
    const { component, service } = render();
    for (const category of component.categorias) {
      component.categoriaConsulta = category.id; component.cambiarCategoriaConsulta();
      expect(component.objetivosDisponibles.some(target => target.id === component.objetivoConsulta)).toBe(true);
      expect(component.consultaConfirmada).toBe(false);
    }
    expect(service.recuperar).not.toHaveBeenCalled();
  });
  it('no presenta un lote de candidatas rechazadas como éxito ni reintenta', () => {
    const { component, service } = render();
    component.resumen = { manualProbeEnabled: true, probeRunning: false, nextAllowedAt: null } as unknown as SourceOverview;
    component.consultaConfirmada = true;
    service.recuperar.mockReturnValue(of({ metrics: { received: 5, accepted: 0 }, storedCount: 0 } as SourceRun));
    component.consultarFuente();
    expect(component.mensaje).toBe(''); expect(component.errorConsulta).toContain('ninguna candidata');
    expect(service.recuperar).toHaveBeenCalledTimes(1);
  });
});

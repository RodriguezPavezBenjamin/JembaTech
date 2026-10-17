import 'zone.js';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FuentesComponent } from './fuentes.component';
import { FuentesService } from '../../servicios/fuentes.service';
import { SourceOverview, SourceRun } from '../../modelos/fuente';

describe('Fuentes y calidad: panel privado', () => {
  afterEach(() => TestBed.resetTestingModule());
  function render() {
    const service = {
      resumen: vi.fn(() => of({ referenceCount: 0, runCount: 0, latestRun: null })),
      referencias: vi.fn(() => of({ items: [], total: 0, page: 1, pageSize: 12 })),
      ejecuciones: vi.fn(() => of([])), preparar: vi.fn(), recuperar: vi.fn(),
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
    expect(service.referencias).toHaveBeenLastCalledWith('AMD', 1);
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
    expect(service.recuperar).toHaveBeenCalledExactlyOnceWith(1);
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
});

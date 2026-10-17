import 'zone.js';
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Analisis, Categoria, Catalogo, Producto } from '../../modelos/catalogo';
import { Cotizacion } from '../../modelos/cotizacion';
import { CatalogoService } from '../../servicios/catalogo.service';
import { EditorCotizacionComponent, borradorDesdeFilas } from './editor-cotizacion.component';

const product = (id: string, category: Categoria): Producto => ({ id, category, name: id, description: '', price: 100, icon: category, specs: {} });
const products = [product('cpu', 'cpu'), product('cpu-new', 'cpu'), product('gpu', 'gpu'), product('board', 'board'), product('ram', 'ram'), product('disk', 'storage'), product('cooler', 'cooler'), product('case', 'case'), product('psu', 'psu')];
const catalog: Catalogo = { version: 'test', source: 'reference-manual', notice: '', products };
const quote: Cotizacion = {
  id: 'q', name: 'Mi PC', intendedUse: 'gaming', budget: 10000, totalPrice: 800,
  ramGb: 16, storageGb: 1000, psuWatts: 650, estimatedConsumptionWatts: 200,
  score: 90, level: 'Prueba', explanation: '', warnings: [], recommendations: [],
  status: 'DRAFT', createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z',
  configuration: { budget: 10000, intended_use: 'gaming', catalog_version: 'old', components: products.filter(p => p.id !== 'cpu-new').map(p => ({ ...p, quantity: p.category === 'ram' ? 2 : 1 })) },
};
const analysis: Analisis = {
  total_price: 900, ram_gb: 16, storage_gb: 1000, psu_watts: 650,
  estimated_consumption_watts: 200, recommended_watts: 300, remaining_budget: 9100,
  missing: [], issues: [], can_save: true, score: 90, level: 'Prueba', warnings: [], recommendations: [], explanation: '',
};

describe('Editor simple de componentes guardados', () => {
  const service = { cargar: vi.fn(), revisar: vi.fn(), guardar: vi.fn(), actualizar: vi.fn() };
  function create() {
    const editor = TestBed.runInInjectionContext(() => new EditorCotizacionComponent());
    const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
    editor.dialogo = new ElementRef(dialog as HTMLDialogElement);
    return editor;
  }
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    service.cargar.mockReturnValue(of(catalog));
    service.revisar.mockReturnValue(of(analysis));
    service.guardar.mockReturnValue(of(analysis));
    service.actualizar.mockReturnValue(of(analysis));
    TestBed.configureTestingModule({ providers: [{ provide: CatalogoService, useValue: service }] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });

  it('recupera cantidades y convierte filas sin alterar el snapshot guardado', () => {
    const editor = create();
    const before = JSON.stringify(quote);
    editor.abrir(quote);
    editor.filas.find(f => f.category === 'cpu')!.id = 'cpu-new';
    const draft = borradorDesdeFilas(quote, editor.filas, 'Nueva', 20000);
    expect(draft.cpu).toBe('cpu-new');
    expect(draft.memory).toEqual([{ id: 'ram', quantity: 2 }]);
    expect(draft.drives).toEqual([{ id: 'disk', quantity: 1 }]);
    expect(JSON.stringify(quote)).toBe(before);
  });
  it('actualiza la guardada usando control de versión y sin crear duplicados', () => {
    const editor = create();
    editor.abrir(quote);
    vi.advanceTimersByTime(250);
    editor.guardar();
    expect(service.actualizar).toHaveBeenCalledWith('q', expect.objectContaining({ cpu: 'cpu' }), quote.updatedAt);
    expect(service.guardar).not.toHaveBeenCalled();
    expect(editor.dialogo.nativeElement.open).toBe(false);
  });
  it('crea una copia si existe consulta, sin editar la coordinación original', () => {
    const editor = create();
    editor.abrir({ ...quote, status: 'SCHEDULED' });
    vi.advanceTimersByTime(250);
    editor.guardar();
    expect(service.guardar).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mi PC · copia' }));
    expect(service.actualizar).not.toHaveBeenCalled();
  });
  it('una respuesta antigua no habilita guardar después de cambiar otra pieza', () => {
    const old = new Subject<Analisis>();
    const latest = new Subject<Analisis>();
    service.revisar.mockReturnValueOnce(old).mockReturnValueOnce(latest);
    const editor = create();
    editor.abrir(quote);
    vi.advanceTimersByTime(250);
    editor.filas.find(f => f.category === 'cpu')!.id = 'cpu-new';
    editor.cambio();
    old.next(analysis);
    editor.guardar();
    expect(service.actualizar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    latest.next({ ...analysis, can_save: false });
    editor.guardar();
    expect(service.actualizar).not.toHaveBeenCalled();
  });
  it('cancelar no guarda y un error al guardar conserva la ventana y la cotización original', () => {
    const editor = create();
    editor.abrir(quote);
    editor.cerrar();
    expect(service.actualizar).not.toHaveBeenCalled();
    editor.abrir(quote);
    vi.advanceTimersByTime(250);
    service.actualizar.mockReturnValueOnce(throwError(() => ({ status: 409 })));
    editor.guardar();
    expect(editor.dialogo.nativeElement.open).toBe(true);
    expect(editor.error).toContain('mientras editabas');
  });
  it('bloquea cantidades inválidas y modelos duplicados', () => {
    const editor = create();
    editor.abrir(quote);
    editor.filas.find(f => f.category === 'ram')!.quantity = 0;
    expect(editor.valido).toBe(false);
    editor.filas.find(f => f.category === 'ram')!.quantity = 2;
    editor.filas.push({ key: 999, category: 'ram', id: 'ram', quantity: 1 });
    expect(editor.valido).toBe(false);
  });
});

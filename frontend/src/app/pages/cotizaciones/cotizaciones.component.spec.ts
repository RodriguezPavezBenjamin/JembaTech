import 'zone.js';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CotizacionesComponent } from './cotizaciones.component';
import { EditorCotizacionComponent } from '../../compartidos/editor-cotizacion/editor-cotizacion.component';
import { QuoteService } from '../../servicios/cotizaciones.service';
import { CatalogoService } from '../../servicios/catalogo.service';
import { Cotizacion } from '../../modelos/cotizacion';

const quote: Cotizacion = {
  id: 'q', name: 'Mi PC', intendedUse: 'gaming', budget: 1000000, totalPrice: 900000,
  ramGb: 32, storageGb: 1000, psuWatts: 650, estimatedConsumptionWatts: 200,
  score: 90, level: 'Prueba', explanation: '', warnings: [], recommendations: [],
  status: 'DRAFT', createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z',
  configuration: { budget: 1000000, intended_use: 'gaming', catalog_version: 'test', components: [{ id: 'cpu', category: 'cpu', name: 'CPU', description: '', icon: 'cpu', price: 900000, quantity: 1, specs: {} }] },
};

describe('Mis cotizaciones: acceso directo a componentes', () => {
  afterEach(() => TestBed.resetTestingModule());
  function render(item: Cotizacion) {
    TestBed.configureTestingModule({ imports: [CotizacionesComponent], providers: [
      provideRouter([]), { provide: QuoteService, useValue: { list: () => of([item]) } },
      { provide: CatalogoService, useValue: {} },
    ] });
    const fixture = TestBed.createComponent(CotizacionesComponent);
    fixture.detectChanges();
    return fixture;
  }
  it('el botón abre el editor en un clic, sin renderizar la lista estática', () => {
    const fixture = render(quote);
    const editor = fixture.debugElement.query(By.directive(EditorCotizacionComponent)).componentInstance as EditorCotizacionComponent;
    const open = vi.spyOn(editor, 'abrir').mockImplementation(() => {});
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-detalle-armado')).toBeNull();
    const button = root.querySelector('.abrir-componentes') as HTMLButtonElement;
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    button.click();
    expect(open).toHaveBeenCalledExactlyOnceWith(quote);
  });
  it('una cotización antigua sin snapshot no permite una edición inventada', () => {
    const fixture = render({ ...quote, configuration: null });
    const button = (fixture.nativeElement as HTMLElement).querySelector('.abrir-componentes') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toContain('no conserva');
  });
});

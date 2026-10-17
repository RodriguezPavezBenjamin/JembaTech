import 'zone.js';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Cotizacion } from '../../modelos/cotizacion';
import { ResumenCotizacionComponent } from './resumen-cotizacion.component';

const cotizacion: Cotizacion = {
  id: 'preview', name: 'Mi PC', intendedUse: 'gaming', budget: 1000000,
  totalPrice: 933150, ramGb: 32, storageGb: 480, psuWatts: 1000,
  estimatedConsumptionWatts: 216, recommendedPsuWatts: 300,
  score: 90, level: 'Compatible con el perfil', explanation: 'Evaluación guardada',
  warnings: ['Confirmar medidas'], recommendations: ['Revisar montaje'], status: 'DRAFT',
  createdAt: '2026-10-17T02:21:00Z', updatedAt: '2026-10-17T02:21:00Z',
};

describe('Resumen de cotización: presentación compacta', () => {
  afterEach(() => TestBed.resetTestingModule());
  function render(compacto: boolean) {
    TestBed.configureTestingModule({ imports: [ResumenCotizacionComponent] });
    const fixture = TestBed.createComponent(ResumenCotizacionComponent);
    fixture.componentRef.setInput('cotizacion', cotizacion);
    fixture.componentRef.setInput('compacto', compacto);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  it('no muestra presupuesto, saldo ni excedente en la tarjeta personal', () => {
    const element = render(true);
    expect(element.querySelector('.metricas')).toBeNull();
    expect(element.querySelector('.uso')).toBeNull();
    expect(element.textContent).not.toContain('PRESUPUESTO');
    expect(element.textContent).not.toContain('DISPONIBLE');
    expect(element.textContent).not.toContain('EXCEDENTE');
  });
  it('conserva consumo, potencia, advertencias y recomendaciones en el desplegable', () => {
    const element = render(true);
    const details = element.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain('216 W');
    expect(details.textContent).toContain('1000 W');
    expect(details.textContent).toContain('300 W');
    expect(details.textContent).toContain('Confirmar medidas');
    expect(details.textContent).toContain('Revisar montaje');
  });
  it('mantiene las cuatro métricas de la vista completa del admin', () => {
    const element = render(false);
    expect(element.querySelectorAll('.metricas > div')).toHaveLength(4);
    expect(element.querySelector('.uso')?.textContent).toContain('32 GB RAM');
  });
});

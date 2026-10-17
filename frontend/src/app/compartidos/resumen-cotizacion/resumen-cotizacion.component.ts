import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Cotizacion, dinero } from '../../modelos/cotizacion';

@Component({
  selector: 'app-resumen-cotizacion', standalone: true, imports: [CommonModule],
  host: { '[class.compacto]': 'compacto', '[class.abierto]': 'abierto' },
  template: `
    <div class="metricas" *ngIf="!compacto">
      <div><small>PRESUPUESTO</small><b>{{ dinero(cotizacion.budget) }}</b></div>
      <div [class.excedido]="cotizacion.totalPrice > cotizacion.budget"><small>{{ cotizacion.budget >= cotizacion.totalPrice ? 'DISPONIBLE' : 'EXCEDENTE' }}</small><b>{{ dinero(Math.abs(cotizacion.budget - cotizacion.totalPrice)) }}</b></div>
      <div *ngIf="!compacto"><small>CONSUMO ESTIMADO</small><b>{{ cotizacion.estimatedConsumptionWatts }} W</b></div>
      <div *ngIf="!compacto"><small>FUENTE / RECOMENDADA</small><b>{{ cotizacion.psuWatts }} / {{ cotizacion.recommendedPsuWatts ?? '—' }} W</b></div>
    </div>
    <p class="uso" *ngIf="!compacto">Uso: {{ usos[cotizacion.intendedUse] || cotizacion.intendedUse }} · {{ cotizacion.ramGb }} GB RAM · {{ cotizacion.storageGb }} GB de almacenamiento</p>
    <details [open]="expandido" (toggle)="abierto = $any($event.target).open">
      <summary>{{ compacto ? 'EVALUACIÓN DEL EQUIPO' : 'EVALUACIÓN Y RECOMENDACIONES' }}</summary>
      <div *ngIf="compacto" class="datos-consumo"><span>{{ cotizacion.level }} · {{ cotizacion.score }}/100</span><span>Uso: {{ usos[cotizacion.intendedUse] || cotizacion.intendedUse }}</span><span>Consumo estimado: {{ cotizacion.estimatedConsumptionWatts }} W</span><span>Fuente: {{ cotizacion.psuWatts }} W · Recomendada: {{ cotizacion.recommendedPsuWatts ?? '—' }} W</span></div>
      <p>{{ cotizacion.explanation }}</p>
      <div class="aviso" *ngIf="cotizacion.warnings?.length"><b>OBSERVACIONES</b><ul><li *ngFor="let aviso of cotizacion.warnings">{{ aviso }}</li></ul></div>
      <div *ngIf="cotizacion.recommendations?.length"><b>RECOMENDACIONES</b><ul><li *ngFor="let consejo of cotizacion.recommendations">{{ consejo }}</li></ul></div>
      <p class="registro">ID: {{ cotizacion.id }}<br>Guardada: {{ cotizacion.createdAt | date:'dd/MM/yyyy HH:mm' }} · Actualizada: {{ cotizacion.updatedAt | date:'dd/MM/yyyy HH:mm' }}</p>
      <p class="registro">Evaluación orientativa y precios conservados al guardar; no confirma stock ni compatibilidad final.</p>
    </details>
  `,
  styles: [`
    :host { display: block; margin: 1rem 0; color: var(--muted); font: .85rem/1.5 'Exo 2'; }
    .metricas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .6rem; }
    .metricas > div { display: grid; gap: .5rem; padding: .8rem; border: 1px solid var(--border); border-radius: 8px; background: #0002; }
    small { font: 600 .45rem/1.6 'Orbitron'; color: var(--muted); }
    .metricas b { color: var(--text); font-size: .9rem; overflow-wrap: anywhere; }
    summary { color: var(--accent); cursor: pointer; font: 600 .55rem/1.7 'Orbitron'; }
    details { margin-top: 1rem; }
    details b { font-size: .72rem; color: var(--text); }
    ul { padding-left: 1.2rem; }
    li + li { margin-top: .4rem; }
    .aviso { border-left: 2px solid #ffcf5c; padding-left: .8rem; }
    .registro { font-size: .7rem; overflow-wrap: anywhere; }
    .excedido b { color: #ffcf5c; }
    :host.compacto { margin: 0; padding: 0 1rem; border: 1px solid var(--border); border-radius: 8px; background: rgba(var(--accent-rgb), .025); }
    :host.compacto details { margin: 0; }
    :host.compacto summary { padding: .9rem 0; }
    :host.compacto details > p:last-child { margin-bottom: 1rem; }
    .datos-consumo { display: grid; gap: .35rem; padding: .7rem; background: rgba(var(--accent-rgb), .04); border-radius: 6px; }
    @media(max-width: 800px) { .metricas { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `],
})
export class ResumenCotizacionComponent {
  @Input({ required: true }) cotizacion!: Cotizacion;
  @Input() expandido = false;
  @Input() compacto = false;
  abierto = false;
  dinero = dinero;
  Math = Math;
  usos: Record<string, string> = { office: 'Oficina / estudio', gaming: 'Gaming', creator: 'Creación de contenido', general: 'General' };
}

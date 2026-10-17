import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Categoria, Producto } from "../../modelos/catalogo";
import { ConfiguracionGuardada } from '../../modelos/cotizacion';

@Component({
  selector: "app-detalle-armado",
  host: { '[class.compacto]': 'compacto', '[class.abierto]': 'abierto' },
  standalone: true,
  imports: [CommonModule],
  template: `
    <p *ngIf="!configuracion?.components?.length">Esta cotización antigua no conserva un desglose de piezas.</p>
    <details *ngIf="configuracion?.components?.length" [open]="expandido" (toggle)="abierto = $any($event.target).open">
      <summary>{{ titulo }}</summary>
      <div class="acciones-piezas" *ngIf="editable"><button type="button" (click)="editar.emit()">CAMBIAR COMPONENTES</button><small>Vista simple · modelos y cantidades</small></div>
      <div class="piezas">
        <article *ngFor="let pieza of configuracion!.components">
          <img *ngIf="pieza.image && !fallidas.has(pieza.id); else icono" [src]="pieza.image" [alt]="pieza.name" loading="lazy" referrerpolicy="no-referrer" (error)="fallidas.add(pieza.id)" />
          <ng-template #icono><svg viewBox="0 0 160 120" aria-hidden="true">
            <use
              [attr.href]="'/media/components/componentes.svg#' + pieza.icon"
            ></use>
          </svg></ng-template>
          <div class="pieza-info">
            <small>{{ categoria(pieza.category) }}</small>
            <span>{{ pieza.quantity }} × {{ pieza.name }}</span>
            <p>{{ pieza.description }}</p>
            <small>{{ dinero(pieza.price) }} por {{ pieza.category === 'ram' && +pieza.specs['modules'] > 1 ? 'kit' : 'unidad' }}</small>
            <details *ngIf="detallado && datos(pieza).length" class="datos-tecnicos">
              <summary>DATOS DEL COMPONENTE</summary>
              <dl><div *ngFor="let dato of datos(pieza)"><dt>{{ dato.nombre }}</dt><dd>{{ dato.valor }}</dd></div></dl>
            </details>
          </div>
          <strong>{{ dinero(pieza.price * pieza.quantity) }}</strong>
        </article>
      </div>
      <p>
        <ng-container *ngIf="!compacto">Presupuesto original: {{ dinero(configuracion!.budget) }} · </ng-container>Uso:
        {{ configuracion!.intended_use }}
      </p>
      <p>
        Catálogo de referencia: {{ configuracion!.catalog_version }}. Precios
        conservados al guardar.
      </p>
    </details>
  `,
  styles: [
    `
      details {
        margin-top: 1rem;
        color: var(--muted);
        font-size: 0.8rem;
      }
      :host.compacto { display: block; padding: 0 1rem; border: 1px solid var(--border); border-radius: 8px; background: rgba(var(--accent-rgb), .025); }
      :host.compacto > details { margin-top: 0; }
      :host.compacto > details > summary { padding: .9rem 0; }
      :host.compacto > details > p:last-child { margin-bottom: 1rem; }
      summary {
        cursor: pointer;
        color: var(--accent);
        font:
          600 0.52rem/1.7 "Orbitron",
          sans-serif;
      }
      .piezas {
        margin-top: 0.7rem;
        display: grid;
        gap: 0.4rem;
      }
      .acciones-piezas { display: flex; flex-wrap: wrap; align-items: center; gap: .7rem; margin-top: .75rem; }
      .acciones-piezas button { color: var(--accent); background: rgba(var(--accent-rgb), .07); border: 1px solid var(--border); border-radius: 5px; padding: .65rem .75rem; font: 600 .5rem 'Orbitron'; cursor: pointer; }
      .acciones-piezas button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
      article {
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.7rem;
        padding: 0.8rem 0;
        border-bottom: 1px solid var(--border);
      }
      svg {
        width: 40px;
        height: 35px;
        color: var(--accent);
      }
      img { width: 64px; height: 64px; object-fit: contain; background: #fff; border-radius: 6px; padding: 4px; }
      .pieza-info { display: grid; gap: .25rem; min-width: 0; overflow-wrap: anywhere; }
      .pieza-info > span { color: var(--text); font-weight: 600; }
      .pieza-info > p { margin: 0; }
      small { font-size: .65rem; color: var(--muted); }
      .datos-tecnicos { margin-top: .35rem; }
      dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
      dt { font-size: .65rem; color: var(--muted); }
      dd { margin: .15rem 0 0; color: var(--text); overflow-wrap: anywhere; }
      strong {
        color: var(--text);
        font-size: 0.78rem;
      }
      p {
        margin-top: 0.7rem;
        font-size: 0.75rem;
      }
      @media (max-width: 600px) {
        article {
          grid-template-columns: 48px minmax(0, 1fr);
        }
        img { width: 48px; height: 48px; }
        strong {
          grid-column: 2;
        }
      }
    `,
  ],
})
export class DetalleArmadoComponent {
  @Input() configuracion?: ConfiguracionGuardada | null;
  @Input() expandido = false;
  @Input() detallado = false;
  @Input() compacto = false;
  abierto = false;
  @Input() titulo = 'VER PIEZAS Y CANTIDADES DEL ARMADO';
  @Input() editable = false;
  @Output() editar = new EventEmitter<void>();
  fallidas = new Set<string>();

  categoria(valor: Categoria) {
    return { cpu: 'PROCESADOR', gpu: 'GRÁFICA', board: 'PLACA MADRE', ram: 'MEMORIA RAM', storage: 'ALMACENAMIENTO', cooler: 'REFRIGERACIÓN', fan: 'VENTILADOR', support: 'SOPORTE', case: 'GABINETE', psu: 'FUENTE' }[valor];
  }
  datos(pieza: Producto) {
    const etiquetas: Record<string, string> = {
      socket: 'Socket', sockets: 'Sockets', ram: 'Tipo RAM', ramSlots: 'Ranuras RAM', maxRam: 'RAM máxima (GB)',
      m2: 'Puertos M.2', sata: 'Puertos SATA', form: 'Formato', forms: 'Placas admitidas',
      lan: 'Red', wireless: 'Inalámbrico', capacityGb: 'Capacidad (GB)', modules: 'Módulos por kit',
      radiatorMm: 'Radiador (mm)', heightMm: 'Altura (mm)', gpuClearanceMm: 'Espacio GPU (mm)',
      coolerClearanceMm: 'Altura cooler máxima (mm)', watts: 'Potencia (W)', power: 'Consumo de referencia (W)',
      modular: 'Cableado', radiators: 'Radiadores (mm)', mountNote: 'Nota de montaje',
    };
    return Object.entries(pieza.specs).filter(([key]) => key in etiquetas).map(([key, value]) => ({
      nombre: etiquetas[key], valor: Array.isArray(value) ? value.join(' / ') : typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value),
    }));
  }

  dinero(value: number) {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(value);
  }
}

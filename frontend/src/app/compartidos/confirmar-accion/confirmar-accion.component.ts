import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-confirmar-accion', standalone: true, imports: [CommonModule],
  template: `
    <dialog #dialogo aria-labelledby="titulo-confirmacion" (cancel)="cancelarEvento($event)" (click)="cerrarFondo($event)">
      <small>CONFIRMAR ACCIÓN</small>
      <h2 id="titulo-confirmacion">{{ titulo }}</h2>
      <p>{{ descripcion }}</p>
      <p role="alert" class="error" *ngIf="error">{{ error }}</p>
      <div class="acciones">
        <button type="button" autofocus [disabled]="ocupado" (click)="cerrar()">VOLVER</button>
        <button type="button" class="eliminar" [disabled]="ocupado" (click)="confirmar.emit()">{{ ocupado ? 'PROCESANDO…' : etiqueta }}</button>
      </div>
    </dialog>
  `,
  styles: [`
    dialog { position: fixed; inset: 0; margin: auto; width: min(480px, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); overflow: auto; padding: 1.6rem; border: 1px solid var(--border); border-radius: 16px; background: var(--bg); color: var(--text); box-shadow: 0 20px 80px #0009; }
    dialog::backdrop { background: #000b; backdrop-filter: blur(6px); }
    small { font: 600 .55rem 'Orbitron'; color: var(--accent); }
    h2 { font: 700 1.1rem/1.6 'Orbitron'; margin: .8rem 0; }
    p { color: var(--muted); font: .95rem/1.6 'Exo 2'; white-space: pre-line; overflow-wrap: anywhere; }
    .acciones { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .7rem; margin-top: 1.5rem; }
    button { padding: .8rem 1rem; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--text); font: 600 .6rem 'Orbitron'; cursor: pointer; }
    .eliminar { background: #ff6b721a; color: #ff9a9e; border-color: #ff6b7270; }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
    button:disabled { opacity: .5; cursor: wait; }
    .error { color: #ffcf5c; }
  `],
})
export class ConfirmarAccionComponent {
  @ViewChild('dialogo', { static: true }) dialogo!: ElementRef<HTMLDialogElement>;
  @Input() titulo = '¿Eliminar?';
  @Input() descripcion = '';
  @Input() etiqueta = 'ELIMINAR';
  @Input() ocupado = false;
  @Input() error = '';
  @Output() confirmar = new EventEmitter<void>();
  abrir() { this.dialogo.nativeElement.showModal(); }
  cerrar() { if (!this.ocupado) this.dialogo.nativeElement.close(); }
  cancelarEvento(event: Event) { event.preventDefault(); this.cerrar(); }
  cerrarFondo(event: Event) { if (event.target === this.dialogo.nativeElement) this.cerrar(); }
}

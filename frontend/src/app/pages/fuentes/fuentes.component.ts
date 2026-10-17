import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin, interval } from 'rxjs';
import { FuentesService } from '../../servicios/fuentes.service';
import { ExternalReference, ReferencePage, SourceOverview, SourceRun } from '../../modelos/fuente';

@Component({
  selector: 'app-fuentes', standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fuentes.component.html',
  styleUrls: ['../../estilos/paginas.scss', './fuentes.component.scss'],
})
export class FuentesComponent implements OnInit, OnDestroy {
  private readonly fuentes = inject(FuentesService);
  private consulta?: Subscription;
  private guardado?: Subscription;
  private reloj?: Subscription;
  ahora = Date.now();
  limiteConsulta = 1;
  consultaConfirmada = false;
  errorConsulta = '';
  resumen?: SourceOverview;
  referencias: ReferencePage = { items: [], total: 0, page: 1, pageSize: 12 };
  ejecuciones: SourceRun[] = [];
  busqueda = '';
  muestra = '';
  cargando = false;
  guardando = false;
  error = '';
  errorMuestra = '';
  mensaje = '';
  get paginas() { return Math.max(1, Math.ceil(this.referencias.total / this.referencias.pageSize)); }
  get validezUltimoLote() {
    const metrics = this.resumen?.latestRun?.metrics;
    const value = metrics?.validPercent;
    return metrics && metrics.received > 0 && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? `${value}%` : 'Sin datos';
  }
  get segundosRestantes() { return Math.max(0, Math.ceil(((Date.parse(this.resumen?.nextAllowedAt ?? '') || 0) - this.ahora) / 1000)); }
  get origenLote() { return this.resumen?.latestRun?.mode === 'manual-api' ? 'Consulta API' : this.resumen?.latestRun ? 'Muestra manual' : 'Sin ejecuciones'; }
  get puedeConsultar() { return !!this.resumen?.manualProbeEnabled && !this.resumen.probeRunning && !this.guardando && !this.cargando && !this.segundosRestantes && this.consultaConfirmada; }
  ngOnInit() { this.reloj = interval(1000).subscribe(() => this.ahora = Date.now()); this.cargar(); }
  ngOnDestroy() { this.consulta?.unsubscribe(); this.guardado?.unsubscribe(); this.reloj?.unsubscribe(); }

  cargar(page = 1) {
    this.consulta?.unsubscribe();
    this.cargando = true;
    this.error = '';
    this.consulta = forkJoin({ resumen: this.fuentes.resumen(), referencias: this.fuentes.referencias(this.busqueda.trim(), page), ejecuciones: this.fuentes.ejecuciones() }).subscribe({
      next: data => { this.resumen = data.resumen; this.referencias = data.referencias; this.ejecuciones = data.ejecuciones; this.cargando = false; },
      error: () => { this.cargando = false; this.error = 'No pudimos consultar las referencias. Los últimos datos visibles pueden estar desactualizados; vuelve a intentar.'; },
    });
  }

  preparar() {
    if (this.guardando) return;
    this.errorMuestra = '';
    this.mensaje = '';
    let payload: { retrievedAt: string; records: unknown[] };
    try {
      if (this.muestra.length > 100000) throw new Error();
      const value: unknown = JSON.parse(this.muestra);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      const row = value as Record<string, unknown>;
      if (typeof row['retrievedAt'] !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(row['retrievedAt']) || !Number.isFinite(Date.parse(row['retrievedAt'])) || Date.parse(row['retrievedAt']) > Date.now() + 300000 || !Array.isArray(row['records']) || row['records'].length < 1 || row['records'].length > 5) throw new Error();
      payload = { retrievedAt: row['retrievedAt'], records: row['records'] };
    } catch {
      this.errorMuestra = 'Revisa el JSON: retrievedAt debe ser una fecha con zona horaria, no futura; records debe contener de 1 a 5 fichas. Máximo 100 KB.';
      return;
    }
    this.guardando = true;
    this.guardado = this.fuentes.preparar(payload).subscribe({
      next: run => {
        this.guardando = false;
        this.muestra = '';
        this.mensaje = `Muestra procesada: ${run.metrics?.accepted ?? 0} válidas, ${run.metrics?.rejected ?? 0} rechazadas y ${run.metrics?.duplicates ?? 0} repetidas. ${run.storedCount} fichas guardadas; ${run.staleSkipped} omitidas por antigüedad/conflicto.`;
        this.cargar();
      },
      error: () => { this.guardando = false; this.errorMuestra = 'No se pudo preparar la muestra. Conservamos tu JSON para reintentar; revisa el historial de ejecuciones.'; this.cargar(this.referencias.page); },
    });
  }

  consultarFuente() {
    if (!this.puedeConsultar || !Number.isInteger(this.limiteConsulta) || this.limiteConsulta < 1 || this.limiteConsulta > 5) return;
    this.guardando = true;
    this.errorConsulta = '';
    this.mensaje = '';
    this.guardado = this.fuentes.recuperar(this.limiteConsulta).subscribe({
      next: run => {
        this.guardando = false;
        this.consultaConfirmada = false;
        this.mensaje = `Consulta API completada: ${run.metrics?.received ?? 0} fichas recibidas, ${run.metrics?.accepted ?? 0} válidas y ${run.storedCount} guardadas. El cotizador no se modificó.`;
        this.ahora = Date.now();
        this.cargar();
      },
      error: (error: { error?: { code?: string; runId?: string } }) => {
        this.guardando = false;
        const mensajes: Record<string, string> = {
          SOURCE_COOLDOWN: 'Espera un minuto entre consultas a la fuente.',
          SOURCE_RATE_LIMITED: 'SoloTodo limitó las consultas. No reintentaremos automáticamente.',
          SOURCE_ACCESS_DENIED: 'La fuente denegó el acceso. No intentaremos eludir la restricción.',
          MANUAL_PROBE_DISABLED: 'La consulta puntual está desactivada en este ambiente.',
          SOURCE_UNAVAILABLE: 'SoloTodo no está disponible en este momento.',
          PYTHON_UNAVAILABLE: 'El servicio de recuperación no está disponible en este momento.',
        };
        this.errorConsulta = (mensajes[error.error?.code ?? ''] ?? 'No se pudo recuperar una respuesta válida de la fuente.') + ' Tus fichas anteriores siguen intactas.';
        this.ahora = Date.now();
        this.cargar();
      },
    });
  }

  origenSeguro(item: ExternalReference) {
    return /^[1-9]\d*$/.test(item.externalId) && item.sourceUrl === `https://www.solotodo.cl/products/${item.externalId}` ? item.sourceUrl : null;
  }
  estado(status: string) { return ({ SUCCEEDED: 'Procesada', FAILED: 'Fallida', RUNNING: 'En proceso' } as Record<string, string>)[status] ?? 'Desconocido'; }
}

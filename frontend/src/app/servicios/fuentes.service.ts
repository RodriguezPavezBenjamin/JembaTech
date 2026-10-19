import { HttpClient } from '@angular/common/http';
import { CatalogImportOverview } from '../modelos/fuente';
import { Injectable, inject } from '@angular/core';
import { PriceRecovery, PriceTarget, ReferencePage, SourceCategory, SourceOverview, SourceRun, SourceTarget } from '../modelos/fuente';

@Injectable({ providedIn: 'root' })
export class FuentesService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/admin/sources/solotodo';
  resumen() { return this.http.get<SourceOverview>(this.base); }
  catalogo() { return this.http.get<CatalogImportOverview>(`${this.base}/catalog`); }
  importarCatalogo(target: string) { return this.http.post<{ imported: number; runId: string; received: number }>(`${this.base}/catalog/recover`, { target, acknowledged: true }); }
  referencias(q = '', page = 1, category: SourceCategory | '' = '', brand = '') {
    return this.http.get<ReferencePage>(`${this.base}/references`, { params: { q, page, pageSize: 12, ...(category ? { category } : {}), ...(brand ? { brand } : {}) } });
  }
  objetivos() { return this.http.get<SourceTarget[]>(`${this.base}/targets`); }
  precios() { return this.http.get<PriceTarget[]>(`${this.base}/prices`); }
  recuperarPrecio(target: string) { return this.http.post<PriceRecovery>(`${this.base}/prices/recover`, { target, acknowledged: true }); }
  ejecuciones() { return this.http.get<SourceRun[]>(`${this.base}/runs`); }
  preparar(muestra: { retrievedAt: string; records: unknown[]; category?: SourceCategory }) { return this.http.post<SourceRun>(`${this.base}/${muestra.category ? 'components' : 'cpu'}/samples`, muestra); }
  recuperar(target: string) { return this.http.post<SourceRun>(`${this.base}/components/recover`, { target, acknowledged: true }); }
}

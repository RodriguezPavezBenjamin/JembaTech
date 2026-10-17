import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ReferencePage, SourceOverview, SourceRun } from '../modelos/fuente';

@Injectable({ providedIn: 'root' })
export class FuentesService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/admin/sources/solotodo';
  resumen() { return this.http.get<SourceOverview>(this.base); }
  referencias(q = '', page = 1) { return this.http.get<ReferencePage>(`${this.base}/references`, { params: { q, page, pageSize: 12 } }); }
  ejecuciones() { return this.http.get<SourceRun[]>(`${this.base}/runs`); }
  preparar(muestra: { retrievedAt: string; records: unknown[] }) { return this.http.post<SourceRun>(`${this.base}/cpu/samples`, muestra); }
  recuperar(limit: number) { return this.http.post<SourceRun>(`${this.base}/cpu/recover`, { limit, acknowledged: true }); }
}

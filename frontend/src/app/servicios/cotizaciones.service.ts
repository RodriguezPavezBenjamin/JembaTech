import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { Cotizacion, EstadoCotizacion } from '../modelos/cotizacion';
export type CoordinationRequest = {
  contactPhone?: string;
  serviceAddress?: string;
  preferredDate?: string;
  customerNote?: string;
};
export type AdminCoordination = {
  status: EstadoCotizacion;
  adminNote?: string;
  preferredDate?: string | null;
};
@Injectable({ providedIn: "root" })
export class QuoteService {
  constructor(private readonly http: HttpClient) {}
  list(scope: 'mine' | 'all' = 'mine'): Observable<Cotizacion[]> {
    return this.http.get<Cotizacion[]>("/api/quotes", { params: { scope } });
  }
  remove(id: string) {
    return this.http.delete(`/api/quotes/${id}`);
  }
  removeRequest(id: string) {
    return this.http.delete(`/api/quotes/${id}/request`);
  }
  requestCoordination(
    id: string,
    data: CoordinationRequest,
  ): Observable<Cotizacion> {
    return this.http.patch<Cotizacion>(`/api/quotes/${id}/request`, data);
  }
  coordinate(
    id: string,
    data: AdminCoordination,
  ): Observable<Cotizacion> {
    return this.http.patch<Cotizacion>(`/api/quotes/${id}/coordination`, data);
  }
}

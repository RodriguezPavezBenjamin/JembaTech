import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Analisis, Borrador, Catalogo } from "../modelos/catalogo";

@Injectable({ providedIn: "root" })
export class CatalogoService {
  private readonly http = inject(HttpClient);

  cargar() {
    return this.http.get<Catalogo>("/api/catalog");
  }

  revisar(borrador: Borrador) {
    return this.http.post<Analisis>("/api/builds/preview", borrador);
  }

  guardar(borrador: Borrador) {
    return this.http.post<Analisis>("/api/builds", borrador);
  }
  actualizar(id: string, borrador: Borrador, expectedUpdatedAt: string) {
    return this.http.patch<Analisis>(`/api/builds/${id}`, { ...borrador, expectedUpdatedAt });
  }
}

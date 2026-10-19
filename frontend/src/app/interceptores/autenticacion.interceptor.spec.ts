import "zone.js";
import { HttpClient, provideHttpClient, withInterceptors } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppUser, AuthService } from "../servicios/autenticacion.service";
import { autenticacionInterceptor } from "./autenticacion.interceptor";

describe("autenticacionInterceptor", () => {
  const autenticacion = {
    token: vi.fn(() => "jwt-de-prueba"),
    logout: vi.fn(),
    user: undefined as AppUser | undefined,
    googleToken: vi.fn(() => Promise.resolve('firebase-token-renovado')),
  };
  const router = {
    url: "/cotizaciones",
    navigate: vi.fn(() => Promise.resolve(true)),
  };
  let http: HttpClient;
  let controlador: HttpTestingController;

  beforeEach(() => {
    autenticacion.token.mockClear();
    autenticacion.user = undefined;
    autenticacion.googleToken.mockReset().mockResolvedValue('firebase-token-renovado');
    autenticacion.logout.mockClear();
    router.navigate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([autenticacionInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: autenticacion },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controlador?.verify());

  it("agrega JWT a una ruta privada de la API", () => {
    http.get("/api/quotes").subscribe();

    const solicitud = controlador.expectOne("/api/quotes");
    expect(solicitud.request.headers.get("Authorization")).toBe("Bearer jwt-de-prueba");
    solicitud.flush([]);
  });

  it("no agrega JWT al inicio de sesión", () => {
    http.post("/api/auth/login", { email: "jemba@example.com" }).subscribe();

    const solicitud = controlador.expectOne("/api/auth/login");
    expect(solicitud.request.headers.has("Authorization")).toBe(false);
    solicitud.flush({ accessToken: "nuevo-token" });
  });

  it("limpia la sesión y redirige ante un 401 de la API", () => {
    http.get("/api/quotes").subscribe({ error: () => undefined });

    controlador
      .expectOne("/api/quotes")
      .flush({ message: "No autorizado" }, { status: 401, statusText: "Unauthorized" });

    expect(autenticacion.logout).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(["/login"], {
      queryParams: { returnUrl: "/cotizaciones" },
    });
  });

  it('no adjunta una sesión local al intercambio público con Google', () => {
    http.post('/api/auth/google', { idToken: 'qa-id-token' }).subscribe();
    const request = controlador.expectOne('/api/auth/google');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('un fallo de acceso público muestra el error sin redirigir a otro login', () => {
    http.post('/api/auth/google', { idToken: 'invalid' }).subscribe({ error: () => undefined });
    controlador.expectOne('/api/auth/google').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(autenticacion.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('renueva el ID token Firebase antes de una API privada', async () => {
    autenticacion.user = { id: 'qa', name: 'QA', email: 'qa@example.invalid', phone: null, role: 'CLIENT', authProvider: 'GOOGLE' };
    http.get('/api/quotes').subscribe();
    await Promise.resolve();
    const request = controlador.expectOne('/api/quotes');
    expect(request.request.headers.get('Authorization')).toBe('Bearer firebase-token-renovado');
    request.flush([]);
  });

  it('no envía un ID token a un dominio externo', () => {
    autenticacion.user = { id: 'qa', name: 'QA', email: 'qa@example.invalid', phone: null, role: 'CLIENT', authProvider: 'GOOGLE' };
    http.get('https://example.invalid/resource').subscribe();
    const request = controlador.expectOne('https://example.invalid/resource');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(autenticacion.googleToken).not.toHaveBeenCalled();
    request.flush({});
  });

  it('un 403 con Google no cierra la sesión', async () => {
    autenticacion.user = { id: 'qa', name: 'QA', email: 'qa@example.invalid', phone: null, role: 'CLIENT', authProvider: 'GOOGLE' };
    http.get('/api/admin/observability').subscribe({ error: () => undefined });
    await Promise.resolve();
    controlador.expectOne('/api/admin/observability').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(autenticacion.logout).not.toHaveBeenCalled();
  });

  it('si falla renovar Google no cae a un JWT local guardado', async () => {
    autenticacion.user = { id: 'qa', name: 'QA', email: 'qa@example.invalid', phone: null, role: 'CLIENT', authProvider: 'GOOGLE' };
    autenticacion.googleToken.mockRejectedValue(new Error('expired'));
    http.get('/api/quotes').subscribe({ error: () => undefined });
    await Promise.resolve();
    controlador.expectNone('/api/quotes');
    expect(autenticacion.logout).toHaveBeenCalledOnce();
  });
});

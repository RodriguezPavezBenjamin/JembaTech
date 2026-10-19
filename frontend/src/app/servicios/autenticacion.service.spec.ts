import 'zone.js';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './autenticacion.service';
import { GoogleAuthService, googleErrorMessage } from './google-auth.service';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

describe('Sesiones Google sin claves privadas ni elevación de roles', () => {
  const google = { popupToken: vi.fn(), token: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) };
  const user = { id: 'qa', name: 'QA', email: 'qa@example.invalid', role: 'CLIENT', phone: null, authProvider: 'GOOGLE' };
  let auth: AuthService;
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    google.popupToken.mockReset().mockResolvedValue('verified-by-backend-token');
    google.token.mockReset().mockResolvedValue('fresh-firebase-token');
    google.logout.mockClear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: GoogleAuthService, useValue: google }] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); localStorage.clear(); });

  it('intercambia solo el token de Google y espera la validación del backend', async () => {
    auth.loginGoogle().subscribe();
    await Promise.resolve();
    const request = http.expectOne('/api/auth/google');
    expect(request.request.body).toEqual({ idToken: 'verified-by-backend-token' });
    expect(auth.user).toBeUndefined();
    request.flush({ accessToken: 'verified-by-backend-token', user });
    expect(auth.user?.role).toBe('CLIENT');
    expect(auth.token()).toBe('verified-by-backend-token');
  });

  it('una ventana cancelada no crea una sesión ni consulta el backend', async () => {
    google.popupToken.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    auth.loginGoogle().subscribe({ error: () => undefined });
    await Promise.resolve();
    http.expectNone('/api/auth/google');
    expect(auth.user).toBeUndefined();
  });

  it('vincular usa un endpoint privado y exige la contraseña local', async () => {
    auth.loginGoogle('local-password-qa').subscribe();
    await Promise.resolve();
    const request = http.expectOne('/api/auth/google/link');
    expect(request.request.body.currentPassword).toBe('local-password-qa');
    request.flush({ accessToken: 'verified-by-backend-token', user });
  });

  it('actualizar perfil Google conserva su ID token y no inventa uno local', async () => {
    localStorage.setItem('jembatech_access_token', 'google-current-token');
    auth.updateProfile({ name: 'QA', phone: '12345678' }).subscribe();
    http.expectOne('/api/auth/me').flush({ user });
    expect(auth.token()).toBe('google-current-token');
    expect(auth.user?.authProvider).toBe('GOOGLE');
    expect(await auth.googleToken()).toBe('fresh-firebase-token');
  });

  it('cerrar sesión borra la sesión local y cierra Firebase', () => {
    localStorage.setItem('jembatech_access_token', 'qa');
    auth.logout();
    expect(auth.token()).toBe('');
    expect(auth.user).toBeUndefined();
    expect(google.logout).toHaveBeenCalledOnce();
  });

  it('errores del proveedor no publican su mensaje bruto, token ni correo', () => {
    expect(googleErrorMessage({ code: 'unknown', message: 'private-qa-details' })).not.toContain('private-qa-details');
    expect(googleErrorMessage({ code: 'auth/popup-blocked' })).toContain('ventana');
    expect(googleErrorMessage({ code: 'auth/unauthorized-domain' })).toContain('dominio');
  });
});

describe('Configuración Firebase opcional en tiempo de ejecución', () => {
  it('SDK App y Auth reales registran sus componentes sin versiones peer duplicadas', async () => {
    const app = initializeApp({ apiKey: 'public-sdk-config-qa', projectId: 'jemba-qa', appId: 'qa-app-id' }, 'qa-component-registration');
    try {
      const auth = getAuth(app);
      await auth.authStateReady();
      expect(auth.app.name).toBe(app.name);
      expect(auth.currentUser).toBeNull();
    } finally { await deleteApp(app); }
  });
  it('sin habilitar Google no carga el SDK ni abre ventanas', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(GoogleAuthService);
    const http = TestBed.inject(HttpTestingController);
    const pending = service.prepare();
    http.expectOne('/api/auth/google/config').flush({ enabled: false });
    expect(await pending).toBe(false);
    await expect(service.popupToken()).rejects.toThrow('no está disponible');
    http.verify();
  });
});

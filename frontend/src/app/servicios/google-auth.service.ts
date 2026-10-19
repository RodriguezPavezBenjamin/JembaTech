import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import type { Auth } from 'firebase/auth';

type FirebaseConfig = { apiKey: string; authDomain: string; projectId: string; appId: string };
type ConfigResponse = { enabled: boolean; firebase?: FirebaseConfig };
type AuthSdk = typeof import('firebase/auth');

export function googleErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'Se canceló el acceso con Google. Puedes intentarlo otra vez.',
    'auth/cancelled-popup-request': 'Ya hay una ventana de Google abierta.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana. Permite ventanas emergentes para JembaTech.',
    'auth/unauthorized-domain': 'Este dominio aún no está autorizado en Firebase.',
    'auth/network-request-failed': 'No se pudo conectar con Google. Revisa tu conexión.',
  };
  return (code && messages[code]) || 'No fue posible acceder con Google. Vuelve a iniciar sesión.';
}

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private readonly http: HttpClient;
  private loading?: Promise<boolean>;
  private client?: { auth: Auth; sdk: AuthSdk };
  readonly nativePlatform = Capacitor.isNativePlatform();

  constructor(backend: HttpBackend) {
    // Configuración pública sin interceptor: evita dependencias circulares al renovar tokens.
    this.http = new HttpClient(backend);
  }

  prepare(): Promise<boolean> {
    if (this.nativePlatform) return Promise.resolve(false);
    return this.loading ??= this.load();
  }

  private async load(): Promise<boolean> {
    try {
      const config = await firstValueFrom(this.http.get<ConfigResponse>('/api/auth/google/config'));
      if (!config.enabled || !config.firebase) return false;
      const [appSdk, sdk] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
      const name = `jembatech-web-${config.firebase.projectId}`;
      const app = appSdk.getApps().find(candidate => candidate.name === name) ?? appSdk.initializeApp(config.firebase, name);
      const auth = sdk.getAuth(app);
      this.client = { auth, sdk };
      return true;
    } catch { return false; } // El fallo de Google no deshabilita el acceso local.
  }

  async popupToken(): Promise<string> {
    if (!await this.prepare() || !this.client) throw new Error('Google no está disponible en esta plataforma.');
    const { auth, sdk } = this.client;
    const provider = new sdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await sdk.signInWithPopup(auth, provider);
    return result.user.getIdToken();
  }

  async token(): Promise<string> {
    if (!await this.prepare() || !this.client) throw new Error('Google no está disponible.');
    await this.client.auth.authStateReady();
    if (!this.client.auth.currentUser) throw new Error('La sesión de Google terminó.');
    // SDK renueva el ID token cuando corresponde. Nunca se renueva con un JWT local.
    return this.client.auth.currentUser.getIdToken();
  }

  async logout(): Promise<void> {
    if (this.client) await this.client.sdk.signOut(this.client.auth);
  }
}

import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { isEmail } from 'class-validator';

export type GoogleIdentity = { uid: string; email: string; name: string };

@Injectable()
export class FirebaseAuthService {
  readonly enabled = process.env.FIREBASE_AUTH_ENABLED === 'true';
  private readonly projectId = process.env.FIREBASE_PROJECT_ID ?? '';
  private readonly apiKey = process.env.FIREBASE_WEB_API_KEY ?? '';
  private readonly appId = process.env.FIREBASE_WEB_APP_ID ?? '';

  constructor() {
    if (this.enabled && (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(this.projectId) || !this.apiKey || !this.appId)) {
      throw new Error('Completa la configuración web de Firebase antes de habilitar Google.');
    }
    if (this.enabled && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new Error('El acceso público con Google no admite el emulador de Authentication.');
    }
  }

  publicConfig() {
    if (!this.enabled) return { enabled: false as const };
    // Solo configuración del SDK cliente, nunca variables de entorno completas.
    return { enabled: true as const, firebase: { apiKey: this.apiKey,
      authDomain: `${this.projectId}.firebaseapp.com`, projectId: this.projectId, appId: this.appId } };
  }

  async verifyGoogleToken(idToken: string): Promise<GoogleIdentity> {
    if (!this.enabled) throw new ServiceUnavailableException('El acceso con Google no está habilitado.');
    try {
      const name = `jembatech-auth-${this.projectId}`;
      const { getAuth } = await import('firebase-admin/auth');
      // Verificación criptográfica mediante certificados públicos. projectId
      // explícito evita necesitar una clave privada para verifyIdToken.
      const app = getApps().find(candidate => candidate.name === name) ?? initializeApp({ projectId: this.projectId }, name);
      const token = await getAuth(app).verifyIdToken(idToken);
      if (token.firebase?.sign_in_provider !== 'google.com' || token.email_verified !== true ||
        !token.uid || !token.email || !isEmail(token.email)) throw new Error('Identidad no apta.');
      return { uid: token.uid, email: token.email.trim().toLowerCase(), name: (token.name?.trim() || 'Usuario Google').slice(0, 80) };
    } catch {
      throw new UnauthorizedException('No se pudo validar la sesión de Google. Vuelve a iniciar sesión.');
    }
  }
}

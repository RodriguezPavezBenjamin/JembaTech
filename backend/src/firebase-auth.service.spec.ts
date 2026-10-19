jest.mock('firebase-admin/app', () => ({ getApps: jest.fn(() => []), initializeApp: jest.fn(() => ({ name: 'qa' })) }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
import { getAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase-admin/app';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthService } from './firebase-auth.service';

describe('Firebase: configuración pública y verificación oficial', () => {
  const previous = { ...process.env };
  const verifyIdToken = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FIREBASE_AUTH_ENABLED = 'true';
    process.env.FIREBASE_PROJECT_ID = 'jemba-qa';
    process.env.FIREBASE_WEB_API_KEY = 'public-sdk-config-qa';
    process.env.FIREBASE_WEB_APP_ID = 'qa-app-id';
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken });
    verifyIdToken.mockResolvedValue({ uid: 'qa-user', email: 'QA@example.invalid', email_verified: true,
      name: 'Nombre QA', firebase: { sign_in_provider: 'google.com' } });
  });
  afterEach(() => { process.env = { ...previous }; });

  it('desactivado no devuelve config ni verifica tokens', async () => {
    delete process.env.FIREBASE_AUTH_ENABLED;
    const service = new FirebaseAuthService();
    expect(service.publicConfig()).toEqual({ enabled: false });
    await expect(service.verifyGoogleToken('invalid')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(getAuth).not.toHaveBeenCalled();
  });

  it('expone solo cuatro campos públicos, nunca JWT_SECRET u otras variables', () => {
    process.env.JWT_SECRET = 'qa-private-not-public';
    expect(new FirebaseAuthService().publicConfig()).toEqual({ enabled: true, firebase: {
      apiKey: 'public-sdk-config-qa', appId: 'qa-app-id', projectId: 'jemba-qa', authDomain: 'jemba-qa.firebaseapp.com' } });
  });

  it('configuración incompleta o emulador rechazan el arranque habilitado', () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    expect(() => new FirebaseAuthService()).toThrow('emulador');
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIREBASE_WEB_APP_ID;
    expect(() => new FirebaseAuthService()).toThrow('configuración');
  });

  it('usa el proyecto explícito y verifyIdToken del SDK; normaliza el correo', async () => {
    expect(await new FirebaseAuthService().verifyGoogleToken('id-token-qa')).toEqual({ uid: 'qa-user', email: 'qa@example.invalid', name: 'Nombre QA' });
    expect(initializeApp).toHaveBeenCalledWith({ projectId: 'jemba-qa' }, 'jembatech-auth-jemba-qa');
    expect(verifyIdToken).toHaveBeenCalledWith('id-token-qa');
  });

  it.each([
    { email_verified: false }, { firebase: { sign_in_provider: 'password' } }, { uid: '' }, { email: 'invalid' },
  ])('rechaza identidad incompleta, no verificada o proveedor ajeno: %o', async change => {
    verifyIdToken.mockResolvedValue({ uid: 'qa-user', email: 'qa@example.invalid', email_verified: true,
      firebase: { sign_in_provider: 'google.com' }, ...change });
    await expect(new FirebaseAuthService().verifyGoogleToken('id-token-qa')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('error de firma/audience/expiración del SDK se convierte en 401 sin filtrar causas', async () => {
    verifyIdToken.mockRejectedValue(new Error('sensitive-token-debug'));
    await expect(new FirebaseAuthService().verifyGoogleToken('invalid')).rejects.toThrow('No se pudo validar');
  });
});

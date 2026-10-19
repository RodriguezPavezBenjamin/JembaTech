jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuthService } from './auth.service';

describe('Google: identidad vinculada a PostgreSQL, sin elevar permisos por correo', () => {
  const password = randomBytes(24).toString('hex');
  const client = { id: 'local-user', name: 'Cuenta QA', email: 'qa@example.invalid', phone: null,
    role: 'CLIENT' as const, passwordHash: bcrypt.hashSync(password, 4), firebaseUid: null as string | null };
  const identity = { uid: 'firebase-qa', email: client.email, name: 'Cuenta Google QA' };
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
  const jwt = { signAsync: jest.fn() };
  const firebase = { verifyGoogleToken: jest.fn(), publicConfig: jest.fn() };
  const service = new AuthService(prisma as never, jwt as never, firebase as never);

  beforeEach(() => { jest.resetAllMocks(); firebase.verifyGoogleToken.mockResolvedValue(identity); });

  it('crea exclusivamente CLIENT y no crea un JWT local con el token Google', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ ...client, firebaseUid: identity.uid, passwordHash: null });
    const session = await service.googleLogin('id-token-qa');
    expect(prisma.user.create).toHaveBeenCalledWith({ data: { name: identity.name, email: identity.email,
      firebaseUid: identity.uid, passwordHash: null, role: 'CLIENT' } });
    expect(session.user.authProvider).toBe('GOOGLE');
    expect(session.user).not.toHaveProperty('passwordHash');
    expect(session.accessToken).toBe('id-token-qa');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('no asocia por correo una cuenta existente, aunque sea administrador', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...client, role: 'ADMIN' });
    await expect(service.googleLogin('id-token-qa')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('conserva el rol actual del usuario ya vinculado por UID', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...client, role: 'ADMIN', firebaseUid: identity.uid });
    const session = await service.googleLogin('id-token-qa');
    expect(session.user.role).toBe('ADMIN');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { firebaseUid: identity.uid } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('token inválido no llega a buscar ni crear un usuario', async () => {
    firebase.verifyGoogleToken.mockRejectedValue(new UnauthorizedException());
    await expect(service.googleLogin('invalid')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('la vinculación requiere contraseña local correcta y el mismo correo Google', async () => {
    prisma.user.findUnique.mockResolvedValue(client);
    await expect(service.linkGoogle(client.id, 'id-token-qa', 'incorrecta')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(firebase.verifyGoogleToken).not.toHaveBeenCalled();
    firebase.verifyGoogleToken.mockResolvedValue({ ...identity, email: 'otra@example.invalid' });
    await expect(service.linkGoogle(client.id, 'id-token-qa', password)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('vincula solo el UID; mantiene UUID, contraseña, rol y cotizaciones', async () => {
    const admin = { ...client, role: 'ADMIN' as const };
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.user.update.mockResolvedValue({ ...admin, firebaseUid: identity.uid });
    const session = await service.linkGoogle(client.id, 'id-token-qa', password);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: client.id }, data: { firebaseUid: identity.uid } });
    expect(session.user.id).toBe(client.id);
    expect(session.user.role).toBe('ADMIN');
  });

  it('cuenta exclusiva Google no admite acceso por contraseña local', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...client, passwordHash: null, firebaseUid: identity.uid });
    await expect(service.login(client.email, password)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('colisión concurrente no se convierte en una asociación por correo', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.googleLogin('id-token-qa')).rejects.toBeInstanceOf(ConflictException);
  });

  it('perfil Google permite nombre/teléfono, no solicita ni genera una contraseña local', async () => {
    const google = { ...client, firebaseUid: identity.uid, passwordHash: null };
    prisma.user.findUnique.mockResolvedValue(google);
    prisma.user.update.mockResolvedValue(google);
    const session = await service.updateProfile(client.id, { name: 'Nuevo nombre', phone: '12345678' }, 'GOOGLE');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: client.id }, data: { name: 'Nuevo nombre', phone: '12345678' } });
    expect(session).not.toHaveProperty('accessToken');
    await expect(service.updateProfile(client.id, { name: 'Nuevo', phone: '12345678', newPassword: password }, 'GOOGLE')).rejects.toThrow();
  });
});

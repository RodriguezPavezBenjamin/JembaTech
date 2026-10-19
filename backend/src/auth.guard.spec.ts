jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard, AuthenticatedRequest } from './auth.guard';

describe('Autorización: existencia y rol siempre actuales desde PostgreSQL', () => {
  const jwt = { verifyAsync: jest.fn() };
  const prisma = { user: { findUnique: jest.fn() } };
  const firebase = { verifyGoogleToken: jest.fn() };
  const guard = new JwtAuthGuard(jwt as never, prisma as never, firebase as never);
  let request: AuthenticatedRequest;
  let context: ExecutionContext;
  beforeEach(() => {
    jest.resetAllMocks();
    request = { headers: { authorization: 'Bearer qa-token' } } as AuthenticatedRequest;
    context = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
    prisma.user.findUnique.mockResolvedValue({ id: 'qa-local', email: 'qa@example.invalid', role: 'CLIENT' });
  });
  it('un JWT con rol ADMIN obsoleto no mantiene privilegios', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'qa-local', role: 'ADMIN' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user.role).toBe('CLIENT');
    expect(jwt.verifyAsync).toHaveBeenCalledWith('qa-token', { algorithms: ['HS256'] });
  });
  it('Firebase requiere token verificado y UID ya registrado', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('not local'));
    firebase.verifyGoogleToken.mockResolvedValue({ uid: 'qa-google' });
    await guard.canActivate(context);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { firebaseUid: 'qa-google' }, select: { id: true, email: true, role: true } });
    expect(request.user.authProvider).toBe('GOOGLE');
  });
  it('cuenta eliminada rechaza incluso un token válido', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'deleted' });
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('sin encabezado, token no válido o identidad no vinculada rechaza', async () => {
    request.headers = {};
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    request.headers = { authorization: 'Bearer invalid' };
    jwt.verifyAsync.mockRejectedValue(new Error('invalid'));
    firebase.verifyGoogleToken.mockRejectedValue(new UnauthorizedException());
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

import { ConflictException } from '@nestjs/common';

jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    name: 'Jemba',
    email: 'jemba@example.com',
    passwordHash: '$2b$12$Enz3sZeulBeIPSvTS.o42eLDqTftXz9WQ.k7b0m0vC9YVswmtv4aq',
    phone: '+56973752851',
    role: 'CLIENT' as const,
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('token-de-prueba') };
  const service = new AuthService(prisma as never, jwt as never, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it('normaliza el correo y entrega una sesión al registrar una cuenta', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);

    const session = await service.register({
      name: '  Jemba  ',
      email: ' JEMBA@EXAMPLE.COM ',
      password: 'clave-segura',
      phone: ' +56973752851 ',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Jemba',
          email: 'jemba@example.com',
          phone: '+56973752851',
        }),
      }),
    );
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    expect(session).toEqual({
      accessToken: 'token-de-prueba',
      user: expect.objectContaining({ id: user.id, email: user.email }),
    });
  });

  it('rechaza el registro cuando el correo ya existe', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      service.register({ name: 'Otra persona', email: user.email, password: 'clave-segura' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

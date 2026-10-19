import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma.service';
import { FirebaseAuthService } from './firebase-auth.service';

type RegisterInput = { name: string; email: string; password: string; phone?: string };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly firebase: FirebaseAuthService) {}

  googleConfig() { return this.firebase.publicConfig(); }

  async googleLogin(idToken: string) {
    const identity = await this.firebase.verifyGoogleToken(idToken);
    let user = await this.prisma.user.findUnique({ where: { firebaseUid: identity.uid } });
    if (!user) {
      const existing = await this.prisma.user.findUnique({ where: { email: identity.email } });
      if (existing) throw new ConflictException('Este correo ya tiene una cuenta local. Inicia sesión con su contraseña y vincula Google desde tu perfil.');
      try {
        user = await this.prisma.user.create({ data: { name: identity.name, email: identity.email,
          firebaseUid: identity.uid, passwordHash: null, role: 'CLIENT' } });
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
        user = await this.prisma.user.findUnique({ where: { firebaseUid: identity.uid } });
        if (!user) throw new ConflictException('No se pudo vincular esta identidad. Revisa la cuenta existente.');
      }
    }
    return { accessToken: idToken, user: this.publicUser(user, 'GOOGLE') };
  }

  async linkGoogle(userId: string, idToken: string, currentPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !await bcrypt.compare(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('La contraseña local actual no coincide.');
    }
    const identity = await this.firebase.verifyGoogleToken(idToken);
    if (identity.email !== user.email || (user.firebaseUid && user.firebaseUid !== identity.uid)) {
      throw new ConflictException('Google debe corresponder al mismo correo de esta cuenta.');
    }
    try {
      const updated = await this.prisma.user.update({ where: { id: userId }, data: { firebaseUid: identity.uid } });
      return { accessToken: idToken, user: this.publicUser(updated, 'GOOGLE') };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Esta identidad ya está vinculada a otra cuenta.');
      throw error;
    }
  }

  async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Ya existe una cuenta con ese correo.');
    const user = await this.prisma.user.create({
      data: { name: input.name.trim(), email, passwordHash: await bcrypt.hash(input.password, 12), phone: input.phone?.trim() || null },
    });
    return this.sessionFor(user);
  }

  async login(emailInput: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: emailInput.trim().toLowerCase() } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Correo o contrasena incorrectos.');
    return this.sessionFor(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true } });
    if (!user) throw new UnauthorizedException('La cuenta no existe.');
    return user;
  }

  async updateProfile(userId: string, input: { name: string; phone: string; currentPassword?: string; newPassword?: string }, provider: 'LOCAL' | 'GOOGLE' = 'LOCAL') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('La cuenta no existe.');
    if (provider === 'GOOGLE') {
      if (!user.firebaseUid || input.newPassword || input.currentPassword) throw new BadRequestException('La contraseña de Google se gestiona en tu cuenta de Google.');
      const updated = await this.prisma.user.update({ where: { id: userId }, data: { name: input.name.trim(), phone: input.phone.trim() } });
      return { user: this.publicUser(updated, 'GOOGLE') };
    }
    if (!user.passwordHash || !input.currentPassword || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) throw new UnauthorizedException('La contraseña actual no coincide.');
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { name: input.name.trim(), phone: input.phone.trim(), ...(input.newPassword ? { passwordHash: await bcrypt.hash(input.newPassword, 12) } : {}) } });
    return this.sessionFor(updated);
  }

  private publicUser(user: { id: string; name: string; email: string; phone: string | null; role: 'CLIENT' | 'ADMIN' }, authProvider: 'LOCAL' | 'GOOGLE') {
    return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, authProvider };
  }

  private async sessionFor(user: { id: string; name: string; email: string; phone: string | null; role: 'CLIENT' | 'ADMIN' }) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { accessToken, user: this.publicUser(user, 'LOCAL') };
  }
}

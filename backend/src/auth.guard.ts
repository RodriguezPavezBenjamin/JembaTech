import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser } from './auth.types';
import { PrismaService } from './prisma.service';
import { FirebaseAuthService } from './firebase-auth.service';

export type AuthenticatedRequest = Request & { user: AuthUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService, private readonly firebase: FirebaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Debes iniciar sesion.');
    try {
      const token = header.slice(7);
      let local: AuthUser | undefined;
      try { local = await this.jwt.verifyAsync<AuthUser>(token, { algorithms: ['HS256'] }); } catch { /* Puede ser un token Firebase. */ }
      const user = local
        ? await this.prisma.user.findUnique({ where: { id: local.sub }, select: { id: true, email: true, role: true } })
        : await this.prisma.user.findUnique({ where: { firebaseUid: (await this.firebase.verifyGoogleToken(token)).uid }, select: { id: true, email: true, role: true } });
      if (!user) throw new Error('Cuenta no disponible.');
      // Rol actual de PostgreSQL, nunca el enviado por el navegador ni uno obsoleto.
      request.user = { sub: user.id, email: user.email, role: user.role, authProvider: local ? 'LOCAL' : 'GOOGLE' };
      return true;
    } catch {
      throw new UnauthorizedException('Sesion invalida o expirada.');
    }
  }
}

import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) { response.destroy(); return; }
    // Conservar contratos de errores controlados; nunca publicar/loguear una
    // excepción imprevista (puede incluir SQL, credenciales o datos de una cuenta).
    if (error instanceof HttpException) {
      const payload = error.getResponse();
      response.status(error.getStatus()).json(typeof payload === 'string'
        ? { statusCode: error.getStatus(), message: payload } : payload);
    } else {
      response.status(500).json({ statusCode: 500, message: 'Error interno del servicio.', error: 'Internal Server Error' });
    }
  }
}

import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createRequestMiddleware } from './observability/observability';
import { SafeExceptionFilter } from './observability/safe-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new ConsoleLogger({ json: true }) });
  app.use(createRequestMiddleware());
  app.useGlobalFilters(new SafeExceptionFilter());
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, exposedHeaders: ['X-Request-Id'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const openApiConfig = new DocumentBuilder()
    .setTitle('JembaTech API')
    .setDescription('API para autenticación, evaluación de equipos y coordinación de cotizaciones.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth', 'Registro, sesión y perfil')
    .addTag('evaluations', 'Evaluación de compatibilidad')
    .addTag('quotes', 'Cotizaciones y coordinación')
    .build();
  const openApiDocument = () => SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('api/docs', app, openApiDocument, {
    jsonDocumentUrl: 'api/docs-json',
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

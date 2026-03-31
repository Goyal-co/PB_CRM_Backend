import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { createAppValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({ logger: true });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  await app.register(helmet as never);
  await app.register(multipart as never, {
    limits: { fileSize: 55 * 1024 * 1024 },
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createAppValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(), new AuditInterceptor());

  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>('app.corsOrigins', {
    infer: true,
  }) ?? ['http://localhost:3000'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle('Orchid Life CRM API')
    .setDescription('Real estate CRM for Goyal Hariyana Associates')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api/docs', app, document);

  // Initialize Nest (and its default parsers) first, then patch Fastify's JSON parser.
  // This avoids "Content type parser already present" during Nest init.
  await app.init();

  // Some clients send `Content-Type: application/json` with an empty body.
  // Fastify throws before Nest validation can respond nicely. Treat empty JSON as `{}`.
  const fastify = adapter.getInstance();
  if (typeof (fastify as any).removeContentTypeParser === 'function') {
    (fastify as any).removeContentTypeParser('application/json');
  }
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      const raw = typeof body === 'string' ? body.trim() : '';
      if (!raw) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw));
      } catch (e) {
        done(e as Error, undefined);
      }
    },
  );

  const port = configService.get<number>('app.port', { infer: true }) ?? 3000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

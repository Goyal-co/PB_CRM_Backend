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
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
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

  const port = configService.get<number>('app.port', { infer: true }) ?? 3000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

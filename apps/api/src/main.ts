import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { createHttpAdapter } from './http-adapter.js';

async function bootstrap() {
  const adapter = createHttpAdapter();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(
    Number(process.env.API_PORT ?? 3000),
    process.env.API_HOST ?? '127.0.0.1',
  );
}

void bootstrap();

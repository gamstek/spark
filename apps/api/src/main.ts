import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';

async function bootstrap() {
  const adapter = new FastifyAdapter({
    bodyLimit: 7 * 1024 * 1024,
    trustProxy: process.env.TRUST_PROXY ?? 'loopback',
    logger:
      process.env.NODE_ENV === 'production'
        ? {
            serializers: {
              req: (request: { method: string; url: string }) => ({
                method: request.method,
                url: request.url.split('?')[0],
              }),
            },
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.phone',
            ],
          }
        : false,
  });
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

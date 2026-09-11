import { FastifyAdapter } from '@nestjs/platform-fastify';

export function serializeHttpRequest<T extends { method: string; url: string }>(
  request: T,
) {
  return { method: request.method, url: request.url.split('?')[0] };
}

export function createHttpAdapter(): FastifyAdapter {
  const adapter = new FastifyAdapter({
    bodyLimit: 7 * 1024 * 1024,
    trustProxy: process.env.TRUST_PROXY ?? 'loopback',
    logger:
      process.env.NODE_ENV === 'production'
        ? {
            serializers: { req: serializeHttpRequest },
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.phone',
            ],
          }
        : false,
  });
  adapter
    .getInstance()
    .addContentTypeParser(
      ['text/xml', 'application/xml'],
      { parseAs: 'string', bodyLimit: 64 * 1024 },
      (_request, body, done) => done(null, body),
    );
  return adapter;
}

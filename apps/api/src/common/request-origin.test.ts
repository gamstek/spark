import { describe, expect, it } from 'vitest';

import { requestOrigin } from './request-origin.js';

describe('requestOrigin', () => {
  it('uses the public protocol resolved by Fastify and the request host', () => {
    expect(
      requestOrigin({
        protocol: 'https',
        headers: { host: 'spark.gamstek.com' },
      }),
    ).toBe('https://spark.gamstek.com');
  });

  it('preserves a local development port', () => {
    expect(
      requestOrigin({
        protocol: 'http',
        headers: { host: 'localhost:5173' },
      }),
    ).toBe('http://localhost:5173');
  });

  it('uses the original host forwarded by a trusted development proxy', () => {
    expect(
      requestOrigin({
        protocol: 'http',
        headers: {
          host: '127.0.0.1:3000',
          'x-forwarded-host': 'localhost:5173',
        },
      }),
    ).toBe('http://localhost:5173');
  });

  it('rejects missing or malformed hosts', () => {
    expect(() => requestOrigin({ protocol: 'https', headers: {} })).toThrow(
      'VALIDATION_ERROR',
    );
    expect(() =>
      requestOrigin({
        protocol: 'https',
        headers: { host: 'spark.gamstek.com/path' },
      }),
    ).toThrow('VALIDATION_ERROR');
  });
});

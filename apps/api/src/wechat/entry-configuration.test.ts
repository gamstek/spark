import { describe, expect, it } from 'vitest';
import { resolvePublicBaseUrl } from './entry-configuration.js';

describe('activity entry public origin configuration', () => {
  it.each(['development', 'test'])(
    'uses the localhost fallback only in %s',
    (environment) => {
      expect(resolvePublicBaseUrl(undefined, environment)).toBe(
        'http://localhost:3000',
      );
    },
  );

  it.each(['production', 'staging'])(
    'requires an explicit origin in %s',
    (environment) => {
      expect(() => resolvePublicBaseUrl(undefined, environment)).toThrow(
        'PUBLIC_BASE_URL_REQUIRED',
      );
    },
  );

  it.each(['https://spark.example', 'https://spark.example/'])(
    'normalizes the HTTPS origin %s',
    (origin) => {
      expect(resolvePublicBaseUrl(origin, 'production')).toBe(
        'https://spark.example',
      );
    },
  );

  it.each([
    '',
    'http://spark.example',
    'https://spark.example/path',
    'https://spark.example/?a=1',
    'https://spark.example/#fragment',
    'https://user:secret@spark.example',
    'https://spark.example/..',
    'https://spark.example?',
    'https://spark.example#',
    '//spark.example',
    'not-a-url',
  ])('rejects unsafe configuration %s', (origin) => {
    expect(() => resolvePublicBaseUrl(origin, 'production')).toThrow(
      /PUBLIC_BASE_URL_(INVALID|REQUIRED)/,
    );
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('production proxy privacy', () => {
  it.each(['nginx/nginx.conf', 'nginx/sites-available/spark.gamstek.com.conf'])(
    'logs request paths without query strings or referrers in %s',
    (path) => {
      const configuration = readFileSync(`${repositoryRoot}${path}`, 'utf8');
      expect(configuration).toMatch(/access_log\s+\S+\s+spark_safe;/);
      const format = configuration.match(
        /log_format\s+spark_safe\s+([^;]+);/,
      )?.[1];
      expect(format).toContain('$uri');
      expect(format).not.toMatch(/\$request(?!_)/);
      expect(format).not.toContain('$args');
      expect(format).not.toContain('$http_referer');
    },
  );

  it.each([200, 403])(
    'keeps callback query and referrer secrets out of a %s access record',
    (status) => {
      const configuration = readFileSync(
        `${repositoryRoot}nginx/sites-available/spark.gamstek.com.conf`,
        'utf8',
      );
      const format = configuration.match(
        /log_format\s+spark_safe\s+([^;]+);/,
      )?.[1];
      const record = format
        ?.replaceAll('$request_method', 'POST')
        .replaceAll('$uri', '/api/wechat/callback')
        .replaceAll('$status', String(status));
      expect(record).toContain('/api/wechat/callback');
      expect(record).toContain(String(status));
      expect(record).not.toContain('captured-signature');
      expect(record).not.toContain('entry-token-in-referrer');
    },
  );
});

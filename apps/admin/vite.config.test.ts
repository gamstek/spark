import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigEnv, UserConfig, UserConfigExport } from 'vite';

import activityConfig from '../activity/vite.config.js';
import adminConfig from './vite.config.js';
import staffConfig from '../staff/vite.config.js';
import { apiProxyTarget } from '../../vite-api-proxy.mjs';

const originalApiPort = process.env.API_PORT;

async function resolveConfig(config: UserConfigExport): Promise<UserConfig> {
  const environment: ConfigEnv = {
    command: 'serve',
    mode: 'development',
    isPreview: false,
    isSsrBuild: false,
  };
  return typeof config === 'function' ? config(environment) : await config;
}

describe('development API proxies', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalApiPort === undefined) delete process.env.API_PORT;
    else process.env.API_PORT = originalApiPort;
  });

  it.each([
    ['activity', activityConfig],
    ['admin', adminConfig],
    ['staff', staffConfig],
  ])('uses API_PORT for the %s proxy', async (_name, config) => {
    vi.stubEnv('API_HOST', '127.0.0.1');
    vi.stubEnv('API_PROXY_TARGET', '');
    process.env.API_PORT = '43129';

    const resolved = await resolveConfig(config);

    expect(resolved.server?.proxy?.['/api']).toMatchObject({
      target: 'http://127.0.0.1:43129',
      changeOrigin: true,
      xfwd: true,
    });
  });

  it('loads the root env file and lets shell settings override it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'spark-proxy-env-'));
    vi.stubEnv('API_HOST', undefined);
    vi.stubEnv('API_PORT', undefined);
    vi.stubEnv('API_PROXY_TARGET', undefined);
    try {
      await writeFile(
        join(directory, '.env'),
        'API_HOST=0.0.0.0\nAPI_PORT=43130\n',
      );
      expect(apiProxyTarget(directory)).toBe('http://127.0.0.1:43130');
      vi.stubEnv('API_PORT', '43131');
      expect(apiProxyTarget(directory)).toBe('http://127.0.0.1:43131');
      vi.stubEnv('API_PROXY_TARGET', 'https://backend.example.test');
      expect(apiProxyTarget(directory)).toBe('https://backend.example.test');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

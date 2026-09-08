import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { join } from 'node:path';

export const repositoryEnvDirectory = fileURLToPath(
  new URL('./', import.meta.url),
);

export function apiProxyTarget(envDirectory = repositoryEnvDirectory): string {
  let fileEnv: Record<string, string | undefined> = {};
  try {
    fileEnv = parseEnv(readFileSync(join(envDirectory, '.env'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const env = { ...fileEnv, ...process.env };
  if (env.API_PROXY_TARGET) return env.API_PROXY_TARGET;
  const host = env.API_HOST || '127.0.0.1';
  const connectHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  const urlHost =
    connectHost.includes(':') && !connectHost.startsWith('[')
      ? `[${connectHost}]`
      : connectHost;
  return `http://${urlHost}:${env.API_PORT || '3000'}`;
}

#!/usr/bin/env node
// Starts a local embedded PostgreSQL matching compose.yaml's test settings.
// Keeps running in the foreground so callers can hold it as a background task.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import EmbeddedPostgres from 'embedded-postgres';

const port = Number(process.env.POSTGRES_PORT ?? 54329);
const user = process.env.POSTGRES_USER ?? 'spark';
const password = process.env.POSTGRES_PASSWORD ?? 'spark_local';
const database = process.env.POSTGRES_DB ?? 'spark_test';
const databaseDir =
  process.env.POSTGRES_DATA_DIR ?? 'node_modules/.cache/spark-pg';

const pg = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
  // Pin a deterministic locale and encoding for fresh clusters. initdb cannot
  // find a built-in text-search configuration for some host locales (e.g. a
  // Chinese Windows system reports `Chinese (Simplified)_China.936`), which
  // aborts initialisation; `--locale=C` exists on every platform so the
  // cluster boots identically for all team members. Explicitly requesting
  // UTF-8 keeps stored data (including non-Latin text) intact even though the
  // locale is `C`.
  initdbFlags: ['--locale=C', '--encoding=UTF8'],
});

// Refuse to start if the port is already in use. This usually means another
// test PostgreSQL is running: either this embedded one, or a `docker compose
// up postgres` container that was brought up but never torn down. Diving in
// anyway would fail deep inside postgres startup with a cryptic EADDRINUSE.
const net = await import('node:net');
const portFree = await new Promise((resolve) => {
  const probe = net.createConnection({ port, host: '127.0.0.1' });
  probe.once('connect', () => {
    probe.destroy();
    resolve(false);
  });
  probe.once('error', () => resolve(true));
});
if (!portFree) {
  console.error(
    [
      `port ${port} is already in use — another PostgreSQL is already listening.`,
      'To run this embedded instance, stop the existing one first, e.g.:',
      '  docker compose down   # if a compose container holds the port',
      `  netstat -ano | findstr :${port}   # to see the owning PID`,
    ].join('\n'),
  );
  process.exit(1);
}

// initdb must only run once per data directory: a second run on an existing
// cluster aborts with "directory exists but is not empty". PG_VERSION marks a
// complete cluster, so skip initialise() when restarting an existing one.
const clusterExists = existsSync(join(databaseDir, 'PG_VERSION'));
if (clusterExists) {
  console.log(`existing cluster detected at ${databaseDir}, skipping initdb`);
} else {
  await pg.initialise();
  try {
    await pg.createDatabase(database);
  } catch (error) {
    // Database may already exist; that is fine.
    if (!String(error).toLowerCase().includes('already exists')) throw error;
  }
}
await pg.start();
console.log(
  `embedded postgres ready on 127.0.0.1:${port} (user=${user}, db=${database}, data=${databaseDir})`,
);
console.log('keep-alive: press Ctrl+C to stop');
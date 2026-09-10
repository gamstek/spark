// Quick DB viewer: node scripts/db-query.mjs "SELECT * FROM activities"
// Uses the pg driver bundled with apps/api.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(
  resolve(import.meta.dirname, '../apps/api/package.json'),
);
const pg = require('pg');

const sql = process.argv[2] ?? 'SELECT 1';
const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://spark:spark_local@127.0.0.1:54329/spark_test',
});

await client.connect();
try {
  const res = await client.query(sql);
  console.table(res.rows);
  console.log(`(${res.rowCount} rows)`);
} finally {
  await client.end();
}

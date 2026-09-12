import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

test('generates labeled application secrets without modifying environment files', () => {
  assert.equal(
    packageJson.scripts['env:generate-secrets'],
    'node scripts/generate-env-secrets.mjs',
  );

  const output = execFileSync(
    process.execPath,
    [fileURLToPath(new URL('./generate-env-secrets.mjs', import.meta.url))],
    { encoding: 'utf8' },
  );
  const lines = output.trim().split(/\r?\n/);
  const keys = lines.map((line) => {
    const separator = line.indexOf('=');
    assert.ok(separator > 0, `expected KEY=VALUE output, received ${line}`);
    return line.slice(0, separator);
  });
  const values = Object.fromEntries(
    lines.map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
  );

  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(keys.sort(), [
    'CSRF_SECRET',
    'OAUTH_STATE_SECRET',
    'REDEEM_CODE_ACTIVE_KEY_ID',
    'REDEEM_CODE_KEYS',
    'WECHAT_TOKEN_ENCRYPTION_KEY',
  ]);
  assert.equal('WECHAT_CALLBACK_TOKEN' in values, false);
  assert.equal('PUBLIC_BASE_URL' in values, false);
  assert.match(values.CSRF_SECRET, /^csrf-[A-Za-z0-9_-]{43}$/);
  assert.match(values.OAUTH_STATE_SECRET, /^oauth-[A-Za-z0-9_-]{43}$/);
  assert.match(
    values.WECHAT_TOKEN_ENCRYPTION_KEY,
    /^wechat-token-[A-Za-z0-9_-]{43}$/,
  );
  assert.equal(values.REDEEM_CODE_ACTIVE_KEY_ID, 'v1');

  const redemptionKeys = JSON.parse(values.REDEEM_CODE_KEYS);
  assert.deepEqual(Object.keys(redemptionKeys), ['v1']);
  assert.equal(Buffer.from(redemptionKeys.v1, 'base64').length, 32);
});

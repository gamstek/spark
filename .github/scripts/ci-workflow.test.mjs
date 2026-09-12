import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(
  new URL('../workflows/ci.yml', import.meta.url),
  'utf8',
);
const releaseWorkflow = await readFile(
  new URL('../workflows/release.yml', import.meta.url),
  'utf8',
);
const productionCompose = await readFile(
  new URL('../../compose.production.yaml', import.meta.url),
  'utf8',
);
const webDockerfile = await readFile(
  new URL('../../nginx/Dockerfile', import.meta.url),
  'utf8',
);
const deploymentScript = await readFile(
  new URL('./deploy-production.sh', import.meta.url),
  'utf8',
);
const hostNginxConfig = await readFile(
  new URL(
    '../../nginx/sites-available/spark.gamstek.com.conf',
    import.meta.url,
  ),
  'utf8',
);

function job(name) {
  const match = workflow.match(
    new RegExp(
      `^  ${name}:\\r?\\n([\\s\\S]*?)(?=^  [a-z0-9_]+:\\r?$|(?![\\s\\S]))`,
      'm',
    ),
  );
  assert.ok(match, `CI job not found: ${name}`);
  return match[1];
}

test('runs database-backed template compatibility after migrations', () => {
  const staticJob = job('static');
  const integrationJob = job('integration');

  assert.doesNotMatch(staticJob, /templates:check/);
  assert.match(
    integrationJob,
    /db:migrate[^\n]*\n?[^\n]*templates:check[^\n]*\n?[^\n]*test:integration/,
  );
});

test('verifies release ancestry from the full checkout without another authenticated fetch', () => {
  assert.match(releaseWorkflow, /fetch-depth: 0/);
  assert.match(releaseWorkflow, /persist-credentials: false/);
  assert.doesNotMatch(releaseWorkflow, /git fetch/);
  assert.match(
    releaseWorkflow,
    /git merge-base --is-ancestor "\$SOURCE_SHA" origin\/main/,
  );
});

test('stages releases on ECS without automatically activating them', () => {
  assert.match(
    releaseWorkflow,
    /uses: \.\/\.github\/workflows\/deploy-production\.yml/,
  );
});

test('uses the PostgreSQL 18 volume layout and includes database failure logs', () => {
  assert.match(productionCompose, /database:\/var\/lib\/postgresql(?:\r?\n|$)/);
  assert.doesNotMatch(
    productionCompose,
    /database:\/var\/lib\/postgresql\/data/,
  );
  assert.match(deploymentScript, /logs --tail 100 postgres api web/);
});

test('inherits the production API image command', () => {
  const config = JSON.parse(
    execFileSync(
      'docker',
      [
        'compose',
        '-f',
        'compose.production.yaml',
        'config',
        '--format',
        'json',
      ],
      {
        cwd: new URL('../..', import.meta.url),
        encoding: 'utf8',
        env: {
          ...process.env,
          POSTGRES_PASSWORD: 'test',
          DATABASE_URL: 'postgresql://spark:test@postgres:5432/spark',
          CSRF_SECRET: 'test-csrf-secret',
          OAUTH_STATE_SECRET: 'test-oauth-secret',
          WECHAT_APP_ID: 'test-app-id',
          WECHAT_APP_SECRET: 'test-app-secret',
          WECHAT_TOKEN_ENCRYPTION_KEY: 'test-encryption-key',
          REDEEM_CODE_ACTIVE_KEY_ID: 'test-key',
          REDEEM_CODE_KEYS: '{"test-key":"test-value"}',
        },
      },
    ),
  );

  assert.equal(config.services.api.command, null);
});

test('builds web applications with their workspace dependencies', () => {
  assert.match(
    webDockerfile,
    /pnpm --filter @spark\/activity\.\.\.\s+\\\s+--filter @spark\/staff\.\.\.\s+\\\s+--filter @spark\/admin\.\.\.\s+\\\s+build/,
  );
});

test('routes the host Nginx site through a named upstream', () => {
  assert.match(hostNginxConfig, /upstream spark_web \{/);
  assert.match(hostNginxConfig, /server 127\.0\.0\.1:18080;/);
  assert.match(hostNginxConfig, /proxy_pass http:\/\/spark_web;/);
  assert.doesNotMatch(
    hostNginxConfig,
    /proxy_pass http:\/\/127\.0\.0\.1:18080/,
  );
});

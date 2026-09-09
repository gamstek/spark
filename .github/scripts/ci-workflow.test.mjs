import assert from 'node:assert/strict';
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

test('passes production secrets to the reusable deployment workflow', () => {
  assert.match(
    releaseWorkflow,
    /  deploy:\r?\n[\s\S]*?uses: \.\/\.github\/workflows\/deploy-production\.yml[\s\S]*?secrets: inherit/,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveReleaseMetadata } from './release-metadata.mjs';

const sha = '0123456789abcdef0123456789abcdef01234567';

test('accepts a stable SemVer tag', () => {
  assert.deepEqual(
    resolveReleaseMetadata({
      eventName: 'push',
      refType: 'tag',
      refName: 'v1.2.3',
      sha,
    }),
    { sourceSha: sha, version: 'v1.2.3', versionTag: 'v1.2.3' },
  );
});

test('accepts a SemVer prerelease tag', () => {
  assert.equal(
    resolveReleaseMetadata({
      eventName: 'push',
      refType: 'tag',
      refName: 'v2.0.0-rc.1',
      sha,
    }).version,
    'v2.0.0-rc.1',
  );
});

test('rejects a loose v-prefix tag', () => {
  assert.throws(
    () =>
      resolveReleaseMetadata({
        eventName: 'push',
        refType: 'tag',
        refName: 'version-test',
        sha,
      }),
    /valid SemVer/,
  );
});

test('creates a manual display version without a registry version tag', () => {
  assert.deepEqual(
    resolveReleaseMetadata({
      eventName: 'workflow_dispatch',
      refType: 'branch',
      refName: 'main',
      sha,
    }),
    { sourceSha: sha, version: 'manual-0123456789ab', versionTag: '' },
  );
});

test('rejects a non-commit SHA', () => {
  assert.throws(
    () =>
      resolveReleaseMetadata({
        eventName: 'workflow_dispatch',
        refType: 'branch',
        refName: 'main',
        sha: 'main',
      }),
    /40-character lowercase Git SHA/,
  );
});

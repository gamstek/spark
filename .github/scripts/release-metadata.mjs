import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const shaPattern = /^[0-9a-f]{40}$/;
const semVerPattern =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;

export function resolveReleaseMetadata({ eventName, refType, refName, sha }) {
  if (!shaPattern.test(sha)) {
    throw new Error('source SHA must be a 40-character lowercase Git SHA');
  }

  if (eventName === 'workflow_dispatch') {
    return {
      sourceSha: sha,
      version: `manual-${sha.slice(0, 12)}`,
      versionTag: '',
    };
  }

  if (eventName !== 'push') {
    throw new Error(
      'release metadata requires a push or workflow_dispatch event',
    );
  }

  if (refType !== 'tag') {
    throw new Error('push releases require a tag ref');
  }

  if (!semVerPattern.test(refName)) {
    throw new Error('release tag must be valid SemVer');
  }

  return { sourceSha: sha, version: refName, versionTag: refName };
}

function escapeOutputValue(value) {
  return value
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

function writeGitHubOutput(metadata, outputPath) {
  const output = Object.entries({
    source_sha: metadata.sourceSha,
    version: metadata.version,
    version_tag: metadata.versionTag,
  })
    .map(([key, value]) => `${key}=${escapeOutputValue(value)}`)
    .join('\n');

  appendFileSync(outputPath, `${output}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const metadata = resolveReleaseMetadata({
    eventName: process.env.GITHUB_EVENT_NAME,
    refType: process.env.GITHUB_REF_TYPE,
    refName: process.env.GITHUB_REF_NAME,
    sha: process.env.GITHUB_SHA,
  });

  if (!process.env.GITHUB_OUTPUT) {
    throw new Error('GITHUB_OUTPUT is required');
  }

  writeGitHubOutput(metadata, process.env.GITHUB_OUTPUT);
}

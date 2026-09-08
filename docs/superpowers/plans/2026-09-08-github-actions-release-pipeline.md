# GitHub Actions Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current serial workflows with parallel CI, digest-based
image releases, protected ECS deployment, and health-check rollback.

**Architecture:** `ci.yml` is the reusable quality gate, `release.yml` validates
a manual or SemVer release and publishes API/Web images once, and
`deploy-production.yml` promotes those exact OCI digests through the protected
`production` Environment. A tested server script deploys versioned Compose
configuration under `/opt/spark/releases` and restores the previous release when
local readiness fails.

**Tech Stack:** GitHub Actions, pnpm 10.15.1, Node.js 24.11.0, Turborepo, Docker
Buildx, GHCR, Bash, Docker Compose, Nginx, PostgreSQL

**Spec:**
`docs/superpowers/specs/2026-09-08-github-actions-release-pipeline-design.md`

## Global Constraints

- Work directly on `main`, as requested by the repository owner, and commit each
  completed task separately.
- PR and `main` pushes run CI only; they never publish images or deploy.
- Releases start only from `workflow_dispatch` or a tag matching strict SemVer
  `vMAJOR.MINOR.PATCH` with an optional prerelease suffix.
- Every released source SHA must be an ancestor of `origin/main`.
- Production images are deployed as
  `image@sha256:<64 lowercase hex characters>`; `latest` is forbidden.
- Production deployment retains password SSH through `sshpass -e` and strict
  `known_hosts` verification.
- PostgreSQL stays in its own Compose container and named volume; do not add
  `pg_dump` or automated backup.
- The `production` Environment is the only location for ECS secrets and must
  enforce external reviewer and tag/branch rules.
- Production deployment uses one non-cancelling concurrency group and never runs
  in parallel.
- Database migrations must remain compatible with the previous application
  release; rollback never reverses schema migrations.

---

### Task 1: Testable release metadata validation

**Files:**

- Create: `.github/scripts/release-metadata.mjs`
- Create: `.github/scripts/release-metadata.test.mjs`

**Interfaces:**

- Consumes:
  `{ eventName: string, refType: string, refName: string, sha: string }`
- Produces:
  `resolveReleaseMetadata(input): { sourceSha: string; version: string; versionTag: string }`
- CLI writes `source_sha`, `version`, and `version_tag` to the file named by
  `GITHUB_OUTPUT`; `versionTag` is empty for manual releases.

- [x] **Step 1: Write failing metadata tests**

Use `node:test` to cover a stable release, prerelease, invalid `v*` tag, manual
release, and invalid SHA:

```js
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
```

- [x] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --test .github/scripts/release-metadata.test.mjs
```

Expected: FAIL because `release-metadata.mjs` does not exist.

- [x] **Step 3: Implement the resolver and CLI**

Use the exact SHA pattern `/^[0-9a-f]{40}$/` and SemVer pattern
`/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/`.
Reject tag pushes whose `refType` is not `tag`, and reject events other than
`push` and `workflow_dispatch`. When invoked as the main module, read
`GITHUB_EVENT_NAME`, `GITHUB_REF_TYPE`, `GITHUB_REF_NAME`, `GITHUB_SHA`, and
append escaped values to `GITHUB_OUTPUT`.

- [x] **Step 4: Run the focused test and formatter**

Run:

```bash
node --test .github/scripts/release-metadata.test.mjs
pnpm exec prettier --check .github/scripts/release-metadata.mjs .github/scripts/release-metadata.test.mjs
```

Expected: five tests pass and Prettier reports both files formatted.

- [x] **Step 5: Commit the release validator**

```bash
git add .github/scripts/release-metadata.mjs .github/scripts/release-metadata.test.mjs
git commit -m "Validate release metadata"
```

### Task 2: Shared workspace setup and parallel CI

**Files:**

- Create: `.github/actions/setup-workspace/action.yml`
- Create: `.github/workflows/ci.yml`
- Modify: the legacy quality-gate workflow as a temporary compatibility caller

**Interfaces:**

- Consumes: checked-out repository and `pnpm-lock.yaml`
- Produces: installed pnpm 10.15.1 workspace on Node.js 24.11.0
- Produces required check jobs named `static`, `unit`, `build`, `integration`,
  and `e2e`

- [x] **Step 1: Add a failing CI structure assertion**

Run this before the rename and expect `ci.yml is missing`:

```powershell
$ciPath = '.github/workflows/ci.yml'
if (-not (Test-Path $ciPath)) { throw 'ci.yml is missing' }
$ci = Get-Content -Raw $ciPath
foreach ($job in 'static','unit','build','integration','e2e') {
  if ($ci -notmatch "(?m)^  ${job}:") { throw "CI job $job is missing" }
}
```

- [x] **Step 2: Create the composite setup action**

Use `pnpm/action-setup@f40ffcd9367d9f12939873eb1018b921a783ffaa` and
`actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020`. Fix pnpm to
`10.15.1`, Node to `24.11.0`, enable the setup-node pnpm cache, then run
`pnpm install --frozen-lockfile` from a Bash composite step.

- [x] **Step 3: Create split CI and its compatibility caller**

Configure:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  workflow_call:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

Every job uses `ubuntu-24.04`, a 20-minute timeout, pinned checkout
`d23441a48e516b6c34aea4fa41551a30e30af803`, `persist-credentials: false`, and
the local setup action. Map commands exactly:

```text
static      pnpm --filter @spark/api templates:check; pnpm lint; pnpm typecheck
unit        pnpm test
build       pnpm build
integration pnpm --filter @spark/api db:migrate; pnpm test:integration
e2e         pnpm --filter @spark/api db:migrate; install Chromium; run the three existing E2E specs
```

Give `integration` and `e2e` independent `postgres:18-alpine` services using
`spark_test`, and reuse the existing test environment values. Pin the Playwright
browser install and test commands already used by the repository. Replace the
legacy quality-gate workflow with a temporary `workflow_call`-only wrapper whose
single job calls `./.github/workflows/ci.yml`. This keeps the existing release
workflow valid until Task 4 switches callers, without running duplicate CI on
PRs or `main` pushes.

- [x] **Step 4: Run CI structure and syntax checks**

Run the Step 1 assertion and expect PASS, then:

```bash
node --test .github/scripts/release-metadata.test.mjs
docker run --rm -i rhysd/actionlint:1.7.12 -color - < .github/workflows/ci.yml
pnpm exec prettier --check .github/actions/setup-workspace/action.yml .github/workflows/ci.yml
```

Expected: release tests pass, actionlint exits 0, and formatting passes.

- [x] **Step 5: Commit parallel CI**

```bash
git add .github/actions/setup-workspace/action.yml .github/workflows/ci.yml
git add -u .github/workflows
git commit -m "Split CI into parallel quality gates"
```

### Task 3: Versioned ECS deployment and rollback

**Files:**

- Create: `.github/scripts/deploy-production.sh`
- Create: `.github/scripts/deploy-production.test.sh`
- Create: `.github/workflows/deploy-production.yml`

**Interfaces:**

- Called workflow inputs: `source_sha`, `version`, `api_digest`, `web_digest`
- Manual workflow input: `source_sha`
- Script invocation: `deploy-production.sh <deploy-root> <incoming-release-id>`
- Release directory contains `compose.production.yaml`, `.env.release`, and
  `release.json`

- [x] **Step 1: Write a failing rollback test harness**

Create a Bash test that uses a temporary deployment root and prepends fake
`docker`, `curl`, and `sleep` executables to `PATH`. Cover two cases:

1. Successful readiness moves `.incoming-new` to `releases/new` and atomically
   points `current` to `releases/new`.
2. Failed candidate readiness leaves `current` on `releases/old`, invokes
   Compose once with the old `.env.release`, and exits non-zero.

Record fake Docker arguments in `$TEST_COMMAND_LOG` and assert the fixed project
arguments include `docker compose -p spark`. Run:

```bash
bash .github/scripts/deploy-production.test.sh
```

Expected: FAIL because `deploy-production.sh` does not exist.

- [x] **Step 2: Implement the server deployment script**

Start with `set -eu`. Validate the deployment root is absolute and the release
id matches `^[A-Za-z0-9._-]+$`. Require `.env.production` mode to exclude
group/other permissions, require all three incoming files, and reject an
existing final release directory.

Use this fixed Compose interface for both candidate and rollback:

```bash
compose_release() {
  release_dir=$1
  docker compose -p spark \
    --env-file "$deploy_root/.env.production" \
    --env-file "$release_dir/.env.release" \
    -f "$release_dir/compose.production.yaml" "$@"
}
```

Move the incoming directory to its final immutable path, start with
`up -d --no-build --remove-orphans`, and poll local readiness 20 times with
three-second intervals. Update `current` through a temporary symlink and atomic
`mv` only after success. On failure, restore the previous release with the same
Compose project and recheck readiness; if no previous release exists, run
candidate `down` without `--volumes`. Emit `compose ps` plus the last 100
API/Web log lines through a filter that replaces values following `password`,
`secret`, `token`, `authorization`, or `cookie` with `[REDACTED]`.

- [x] **Step 3: Define reusable and manual deployment inputs**

Create the workflow as `Deploy Production`. `workflow_call` requires all four
exact inputs. `workflow_dispatch` requires only a lowercase 40-character
`source_sha`; a `resolve` job checks that commit out with full history, verifies
it belongs to `origin/main`, logs into GHCR with `packages: read`, and resolves
both `sha-<source_sha>` tags to digests using
`docker buildx imagetools inspect`. Called releases validate the supplied
digests instead of resolving tags.

The deployment job must declare:

```yaml
environment:
  name: production
  url: https://spark.gamstek.com
concurrency:
  group: production-aliyun-ecs
  cancel-in-progress: false
```

Keep the current ECS secret names, `sshpass -e`, strict host checking, and
connection timeout.

- [x] **Step 4: Upload an immutable release candidate**

Generate a release id from the validated version, 12-character source SHA, run
id, and run attempt. Create `.env.release` with digest references:

```dotenv
SPARK_API_IMAGE=ghcr.io/gamstek/spark-api@${API_DIGEST}
SPARK_WEB_IMAGE=ghcr.io/gamstek/spark-web@${WEB_DIGEST}
```

Generate `release.json` with `version`, `sourceSha`, `configSha`, `apiImage`,
`webImage`, `runId`, and an ISO-8601 `createdAt`. Upload the Compose file,
environment file, manifest, and deployment script to
`/opt/spark/releases/.incoming-${release_id}`, then invoke the uploaded script.
Never overwrite `.env.production`.

- [x] **Step 5: Preserve local and public health semantics**

Treat local readiness failure as a deployment failure even when rollback
succeeds. Keep `ECS_HEALTHCHECK_URL` optional until DNS/TLS activation; once
set, require HTTPS and run it after the server script succeeds. A public-check
failure reports failure without rolling back a locally healthy release. Append
the version, source/config SHAs, both image digests, local/public health
results, and any rollback result to `GITHUB_STEP_SUMMARY`.

- [x] **Step 6: Run rollback, syntax, and structure checks**

```bash
bash .github/scripts/deploy-production.test.sh
bash -n .github/scripts/deploy-production.sh
docker run --rm -i rhysd/actionlint:1.7.12 -color - < .github/workflows/deploy-production.yml
pnpm exec prettier --check .github/workflows/deploy-production.yml
git diff --check
```

Expected: both deployment scenarios pass, Bash syntax is valid, actionlint exits
0, and formatting passes.

- [x] **Step 7: Commit production deployment**

```bash
git add .github/scripts/deploy-production.sh .github/scripts/deploy-production.test.sh .github/workflows/deploy-production.yml
git commit -m "Add versioned deployment with rollback"
```

### Task 4: Digest-based release orchestration

**Files:**

- Create: `.github/workflows/release.yml` from the legacy image publication
  workflow
- Delete: the legacy CI compatibility workflow
- Delete: the legacy ECS deployment workflow

**Interfaces:**

- Consumes: Task 1 CLI outputs and Task 2 reusable `ci.yml`
- Produces: `build_api.outputs.digest` and `build_web.outputs.digest`, each
  matching `sha256:<64 lowercase hex characters>`
- Calls: `deploy-production.yml` with `source_sha`, `version`, `api_digest`, and
  `web_digest`

- [x] **Step 1: Write a failing release structure assertion**

```powershell
$releasePath = '.github/workflows/release.yml'
if (-not (Test-Path $releasePath)) { throw 'release.yml is missing' }
$release = Get-Content -Raw $releasePath
foreach ($required in "tags: ['v*']", 'release-metadata.mjs', 'provenance: mode=max', 'sbom: true', 'api_digest:', 'web_digest:') {
  if (-not $release.Contains($required)) { throw "Release requirement missing: $required" }
}
if ($release -match ('latest|workflow' + '_run')) { throw 'Mutable or legacy release behavior remains' }
```

- [x] **Step 2: Validate release identity before quality gates**

Rename the workflow to `Release`. Keep only `workflow_dispatch` and
`push.tags: ['v*']`. Add non-cancelling concurrency `release-${{ github.ref }}`.
A `prepare` job checks out with `fetch-depth: 0`, runs the Task 1 CLI, fetches
`origin/main`, and executes:

```bash
git merge-base --is-ancestor "$SOURCE_SHA" origin/main || {
  echo "Release commit must belong to main" >&2
  exit 1
}
```

Expose `source_sha`, `version`, and `version_tag` as job outputs. Call `ci.yml`
after `prepare` and before either build.

- [x] **Step 3: Build API and Web once and export digests**

Create separate `build_api` and `build_web` jobs. Each receives only
`contents: read` and `packages: write`, checks out
`needs.prepare.outputs.source_sha`, logs into GHCR, generates the immutable
`sha-<source_sha>` tag plus the non-empty version tag, and uses the existing
pinned Docker actions. Configure `docker/build-push-action` with:

```yaml
platforms: linux/amd64
push: true
provenance: mode=max
sbom: true
```

Set each job output to `${{ steps.build.outputs.digest }}`. Do not rebuild these
images in any later job. Write the version, source SHA, API digest, and Web
digest to `GITHUB_STEP_SUMMARY` after both build jobs complete.

- [x] **Step 4: Call protected deployment with exact build outputs**

Add a final reusable-workflow job needing both builds:

```yaml
deploy:
  needs: [prepare, build_api, build_web]
  uses: ./.github/workflows/deploy-production.yml
  with:
    source_sha: ${{ needs.prepare.outputs.source_sha }}
    version: ${{ needs.prepare.outputs.version }}
    api_digest: ${{ needs.build_api.outputs.digest }}
    web_digest: ${{ needs.build_web.outputs.digest }}
```

Do not pass repository secrets from the release workflow; the called deployment
job reads only `production` Environment secrets.

- [x] **Step 5: Validate and commit the release workflow**

Run the Step 1 assertion and expect PASS, then:

```bash
docker run --rm -i rhysd/actionlint:1.7.12 -color - < .github/workflows/release.yml
pnpm exec prettier --check .github/workflows/release.yml
git diff --check
git add .github/workflows/release.yml
git add -u .github/workflows
git commit -m "Publish immutable release images"
```

### Task 5: Documentation, full validation, and repository handoff

**Files:**

- Modify: `docs/project-spark-deployment.md`
- Modify:
  `docs/superpowers/specs/2026-09-08-aliyun-ecs-production-deployment-design.md`
- Modify:
  `docs/superpowers/plans/2026-09-08-aliyun-ecs-production-deployment.md`
- Modify: `docs/superpowers/plans/2026-09-08-github-actions-release-pipeline.md`

**Interfaces:**

- Consumes: final names, inputs, digests, release directories, and rollback
  behavior from Tasks 1–4
- Produces: operator instructions for CI checks, manual releases, SemVer
  releases, approvals, rollback, and GitHub settings

- [x] **Step 1: Update operator documentation**

Document the three workflow names, strict SemVer examples, digest-based
deployment, `/opt/spark/releases`, `current`, automatic local-health rollback,
and manual rollback by source SHA. Remove every reference to the three old
workflow filenames and the old automatic-deploy flag.

- [x] **Step 2: Document required GitHub settings**

List the five CI required checks, `v*` tag protection, `production` required
reviewer, prevent-self-review rule, allowed deployment tags/default branch, and
Environment-only ECS secrets. State that private repositories require a GitHub
plan supporting Environment reviewers; without it, operators must use manual
deployment as the approval boundary.

- [x] **Step 3: Run the complete repository verification**

```bash
node --test .github/scripts/release-metadata.test.mjs
bash .github/scripts/deploy-production.test.sh
for file in .github/workflows/*.yml; do
  docker run --rm -i rhysd/actionlint:1.7.12 -color - < "$file"
done
pnpm exec prettier --check .github docs/project-spark-deployment.md
pnpm verify
docker build -f apps/api/Dockerfile -t spark-api:workflow-check .
docker build -f nginx/Dockerfile -t spark-web:workflow-check .
docker compose --env-file .env.example -f compose.production.yaml config
git diff --check
```

Expected: all Node and Bash tests pass, every workflow passes actionlint,
formatting passes, the repository verification pipeline completes, both
production images build, and Compose renders successfully.

- [x] **Step 4: Review the final diff for release safety**

Confirm with repository-wide searches:

```powershell
$legacy = @('quality' + '-gates', 'publish-container' + '-images',
  'deploy-aliyun' + '-ecs', 'workflow' + '_run',
  'ECS_AUTO_DEPLOY' + '_ENABLED', ':' + 'latest') -join '|'
rg -n $legacy .github docs
rg -n "environment:|production-aliyun-ecs|sha256:|sbom: true|provenance: mode=max" .github
```

Expected: the first command finds no active old workflow references or mutable
image tags; the second finds the protected deployment, fixed concurrency, digest
handling, SBOM, and provenance settings.

- [ ] **Step 5: Commit and push the documentation**

```bash
git add docs
git commit -m "Document protected release operations"
git push origin main
```

- [ ] **Step 6: Perform external GitHub configuration**

In repository settings, configure the required checks, protected version tags,
and `production` Environment rules listed in Step 2. This step changes GitHub
repository settings and must be completed before creating a `v*` tag. Do not
create a release tag or deploy to ECS as part of this implementation plan.

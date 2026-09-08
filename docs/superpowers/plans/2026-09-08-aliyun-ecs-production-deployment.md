# Aliyun ECS Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve Project Spark at `https://spark.gamstek.com` on the existing ECS
while preserving its host Nginx sites and deploying SHA-pinned images through
password-authenticated GitHub Actions.

**Architecture:** Host Nginx owns ports 80/443 and proxies Spark to a Web
container bound at `127.0.0.1:18080`. API and PostgreSQL remain internal Compose
services; PostgreSQL keeps its own named volume. GitHub-hosted runners use
`sshpass`, a protected production environment, and fixed host-key verification.

**Tech Stack:** GitHub Actions, Docker Compose, Nginx 1.29, Certbot, GHCR,
NestJS/Fastify, PostgreSQL 18

**Spec:**
`docs/superpowers/specs/2026-09-08-aliyun-ecs-production-deployment-design.md`

## Global Constraints

- Deploy API and Web images by full Git SHA; do not introduce `latest` tags.
- Keep host ports 80/443 under the existing system Nginx.
- Bind the Spark Web container only to `127.0.0.1:18080`.
- Keep API and PostgreSQL ports off the host and public network.
- Use password SSH from `ECS_PASSWORD`; do not retain `ECS_SSH_PRIVATE_KEY`.
- Keep strict `known_hosts` verification.
- Do not add `pg_dump` or any automated database backup.
- Do not delete or recreate the PostgreSQL `database` volume during deployment.
- Add DNS only after the HTTP site and local readiness check work.

---

### Task 1: Host-gateway container topology

**Files:**

- Modify: `nginx/nginx.conf`
- Modify: `nginx/proxy_params`
- Modify: `nginx/Dockerfile`
- Modify: `compose.production.yaml`
- Create: `nginx/sites-available/spark.gamstek.com.conf`

**Interfaces:**

- Consumes: host Nginx on ports 80/443 and Compose service name `api`
- Produces: HTTP Web endpoint at `127.0.0.1:18080` and a host site proxy for
  `spark.gamstek.com`

- [x] **Step 1: Run a failing topology assertion**

```powershell
$compose = Get-Content -Raw compose.production.yaml
$nginx = Get-Content -Raw nginx/nginx.conf
if ($compose -notmatch "127\.0\.0\.1:18080:8080") { throw "Web loopback binding missing" }
if ($nginx -notmatch "listen 8080") { throw "Internal HTTP listener missing" }
if ($nginx -notmatch "location = /admin") { throw "Slashless admin redirect missing" }
```

Expected: FAIL with `Web loopback binding missing`.

- [x] **Step 2: Convert the container Nginx to internal HTTP**

Use one `listen 8080` server without certificates or an HTTP-to-HTTPS redirect.
Keep the existing API, media, SPA and rate-limit locations. Add exact 308
redirects for `/activity`, `/staff`, and `/admin`. Configure real-IP handling
for the trusted Docker subnet and preserve the incoming `X-Forwarded-Proto`
value when proxying to API.

- [x] **Step 3: Change the Web container exposure**

Set `EXPOSE 8080` in `nginx/Dockerfile`. Replace Compose ports 80/443 with:

```yaml
ports:
  - '127.0.0.1:18080:8080'
```

Remove the obsolete container certificate mount. Keep the read-only media
volume.

- [x] **Step 4: Add the host Nginx site**

Create `nginx/sites-available/spark.gamstek.com.conf` with an HTTP server for
`spark.gamstek.com`, `client_max_body_size 7m`, standard forwarded headers, and:

```nginx
location / {
  proxy_pass http://127.0.0.1:18080;
}
```

Certbot will add the HTTPS server only after public DNS resolves.

- [x] **Step 5: Validate the topology**

Run the Step 1 assertion again and expect PASS, then run:

```bash
docker build -f nginx/Dockerfile -t spark-web:deployment-check .
docker run --rm spark-web:deployment-check nginx -t
docker compose -f compose.production.yaml config --quiet
```

Supply validation-only values for required Compose variables; never print the
local `.env`.

- [x] **Step 6: Commit the topology**

```bash
git add nginx compose.production.yaml
git commit -m "Run Spark behind host Nginx"
```

### Task 2: Password-authenticated deployment workflow

**Files:**

- Modify: `.github/workflows/deploy-aliyun-ecs.yml`

**Interfaces:**

- Consumes: `ECS_HOST`, `ECS_PORT`, `ECS_USER`, `ECS_PASSWORD`,
  `ECS_SSH_KNOWN_HOSTS`, `ECS_DEPLOY_PATH`
- Produces: password-authenticated upload, SHA-pinned Compose update, local
  readiness result, optional public HTTPS readiness result

- [x] **Step 1: Run a failing workflow assertion**

```powershell
$workflow = Get-Content -Raw .github/workflows/deploy-aliyun-ecs.yml
if ($workflow -notmatch "ECS_PASSWORD") { throw "Password secret missing" }
if ($workflow -notmatch "sshpass -e") { throw "Password SSH missing" }
if ($workflow -match "ECS_SSH_PRIVATE_KEY") { throw "Private-key path remains" }
```

Expected: FAIL with `Password secret missing`.

- [x] **Step 2: Replace private-key setup with sshpass**

Install `sshpass` with apt. Map `secrets.ECS_PASSWORD` to `SSHPASS` only in
SSH/SCP steps. Invoke SSH and SCP with `sshpass -e`, password authentication,
strict host-key checking, batch failure and a 15-second connection timeout.
Continue writing only `ECS_SSH_KNOWN_HOSTS` to `~/.ssh/known_hosts`.

- [x] **Step 3: Make health checks match staged DNS activation**

After `docker compose up`, poll `http://127.0.0.1:18080/api/health/ready` on
ECS. Treat `ECS_HEALTHCHECK_URL` as optional; when non-empty, require HTTPS and
run the external retrying check. Keep automatic deployment disabled unless
`ECS_AUTO_DEPLOY_ENABLED=true`.

- [x] **Step 4: Validate the workflow**

Run the Step 1 assertion again and expect PASS, then run:

```powershell
Get-Content -Raw .github/workflows/deploy-aliyun-ecs.yml |
  docker run --rm -i rhysd/actionlint:1.7.12 -color -
```

Expected: actionlint exits 0 with no findings.

- [x] **Step 5: Commit the workflow**

```bash
git add .github/workflows/deploy-aliyun-ecs.yml
git commit -m "Deploy to ECS with password SSH"
```

### Task 3: Deployment documentation and repository verification

**Files:**

- Modify: `docs/project-spark-deployment.md`
- Modify: `docs/project-spark-configuration.md`
- Modify:
  `docs/superpowers/specs/2026-09-08-aliyun-ecs-production-deployment-design.md`
- Modify:
  `docs/superpowers/plans/2026-09-08-aliyun-ecs-production-deployment.md`

**Interfaces:**

- Consumes: topology and workflow from Tasks 1 and 2
- Produces: exact bootstrap, DNS, TLS, GitHub secret and verification
  instructions

- [ ] **Step 1: Update deployment documentation**

Document the host Nginx proxy, loopback port, password secret, optional external
health URL, GHCR login, independent PostgreSQL container, and the absence of
automated backups. List the exact order: HTTP site, containers, local health,
DNS A record, Certbot, HTTPS health, WeChat settings, automatic deployment flag.

- [ ] **Step 2: Format and validate all changed files**

```bash
pnpm exec prettier --write .github/workflows/deploy-aliyun-ecs.yml compose.production.yaml nginx/nginx.conf nginx/proxy_params docs/project-spark-deployment.md docs/project-spark-configuration.md docs/superpowers/specs/2026-09-08-aliyun-ecs-production-deployment-design.md docs/superpowers/plans/2026-09-08-aliyun-ecs-production-deployment.md
pnpm verify
git diff --check
```

Expected: formatting, lint, type checking, unit tests, builds and PostgreSQL
integration tests all pass.

- [ ] **Step 3: Commit the documentation**

```bash
git add docs
git commit -m "Document Spark production rollout"
```

### Task 4: ECS bootstrap and first release

**Files:**

- Install on ECS: `/etc/nginx/sites-available/spark.gamstek.com`
- Create on ECS: `/opt/spark/.env.production`
- Create on ECS: `/opt/spark/.env.release`
- Create on ECS: `/opt/spark/compose.production.yaml`

**Interfaces:**

- Consumes: ECS public IP, SSH port, account password, production environment
  values, GHCR read credentials
- Produces: running local Spark endpoint ready for DNS and TLS activation

- [ ] **Step 1: Open an interactive bootstrap session**

```bash
ssh -p "$ECS_PORT" "$ECS_USER@$ECS_HOST"
```

Enter the password interactively. Do not save it in the repository or shell
history.

- [ ] **Step 2: Inspect before changing the server**

```bash
uname -m
nginx -T
docker version
docker compose version
ss -lntp
df -h
```

Require `x86_64`, preserve existing Nginx sites, and stop if port 18080 is
already occupied.

- [ ] **Step 3: Install and validate the HTTP site**

Copy the reviewed site file to `/etc/nginx/sites-available/spark.gamstek.com`,
create its `sites-enabled` symlink, run `nginx -t`, and reload Nginx only after
a successful test.

- [ ] **Step 4: Prepare the deployment directory**

Create `/opt/spark`, save `.env.production` with mode `600`, log in to GHCR
using a token with `read:packages`, and copy the reviewed Compose file plus
`.env.release` into the directory.

- [ ] **Step 5: Start and verify containers**

```bash
cd /opt/spark
docker compose --env-file .env.production --env-file .env.release \
  -f compose.production.yaml pull
docker compose --env-file .env.production --env-file .env.release \
  -f compose.production.yaml up -d --no-build
curl -fsS http://127.0.0.1:18080/api/health/ready
```

Expected: PostgreSQL, API and Web are running, and readiness returns HTTP 200.

- [ ] **Step 6: Activate DNS and HTTPS**

After the user adds the A record, verify public resolution points to the ECS IP,
then run:

```bash
certbot --nginx -d spark.gamstek.com
nginx -t
curl -fsS https://spark.gamstek.com/api/health/ready
```

Verify `/activity/`, `/staff/`, `/admin/`, `/api/health/ready` and `/media/`
behavior before setting `ECS_AUTO_DEPLOY_ENABLED=true`.

- [ ] **Step 7: Configure GitHub and external platforms**

Add the documented `production` Environment secrets, enable required reviewers,
then configure the WeChat OAuth domain and IP allowlist plus the DingTalk
callback URL. Keep automatic deployment disabled until a manual workflow run
succeeds.

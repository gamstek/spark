# Project Spark

Project Spark is a WeChat marketing activity system organized as a pnpm
monorepo.

## Requirements

- Node.js 24.11 or newer within the Node 24 release line
- pnpm 10.15.1
- PostgreSQL (required by API features added after the initial workspace task)

## Test database

Integration tests and local API development need a PostgreSQL instance on
`127.0.0.1:54329` (database `spark_test`, user `spark`). Two supported options:

```bash
pnpm db:test:start   # embedded PostgreSQL (keep-alive foreground process)
docker compose up -d postgres   # or the postgres:18-alpine container
```

`pnpm db:test:start` runs `scripts/start-test-postgres.mjs`. It detects an
existing data cluster (`node_modules/.cache/spark-pg`) via `PG_VERSION` and
skips `initdb` and database creation on restart, so it is safe to stop and
rerun. The port must stay free of a second instance — starting both the embedded
server and the container on `54329` fails with an explicit port conflict error.
Point `DATABASE_URL`/`TEST_DATABASE_URL` in `.env` at this instance and apply
migrations with `pnpm --filter @spark/api db:migrate`.

## Applications

- `apps/activity`: participant experience under `/activity/:activityCode`
- `apps/staff`: staff redemption platform under `/staff`
- `apps/admin`: operations console under `/admin`
- `apps/api`: NestJS API under `/api`

## Commands

```text
pnpm install       Install the locked workspace dependencies
pnpm dev           Run all applications in development mode
pnpm --filter @spark/activity dev   Run only the activity frontend (Vite on port 5173)
pnpm typecheck     Check TypeScript across the workspace
pnpm lint          Run ESLint across the workspace
pnpm test          Run automated tests
pnpm test:integration  Run API tests against PostgreSQL
pnpm build         Build every application and package
pnpm verify        Run lint, typecheck, unit tests, builds, and integration tests
```

Stop a running development server with `Ctrl+C` in the terminal that started it.
The activity demo opens at `http://localhost:5173/activity/<activityCode>` and
supports a `?step=` query parameter for direct preview.

The activity H5 reads its state machine from `GET /api/activity/:code/runtime`
and establishes its session through WeChat silent OAuth. In development, when no
WeChat session is available (the runtime call returns 401), the page falls back
to the static demo preview with the step toolbar; production builds redirect to
`/api/wechat/oauth/start?returnPath=…` instead.
`POST /api/activity/:code/lottery` is protected by a CSRF token bound to the
current session.

Copy `.env.example` to `.env` for local development. Secrets must not be
committed.

OAuth callbacks, redemption QR codes and download links are built from the
current request origin. This lets the Activity, Staff and Admin development
servers share one API without maintaining an origin allowlist.

Every environment variable, its source, secrecy requirement, and rotation impact
is documented in `docs/project-spark-configuration.md`.

`pnpm dev`, the API development server, and database CLI commands load the root
`.env` using Node's native environment-file support. Existing shell variables
take precedence. Set `API_PORT` there once: all three Vite development servers
derive their `/api` proxy from the same root `API_HOST` and `API_PORT` (default
`127.0.0.1:3000`). Wildcard listen addresses (`0.0.0.0` and `::`) use loopback
for proxy connections. For a remote backend, set `API_PROXY_TARGET` explicitly.
These backend settings use the root `.env`, not Vite's mode-specific env files,
and are not exposed to browser code. Restart `pnpm dev` after changing `.env`;
code watch mode does not reload the parent process environment. Production
containers continue to receive their environment from Compose.

OAuth and generated absolute links use the request protocol and host. Reverse
proxies must preserve `Host` and set `X-Forwarded-Proto`; the included Nginx
configuration already does so.

The API's `predev` step applies pending database migrations before starting the
development server. Direct API startup requires an up-to-date database; run
`pnpm --filter @spark/api db:migrate` before starting it if migrations are
pending. `DATABASE_SCHEMA` defaults to `public`; custom schema names must use
lowercase letters, digits, and underscores, start with a letter or underscore,
and be at most 63 characters. Migrations and application queries use the same
schema.

Production containers and operating instructions are documented in
`docs/project-spark-deployment.md`. External-account and onsite acceptance items
are tracked in `docs/project-spark-acceptance.md`.

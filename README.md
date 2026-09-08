# Project Spark

Project Spark is a WeChat marketing activity system organized as a pnpm
monorepo.

## Requirements

- Node.js 24.11 or newer within the Node 24 release line
- pnpm 10.15.1
- PostgreSQL (required by API features added after the initial workspace task)

## Applications

- `apps/activity`: participant experience under `/activity/:activityCode`
- `apps/staff`: staff redemption platform under `/staff`
- `apps/admin`: operations console under `/admin`
- `apps/api`: NestJS API under `/api`

## Commands

```text
pnpm install       Install the locked workspace dependencies
pnpm dev           Run all applications in development mode
pnpm typecheck     Check TypeScript across the workspace
pnpm lint          Run ESLint across the workspace
pnpm test          Run automated tests
pnpm test:integration  Run API tests against PostgreSQL
pnpm build         Build every application and package
pnpm verify        Run lint, typecheck, unit tests, builds, and integration tests
```

Copy `.env.example` to `.env` for local development. Secrets must not be
committed.

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

For local admin login, set `PUBLIC_ORIGIN` to the exact browser origin (for
example `http://localhost:5175`, without `/admin/`). If Vite selects another
port because the default is occupied, update this setting to that port and
restart `pnpm dev`. `localhost` and `127.0.0.1` are different origins. A
mismatch is rejected with `ORIGIN_INVALID`, even when the account password is
correct.

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

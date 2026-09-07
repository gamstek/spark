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

Production containers and operating instructions are documented in
`docs/project-spark-deployment.md`. External-account and onsite acceptance items
are tracked in `docs/project-spark-acceptance.md`.

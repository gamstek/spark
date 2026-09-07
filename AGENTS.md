# Repository Guidelines

## Project Structure & Module Organization

Project Spark is a pnpm monorepo for a WeChat H5 marketing and lottery system.
Applications live in `apps/`: `activity` is the shared campaign entry, `admin`
is the operations console, `staff` is the redemption client, and `api` is the
NestJS/Fastify service. Activity and staff UIs remain deferred until approved
designs are available.

Shared, UI-free modules live in `packages/`. `contracts` contains Zod request
and response schemas; `templates` contains versioned activity definitions such
as `src/exhibition-lottery/v1/`. API migrations are under
`apps/api/database/migrations`, integration tests under `apps/api/test`, browser
tests under `tests/e2e`, and product/architecture documents under `docs/`.

## Build, Test, and Development Commands

- `pnpm install`: install locked workspace dependencies.
- `pnpm dev`: run all applications through Turborepo.
- `pnpm lint`: run ESLint for every workspace.
- `pnpm typecheck`: check production and test TypeScript.
- `pnpm test`: run package unit tests.
- `pnpm test:integration`: run API tests against the configured test PostgreSQL
  database.
- `pnpm build`: build all applications and packages.
- `pnpm verify`: run the complete local validation pipeline.
- `pnpm --filter @spark/api db:migrate`: apply TypeORM migrations.

## Coding Style & Naming Conventions

Use TypeScript, two-space indentation, single quotes, semicolons, and the
repository Prettier configuration. Run `pnpm exec prettier --write <files>`
after editing. Use kebab-case filenames, PascalCase classes/components,
camelCase values, and uppercase snake case for stable error codes. Keep UI code
inside its application and use Radix UI directly; packages must remain UI-free.

## Testing Guidelines

Use Vitest for unit and PostgreSQL integration tests and Playwright for browser
flows. Name tests `*.test.ts`, `*.integration.test.ts`, or `*.spec.ts`. Add a
failing regression test before changing behavior. Never point integration
cleanup at a database whose name does not contain `test`.

## Commit & Pull Request Guidelines

Use short imperative subjects such as `Fix redemption expiry handling`. Keep
commits focused on one coherent feature or repair. Pull requests should explain
the trigger, resulting behavior, affected migrations or contracts, and commands
run. Link relevant issues and include screenshots for visible UI changes.

## Security & Configuration

Copy `.env.example` locally and never commit credentials, customer form data,
exports, or encryption keys. Preserve CSRF, role, activity-permission,
callback-signature, and template-version checks when adding endpoints.

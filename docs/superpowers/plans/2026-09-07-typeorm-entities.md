# TypeORM Entities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register a complete TypeORM entity model for the migrated PostgreSQL
schema and prove it through repository-backed integration behavior.

**Architecture:** Migrations remain the schema source of truth and
synchronization stays disabled. Entity classes model all 24 tables; repositories
handle ordinary CRUD while transaction-sensitive SQL keeps its explicit locking
and PostgreSQL semantics.

**Tech Stack:** TypeScript, TypeORM decorators, PostgreSQL, Vitest, NestJS.

**Spec:**
[Admin Entities and UI Redesign](../specs/2026-09-07-admin-entities-ui-redesign.md)

## Global Constraints

- Put entities under `apps/api/database/entities/`; do not expose them through
  shared packages.
- Use PascalCase classes, camelCase properties, and explicit snake_case
  table/column names.
- Store PostgreSQL `numeric` values as strings at the entity boundary.
- Register the same entity array in production and integration-test data
  sources.
- Keep `synchronize: false`; no schema migration is introduced by this work.
- Preserve explicit SQL for locks, CTEs, reports, exports, callbacks, and
  maintenance batches.
- Run each behavior test against a database whose name contains `test`.

---

### Task 1: Define the complete entity registry

**Files:**

- Create: `apps/api/database/entities/accounts.entities.ts`
- Create: `apps/api/database/entities/campaigns.entities.ts`
- Create: `apps/api/database/entities/participation.entities.ts`
- Create: `apps/api/database/entities/lottery.entities.ts`
- Create: `apps/api/database/entities/operations.entities.ts`
- Create: `apps/api/database/entities/index.ts`
- Replace: `apps/api/database/entities.ts`
- Test: `apps/api/test/entities.integration.test.ts`

**Interfaces:**

- Produces: `databaseEntities: EntityTarget<object>[]`
- Produces: one exported entity class for each of the 24 migrated tables.

- [x] **Step 1: Add a failing metadata integration test**

Create a migrated test data source and assert the registered table names
exactly:

```ts
const expectedTables = [
  'activity',
  'activity_participation',
  'activity_prize',
  'activity_version',
  'activity_version_prize',
  'admin_account',
  'app_session',
  'audit_event',
  'background_job',
  'channel_visit',
  'dingtalk_form_submission',
  'export_job',
  'lottery_record',
  'media_asset',
  'oauth_state',
  'prize',
  'redemption',
  'staff_account',
  'staff_activity_permission',
  'stock_adjustment',
  'user_account',
  'webhook_receipt',
  'wechat_credential_cache',
  'wechat_identity',
];
expect(dataSource.entityMetadatas.map((m) => m.tableName).sort()).toEqual(
  expectedTables,
);
```

- [x] **Step 2: Run the test and observe the missing-metadata failure**

Run:

```bash
pnpm --filter @spark/api test:integration -- test/entities.integration.test.ts
```

Expected: FAIL because `entityMetadatas` is empty.

- [x] **Step 3: Implement all entity classes**

Use decorators with explicit names and database-generated defaults. A
representative entity must follow this shape:

```ts
@Entity({ name: 'admin_account' })
export class AdminAccount {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'username', type: 'varchar', length: 100, unique: true })
  username!: string;
  @Column({ name: 'password_hash', type: 'text' }) passwordHash!: string;
  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName!: string;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

Model nullable columns, composite keys, unique constraints, and important
indexes exactly as the latest migrations define them. Export one registry
containing every class.

- [x] **Step 4: Register entities in both data sources**

Change `apps/api/database/data-source.ts` and
`apps/api/test/support/database.ts` to use:

```ts
entities: databaseEntities,
```

- [x] **Step 5: Verify metadata and migration compatibility**

Run the focused integration test, `pnpm --filter @spark/api typecheck`, and
`pnpm --filter @spark/api lint`. Expected: all exit 0.

- [x] **Step 6: Commit**

```bash
git add apps/api/database apps/api/test
git commit -m "Define TypeORM entity model"
```

### Task 2: Prove repository-backed administrator creation

**Files:**

- Create: `apps/api/database/seeds/admin-seed.service.ts`
- Modify: `apps/api/database/seeds/create-admin.ts`
- Test: `apps/api/test/entities.integration.test.ts`

**Interfaces:**

- Consumes: `AdminAccount` and the registered production data source.
- Produces: `createAdminAccount(dataSource, input): Promise<AdminAccount>`.
- Produces: a seed path that persists an administrator with
  `Repository<AdminAccount>`.

- [x] **Step 1: Add a failing repository test**

Import the not-yet-created `createAdminAccount` function, create an
administrator, then reload it with `dataSource.getRepository(AdminAccount)` and
assert camelCase properties and snake_case persistence agree.

```ts
const repository = dataSource.getRepository(AdminAccount);
const created = await createAdminAccount(dataSource, {
  username: 'operator',
  password: 'correct horse battery staple',
});
expect((await repository.findOneByOrFail({ id: created.id })).displayName).toBe(
  'operator',
);
```

- [x] **Step 2: Run the test and confirm it fails before seed conversion**

Run the focused integration test. Expected: FAIL because `admin-seed.service.ts`
and `createAdminAccount` do not exist.

- [x] **Step 3: Replace the seed's raw insert with the repository**

Implement `createAdminAccount` with `dataSource.getRepository(AdminAccount)`.
Keep password validation and hashing in that function. Make the CLI wrapper
retain interactive prompting, random UUID generation through the service, and
data-source cleanup.

- [x] **Step 4: Run the focused test and existing auth integration test**

```bash
pnpm --filter @spark/api test:integration -- test/entities.integration.test.ts test/auth.integration.test.ts
```

Expected: both suites pass.

- [x] **Step 5: Commit**

```bash
git add apps/api/database/seeds/create-admin.ts apps/api/test/entities.integration.test.ts
git commit -m "Use repository for administrator seed"
```

### Task 3: Adopt repositories for ordinary account and staff CRUD

**Files:**

- Modify: `apps/api/src/auth/accounts.service.ts`
- Modify: `apps/api/src/staff/staff.service.ts`
- Test: `apps/api/test/auth.integration.test.ts`
- Test: `apps/api/test/admin-operations.integration.test.ts`

**Interfaces:**

- Consumes: `AdminAccount`, `StaffAccount`, `StaffActivityPermission`, and
  `AuditEvent` repositories.
- Preserves: current controller response shapes, authorization behavior, session
  revocation, and audit records.

- [x] **Step 1: Complete characterization coverage for account administration**

Cover administrator login lookup, staff creation/update/disable/reset,
permission replacement, and audit persistence through public service or HTTP
behavior. Assert database results, not mocked repository calls.

- [x] **Step 2: Run both suites and require a green refactoring baseline**

Run the two integration suites. All behavior assertions must pass before this
internal refactor; if a missing behavior is discovered, add its failing
regression test and fix that behavior separately before continuing.

- [x] **Step 3: Refactor simple CRUD to repositories**

Use injected or data-source repositories for single-table operations. Use one
`EntityManager` transaction when permissions and audit records change together.
Keep specialized raw SQL only where it carries a documented PostgreSQL behavior.

- [x] **Step 4: Run auth, staff, and full API integration tests**

```bash
pnpm --filter @spark/api test:integration
```

Expected: all API integration tests pass with no response-contract changes.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/auth apps/api/src/staff apps/api/test
git commit -m "Use entities for account administration"
```

### Task 4: Complete data-layer verification

**Files:**

- Modify only if verification exposes a mismatch.

- [x] **Step 1: Run API validation**

```bash
pnpm --filter @spark/api lint
pnpm --filter @spark/api typecheck
pnpm --filter @spark/api test
pnpm --filter @spark/api test:integration
```

- [x] **Step 2: Run repository-wide validation**

```bash
pnpm verify
git diff --check
```

- [x] **Step 3: Update the SDD progress note and commit any verification-only
      correction**

Record the entity model as part of T04 without changing product scope. Commit
only if documentation changed.

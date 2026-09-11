# Activity Anonymous Identity Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore anonymous browser identity for activity visitors and remove
the Official Account callback/menu activity-entry subsystem.

**Architecture:** A validated `ACTIVITY_IDENTITY_MODE` provider selects
anonymous session bootstrap or the retained OAuth flow. Runtime and lottery use
that same policy for subscription enforcement, while a forward migration removes
callback-entry persistence from upgraded databases without rewriting migration
history.

**Tech Stack:** TypeScript, NestJS/Fastify, TypeORM, PostgreSQL, React, TanStack
Query, Vitest, Playwright, pnpm

**Spec:**
`docs/superpowers/specs/2026-09-11-activity-anonymous-identity-design.md`

## Global Constraints

- `anonymous` is the default identity mode.
- Anonymous identities create `user_account` rows but never fake
  `wechat_identity` rows.
- Existing OAuth, OpenID, subscription, and `SUBSCRIBE` UI capabilities remain
  available in `wechat` mode.
- Activity session cookies remain HttpOnly, SameSite=Lax, seven-day cookies and
  Secure in production.
- The public activity link is shareable; cookie clearing or another device
  creates a new participant.
- The user-owned `2ba6da2 chore: update` commit remains in history.
- `GET/POST /api/wechat/callback`, `GET /api/activity/entry`, and the `LOTTERY`
  menu dependency do not remain active.

---

### Task 1: Restore the identity policy and session bootstrap boundary

**Files:**

- Create: `apps/api/src/auth/activity-identity-mode.ts`
- Create: `apps/api/src/auth/activity-session.controller.ts`
- Create: `apps/api/src/auth/activity-session.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Produces: `ActivityIdentityMode = 'anonymous' | 'wechat'`.
- Produces: `ACTIVITY_IDENTITY_MODE` Nest injection token.
- Produces: `readActivityIdentityMode(value?: string): ActivityIdentityMode`.
- Produces: `POST /api/activity/:code/session?returnPath=...` returning
  `{ authenticated: true } | { authenticated: false; redirectUrl: string }`.

- [ ] **Step 1: Write failing identity-policy and controller tests**

Add cases with these observable assertions:

```ts
expect(readActivityIdentityMode(undefined)).toBe('anonymous');
expect(readActivityIdentityMode('anonymous')).toBe('anonymous');
expect(readActivityIdentityMode('wechat')).toBe('wechat');
expect(() => readActivityIdentityMode('callback')).toThrow(
  'ACTIVITY_IDENTITY_MODE_INVALID',
);
```

For the controller, use a published activity fixture and assert anonymous mode
creates one `UserAccount`, calls `SessionService.create('ACTIVITY', userId)`,
sets `spark_activity` with `HttpOnly`, `SameSite=Lax`, and seven-day `Max-Age`,
and returns `{ authenticated: true }`. Assert WeChat mode creates no user and
returns the encoded `/api/wechat/oauth/start?returnPath=...` URL. Add rejected
cases for an unpublished activity and a return path outside `/activity/<code>`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @spark/api test -- activity-session.controller.test.ts
```

Expected: FAIL because the identity policy and bootstrap controller do not exist
on the current callback-entry branch.

- [ ] **Step 3: Implement the minimum policy and endpoint**

Implement the policy exactly as:

```ts
export type ActivityIdentityMode = 'anonymous' | 'wechat';
export const ACTIVITY_IDENTITY_MODE = Symbol('ACTIVITY_IDENTITY_MODE');

export function readActivityIdentityMode(
  value = process.env.ACTIVITY_IDENTITY_MODE,
): ActivityIdentityMode {
  if (value === undefined || value === '' || value === 'anonymous')
    return 'anonymous';
  if (value === 'wechat') return 'wechat';
  throw new Error('ACTIVITY_IDENTITY_MODE_INVALID');
}
```

The controller must validate `returnPath`, require a published activity, create
`randomUUID()` user/session rows only in anonymous mode, and never write a
`wechat_identity` row. Register both controller and provider in `AppModule`.

- [ ] **Step 4: Run focused tests and API type checking**

Run:

```bash
pnpm --filter @spark/api test -- activity-session.controller.test.ts
pnpm --filter @spark/api typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the identity boundary**

```bash
git add apps/api/src/auth/activity-identity-mode.ts apps/api/src/auth/activity-session.controller.ts apps/api/src/auth/activity-session.controller.test.ts apps/api/src/app.module.ts
git commit -m "Restore anonymous activity sessions"
```

### Task 2: Apply anonymous subscription policy to runtime and lottery

**Files:**

- Modify: `apps/api/src/runtime/runtime.service.ts`
- Modify: `apps/api/src/lottery/lottery.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/test/runtime.integration.test.ts`
- Modify: `apps/api/test/lottery.integration.test.ts`

**Interfaces:**

- Consumes: injected `ActivityIdentityMode` from Task 1.
- Produces: anonymous runtime and draw paths that do not query or call WeChat
  subscription services.
- Preserves: unchanged subscription enforcement in `wechat` mode.

- [ ] **Step 1: Add failing runtime and draw policy tests**

For an activity whose published template has `requireSubscribe: true`, assert:

```ts
expect(anonymousRuntime.nextStep).not.toBe('SUBSCRIBE');
await expect(anonymousLottery.draw(userId, code)).resolves.toBeDefined();
```

Instrument the real test database or a query recorder so deleting the
`identityMode === 'wechat'` guard makes each anonymous test fail on a
`wechat_identity` access. Keep matching WeChat-mode cases that return
`SUBSCRIBE` and reject draw with `SUBSCRIPTION_REQUIRED`.

- [ ] **Step 2: Run the focused integration tests and verify RED**

```bash
pnpm --filter @spark/api test:integration -- runtime.integration.test.ts lottery.integration.test.ts
```

Expected: the new anonymous cases fail because the current services enforce a
WeChat identity unconditionally.

- [ ] **Step 3: Inject and apply the shared identity mode**

Add `ActivityIdentityMode` to both constructors. Guard the runtime API check and
the final transactional draw check with:

```ts
if (this.identityMode === 'wechat' && activity.requireSubscribe) {
  // existing WeChat subscription behavior
}
```

Update `AppModule` factories so the same `ACTIVITY_IDENTITY_MODE` token is
passed to both services. Do not remove `requireSubscribe` from contracts or
templates.

- [ ] **Step 4: Run focused and complete API tests**

```bash
pnpm --filter @spark/api test:integration -- runtime.integration.test.ts lottery.integration.test.ts
pnpm --filter @spark/api test
```

Expected: PASS.

- [ ] **Step 5: Commit the policy enforcement change**

```bash
git add apps/api/src/runtime/runtime.service.ts apps/api/src/lottery/lottery.service.ts apps/api/src/app.module.ts apps/api/test/runtime.integration.test.ts apps/api/test/lottery.integration.test.ts
git commit -m "Use anonymous activity subscription policy"
```

### Task 3: Restore activity-client session bootstrap

**Files:**

- Create: `apps/activity/src/lib/session-bootstrap.ts`
- Create: `apps/activity/src/lib/session-bootstrap.test.ts`
- Modify: `apps/activity/src/lib/api.ts`
- Modify: `apps/activity/src/lib/runtime.tsx`
- Modify: `apps/activity/src/app.tsx`
- Delete: `apps/activity/src/lib/activity-entry-state.ts`
- Delete: `apps/activity/src/lib/activity-entry-state.test.ts`
- Delete: `apps/activity/src/pages/activity-entry-error-page.tsx`
- Modify: `tests/e2e/activity-runtime-provider.spec.ts`

**Interfaces:**

- Consumes: `POST /api/activity/:code/session` from Task 1.
- Produces: `bootstrapActivitySession(...) => Promise<void>`.
- Preserves: simulated WeChat session creation in local development.

- [ ] **Step 1: Write failing session-bootstrap tests**

Cover three literal outcomes:

```ts
await bootstrapActivitySession({
  simulateWechat: false,
  createSimulatedSession,
  createSession: async () => ({ authenticated: true }),
  refresh,
  redirect,
});
expect(refresh).toHaveBeenCalledOnce();
expect(redirect).not.toHaveBeenCalled();
```

Add a WeChat-mode result that calls `redirect('/api/wechat/oauth/start?...')`
without refresh, and a simulated result that calls the simulated-session API
then refreshes. The mounted provider test must show that simultaneous runtime
and info 401 responses trigger only one bootstrap call and both queries recover.

- [ ] **Step 2: Run activity tests and verify RED**

```bash
pnpm --filter @spark/activity test -- session-bootstrap runtime
```

Expected: FAIL because the current client expects `?entry=` and renders the
Official Account re-entry error page.

- [ ] **Step 3: Implement bootstrap and remove entry-token UI behavior**

Add this discriminated response type:

```ts
export type ActivitySessionBootstrap =
  { authenticated: true } | { authenticated: false; redirectUrl: string };
```

On a normal 401, call `activityApi.bootstrapSession(code, returnPath)`. Refetch
runtime and activity info when authenticated, or perform a full-page redirect
when the response supplies an OAuth URL. Use a ref to suppress overlapping
bootstrap requests. Remove query-token exchange, invalid-entry title/copy, and
the dedicated entry error page. Preserve `VITE_WECHAT_MODE=simulate` behavior.

- [ ] **Step 4: Run client tests, type checking, and mounted browser coverage**

```bash
pnpm --filter @spark/activity test
pnpm --filter @spark/activity typecheck
pnpm exec playwright test --config playwright.activity.config.ts
```

Expected: PASS; normal unauthorized access recovers through anonymous bootstrap
without navigating to an Official Account menu instruction.

- [ ] **Step 5: Commit the activity-client restoration**

```bash
git add apps/activity/src tests/e2e/activity-runtime-provider.spec.ts
git commit -m "Restore anonymous activity bootstrap"
```

### Task 4: Remove callback entry runtime and retire its database tables

**Files:**

- Create:
  `apps/api/database/migrations/1788739210000-DropWechatEventActivityEntry.ts`
- Modify: `apps/api/database/data-source.ts`
- Modify: `apps/api/database/entities/accounts.entities.ts`
- Modify: `apps/api/database/entities/index.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/maintenance/maintenance.service.ts`
- Modify: `apps/api/src/maintenance/maintenance.service.test.ts`
- Modify: `apps/api/test/development-migrations.integration.test.ts`
- Modify: `apps/api/test/entities.integration.test.ts`
- Modify: `apps/api/test/app-module-providers.integration.test.ts`
- Modify: `apps/api/test/support/database.ts`
- Modify: `apps/api/test/support/fixtures.ts`
- Delete: `apps/api/src/wechat/activity-entry.controller.ts`
- Delete: `apps/api/src/wechat/activity-entry.controller.test.ts`
- Delete: `apps/api/src/wechat/activity-entry.service.ts`
- Delete: `apps/api/src/wechat/activity-entry.service.test.ts`
- Delete: `apps/api/src/wechat/callback-protocol.ts`
- Delete: `apps/api/src/wechat/callback-protocol.test.ts`
- Delete: `apps/api/src/wechat/callback-replay.service.ts`
- Delete: `apps/api/src/wechat/callback.controller.ts`
- Delete: `apps/api/src/wechat/callback.controller.test.ts`
- Delete: `apps/api/src/wechat/entry-configuration.ts`
- Delete: `apps/api/src/wechat/entry-configuration.test.ts`
- Delete: `apps/api/src/wechat/wechat-identity.service.test.ts`
- Delete: `apps/api/test/wechat-activity-entry.integration.test.ts`
- Delete: `apps/api/src/http-adapter.ts`
- Delete: `apps/api/src/http-adapter.test.ts`
- Delete: `apps/api/src/production-proxy.test.ts`

**Interfaces:**

- Produces: a forward-only migration that drops callback-entry persistence.
- Preserves: historical migrations `1788739208000` and `1788739209000` so both
  fresh and already-upgraded databases converge.

- [ ] **Step 1: Add a failing migration-upgrade integration test**

Migrate a disposable test schema through `1788739209000`, insert representative
rows, then run pending migrations and assert:

```ts
expect(tableNames).not.toContain('wechat_activity_entry_token');
expect(tableNames).not.toContain('wechat_callback_receipt');
expect(tableNames).toContain('wechat_identity');
expect(tableNames).toContain('app_session');
```

Also assert the current entity registry no longer contains the entry-token
entity and `AppModule` resolves without callback-entry providers.

- [ ] **Step 2: Run migration/provider tests and verify RED**

```bash
pnpm --filter @spark/api test:integration -- development-migrations.integration.test.ts entities.integration.test.ts app-module-providers.integration.test.ts
```

Expected: FAIL because the drop migration and removals do not exist.

- [ ] **Step 3: Implement the forward migration and runtime removal**

The migration `up` must execute:

```sql
DROP TABLE IF EXISTS wechat_callback_receipt;
DROP TABLE IF EXISTS wechat_activity_entry_token;
```

Its `down` must recreate both tables with the exact columns, constraints, and
indexes defined by migrations `1788739208000` and `1788739209000`. Register the
new migration after both historical migrations. Remove callback controllers,
services, providers, entity registration, body-parser customization, and
maintenance deletion statements. Keep OAuth and `WechatIdentityService`
functionality required by `wechat` identity mode.

- [ ] **Step 4: Run migration, provider, and API tests**

```bash
pnpm --filter @spark/api test:integration -- development-migrations.integration.test.ts entities.integration.test.ts app-module-providers.integration.test.ts
pnpm --filter @spark/api test
pnpm --filter @spark/api typecheck
```

Expected: PASS on a database whose name contains `test`.

- [ ] **Step 5: Commit callback-entry removal**

```bash
git add apps/api
git commit -m "Remove WeChat callback activity entry"
```

### Task 5: Restore anonymous production configuration and documentation

**Files:**

- Modify: `.env.example`
- Modify: `compose.production.yaml`
- Modify: `scripts/generate-env-secrets.mjs`
- Modify: `scripts/generate-env-secrets.test.mjs`
- Modify: `docs/project-spark-configuration.md`
- Modify: `docs/project-spark-wechat-setup.md`
- Modify: `docs/project-spark-acceptance.md`
- Delete:
  `docs/superpowers/specs/2026-09-11-wechat-event-activity-entry-design.md`
- Delete: `docs/superpowers/plans/2026-09-11-wechat-event-activity-entry.md`
- Modify: `nginx/nginx.conf`
- Modify: `nginx/sites-available/spark.gamstek.com.conf`

**Interfaces:**

- Documents and deploys: `ACTIVITY_IDENTITY_MODE=anonymous`.
- Removes: `WECHAT_CALLBACK_TOKEN`, `PUBLIC_BASE_URL`, callback URL,
  plaintext-mode instructions, and `LOTTERY` menu instructions.

- [ ] **Step 1: Add failing configuration behavior tests**

Update the secret-generation test so its parsed output contains no
`WECHAT_CALLBACK_TOKEN` or `PUBLIC_BASE_URL`, retains the user-owned Chinese
comments and all still-required secrets, and does not emit duplicate keys. The
production-mode provider test from Task 1 must also instantiate the module with
no identity-mode value and observe `anonymous`; this proves the Compose default
and application default agree at the behavior boundary.

- [ ] **Step 2: Run configuration tests and verify RED**

```bash
node --test scripts/generate-env-secrets.test.mjs
pnpm --filter @spark/api test -- activity-session.controller.test.ts
```

Expected: the secret-generation test fails because current output still emits
the callback token, while the provider behavior remains covered by Task 1.

- [ ] **Step 3: Update production configuration and operator documentation**

Set:

```yaml
ACTIVITY_IDENTITY_MODE: ${ACTIVITY_IDENTITY_MODE:-anonymous}
```

Remove callback-only secrets and generation logic. Restore normal shareable
activity-link instructions and document the seven-day cookie limitation. State
that `wechat` mode is reserved for a future account capable of the retained
OAuth flow. Restore Nginx to the non-callback routing configuration; do not
leave a special `/api/wechat/callback` location or menu dependency.

- [ ] **Step 4: Run configuration tests and scan active references**

```bash
node --test scripts/generate-env-secrets.test.mjs
rg -n "WECHAT_CALLBACK_TOKEN|PUBLIC_BASE_URL|LOTTERY|api/wechat/callback|wechat_activity_entry_token|wechat_callback_receipt" .env.example compose.production.yaml apps docs nginx scripts --glob "!docs/superpowers/specs/2026-09-11-activity-anonymous-identity-design.md" --glob "!docs/superpowers/plans/2026-09-11-activity-anonymous-identity.md" --glob "!apps/api/database/migrations/1788739208000-WechatActivityEntryTokens.ts" --glob "!apps/api/database/migrations/1788739209000-WechatCallbackReceipts.ts" --glob "!apps/api/database/migrations/1788739210000-DropWechatEventActivityEntry.ts"
```

Expected: tests PASS and the scan returns no active callback-entry references.

- [ ] **Step 5: Commit configuration and documentation**

```bash
git add .env.example compose.production.yaml scripts docs nginx
git commit -m "Document anonymous activity deployment"
```

### Task 6: Complete repository verification

**Files:**

- Verify only; modify a file only to fix a failure caused by Tasks 1-5.

**Interfaces:**

- Consumes: all prior tasks.
- Produces: evidence that the anonymous flow is ready on current `main`.

- [ ] **Step 1: Format every changed source and document**

```bash
pnpm exec prettier --write apps/api/src/auth/activity-identity-mode.ts apps/api/src/auth/activity-session.controller.ts apps/api/src/auth/activity-session.controller.test.ts apps/api/src/app.module.ts apps/api/src/runtime/runtime.service.ts apps/api/src/lottery/lottery.service.ts apps/api/test/runtime.integration.test.ts apps/api/test/lottery.integration.test.ts apps/activity/src/lib/session-bootstrap.ts apps/activity/src/lib/session-bootstrap.test.ts apps/activity/src/lib/api.ts apps/activity/src/lib/runtime.tsx apps/activity/src/app.tsx tests/e2e/activity-runtime-provider.spec.ts apps/api/database/migrations/1788739210000-DropWechatEventActivityEntry.ts apps/api/database/data-source.ts apps/api/database/entities/accounts.entities.ts apps/api/database/entities/index.ts apps/api/src/main.ts apps/api/src/maintenance/maintenance.service.ts apps/api/src/maintenance/maintenance.service.test.ts apps/api/test/development-migrations.integration.test.ts apps/api/test/entities.integration.test.ts apps/api/test/app-module-providers.integration.test.ts apps/api/test/support/database.ts apps/api/test/support/fixtures.ts .env.example compose.production.yaml scripts/generate-env-secrets.mjs scripts/generate-env-secrets.test.mjs docs/project-spark-configuration.md docs/project-spark-wechat-setup.md docs/project-spark-acceptance.md nginx/nginx.conf nginx/sites-available/spark.gamstek.com.conf docs/superpowers/specs/2026-09-11-activity-anonymous-identity-design.md docs/superpowers/plans/2026-09-11-activity-anonymous-identity.md
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 2: Run the complete validation pipeline without Turbo cache**

```bash
TURBO_FORCE=true pnpm verify
```

In PowerShell use:

```powershell
$env:TURBO_FORCE='true'; pnpm verify; Remove-Item Env:TURBO_FORCE
```

Expected: lint, type checking, unit tests, PostgreSQL integration tests, and all
builds exit 0.

- [ ] **Step 3: Run activity browser tests**

```bash
pnpm exec playwright test --config playwright.activity.config.ts
```

Expected: anonymous unauthorized bootstrap recovers and no test expects an
Official Account callback token or menu re-entry.

- [ ] **Step 4: Audit history and final scope**

```bash
git merge-base --is-ancestor 2ba6da2 HEAD
git log --oneline 2ba6da2..HEAD
git status --short
git diff --check 2ba6da2..HEAD
```

Expected: the ancestor command exits 0, the log contains the restoration
commits, the worktree is clean, and the diff check exits 0.

- [ ] **Step 5: Request final code review and address only verified findings**

Review against the approved spec, with particular attention to anonymous-user
creation, draw-time subscription bypass, migration convergence, callback route
absence, and user-owned commit preservation. Re-run the affected tests after
each accepted finding, then repeat Steps 2-4 before completion.

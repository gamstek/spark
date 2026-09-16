# Activity State and Dialog Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make server-derived activity lifecycle state authoritative across API
and admin surfaces, and replace repeated admin dialog action-row geometry with
one shared component.

**Architecture:** Add a pure lifecycle calculator and shared wire enum in
`@spark/contracts`, then have API list/detail/runtime/mutation services consume
it with one injectable clock abstraction. Admin pages render and authorize
controls from the returned wire status. A layout-only `DialogActions` component
standardizes every admin Dialog and AlertDialog footer without taking ownership
of Radix dismissal semantics.

**Tech Stack:** TypeScript, NestJS/Fastify, TypeORM/PostgreSQL, React, Radix
Themes, Zod, Vitest, Playwright, pnpm/Turborepo.

**Spec:**
`docs/superpowers/specs/2026-09-15-activity-state-and-dialog-actions-design.md`

## Global Constraints

- No database migration or persisted lifecycle status column.
- Lifecycle precedence is `DRAFT`, `ENDED`, `DRAW_ENDED`, `UPCOMING`, `PAUSED`,
  `RUNNING`; equality belongs to the later state.
- API time is authoritative; admin code must not use `Date.now()` to decide
  activity state or pause/resume/end-draw eligibility.
- Preserve existing public error codes, permissions, mutation semantics, Radix
  focus behavior, labels, button intent, and pending guards.
- Do not change historical published-version behavior, concurrent draw-rule
  editing, upload atomicity, rate limiting, or phone/email validation.
- Use two-space indentation, single quotes, semicolons, Prettier, and regression
  tests before production changes.

---

### Task 1: Shared Lifecycle Domain Model

**Files:**

- Create: `packages/contracts/src/activity-status.ts`
- Create: `packages/contracts/src/activity-status.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Produces: `ActivityStatusSchema`, `ActivityStatus`, `ActivityStatusSource`,
  and `deriveActivityStatus(source, now): ActivityStatus`.
- `ActivityStatusSource` fields: `publishedVersionId: string | null`,
  `startsAt: Date`, `drawEndsAt: Date`, `endsAt: Date`, `pausedAt: Date | null`.
- Later API and admin tasks import the enum/schema; only API code imports the
  Date-based calculator.

- [ ] **Step 1: Write failing table-driven lifecycle tests**

```ts
import { describe, expect, it } from 'vitest';
import { deriveActivityStatus } from './activity-status';

const now = new Date('2026-09-15T12:00:00.000Z');
const base = {
  publishedVersionId: 'version-1',
  startsAt: new Date('2026-09-15T00:00:00.000Z'),
  drawEndsAt: new Date('2026-09-16T00:00:00.000Z'),
  endsAt: new Date('2026-09-17T00:00:00.000Z'),
  pausedAt: null,
};

describe('deriveActivityStatus', () => {
  it.each([
    [{ ...base, publishedVersionId: null }, 'DRAFT'],
    [{ ...base, startsAt: now }, 'RUNNING'],
    [{ ...base, startsAt: new Date('2026-09-16T00:00:00.000Z') }, 'UPCOMING'],
    [{ ...base, pausedAt: new Date('2026-09-15T01:00:00.000Z') }, 'PAUSED'],
    [{ ...base, drawEndsAt: now }, 'DRAW_ENDED'],
    [{ ...base, endsAt: now }, 'ENDED'],
    [
      {
        ...base,
        drawEndsAt: now,
        pausedAt: new Date('2026-09-15T01:00:00.000Z'),
      },
      'DRAW_ENDED',
    ],
  ] as const)('returns %s as %s', (source, expected) => {
    expect(deriveActivityStatus(source, now)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:
`pnpm --filter @spark/contracts exec vitest run src/activity-status.test.ts`

Expected: FAIL because `./activity-status` does not exist.

- [ ] **Step 3: Implement the pure calculator and schema**

```ts
import { z } from 'zod';

export const ActivityStatusSchema = z.enum([
  'DRAFT',
  'UPCOMING',
  'RUNNING',
  'PAUSED',
  'DRAW_ENDED',
  'ENDED',
]);
export type ActivityStatus = z.infer<typeof ActivityStatusSchema>;

export type ActivityStatusSource = {
  publishedVersionId: string | null;
  startsAt: Date;
  drawEndsAt: Date;
  endsAt: Date;
  pausedAt: Date | null;
};

export function deriveActivityStatus(
  source: ActivityStatusSource,
  now: Date,
): ActivityStatus {
  if (!source.publishedVersionId) return 'DRAFT';
  if (now >= source.endsAt) return 'ENDED';
  if (now >= source.drawEndsAt) return 'DRAW_ENDED';
  if (now < source.startsAt) return 'UPCOMING';
  if (source.pausedAt) return 'PAUSED';
  return 'RUNNING';
}
```

Export the four symbols from `packages/contracts/src/index.ts`.

- [ ] **Step 4: Run contract tests and typecheck**

Run:
`pnpm --filter @spark/contracts test && pnpm --filter @spark/contracts typecheck`

Expected: PASS with the new lifecycle cases included.

- [ ] **Step 5: Commit the domain model**

```bash
git add packages/contracts/src/activity-status.ts packages/contracts/src/activity-status.test.ts packages/contracts/src/index.ts
git commit -m "Add shared activity lifecycle model"
```

---

### Task 2: Authoritative Admin Activity Responses

**Files:**

- Create: `apps/api/src/common/clock.ts`
- Modify: `apps/api/src/activities/activities.service.ts`
- Modify: `apps/api/src/activities/activities.controller.ts`
- Modify: `apps/api/src/activities/activities.module.ts`
- Modify: `apps/api/test/admin-operations.integration.test.ts`
- Modify: `apps/api/test/support/fixtures.ts`

**Interfaces:**

- Consumes: `deriveActivityStatus` and `ActivityStatus` from Task 1.
- Produces: `Clock` with `now(): Date`; token `APP_CLOCK`;
  `AdminActivityView<T>` response fields `status: ActivityStatus` and
  `serverNow: string`.
- `ActivitiesService.list()` and `.get()` calculate one `now` per call and
  serialize the same ISO value as `serverNow`.

- [ ] **Step 1: Add failing list/detail integration assertions**

Add a published paused fixture whose draw deadline is before the injected test
time. Assert list and detail agree:

```ts
expect(listItem).toMatchObject({
  id: activityId,
  status: 'DRAW_ENDED',
  serverNow: fixedNow.toISOString(),
});
expect(detail).toMatchObject({
  id: activityId,
  status: 'DRAW_ENDED',
  serverNow: fixedNow.toISOString(),
});
```

Also assert an unpublished fixture is `DRAFT` even when its draft schedule has
started.

- [ ] **Step 2: Run the focused integration test and verify RED**

Run:
`pnpm --filter @spark/api exec vitest run --config vitest.config.ts test/admin-operations.integration.test.ts`

Expected: FAIL because responses lack `status` and `serverNow`.

- [ ] **Step 3: Add the application clock and map raw rows**

Implement:

```ts
export interface Clock {
  now(): Date;
}
export const APP_CLOCK = Symbol('APP_CLOCK');
export const systemClock: Clock = { now: () => new Date() };
```

Register `{ provide: APP_CLOCK, useValue: systemClock }` in the activities
module. Inject it into `ActivitiesService`; replace the constructor's default
function clock. Add a private mapper that converts snake-case row dates to
`Date`, calls `deriveActivityStatus`, and returns
`{ ...row, status, serverNow: now.toISOString() }`. Call `clock.now()` exactly
once in each list/get request and pass it to every mapped row.

- [ ] **Step 4: Run focused integration, API typecheck, and existing publishing
      tests**

Run:
`pnpm --filter @spark/api exec vitest run --config vitest.config.ts test/admin-operations.integration.test.ts test/publishing.integration.test.ts test/publishing-lock.integration.test.ts`

Run: `pnpm --filter @spark/api typecheck`

Expected: PASS; existing activity writes and locks remain unchanged.

- [ ] **Step 5: Commit authoritative admin responses**

```bash
git add apps/api/src/common/clock.ts apps/api/src/activities/activities.service.ts apps/api/src/activities/activities.controller.ts apps/api/src/activities/activities.module.ts apps/api/test/admin-operations.integration.test.ts apps/api/test/support/fixtures.ts
git commit -m "Return authoritative activity status"
```

---

### Task 3: Align Runtime and Lifecycle Mutations

**Files:**

- Modify: `apps/api/src/runtime/runtime.service.ts`
- Modify: `apps/api/src/lottery/lottery.service.ts`
- Modify: `apps/api/src/activities/publish.service.ts`
- Modify: `apps/api/src/runtime/runtime.module.ts`
- Modify: `apps/api/src/lottery/lottery.module.ts`
- Modify: `apps/api/test/runtime.integration.test.ts`
- Modify: `apps/api/test/lottery.integration.test.ts`
- Modify: `apps/api/test/publishing.integration.test.ts`

**Interfaces:**

- Consumes: `APP_CLOCK`, `Clock`, and `deriveActivityStatus` from Tasks 1–2.
- Produces: one lifecycle decision path for runtime scene, draw eligibility, end
  draw, pause, and resume.
- Existing external response scenes and error codes remain unchanged.

- [ ] **Step 1: Add failing agreement tests at exact boundaries**

For a published paused activity at `drawEndsAt`, assert:

```ts
await expect(runtime.get(activityCode, userId)).resolves.toMatchObject({
  scene: 'ENDED',
});
await expect(lottery.draw(activityCode, userId)).rejects.toThrow(
  'ACTIVITY_NOT_RUNNING',
);
await expect(publishing.resume(activityId, adminId)).rejects.toThrow(
  'ACTIVITY_NOT_RUNNING',
);
```

For `now === startsAt`, assert runtime is active and pause succeeds. Retain the
existing empty-stock and redemption boundary tests unchanged.

- [ ] **Step 2: Run the three focused integration files and verify RED**

Run:
`pnpm --filter @spark/api exec vitest run --config vitest.config.ts test/runtime.integration.test.ts test/lottery.integration.test.ts test/publishing.integration.test.ts`

Expected: at least one boundary assertion fails because services still have
independent clock/state branches.

- [ ] **Step 3: Inject the shared clock and translate shared states**

Replace service-local `() => Date` defaults with
`@Inject(APP_CLOCK) clock: Clock`. Register/import the provider through the
owning modules without creating multiple per-request timestamps. For each
operation, call `const now = this.clock.now()` once, derive status from the
locked/query row, and translate:

```ts
switch (status) {
  case 'PAUSED':
    throw new Error('ACTIVITY_PAUSED');
  case 'RUNNING':
    break;
  default:
    throw new Error('ACTIVITY_NOT_RUNNING');
}
```

Runtime maps `UPCOMING` to its existing not-started scene, `PAUSED` to paused,
and both ended states to the existing ended scene. Pause accepts only `RUNNING`;
resume accepts only `PAUSED`; end draw accepts `RUNNING` or `PAUSED` only if
that matches the current established endpoint contract.

- [ ] **Step 4: Run focused and complete API tests**

Run: `pnpm --filter @spark/api test`

Run: `pnpm --filter @spark/api test:integration`

Expected: all unit and integration tests pass, including boundary, stock
concurrency, and redemption expiry coverage.

- [ ] **Step 5: Commit service convergence**

```bash
git add apps/api/src/runtime apps/api/src/lottery apps/api/src/activities/publish.service.ts apps/api/test/runtime.integration.test.ts apps/api/test/lottery.integration.test.ts apps/api/test/publishing.integration.test.ts
git commit -m "Unify activity lifecycle decisions"
```

---

### Task 4: Consume Server Status in Admin

**Files:**

- Modify: `apps/admin/src/features/activities/activity-status.ts`
- Modify: `apps/admin/src/features/activities/activity-status.test.ts`
- Modify: `apps/admin/src/features/activities/list-page.tsx`
- Modify: `apps/admin/src/features/activities/edit-page.tsx`
- Modify: `apps/admin/src/components/workspace-context.tsx`
- Modify: `apps/admin/src/components/status-badge.tsx`
- Modify: `tests/e2e/admin.spec.ts`

**Interfaces:**

- Consumes: `ActivityStatus` returned by the API.
- Produces: `getActivityStatusPresentation(status)` and
  `getActivityActions(status)`; no client timestamp input.
- `getActivityActions` returns
  `{ canPause: boolean; canResume: boolean; canEndDraw: boolean }`.

- [ ] **Step 1: Replace client-time unit expectations with wire-state tests**

```ts
it.each([
  ['DRAFT', '草稿'],
  ['UPCOMING', '未开始'],
  ['RUNNING', '进行中'],
  ['PAUSED', '已暂停'],
  ['DRAW_ENDED', '抽奖已结束'],
  ['ENDED', '活动已结束'],
] as const)('maps %s to %s', (status, label) => {
  expect(getActivityStatusPresentation(status).label).toBe(label);
});

expect(getActivityActions('RUNNING')).toEqual({
  canPause: true,
  canResume: false,
  canEndDraw: true,
});
expect(getActivityActions('PAUSED')).toEqual({
  canPause: false,
  canResume: true,
  canEndDraw: true,
});
expect(getActivityActions('DRAW_ENDED')).toEqual({
  canPause: false,
  canResume: false,
  canEndDraw: false,
});
```

- [ ] **Step 2: Run admin unit tests and verify RED**

Run:
`pnpm --filter @spark/admin exec vitest run src/features/activities/activity-status.test.ts`

Expected: FAIL because current helper accepts timestamp-bearing rows and returns
labels directly.

- [ ] **Step 3: Implement presentation/actions and migrate consumers**

Use an exhaustive `Record<ActivityStatus, { label; color }>` for labels and
badge intent. Update list/detail/workspace response types to require `status`
and `serverNow`. Remove state decisions based on `Date.now()`, `Date.parse()`,
`starts_at`, `draw_ends_at`, `ends_at`, and `paused_at`; schedule fields remain
display/edit data only. After pause/resume/end-draw, refresh both detail and
shared activity context through the existing loaders.

- [ ] **Step 4: Add an E2E consistency assertion**

Update the existing list/detail status test fixture to return
`status: 'DRAW_ENDED'` and a fixed `serverNow` from both endpoints. Assert both
screens display `抽奖已结束` even when the browser clock is overridden to an
earlier time. Update all activity API mocks with required status fields.

- [ ] **Step 5: Run admin unit tests and focused browser flows**

Run: `pnpm --filter @spark/admin test && pnpm --filter @spark/admin typecheck`

Run:
`pnpm exec playwright test tests/e2e/admin.spec.ts -g "status|pauses and resumes"`

Expected: PASS; status and action visibility follow API values regardless of
browser time.

- [ ] **Step 6: Commit the admin status migration**

```bash
git add apps/admin/src/features/activities apps/admin/src/components/workspace-context.tsx apps/admin/src/components/status-badge.tsx tests/e2e/admin.spec.ts
git commit -m "Use server activity status in admin"
```

---

### Task 5: Canonical Admin Dialog Actions

**Files:**

- Create: `apps/admin/src/components/dialog-actions.tsx`
- Create: `apps/admin/src/components/dialog-actions.test.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `apps/admin/src/features/activities/edit-page.tsx`
- Modify: `apps/admin/src/features/prizes/prizes-page.tsx`
- Modify: `apps/admin/src/features/staff/staff-page.tsx`
- Modify: `apps/admin/src/features/participants/participant-detail-dialog.tsx`
- Modify: `tests/e2e/admin.spec.ts`
- Modify: `tests/e2e/admin-account-staff.spec.ts`
- Modify: `tests/e2e/admin-participant-detail.spec.ts`
- Modify: `tests/e2e/admin-table-contract.spec.ts`
- Modify: `DESIGN.md`

**Interfaces:**

- Produces:
  `DialogActions({ children, className? }: PropsWithChildren<{ className?: string }>)`.
- Consumes: caller-owned Radix `Dialog.Close`, `AlertDialog.Cancel`, and
  `AlertDialog.Action` children.
- Geometry owner: `.dialog-actions` in admin CSS with canonical gap, margin,
  wrapping, and alignment.

- [ ] **Step 1: Write a failing component contract test**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DialogActions } from './dialog-actions';

it('owns the canonical dialog action-row class without changing children', () => {
  const html = renderToStaticMarkup(
    <DialogActions>
      <button type="button">取消</button>
      <button type="submit">确认</button>
    </DialogActions>,
  );
  expect(html).toContain('class="dialog-actions"');
  expect(html.indexOf('取消')).toBeLessThan(html.indexOf('确认'));
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run:
`pnpm --filter @spark/admin exec vitest run src/components/dialog-actions.test.tsx`

Expected: FAIL because `DialogActions` does not exist.

- [ ] **Step 3: Implement the layout-only component and CSS**

```tsx
import type { PropsWithChildren } from 'react';

export function DialogActions({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={['dialog-actions', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
```

```css
.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-5);
}
```

At the existing narrow breakpoint, keep actions reachable and aligned; use
full-width buttons only if the existing dialog tests demonstrate insufficient
width.

- [ ] **Step 4: Migrate all admin dialog footer rows**

Replace local footer `Flex` wrappers in activity pause/end, prize inventory,
staff create/edit/status, and participant detail. Keep Radix semantic wrappers
and button order inside `DialogActions`. Use `className` only for the
participant detail footer if its sticky/scroll boundary requires the existing
hook; do not expose local `justify`, `gap`, or `margin` props.

- [ ] **Step 5: Add geometry and focus regression assertions**

In Playwright, for pause, stock, staff, and participant dialogs, assert the
first and last action have aligned vertical centers within 1 CSS pixel:

```ts
const cancelBox = await cancel.boundingBox();
const confirmBox = await confirm.boundingBox();
expect(
  Math.abs(
    cancelBox!.y +
      cancelBox!.height / 2 -
      (confirmBox!.y + confirmBox!.height / 2),
  ),
).toBeLessThanOrEqual(1);
```

Retain existing Escape/cancel focus-restoration tests and repeat one
confirmation dialog at 390px width.

- [ ] **Step 6: Run component and dialog browser tests**

Run: `pnpm --filter @spark/admin test && pnpm --filter @spark/admin typecheck`

Run:
`pnpm exec playwright test tests/e2e/admin.spec.ts tests/e2e/admin-account-staff.spec.ts tests/e2e/admin-participant-detail.spec.ts tests/e2e/admin-table-contract.spec.ts`

Expected: PASS with desktop and narrow action alignment plus existing focus
behavior.

- [ ] **Step 7: Update design ownership and commit**

Add `DialogActions` to the canonical component table in `DESIGN.md`, explicitly
documenting that Radix wrappers retain dismissal/focus ownership.

```bash
git add apps/admin/src/components/dialog-actions.tsx apps/admin/src/components/dialog-actions.test.tsx apps/admin/src/styles.css apps/admin/src/features/activities/edit-page.tsx apps/admin/src/features/prizes/prizes-page.tsx apps/admin/src/features/staff/staff-page.tsx apps/admin/src/features/participants/participant-detail-dialog.tsx tests/e2e DESIGN.md
git commit -m "Standardize admin dialog actions"
```

---

### Task 6: Remove Compatibility Paths and Verify the System

**Files:**

- Modify: any activity API mocks found by
  `rg "published_version_id|serverNow|status:" tests apps/admin/src --glob "*.test.*" --glob "*.spec.*"`
- Modify: `UX-CONTRACT.md`
- Verify: all files changed by Tasks 1–5

**Interfaces:**

- Consumes: authoritative API `status`, shared lifecycle calculator, and
  `DialogActions`.
- Produces: no client lifecycle fallback and documented canonical ownership.

- [ ] **Step 1: Prove every in-repository activity response carries status**

Run:
`rg -n "published_version_id" apps/admin/src tests/e2e --glob "*.ts" --glob "*.tsx"`

Update each response fixture with an explicit `status` and `serverNow`. Remove
the old client-derived `getActivityStatus(source, now)` implementation and any
compatibility branch. Search must show no `Date.now()`/`Date.parse()` lifecycle
decision in activity list, editor, or workspace context.

- [ ] **Step 2: Update the UX contract**

Document API-owned activity lifecycle state and `DialogActions` ownership in
`UX-CONTRACT.md`. Preserve the existing dataset, focus, feedback, and
localization policies.

- [ ] **Step 3: Format and run static checks**

Run:
`pnpm exec prettier --write packages/contracts/src apps/api/src apps/api/test apps/admin/src tests/e2e DESIGN.md UX-CONTRACT.md`

Run: `pnpm lint && pnpm typecheck && git diff --check`

Expected: exit 0 with no lint, type, or whitespace errors.

- [ ] **Step 4: Run complete project verification**

Run: `pnpm verify`

Expected: lint, typecheck, unit tests, builds, and all PostgreSQL integration
tests pass.

- [ ] **Step 5: Run CI and full browser verification**

Run: `node --test .github/scripts/ci-workflow.test.mjs`

Run: `pnpm exec playwright test`

Expected: CI workflow tests pass; Playwright reports 66 passed and 4
intentionally skipped unless the suite count has deliberately changed.

- [ ] **Step 6: Run and inspect the premium UI audit**

Run:
`python C:/Users/lengjing/.codex/plugins/cache/openai-curated-remote/frontend-design-premium/1.4.0/skills/frontend-design-premium/scripts/audit_project.py C:/Users/lengjing/workspace/code/github/spark --mode strict --no-write`

Expected: inspect every finding. Resolve new findings introduced by this work;
report known Radix composition/native ownership heuristic findings and the
actual nonzero exit instead of claiming a clean audit.

- [ ] **Step 7: Review the final diff and commit documentation cleanup**

Run: `git diff --stat` and `git diff --check`.

```bash
git add UX-CONTRACT.md
git commit -m "Document authoritative activity lifecycle"
```

Do not stage the two unrelated untracked authorization-agreement documents or
any pre-existing user changes outside this plan.

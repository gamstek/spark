# Admin UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing operations console into a clear, responsive Radix
Themes application without changing its API contracts or business flows.

**Architecture:** App-local layout and feedback components provide a consistent
shell for every existing route. Radix Themes supplies accessible controls and
tokens; a small CSS layer defines Spark's exhibition-operations identity and
responsive behavior.

**Tech Stack:** React, TypeScript, React Router, Radix Themes, Radix Icons,
Tailwind CSS, Playwright, Vitest.

**Spec:**
[Admin Entities and UI Redesign](../specs/2026-09-07-admin-entities-ui-redesign.md)

## Global Constraints

- Keep all UI code in `apps/admin`; do not add a shared UI package.
- Preserve existing routes, API request bodies, response handling, permissions,
  and Chinese action names where tests rely on them.
- Use Radix Themes components and `@radix-ui/react-icons`; do not reproduce
  primitive behavior in custom CSS.
- Use `iris`, `jade`, `amber`, and `tomato` semantic colors with the approved
  neutral palette.
- Remove the global 1024 px minimum width and support 1440, 1024, and 768 px
  viewports.
- Avoid decorative gradients, identical metric-card grids, placeholder-only form
  labels, and color-only status communication.

---

### Task 1: Build the application shell and visual foundation

**Files:**

- Modify: `apps/admin/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/admin/src/components/app-shell.tsx`
- Create: `apps/admin/src/components/page-header.tsx`
- Create: `apps/admin/src/components/activity-nav.tsx`
- Create: `apps/admin/src/components/status-badge.tsx`
- Create: `apps/admin/src/components/feedback.tsx`
- Modify: `apps/admin/src/app.tsx`
- Replace: `apps/admin/src/styles.css`
- Test: `tests/e2e/admin.spec.ts`

**Interfaces:**

- Produces: `AppShell`, `PageHeader`, `ActivityNav`, `StatusBadge`,
  `FeedbackCallout`, `EmptyState`, and `LoadingState`.
- Preserves: `/admin/*` routing and session restoration.

- [ ] **Step 1: Add failing shell behavior assertions**

After session restoration, assert accessible navigation links for activities,
staff, and failed tasks, plus the current page landmark. At 768 px, assert the
compact navigation control can reveal the same links.

- [ ] **Step 2: Run the focused Playwright test and observe failure**

```bash
pnpm exec playwright test tests/e2e/admin.spec.ts --grep "navigation shell"
```

- [ ] **Step 3: Add Radix Icons and implement shared components**

Install the locked workspace dependency:

```bash
pnpm --filter @spark/admin add @radix-ui/react-icons
```

Wrap the application in:

```tsx
<Theme
  accentColor="iris"
  grayColor="sage"
  radius="medium"
  scaling="100%"
>
  <BrowserRouter basename="/admin">...</BrowserRouter>
</Theme>
```

Implement a 240 px desktop rail, compact navigation below 900 px, page header,
activity sub-navigation, semantic badges, and shared loading/empty/error states.

- [ ] **Step 4: Implement the approved tokens and responsive rules**

Define CSS custom properties for canvas, surface, navigation, text, and borders.
Add visible `:focus-visible` treatment, reduced-motion handling, bounded content
width, and horizontally scrollable table regions. Do not set a body minimum
width.

- [ ] **Step 5: Run shell E2E, typecheck, and lint**

Expected: navigation works at desktop and compact widths; all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/admin tests/e2e/admin.spec.ts pnpm-lock.yaml
git commit -m "Redesign admin application shell"
```

### Task 2: Redesign login and activity list

**Files:**

- Modify: `apps/admin/src/features/auth/login-page.tsx`
- Modify: `apps/admin/src/features/activities/list-page.tsx`
- Test: `tests/e2e/admin.spec.ts`

**Interfaces:**

- Consumes: `PageHeader`, `StatusBadge`, `EmptyState`, `LoadingState`, and
  existing `api()`.
- Preserves: login redirect and `activities/new` navigation.

- [ ] **Step 1: Add failing assertions for labeled login and activity states**

Use `getByLabel('管理员账号')`, `getByLabel('密码')`, status text, and the
empty-state create action. Add a delayed route response to verify a loading
state appears before the table.

- [ ] **Step 2: Run the new tests and observe the missing labels/states**

- [ ] **Step 3: Implement login and activity list**

Use visible `Text` labels, `TextField`, submit spinner/disabled state, and
`Callout` for authentication failure. Give the activity list a page header,
status badges, schedule text, copyable path treatment, row actions, loading
skeleton, and directed empty state.

- [ ] **Step 4: Run focused E2E, typecheck, and lint**

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/auth apps/admin/src/features/activities/list-page.tsx tests/e2e/admin.spec.ts
git commit -m "Redesign admin login and activity list"
```

### Task 3: Redesign activity editing and prize operations

**Files:**

- Modify: `apps/admin/src/features/activities/edit-page.tsx`
- Modify: `apps/admin/src/templates/exhibition-lottery/config-form.tsx`
- Modify: `apps/admin/src/features/prizes/prizes-page.tsx`
- Test: `tests/e2e/admin.spec.ts`

**Interfaces:**

- Consumes: `PageHeader`, `ActivityNav`, `FeedbackCallout`, Radix `AlertDialog`
  and `Dialog`.
- Preserves: draft create/update, media upload, publish, end draw, prize
  creation, and idempotent stock addition requests.

- [ ] **Step 1: Add failing assertions for labels and confirmations**

Assert visible labels for activity name, DingTalk configuration, all four
timestamps, and media. Assert “提前结束抽奖” opens a confirmation dialog before
the POST. Assert “添加库存” opens a Dialog and submits a positive quantity.

- [ ] **Step 2: Run focused tests and observe current failures**

- [ ] **Step 3: Implement the sectioned activity editor**

Separate basic information, DingTalk form, visual material, schedule, and rules
into bordered sections. Add a sticky action bar for save/publish, contextual
locked-state Callout, ActivityNav, and AlertDialog for ending the draw. Preserve
current field names and payload creation.

- [ ] **Step 4: Implement prize table and dialogs**

Show awarded, total, and available inventory. Move stock addition into a Dialog,
provide labeled numeric fields, keep prize creation unavailable after start, and
surface success/error Callouts.

- [ ] **Step 5: Run existing and new admin E2E tests**

Expected: creation, revision conflict, locked activity, end-draw confirmation,
and stock-dialog behavior all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/features/activities apps/admin/src/features/prizes apps/admin/src/templates tests/e2e/admin.spec.ts
git commit -m "Redesign activity and prize operations"
```

### Task 4: Redesign operational data pages

**Files:**

- Modify: `apps/admin/src/features/participants/participants-page.tsx`
- Modify: `apps/admin/src/features/redemptions/list-page.tsx`
- Modify: `apps/admin/src/features/reports/overview-page.tsx`
- Modify: `apps/admin/src/features/exports/exports-page.tsx`
- Modify: `apps/admin/src/features/staff/staff-page.tsx`
- Modify: `apps/admin/src/features/jobs/jobs-page.tsx`
- Test: `tests/e2e/admin.spec.ts`

**Interfaces:**

- Consumes: shared shell components, ActivityNav, tables, dialogs, badges, and
  Callouts.
- Preserves: all existing fetch and mutation endpoints.

- [ ] **Step 1: Add failing operational-state tests**

Cover an empty participant list, redemption status badges, report loading,
export progress, staff disable confirmation, and failed-job retry feedback using
mocked HTTP responses and accessible roles.

- [ ] **Step 2: Run the focused tests and observe missing states**

- [ ] **Step 3: Implement activity data pages**

Add ActivityNav and PageHeader to participants, redemptions, reports, and
exports. Use readable table headers, Shanghai timestamps, status badges, empty
states, and bounded overflow. Group report measures by funnel and inventory
relationship rather than identical cards.

- [ ] **Step 4: Implement staff and job operations**

Separate staff identity, account state, and activity assignments. Use
AlertDialog for disabling accounts and Callout feedback for mutations. Add
headers, timestamps, failure details, retry progress, and empty state to jobs.

- [ ] **Step 5: Run all admin E2E tests, typecheck, lint, and build**

```bash
pnpm exec playwright test tests/e2e/admin.spec.ts
pnpm --filter @spark/admin typecheck
pnpm --filter @spark/admin lint
pnpm --filter @spark/admin build
```

- [ ] **Step 6: Commit**

```bash
git add apps/admin tests/e2e/admin.spec.ts
git commit -m "Redesign admin operations pages"
```

### Task 5: Visual review and repository verification

**Files:**

- Modify only files whose verified layout or accessibility issue requires
  correction.
- Update: `docs/superpowers/plans/2026-09-07-project-spark-sdd-tasks.md`

- [ ] **Step 1: Capture visual review screenshots**

Run the admin application with mocked API routes and capture login, activity
list, editor, prizes, participants, report, and failed jobs at 1440×900,
1024×768, and 768×1024.

- [ ] **Step 2: Review against the approved design**

Check hierarchy, alignment, Chinese wrapping, table overflow, dialog focus,
keyboard focus visibility, empty/loading/error states, and destructive-action
clarity. Correct observed defects only.

- [ ] **Step 3: Run the complete validation pipeline**

```bash
pnpm verify
pnpm exec playwright test tests/e2e/admin.spec.ts
git diff --check
```

- [ ] **Step 4: Update SDD progress and commit**

Mark the completed T14 acceptance evidence and record the verification commands
without changing the deferred activity/staff scope.

```bash
git add apps/admin tests/e2e docs/superpowers/plans/2026-09-07-project-spark-sdd-tasks.md
git commit -m "Complete admin redesign verification"
```

# Spark Admin Dual-Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild every post-login Spark Admin screen with the approved dual-zone layout, complete light/dark themes, compact Radix controls, and Ghost-first tables without changing business behavior.

**Architecture:** A small theme module owns persisted `light | dark | system` preference and exposes the resolved Radix appearance. `AppShell` owns the dual-zone workspace and route-aware context panel; shared page/table primitives establish the Ghost-first contract, then feature pages migrate onto those primitives. CSS custom properties remain the runtime token source and `DESIGN.md` mirrors the contract.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Radix Themes 3.3, Vitest 5, Playwright, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-09-10-admin-dual-theme-redesign.md`

## Global Constraints

- Scope is `apps/admin`; do not change API, database, permissions, publication locking, stock idempotency, or export retention behavior.
- Use two-space indentation, single quotes, semicolons, and repository Prettier formatting.
- CSS custom properties are the runtime source of truth; keep `DESIGN.md` synchronized.
- Every page or action group has at most one Solid primary action; ordinary secondary actions use Radix Ghost.
- Dataset tables use Radix Ghost presentation without a Card/Surface wrapper.
- Default buttons use Radix `size="2"`; compact frequent actions may use `size="1"`.
- Preserve Chinese copy, `zh-CN` formatting, and `Asia/Shanghai` business time.
- Target WCAG 2.2 AA, visible focus, keyboard operation, reduced motion, narrow layouts, and 200% zoom.
- Preserve unrelated working-tree changes and stage only files named by the active task.

---

### Task 1: Persisted theme preference

**Files:**
- Create: `apps/admin/src/theme/theme-preference.ts`
- Create: `apps/admin/src/theme/theme-preference.test.ts`
- Create: `apps/admin/src/theme/theme-provider.tsx`
- Modify: `apps/admin/src/app.tsx`

**Interfaces:**
- Produces: `ThemePreference = 'light' | 'dark' | 'system'`.
- Produces: `resolveTheme(preference, systemDark): 'light' | 'dark'`.
- Produces: `ThemeProvider` and `useAdminTheme(): { preference; resolvedTheme; setPreference }`.

- [ ] **Step 1: Write failing preference tests**

```ts
import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme-preference';

describe('resolveTheme', () => {
  it('resolves explicit and system preferences', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `pnpm --filter @spark/admin test -- src/theme/theme-preference.test.ts`

Expected: FAIL because `theme-preference.ts` does not exist.

- [ ] **Step 3: Implement the pure resolver and React provider**

```ts
export type ThemePreference = 'light' | 'dark' | 'system';

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): 'light' | 'dark' {
  return preference === 'system'
    ? systemDark
      ? 'dark'
      : 'light'
    : preference;
}
```

In `theme-provider.tsx`, read `spark-admin-theme` from `localStorage`, subscribe to `matchMedia('(prefers-color-scheme: dark)')`, set `document.documentElement.dataset.theme`, persist explicit changes, and throw a clear error when `useAdminTheme` is called outside the provider.

- [ ] **Step 4: Move Radix Theme ownership into `ThemeProvider`**

Wrap the router with `ThemeProvider`; render Radix `<Theme appearance={resolvedTheme}>` inside it while preserving `accentColor="violet"`, `grayColor="slate"`, `radius="medium"`, and `scaling="100%"`.

- [ ] **Step 5: Run focused and package tests**

Run: `pnpm --filter @spark/admin test -- src/theme/theme-preference.test.ts`

Expected: PASS.

Run: `pnpm --filter @spark/admin typecheck`

Expected: exit 0.

- [ ] **Step 6: Commit the theme foundation**

```bash
git add apps/admin/src/theme apps/admin/src/app.tsx
git commit -m "Add admin theme preference"
```

### Task 2: Dual-zone application shell and theme menu

**Files:**
- Modify: `apps/admin/src/components/app-shell.tsx`
- Create: `apps/admin/src/components/workspace-context.tsx`
- Modify: `apps/admin/src/components/index.ts`
- Modify: `apps/admin/src/styles.css`
- Modify: `tests/e2e/admin-layout.spec.ts`

**Interfaces:**
- Consumes: `useAdminTheme()` from Task 1.
- Produces: `WorkspaceContext({ pathname }: { pathname: string })` for route-aware left-zone content.
- Produces: account menu radio items for `light`, `dark`, and `system`.

- [ ] **Step 1: Add a failing Playwright theme test**

```ts
test('switches and persists the complete admin theme', async ({ page }) => {
  await page.goto('/admin/activities');
  await page.getByRole('button', { name: '账号菜单' }).click();
  await page.getByRole('menuitemradio', { name: '深色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.app-workspace')).toHaveCSS(
    'background-color',
    'rgb(32, 29, 33)',
  );
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
```

- [ ] **Step 2: Run the focused browser test and verify failure**

Run: `pnpm exec playwright test tests/e2e/admin-layout.spec.ts --grep "switches and persists"`

Expected: FAIL because the menu has no theme radio items.

- [ ] **Step 3: Implement the route-aware dual-zone shell**

Keep the existing navigation semantics and logout flow. Replace the plain 224px sidebar with the approved 300px context zone on wide screens, render global navigation plus `WorkspaceContext`, and keep the existing Radix Dialog mobile drawer below 900px.

- [ ] **Step 4: Add theme controls to the account menu**

Use `DropdownMenu.RadioGroup` and three `DropdownMenu.RadioItem` controls labeled `浅色`, `深色`, and `跟随系统`; keep logout visually separated and red.

- [ ] **Step 5: Define complete light and dark token sets**

Add `:root, [data-theme='light']` and `[data-theme='dark']` variables for canvas, context zone, panel, text, muted text, border, hover, scrollbar, and primary action. Ensure `.app-workspace`, topbar, drawer, dialogs, popovers, feedback, and scrollbars consume tokens rather than fixed white colors.

- [ ] **Step 6: Run focused verification and commit**

Run: `pnpm --filter @spark/admin typecheck`

Run: `pnpm exec playwright test tests/e2e/admin-layout.spec.ts --grep "switches and persists"`

Expected: both exit 0.

```bash
git add apps/admin/src/components/app-shell.tsx apps/admin/src/components/workspace-context.tsx apps/admin/src/components/index.ts apps/admin/src/styles.css tests/e2e/admin-layout.spec.ts
git commit -m "Build dual-zone admin shell"
```

### Task 3: Shared Ghost page and dataset primitives

**Files:**
- Modify: `apps/admin/src/components/page-header.tsx`
- Create: `apps/admin/src/components/ghost-table.tsx`
- Create: `apps/admin/src/components/ghost-table.test.tsx`
- Modify: `apps/admin/src/components/index.ts`
- Modify: `apps/admin/src/styles.css`

**Interfaces:**
- Produces: `GhostTable({ children, className })` wrapping Radix `Table.Root variant="ghost"` without a Card.
- Produces: `GhostTableFooter({ range, children })` for result range and pagination/actions.
- Changes: `PageHeader` keeps existing props and adds optional `context?: string`.

- [ ] **Step 1: Add a failing source contract test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('GhostTable', () => {
  it('uses the Radix ghost variant without a Card surface', () => {
    const source = readFileSync(new URL('./ghost-table.tsx', import.meta.url), 'utf8');
    expect(source).toContain('variant="ghost"');
    expect(source).not.toContain('<Card');
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter @spark/admin test -- src/components/ghost-table.test.tsx`

Expected: FAIL because `ghost-table.tsx` does not exist.

- [ ] **Step 3: Implement the primitives**

Use Radix `Table.Root variant="ghost"`, preserve semantic table children, merge `ghost-table` with the optional class name, and implement a stable footer with `role="status"` for the range text.

- [ ] **Step 4: Tighten `PageHeader` hierarchy**

Render the optional context above the h1, keep the existing description below it, and ensure the action area defaults to compact controls without changing passed business handlers.

- [ ] **Step 5: Add shared Ghost CSS and run tests**

Define horizontal rules, row hover, selected/focus states, numeric alignment, internal horizontal overflow, and theme-aware footer/pagination styles.

Run: `pnpm --filter @spark/admin test -- src/components/ghost-table.test.tsx`

Run: `pnpm --filter @spark/admin typecheck`

Expected: both exit 0.

- [ ] **Step 6: Commit shared primitives**

```bash
git add apps/admin/src/components apps/admin/src/styles.css
git commit -m "Add ghost admin primitives"
```

### Task 4: Activity management landing page

**Files:**
- Modify: `apps/admin/src/features/activities/list-page.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `GhostTable`, `GhostTableFooter`, `PageHeader`, and existing `StatusBadge`.
- Preserves: existing activity fetch, search parameters, status calculation, date formatting, and create/manage routes.

- [ ] **Step 1: Add failing landing-page assertions**

In the existing responsive admin test, assert `.activity-collection` is not a `.rt-Card`, the table root has the Ghost class, `新建活动` is the only solid button in `main`, and search/status controls remain reachable by accessible name.

- [ ] **Step 2: Run the focused test and verify the old Card layout fails**

Run: `pnpm exec playwright test tests/e2e/admin.spec.ts --grep "responsive navigation shell"`

Expected: FAIL on the surface/solid-button assertions.

- [ ] **Step 3: Recompose the page**

Use the approved order: compact title and one Solid `新建活动` action, four quiet metrics separated by rules, then an unframed Ghost dataset. Change search, status filtering, clear action, management action, and pagination controls to compact Ghost presentation while retaining accessible labels and URL state.

- [ ] **Step 4: Preserve all dataset states**

Keep loading, failed, first-use empty, and no-results states. Ensure the no-results clear action is Ghost and the first-use create action is the only Solid action in that state.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @spark/admin typecheck`

Run: `pnpm exec playwright test tests/e2e/admin.spec.ts --grep "responsive navigation shell"`

Expected: both exit 0.

```bash
git add apps/admin/src/features/activities/list-page.tsx apps/admin/src/styles.css tests/e2e/admin.spec.ts
git commit -m "Redesign activity workspace"
```

### Task 5: Activity editor and child routes

**Files:**
- Modify: `apps/admin/src/features/activities/activity-layout.tsx`
- Modify: `apps/admin/src/features/activities/edit-page.tsx`
- Modify: `apps/admin/src/components/activity-nav.tsx`
- Modify: `apps/admin/src/templates/exhibition-lottery/config-form.tsx`
- Modify: `apps/admin/src/features/prizes/prizes-page.tsx`
- Modify: `apps/admin/src/features/participants/participants-page.tsx`
- Modify: `apps/admin/src/features/redemptions/list-page.tsx`
- Modify: `apps/admin/src/features/reports/overview-page.tsx`
- Modify: `apps/admin/src/features/exports/exports-page.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: shared shell, page header, theme tokens, Ghost tables, feedback components, and ActivityNav.
- Preserves: create/edit/publish/end-draw, upload, stock, participant, redemption, report, and export API behavior.

- [ ] **Step 1: Extend existing workflow tests with presentation contracts**

Add assertions to the create/edit, stock, operational-states, and export tests that tables use Ghost roots, secondary actions are not Solid, activity navigation remains keyboard reachable, and the editor exposes a visible publication status region.

- [ ] **Step 2: Run the four focused workflows and verify failure**

Run: `pnpm exec playwright test tests/e2e/admin.spec.ts --grep "creates the only supported|adds inventory|operational loading|revision conflicts"`

Expected: FAIL on the new presentation assertions while existing business assertions remain valid.

- [ ] **Step 3: Recompose the activity layout and editor**

Move activity identity/status into the context zone, keep ActivityNav as route navigation, render configuration sections directly on the canvas, and keep a compact publication summary alongside the form on wide screens and in document flow on narrow screens. Save is secondary; Publish is the single Solid action; end-draw remains separated and red.

- [ ] **Step 4: Migrate child datasets**

Replace Card-wrapped tables in prizes, participants, redemptions, reports, and exports with `GhostTable`. Convert normal secondary actions to Ghost, preserve Dialog/AlertDialog for risky actions, and retain each page's loading, empty, error, success, and no-results behavior.

- [ ] **Step 5: Verify child workflows and commit**

Run: `pnpm --filter @spark/admin test`

Run: `pnpm --filter @spark/admin typecheck`

Run: `pnpm exec playwright test tests/e2e/admin.spec.ts --grep "creates the only supported|adds inventory|operational loading|revision conflicts"`

Expected: all exit 0.

```bash
git add apps/admin/src/features apps/admin/src/templates/exhibition-lottery/config-form.tsx apps/admin/src/components/activity-nav.tsx apps/admin/src/styles.css tests/e2e/admin.spec.ts
git commit -m "Redesign activity operations pages"
```

### Task 6: Staff, jobs, login, and remaining states

**Files:**
- Modify: `apps/admin/src/features/staff/staff-page.tsx`
- Modify: `apps/admin/src/features/jobs/jobs-page.tsx`
- Modify: `apps/admin/src/features/auth/login-page.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `tests/e2e/admin-account-staff.spec.ts`
- Modify: `tests/e2e/admin-layout.spec.ts`

**Interfaces:**
- Consumes: theme preference, shared shell, page header, Ghost table, Dialog/AlertDialog, and feedback primitives.
- Preserves: staff create/edit/disable/password and failed-job retry behavior.

- [ ] **Step 1: Add failing theme and Ghost assertions**

Extend account/staff tests to assert staff rows are unframed and row actions are Ghost. Extend login layout tests to set `spark-admin-theme=dark` before navigation and assert the login root resolves dark without hiding labels, submit action, or help text.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm exec playwright test tests/e2e/admin-account-staff.spec.ts tests/e2e/admin-layout.spec.ts`

Expected: FAIL on the new theme and presentation assertions.

- [ ] **Step 3: Migrate staff and jobs**

Render staff as an unframed Ghost directory and failed jobs with `GhostTable`. Keep create/edit dialogs and destructive confirmation behavior. Make retry, edit, filter, and row-menu actions Ghost; preserve busy dimensions and feedback text.

- [ ] **Step 4: Complete login theme parity**

Keep the approved light login composition unchanged in structure. Replace fixed colors with theme tokens and define a complete dark version using the deep black-purple/wine palette, including form fields, password visibility action, feedback, security note, and focus states.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @spark/admin test`

Run: `pnpm --filter @spark/admin typecheck`

Run: `pnpm exec playwright test tests/e2e/admin-account-staff.spec.ts tests/e2e/admin-layout.spec.ts`

Expected: all exit 0.

```bash
git add apps/admin/src/features/staff/staff-page.tsx apps/admin/src/features/jobs/jobs-page.tsx apps/admin/src/features/auth/login-page.tsx apps/admin/src/styles.css tests/e2e/admin-account-staff.spec.ts tests/e2e/admin-layout.spec.ts
git commit -m "Complete admin theme migration"
```

### Task 7: Design contract, static audit, and full verification

**Files:**
- Modify: `DESIGN.md`

**Interfaces:**
- Documents: final tokens, dual-zone layout, Ghost-first ownership, theme behavior, responsive rules, and verified commands.

- [ ] **Step 1: Reconcile `DESIGN.md` with the implementation**

Replace the alpha single-light-theme description with the exact light/dark tokens, theme preference behavior, 300px context zone, compact button hierarchy, Ghost table contract, mobile drawer behavior, and shared component ownership implemented in Tasks 1–6.

- [ ] **Step 2: Format all changed admin and documentation files**

Run: `pnpm exec prettier --write apps/admin/src tests/e2e/admin*.spec.ts DESIGN.md docs/superpowers/specs/2026-09-10-admin-dual-theme-redesign.md docs/superpowers/plans/2026-09-10-admin-dual-theme-redesign.md`

Expected: exit 0.

- [ ] **Step 3: Run the premium static audit**

Run: `python C:/Users/lengjing/.codex/plugins/cache/openai-curated-remote/frontend-design-premium/1.4.0/skills/frontend-design-premium/scripts/audit_project.py C:/Users/lengjing/workspace/code/github/spark --mode strict`

Expected: JSON result with no blocking findings. Inspect every reported match and fix real violations.

- [ ] **Step 4: Search for prohibited UI patterns**

Run: `rg -n "alert\(|confirm\(|prompt\(|variant=\"classic\"|<Card" apps/admin/src`

Expected: no native dialog calls; remaining Classic Cards are limited to deliberately bounded non-dataset surfaces documented in `DESIGN.md`; no dataset table remains inside a Card.

- [ ] **Step 5: Run the complete repository validation**

Run: `pnpm --filter @spark/admin lint`

Run: `pnpm --filter @spark/admin typecheck`

Run: `pnpm --filter @spark/admin test`

Run: `pnpm --filter @spark/admin build`

Run: `pnpm exec playwright test tests/e2e/admin.spec.ts tests/e2e/admin-layout.spec.ts tests/e2e/admin-account-staff.spec.ts`

Expected: every command exits 0.

- [ ] **Step 6: Perform browser visual verification**

Check login, activity list, editor, one Ghost dataset page, staff, jobs, open Select, open Dialog, loading, empty, no-results, and failure states in both themes at desktop width and 390px. Verify keyboard focus, theme persistence, no layout jump, internal table scrolling, and reduced motion.

- [ ] **Step 7: Commit the reconciled contract**

```bash
git add DESIGN.md
git commit -m "Document admin design system"
```

- [ ] **Step 8: Review the final diff**

Run: `git status --short`

Run: `git diff --stat HEAD~7..HEAD -- apps/admin tests/e2e DESIGN.md docs/superpowers`

Expected: only admin redesign, its tests, and design documentation appear; unrelated pre-existing changes remain unstaged.

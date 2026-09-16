# Responsive Pages and H5 Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public activity navigation open safely in a new tab, make the
lottery and staff mobile surfaces fill common phone viewports, and replace the
failing WeChat scanner with an in-page ZXing camera scanner.

**Architecture:** Keep admin navigation, activity layout, and staff scanning as
separate tested units. The staff scanner is a focused adapter around
`@zxing/browser` with deterministic cleanup and error mapping; `ScanPage` owns
UI state and navigation, while existing redemption APIs remain unchanged. Shared
mobile shells own width and viewport behavior instead of individual pages
duplicating constraints.

**Tech Stack:** TypeScript 6, React 19, Vite 8, Tailwind CSS 4, Radix UI, Vitest
5, Playwright, NestJS 12, `@zxing/browser` 0.2.1.

**Spec:**
`docs/superpowers/specs/2026-09-16-responsive-pages-and-h5-scanner-design.md`

## Global Constraints

- Production camera access requires HTTPS and explicit browser permission.
- `@zxing/browser` is the primary decoder; native `BarcodeDetector` is not a
  required path.
- Camera frames remain local and are never uploaded or persisted.
- Only the first valid scan may navigate; all later decoder callbacks are
  ignored.
- Camera controls and media tracks stop on success, retry, visibility loss, and
  unmount.
- Manual redemption-code entry remains available in every scanner failure state.
- Activity lottery behavior, prize authority, redemption validation, OAuth, and
  subscription checks remain unchanged.
- Preserve the unrelated working-tree change to
  `apps/activity/src/assets/slices/lottery/bg.jpg`.

---

### Task 1: Make Activity Paths Safe New-Tab Links

**Files:**

- Create: `apps/admin/src/features/activities/activity-link.test.tsx`
- Create: `apps/admin/src/features/activities/activity-link.tsx`
- Modify: `apps/admin/src/features/activities/list-page.tsx`

**Interfaces:**

- Produces: `ActivityPublicLink({ code }: { code: string }): JSX.Element`
- Renders: encoded `/activity/{code}` href, `target="_blank"`,
  `rel="noopener noreferrer"`, external-link icon, and visible path text.

- [ ] **Step 1: Write the failing component test**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActivityPublicLink } from './activity-link';

describe('ActivityPublicLink', () => {
  it('opens the encoded public activity path in a safe new tab', () => {
    const markup = renderToStaticMarkup(
      <ActivityPublicLink code="expo / 2026" />,
    );
    expect(markup).toContain('href="/activity/expo%20%2F%202026"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('/activity/expo / 2026');
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run:
`pnpm --filter @spark/admin test -- src/features/activities/activity-link.test.tsx`

Expected: FAIL because `./activity-link` does not exist.

- [ ] **Step 3: Implement the link component and replace the list cell text**

Use `ExternalLinkIcon` from `@radix-ui/react-icons`, a semantic `<a>`, and the
existing `activity-path` class. Add a business-named `activity-public-link`
class in `apps/admin/src/styles.css` only if the current link tokens cannot
express hover/focus without duplication.

```tsx
export function ActivityPublicLink({ code }: { code: string }) {
  const href = `/activity/${encodeURIComponent(code)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="activity-public-link"
      title={`/activity/${code}`}
    >
      <span className="activity-path">/activity/{code}</span>
      <ExternalLinkIcon aria-hidden="true" />
    </a>
  );
}
```

- [ ] **Step 4: Run admin test, typecheck, and lint**

Run:

```text
pnpm --filter @spark/admin test -- src/features/activities/activity-link.test.tsx
pnpm --filter @spark/admin typecheck
pnpm --filter @spark/admin lint
```

Expected: all exit 0.

- [ ] **Step 5: Commit the activity-link unit**

```text
git add apps/admin/src/features/activities/activity-link.tsx apps/admin/src/features/activities/activity-link.test.tsx apps/admin/src/features/activities/list-page.tsx apps/admin/src/styles.css
git commit -m "Open public activity links in new tabs"
```

### Task 2: Make the Lottery Page Viewport-Responsive

**Files:**

- Modify: `apps/activity/src/components/page-shell.tsx`
- Modify: `apps/activity/src/components/page-shell.test.tsx` (create if absent)
- Modify: `apps/activity/src/pages/lottery-page.tsx`
- Modify: `apps/activity/src/pages/lottery-page.test.tsx`
- Modify: `apps/activity/src/styles.css`
- Modify: `apps/activity/DESIGN.md`

**Interfaces:**

- Produces: `PageShell` full dynamic-viewport canvas with a mobile content cap.
- Produces CSS owners: `.lottery-stage`, `.lottery-wheel-region`,
  `.lottery-outcome`, and `.lottery-action`.
- Preserves: six wheel options, motion state classes, result mapping,
  reduced-motion behavior, and current campaign assets.

- [ ] **Step 1: Add failing shell and lottery layout tests**

Assert that `PageShell` no longer contains the fixed `h-[769px] max-w-[375px]`
contract and that lottery markup uses business-named responsive classes rather
than fixed `left-[15px] top-[211px]` and `top-[573px]` coordinates.

```tsx
expect(shellMarkup).toContain('min-h-dvh');
expect(shellMarkup).toContain('max-w-[430px]');
expect(shellMarkup).not.toContain('h-[769px]');
expect(lotteryMarkup).toContain('lottery-wheel-region');
expect(lotteryMarkup).toContain('lottery-action');
```

- [ ] **Step 2: Run the focused tests and verify the fixed-layout assertions
      fail**

Run:
`pnpm --filter @spark/activity test -- src/components/page-shell.test.tsx src/pages/lottery-page.test.tsx`

Expected: FAIL on the old 375 by 769 shell and fixed lottery coordinates.

- [ ] **Step 3: Implement the responsive shell and lottery CSS owners**

The shell fills `min-h-dvh`, uses `w-full max-w-[430px]`, and retains desktop
centering. Implement responsive geometry in CSS:

```css
.lottery-stage {
  min-height: 100dvh;
  overflow: hidden;
}

.lottery-wheel-region {
  position: absolute;
  top: clamp(168px, 27.4dvh, 232px);
  left: 50%;
  width: min(92vw, 396px);
  aspect-ratio: 1;
  transform: translateX(-50%);
}

.lottery-action,
.lottery-outcome {
  position: absolute;
  right: max(24px, env(safe-area-inset-right));
  bottom: calc(72px + env(safe-area-inset-bottom));
  left: max(24px, env(safe-area-inset-left));
}
```

Add a short-height media query that reduces wheel size/top offset and keeps the
bottom action reachable. Do not alter `lottery-wheel--spinning`, `--settling`,
or `--stopping` behavior.

- [ ] **Step 4: Update `apps/activity/DESIGN.md` with the responsive lottery
      contract**

Replace the old artboard implication with: full dynamic viewport, 320–430 pixel
supported mobile widths, clamped wheel geometry, bottom safe-area action, and
unchanged motion authority.

- [ ] **Step 5: Run activity tests, typecheck, lint, and build**

Run:

```text
pnpm --filter @spark/activity test
pnpm --filter @spark/activity typecheck
pnpm --filter @spark/activity lint
pnpm --filter @spark/activity build
```

Expected: all exit 0.

- [ ] **Step 6: Commit the responsive lottery unit without staging the existing
      background-image modification**

Stage only the listed source, test, CSS, and design files. Confirm
`apps/activity/src/assets/slices/lottery/bg.jpg` remains unstaged.

```text
git commit -m "Make lottery page viewport responsive"
```

### Task 3: Establish the Staff 430px Mobile Shell Contract

**Files:**

- Modify: `apps/staff/src/components/page-shell.tsx`
- Create: `apps/staff/src/components/page-shell.test.tsx`
- Modify: `apps/staff/src/components/bottom-tab-bar.tsx`
- Modify: `apps/staff/src/components/select-sheet.tsx`
- Modify: relevant existing component tests under
  `apps/staff/src/components/*.test.tsx`

**Interfaces:**

- Produces: shared `w-full max-w-[430px]` content, navigation, and sheet widths.
- Preserves: desktop centering, bottom safe-area padding, and natural document
  scrolling.

- [ ] **Step 1: Write a failing shell contract test**

Render `PageShell`, `BottomTabBar`, and `SelectSheet`; assert they share
`max-w-[430px]` and that the page owns `min-h-dvh` without a fixed height.

- [ ] **Step 2: Run the staff component tests and verify they fail on
      `max-w-[375px]`**

Run:
`pnpm --filter @spark/staff test -- src/components/page-shell.test.tsx src/components/select-sheet.test.tsx`

- [ ] **Step 3: Apply the shared width and viewport contract**

Change the three canonical owners from 375 to 430 pixels. Keep fixed bottom
navigation centered and exactly aligned with the shell. Do not add page-local
copies of the width value.

- [ ] **Step 4: Run staff tests, typecheck, and lint**

Run:

```text
pnpm --filter @spark/staff test
pnpm --filter @spark/staff typecheck
pnpm --filter @spark/staff lint
```

- [ ] **Step 5: Commit the staff shell unit**

```text
git add apps/staff/src/components
git commit -m "Expand staff mobile layouts to full phone width"
```

### Task 4: Add the ZXing Scanner Adapter

**Files:**

- Modify: `apps/staff/package.json`
- Modify: `pnpm-lock.yaml`
- Replace: `apps/staff/src/lib/wechat-scan.ts` with
  `apps/staff/src/lib/qr-scanner.ts`
- Replace: `apps/staff/src/lib/wechat-scan.test.ts` with
  `apps/staff/src/lib/qr-scanner.test.ts`

**Interfaces:**

- Produces: `extractRedemptionCode(raw: string): string`.
- Produces:
  `startQrScanner(video: HTMLVideoElement, onResult: (code: string) => void, dependencies?: ScannerDependencies): Promise<QrScannerSession>`.
- Produces: `QrScannerSession.stop(): void` and
  `ScannerFailure = 'UNSUPPORTED' | 'PERMISSION_DENIED' | 'NO_CAMERA' | 'CAMERA_BUSY' | 'SCAN_FAILED'`.
- `ScannerDependencies` wraps reader creation for real-behavior unit tests
  without loading a camera.

- [ ] **Step 1: Add `@zxing/browser` 0.2.1**

Run: `pnpm --filter @spark/staff add @zxing/browser@0.2.1 --save-exact`

Expected: staff package and lockfile change only.

- [ ] **Step 2: Write failing scanner-adapter tests**

Test with a specific fake reader boundary:

- a URL result extracts and uppercases `code`;
- the first decoder result invokes `onResult` once and stops controls/tracks;
- later results are ignored;
- `NotAllowedError`, `NotFoundError`, and `NotReadableError` map to the declared
  failures;
- calling `session.stop()` twice is safe and stops every track once.

- [ ] **Step 3: Run the scanner test and verify the new module is missing**

Run: `pnpm --filter @spark/staff test -- src/lib/qr-scanner.test.ts`

Expected: FAIL because `qr-scanner.ts` does not exist.

- [ ] **Step 4: Implement the minimal ZXing adapter**

Use a dynamic import so the ZXing chunk loads only on the scanner path:

```ts
const { BrowserQRCodeReader } = await import('@zxing/browser');
const reader = new BrowserQRCodeReader();
const controls = await reader.decodeFromConstraints(
  { video: { facingMode: { ideal: 'environment' } }, audio: false },
  video,
  (result) => {
    if (!result || handled) return;
    handled = true;
    onResult(extractRedemptionCode(result.getText()));
    stop();
  },
);
```

The returned session owns controls and all tracks found on `video.srcObject`.
Normalize browser errors in one pure function. Never log the scanned code.

- [ ] **Step 5: Run focused and full staff tests**

Run:

```text
pnpm --filter @spark/staff test -- src/lib/qr-scanner.test.ts
pnpm --filter @spark/staff test
pnpm --filter @spark/staff typecheck
```

- [ ] **Step 6: Commit the scanner adapter**

```text
git add apps/staff/package.json pnpm-lock.yaml apps/staff/src/lib/qr-scanner.ts apps/staff/src/lib/qr-scanner.test.ts apps/staff/src/lib/wechat-scan.ts apps/staff/src/lib/wechat-scan.test.ts
git commit -m "Add H5 QR scanner adapter"
```

### Task 5: Build the Full-Viewport Staff Scan Page

**Files:**

- Modify: `apps/staff/src/pages/scan-page.tsx`
- Create: `apps/staff/src/pages/scan-page.test.tsx`
- Modify: `apps/staff/src/components/scan-frame.tsx`
- Modify: `apps/staff/src/styles.css`

**Interfaces:**

- Consumes: `startQrScanner`, `QrScannerSession`, `ScannerFailure`, and
  `extractRedemptionCode` from Task 4.
- Produces: full-viewport scan UI with one video element, stable
  overlay/actions, retry, back, and manual-entry navigation.

- [ ] **Step 1: Write failing scan-page state tests**

Mock only the Task 4 scanner boundary. Test observable page behavior:

- initial markup contains a muted, `playsInline` video and starting status;
- one scan result calls `setCode` once and navigates once;
- permission rejection shows camera-permission guidance plus retry and manual
  entry;
- retry stops the previous session before starting another;
- unmount and `visibilitychange` stop the active session.

- [ ] **Step 2: Run the focused test and verify the old WeChat behavior fails**

Run: `pnpm --filter @spark/staff test -- src/pages/scan-page.test.tsx`

Expected: FAIL because the current page checks `MicroMessenger`, has no video
preview, and calls the WeChat SDK.

- [ ] **Step 3: Implement the scan-page state machine and full-viewport layout**

Use explicit states `starting | scanning | error | paused`. Start once on mount,
guard result handling with a ref, stop before navigation, and stop on cleanup.
Map `ScannerFailure` to concise Chinese messages with recovery instructions.
Keep the manual-entry button visible in every state.

Use CSS business owners rather than page-local fixed pixels:

```css
.staff-scanner {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  background: var(--color-scan);
}

.staff-scanner-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

Place back/status at the top safe area and manual/retry controls above the
bottom safe area. Preserve native button semantics and visible focus.

- [ ] **Step 4: Run staff test, typecheck, lint, and build**

Run:

```text
pnpm --filter @spark/staff test
pnpm --filter @spark/staff typecheck
pnpm --filter @spark/staff lint
pnpm --filter @spark/staff build
```

- [ ] **Step 5: Commit the scan-page unit**

```text
git add apps/staff/src/pages/scan-page.tsx apps/staff/src/pages/scan-page.test.tsx apps/staff/src/components/scan-frame.tsx apps/staff/src/styles.css
git commit -m "Replace WeChat scanning with H5 camera scanning"
```

### Task 6: Remove the Obsolete WeChat JS-SDK Signing Path

**Files:**

- Modify: `apps/staff/src/lib/api.ts`
- Modify: `apps/api/src/app.module.ts`
- Delete: `apps/api/src/wechat/js-sdk.controller.ts`
- Delete: `apps/api/src/wechat/js-sdk.service.ts`
- Delete: `apps/api/src/wechat/js-sdk.service.test.ts`
- Modify: `apps/api/src/wechat/wechat.gateway.ts`
- Modify: applicable gateway tests if the removed ticket method is asserted

**Interfaces:**

- Removes: `staffApi.wechatJsSdkConfig` and `/api/staff/wechat/js-sdk-config`.
- Preserves: OAuth, WeChat identity, subscription, access-token, and
  activity-side behavior.

- [ ] **Step 1: Add a failing source-boundary regression test**

Extend an existing API module/provider test or add a narrow app-module test
asserting that staff routes do not register `WechatJsSdkController` and
providers do not include `WechatJsSdkService`. Confirm this test fails while the
old path exists.

- [ ] **Step 2: Remove the staff client method, controller, service, provider,
      and unused ticket gateway method**

Delete only symbols whose repository-wide reference count becomes zero. Do not
remove `WechatTokenService` or `WechatGateway`, which are still required for
OAuth and subscription behavior.

- [ ] **Step 3: Verify no staff JS-SDK references remain**

Run:

```text
rg -n "WechatJsSdk|wechatJsSdkConfig|js-sdk-config|scanQRCode|jweixin" apps packages tests
```

Expected: no matches related to the removed staff scanner path.

- [ ] **Step 4: Run API and staff verification**

Run:

```text
pnpm --filter @spark/api test
pnpm --filter @spark/api typecheck
pnpm --filter @spark/api lint
pnpm --filter @spark/staff test
pnpm --filter @spark/staff typecheck
```

- [ ] **Step 5: Commit the obsolete-integration removal**

```text
git add apps/staff/src/lib/api.ts apps/api/src/app.module.ts apps/api/src/wechat
git commit -m "Remove obsolete staff WeChat scanner API"
```

### Task 7: Add Browser Coverage and Complete Verification

**Files:**

- Modify: `tests/e2e/admin.spec.ts`
- Create or Modify: staff browser spec under `tests/e2e/`
- Modify: `playwright.config.ts` only if the existing local browser setup cannot
  serve staff without affecting GitHub CI
- Modify: `apps/activity/DESIGN.md` and relevant staff design documentation if
  implementation details differ from the approved contract

**Interfaces:**

- Verifies all user-observable behavior from Tasks 1–6.
- Does not re-add an E2E job to `.github/workflows/ci.yml`.

- [ ] **Step 1: Add browser assertions for the admin link and responsive
      layouts**

Cover:

- link has `_blank`, safe `rel`, and correct public URL;
- lottery page at 320×667 and 430×932 has no horizontal overflow, visible wheel,
  and reachable action;
- staff shell and bottom navigation align at 390 and 430 pixel widths.

- [ ] **Step 2: Add scanner browser coverage with an injected scanner boundary**

Because CI/local desktop browsers cannot supply a real phone camera
deterministically, expose a test-only dependency seam through module mocking or
an application test harness. Assert one simulated result navigates once and
permission failure preserves retry/manual entry. Do not add production query
parameters that bypass camera permissions.

- [ ] **Step 3: Run relevant browser tests locally**

Run the existing admin/activity configs and the staff config introduced or
reused by the repository. Expected: all selected tests pass; project-configured
skips remain documented.

- [ ] **Step 4: Run frontend premium static audit and anti-pattern scan**

Run:

```text
python C:/Users/lengjing/.codex/plugins/cache/openai-curated-remote/frontend-design-premium/1.4.0/skills/frontend-design-premium/scripts/audit_project.py C:/Users/lengjing/workspace/code/github/spark --mode strict --no-write
```

Inspect the changed files for native dialogs, non-semantic click targets,
actionless buttons, hidden scrollbars, and duplicated shell/scanner constants.
Fix changed-file findings; report unrelated pre-existing findings separately.

- [ ] **Step 5: Run complete repository verification**

Run: `pnpm verify`

Expected: lint, typecheck, unit tests, builds, and API integration tests all
pass. Also run `git diff --check`.

- [ ] **Step 6: Perform real-device acceptance checks**

On one current iOS device and one current Android device over HTTPS:

- grant camera permission and scan a real redemption QR;
- deny permission, retry after enabling it, and use manual entry;
- leave the page and confirm the camera indicator turns off;
- verify short/tall viewport layout and safe-area actions.

If physical devices are unavailable, record this as the only remaining release
risk; do not claim real-device camera verification.

- [ ] **Step 7: Commit browser evidence and final documentation**

```text
git add tests/e2e playwright.config.ts apps/activity/DESIGN.md docs
git commit -m "Verify responsive pages and H5 scanning"
```

Do not stage `apps/activity/src/assets/slices/lottery/bg.jpg` unless the user
explicitly confirms that image change belongs to this feature.

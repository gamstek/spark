# Task 2 Report — Viewport-Responsive Lottery

## Delivered

- Kept fixed-coordinate illustrated pages on the shared 375px stage, while the
  lottery explicitly opts into the full dynamic-viewport canvas capped at 430px.
- Moved lottery layout geometry into CSS owners: `.lottery-stage`,
  `.lottery-wheel-region`, `.lottery-outcome`, and `.lottery-action`.
- Anchored wheel placement with a clamped dynamic-viewport offset and square
  responsive width; short viewports reduce its size and top offset.
- Anchored both the draw action and result panel above the bottom safe area.
- Preserved all six wheel options, draw/result mapping, motion-state classes,
  reduced-motion behavior, and supplied campaign assets.
- Updated the Activity design contract for 320–430px mobile widths, the 430px
  cap, clamped wheel geometry, and bottom safe-area actions.
- Centered capped draw and result buttons inside their safe-area regions.

## Test-Driven Evidence

Added focused shell and lottery markup regressions first. The initial focused
run failed as expected against the previous `h-[769px]`, `max-w-[375px]`, and
fixed lottery coordinate implementation. The same focused run passed after the
responsive implementation.

Review regressions added a failing default-shell test for the fixed-coordinate
stage before restoring it as the default and making the lottery's wider stage an
explicit opt-in. Browser geometry tests cover the visible, non-overlapping wheel
and centered reachable draw action at 320×667, 375×667, 390×844, and 430×932;
they also cover the centered result action at 430px and fixed-coordinate
subscribe artwork at 390px and 430px.

## Verification

All commands completed with exit code 0:

- `pnpm --filter @spark/activity test` — 21 files, 65 tests passed.
- `pnpm --filter @spark/activity typecheck`
- `pnpm --filter @spark/activity lint`
- `pnpm --filter @spark/activity build`
- `git diff --check`
- `pnpm exec playwright test --config=playwright.activity.config.ts tests/e2e/activity-layout.spec.ts --project=anonymous-browser` — 7 tests passed.

The build emitted Vite's existing large-chunk advisory for the main bundle; it
did not fail the build and is outside this layout-only task.

## Protected Change

`apps/activity/src/assets/slices/lottery/bg.jpg` was already modified before
this task. It was not edited or staged.

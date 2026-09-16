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

## Final Integrated Review Follow-up

The standard shell now uses a dedicated `.page-shell-artboard` minimum of the
dynamic viewport or 769px, preserving the scrollable fixed-coordinate stage for
Subscribe and Submit Success on short phones. Lottery retains the viewport-only
wide shell. Its wheel has separate short and intermediate-height geometry so the
bottom-anchored result panel remains clear at 375×568 and 430×740.

Added browser regressions verify the subscription verification action and the
submission-success action are reachable at 375×667, plus result-panel clearance
at both reported heights. The focused activity browser suite passed 21 tests.

## Breakpoint-edge Follow-up

Lottery wheel geometry now caps its square size using dynamic viewport height
after reserving the complete safe-area-aware outcome region. Short screens use
their smaller action reserve; taller screens reserve the full result footprint.
This removes the discrete 700px/800px wheel-size transitions that could overlap
the outcome immediately above a breakpoint.

Result-state browser coverage now includes 430px widths at 699px, 700px, 701px,
799px, 800px, and 801px heights, in addition to the existing short, intermediate,
and tall viewports. The expanded lottery layout matrix passed 16 tests.

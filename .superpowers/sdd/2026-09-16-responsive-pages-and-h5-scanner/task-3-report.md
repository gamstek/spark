# Task 3 Report: Staff 430px Mobile Shell Contract

Implemented the shared 430px maximum width for `PageShell`, `BottomTabBar`, and
`SelectSheet`. `PageShell` now owns a `min-h-dvh` minimum viewport height while
retaining content-driven growth, and the bottom navigation retains its fixed
centering and safe-area padding.

Added component contract tests that render each owner separately and verify
the shared width, dynamic viewport minimum height, fixed navigation centering
and safe-area padding, and sheet centering. The original width test failed
before the implementation because all three owners had a 375px maximum width.

Centered the redemption success page's existing 375px fixed-coordinate artwork
inside the wider shell. Added browser viewport checks at 390px and 430px for
the redemption card, fixed navigation, and selection sheet. The rendering
regression failed before the centering wrapper was added.

Verification passed:

- `pnpm --filter @spark/staff test` — 10 files, 15 tests passed.
- `pnpm --filter @spark/staff typecheck`
- `pnpm --filter @spark/staff lint`
- `pnpm exec playwright test --config=playwright.staff.config.ts` — 4 viewport
  tests passed at 390px and 430px.
- `pnpm exec eslint playwright.staff.config.ts tests/e2e/staff-shell-layout.spec.ts`

The preexisting modification to
`apps/activity/src/assets/slices/lottery/bg.jpg` was preserved and excluded.

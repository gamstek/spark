# Task 1 Report: Shared Lifecycle Domain Model

## Result

Implemented and committed the shared lifecycle contract model.

## Changes

- Added `ActivityStatusSchema`, its inferred `ActivityStatus` type, `ActivityStatusSource`, and the pure `deriveActivityStatus(source, now)` calculator.
- Added table-driven lifecycle coverage for draft, upcoming, running, paused, draw-ended, ended, and status precedence at draw end.
- Exported the four lifecycle symbols from the contracts barrel.

The pre-existing dirty `packages/contracts/src/activities.ts` also exports an older `ActivityStatusSchema` with different values. The barrel now explicitly exports the other symbols from `activities.ts` to avoid the duplicate name and lets the new lifecycle schema own the barrel's `ActivityStatusSchema`. No other dirty changes were staged or committed.

## Verification

- RED observed: `pnpm --filter @spark/contracts exec vitest run src/activity-status.test.ts` failed because `./activity-status` did not exist.
- GREEN: `pnpm --filter @spark/contracts test` passed (4 test files, 38 tests).
- Typecheck: `pnpm --filter @spark/contracts typecheck` passed.

## Commit

`Add shared activity lifecycle model`

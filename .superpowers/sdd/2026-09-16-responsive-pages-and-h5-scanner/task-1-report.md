# Task 1 implementation report: Safe public activity links

## Result

Replaced the plain activity path in the admin activity list with a semantic
public link. The link opens `/activity/{code}` in a new tab, percent-encodes the
activity code in its URL, and uses `noopener noreferrer`. It retains the
human-readable path and includes an external-link icon. The named
`activity-public-link` style supplies hover and visible keyboard-focus states
using the admin theme colors.

## Files changed

- `apps/admin/src/features/activities/activity-link.test.tsx` — component
  regression test for encoded href, new-tab safety attributes, and visible path.
- `apps/admin/src/features/activities/activity-link.tsx` — reusable link
  component.
- `apps/admin/src/features/activities/list-page.tsx` — replaced the plain-text
  activity path cell with `ActivityPublicLink`.
- `apps/admin/src/styles.css` — link layout, hover, focus-visible, and icon
  sizing.

## TDD and verification

The focused test was first run before the implementation and failed because
`./activity-link` did not exist, as expected. After the component and list
integration were implemented, the focused test passed.

- `pnpm --filter @spark/admin test -- src/features/activities/activity-link.test.tsx` — passed (1 test).
- `pnpm --filter @spark/admin typecheck` — passed.
- `pnpm --filter @spark/admin lint` — passed.
- Prettier was run on all changed source and style files.

## Scope and repository state

The pre-existing change to `apps/activity/src/assets/slices/lottery/bg.jpg`
was preserved and was not staged. Only Task 1 files were included in the
implementation commit.

# Activity State and Dialog Actions Design

## Context

Spark currently derives activity lifecycle state in several places. API services
independently compare timestamps, while the admin list, editor, and workspace
context also use the browser clock. This duplication has already produced a
visible contradiction where an activity appeared active in the list but ended in
its detail/runtime view. Dialog action rows are likewise repeated as local Radix
`Flex` markup, allowing spacing and alignment to drift between dialogs.

This change covers unpublished and currently operated activities. It does not
change historical published-version data, concurrent draw-rule editing, upload
atomicity, API rate limiting, or phone/email format validation.

## Goals

- Make the API the authoritative source of lifecycle state.
- Apply one state precedence at list, detail, runtime, draw, pause, resume, and
  end-draw boundaries.
- Make boundary-time tests deterministic through an injectable clock.
- Prevent client clock skew from changing the state shown by the admin UI.
- Give all admin confirmation dialogs one durable action-row layout.

## Non-goals

- No database migration or persisted status column.
- No background job that rewrites activity status at a deadline.
- No redesign of activity versioning or publication history.
- No change to permissions, draw-rule semantics, or redemption status values.
- No wholesale visual redesign of dialogs.

## Lifecycle Model

The lifecycle state is derived, not stored. A shared API domain function accepts
the activity's publication marker, schedule, pause timestamp, and an explicit
`now` value. It returns one stable wire value:

| Wire value   | Chinese label | Condition                                   |
| ------------ | ------------- | ------------------------------------------- |
| `DRAFT`      | 草稿          | No published version exists                 |
| `UPCOMING`   | 未开始        | Published and `now < startsAt`              |
| `RUNNING`    | 进行中        | Draw is open and the activity is not paused |
| `PAUSED`     | 已暂停        | Draw is open and `pausedAt` exists          |
| `DRAW_ENDED` | 抽奖已结束    | `now >= drawEndsAt`, but `now < endsAt`     |
| `ENDED`      | 活动已结束    | `now >= endsAt`                             |

Precedence is fixed: `DRAFT`, `ENDED`, `DRAW_ENDED`, `UPCOMING`, `PAUSED`, then
`RUNNING`. Consequently a pause marker cannot keep an activity paused after a
deadline. Equality belongs to the later state: start equality is running, draw
end equality is draw-ended, and activity end equality is ended.

The function is pure and has table-driven unit tests for every boundary and
precedence combination. API services receive a shared injectable clock provider
so a request uses a controlled server time. Database `now()` remains acceptable
for audit timestamps; lifecycle decisions use the injected request/service
clock.

## API Contract

Admin activity list and detail responses add:

- `status`: the authoritative lifecycle wire value.
- `serverNow`: the ISO timestamp used to calculate that response's state.

Both fields are added to shared Zod contracts. They are additive during the
migration: the admin uses the server `status` when present and temporarily falls
back to the existing client helper for compatibility with mocked or older
responses. After all in-repository producers and fixtures include `status`, the
fallback is removed.

Runtime keeps its existing scene contract but delegates state selection to the
same domain function. Draw, pause/resume, and end-draw services use the same
precedence and clock. Action-specific errors remain stable, including
`ACTIVITY_PAUSED`, `ACTIVITY_NOT_RUNNING`, and `DRAW_ENDED`; the shared state is
translated into the error expected by each public endpoint rather than exposing
new accidental error codes.

## Admin Data Flow

The activities list, editor status panel, navigation context, and status filter
render the API-provided wire value through one presentation mapping. Chinese
labels and badge colors live in one admin owner. UI eligibility for pause,
resume, and end-draw is derived from the same server status, not separate date
comparisons.

`serverNow` is diagnostic context and a future refresh anchor; this iteration
does not run a client-side countdown or mutate status locally. A status changes
when the relevant query is refreshed after navigation or mutation. Successful
pause, resume, publish, or end-draw actions refresh detail and shared activity
context so all visible surfaces converge immediately.

## Dialog Action Component

Add an admin-only `DialogActions` layout primitive. It owns only geometry:

- horizontal layout, right alignment, center alignment, and canonical gap;
- safe wrapping on narrow viewports;
- consistent top spacing;
- stable order: secondary/cancel first, primary or destructive confirmation
  second.

It does not own Radix `Dialog.Close`, `AlertDialog.Cancel`, or
`AlertDialog.Action`, because those wrappers carry focus and dismissal
semantics. Callers place those semantic wrappers and buttons inside the shared
layout. The component accepts standard container props only where an existing
dialog has a documented spacing exception; arbitrary screen-local alignment is
not exposed.

The first migration covers every admin `Dialog` and `AlertDialog` action row,
including pause/resume, end draw, stock addition, staff editing, staff status,
and participant detail. Existing button intent, labels, pending guards, focus
behavior, and confirmation strength remain unchanged.

## Error Handling and Compatibility

- Missing or invalid schedule data never becomes `RUNNING`; contract parsing
  rejects malformed API data and existing error handling remains visible.
- A mutation that succeeds but whose refresh fails reports the existing refresh
  failure rather than guessing a new status.
- The compatibility fallback is limited to admin response parsing and is removed
  once tests prove every API producer and fixture sends the new fields.
- State derivation remains synchronous and cannot fail independently of its
  input validation.

## Testing Strategy

Implementation follows red-green-refactor:

1. Pure lifecycle tests cover all states, exact boundaries, pause precedence,
   and missing publication.
2. API integration tests prove list/detail return identical `status` and
   `serverNow` for the same clock, including paused activities after deadlines.
3. Runtime, draw, pause/resume, and end-draw regression tests prove they agree
   with the domain state.
4. Admin unit tests prove presentation mapping and action eligibility consume
   the server value.
5. Component tests assert `DialogActions` structure and narrow wrapping.
6. Playwright tests cover list/detail consistency, pause/resume refresh, dialog
   focus restoration, desktop alignment, and a narrow viewport.

Final verification runs formatter, lint, typecheck, unit tests, production
build, API integration tests, CI workflow tests, the complete Playwright suite,
and `git diff --check`. The premium UI audit is run and heuristic findings are
reported honestly.

## Rollout and Removal

This is an in-repository additive contract migration with no database rollout.
The implementation order is domain calculator, contracts/API responses, service
consumers, admin consumers, then dialog migration. The temporary admin fallback
is deleted in the same change once all fixtures are migrated. Rollback is
code-only: revert consumers and remove the additive response fields; stored
activity data is unaffected.

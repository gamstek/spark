# Spark Admin UX Contract

## Product context and sources

Audience: authorized exhibition activity operators in a Chinese WeChat marketing
workflow. UI is zh-CN; dates display Asia/Shanghai; server timestamps remain
unchanged. Scope is the admin application only. Accessibility target: WCAG 2.2
AA.

Authoritative business source:
`docs/superpowers/specs/2026-09-07-project-spark-architecture-design.md`.
Runtime permissions and sessions: `apps/api/src/auth`; lifecycle:
`apps/api/src/activities`; inventory and retention remain API-owned. Reviewed
2026-09-08. This file records UI consequences, not replacement business policy.

## Visual contract and canonical UI map

`DESIGN.md` mirrors `apps/admin/src/styles.css` (runtime canonical). `app.tsx`
is the Radix theme adapter owner. Supported theme is light. Shared changes must
be checked across every admin route.

| Capability          | Canonical owner                           | Contract                                                                  |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| Navigation          | components/app-shell.tsx                  | Desktop sidebar; Radix Dialog drawer below 900px; Escape and focus return |
| Route tabs          | components/activity-nav.tsx               | Real links, selected route, scrollable overflow                           |
| Header              | components/page-header.tsx                | One h1, supporting description, primary action group                      |
| Select              | Radix Themes Select                       | Accessible trigger, portal popup, keyboard and selected states            |
| Dates               | Existing datetime-local fields            | Platform-owned picker; existing Shanghai conversion preserved             |
| Forms               | Existing feature forms + shared CSS       | Keep form values on rejected writes; inline feedback; busy guards         |
| Feedback            | EmptyState, LoadingState, FeedbackCallout | Loading/error/empty are distinct; no invented successful data             |
| Tables              | Radix Table + table-panel                 | Readable names, container scrolling on narrow screens                     |
| Scrollbars          | styles.css                                | Standard and WebKit tokens with forced-color fallback                     |
| Destructive actions | Radix AlertDialog                         | Confirmation before ending draws/disabling accounts                       |

## Dataset navigation

Activities are returned as a complete array by the existing endpoint. Name/code
search and status filtering run locally. `q` and `status` are stored in URL
parameters, allowing reload/share; edits replace current history. No fake
pagination or server total is presented. Clear search affects only query and
returns focus to the search input; clear filters resets both. Unknown statuses
fall back to all. Empty dataset and no matches use distinct messages. This does
not change other endpoints' dataset contracts.

## Flow ledger

| Operation                     | Pending and success                                                                                                | Failure and focus                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Sign in                       | Disable duplicate submit; navigate after login and CSRF retrieval                                                  | Retain fields, announce error, focus missing required field; do not reload on rejected credentials |
| Create/edit activity          | Existing draft save and publish flow retained                                                                      | Preserve existing revision conflict and live-activity lock handling                                |
| Add inventory                 | Existing stock mutation ID and confirmation retained                                                               | Existing uncertain-result retry behavior retained                                                  |
| End draw / disable staff      | Confirm with Radix AlertDialog before request                                                                      | Existing inline result and cancellation behavior retained                                          |
| Export                        | Existing generation action and actual task status retained                                                         | No fabricated progress percentage or download availability                                         |
| Search                        | Immediate local filtering; no request per keystroke                                                                | Clear restores dataset; count reflects matching records                                            |
| Mobile navigation             | Link closes drawer and changes route                                                                               | Escape closes without navigation; trigger receives focus                                           |
| View participant registration | TableRowActions opens the read-only ParticipantDetailDialog using the already-loaded answers; no fetch or mutation | Escape/关闭 restores the row menu trigger; all 13 answers scroll inside the bounded Radix dialog   |

Participant data comes only from the ADMIN-session-protected participant query
(`apps/api/src/participants/participants-admin.controller.ts`), bounded to the
latest 500 rows.
Show 姓名、单位、手机号码、线索状态、渠道、奖品、核销状态、参与时间 and an
operation column. Missing submissions show 未填写 and 暂无登记详情; incomplete
lead state says 待填写. Shared `@spark/contracts` definitions and formatter own
the question order, Chinese option labels and optional-answer 未填写 text. The
dialog uses the current Admin theme, accessible title/description, focus
containment and a persistent close action outside its scrolling answer list.
Loading, failed reads with 重试, and an empty dataset remain distinct; stale or
aborted activity reads cannot replace the current activity's rows.

## Form and interaction policy

New login controls use explicit labels, noValidate, app validation, a masked
password toggle, pending guard and live error region. Do not expose raw server
errors; origin configuration and unavailable network are distinct from
credential rejection. No signup/reset endpoint is invented. Other business forms
retain their existing validation, draft and upload behavior. Changes to
unsaved-navigation policy or role capabilities require their own behavior design
and regression coverage.

## Responsive behavior

900px drawer; 600px stacked headers and fields. The 224px desktop sidebar
accompanies a 64px topbar, translucent white cards and semantic metric icons.
Main content uses a skip target. Tables scroll internally; editor actions are
sticky on desktop and stay in document flow on mobile. Login has two desktop
columns, stacking its brand header and form on mobile. Error text wraps without
overlapping controls. Actual business data is never seeded merely to decorate
screenshots; browser tests use isolated route fixtures.

## Verification and limits

The account entry exists only in the top-right Radix DropdownMenu. Logout calls
the existing CSRF-protected endpoint and navigates to login after success;
failure is shown inline. Staff creation uses a controlled Radix Dialog:
cancel/Escape closes when idle, outside clicks do not discard inputs, pending
creation blocks closing and duplicate submission, failure retains values in the
dialog, success closes and refreshes the list. The main create trigger receives
restored focus.

Run admin typecheck/lint/build and the admin browser suites after changes.
Inspect desktop/mobile screenshots and keyboard drawer/select flows. Premium
static audit is a heuristic; inspect Radix composition before treating wrapper
warnings as defects. Production deployment smoke tests require a running
configured deployment and are separate from mocked admin UI tests.

Component fidelity: Soft is preferred, not mandatory. Radix Soft gray owns text
fields and selects, solid violet marks primary actions, Soft gray marks
secondary actions, and red Outline/Solid separates dangerous entry from
confirmation. Classic Cards provide native depth. TabNav, tables, dialogs and
feedback retain Radix behavior. Control size props remain authoritative. Never
flatten shadows or replace focus indicators with global CSS. DESIGN.md records
the complete visual mapping and reference direction.

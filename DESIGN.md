---
version: alpha
name: Spark Admin
description:
  A dual-theme operations workspace with a translucent context zone, continuous
  work canvas, compact Ghost actions and unframed datasets.
colors:
  primary: '#7255D7'
  primary-hover: '#644FC1'
  on-primary: '#FFFFFF'
  background: '#FAF9FC'
  workspace: '#FFFFFF'
  surface: '#FFFFFF'
  sidebar: '#E9E6F8'
  context-start: '#DDECFB'
  context-end: '#EBD5E7'
  context-muted: '#59566D'
  context-ambient: '#C9BCE9'
  text: '#292844'
  muted: '#6F6D85'
  border: '#DFDCE7'
  hover: '#EEEBF5'
  tint: '#F1EDFF'
  scrollbar: '#B9B3C5'
  scrollbar-hover: '#8B849C'
  scrollbar-active: '#6F6D85'
  dark-primary: '#D9586D'
  dark-primary-hover: '#E56C7F'
  dark-on-primary: '#1C191D'
  dark-background: '#271F25'
  dark-workspace: '#201D21'
  dark-surface: '#271F25'
  dark-sidebar: '#282226'
  dark-context-start: '#282226'
  dark-context-end: '#3C1D2D'
  dark-context-muted: '#AAA2AA'
  dark-context-ambient: '#7E2440'
  dark-text: '#F4F0F3'
  dark-muted: '#AAA2AA'
  dark-border: '#443A42'
  dark-hover: '#362C34'
  dark-tint: '#442B37'
  dark-scrollbar: '#695762'
  dark-scrollbar-hover: '#927B88'
  dark-scrollbar-active: '#AAA2AA'
typography:
  sans:
    fontFamily: 'Inter, Segoe UI, Microsoft YaHei, PingFang SC, sans-serif'
  mono:
    fontFamily: 'ui-monospace, monospace'
rounded:
  context-panel: '9px'
  brand-mark: '8px'
  login-emblem: '10px'
spacing:
  section-gap: '24px'
  editor-gap: '36px'
  page-padding: '36px'
  page-max: '1400px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
  button-primary-dark:
    backgroundColor: '{colors.dark-primary}'
    textColor: '{colors.dark-on-primary}'
  workspace:
    backgroundColor: '{colors.workspace}'
    textColor: '{colors.text}'
  workspace-dark:
    backgroundColor: '{colors.dark-workspace}'
    textColor: '{colors.dark-text}'
---

# Spark Admin

## Overview

Spark is an operations workspace for authorized Chinese WeChat exhibition
operators. Its approved signature is a colored operational context zone beside a
continuous work canvas. Current activity, actual work needing attention and
compact navigation belong on the left; configuration and unframed datasets
belong on the right. Maintain clear action hierarchy and readable data density.

This contract reconciles the approved 2026-09-10 dual-theme design and
subsequent composition/material corrections in `f2fed02` and `ee3c6c1`. It
supersedes the previous single-light-theme, 224px sidebar and Classic Card
visual descriptions. The `alpha` value identifies the DESIGN.md format, not
application theme support.

### Direction and references

The user supplied Radix references on 2026-09-08, then approved the dual-zone
composition and Ghost hierarchy on 2026-09-10. References:
[Radix homepage](https://www.radix-ui.com/) and
[Playground](https://www.radix-ui.com/themes/playground), interpreted through
the approved Spark compositions. Keep the violet identity in light and the
approved rose accent in dark. Material depth is concentrated in the context
zone. Do not copy marketing masonry, invent operational counts or insert
fictitious account data.

### Product scope

Only `apps/admin`. Business context is maintained in
`docs/superpowers/specs/2026-09-07-project-spark-architecture-design.md`. Use
Chinese labels, `zh-CN` formatting and Asia/Shanghai display times. Preserve API
permissions, authentication, stock idempotency, publication locks, template
versions and export retention. This contract does not change activity/staff
client designs or authorize business-policy changes.

`UX-CONTRACT.md` continues to describe existing workflows and legacy form
validation. Its earlier light-only, 224px sidebar and Classic Card visual prose
is superseded by this approved contract; it is not a second token source.

## Colors

Model B: `apps/admin/src/styles.css` is canonical. Frontmatter mirrors accepted
runtime values, with unprefixed colors for light and `dark-*` for dark.
`--spark-*` variables feed shared layout/component styles; ThemeProvider adapts
Radix appearance using violet/slate, medium radius, 100% scaling and translucent
panel mode. The panel color adapter resolves to the theme's opaque surface for
readable menus/dialogs. Semantic Radix red, amber, teal and blue retain their
business meanings in both themes.

| Document role                                   | Runtime owner/consumer                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| background / workspace / surface                | `--spark-canvas`, `--spark-workspace`, `--spark-surface`; document, workspace gradient, Radix panel adapter               |
| sidebar / context-start / context-end           | `--spark-sidebar-bg`, `--spark-context-start`, `--spark-context-end`; sidebar and drawer                                  |
| text / muted / context-muted                    | `--spark-ink`, `--spark-muted`, `--spark-context-muted`; primary/secondary/context copy                                   |
| primary / primary-hover / on-primary            | `--spark-primary`, `--spark-primary-hover`, `--spark-on-primary`; brand and enabled default Solid Button component tokens |
| border / hover / tint                           | `--spark-border`, `--spark-hover`, `--spark-tint`; dividers, rows, active navigation                                      |
| scrollbar / scrollbar-hover / scrollbar-active  | Matching `--spark-*` tokens; global standard and WebKit scrollbar baseline                                                |
| typography.sans                                 | `--spark-font`; document and Radix `--default-font-family`                                                                |
| context-panel / brand-mark / login-emblem radii | `.context-panel`, `.brand-spark`, `.login-emblem`; Radix control radii remain library-owned                               |

Light uses mist blue/lilac/pink context washes, white workspace and purple-gray
text. Dark uses a 155deg context gradient through `#282226`, `#31232C` and
`#3C1D2D`; the workspace transitions at 145deg from `#201D21` to `#271F25`. The
light workspace uses the same gradient from white to `#FAF9FC`. Main content and
Ghost tables remain transparent to that continuous canvas.

### Theme behavior

The topbar has a visible Ghost sun/moon toggle with an accessible label and
Tooltip. It selects the opposite explicit theme. The account menu
offers 浅色, 深色 and 跟随系统. `spark-admin-theme` persists explicit choices;
system removes the key and follows `prefers-color-scheme` changes.
Invalid/missing values resolve to system. When storage is unavailable, rendering
and current-session switching remain usable.

The Vite HTML bootstrap serializes the shared preference reader/resolver into a
synchronous head script. It sets `html[data-theme]` and `color-scheme` before
the application module loads. ThemeProvider owns subsequent updates for login
and authenticated routes. Switching preserves routes, filters, form values and
component identity. There is no separate login theme implementation.

## Typography

Use local Inter / Segoe UI with Microsoft YaHei / PingFang SC Chinese fallbacks;
no external fonts. Radix Heading size6 is the page heading and size4 the module
heading; normal copy/labels use size2 (14px), metadata size1 (12px). The context
title is 22px/600 and sidebar wordmark 18px/650. Main copy is left aligned;
descriptions stay below 65ch where practical. Use tabular numbers and end
alignment for numeric columns.

Login retains its approved 30px/600 form title, 12px/500 labels, 45px S emblem,
38–56px/650 brand headline, 20px wordmark and 15px introduction. Do not shrink
Radix typography through unrelated internal selectors.

## Layout

Desktop context width is `--spark-sidebar: clamp(300px, 25.8621vw, 420px)`,
derived from the approved 300/1160 proportion: about 331px at 1280px and 372px
at 1440px. The fixed sidebar and workspace margin consume the same token; the
64px minimum-height topbar aligns within the workspace. Content has a 1400px
maximum and `36px 36px 64px` padding. The page scrolls naturally; no shared
fixed height or hidden-overflow constraint is introduced to fit tables.

WorkspaceContext owns the introduction, current-activity panel and failed-task
panel. It uses the selected activity on detail routes or the first actually
running activity from the existing list on global routes. New activity shows a
save-first placeholder. Report fields `participants`, `pending` and `leads`
supply three metrics. Failed-job data supplies up to three links; its label says
“最近 N 项失败任务” because the endpoint is bounded. Missing/failed reads never
become invented zeros or successful statuses. Identity (104px), report (51px)
and heading (24px) regions reserve context geometry during loading.

Activity list structure is page heading/action, open four-metric strip, then
collection heading/search/status and Ghost table. The latest user correction
places name and access path in separate columns with compact 10px row block
padding. The rightmost action is a size1 Ghost ellipsis IconButton opening a
Radix DropdownMenu with the existing 管理 link. Full name/path values remain in
accessible text and title attributes when visually truncated. Counts reflect
actual responses. The empty list uses directed onboarding with one Solid
creation action.

Editor configuration uses open sections and a 264px publication column with a
36px gap above 1150px. Its transparent summary is sticky at 24px. Save is Ghost,
publish Solid, and end-draw a separated red Outline entry. Other wide form
sections use 220px explanations plus flexible fields. Staff uses a compact Ghost
table with open metrics; create/edit use controlled dialogs. Jobs and activity
child datasets share GhostTable.

### Responsive rules

- At 1150px and below, editor publication controls and explanation columns join
  normal document flow; page side padding becomes 28px.
- At 900px and below, desktop context is hidden and a Radix modal drawer uses
  `--spark-drawer: min(360px, 88vw)` (about 343px at 390px). It reuses context
  and navigation, closes on navigation/Escape and restores trigger focus.
- At 600px and below, content uses `28px 20px 48px` padding; topbar minimum is
  60px, headings/actions stack, form fields become one column, staff metrics
  stack with horizontal dividers, and activity metrics remain two columns.
- Tables own horizontal overflow; the document must not widen. Long forms retain
  natural height and all fields/actions remain reachable.
- Login has two desktop columns (1.05fr / 1fr) and an open 360px form on the
  plain workspace surface. At 600px and below, it stacks a compact brand header
  and form. No outer login Card is used.

## Elevation & Depth

Depth belongs to context panels and interactive overlays. Datasets, staff table,
report metrics and editor sections have no enclosing Classic Card. There are
currently no Classic Card instances in admin production source. Any future
bounded non-dataset Card needs a specific documented use.

| Context material token            | Light                             | Dark                            |
| --------------------------------- | --------------------------------- | ------------------------------- |
| `--spark-context-panel`           | `rgba(255,255,255,.32)`           | `rgba(23,19,23,.28)`            |
| `--spark-context-panel-border`    | `rgba(255,255,255,.72)`           | `rgba(255,255,255,.13)`         |
| `--spark-context-panel-highlight` | `rgba(255,255,255,.9)`            | `rgba(255,255,255,.26)`         |
| `--spark-context-panel-glint`     | `rgba(255,255,255,.18)`           | `rgba(255,255,255,.055)`        |
| `--spark-context-panel-shadow`    | `0 8px 28px rgba(77,62,116,.045)` | `0 8px 28px rgba(16,10,15,.08)` |
| Ambient opacity                   | `.38`                             | `.44`                           |

Panels combine a brighter top rim, 135deg glint, 1px inset highlight and diffuse
shadow. An isolated, pointer-inert negative-z pseudo-element shared by sidebar
and drawer paints a bounded ambient circle: radius 180px, center
`-30px calc(100% - 70px)`. This reproduces the approved 360px circle at left
-210px/bottom -110px without extending the navigation scroll area.

Login's light story uses `#EDEAFB`, `#E4F1FF` and `#EFD5E8`, with dedicated
`--spark-login-*` text/divider tokens. Its light emblem uses Radix
violet3/violet6 and `0 2px 3px #00000006`; dark aliases shared
context/text/border/tint and removes the emblem shadow. Keep these scoped login
roles instead of copying light colors into dark selectors.

## Shapes

Context panels use 9px corners and `16px 17px` padding; brand marks use 8px and
the login emblem 10px. Radix medium radius remains authoritative for controls
and overlays. Ghost tables have no outer frame, radius or filled header. Status
dots and the ambient circle retain their circular form.

Motion is limited to interaction feedback: rows use 120ms background
transitions, Radix owns overlay animation, and no decorative autonomous
animation is added. Reduced motion sets animation/transition durations to 0.01ms
and disables smooth scrolling. Global scrollbars use thin standard properties,
8px WebKit geometry, transparent tracks and system colors under forced colors.

## Components

| Capability            | Canonical owner and variants                                                                |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Shell/context         | AppShell + WorkspaceContext; shared desktop/drawer content and honest data states           |
| Theme                 | theme-preference + Vite bootstrap + ThemeProvider; system/light/dark                        |
| Header                | PageHeader; one h1, supporting description, compact actions                                 |
| Primary action        | Radix Button Solid, at most one per page/independent operation group, size2                 |
| Secondary/row/account | Radix Ghost Button/IconButton, size1 or size2; deliberate Soft/Outline exceptions           |
| Dangerous action      | Separated red Ghost/Outline entry; red Solid final AlertDialog action                       |
| TextField/TextArea    | Radix Soft gray size2; login size3/40px; TextArea `resize="none"`                           |
| Select/Listbox        | Authored Radix Select; activity status Ghost Trigger/Popper Content, form selects Soft gray |
| Dataset               | GhostTable wraps Radix semantic Table; GhostTableFooter announces actual count/range        |
| Table row actions     | TableRowActions owns size1 gray Ghost ellipsis IconButton + accessible Radix DropdownMenu   |
| Staff grants          | ActivityPermissionSelect with Radix DropdownMenu checkboxes                                 |
| Route navigation      | ActivityNav/Radix TabNav in the context zone, once per visible navigation surface           |
| Feedback              | EmptyState, LoadingState, FeedbackCallout, StatusBadge; semantic tone and explicit text     |
| Dialog/account        | Radix Dialog/AlertDialog/DropdownMenu; focus placement/trap, Escape and restoration         |

GhostTable owns transparent surfaces, one 1px horizontal divider (no doubled
Radix cell shadow), 12px/500 muted headers, compact 10px row block padding,
themed hover, selected tint and focus-within outline across all datasets.
Default table minimum is 42rem; the small report table uses a deliberate 260px
exception. Real links/buttons own row actions. Footer minimum height is 52px,
with wrapping narrow-screen actions.

Every admin table with an 操作 column uses the same right-aligned
TableRowActions menu, including single-action rows. Use a row-specific
accessible name and an aria-hidden ellipsis; Enter/Space opens the menu, arrow
keys navigate, Escape closes and restores trigger focus. Menus contain existing
real navigation links or action handlers; loading disables both the trigger and
relevant item without changing trigger geometry. Dialog actions transfer focus
into the dialog and restore it to that row's trigger on cancellation/completion.
Preserve danger coloring, separated destructive items and existing confirmation
dialogs when such actions exist; do not invent destructive table actions.

Keep independent data fields in separate named header/cell columns, never stack
name/link/identifier/status/metadata merely for appearance. A formatted activity
date range remains one logical period field. Long names/paths may truncate on
one line with the full value available by title; do not discard data to make
rows fit. Internal horizontal scrolling preserves every column and the operation
menu on narrow screens.

| Table surface   | Fields and action decision                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activities      | Name, access path, status, activity period; menu contains 管理 link                                                                                                                             |
| Prizes/stock    | Level, name, awarded, available, total, weight; menu opens existing 添加库存 dialog                                                                                                             |
| Failed jobs     | Type, task ID, status, attempt count, latest error; menu runs existing 重新处理 handler                                                                                                         |
| Export          | Task, status, record count; menu refreshes status and conditionally offers original download link                                                                                               |
| Participants    | Name, organization, phone, lead state, channel, prize, redemption state, participation time; TableRowActions menu contains 查看登记详情 for submitted rows                                      |
| Redemptions     | Prize, redemption state, staff, time; no operation column                                                                                                                                       |
| Staff           | Display name, username, permission preview, permission count, status; menu opens account settings (including password reset), enables an account or opens the existing red disable confirmation |
| Report channels | Channel and visitor count; no operation column                                                                                                                                                  |
| Report prizes   | Prize, awarded and redeemed counts; no operation column                                                                                                                                         |

The nine surfaces share one Table.Root owner (GhostTable). Staff retains its
creation/edit/password dialogs, activity-permission preview (first three names,
unknown-activity fallback and +N remainder) and disable confirmation. Permission
count is its own column; status never shares the name cell. The staff table uses
nowrap cells and internal horizontal scrolling at narrow widths.

Dataset navigation preserves API contracts: activities are a complete returned
array, locally filtered by name/code/status, with `q`/`status` in the URL and a
clear button returning focus to search. Other datasets show returned records;
export shows the latest task created in the current view. Do not invent server
totals, pagination, sort or per-row metrics that the endpoint does not provide.

Native datetime-local and file pickers retain approved platform ownership.
Login/staff creation use app validation; editor, prize and staff-edit validation
remains a documented migration boundary. Do not add `noValidate` without
implementing/testing replacement required-field behavior. Preserve pending
guards, rejected values, revision conflicts, upload/stock retries and current
save destinations. No browser alert/confirm/prompt is used.

## Do's and Don'ts

- Reuse shared owners and semantic tokens across every route and theme.
- Preserve Radix focus, disabled, pressed, hover and pending behavior; controls
  keep their geometry while busy. Use real links/buttons and accessible names.
- Keep operation labels, feedback and destinations consistent across flows.
- Keep copy, status and actions readable in both themes; color never carries
  state alone. Target WCAG 2.2 AA and test keyboard, narrow viewports and zoom.
- Do not flatten controls globally, hide scrollbars, add Card-wrapped datasets
  or manufacture data to fill the context zone.

## Verification

Run Prettier on admin source/tests/design documents, admin lint/typecheck/unit/
build and all admin browser suites including `admin-composition`,
`admin-theme-startup`, `admin-table-contract`, `activity-upload` and
`stock-retry`. Run official `designmd lint DESIGN.md`, premium strict audit and
prohibited-pattern searches. Audit JSON is evidence, not a substitute for
browser checks.

Browser checks cover login, activity list/editor, a Ghost dataset, staff, jobs,
open Select/Dialog, loading, empty, no-results, failure and success in
light/dark at desktop and 390px. Verify startup/persistence/system theme,
keyboard/focus, reduced motion, internal table overflow and context geometry.
Screenshots use isolated route fixtures and manual inspection; they are not
golden assertions or evidence of deployed API correctness.

The strict audit currently reports Radix Select/Trigger/asChild/textarea
heuristics, documented legacy forms and activity/staff client findings outside
this scope. Inspect each match and report the actual nonzero exit; never claim a
clean strict audit while findings remain. Broader route titles, route-error
coverage and async recovery remain separate legacy behavior concerns, not proof
of compliance from a visual redesign.

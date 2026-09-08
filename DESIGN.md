---
version: alpha
name: Spark Admin
description:
  A Radix operations workspace with translucent cards, neutral Soft controls and
  clear action hierarchy.
colors:
  primary: '#6E56CF'
  primary-hover: '#644FC1'
  background: '#F7F9FC'
  surface: '#FFFFFF'
  sidebar: '#FFFFFF'
  text: '#20242C'
  muted: '#646B79'
  border: '#E3E7EF'
  tint: '#F1EDFF'
  scrollbar: '#C2C7D0'
  scrollbar-hover: '#919AA9'
typography:
  sans:
    fontFamily: 'Inter, Segoe UI, Microsoft YaHei, PingFang SC, sans-serif'
  mono:
    fontFamily: 'ui-monospace, monospace'
rounded:
  DEFAULT: '0.75rem'
  sm: '0.25rem'
  md: '0.375rem'
  lg: '0.625rem'
spacing:
  section-gap: '1.5rem'
  page-max: '87.5rem'
components:
  button: {}
  card: {}
  dialog: {}
  table: {}
  input: {}
  navigation: {}
---

# Spark Admin

## Direction and references

The user provided two Radix homepage module screenshots on 2026-09-08 and
clarified that Soft is preferred, with emphasis chosen by the designer. The
established violet brand must remain; reference screenshots do not authorize
changing the brand hue. References: [Radix homepage](https://www.radix-ui.com/)
and [Playground](https://www.radix-ui.com/themes/playground). Translate the
product examples into a working admin: pale blue/lilac/mint backdrop,
translucent white cards, neutral Soft fields, readable headings, subtle dividers
and a few solid primary actions. Keep the regular admin grid rather than copying
the marketing showcase's masonry layout or fictitious product/account data.

## Product scope

Only `apps/admin`. Chinese WeChat exhibition operations are defined by
`docs/superpowers/specs/2026-09-07-project-spark-architecture-design.md`. Keep
Chinese labels and Asia/Shanghai time display. Activity and staff clients remain
deferred. Authentication, stock idempotency, publication locking and export
retention remain business-owned.

## Canonical tokens

Model B: CSS is canonical. The frontmatter mirrors `--spark-*` in
`apps/admin/src/styles.css`. The `--spark-font` token supplies both the document
and Radix `--default-font-family`. `app.tsx` selects the full Radix violet/slate
palette, light appearance, medium radius, 100% scaling and translucent panel
background. Never replace isolated accent palette values or control shadows.
Radix owns semantic danger/success colors and all control state styling.

## Typography

Use locally available Inter / Segoe UI with Microsoft YaHei / PingFang SC
Chinese fallbacks; no external font loading or layout shifts. Radix Heading
size6 for page headings and size4 for module headings; the restored login title
uses 30px/600; labels/body use size2 (14px), secondary metadata size1 (12px).
Numbers use tabular figures. Custom branding uses a 38–56px login headline, 20px
wordmark, 15px introduction. Keep content left aligned and descriptions below 65
characters per line where practical. Do not shrink Radix typography through
component-internal selectors.

## Layout and spacing

224px white sidebar, 64px translucent topbar, page maximum 1400px with 36px
padding. Four overview cards precede the collection panel. Counts come from
actual returned data. The panel groups its heading, description, search/status
filter and native table. Color appears in small semantic metric icons instead of
saturating every control.

Forms use a 220px explanation column plus flexible fields on wide screens,
stacking their heading above the fields below 1150px. Modules use 24–32px native
Card padding and 24px gaps. The editor retains its sticky action summary with
secondary save and primary publish; mobile uses normal document flow. Staff
creation stays inside a controlled dialog. Only the top-right account menu
exposes account actions.

Below 900px navigation uses a Radix modal drawer. Below 600px content has 20px
side padding, forms become one column, and tables scroll inside their own
container. Labels with shared rows align; full-width fields use natural height.
Login keeps two desktop columns: brand introduction left, an open 360px login
form on a plain white right column, as explicitly corrected by the user. No
outer login card or tinted right-side background. Restore the prior right-column
S monogram (45px), 30px/600 heading, 12px/500 labels and 18px field gaps. Keep
native 40px Radix controls and the purple theme. Mobile stacks a compact brand
header and the form.

## Shapes, surfaces and motion

Native Classic Cards supply translucent white backgrounds, radius and shadow.
Native Soft fields use gray; the canvas supplies pale lilac/mint washes
following the reference. No custom control border/shadow/padding overrides. The
sidebar and brand mark remain crisp. Only brand/background layout has custom
CSS. Scrollbars have standard/WebKit and forced-color fallbacks. Reduced motion
disables nonessential transitions. The navigation drawer is a documented
geometry exception to the centered Dialog layout.

## Component ownership and variants

| Component                                 | Owner and presentation                                   |
| ----------------------------------------- | -------------------------------------------------------- |
| Primary create/save/publish/login/confirm | Radix Button solid, violet                               |
| Secondary/cancel                          | Radix Button soft, gray                                  |
| Destructive entry / confirmation          | Radix Button outline red / solid red, AlertDialog        |
| TextField/TextArea/Select                 | Radix soft gray, size2; login size3                      |
| Inline field actions                      | Radix IconButton ghost gray                              |
| Modules                                   | Radix Card classic, size3 or size4                       |
| Dataset tables                            | Radix Table, no custom cell styling; internal overflow   |
| Status and feedback                       | StatusBadge / FeedbackCallout with semantic Radix colors |
| Route tabs                                | ActivityNav with Radix TabNav                            |
| Account / modal                           | Radix DropdownMenu / Dialog with native focus management |

AppShell owns navigation/drawer. PageHeader owns h1/actions.
EmptyState/LoadingState/FeedbackCallout own shared feedback. Native date-time
and file pickers retain platform behavior. Existing business form validation
stays unchanged; login and staff creation use application validation. See
`UX-CONTRACT.md` for behavior and known legacy boundaries.

## Verification

Run admin build/typecheck/lint and unit tests plus Playwright admin, redesign,
upload and stock flows. Inspect desktop, 390px mobile, form, login, table,
report and open popup screenshots. Screenshots are manual visual evidence, not
golden image assertions. Static premium audit is heuristic: Radix
asChild/Trigger and resize props can be reported incorrectly; legacy browser
validation remains a known migration boundary, and must not be silently removed
in a visual update.

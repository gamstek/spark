---
version: alpha
name: Spark Activity
description:
  Mobile exhibition registration and lottery with numbered sections and crisp
  dividers.
colors:
  brand: '#CF102C'
  prize: '#F53C3C'
  wait: '#F28E52'
  win: '#AF4BC2'
  win2: '#4664D4'
  ink: '#333333'
  sub: '#666666'
  line: '#CBCBCB'
  canvas: '#F4F5F9'
  surface: '#FFFFFF'
typography:
  display:
    fontFamily: 'Alibaba PuHuiTi 3.0, PingFang SC, Microsoft YaHei, sans-serif'
  body:
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif'
rounded:
  dialog: '8px'
spacing:
  reading-padding: '20px'
  dialog-max: '720px'
components:
  content-dialog:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
---

# Spark Activity

## Overview

This app serves Chinese scientific-instrument exhibition visitors completing a
mobile registration form at a busy booth. UI and accessible copy use zh-CN.
Registration and legal reading are product surfaces; the existing lottery pages
retain their supplied campaign assets. Japan-market rules do not apply.

The signature is restrained instrument-panel precision: the real 01–13 question
sequence forms a narrow functional rail, with crisp dividers and one primary
action. Familiar reading and input behavior take precedence over decoration. The
approved Task 5 brief, shared exhibition form definition, and user-supplied
privacy Markdown ground this contract.

Token ownership is Model B: `src/styles.css` is canonical. Its Tailwind v4
`@theme` block supplies color and font utilities; this file mirrors its values.
Root `DESIGN.md` and `UX-CONTRACT.md` apply to Admin only.

## Colors

Brand red is reserved for the primary action and accessible focus indication.
Prize red and existing wait/win colors retain lottery meaning. Ink/sub provide
text hierarchy, line marks functional boundaries, canvas surrounds white reading
surfaces. The Activity palette is light; forced-colors uses system colors.

## Typography

Use the local display and body stacks above, without network fonts. Reading copy
is 16px with 1.8 line height; headings are 18–22px, semibold and left aligned.
Chinese and mixed Latin text wrap naturally; long links and table cells must not
widen the document. Keep desktop reading width below 80 characters where
feasible.

## Layout

Use one natural-height left-aligned column. The registration page owns document
scrolling, and question numbers remain a narrow rail rather than separate cards.
The dialog is white and near full screen on mobile, with 8px horizontal margins,
safe-area bounds, a fixed title row, and one scrolling body. At 768px and above,
it is bounded to 720px width and 800px height, leaving 24px viewport margins.

## Elevation & Depth

Depth belongs to the dimmed backdrop and dialog. Existing illustrated campaign
pages retain their own assets; no scientific images are invented for the form.
`--z-backdrop: 500` and `--z-dialog: 600` are the shared overlay layers.

## Shapes

Dialog corners use 8px radius. Dividers separate content; avoid per-question
containers, generic SaaS card grids, and decorative gradients.

## Components

| Capability     | Canonical owner                                        | Behavior and verification                                                                                                                  |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Content dialog | `src/components/content-dialog.tsx`, Radix Dialog      | Generic title/trigger/children; close, Escape, outside dismissal, modal focus trap, focus restoration; verify keyboard and narrow viewport |
| Markdown       | `PrivacyAgreementContent` in the content-dialog module | ReactMarkdown + remark-gfm; semantic headings/lists/links/tables; raw HTML disabled                                                        |
| Privacy source | `src/lib/privacy-agreement.ts`                         | Import one user-authored Markdown source; require exact activity token; no separate consent time/version storage                           |
| Scrollbar      | `src/styles.css` global baseline                       | Every owned overflow surface inherits standard/WebKit colors without opt-in class; forced-colors fallback                                  |

Color paths map `colors.*` to matching `--color-*`; `typography.*` maps to
`--font-*`. `ContentDialog` consumes these variables directly. Scrollbar thumb,
hover and active alias line, sub and ink; track aliases surface. Dialog geometry
is implemented in `.content-dialog` and `.content-dialog-body`. Update the CSS
owner and this mirror together; lint this document and verify computed styles.

On open, focus the body reading region so keyboard users can scroll from the
beginning; Tab reaches the always-visible close button and links, staying within
the modal. Close is named `关闭${title}`; a concise hidden description explains
scrolling and dismissal. Opening or closing never accepts an agreement. Trigger
consumers provide a semantic button with visible focus and pointer states.

## Do's and Don'ts

Keep the title and close control reachable throughout long-content reading. Use
semantic buttons and underlined links with hover, active, and visible focus.
Keep global scrollbars visible and operable. Avoid entrance animations for each
question; this dialog introduces no animation and works with reduced motion. Do
not invent or expand legal claims beyond the supplied agreement and explicit
task decisions. Do not turn the numbered sequence into decorative numbering.

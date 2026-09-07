# Admin Entities and UI Redesign

**Status:** Approved direction, ready for implementation planning

**Date:** 2026-09-07

## Problem

The API uses TypeORM only as a connection, migration, and raw-query layer. Both
production and test data sources register `entities: []`, while
`database/entities.ts` exports table-name strings instead of TypeORM entities.
This prevents repository use, relationship metadata, and automated checks that
the runtime model still covers the migrated schema.

The admin application already installs Radix Themes, but the interface uses a
minimal sidebar, unlabeled inputs, crowded action rows, and almost no loading,
empty, feedback, or confirmation states. The result does not provide the visual
hierarchy needed for daily activity operations.

## Scope

- Define and register entities for every current PostgreSQL table.
- Use repositories for ordinary account and CRUD paths while retaining explicit
  SQL where lock order, CTEs, or PostgreSQL-specific behavior is essential.
- Redesign all existing `apps/admin` routes with Radix Themes and Radix Icons.
- Preserve current API contracts, routes, permissions, and business rules.
- Keep shared packages UI-free. Activity and staff frontends remain deferred.

No schema migration is required solely for this work. Migrations remain the
source of truth and `synchronize` remains disabled.

## Data Model

Create entity classes under `apps/api/database/entities/`, grouped by domain:

| Group         | Tables                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Accounts      | `user_account`, `wechat_identity`, `admin_account`, `staff_account`, `app_session`, `oauth_state`, `wechat_credential_cache` |
| Campaigns     | `activity`, `activity_version`, `activity_version_prize`, `media_asset`, `staff_activity_permission`                         |
| Participation | `activity_participation`, `webhook_receipt`, `dingtalk_form_submission`, `channel_visit`                                     |
| Lottery       | `prize`, `activity_prize`, `lottery_record`, `redemption`, `stock_adjustment`                                                |
| Operations    | `background_job`, `audit_event`, `export_job`                                                                                |

Each class uses a PascalCase name and camelCase properties, with explicit table
and column names matching the snake_case schema. UUIDs, timestamptz, jsonb,
numeric values, nullable columns, unique constraints, and indexes must match the
latest migration state. Foreign keys are represented by both scalar ID columns
and navigable relations where the relationship helps normal CRUD. Numeric
weights remain strings at the entity boundary to avoid JavaScript precision
loss.

An `entities/index.ts` exports both the classes and one `databaseEntities`
registry. Production and test data sources consume the same registry. A metadata
integration test asserts that all 24 migrated tables are registered and checks
critical columns and unique constraints.

## Data Access Rules

Repositories become the default for straightforward reads, inserts, updates, and
account administration. The administrator seed must create an `AdminAccount`
through a repository, proving that runtime metadata is usable. Account and staff
administration should move to repositories where doing so does not alter
behavior.

Explicit SQL remains appropriate for:

- lottery and inventory lock ordering;
- `FOR UPDATE SKIP LOCKED` background-job claims;
- callback deduplication and conflict handling;
- reporting and export aggregation;
- maintenance batches and PostgreSQL-specific CTEs.

These paths continue to run through TypeORM `DataSource`, `EntityManager`, or
`QueryRunner`, so transactions remain controlled by one infrastructure layer.
The redesign does not attempt a mechanical rewrite of every query.

## Admin Design Direction

The interface should feel like an exhibition operations desk: quiet, precise,
and optimized for identifying activity state and the next available action. Use
Radix Themes as the component and token foundation, following its
[installation and theme guidance](https://www.radix-ui.com/themes/docs/overview/getting-started).

### Visual Tokens

- Canvas: `#F6F7F8`; surface: `#FFFFFF`; navigation: `#18201D`.
- Primary actions: Radix `iris`; success: `jade`; warning: `amber`; destructive:
  `tomato`.
- Text: `#1F2723`; secondary text: `#66706A`; borders use the active Radix gray
  scale.
- Typography uses Inter when available, followed by `PingFang SC`,
  `Microsoft YaHei`, and system sans-serif. Body text starts at 14–15 px with a
  compact but readable scale.
- Radius is moderate. Shadows are reserved for overlays; page structure relies
  on spacing, borders, and surface contrast. Decorative gradients are excluded.

### Application Shell

Use a persistent 240 px navigation rail on desktop and a compact header/drawer
at narrower widths. The rail contains the Spark identity, primary navigation,
and environment context. A top bar shows the current page and account menu.
Content uses a bounded wide canvas rather than stretching forms across the
viewport.

Inside an activity, a secondary navigation row provides stable access to
overview, prizes, participants, redemptions, and exports. Routes remain
unchanged. The active location must be visible through text, color, and shape,
not color alone.

### Shared UI Building Blocks

Create app-local components for `AppShell`, `PageHeader`, `ActivityNav`,
`StatusBadge`, `FeedbackCallout`, `EmptyState`, and `LoadingState`. Use Radix
`Badge`, `Callout`, `Dialog`, `AlertDialog`, `DropdownMenu`, `ScrollArea`,
`Skeleton`, `Table`, and form controls directly. Add `@radix-ui/react-icons` for
functional icons with accessible labels.

Fields always have visible labels, optional descriptions, and nearby validation
messages. Actions use consistent verbs. Success and errors appear as Callouts;
dangerous actions require AlertDialog confirmation. Tables provide headers,
empty states, horizontal overflow handling, and concise row actions.

## Page Behavior

- **Login:** focused sign-in panel with product identity, explicit labels,
  submit progress, and an inline authentication error.
- **Activities:** status badges, meaningful empty state, readable activity code
  and schedule, and a clear create action.
- **Activity editor:** sectioned configuration, schedule, form integration, and
  media areas. Save and publish actions stay visible in a dedicated action bar.
  Locked configuration is explained in context.
- **Prizes:** inventory availability is prominent. New prizes use a structured
  form; stock additions use a Dialog. Running activities cannot expose creation
  or stock-reduction controls.
- **Participants, redemptions, and jobs:** dense operational tables with clear
  states, timestamps, empty results, loading, and failure recovery.
- **Reports:** emphasize the funnel and inventory relationship without filling
  the page with identical cards. Group related measures and label their time
  basis.
- **Exports:** explain snapshot and expiry behavior, show job progress, and only
  reveal download actions when ready.
- **Staff administration:** separate account state, activity assignments, and
  destructive operations; confirmations name the affected account.

## Responsive and Accessibility Requirements

Remove the forced 1024 px body minimum. The full desktop layout targets 1440 px
and remains usable at 1024 px. At 768 px, navigation compacts and wide tables
scroll within their region. Every control must expose a visible keyboard focus,
dialogs must manage focus through Radix, icons require accessible names, and
status cannot depend on color alone. Reduced-motion preferences disable
nonessential transitions.

## Verification

Data work is complete when metadata tests fail without the entity registry and
pass with it, repository CRUD works against migrated PostgreSQL, and all
existing API integration tests remain green.

UI work is complete when existing admin Playwright flows still pass, added tests
cover navigation, dialog confirmation, loading/empty feedback, and locked
activity controls, and `lint`, `typecheck`, and `build` pass. Review screenshots
at 1440×900, 1024×768, and 768×1024 for the login, activity list, editor, prize,
participant, report, and failure-task pages. The review must check hierarchy,
overflow, focus visibility, Chinese text wrapping, and destructive-action
clarity.

## Risks and Controls

- Entity definitions can drift from migrations. One shared registry and metadata
  integration tests make drift visible without enabling synchronization.
- A broad SQL rewrite could change concurrency behavior. Transaction-sensitive
  paths stay explicit and are protected by the existing PostgreSQL tests.
- Radix defaults alone can still look generic. The app-level shell, typography,
  spacing, activity navigation, and operational content hierarchy provide the
  project-specific design language.
- Visual changes can break existing selectors. Preserve user-facing action names
  where possible and update Playwright selectors around accessible roles and
  labels.

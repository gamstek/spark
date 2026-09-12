# Self-Hosted Activity Form Design

## Context

The activity currently redirects participants to a DingTalk form. DingTalk
notifies Spark through an asynchronous callback, but the external form page
cannot navigate the participant's browser back to Spark. The original product
design expected a bounded polling and manual return flow, while the current
implementation replaces the activity page with the external form and therefore
cannot reliably show the updated state.

The approved resolution is to replace the DingTalk form integration with a
self-hosted activity form. The form stays inside the activity H5, submits to the
Spark API, and advances the participation state in the same transaction. No
DingTalk data, schema, runtime compatibility, or migration path will be kept.

## Scope and Non-Goals

This design applies to the fixed `exhibition-lottery` version 1 template. It
does not introduce a form builder or an administrator-configurable field model.
The form heading, introduction, fields, required states, and choices are fixed
product content. Administrators continue to configure the activity name,
schedule, visual asset, rules, subscription policy, and prize behavior only.

The following are explicitly out of scope:

- compatibility with existing DingTalk form links, callbacks, submissions, or
  pending jobs;
- preserving or migrating an existing database that contains DingTalk data;
- phone-number or email-address format validation;
- editing a submission after its first valid acceptance;
- storing a separate privacy-agreement version or consent timestamp;
- a general-purpose schema-driven form renderer.

Because the historical DingTalk migrations will be deleted and the baseline
schema will be edited directly, every existing local or deployed database must
be recreated before running this version.

## Fixed Form Content

The form title is **行业专家信息登记与技术交流预约**. Its introduction is:

> 尊敬的老师/专家，感谢您莅临我们的展位。请留下您的信息，以便我们为您提供精准的技术资料、应用方案及后续服务。

Questions 01 through 12 are required. Question 13 is optional.

1. `name`: 姓名
2. `organization`: 单位（公司/院校/研究所）全称
3. `department`: 部门/实验室/课题组
4. `jobTitle`: 职位/职称
5. `phone`: 手机号码
6. `email`: 电子邮箱
7. `researchAreas`: 您的主要研究方向/应用领域（多选）
   - 生命科学（制药、生物技术、CRO）
   - 材料科学
   - 食品与农产品安全
   - 环境监测与检测
   - 化学与石油化工
   - 临床与医学研究
   - 其他
8. `instrumentInterests`: 您目前最关注的仪器类型或技术（多选）
   - 色谱类（GC, GC-MS, LC, LC-MS, HPLC, IC）
   - 光谱类（原子吸收 AAS，原子荧光 AFS，ICP-OES/MS，分子光谱）
   - 质谱类（高分辨质谱，三重四极杆质谱，MALDI-TOF 等）
   - 样品前处理设备
   - 实验室自动化与耗材
   - 其他
9. `visitPurposes`: 您此次关注的目的是（多选）
   - 了解新产品/新技术动态
   - 现有设备更新换代计划
   - 为新项目/实验室采购选型
   - 寻找特定应用解决方案
   - 寻求合作（校企、测试服务等）
   - 获取技术资料
10. `followUpPreferences`: 您希望我们以何种方式为您提供后续信息？（多选题）
    - 发送详细产品技术资料（PDF）
    - 预约资深应用工程师电话沟通
    - 安排线下技术讲座或 Demo 演示
    - 提供定制化的应用方案
    - 加入行业技术交流群
11. `contactPreference`: 您是否方便接受我们在 1–2 个工作日内致电进行简短的技术交流？
    - 方便，欢迎联系
    - 请先通过邮件发送资料
    - 暂不需要，仅留资料即可
12. `onsiteAvailability`: 您今天是否有时间在我们的展台进行更深入的交流？（可与工作人员确认安排）
    - 是
    - 否，行程较满
13. `otherNeeds`: 其他具体需求或咨询

Selecting “其他” in question 07 or 08 reveals a corresponding required text
input. Every required multi-select question must contain at least one allowed
choice. Phone and email are trimmed and bounded by length but are not validated
for format. Every server-side enum uses stable English values; the Chinese
labels are fixed template metadata used by the H5, administrator detail view,
and export generation.

The submission payload also contains `privacyAccepted: true`. The schema
rejects `false`, missing consent, unknown choices, missing required text,
oversized text, and an “其他” selection without its explanation. Unknown object
keys are rejected.

## Participant Experience

When runtime returns `FORM`, the activity renders the self-hosted registration
page instead of navigating to another origin. The page is a responsive,
vertically scrolling mobile layout built with the activity's existing Radix UI
Themes, React Hook Form, and Zod. The standard resolver integration is used so
the UI and shared contract do not grow parallel validation rules.

Text answers use Radix text fields and text areas. Single-choice questions use
radio groups, and multiple-choice questions use checkbox cards with a clear
selected state. Each question has a visible number and label, required fields
have an explicit required marker, and validation errors are placed next to the
affected control and announced accessibly. Submitted values remain in the form
after a recoverable error. The submit control is disabled only while a request
is in progress, preventing accidental double activation without hiding server
errors.

The final required checkbox reads “我已阅读并同意《用户活动隐私协议》”. The
agreement name is an interactive text control that opens the privacy content;
opening the agreement does not toggle consent.

After the API accepts the form, the client displays the existing submission
success page. The participant selects “去抽奖” to refresh the authoritative
runtime and display the lottery page. A reload after submission may go directly
to the lottery because the server already records lead completion; the success
screen is a transient acknowledgement, not durable workflow state.

## Reusable Content Dialog and Privacy Agreement

The activity application gains a reusable `ContentDialog` implemented with the
existing Radix Dialog primitive. It is generic within `apps/activity`; it is not
moved into a shared package because repository packages must remain UI-free.

The dialog follows the supplied mobile reference:

- white, near-full-screen content on narrow viewports with safe-area spacing;
- a fixed title row and an accessible close button in the upper-right corner;
- an independently scrolling body with a visible scroll affordance;
- focus trapping, focus restoration, Escape dismissal, an accessible title and
  description relationship, and background scroll locking;
- bounded desktop width and height without changing the mobile reading order.

`docs/抽奖活动隐私协议.md` is renamed to
`docs/用户活动隐私协议.md`. References in the related authorization documents
are updated to the new name. The Markdown file remains the single source of
agreement content and is imported into the activity bundle as raw text at build
time, then rendered with mature Markdown components supporting tables and
lists. It is not fetched from the server at runtime.

Before use, the agreement content is aligned with the implemented behavior:

- remove unresolved brackets and render the current activity name where the
  applicable activity is identified;
- describe the complete set of information collected by the 13 questions;
- remove SMS verification and DingTalk descriptions that no longer apply;
- state that the third-party service list is “无”;
- replace wording that treats opening a link as consent with wording that
  reflects actively checking the consent box and submitting the form.

No separate agreement-version column or consent-time column is created. The
accepted submission row and its `submitted_at` value provide the operation
record requested for this release.

## Shared Contract

`@spark/contracts` exports one strict form submission schema and its inferred
input type. It defines bounded text values, stable choice enums, non-empty
multi-select arrays, conditional “其他” explanations, and literal privacy
acceptance. `@spark/templates` exports the fixed Chinese question and option
labels required by the H5, administrator views, and Excel export while
remaining free of React or other UI code.

The obsolete DingTalk callback contract and export are deleted. The lottery
template configuration removes `formId`, `formUrl`, `prefillField`, and
`fieldMapping`. Its defaults, registry tests, administrator edit serialization,
and configuration form are updated accordingly. No hidden compatibility fields
remain in published activity configuration.

## API and Transaction Boundary

The activity API adds:

```http
POST /api/activity/:code/form-submissions
Content-Type: application/json
X-CSRF-Token: <activity session token>
```

The endpoint requires an `ACTIVITY` session, validates CSRF using the same
activity-session boundary as lottery mutations, and validates the request with
the shared strict schema. It never accepts a client-provided participation or
user identifier.

The service resolves the published activity and the session-owned
participation, then performs one database transaction:

1. lock the participation row;
2. if a form submission already exists, return the successful idempotent result
   without comparing or replacing the stored answers;
3. confirm that the participant is currently allowed to provide first-time
   lead information;
4. insert the validated submission;
5. set `lead_completed=true`, `lead_completed_at=submitted_at`, and
   `updated_at=now()`.

The insert has a database uniqueness constraint on `participation_id`, so
concurrent requests also preserve the first accepted submission. Insertion and
lead completion commit or roll back together. A retry after the first commit
returns success and does not grant another draw or create another row.

The response is `{ submitted: true }`. The client then enters its transient
success state. Validation failures use the established API error envelope;
unauthorized or invalid-CSRF requests cannot write data. First-time submission
after the applicable activity window has ended is rejected. No submitted
answers or other personal information are written to application logs.

## Database Baseline Reset

The schema is rewritten as a clean baseline, not upgraded compatibly:

- remove `webhook_receipt` and `dingtalk_form_submission` from the initial
  migration;
- delete the later DingTalk-submission migration;
- remove `adopted_submission_id` and its foreign key from
  `activity_participation`;
- add `activity_form_submission` with an ID, unique foreign key
  `participation_id`, strict JSONB `answers`, `submitted_at`, and `created_at`;
- remove any DingTalk-specific entity exports and job handlers.

Existing migration files are intentionally changed or deleted. This release
requires an empty rebuilt database; running it against a database initialized
by the previous migration chain is unsupported.

## Runtime and State Model

`RuntimeService` continues to return `FORM` until `lead_completed` is true and
returns the existing lottery-related state afterward. `WAITING_FORM` is removed
from the shared runtime enum and frontend scene dispatch because there is no
asynchronous external callback to await.

Submission success is held only in frontend provider state. Selecting “去抽奖”
clears that acknowledgement and refreshes runtime. Draw authorization remains
server-controlled and continues to require a completed lead, so manually
navigating around the form cannot bypass it.

## Administrator and Export Experience

The participant list keeps a compact operational view with the participant's
name, organization, phone, lead status, channel, prize, redemption status, and
participation time. Selecting a participant opens a Radix detail dialog that
shows all 13 answers in their original question order. Empty optional answers
are displayed clearly, and multi-select answers use their Chinese labels.

The Excel export creates explicit columns for every answer rather than relying
on an opaque JSON column. Multi-select answers are joined with the Chinese
semicolon `；`; “其他” explanations have their own adjacent columns. Existing
participation, prize, redemption, time, and channel columns remain. All user
input is written as text so spreadsheet formulas cannot be introduced through
submitted answers.

The staff redemption view continues to receive only the masked participant name
and phone needed for redemption. It does not receive the full expert profile.

## DingTalk Removal

The following are deleted rather than disabled:

- DingTalk callback, prefill, and submission handler services and their module
  registrations;
- `/api/integrations/dingtalk/form-submissions` and
  `/api/activity/:code/form-link`;
- callback contracts, entities, jobs, tests, environment variables, setup
  documentation, and production configuration references;
- activity-side external navigation and API calls;
- administrator fields and validation for DingTalk form configuration.

Historical planning and architecture documents may remain as dated records,
but active product, deployment, setup, acceptance, and configuration documents
must describe only the self-hosted form.

## Error Handling and Security

- Both client and server enforce maximum lengths, but only the server is
  authoritative.
- Required text is trimmed; phone and email are not format-validated by product
  decision.
- Choice values use allowlists; extra fields and invalid conditional values are
  rejected.
- Session ownership is derived server-side, and CSRF protection covers the
  mutation.
- First-write-wins semantics and a database unique constraint make retries and
  concurrency idempotent.
- Personal information is limited to authenticated administrator responses,
  private exports, and masked staff redemption data.
- Errors and audit details omit submitted answers and direct identifiers where
  they are unnecessary.
- Privacy consent must be actively checked; opening or scrolling the dialog is
  not consent.

## Verification

Contract tests cover all 13 fields, allowed options, required multi-selects,
conditional “其他” text, length boundaries, unknown keys, and required privacy
acceptance. API integration tests cover session ownership, CSRF, transaction
rollback, first submission, idempotent retry, concurrent first-write behavior,
ended activities, and runtime advancement.

Activity component tests cover accessible labels, validation messages,
conditional inputs, consent behavior, preserved values after failure, dialog
focus and scrolling semantics, the submitting state, and the transient success
page. Browser tests exercise the complete anonymous flow from form entry through
submission success to lottery.

Administrator tests cover the compact list, full detail dialog, option labels,
and empty optional values. Export integration tests verify every explicit
column, multi-select formatting, first-submission data, and formula-safe text.
Fresh-database tests assert that only the self-hosted form table exists and that
no DingTalk table, route, provider, configuration key, environment variable, or
active documentation reference remains.

Completion requires formatting, lint, type checking, unit tests, PostgreSQL
integration tests, activity and administrator browser tests, production builds,
and a final repository scan for active DingTalk references outside dated design
and plan records.

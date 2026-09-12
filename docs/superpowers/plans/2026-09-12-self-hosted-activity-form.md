# Self-Hosted Activity Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the external DingTalk lead form with a fixed, self-hosted
13-question activity form that grants lottery eligibility atomically and exposes
complete answers to authorized administrators and exports.

**Architecture:** A strict shared Zod contract validates the fixed form while
UI-free template metadata supplies Chinese labels. A session- and CSRF-protected
API stores the first accepted answer set in a one-to-one
`activity_form_submission` row and marks the participation complete in the same
PostgreSQL transaction. Activity uses Radix UI, React Hook Form, and a reusable
Markdown content dialog; administrator views and XLSX exports read the same
stored answers.

**Tech Stack:** TypeScript 6, React 19, Radix UI Themes 3, React Hook Form 7,
Zod 4, TanStack Query 5, NestJS/Fastify, TypeORM/PostgreSQL, ExcelJS, Vitest,
Playwright, pnpm/Turborepo.

**Spec:**
`docs/superpowers/specs/2026-09-12-self-hosted-activity-form-design.md`

## Global Constraints

- Work directly on the existing `main` checkout; do not create a worktree.
- The form is fixed to `exhibition-lottery` version 1; do not build a generic
  form designer or schema-driven UI renderer.
- Questions 01–12 are required and question 13 is optional.
- Phone and email receive trimming, non-empty, and length validation only; do
  not validate their formats.
- Question 07 and 08 “其他” selections require their corresponding explanation;
  explanations without “其他” are rejected.
- The privacy checkbox must be actively selected, but no separate agreement
  version or consent timestamp is stored.
- The first accepted submission wins; retries and concurrent requests return
  success without overwriting it.
- Delete DingTalk form code, schema, migrations, configuration, and active
  documentation directly. Do not preserve or migrate DingTalk data.
- Rewrite the database baseline; existing databases are unsupported and must be
  recreated.
- Preserve session ownership, CSRF checks, role and activity permissions,
  callback-independent identity behavior, and template-version validation.
- Keep personal information out of logs and expose full answers only to
  authenticated administrators and private exports; staff receive masked name
  and phone only.
- Use two-space indentation, single quotes, semicolons, kebab-case filenames,
  and repository Prettier settings.

---

### Task 1: Add the fixed form contract and UI-free labels

**Files:**

- Create: `packages/contracts/src/activity-form.ts`
- Create: `packages/templates/src/exhibition-lottery/v1/form-definition.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/src/registry.test.ts`

**Interfaces:**

- Produces: `ActivityFormSubmissionSchema`, `ActivityFormSubmissionDraft`,
  `ActivityFormSubmissionInput`, and
  `ActivityFormAnswers = Omit<ActivityFormSubmissionInput, 'privacyAccepted'>`
  from `@spark/contracts`.
- Produces: stable value arrays, `ActivityFormAnswerValues`,
  `activityFormDefinition`, `activityFormOptionLabels`, and
  `formatActivityFormAnswers()` from `@spark/templates`; `@spark/contracts`
  re-exports the metadata and formatter for browser clients without creating a
  reverse templates-to-contracts dependency.
- Stable values: research areas `life_sciences`, `materials_science`,
  `food_agriculture_safety`, `environmental_monitoring`,
  `chemical_petrochemical`, `clinical_medical_research`, `other`; instrument
  interests `chromatography`, `spectroscopy`, `mass_spectrometry`,
  `sample_preparation`, `lab_automation_consumables`, `other`; visit purposes
  `new_products`, `equipment_replacement`, `procurement_selection`,
  `application_solution`, `cooperation`, `technical_materials`; follow-up
  preferences `product_pdf`, `engineer_call`, `onsite_seminar_demo`,
  `custom_solution`, `industry_group`; contact preferences `call_welcome`,
  `email_first`, `no_contact`; onsite availability `available`, `unavailable`.
- Map those values to these fixed labels, in the same order:
  - research areas: `生命科学（制药、生物技术、CRO）`, `材料科学`,
    `食品与农产品安全`, `环境监测与检测`, `化学与石油化工`, `临床与医学研究`,
    `其他`;
  - instrument interests: `色谱类（GC, GC-MS, LC, LC-MS, HPLC, IC）`,
    `光谱类（原子吸收 AAS，原子荧光 AFS，ICP-OES/MS，分子光谱）`,
    `质谱类（高分辨质谱，三重四极杆质谱，MALDI-TOF 等）`, `样品前处理设备`,
    `实验室自动化与耗材`, `其他`;
  - visit purposes: `了解新产品/新技术动态`, `现有设备更新换代计划`,
    `为新项目/实验室采购选型`, `寻找特定应用解决方案`,
    `寻求合作（校企、测试服务等）`, `获取技术资料`;
  - follow-up preferences: `发送详细产品技术资料（PDF）`,
    `预约资深应用工程师电话沟通`, `安排线下技术讲座或 Demo 演示`,
    `提供定制化的应用方案`, `加入行业技术交流群`;
  - contact preferences: `方便，欢迎联系`, `请先通过邮件发送资料`,
    `暂不需要，仅留资料即可`;
  - onsite availability: `是`, `否，行程较满`.

- [ ] **Step 1: Write failing contract tests**

Add literal valid input containing all 13 answers and `privacyAccepted: true`.
Add table-driven failures for empty required text, an empty required
multi-select, an unknown option, duplicate options, `privacyAccepted: false`,
unknown object keys, an “other” choice without explanation, and an explanation
without “other”. Assert phone value `not-a-number` and email value
`not-an-email` are accepted because format validation is intentionally absent.

```ts
expect(ActivityFormSubmissionSchema.safeParse(validActivityForm).success).toBe(
  true,
);
expect(
  ActivityFormSubmissionSchema.safeParse({
    ...validActivityForm,
    researchAreas: ['other'],
    researchAreaOther: '',
  }).success,
).toBe(false);
expect(
  ActivityFormSubmissionSchema.safeParse({
    ...validActivityForm,
    phone: 'not-a-number',
    email: 'not-an-email',
  }).success,
).toBe(true);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `pnpm --filter @spark/contracts test -- contracts`

Expected: FAIL because `ActivityFormSubmissionSchema` is not exported.

- [ ] **Step 3: Implement the strict schema**

Use trimmed bounded strings, Zod enums built from the stable value arrays
exported by `@spark/templates`, non-empty unique arrays, and `.superRefine()`
for the two conditional “其他” pairs. Use these exact field names:

```ts
export const ActivityFormSubmissionSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    organization: z.string().trim().min(1).max(200),
    department: z.string().trim().min(1).max(200),
    jobTitle: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(1).max(64),
    email: z.string().trim().min(1).max(254),
    researchAreas: z.array(ResearchAreaSchema).min(1),
    researchAreaOther: z.string().trim().max(500).optional(),
    instrumentInterests: z.array(InstrumentInterestSchema).min(1),
    instrumentInterestOther: z.string().trim().max(500).optional(),
    visitPurposes: z.array(VisitPurposeSchema).min(1),
    followUpPreferences: z.array(FollowUpPreferenceSchema).min(1),
    contactPreference: ContactPreferenceSchema,
    onsiteAvailability: OnsiteAvailabilitySchema,
    otherNeeds: z.string().trim().max(2_000).optional(),
    privacyAccepted: z
      .boolean()
      .refine((accepted) => accepted, '请阅读并同意用户活动隐私协议')
      .transform(() => true as const),
  })
  .strict()
  .superRefine(validateConditionalAnswers);

export type ActivityFormSubmissionDraft = z.input<
  typeof ActivityFormSubmissionSchema
>;

export type ActivityFormSubmissionInput = z.output<
  typeof ActivityFormSubmissionSchema
>;

export type ActivityFormAnswers = Omit<
  ActivityFormSubmissionInput,
  'privacyAccepted'
>;
```

Reject duplicate array values with a reusable refinement. Give conditional
issues their explanation field path so React Hook Form can focus the correct
input.

- [ ] **Step 4: Add fixed label metadata and formatter tests**

Test that every enum value has one Chinese label and that formatting preserves
question order, maps choice values to Chinese labels, joins multi-selects with
`；`, and returns `未填写` for an empty optional answer.

```ts
const formatted = formatActivityFormAnswers(validActivityForm);
expect(formatted.map(({ number, label }) => `${number} ${label}`)).toEqual([
  '01 姓名',
  '02 单位（公司/院校/研究所）全称',
  '03 部门/实验室/课题组',
  '04 职位/职称',
  '05 手机号码',
  '06 电子邮箱',
  '07 您的主要研究方向/应用领域（多选）',
  '08 您目前最关注的仪器类型或技术（多选）',
  '09 您此次关注的目的是（多选）',
  '10 您希望我们以何种方式为您提供后续信息？（多选题）',
  '11 您是否方便接受我们在1-2个工作日内致电进行简短的技术交流？',
  '12 您今天是否有时间在我们的展台进行更深入的交流？（可与工作人员确认安排）',
  '13 其他具体需求或咨询',
]);
expect(formatted[0]?.value).toBe('张三');
expect(formatted[12]?.value).toBe('未填写');
```

- [ ] **Step 5: Implement fixed label metadata**

Export readonly value arrays, question metadata, option-label maps, and the
structural `ActivityFormAnswerValues` type from `form-definition.ts`. The
formatter accepts `ActivityFormAnswerValues` and returns
`{ number: string; label: string; value: string }[]`; it must not render
`privacyAccepted` as a question. `ActivityFormAnswers` is structurally
assignable to this type. Re-export the formatter and metadata through
`@spark/contracts` for Activity/Admin consumers while keeping `@spark/templates`
independent of `@spark/contracts`.

- [ ] **Step 6: Run and format shared-package tests**

Run:

```powershell
pnpm exec prettier --write packages/contracts/src/activity-form.ts packages/contracts/src/index.ts packages/contracts/src/contracts.test.ts packages/templates/src/exhibition-lottery/v1/form-definition.ts packages/templates/src/index.ts packages/templates/src/registry.test.ts
pnpm --filter @spark/contracts test
pnpm --filter @spark/templates test
pnpm --filter @spark/contracts typecheck
pnpm --filter @spark/templates typecheck
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```powershell
git add -- packages/contracts/src/activity-form.ts packages/contracts/src/index.ts packages/contracts/src/contracts.test.ts packages/templates/src/exhibition-lottery/v1/form-definition.ts packages/templates/src/index.ts packages/templates/src/registry.test.ts
git commit -m "Add fixed activity form contract"
```

---

### Task 2: Replace DingTalk storage with the clean form baseline

**Files:**

- Modify: `apps/api/database/migrations/1788739200000-InitialSchema.ts`
- Delete: `apps/api/database/migrations/1788739203000-DingTalkSubmissions.ts`
- Modify: `apps/api/database/data-source.ts`
- Modify: `apps/api/database/entities/participation.entities.ts`
- Modify: `apps/api/database/entities/index.ts`
- Modify: `apps/api/src/participants/participants-admin.controller.ts`
- Modify: `apps/api/src/exports/exports.handler.ts`
- Modify: `apps/api/src/redemptions/redemptions.service.ts`
- Modify: `apps/api/test/entities.integration.test.ts`
- Modify: `apps/api/test/support/fixtures.ts`
- Modify: `apps/api/test/lottery.integration.test.ts`
- Modify: `apps/api/test/redemptions.integration.test.ts`
- Modify: `apps/api/test/exports.integration.test.ts`

**Interfaces:**

- Produces database table
  `activity_form_submission(id, participation_id, answers, submitted_at, created_at)`.
- Produces TypeORM entity `ActivityFormSubmission` with
  `answers: ActivityFormAnswers` and unique `participationId`.
- Removes `WebhookReceipt`, `DingtalkFormSubmission`, and
  `ActivityParticipation.adoptedSubmissionId`.

- [ ] **Step 1: Change the entity metadata test first**

Replace DingTalk table expectations with `activity_form_submission`. Assert its
`participation_id` uniqueness and assert fresh migrations contain neither
removed table.

```ts
expect(tableNames).toContain('activity_form_submission');
expect(tableNames).not.toContain('webhook_receipt');
expect(tableNames).not.toContain('dingtalk_form_submission');

const submission = database.dataSource.getMetadata(ActivityFormSubmission);
expect(submission.uniques.map((unique) => unique.name)).toContain(
  'activity_form_submission_participation_key',
);
```

- [ ] **Step 2: Run the focused integration test and verify RED**

Run:
`pnpm --filter @spark/api test:integration -- test/entities.integration.test.ts`

Expected: FAIL because the migrated and registered table is still
`dingtalk_form_submission`.

- [ ] **Step 3: Rewrite the baseline migration and entity**

Replace both DingTalk tables in the initial migration with:

```sql
CREATE TABLE activity_form_submission (
  id uuid PRIMARY KEY,
  participation_id uuid NOT NULL REFERENCES activity_participation(id) ON DELETE RESTRICT,
  answers jsonb NOT NULL,
  submitted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_form_submission_participation_key UNIQUE (participation_id)
);
```

Remove both old tables from `down()`. Delete migration `1788739203000`, remove
it from `data-source.ts`, and register only `ActivityFormSubmission` in the
participation entity list.

- [ ] **Step 4: Update integration fixtures and dependent joins**

Replace cleanup table names in `entities.integration.test.ts`,
`lottery.integration.test.ts`, `redemptions.integration.test.ts`, and
`exports.integration.test.ts` with `activity_form_submission`. In redemptions
and exports fixtures, insert strict answer JSON keyed by the Task 1 contract and
join submissions by `submission.participation_id = participation.id`; remove all
updates to `adopted_submission_id`.

- [ ] **Step 5: Run database, redemption, lottery, and export integration
      tests**

Run:

```powershell
pnpm --filter @spark/api test:integration -- test/entities.integration.test.ts test/redemptions.integration.test.ts test/lottery.integration.test.ts test/exports.integration.test.ts
pnpm --filter @spark/api typecheck
```

Expected: all selected tests and type checking pass.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/api/database/migrations/1788739200000-InitialSchema.ts apps/api/database/migrations/1788739203000-DingTalkSubmissions.ts apps/api/database/data-source.ts apps/api/database/entities/participation.entities.ts apps/api/database/entities/index.ts apps/api/src/participants/participants-admin.controller.ts apps/api/src/exports/exports.handler.ts apps/api/src/redemptions/redemptions.service.ts apps/api/test/entities.integration.test.ts apps/api/test/support/fixtures.ts apps/api/test/lottery.integration.test.ts apps/api/test/redemptions.integration.test.ts apps/api/test/exports.integration.test.ts
git commit -m "Replace DingTalk submission storage"
```

---

### Task 3: Add the atomic self-hosted form endpoint

**Files:**

- Create: `apps/api/src/activity-form/activity-form.controller.ts`
- Create: `apps/api/src/activity-form/activity-form.service.ts`
- Create: `apps/api/test/activity-form.integration.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/common/api-exception.filter.ts`
- Modify: `apps/api/test/app-module-providers.integration.test.ts`

**Interfaces:**

- Produces:
  `ActivityFormService.submit(userId: string, activityCode: string, input: unknown): Promise<{ submitted: true }>`.
- Produces: `POST /api/activity/:code/form-submissions` guarded by
  `SessionGuard` and `CsrfGuard`.
- Consumes: `ActivityFormSubmissionSchema` and `ActivityFormSubmissionInput`
  from Task 1.
- Consumes: `activity_form_submission` from Task 2.

- [ ] **Step 1: Write failing integration tests for first acceptance**

Create a scenario whose selected participation starts with
`lead_completed=false`. Call `submit()` with the valid literal form fixture and
assert one submission row, exact stored answers without `privacyAccepted`, and
the same timestamp on `submitted_at` and `lead_completed_at`.

```ts
expect(await service.submit(userId, 'expo-2026', validForm)).toEqual({
  submitted: true,
});
expect(await readSubmission(participationId)).toMatchObject({
  answers: expectedAnswers,
  submitted_at: now,
});
expect(await readParticipation(participationId)).toMatchObject({
  lead_completed: true,
  lead_completed_at: now,
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:
`pnpm --filter @spark/api test:integration -- test/activity-form.integration.test.ts`

Expected: FAIL because `ActivityFormService` does not exist.

- [ ] **Step 3: Implement validation and the transaction**

Parse `input` before the transaction, remove only `privacyAccepted` from the
persisted `answers`, resolve the published activity, require template key
`exhibition-lottery` at version `1`, lock or create the session-owned
participation, and check for an existing submission before the first-time
activity-window check. Use the injected clock for deterministic tests. Insert
and update participation inside one transaction.

```ts
const parsed = ActivityFormSubmissionSchema.parse(input);
const { privacyAccepted: _privacyAccepted, ...answers } = parsed;

return this.dataSource.transaction(async (manager) => {
  // Resolve activity, lock participation, return on existing submission,
  // verify starts_at <= now < draw_ends_at, insert, then mark lead complete.
  return { submitted: true as const };
});
```

- [ ] **Step 4: Add idempotency, concurrency, validation, window, and rollback
      tests**

Cover these literal outcomes:

- retry with different answers returns `{ submitted: true }` and leaves the
  first stored answers unchanged;
- two simultaneous submissions leave one row and one first answer set;
- invalid privacy consent and unknown options create no row and do not mark the
  participation complete;
- first submission before `starts_at` or at/after `draw_ends_at` rejects with
  `FORM_NOT_AVAILABLE`;
- a forced failure between insert and participation update rolls the insert
  back;
- an unknown or unpublished activity rejects without creating a participation.
- a published activity using any other template key or version rejects without
  creating a submission.

- [ ] **Step 5: Add the guarded controller and module providers**

```ts
@Controller('activity/:code/form-submissions')
@RequireSession('ACTIVITY')
@UseGuards(SessionGuard)
export class ActivityFormController {
  @Post()
  @UseGuards(CsrfGuard)
  submit(
    @Param('code') code: string,
    @Body() input: unknown,
    @Req() request: ActivityRequest,
  ) {
    return this.forms.submit(request.session.subjectId, code, input);
  }
}
```

Register `FORM_NOT_AVAILABLE` as HTTP 409. Add controller/provider metadata to
`AppModule` and its provider integration expectations.

- [ ] **Step 6: Run focused and complete API tests**

Run:

```powershell
pnpm exec prettier --write apps/api/src/activity-form apps/api/test/activity-form.integration.test.ts apps/api/src/app.module.ts apps/api/src/common/api-exception.filter.ts
pnpm --filter @spark/api test:integration -- test/activity-form.integration.test.ts
pnpm --filter @spark/api test
pnpm --filter @spark/api typecheck
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```powershell
git add -- apps/api/src/activity-form/activity-form.controller.ts apps/api/src/activity-form/activity-form.service.ts apps/api/test/activity-form.integration.test.ts apps/api/src/app.module.ts apps/api/src/common/api-exception.filter.ts apps/api/test/app-module-providers.integration.test.ts
git commit -m "Add atomic activity form submission"
```

---

### Task 4: Replace the Activity external-form runtime action

**Files:**

- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `apps/activity/src/lib/api.ts`
- Modify: `apps/activity/src/lib/runtime-context.ts`
- Modify: `apps/activity/src/lib/runtime.tsx`
- Modify: `apps/activity/src/pages/runtime-scene.tsx`
- Modify: `apps/activity/src/pages/runtime-scene.test.tsx`
- Modify: `apps/activity/src/pages/submit-success-page.tsx`
- Create: `apps/activity/src/pages/submit-success-page.test.tsx`

**Interfaces:**

- Removes shared `WAITING_FORM` from `RuntimeStepSchema`.
- Removes `activityApi.formLink()` and runtime action `startForm()`.
- Produces `activityApi.submitForm(code, csrfToken, input)`.
- Produces runtime actions `submitActivityForm(input)` and `continueToLottery()`
  plus boolean `formSubmitted`.

- [ ] **Step 1: Write failing runtime-scene and success-page tests**

Change the scene test to expect a registration-page component for `FORM`, no
“正在打开钉钉表单”, and the success page whenever `formSubmitted` is true. Test
that the existing “去抽奖” button invokes `continueToLottery`.

```ts
runtime.view = 'flow';
runtime.step = 'FORM';
runtime.formSubmitted = false;
expect(renderToStaticMarkup(<RuntimeScene />)).toContain('专家信息登记表单');

runtime.formSubmitted = true;
expect(renderToStaticMarkup(<RuntimeScene />)).toContain('提交成功');
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm --filter @spark/activity test -- runtime-scene submit-success-page`

Expected: FAIL because the context has no form-submission state or action.

- [ ] **Step 3: Implement API and provider state**

Send the shared input as the POST body and include the runtime CSRF token.
`submitActivityForm()` clears the global message, calls the endpoint, and sets
`formSubmitted=true` only on success. `continueToLottery()` clears the local
acknowledgement and refreshes runtime. Leave input error handling to the form
page; expose an `ApiError` to it instead of converting validation errors into a
successful state.

- [ ] **Step 4: Remove the asynchronous runtime state**

Delete `WAITING_FORM` from the shared enum and its scene switch branch. Render
`SubmitSuccessPage` from `formSubmitted`, ahead of the server-step switch. A
fresh runtime whose step is `LOTTERY` renders the lottery directly.

- [ ] **Step 5: Run Activity and contract tests**

Run:

```powershell
pnpm --filter @spark/contracts test
pnpm --filter @spark/activity test
pnpm --filter @spark/activity typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add -- packages/contracts/src/index.ts packages/contracts/src/contracts.test.ts apps/activity/src/lib/api.ts apps/activity/src/lib/runtime-context.ts apps/activity/src/lib/runtime.tsx apps/activity/src/pages/runtime-scene.tsx apps/activity/src/pages/runtime-scene.test.tsx apps/activity/src/pages/submit-success-page.tsx apps/activity/src/pages/submit-success-page.test.tsx
git commit -m "Replace external form activity state"
```

---

### Task 5: Add the privacy Markdown and reusable content dialog

**Files:**

- Rename: `docs/抽奖活动隐私协议.md` to `docs/用户活动隐私协议.md`
- Modify: `docs/用户活动隐私协议.md`
- Modify: `docs/个人信息收集及使用授权协议.md`
- Modify: `docs/营销信息发送授权协议.md`
- Create: `apps/activity/DESIGN.md`
- Create: `apps/activity/src/components/content-dialog.tsx`
- Create: `apps/activity/src/lib/privacy-agreement.ts`
- Create: `apps/activity/src/lib/privacy-agreement.test.ts`
- Modify: `apps/activity/src/styles.css`
- Modify: `apps/activity/src/vite-env.d.ts`
- Modify: `apps/activity/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces reusable `ContentDialog({ title, trigger, children })` inside
  Activity.
- Produces
  `preparePrivacyAgreement(markdown: string, activityName: string): string`.
- Adds runtime dependencies `@hookform/resolvers`, `react-markdown`, and
  `remark-gfm` to `@spark/activity`.
- Records an app-scoped Activity design contract while keeping the existing root
  `DESIGN.md` authoritative for Admin only.

- [ ] **Step 1: Record the Activity design context before UI implementation**

Create `apps/activity/DESIGN.md` using token ownership Model B: the existing
Tailwind v4 `@theme` block in `apps/activity/src/styles.css` remains canonical
and the document mirrors it. Ground it in Chinese scientific-instrument
exhibition visitors completing a mobile form at a busy booth. Record this
compact direction:

- palette: brand red `#CF102C`, prize red `#F53C3C`, ink `#333333`, secondary
  ink `#666666`, divider `#CBCBCB`, canvas `#F4F5F9`, and white surface;
- typography: existing Alibaba PuHuiTi/PingFang/Microsoft YaHei display stack
  and Microsoft YaHei/PingFang body stack, with no network font;
- layout: one natural-height, left-aligned column; question numbers form a
  narrow functional rail because they are the actual 01–13 sequence;
- signature: restrained instrument-panel precision through numbered sections and
  crisp dividers, with brand red reserved for the one primary action;
- anti-references: no generic SaaS card grid, decorative gradients, invented
  scientific imagery, or per-question entrance animation;
- dialog: white near-full-screen mobile reading surface matching the supplied
  reference, bounded on desktop, with a fixed title row and scrolling body.

Run:

```powershell
npx -p @google/design.md designmd lint apps/activity/DESIGN.md
```

Expected: 0 errors.

- [ ] **Step 2: Write the failing privacy-content test**

Import the raw Markdown adapter and assert the prepared content uses the current
activity name, contains all collected profile categories, says the third-party
list is “无”, describes checkbox submission as consent, and contains no bracket
markers, SMS verification, or old agreement title.

```ts
const content = preparePrivacyAgreement(source, '测试活动');
expect(content).toContain('测试活动');
expect(content).toContain('第三方服务清单为：无');
expect(content).toContain('勾选');
expect(content).not.toMatch(/[【】]/);
expect(content).not.toContain('验证码校验结果');
expect(content).not.toContain('抽奖活动隐私协议');
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `pnpm --filter @spark/activity test -- privacy-agreement`

Expected: FAIL because the adapter and renamed agreement do not exist.

- [ ] **Step 4: Rename and correct the agreement source**

Set the title to “用户活动隐私协议”, remove bracket placeholders, use an exact
`{{activityName}}` token for the adapter, replace the collection table with the
13-question data categories plus necessary activity/session/security records,
set the third-party list to “无”, remove SMS/DingTalk statements, and state that
consent occurs by checking the box and submitting. Update both related
authorization documents to reference the new agreement name.

- [ ] **Step 5: Implement the raw Markdown adapter**

Declare `*.md?raw`, import the renamed document once, and replace only the exact
activity-name token. Reject a source missing the token so stale generic content
cannot silently ship.

- [ ] **Step 6: Install mature rendering dependencies**

Run:

```powershell
pnpm --filter @spark/activity add @hookform/resolvers react-markdown remark-gfm
```

Expected: `apps/activity/package.json` and `pnpm-lock.yaml` contain locked
versions.

- [ ] **Step 7: Implement `ContentDialog` and shared overlay styling**

Use Radix `Dialog.Root`, `Dialog.Trigger`, `Dialog.Content`, `Dialog.Title`,
`Dialog.Description`, and `Dialog.Close`. Derive the close button's accessible
name from the title as `关闭${title}` so the component stays generic. Give the
body a dedicated `overflow-y-auto`, use
`max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))`,
keep the title row outside the body scroller, and provide a concise visually
hidden description. Render prepared Markdown with `ReactMarkdown` and
`remarkGfm`; map headings, paragraphs, lists, links, and tables to consistent
Activity typography. Add app-level scrollbar colors and standards/WebKit
fallbacks plus named backdrop/dialog z-index variables in `styles.css`; the
dialog body must inherit the global scrollbar baseline without an opt-in class.

- [ ] **Step 8: Run focused tests, design lint, type checking, and formatting**

Run:

```powershell
pnpm exec prettier --write docs/用户活动隐私协议.md docs/个人信息收集及使用授权协议.md docs/营销信息发送授权协议.md apps/activity/DESIGN.md apps/activity/src/components/content-dialog.tsx apps/activity/src/lib/privacy-agreement.ts apps/activity/src/lib/privacy-agreement.test.ts apps/activity/src/styles.css apps/activity/src/vite-env.d.ts apps/activity/package.json
npx -p @google/design.md designmd lint apps/activity/DESIGN.md
pnpm --filter @spark/activity test -- privacy-agreement
pnpm --filter @spark/activity typecheck
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit**

```powershell
git add -- docs/用户活动隐私协议.md docs/个人信息收集及使用授权协议.md docs/营销信息发送授权协议.md apps/activity/DESIGN.md apps/activity/src/components/content-dialog.tsx apps/activity/src/lib/privacy-agreement.ts apps/activity/src/lib/privacy-agreement.test.ts apps/activity/src/styles.css apps/activity/src/vite-env.d.ts apps/activity/package.json pnpm-lock.yaml
git commit -m "Add activity privacy agreement dialog"
```

---

### Task 6: Build the fixed 13-question registration page

**Files:**

- Create: `apps/activity/src/components/form-field.tsx`
- Create: `apps/activity/src/components/choice-field.tsx`
- Create: `apps/activity/src/pages/registration-form-page.tsx`
- Create: `apps/activity/src/pages/registration-form-page.test.tsx`
- Modify: `apps/activity/src/pages/runtime-scene.tsx`
- Modify: `apps/activity/src/styles.css`

**Interfaces:**

- Consumes `ActivityFormSubmissionSchema`, `ActivityFormSubmissionDraft`,
  `ActivityFormSubmissionInput`, and fixed label metadata.
- Consumes runtime action `submitActivityForm(input)` from Task 4.
- Consumes `ContentDialog` and prepared privacy Markdown from Task 5.

- [ ] **Step 1: Write the failing static page test**

Render with a mocked runtime and assert the exact heading, introduction,
question numbers 01–13, every visible question label, required markers for
01–12, no required marker for 13, the privacy link, and submit button. Assert
the page has a real `<form>` and grouped choice controls rather than clickable
`div` elements. The form must carry `noValidate`, and invalid controls must use
`aria-invalid` plus an existing `aria-describedby` error target.

```ts
const markup = renderToStaticMarkup(<RegistrationFormPage />);
expect(markup).toContain('行业专家信息登记与技术交流预约');
expect(markup).toContain('01');
expect(markup).toContain('13');
expect(markup).toContain('用户活动隐私协议');
expect(markup).toContain('<form');
```

- [ ] **Step 2: Run the page test and verify RED**

Run: `pnpm --filter @spark/activity test -- registration-form-page`

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement focused field primitives**

`FormField` renders number, label, required marker, control, and an error region
connected with `aria-describedby`; invalid state also sets `aria-invalid`.
`ChoiceField` renders a semantic `fieldset` and either Radix Checkbox cards for
multiple choice or Radix RadioGroup for single choice. Neither component owns
business validation or form submission.

- [ ] **Step 4: Implement the explicit registration page**

Use
`useForm<ActivityFormSubmissionDraft, unknown, ActivityFormSubmissionInput>()`
with `zodResolver(ActivityFormSubmissionSchema)`. Render every question
explicitly in the approved order; reuse option metadata only for the choice
items. Watch questions 07 and 08 to reveal and unregister their explanation
fields. Use default empty arrays and `privacyAccepted: false` at the form
boundary while letting the resolver narrow accepted submissions to literal
`true`. Add `noValidate`; use useful `autoComplete`, `type`, and `inputMode`
metadata for name, organization, phone, and email without adding phone/email
format validation. Use the existing `ActionButton` as the one primary action.

On invalid submit, show a form summary, retain inline errors, and focus/scroll
the first invalid field. On valid submit, await `submitActivityForm` and keep
all values after errors. Map errors without exposing raw backend text:

- `VALIDATION_ERROR`: `请检查标记的项目后重新提交`;
- 401: `登录状态已失效，请刷新页面后重试`;
- `CSRF_INVALID`: `页面状态已失效，请刷新后重新提交`;
- `FORM_NOT_AVAILABLE`: `当前活动暂不可提交，请刷新页面查看最新状态`;
- network/5xx: `提交结果尚未确认，请检查网络后重试` because retry is idempotent
  and preserves the first accepted answer set.

Disable duplicate submission and expose `aria-busy` while awaiting the request.
Keep the full-width button geometry unchanged when its label changes from
“提交信息” to “提交中…”.

- [ ] **Step 5: Style the scrollable mobile form**

Follow `apps/activity/DESIGN.md`: use a white/soft-gray surface, the functional
question-number rail, crisp dividers, existing brand-red action treatment,
visible focus rings, 44px minimum interactive targets, natural-height content,
and safe bottom padding. Do not use absolute positioning or generic card grids
for the long form. Keep help/error regions and the busy button geometry stable.
Set textareas to `resize: none` with adequate height, and honor reduced motion.

- [ ] **Step 6: Run Activity tests and type checking**

Run:

```powershell
pnpm exec prettier --write apps/activity/src/components/form-field.tsx apps/activity/src/components/choice-field.tsx apps/activity/src/pages/registration-form-page.tsx apps/activity/src/pages/registration-form-page.test.tsx apps/activity/src/pages/runtime-scene.tsx apps/activity/src/styles.css
pnpm --filter @spark/activity test
pnpm --filter @spark/activity typecheck
pnpm --filter @spark/activity lint
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```powershell
git add -- apps/activity/src/components/form-field.tsx apps/activity/src/components/choice-field.tsx apps/activity/src/pages/registration-form-page.tsx apps/activity/src/pages/registration-form-page.test.tsx apps/activity/src/pages/runtime-scene.tsx apps/activity/src/styles.css
git commit -m "Build self-hosted activity registration form"
```

---

### Task 7: Expose complete answers in the administrator UI

**Files:**

- Modify: `DESIGN.md`
- Modify: `UX-CONTRACT.md`
- Modify: `apps/api/src/participants/participants-admin.controller.ts`
- Create: `apps/admin/src/features/participants/participant-detail-dialog.tsx`
- Create:
  `apps/admin/src/features/participants/participant-detail-dialog.test.tsx`
- Modify: `apps/admin/src/features/participants/participants-page.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `apps/admin/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/api/test/admin-operations.integration.test.ts`

**Interfaces:**

- Administrator API row adds `answers: ActivityFormAnswers | null` from
  `activity_form_submission`.
- Participant list shows name, organization, phone, lead status, channel, prize,
  redemption status, and participation time.
- `ParticipantDetailDialog` consumes the answer object and fixed formatter from
  Task 1.
- The existing `TableRowActions` remains the canonical Admin table-action owner;
  no participant-only action control is introduced.

- [ ] **Step 1: Write the failing administrator query and dialog tests**

Insert a local submission and assert the authenticated participant query returns
its answers. Render an open detail dialog and assert every question appears in
order, option codes are converted to Chinese labels, and an empty question 13
displays `未填写`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
pnpm --filter @spark/api test:integration -- test/admin-operations.integration.test.ts
pnpm --filter @spark/admin test -- participant-detail-dialog
```

Expected: FAIL because the query and dialog do not expose local answers.

- [ ] **Step 3: Reconcile the durable Admin contracts**

Update the Participant surface in `DESIGN.md` to list name, organization, phone,
lead state, channel, prize, redemption state, participation time, and an
operation column whose canonical `TableRowActions` menu contains “查看登记详情”.
Add the read-only participant-detail operation to `UX-CONTRACT.md`: opening the
dialog does not fetch or mutate data, Escape/close restores focus to the row
menu trigger, and the complete answer list scrolls inside the dialog.

- [ ] **Step 4: Update the protected participant query**

Left join `activity_form_submission` by `participation_id`, select `answers`,
and keep the existing ADMIN session guard and 500-row limit. Do not add a public
answer endpoint.

- [ ] **Step 5: Implement compact rows and a complete detail dialog**

Run `pnpm --filter @spark/admin add @spark/contracts@workspace:*` so Admin can
consume the shared answer type and re-exported fixed formatter. Then use
`answers.name`, `answers.organization`, and `answers.phone` in the table. Change
pending copy from “等待回调” to “待填写”. For each populated row, put
“查看登记详情” in the existing `TableRowActions` menu and open a Radix Dialog
from that action. Render the fixed formatter output as a definition list inside
a bounded scroll region. Keep ADMIN theme support, dialog focus containment,
Escape dismissal, and trigger-focus restoration.

- [ ] **Step 6: Run administrator and API verification**

Run:

```powershell
pnpm exec prettier --write DESIGN.md UX-CONTRACT.md apps/api/src/participants/participants-admin.controller.ts apps/admin/src/features/participants/participant-detail-dialog.tsx apps/admin/src/features/participants/participant-detail-dialog.test.tsx apps/admin/src/features/participants/participants-page.tsx apps/admin/src/styles.css apps/admin/package.json apps/api/test/admin-operations.integration.test.ts
npx -p @google/design.md designmd lint DESIGN.md
pnpm --filter @spark/admin test
pnpm --filter @spark/admin typecheck
pnpm --filter @spark/api test:integration -- test/admin-operations.integration.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```powershell
git add -- DESIGN.md UX-CONTRACT.md apps/api/src/participants/participants-admin.controller.ts apps/api/test/admin-operations.integration.test.ts apps/admin/src/features/participants/participant-detail-dialog.tsx apps/admin/src/features/participants/participant-detail-dialog.test.tsx apps/admin/src/features/participants/participants-page.tsx apps/admin/src/styles.css apps/admin/package.json pnpm-lock.yaml
git commit -m "Show complete activity form answers"
```

---

### Task 8: Expand the private Excel export

**Files:**

- Create: `apps/api/src/exports/activity-form-export.ts`
- Create: `apps/api/src/exports/activity-form-export.test.ts`
- Modify: `apps/api/src/exports/exports.handler.ts`
- Modify: `apps/api/test/exports.integration.test.ts`

**Interfaces:**

- Produces `toActivityFormExportRow(answers)` with one explicit key per answer.
- Produces `spreadsheetText(value)` that prefixes a leading `=`, `+`, `-`, or
  `@` with `'`.
- Consumes local submission answers and Task 1 fixed labels.

- [ ] **Step 1: Write failing export-mapping tests**

Assert every question maps to one literal column value, multi-select choices use
Chinese labels joined with `；`, “其他” explanations occupy adjacent columns,
question 13 remains empty when absent, and input beginning with `=HYPERLINK(` is
written as text beginning with `'=HYPERLINK(`.

- [ ] **Step 2: Run the focused unit test and verify RED**

Run: `pnpm --filter @spark/api test -- activity-form-export`

Expected: FAIL because the mapping module does not exist.

- [ ] **Step 3: Implement pure export mapping**

Return explicit keys for name, organization, department, job title, phone,
email, research areas, research other, instrument interests, instrument other,
visit purposes, follow-up preferences, contact preference, onsite availability,
and other needs. Apply `spreadsheetText` to every user-controlled scalar after
label formatting.

- [ ] **Step 4: Replace the handler's JSON-only export**

Join `activity_form_submission` by participation, add a worksheet column for
every Task 3 answer, retain participation/prize/redemption/channel columns, and
remove the opaque “表单字段(JSON)” column. Keep phone cell format as text.

- [ ] **Step 5: Verify the generated workbook in integration**

Read the resulting workbook and assert exact headers and row cell values for a
fixture containing multiple choices, both “其他” explanations, and a
formula-like string.

- [ ] **Step 6: Run export tests and commit**

Run:

```powershell
pnpm exec prettier --write apps/api/src/exports/activity-form-export.ts apps/api/src/exports/activity-form-export.test.ts apps/api/src/exports/exports.handler.ts apps/api/test/exports.integration.test.ts
pnpm --filter @spark/api test -- activity-form-export
pnpm --filter @spark/api test:integration -- test/exports.integration.test.ts
pnpm --filter @spark/api typecheck
```

Expected: all commands exit 0.

Commit:

```powershell
git add -- apps/api/src/exports/activity-form-export.ts apps/api/src/exports/activity-form-export.test.ts apps/api/src/exports/exports.handler.ts apps/api/test/exports.integration.test.ts
git commit -m "Expand activity lead exports"
```

---

### Task 9: Delete the remaining DingTalk product surface

**Files:**

- Delete: `apps/api/src/dingtalk/callback.controller.ts`
- Delete: `apps/api/src/dingtalk/callback.service.ts`
- Delete: `apps/api/src/dingtalk/prefill.service.ts`
- Delete: `apps/api/src/dingtalk/submission.handler.ts`
- Delete: `apps/api/test/dingtalk.integration.test.ts`
- Delete: `packages/contracts/src/dingtalk.ts`
- Delete: `docs/project-spark-dingtalk-setup.md`
- Modify: `apps/api/src/app.module.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/templates/src/exhibition-lottery/v1/config.ts`
- Modify: `packages/templates/src/exhibition-lottery/v1/defaults.ts`
- Modify: `packages/templates/src/registry.test.ts`
- Modify: `apps/admin/src/templates/exhibition-lottery/config-form.tsx`
- Modify: `apps/admin/src/templates/exhibition-lottery/config-form.test.ts`
- Modify: `apps/admin/src/features/activities/edit-page.tsx`
- Modify: `apps/admin/src/components/workspace-context.tsx`
- Modify: `apps/admin/src/features/jobs/jobs-page.tsx`
- Modify: `apps/api/test/admin-operations.integration.test.ts`
- Modify: `apps/api/test/publishing-lock.integration.test.ts`
- Modify: `apps/api/test/publishing.integration.test.ts`
- Modify: `tests/e2e/activity-upload.spec.ts`
- Modify: `tests/e2e/admin-composition.spec.ts`
- Modify: `tests/e2e/admin.spec.ts`
- Modify: `.env.example`
- Modify: `compose.production.yaml`
- Modify: `docs/activity-ui-lanhu-prototype.md`
- Modify: `docs/project-spark-acceptance.md`
- Modify: `docs/project-spark-configuration.md`
- Modify: `docs/project-spark-deployment.md`
- Modify: `docs/project-spark-external-acceptance-plan.md`
- Modify: `docs/project-spark-mvp-requirements.md`
- Modify: `docs/project-spark-v1-business-requirements.md`
- Modify: `docs/project-spark-wechat-auth-flow.md`

**Interfaces:**

- Removes all DingTalk form routes, providers, contracts, configuration keys,
  environment variables, and active documentation.
- Keeps unrelated WeChat OAuth and staff JS-SDK scan support.
- Final `LotteryConfig` contains `requireSubscribe`, `noPrizeWeight`,
  `heroAssetId`, and `rulesText` only.

- [ ] **Step 1: Change tests to the desired configuration surface**

Update template and admin configuration tests to construct and validate only:

```ts
const config = {
  requireSubscribe: true,
  noPrizeWeight: 1,
  heroAssetId: 'hero',
  rulesText: '填写信息后参与抽奖，每人每场活动限一次。',
};
```

Assert the admin configuration form contains no DingTalk heading, URL, ID, or
prefill control and still validates the hero asset and rules.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
pnpm --filter @spark/templates test
pnpm --filter @spark/admin test -- config-form
```

Expected: FAIL because the current strict schema and UI still require DingTalk
fields.

- [ ] **Step 3: Remove template and administrator configuration**

Delete the four DingTalk fields from the schema/defaults and remove parsing,
validation, inputs, state, and serialization from admin. Update every publishing
and admin-operation fixture to the four-field configuration above. Replace
remaining Admin context/job copy with channel-neutral wording for locally
submitted registration forms and generic background jobs.

- [ ] **Step 4: Delete API and contract remnants**

Delete the DingTalk directory, integration test, callback contract, module
registrations, and `DINGTALK_CALLBACK_SECRET`. Verify no `DINGTALK_SUBMISSION`
handler remains; retain the generic job subsystem for exports and maintenance.

- [ ] **Step 5: Update active documentation**

Delete the DingTalk setup guide. Rewrite current configuration, deployment,
acceptance, external acceptance, business requirement update notes, and
`activity-ui-lanhu-prototype.md` to describe the self-hosted form and the
required database rebuild. Leave dated `docs/superpowers/specs` and
`docs/superpowers/plans` records intact.

- [ ] **Step 6: Run the active-source scan**

Run:

```powershell
$matches = rg -n "DingTalk|Dingtalk|dingtalk|钉钉|formId|formUrl|prefillField|fieldMapping|DINGTALK_CALLBACK_SECRET|webhook_receipt|dingtalk_form_submission" apps packages tests .env.example compose.production.yaml README.md docs --glob '!docs/superpowers/specs/**' --glob '!docs/superpowers/plans/**'
if ($LASTEXITCODE -eq 1) { 'NO_ACTIVE_DINGTALK_REFERENCES' } else { $matches; exit 1 }
```

Expected: prints `NO_ACTIVE_DINGTALK_REFERENCES` and exits 0.

- [ ] **Step 7: Run package verification and commit**

Run:

```powershell
pnpm --filter @spark/templates test
pnpm --filter @spark/admin test
pnpm --filter @spark/api test
pnpm --filter @spark/api test:integration
pnpm typecheck
```

Expected: all commands exit 0.

Commit:

```powershell
git add -- .env.example compose.production.yaml apps/api/src/dingtalk/callback.controller.ts apps/api/src/dingtalk/callback.service.ts apps/api/src/dingtalk/prefill.service.ts apps/api/src/dingtalk/submission.handler.ts apps/api/test/dingtalk.integration.test.ts packages/contracts/src/dingtalk.ts docs/project-spark-dingtalk-setup.md apps/api/src/app.module.ts packages/contracts/src/index.ts packages/contracts/src/contracts.test.ts packages/templates/src/exhibition-lottery/v1/config.ts packages/templates/src/exhibition-lottery/v1/defaults.ts packages/templates/src/registry.test.ts apps/admin/src/templates/exhibition-lottery/config-form.tsx apps/admin/src/templates/exhibition-lottery/config-form.test.ts apps/admin/src/features/activities/edit-page.tsx apps/admin/src/components/workspace-context.tsx apps/admin/src/features/jobs/jobs-page.tsx apps/api/test/admin-operations.integration.test.ts apps/api/test/publishing-lock.integration.test.ts apps/api/test/publishing.integration.test.ts tests/e2e/activity-upload.spec.ts tests/e2e/admin-composition.spec.ts tests/e2e/admin.spec.ts docs/activity-ui-lanhu-prototype.md docs/project-spark-acceptance.md docs/project-spark-configuration.md docs/project-spark-deployment.md docs/project-spark-external-acceptance-plan.md docs/project-spark-mvp-requirements.md docs/project-spark-v1-business-requirements.md docs/project-spark-wechat-auth-flow.md
git commit -m "Remove DingTalk form integration"
```

---

### Task 10: Add browser coverage for form, dialog, and success flow

**Files:**

- Create: `tests/e2e/activity-form.spec.ts`
- Modify: `playwright.activity.config.ts`
- Modify: `tests/e2e/activity-runtime-provider.spec.ts`
- Create: `tests/e2e/admin-participant-detail.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**

- Verifies the production Activity UI against mocked API boundaries.
- Verifies administrator answer-detail rendering against its protected API
  boundary.

- [ ] **Step 1: Write the failing Activity browser test**

Change `playwright.activity.config.ts` to use
`testMatch: ['activity-runtime-provider.spec.ts', 'activity-form.spec.ts']`.
Mock runtime first as `FORM`, then as `LOTTERY` after submission. Fill all six
text inputs, select at least one option for questions 07–10, select both “其他”
choices and fill their explanations, select questions 11–12, open and close the
privacy dialog, check consent, and submit. Assert the POST body exactly matches
the stable contract and contains no client-provided participation ID.

```ts
await page.getByRole('button', { name: '用户活动隐私协议' }).click();
await expect(page.getByRole('dialog')).toContainText('用户活动隐私协议');
await page.getByRole('button', { name: '关闭用户活动隐私协议' }).click();
await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
await page.getByRole('button', { name: '提交信息' }).click();
await expect(page.getByText('提交成功')).toBeVisible();
```

- [ ] **Step 2: Run the browser test and verify RED**

Run:
`pnpm exec playwright test --config playwright.activity.config.ts tests/e2e/activity-form.spec.ts`

Expected: FAIL before the form UI and test match are wired.

- [ ] **Step 3: Cover validation and first-submission behavior**

Add cases asserting submit without required choices or consent stays on the form
and focuses the first accessible error; selecting “其他” reveals its input;
removing “其他” removes its stale explanation from the submitted body. Delay the
mocked POST, activate submit twice, and assert one request plus unchanged button
dimensions and an accessible busy state. Assert a lost/500 response preserves
all entered values and presents the retry-safe uncertain-result copy; a
successful response shows the existing success screen; “去抽奖” refreshes
runtime and shows the lottery.

- [ ] **Step 4: Add administrator browser coverage**

Mock a participant with complete answers, open its `TableRowActions` menu and
choose “查看登记详情”. Assert question order, Chinese choice labels, `未填写`
for question 13, dialog focus containment, Escape dismissal, trigger-focus
restoration, light/dark readability, and narrow viewport containment.

- [ ] **Step 5: Inspect the mobile form and dialog visually**

Run the Activity fixture at 390×844 and a short 390×640 viewport. Capture the
form with inline errors and the open long privacy dialog. Verify the 01–13 rail
remains aligned, option/error text wraps without moving controls, all form
content is reachable through document scrolling, the dialog alone owns its body
scroll, its title/close control stay visible, and there is no horizontal
overflow. Repeat with reduced motion and keyboard-only Tab/Shift+Tab/Escape.

- [ ] **Step 6: Run both browser suites**

Run:

```powershell
pnpm exec playwright test --config playwright.activity.config.ts
pnpm exec playwright test --config playwright.config.ts
```

Expected: all relevant browser tests pass; project-condition skips remain
intentional.

- [ ] **Step 7: Commit**

```powershell
git add -- tests/e2e/activity-form.spec.ts tests/e2e/activity-runtime-provider.spec.ts tests/e2e/admin-participant-detail.spec.ts playwright.activity.config.ts playwright.config.ts
git commit -m "Test self-hosted activity form flow"
```

---

### Task 11: Perform final fresh-database and repository verification

**Files:**

- Modify only files implicated by failures from the commands below; do not
  broaden scope.

**Interfaces:**

- Produces a clean `main` commit series implementing the approved spec.

- [ ] **Step 1: Format every changed supported source file**

Run `git diff --name-only 99f2c15..HEAD`, group supported TypeScript, TSX, JSON,
CSS, and Markdown files, and run `pnpm exec prettier --write` on those paths. Do
not pass `.env.example` to Prettier because it has no parser.

- [ ] **Step 2: Verify an empty database migrates to the new baseline**

Run:

```powershell
pnpm --filter @spark/api test:integration -- test/entities.integration.test.ts
pnpm --filter @spark/api test:integration -- test/activity-form.integration.test.ts
```

Expected: both pass against fresh generated test schemas containing
`activity_form_submission` and no DingTalk tables.

- [ ] **Step 3: Verify design contracts and changed UI anti-patterns**

Run:

```powershell
npx -p @google/design.md designmd lint DESIGN.md
npx -p @google/design.md designmd lint apps/activity/DESIGN.md
python C:/Users/lengjing/.codex/plugins/cache/openai-curated-remote/frontend-design-premium/1.4.0/skills/frontend-design-premium/scripts/audit_project.py . --mode strict --no-write
$premiumAuditExit = $LASTEXITCODE
$changedUi = @(git diff --name-only 99f2c15..HEAD -- apps/activity/src apps/admin/src)
if ($changedUi.Count -gt 0) {
  rg -n '(?:window\.)?(?:alert|confirm|prompt)\s*\(|<(?:div|span|p|section)[^>]*onClick|dangerouslySetInnerHTML|href=[''"]#[''"]' $changedUi
  if ($LASTEXITCODE -eq 0) { exit 1 }
  if ($LASTEXITCODE -gt 1) { exit $LASTEXITCODE }
}
"PREMIUM_AUDIT_EXIT=$premiumAuditExit"
```

Expected: both design documents have 0 lint errors and the changed-UI grep has
no matches. Inspect every strict-audit finding, fix findings introduced in the
changed files, and record any pre-existing repository-wide findings separately;
do not claim the strict audit is clean if its exit code is nonzero.

- [ ] **Step 4: Run the complete uncached repository pipeline**

Run:

```powershell
$env:TURBO_FORCE='true'
pnpm verify
```

Expected: lint, type checking, unit tests, production builds, and all PostgreSQL
integration tests exit 0 with no failures.

- [ ] **Step 5: Run the complete Activity and administrator browser suites**

Run:

```powershell
pnpm exec playwright test --config playwright.activity.config.ts
pnpm exec playwright test --config playwright.config.ts
```

Expected: all non-conditionally-skipped tests pass.

- [ ] **Step 6: Run final structural checks**

Run:

```powershell
git diff --check 99f2c15..HEAD
$matches = rg -n "DingTalk|Dingtalk|dingtalk|钉钉|DINGTALK_CALLBACK_SECRET|webhook_receipt|dingtalk_form_submission" apps packages tests .env.example compose.production.yaml README.md docs --glob '!docs/superpowers/specs/**' --glob '!docs/superpowers/plans/**'
if ($LASTEXITCODE -eq 1) { 'NO_ACTIVE_DINGTALK_REFERENCES' } else { $matches; exit 1 }
git status --short
```

Expected: no diff errors, `NO_ACTIVE_DINGTALK_REFERENCES`, and no uncommitted
implementation files. The three user-provided agreement documents become tracked
through Task 5 rather than remaining untracked.

- [ ] **Step 7: Commit final mechanical corrections if any**

If Step 1–6 changed files, commit only those verified corrections:

```powershell
$verificationFiles = git diff --name-only
if ($verificationFiles) {
  git add -- $verificationFiles
  git commit -m "Finish self-hosted activity form verification"
}
```

If the worktree is already clean, do not create an empty commit.

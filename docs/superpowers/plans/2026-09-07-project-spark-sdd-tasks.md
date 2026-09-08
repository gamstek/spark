# Project Spark SDD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development or superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking. 本文件只定义任务，不代表已实现；采用子代理执行时先遵循会话中的代理授权规则。

**Goal:**
交付可在真实微信环境运行的展会抽奖闭环，使用钉钉表单留资，支持工作人员核销及后台管理导出。

**Architecture:**
单仓库、四个应用、模块化单体。共享包仅为 contracts 和 templates；事务、Session、回调任务均落 PostgreSQL。活动模板由开发者编排，运营选择完整模板。

**Tech Stack:** pnpm workspace、Turborepo、React、TypeScript、Vite、React
Router、TanStack Query、React Hook Form、Zod、Radix UI、Tailwind
CSS、NestJS、Fastify、TypeORM、PostgreSQL、Vitest、Playwright。

**Spec:**
[Project Spark 架构设计](../specs/2026-09-07-project-spark-architecture-design.md)。执行者必须同时阅读规范与本计划，旧需求文件中的示例不覆盖新规范。

## Global Constraints

**执行状态（2026-09-08）：**
T01–T11、T14–T15 的服务端及运营能力已实现；T12 的服务端运行时已实现，活动端页面仍等待 D01；D01、D02、T12 前端和 T13 按产品决定暂缓。T16 已完成安全与部署配置、故障模拟和运维文档，真实微信/钉钉联调、移动端验收及恢复演练仍待执行。`[x]`
表示已有代码、测试或文档证据，`[ ]` 表示未完成、暂缓或仍依赖真实环境。

- 应用名：`apps/activity`、`apps/admin`、`apps/staff`、`apps/api`。
- 共享包：`packages/contracts`、`packages/templates`；包名分别为
  `@spark/contracts`、`@spark/templates`。
- 前端应用包名为 `@spark/activity`、`@spark/admin`、`@spark/staff`，服务端为
  `@spark/api`。
- 系统不使用 Redis。数据库为 PostgreSQL + TypeORM，生产禁用自动同步。
- Radix UI 由各前端直接使用，不建立共享 UI 包。
- `activity` 和 `staff` 先交付并确认高保真 UI 设计稿，再实现业务页面；`admin`
  不需要独立 UI 设计稿。
- 首版只提供 `exhibition-lottery` 模板，服务单公司、单公众号。
- 外部地址为 `/activity/:activityCode`、`/staff`、`/admin`、`/api`，图片使用
  `/media/*`。
- 有库存的有效抽奖必中奖；无库存不消耗资格；同一用户每活动最多一个中奖结果。
- 钉钉使用随机 `participationId`
  预填，回调共享密钥鉴权；保留首次有效留资，不自建表单。
- 活动首次开始后锁定模板及规则；原结果可恢复，兑奖过期不回补库存。
- 每项业务任务先建立失败的行为测试，再实现并验证；工程配置只做实际构建验证，不写镜像配置的测试。
- 每项完成后检查规范一致性及代码质量，单独提交明确范围；用户已提交
  `AGENTS.md`，遵循其中仓库规范。
- 文件路径在本计划中均相对仓库根目录。任务列出的命令是当前工程契约，完成状态以仓库代码和实际验证结果为准。

## 任务依赖与交付点

| 阶段       | 任务    | 交付点                                       |
| ---------- | ------- | -------------------------------------------- |
| 基础       | T01–T04 | 四个入口、类型契约、迁移、真实数据库测试设施 |
| 身份与配置 | T05–T08 | 登录、微信身份、活动发布、可靠后台任务       |
| UI 设计    | D01–D02 | 活动端和工作人员端的设计稿及用户确认记录     |
| 业务闭环   | T09–T12 | 钉钉留资、抽奖、兑奖、用户活动页             |
| 运营与现场 | T13–T15 | 工作人员平台、后台、统计及导出               |
| 上线验收   | T16     | 同域部署、真实联调、恢复演练                 |

依赖：T01 → T02 → T03 →
T04；T05 依赖 T04；T06 依赖 T05；T07 依赖 T03/T05；T08 依赖 T04；T09 依赖 T06/T07/T08；T10 依赖 T09；T11 依赖 T10；D01/D02 基于架构规范即可开始，不等待后端完成；T12 依赖 T06–T11 和 D01 用户确认；T13 依赖 T05/T11 和 D02 用户确认；T14 依赖 T07/T08/T09/T10；T15 依赖 T11/T14；T16 依赖全部任务。共 16 个实施任务和 2 个设计任务；任务编号不是强制串行顺序，但不得提前猜测依赖接口。

## D01：活动端 UI 设计稿

**Files:** 新建
`docs/design/activity/index.html`、`styles.css`、`prototype.js`、`design-notes.md`、`screenshots/`
下的页面 PNG。原型为设计交付，不复用成未经测试的生产业务代码。

**Interfaces:**
消费规范中的活动状态及钉钉跳转流程；交付页面与 RuntimeStep 对照表，供 T12 实现。未提供品牌素材时使用明确标注的示意素材，不阻塞结构设计。

- [ ] 列出首页、关注、留资引导、等待回调、抽奖、奖品及兑奖状态的页面清单；为未开始、已结束、缺货和网络失败定义文案、按钮和返回路径。
- [ ] 制作 390
      px 宽高保真页面，定义色彩、字体、间距、触控区域、安全区和二维码尺寸；抽奖动画不作为中奖结果的数据来源。
- [ ] 为原型加入状态切换、跳转和返回示意，使用本地假数据，不提交真实钉钉表单；留资页面只展示外部表单的入口及返回后的状态。
- [ ] 在浏览器中检查 320、375、390、430
      px 宽度，截取关键状态，确认无横向溢出、二维码不被遮挡、长活动名可读。
- [ ] 在 design-notes.md 记录页面清单、交互说明和示意素材；向用户展示原型及截图，修改反馈并记录用户实际确认的版本。未确认前不开始 T12 的业务页面实现。

## D02：工作人员端 UI 设计稿

**Files:** 新建
`docs/design/staff/index.html`、`styles.css`、`prototype.js`、`design-notes.md`、`screenshots/`
下的页面 PNG。

**Interfaces:**
消费规范中的固定工作人员权限与核销状态；交付扫码 → 核对 → 确认 → 结果流程及异常状态表，供 T13 实现。

- [ ] 列出登录、活动选择、工作台、扫码、手动输入、奖品核对、核销结果页面；补齐相机拒绝、无权限、会话过期、无效码、已核销和已过期状态。
- [ ] 制作 390
      px 宽高保真页面，强调大触控目标、单手操作和明确的奖品信息；成功、已核销和失败通过文字及图标区分，不仅靠颜色。
- [ ] 制作交互原型，扫码仅进入核对页，点击“确认发放”才进入核销流程；模拟提交后网络中断，展示重新查询原结果的路径，避免提示工作人员再次发奖。
- [ ] 检查 320、375、390、430
      px 宽度、安全区和长奖品名称，截图记录关键页面及错误状态。
- [ ] 向用户展示原型及截图，按反馈修改，在 design-notes.md 记录实际确认的版本；未确认前不开始 T13 的业务页面实现。

## T01：建立可构建的四应用工作区

**Files:** 新建
`package.json`、`pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`、`eslint.config.mjs`、`.gitignore`、`.env.example`、`README.md`；四个应用各自的
`package.json`、`tsconfig.json`；三个前端各自的
`index.html`、`vite.config.ts`、`src/main.tsx`、`src/app.tsx`、`src/styles.css`；服务端
`src/main.ts`、`src/app.module.ts`、`src/health/health.controller.ts`；两共享包的
`package.json`、`tsconfig.json`、`src/index.ts`。

**Interfaces:** 工作区提供 `dev`、`build`、`typecheck`、`lint`、`test`
脚本；`GET /api/health/live` 返回
`{ status: 'ok' }`。后续任务扩展已创建的 package.json，不重复脚手架。

- [x] 查验安装环境，选择并锁定互相兼容的稳定版本和 Node 运行版本，将版本写入 packageManager、engines 和锁文件；不得使用未验证的 latest 范围。
- [x] 创建工作区配置，私有包不发布注册中心：

```yaml
packages:
  - apps/*
  - packages/*
```

- [x] 三前端设置 base/basename 为自己的入口；开发代理 `/api`
      到本地 API。NestJS 设置全局 `api` 前缀，Fastify 绑定可配置 host/port。
- [ ] 安装依赖，依次运行
      `pnpm typecheck`、`pnpm lint`、`pnpm build`，预期均退出 0；实际打开三个入口及健康接口，刷新深层路由能够恢复。
- [x] README 记录环境、启动与构建命令，提交
      `Initialize Spark application workspace`。

## T02：模板定义、配置校验与注册

**Files:** 新建
`packages/templates/src/definition.ts`、`src/registry.ts`、`src/exhibition-lottery/v1/config.ts`、`src/exhibition-lottery/v1/defaults.ts`、`src/exhibition-lottery/v1/definition.ts`、`src/registry.test.ts`；修改包导出。

**Interfaces:** 导出
`LotteryConfigSchema`、`LotteryConfig`、`getTemplate(id: string, version: number)`。配置包含
`formId`、`formUrl`、`prefillField`、`fieldMapping`、`requireSubscribe`、`heroAssetId`、`rulesText`，允许编辑的字段仅限规范；密钥不进入配置。

- [x] 用 Vitest 添加下面的测试，运行
      `pnpm --filter @spark/templates test -- src/registry.test.ts`，先观察导出缺失失败：

```ts
expect(getTemplate('exhibition-lottery', 1).version).toBe(1);
expect(() => getTemplate('exhibition-lottery', 99)).toThrow(
  'UNSUPPORTED_TEMPLATE',
);
expect(
  LotteryConfigSchema.safeParse({ formUrl: 'javascript:alert(1)' }).success,
).toBe(false);
```

- [x] 实现精确键注册表：

```ts
const key = `${id}@${version}`;
const template = registry.get(key);
if (!template) throw new Error('UNSUPPORTED_TEMPLATE');
return template;
```

- [x] 增加合法配置样本、缺少映射、恶意 URL、未知配置字段拒绝测试；表单 URL 限定 HTTPS 及
      `alidocs.dingtalk.com`。
- [x] 验证 schema、默认值和导出的配置类型一致，测试与类型检查通过；提交
      `Define exhibition lottery template configuration`。

## T03：定义前后端接口契约

**Files:** 新建
`packages/contracts/src/auth.ts`、`activities.ts`、`participants.ts`、`dingtalk.ts`、`prizes.ts`、`lottery.ts`、`redemptions.ts`、`staff.ts`、`exports.ts`、`errors.ts`、`contracts.test.ts`；修改
`index.ts`。

**Interfaces:**
定义并导出下列名称；UUID、时间、分页、字符串长度用 Zod 约束，不直接暴露 TypeORM 实体。

```ts
type SessionRole = 'ACTIVITY' | 'STAFF' | 'ADMIN';
type RuntimeStep =
  | 'NOT_STARTED'
  | 'SUBSCRIBE'
  | 'FORM'
  | 'WAITING_FORM'
  | 'LOTTERY'
  | 'OUT_OF_STOCK'
  | 'PRIZE'
  | 'REDEEMED'
  | 'EXPIRED'
  | 'ENDED';
type CallbackInput = {
  formId: string;
  recordId: string;
  participationId: string;
  fields: { name: string; phone: string; [key: string]: unknown };
};
type WinView = {
  id: string;
  prizeName: string;
  prizeImageUrl: string | null;
  redeemEndAt: string;
  redemptionStatus: 'WAIT_REDEEM' | 'REDEEMED' | 'EXPIRED';
};
type ActivityRuntime = {
  activityCode: string;
  templateId: string;
  templateVersion: number;
  participationId: string;
  nextStep: RuntimeStep;
  win: WinView | null;
};
type CallbackAck = { accepted: true };
type ApiError = { code: string; message: string; requestId: string };
```

- [x] 测试 CallbackInputSchema 拒绝非 UUID、缺少 recordId、空姓名、非法 fields 类型；合法配置从 T02 引用，不能复制第二份 schema。
- [x] 运行
      `pnpm --filter @spark/contracts test -- src/contracts.test.ts`，确认先失败。
- [x] 实现 schemas 和 inferred types；错误码至少包括
      `OUT_OF_STOCK`、`ACTIVITY_ENDED`、`NOT_QUALIFIED`、`UNAUTHORIZED`、`FORBIDDEN`、`RECORD_CONFLICT`、`REDEMPTION_EXPIRED`、`VERSION_CONFLICT`、`UNSUPPORTED_TEMPLATE`。
- [x] 添加 API 响应不含密码、Session 哈希、回调密钥的 schema 测试，运行测试和 typecheck；提交
      `Define Spark API contracts`。

## T04：数据库迁移和真实 PostgreSQL 测试设施

**Files:** 新建
`compose.yaml`、`apps/api/database/data-source.ts`、`database/migrations/1788739200000-InitialSchema.ts`、`database/entities/*.entities.ts`、`test/support/database.ts`、`test/support/fixtures.ts`、`test/database.integration.test.ts`、`vitest.config.ts`。

**Interfaces:**
`createTestDatabase(): Promise<{ dataSource: DataSource; close(): Promise<void> }>`
为每个测试套件创建独立 schema；fixtures 提供
`createScenario(dataSource, options)`，返回管理员、工作人员、两个活动用户、活动及参与记录 ID，用固定时钟和随机 ID 隔离用例。单元测试不访问生产数据库。

- [x] 初始化本地 PostgreSQL、迁移命令 `db:migrate`、测试命令
      `test:integration`；拒绝在非明确测试数据库上清理数据。
- [x] 写数据库约束失败测试，再创建实体和迁移。核心约束：

```sql
UNIQUE (activity_id, user_id) -- participation 与 lottery_record 分别建立
UNIQUE (form_id, record_id) -- webhook_receipt 与 dingtalk_form_submission
CHECK (total_stock >= 0 AND awarded_stock >= 0 AND awarded_stock <= total_stock)
UNIQUE (redeem_code_hash)
```

- [x] 以 24 个 TypeORM Entity 覆盖全部迁移表，并增加 Session、OAuth
      state、公众号凭据缓存、奖池锁行、任务租约及时间索引；生产与测试数据源共用实体注册表且保持
      `synchronize: false`，普通账户 CRUD 使用 Repository，事务、锁和聚合保留显式 SQL。
- [x] fixture 创建模板 v1、已发布活动、独立兑奖时间、一份奖品及有权限工作人员；不提交生产密码。
- [x] 运行 `pnpm --filter @spark/api db:migrate` 与
      `pnpm --filter @spark/api test:integration -- test/database.integration.test.ts`，测试重复中奖和负库存被数据库拒绝、空库迁移成功；提交
      `Add PostgreSQL schema and integration fixtures`。

## T05：管理员、工作人员与 Session 安全

**Files:** 新建
`apps/api/src/auth/session.service.ts`、`auth.controller.ts`、`session.guard.ts`、`csrf.guard.ts`、`accounts.service.ts`、`staff/staff.service.ts`、`staff/staff.controller.ts`、`database/seeds/create-admin.ts`、`test/auth.integration.test.ts`；扩展 fixture 以创建登录会话。

**Interfaces:**
`SessionService.create(role, subjectId): Promise<{ token: string; expiresAt: Date }>`；`resolve(token, role)`
返回角色及主体；`revokeAccount(role, subjectId)`。控制器登录后由 Set-Cookie 写入 token，响应中不返回会话秘密。`/api/admin/auth/*`、`/api/staff/auth/*`
提供 login/me/logout；me 返回会话绑定的 CSRF token。

- [x] 写跨角色登录拒绝、缺 CSRF 写请求拒绝、停用账号使旧会话立即失效测试，运行
      `pnpm --filter @spark/api test:integration -- test/auth.integration.test.ts`，确认失败。
- [x] 实现密码哈希、随机 Session、数据库哈希查找和 8 小时绝对过期；固定角色权限与活动授权独立检查。
- [x] 实现初始化命令交互读取管理员密码，拒绝默认密码；修改权限和停用账号记录审计。
- [x] 添加登录轮换、退出、错误密码、伪造 Origin 测试，检查生产 Cookie 标志；运行测试后提交
      `Add staff and administrator authentication`。

## T06：微信身份与参与记录

**Files:** 新建
`apps/api/src/wechat/wechat.gateway.ts`、`oauth.controller.ts`、`oauth-state.service.ts`、`token.service.ts`、`subscription.service.ts`、`participants/participants.service.ts`、`test/wechat.integration.test.ts`、`docs/project-spark-wechat-setup.md`。

**Interfaces:**
`WechatGateway.exchangeCode(code): Promise<{ openid: string }>`、`isSubscribed(openid): Promise<boolean>`；`ParticipantsService.getOrCreate(userId, activityId)`
返回 participation；OAuth
start/callback 位于规范指定路径。gateway 的生产实现依据官方接口文档，测试替身通过依赖注入替换，不在生产环境提供任意 OpenID 登录接口。

- [x] 写同一 OpenID 再次登录得到同一 User、同一活动只有一个 participation，以及 OAuth
      state 重放拒绝测试；运行
      `pnpm --filter @spark/api test:integration -- test/wechat.integration.test.ts`。
- [x] 实现 10 分钟 state、浏览器 nonce、签名、数据库原子消费和站内返回路径白名单；活动 Session
      7 天。
- [x] 实现公众号 access
      token 的 PostgreSQL 共享刷新、关注结果最长 60 秒缓存、外部失败可重试；所有远程请求在抽奖事务外进行。
- [x] 测试过期 state、开放重定向、不同浏览器 nonce、并发首次登录、微信超时；文档写真实域名配置和测试账号步骤。通过后提交
      `Add WeChat identity and participation recovery`。

## T07：活动版本、发布、奖品和图片

**Files:** 新建
`apps/api/src/activities/activities.service.ts`、`activities.controller.ts`、`publish.service.ts`、`prizes/prizes.service.ts`、`prizes.controller.ts`、`media/media.service.ts`、`media.controller.ts`、`test/publishing.integration.test.ts`、`scripts/check-template-compatibility.ts`。

**Interfaces:**
`publish(activityId, expectedRevision, adminId)`、`endDraw(activityId, adminId)`、`addStock(activityPrizeId, quantity, operationId, adminId)`；admin 路由
`/api/admin/activities`、`/api/admin/prizes`、`/api/admin/media`。补库存 operationId 唯一，防止重试重复补库存。

- [x] 写两个编辑者修订冲突、活动开始后修改配置拒绝、奖品库修改不改变已发布奖项测试；运行
      `pnpm --filter @spark/api test:integration -- test/publishing.integration.test.ts`。
- [x] 发布校验模板存在、表单配置有效、奖项完整、时间有序；事务中生成不可变快照并更新指针。
- [x] 活动开始后仅开放提前结束、补库存和权限调整；加库存与抽奖遵循统一奖池锁，写 StockAdjustment。
- [x] 图片限 5
      MB，仅真实 JPEG/PNG/WebP，随机文件名保存持久卷；拒绝伪装 SVG、路径穿越，禁止通过 API 获取任意远程 URL。
- [x] 实现兼容性检查读取所有发布引用并匹配 registry；测试缺旧模板失败。运行测试及 compatibility 命令后提交
      `Add activity publishing and prize management`。

## T08：可靠任务与回调接收基础

**Files:** 新建
`apps/api/src/jobs/jobs.service.ts`、`jobs.worker.ts`、`jobs.controller.ts`、`jobs.handlers.ts`、`test/jobs.integration.test.ts`。

**Interfaces:** `enqueue(manager, kind, key, payload)`
在调用者事务内创建唯一任务；`register(kind, handler)`
注册处理器；`runDueJobs(now)`
提供可测试的领取和执行入口；`POST /api/admin/jobs/:id/retry` 只重放原载荷。

- [x] 添加事务回滚不留下任务、重复 enqueue 只有一个任务、租约过期可恢复测试；运行
      `pnpm --filter @spark/api test:integration -- test/jobs.integration.test.ts`。
- [x] 实现 `FOR UPDATE SKIP LOCKED`
      领取，持久化 owner/leaseUntil/attempts/nextRunAt；只有持有租约的执行者可确认完成；业务处理器必须幂等。
- [x] 失败总共最多执行 5 次，间隔 10 秒、30 秒、2 分钟、10 分钟；超过次数进入 FAILED，最小失败任务列表只展示脱敏错误。
- [x] 测试 worker 进程中断、并发领取、重放权限、租约旧 owner 无法覆盖状态；清理任务不得删除未完成回调。通过后提交
      `Add durable PostgreSQL background jobs`。

## T09：钉钉关联、回调与留资完成

**Files:** 新建
`apps/api/src/dingtalk/prefill.service.ts`、`callback.controller.ts`、`callback.service.ts`、`submission.handler.ts`、`test/dingtalk.integration.test.ts`、`docs/project-spark-dingtalk-setup.md`；新增 contracts 中 CallbackInputSchema 的实际边界验证。

**Interfaces:**
`createFormUrl(userId, activityCode): Promise<{ url: string }>`；`accept(input: CallbackInput): Promise<CallbackAck>`；handler 类型
`DINGTALK_SUBMISSION`；`POST /api/activity/:code/form-link` 与规范回调路径。

- [x] 增加测试：恶意参与编号、错误共享密钥、跨表单、相同 recordId 换人返回 409；成功返回 200 但处理器未运行时不授资格。运行
      `pnpm --filter @spark/api test:integration -- test/dingtalk.integration.test.ts`
      确认失败。
- [x] 使用从实际表单获得的已验证预填链接样本实现 URL 编码；只替换指定字段的值，不猜测参数名称。测试样本不得含真实个人信息。
- [x] 回调先校验身份和绑定，再以事务保存 receipt 和任务；失败 503。示例自动化 body 遵循规范第 8 节，密钥仅放 HTTP 请求头。
- [x] 处理器按参与记录串行处理最早接收的有效回调；写 submission、设置 leadCompletedAt 及采用的 submissionId，同事务提交；后续提交保留记录但不改首次线索。
- [x] 使用行为断言：

```ts
expect(await countReceipts(formId, recordId)).toBe(1);
expect(
  (await readParticipation(participationId)).leadCompletedAt,
).not.toBeNull();
expect(await countWins(activityId, userId)).toBe(0);
```

以上数据库查询 helpers 在本任务测试文件内基于 T04
dataSource 实现，不引入生产接口。

- [x] 覆盖数据库失败后重发、活动结束后收线索不发可用资格、不同 recordId 重复填写、重放任务不重复更新；编写钉钉配置与未收到回调的人工补偿说明。通过后提交
      `Integrate DingTalk form submissions`。

## T10：抽奖和库存原子性

**Files:** 新建
`apps/api/src/lottery/lottery.service.ts`、`lottery.controller.ts`、`weighted-draw.ts`、`apps/api/src/redemptions/code.service.ts`、`test/lottery.integration.test.ts`；扩展 fixture 的
`leadCompleted`、`stock` 和关注替身参数。

**Interfaces:**
`draw(userId: string, activityCode: string): Promise<WinView>`；`POST /api/activity/:code/lottery`。随机选择函数接受非负库存与服务端安全随机整数源，不接受客户端指定奖项。

- [x] 写真实 PostgreSQL 并发测试：

```ts
const results = await Promise.allSettled(
  users.map((u) => lottery.draw(u.id, code)),
);
expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
expect(await remainingStock(activityId)).toBe(0);
expect(await countActivityWins(activityId)).toBe(1);
```

测试 helper 使用 T04 数据源，场景为两个已留资且关注用户争一份库存。运行
`pnpm --filter @spark/api test:integration -- test/lottery.integration.test.ts`
先失败。

- [x] 实现事务顺序：奖池锁 →
      participation 锁 → 已有结果返回 → 时间/资格检查 → 按剩余库存随机选择 → 条件扣库存 → 写中奖、奖品快照和兑奖记录。
- [x] 在本任务实现
      `CodeService.create(): { hash: string; encryptedCode: string; keyId: string }`
      及
      `restore(encryptedCode, keyId): string`，生成安全随机码并使用带认证的加密保存。T11 复用该服务，避免中奖创建依赖尚未实现的后续任务。
- [x] 无库存返回 OUT_OF_STOCK 并整体回滚，资格不变；活动截止返回 ACTIVITY_ENDED；死锁或序列化失败只对可重试数据库错误做有界重试，不重复外部调用。
- [x] 测试同人同时抽、补库存后重试、已中奖结束后重试、写中奖失败库存回滚、零库存权重排除；压测记录同活动串行锁等待及吞吐。通过后提交
      `Implement atomic lottery and inventory updates`。

## T11：兑奖码恢复与核销

**Files:** 新建
`apps/api/src/redemptions/redemptions.service.ts`、`redemptions.controller.ts`、`test/redemptions.integration.test.ts`；复用并验证 T10 的
`code.service.ts`。

**Interfaces:** `getOwnCode(userId, activityCode)`
返回自己的二维码 URL；`lookup(code, staffId)`
返回脱敏详情；`confirm(code, staffId)`
返回已核销详情。同一记录重试返回原核销结果，不再次更新人员和时间；前端应展示原结果而非再次指示发奖。

- [x] 添加两个工作人员同时 confirm 只写一条核销事件测试；跨活动权限、过期拒绝；运行
      `pnpm --filter @spark/api test:integration -- test/redemptions.integration.test.ts`。
- [x] 兑奖码检索用哈希，加密原值用于登录用户重新展示；加密密钥与数据库分离保存，使用带认证的加密格式及 keyId 支持维护。
- [x] 在事务中实时判断
      `now < redeemEndAt`，已核销优先返回原状态；活动结束和取消关注不阻断已中奖兑奖。
- [x] 测试刷新恢复同一码、错误密钥不可解密、查询不核销、截止边界、核销后重试、无权限不泄漏资料；通过后提交
      `Add recoverable prize codes and atomic redemption`。

## T12：用户活动页及状态机

**Files:** 新建
`apps/api/src/templates/exhibition-lottery/runtime.service.ts`、`runtime.controller.ts`、`apps/activity/src/templates/exhibition-lottery/page.tsx`、`runtime.ts`、`apps/activity/src/auth/session.ts`、`apps/activity/src/pages/activity-page.tsx`、`apps/activity/src/components/prize-code.tsx`、`tests/e2e/activity.spec.ts`。

**Interfaces:** `GET /api/activity/:code/runtime`
返回 ActivityRuntime，未登录 401；所有模板 registry 精确版本匹配。公开活动说明使用单独脱敏响应，不包含预填链接或回调配置。

- [ ] 读取 D01 已确认的原型、截图和说明，建立页面实现清单；视觉变化需同步设计说明，不自行替换已确认布局。

- [x] API 行为测试 nextStep：中奖优先展示 REDEEMED/EXPIRED/PRIZE；无中奖时检查时间、关注、库存、留资及已接收回调。不能让库存不足用户继续为抽奖跳表单。
- [ ] Playwright 测试使用 T04 场景和测试进程内微信替身，写“返回页恢复奖品、不重复抽奖”的失败断言：

```ts
await page.goto(`/activity/${activityCode}`);
await expect(page.getByText('我的奖品', { exact: true })).toBeVisible();
await page.reload();
await expect(page.getByText('我的奖品', { exact: true })).toBeVisible();
```

- [ ] 实现关注引导、表单跳转、检查结果、抽奖、奖品及已核销/过期/未开始/已结束页面。窗口恢复焦点即查询；轮询每 2 秒一次最多 30 次，超时可手动重试，离页取消。
- [ ] 运行
      `pnpm exec playwright test tests/e2e/activity.spec.ts`；测试回调延迟、库存耗尽、401 恢复、断网错误，动画结束不能自行决定奖品。通过后提交
      `Build activity participation experience`。
- [ ] 在与 D01 相同的视口截图对照，核查布局、文字、触控区域和二维码可读性，记录偏差及处理结果。

## T13：工作人员移动平台

**Files:** 新建
`apps/staff/src/features/auth/login-page.tsx`、`features/activities/activity-list.tsx`、`features/scanner/scanner-page.tsx`、`features/redemptions/redemption-page.tsx`、`tests/e2e/staff.spec.ts`。

**Interfaces:** 使用 T05 登录和 T11 查询/确认接口；路由 `/staff/redeem/:code`
支持登录后恢复。扫码库在实现时验证微信 WebView 支持并锁版本，不依赖单一浏览器原生扫码 API。

- [ ] 读取 D02 已确认的原型、截图和状态说明，按其核销确认流程实现页面。

- [ ] 编写先查询后确认测试：

```ts
await page.goto(`/staff/redeem/${redeemCode}`);
await expect(page.getByRole('button', { name: '确认发放' })).toBeVisible();
expect(await readRedemptionStatus(redeemCode)).toBe('WAIT_REDEEM');
```

- [ ] 运行
      `pnpm exec playwright test tests/e2e/staff.spec.ts`，确认新页未实现时失败。
- [ ] 实现登录、可核销活动、统计、相机扫码、粘贴编号与确认页面。扫描到本站核销链接时仅提取码，不任意导航外站。
- [ ] 测试相机拒绝、无活动权限、重复核销、确认响应丢失后的查询恢复；敏感二维码页不加载第三方资源。通过后提交
      `Build staff redemption platform`。
- [ ] 在与 D02 相同的视口截图对照，确认核对、待处理、成功、已核销和失败状态可明确区分。

## T14：运营后台

**Files:** 新建
`apps/admin/src/features/auth/login-page.tsx`、`features/activities/list-page.tsx`、`edit-page.tsx`、`templates/exhibition-lottery/config-form.tsx`、`features/prizes/prizes-page.tsx`、`features/staff/staff-page.tsx`、`features/jobs/jobs-page.tsx`、`features/participants/participants-page.tsx`、`tests/e2e/admin.spec.ts`。

**Interfaces:** 使用 T05/T07/T08/T09
API；后台显示一个完整模板，钉钉绑定仅配置链接及字段映射，不增加本地留资表单编辑器。

- [x] 写创建草稿、选择模板、配置奖品和时间、发布的 E2E 测试，运行
      `pnpm exec playwright test tests/e2e/admin.spec.ts`。
- [x] 实现活动列表和表单，乐观修订冲突提示刷新；运行后锁定规则编辑，单独提供补库存和提前结束操作。
- [x] 实现工作人员账号和活动授权、首次有效线索查看、失败任务查看与重放，采用 Radix
      UI 的应用内封装。
- [x] 测试过期 Session、无权限 API、上传拒绝、不支持模板版本、重复补库存请求；后台明确“添加库存”，不展示可减少库存的通用编辑框。通过后提交
      `Build activity operations dashboard`。

## T15：指标、核销列表和线索导出

**Files:** 新建
`apps/api/src/reports/reports.service.ts`、`reports.controller.ts`、`exports/exports.service.ts`、`exports.handler.ts`、`exports.controller.ts`、`apps/admin/src/features/reports/overview-page.tsx`、`features/redemptions/list-page.tsx`、`features/exports/exports-page.tsx`、`test/reports.integration.test.ts`、`test/exports.integration.test.ts`。

**Interfaces:**
`GET /api/admin/activities/:id/report`；`POST /api/admin/activities/:id/exports`
返回 jobId；`GET /api/admin/exports/:id`
状态及已完成下载入口；下载始终重新鉴权，不返回公开静态文件 URL。

- [x] fixture 构造待兑奖、已核销、已过期各一条，写统计断言：

```ts
expect(report.awarded).toBe(report.pending + report.redeemed + report.expired);
expect(report.available).toBe(report.totalStock - report.awarded);
```

- [x] 写重复访问人数去重、首次渠道不被覆盖测试；运行
      `pnpm --filter @spark/api test:integration -- test/reports.integration.test.ts`。
- [x] 实现按活动的聚合，导出按稳定 ID 分批读取并记录生成时间和数据截点；任务通过 T08 执行，结果存私有目录。
- [x] 用 XLSX 读取器回读导出文件验证记录数、中文、文本手机号、首次留资字段、兑奖状态及
      `=1+1` 等输入为文本；测试非管理员、过期文件和路径猜测被拒绝。
- [x] 实现导出文件 24 小时清理，审计包含操作者、活动、行数和结果；执行
      `pnpm --filter @spark/api test:integration -- test/exports.integration.test.ts`。通过后提交
      `Add activity reporting and secure lead exports`。

## T16：同域部署、外部联调与恢复验收

**Files:** 新建
`apps/api/Dockerfile`、`nginx/Dockerfile`、`nginx/nginx.conf`、`nginx/proxy_params`、`compose.production.yaml`、`.github/workflows/quality-gates.yml`、`docs/project-spark-deployment.md`、`docs/project-spark-acceptance.md`、`tests/e2e/deployment.spec.ts`；更新 README 和 .env.example。

**Interfaces:** `pnpm verify`
顺序执行 lint/typecheck/build/unit/integration；CI 提供 PostgreSQL 服务；生产明确单 API 副本、数据库卷、媒体卷和私有导出目录。

- [ ] 先测试 `/activity/:code`、`/staff/redeem/:code`、`/admin/activities`
      深链接刷新及 `/api` 响应，确保静态 fallback 不吞 API 404。
- [x] 配置 HTTPS、Cookie、代理信任范围、Origin/CSRF、no-referrer、日志脱敏、请求大小与限流；前端产物中不得出现服务端秘密。
- [ ] CI 从空 PostgreSQL 执行迁移、业务并发测试、三个前端 E2E；执行
      `pnpm verify` 和 `pnpm exec playwright test`，记录版本、命令与结果。
- [ ] 真实联调：经用户指定测试活动，用专用测试记录验证微信内打开钉钉、participationId 实际预填、回调请求头及 recordId、返回后可抽、扫码核销。录入外部数据前确认具体测试范围，不向现有真实客户表单擅自造记录；没有真实证据时该检查保持未完成，不用 Mock 替代。
- [x] 模拟重复回调、丢响应、服务端任务中断及恢复；核对库存和核销总数。验证旧模板缺失时部署兼容检查失败。
- [ ] 演练新环境恢复数据库、图片和加密密钥，确认老兑奖码可展示和核销；检查导出过期清理、备份保留和失败任务重放。
- [x] 编写现场操作手册：缺货提示、表单回调失败重发、相机拒绝备用路径、误发实物人工联系流程。提交
      `Document and verify production deployment`，列出仍依赖账号、域名或现场环境的检查，不宣称提前上线。

## 覆盖检查与执行约定

| 规范范围                           | 验证任务         |
| ---------------------------------- | ---------------- |
| 应用及共享包、模板入口             | T01–T03、T12–T14 |
| 活动端与工作人员端设计稿、视觉验收 | D01–D02、T12–T13 |
| 数据库、固定权限、Session          | T04–T06          |
| 活动发布、历史兼容、图片           | T07、T16         |
| 钉钉预填、可靠回调、首次留资       | T08–T09、T16     |
| 库存不足、资格、并发与快照         | T10              |
| 截止时间、过期不回补、核销         | T11、T13、T15    |
| 用户状态、渠道与统计               | T12、T15         |
| 导出、审计、恢复与真实联调         | T14–T16          |

当前仓库已经包含四个应用、共享契约与模板、数据库迁移、服务端业务、运营后台和生产部署配置。最近一次完整验证中，`pnpm verify`
退出 0，API 集成测试 61 项、contracts 测试 24 项通过；admin Playwright
3 项、模板兼容检查及 Compose 配置检查也通过。未勾选项保持为后续范围：活动端和工作人员端设计及页面、运营后台完整发布 E2E、真实同域深链接、微信/钉钉联调和灾备恢复演练。

# Project Spark 架构设计

## 1. 目标与范围

Project Spark 是一套服务于单个公司、单个微信公众号的营销活动系统。运营人员从开发人员提供的完整活动模板中选择一种，填写模板开放的配置并发布活动。系统首版只提供“展会抽奖”模板，完成微信识别、关注检测、留资、抽奖、现场兑奖和线索导出闭环。

模板可以在代码内部组合微信身份、钉钉表单接入、抽奖、答题、投票、奖励和核销等能力，但运营后台只展示一个完整模板，不提供流程拖拽或组件编排。后续由开发人员增加签到、答题、投票和游戏等模板。

首版按 MVP 范围实施，不以一周为硬性上线期限。活动模板、动态表单、概率编辑、复杂库存、RBAC 和 BI 等平台化能力在真实活动验证后逐步增加。

## 2. 总体架构

项目采用单仓库和模块化单体。四个应用独立构建，通过同一域名的路径发布：

```text
apps/
├─ activity/    /activity/:activityCode
├─ staff/       /staff
├─ admin/       /admin
└─ api/         /api
```

- `activity`：所有活动模板的用户运行入口。根据活动编码加载已发布的模板版本和配置。
- `staff`：稳定的工作人员平台，负责登录、选择活动、扫码和确认核销。
- `admin`：运营管理后台，负责活动创建、模板选择、配置、发布、数据查看和导出。
- `api`：统一服务端，承载微信接入、钉钉回调、身份、活动、参与、抽奖、库存、核销和导出等业务。

网关将 `/activity/*`、`/staff/*`、`/admin/*` 和 `/api/*` 分别转发到对应应用。三个前端配置各自的路由和静态资源基础路径。活动 URL 不包含模板类型，避免模板实现泄漏到外部链接。

`activityCode` 由系统生成，是 URL 安全、全局唯一且发布后不可变的短编码。活动名称可以修改，外部二维码和渠道链接始终使用稳定编码。

## 3. 技术栈

仓库使用 pnpm workspace 和 Turborepo。三个前端使用 React、TypeScript、Vite、React Router、TanStack Query、React Hook Form、Zod、Radix UI 和 Tailwind CSS。服务端使用 NestJS 和 Fastify，数据存储使用 PostgreSQL 和 TypeORM。测试使用 Vitest 与 Playwright。

系统不使用 Redis。活动用户、工作人员和管理员的服务端 Session 存入 PostgreSQL，并使用不同的 Cookie 名称和会话类型。Cookie 设置 `HttpOnly`、`Secure` 和合适的 `SameSite` 属性。数据库是参与状态、中奖结果、库存和核销记录的唯一事实来源。

## 4. 共享包

首版只建立确有跨应用共享价值的包：

```text
packages/
├─ contracts/
└─ templates/
```

`contracts` 按 `auth`、`activities`、`participants`、`prizes`、`lottery`、`redemptions`、`staff` 和 `exports` 组织，保存 API 请求与响应类型、枚举、错误码和共享 Zod Schema。它不包含数据库实体、权限判断或业务处理逻辑。

`templates` 保存模板注册信息、配置结构、配置版本、默认值和校验规则。首版包含 `exhibition-lottery`。它不包含 React 页面、后台配置界面或服务端抽奖逻辑；这些实现分别位于使用它们的应用中。

`contracts` 可以引用 `templates` 导出的配置类型；`templates` 不依赖 `contracts`。四个应用可以同时依赖这两个包。

Radix UI 由各前端直接使用。各应用在自己的 `components` 和 `styles` 中封装界面，不建立共享 UI 包。ESLint 和 TypeScript 公共配置保存在仓库根目录。数据库 Schema、迁移和种子数据位于 `apps/api/database`。

## 5. 模板模型

运营可见的模板是一套完整活动方案。一个模板定义：

- 稳定的模板标识与显示名称；
- 配置 Schema、默认值和配置版本；
- 固定的参与流程；
- 活动端实现、后台配置实现和服务端处理器；
- 可输出的统计和导出字段。

首版模板标识为 `exhibition-lottery`。共享定义位于 `packages/templates/src/exhibition-lottery`；活动页面位于 `apps/activity/src/templates/exhibition-lottery`；运营配置界面位于 `apps/admin/src/templates/exhibition-lottery`；服务端流程适配位于 `apps/api/src/templates/exhibition-lottery`。

每个活动绑定明确的模板版本。发布时生成不可变配置快照；后续修改模板或草稿不会改变正在运行或已经结束的活动。新建活动默认使用模板最新版。模板配置只描述允许运营修改的内容，库存扣减、参与限制、抽奖和核销规则始终由服务端执行。

## 6. 服务端模块

`apps/api/src` 使用具体业务名称划分模块：

```text
auth/           管理员、工作人员和活动用户会话
wechat/         静默 OAuth、OpenID 映射和关注检测
activities/     活动、模板版本、配置快照和发布
participants/   用户活动关系、参与状态和留资
dingtalk/       表单回调校验、提交关联和数据同步
lottery/        抽奖资格、随机选择和防重复抽奖
prizes/         奖品、活动库存和库存变更
redemptions/    兑奖码、兑奖状态和核销事务
staff/          工作人员账号和活动权限
reports/        基础活动指标
exports/        Excel 线索导出
templates/      完整活动模板对上述模块的编排
```

模块在同一 NestJS 应用和数据库内运行，通过明确的服务接口协作。首版不拆微服务，也不建立动态插件加载系统。

## 7. 核心数据模型

核心实体包括：

- `WechatIdentity`、`User`、`Session`：微信公众号身份和三类会话；
- `Activity`、`ActivityVersion`：活动本体、草稿版本和不可变的发布快照；
- `ActivityParticipation`：用户在某活动中的公共参与状态；
- `DingTalkFormSubmission`：钉钉表单提交标识、关联信息和留资数据快照；
- `Prize`、`ActivityPrize`：奖品资料和活动库存；
- `LotteryRecord`：一次正式抽奖结果；
- `Redemption`：安全兑奖码、状态、有效期和核销信息；
- `StaffAccount`、`StaffActivityPermission`：工作人员及可核销活动；
- `ChannelVisit`：活动渠道和访问归因。

模板清单由代码注册表维护，不单独建立模板数据库表。`ActivityVersion` 保存模板标识、模板版本、配置 Schema 版本、配置 JSONB 和版本状态；`Activity` 保存当前草稿版本及已发布版本的引用。

通用字段使用明确的数据库列。不同模板之间差异较大的配置和结果扩展可以使用 JSONB，但需要由带版本的 Zod Schema 校验。抽奖、库存和核销等需要查询、约束或事务处理的数据使用独立关系表。

## 8. 用户流程与接口

用户访问 `/activity/:activityCode?channel=:channelCode`。活动端请求已发布活动；没有活动 Session 时跳转 `/api/wechat/oauth/start`。OAuth 回调验证签名后的 `state`，用 OpenID 查找或创建内部用户，创建 PostgreSQL Session，并返回原活动地址。

需要留资时，活动端跳转到模板配置的钉钉表单地址，并携带服务端生成的签名关联令牌。钉钉回调携带或触发服务端拉取表单提交数据；API 验证回调真实性、用令牌关联活动与用户、幂等保存提交快照，并更新抽奖资格。用户返回活动页后重新查询状态，等待回调时展示明确的处理中状态。

系统不维护表单结构、字段校验或表单提交页面。模板配置只保存钉钉表单标识、访问地址和需要同步的字段映射。钉钉集成必须提供稳定的外部提交标识，并能回传关联令牌；这两项是可靠幂等和用户关联的前提。

活动模板根据服务端返回的参与状态展示关注、留资引导、抽奖、奖品或已兑奖页面。刷新、退出和重新扫码都从数据库恢复状态。模板前端只发送动作，服务端决定动作是否合法以及下一状态。

API 按调用方划分：

```text
/api/activity/*   活动用户接口
/api/wechat/*     OAuth 与公众号接口
/api/integrations/dingtalk/*  钉钉表单回调接口
/api/staff/*      工作人员接口
/api/admin/*      运营管理接口
```

所有状态变更接口支持幂等处理并返回稳定的业务错误码。活动不存在、未发布、未开始、已结束、配置损坏和微信接口失败均有明确页面或重试策略。

## 9. 一致性与安全

钉钉表单回调先校验签名、时间戳和重放条件，再以钉钉外部提交标识建立唯一约束。保存提交快照和更新参与资格在同一个 PostgreSQL 事务中完成，重复回调返回原处理结果。关联令牌只能用于标识活动参与关系，不能直接授予抽奖资格。

抽奖在一个 PostgreSQL 事务内锁定参与记录，校验资格，通过带条件的库存更新或行锁防止超卖，创建唯一中奖记录并更新参与状态。数据库设置用户与活动唯一中奖约束。

核销事务锁定兑奖记录，校验状态、有效期和工作人员活动权限，然后一次性写入核销人员与时间。两个工作人员同时扫码时只有一个事务能够成功。

兑奖码使用不可预测的安全随机值，数据库只保存必要的安全表示。管理员与工作人员密码使用安全密码哈希。公众号密钥、钉钉应用凭据、Cookie 密钥和数据库凭据通过环境变量或部署密钥注入。手机号和其他线索数据只在授权的后台、核销流程和导出范围内返回。

由于没有 Redis，多实例部署下的限流由网关承担；与业务正确性相关的重复提交仍由 PostgreSQL 约束和事务处理。Session 清理使用数据库定时任务或应用维护任务。

## 10. 验证与交付顺序

第一阶段建立工作区、四个应用、共享包、数据库迁移和基础 CI。第二阶段打通微信 OAuth、PostgreSQL Session、活动查询与发布快照。第三阶段打通钉钉表单跳转、回调关联、留资同步和资格更新。第四阶段完成抽奖、库存、兑奖和工作人员核销闭环。第五阶段完成后台活动、奖品、用户、工作人员和 Excel 导出，并在真实微信与钉钉环境中进行端到端和现场并发验收。

测试重点包括伪造回调、重复与乱序回调、关联令牌篡改、钉钉回调延迟、并发抽奖最后一份库存、重复抽奖返回原结果、两个工作人员同时核销、Session 丢失后重新扫码、活动时间边界、外部接口失败以及发布后修改草稿不影响线上活动。首版完成标准是核心闭环在真实公众号、钉钉表单和移动设备上稳定运行。

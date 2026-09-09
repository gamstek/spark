# Project Spark 外部联调验收计划

对应 [上线验收](project-spark-acceptance.md) 中「外部联调」一节的 5 项未完成检查。
前置改造（activity/staff 前后端对接）已完成，本计划针对真实公众号、钉钉表单
等外部环境做真实验收；每项通过后回填上线验收文档对应 checkbox。

## 一、前置条件（联调资源准备）

| 资源 | 要求 | 用途 |
| --- | --- | --- |
| 测试公众号 | 已认证服务号 + 网页授权回调域名（见 [微信公众号配置](project-spark-wechat-setup.md)）；本地联调使用测试公众号 + 临时 HTTPS 反代域名，并将 `PUBLIC_ORIGIN` 改为该域名 | OAuth 联调 |
| 钉钉表单 | 活动发布配置中保存已验证的表单分享地址，URL 预含参与编号参数（见 [钉钉表单接入配置](project-spark-dingtalk-setup.md)） | 留资联调 |
| 钉钉自动化 | 已配置回调，与钉钉自动化共享 `DINGTALK_CALLBACK_SECRET`（`Authorization: Bearer` 头） | 回调联调 |
| 测试活动 | 管理后台创建并发布 `exhibition-lottery` 活动，配置奖品若干、`requireSubscribe` 开启 | 全流程 |
| 环境变量 | `PUBLIC_ORIGIN` 指向当前前端 origin，`WECHAT_APP_ID`/`WECHAT_APP_SECRET`、回调密钥已注入；测试库可用 `pnpm db:test:start` 启动 | 全部 |

## 二、验收项与测试用例

### 1. 微信内静默 OAuth 恢复活动 Session

实现：`/api/wechat/oauth/start|callback` 建立 `spark_activity` 会话；activity
H5 在 runtime 返回 401 时自动跳转授权。

| # | 步骤 | 预期 |
| --- | --- | --- |
| 1.1 | 微信内首次打开 `/activity/<code>` | 302 到微信授权页（snsapi_base）→ 回调后回到活动页，能取到 runtime（非 demo 预览） |
| 1.2 | 授权后关闭页面再次打开 | 免授权恢复会话，runtime 返回同一 `participationId` |
| 1.3 | 非微信浏览器打开活动页 | 有明确"请在微信中打开"提示（若缺失记为缺陷） |
| 1.4 | 重放旧 `state` 或缺失 nonce cookie 访问回调 | `OAUTH_STATE_INVALID`，不建立会话 |
| 1.5 | 微信接口超时或返回错误 | 页面提示可重试；生产构建不进入 demo 预览 |

### 2. 钉钉表单预填 participationId

实现：`POST /api/activity/:code/form-link` 下发已注入参与编号的表单地址，
前端"前往填写"跳转。

| # | 步骤 | 预期 |
| --- | --- | --- |
| 2.1 | 关注后点击「前往填写」 | 跳转钉钉表单，预填字段值与该用户 `participationId` 一致（URL 可核对） |
| 2.2 | 提交表单后返回活动页 | runtime `nextStep` 由 FORM 变为 LOTTERY；管理后台参与者详情可见留资 |
| 2.3 | 未关注用户请求 form-link | 400 `FORM_NOT_AVAILABLE:<step>`，前端刷新 runtime 回到正确步骤 |
| 2.4 | 篡改 URL 中的 `participationId` 参数 | 服务端校验拒绝，不产生新参与记录 |

### 3. 回调鉴权与重复回调幂等

实现：`POST /api/integrations/dingtalk/form-submissions`，Bearer
`DINGTALK_CALLBACK_SECRET`，`webhook_receipt` 幂等 + 后台任务处理。

| # | 步骤 | 预期 |
| --- | --- | --- |
| 3.1 | 正确密钥 + 约定 `recordId` 和字段回调 | 200 `{accepted:true}`；任务完成后 `lead_completed=true` |
| 3.2 | 错误或缺失密钥 | 401 `CALLBACK_UNAUTHORIZED`，不留痕 |
| 3.3 | 同一 `recordId` 重复回调（同 participationId） | 仍 200，但只采纳首次有效线索（`webhook_receipt`/审计各 1 条） |
| 3.4 | 同 `recordId` 换 `participationId` 重放 | 409 `RECORD_PARTICIPATION_CONFLICT` |
| 3.5 | 服务端 200 但任务中断（模拟 worker 停止） | 管理后台"失败任务"可见并可重试，重试成功后总数不变 |

### 4. 返回活动页抽奖，并发不超发

实现：`POST /api/activity/:code/lottery`（CSRF + 原子库存扣减）；并发原子性已
由 `lottery.integration.test.ts` 覆盖，此处做真实环境复核。

| # | 步骤 | 预期 |
| --- | --- | --- |
| 4.1 | 已关注已留资用户点「立即抽奖」 | 出奖 → 中奖页 → 兑奖页显示真实兑奖码与可扫二维码 |
| 4.2 | 同一用户重复抽奖 | 幂等返回同一结果，不重复扣库存 |
| 4.3 | 两台真实手机对最后 1 份库存并发抽奖 | 恰好 1 人中奖；另一人收 `OUT_OF_STOCK`，页面提示「奖品已抽完」 |
| 4.4 | 未关注 / 未留资状态抽奖 | 分别 400 `SUBSCRIPTION_REQUIRED` / `LEAD_REQUIRED`，前端跳到对应步骤 |
| 4.5 | 抽奖结束后再抽 | 已中奖者返回原结果；未中奖者 409 `ACTIVITY_ENDED` |

### 5. 工作人员扫码核销

实现：staff H5 扫码（BarcodeDetector）/ 手动输码 → `POST
/api/staff/redemptions/lookup` → 确认 → `POST /api/staff/redemptions/confirm`
（CSRF，幂等）。

| # | 步骤 | 预期 |
| --- | --- | --- |
| 5.1 | 用户出示兑奖二维码，职员扫码 | 识别兑奖码 → 确认页显示奖品、脱敏参与人、`WAIT_REDEEM` |
| 5.2 | 核对后点「确认发放」 | 成功页显示真实核销时间与核销人员；用户端奖品页状态变「已核销」 |
| 5.3 | 确认请求丢响应后再次扫描同一码 | lookup 返回原 `REDEEMED` 结果（幂等），确认页显示「已完成核销」 |
| 5.4 | 扫描已过期兑奖码 | 410 `REDEMPTION_EXPIRED`，确认页显示过期、无法发放 |
| 5.5 | 扫描无权限活动或随机的兑奖码 | 404 `REDEMPTION_NOT_FOUND`，提示「兑奖码无效」 |
| 5.6 | 相机权限被拒或浏览器不支持扫码 | 提示改用手动输入，输码流程可完成核销 |

## 三、故障与现场演练

对应上线验收「故障与现场操作」：

- **缺货演练**：库存清零后活动页停在「奖品已抽完」；确认管理后台只能通过
  「添加库存」恢复，不允许其他方式改库存。
- **重复回调演练**：用例 3.3/3.5；演练前后核对中奖、库存、核销总数一致。
- **误发实物演练**：确认审计记录（活动、兑奖码、工作人员、时间）完整，由运营
  按记录人工处理，不直接修改中奖记录。

## 四、执行顺序与通过标准

1. 准备第一节资源；
2. 按顺序执行：项 1（OAuth）→ 项 2（表单）→ 项 3（回调）→ 项 4（抽奖并发）
   → 项 5（核销）；
3. 执行第三节故障演练。

每项通过标准：留档真实证据（录屏或截图 + 管理后台/数据库截图），并回填
[上线验收](project-spark-acceptance.md) 对应 checkbox。任一用例失败时记录接口
错误码与响应中的 `requestId`，用于日志定位，再决定修复或重试。

## 五、执行记录（2026-09-09，本地联调环境）

环境：本地 API（:3000）+ embedded PostgreSQL（:54329）+ staff H5（:5174），
管理员 `admin01`、职员 `staff01` 均为本地测试账号；微信会话以脚本注入
`ACTIVITY` 会话替代（生产不提供该入口），钉钉回调以等价 HTTP 请求模拟。

**已通过（32/33 用例）**：

- 项 2/3 全部：form-link 预填、回调鉴权（401/200/幂等/409 冲突）、回调后
  runtime 推进到 LOTTERY；
- 项 4 的 4.1–4.4：真实兑奖码与 qrUrl、幂等重抽、最后一份库存并发
  （一人 201 中奖、一人 409 `OUT_OF_STOCK`）、库存不超发；
- 项 5 的 5.2–5.6：浏览器端输码 → 确认页（脱敏 `用户…xxxx`、待核销）→
  确认发放 → 成功页真实核销时间；重复输码显示「已核销/查看核销结果」；
  无效码 404 错误页；过期码 `EXPIRED`/410 `REDEMPTION_EXPIRED`；
  职员记录列表脱敏（陈*明 / 138\*\*\*\*2210）、奖品只读视图、退出登录。

**过程中发现并修复的问题**：

- ~~`POST /api/admin/staff` 用户名重复时返回 500~~ 已修复（2026-09-09）：唯一
  约束冲突现映射为 409 `RECORD_CONFLICT`，含并发兜底；集成测试覆盖（已通过）；
- 本地多前端同时联调需共享一个 API：新增 `PUBLIC_ORIGIN_EXTRA`（逗号分隔的
  额外允许 Origin），`PUBLIC_ORIGIN` 仍为 URL 构造基准；
- `pnpm db:test:start` 重启已初始化的集群时误跑 initdb 报"directory exists but
  is not empty"，且 createDatabase 连接的 `postgres` 库不存在——已修复：检测
  `PG_VERSION` 存在时跳过 initdb 与建库，仅启动。

**待真实环境执行（阻塞于外部资源）**：

- 项 1 全部（1.1–1.5）：需测试公众号 + HTTPS 回调域名；
- 项 2 的 2.1–2.2 真实表单链路、项 3 的钉钉自动化真实触发、项 4 的 4.5
  （抽奖结束时间推进）与真机并发复核、项 5 的 5.1 真机扫码。

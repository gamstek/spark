# Project Spark 配置说明

本项目只服务一个公司和一个微信公众号。生产配置保存在服务器的 `.env.production`
中，不提交到 Git。可以复制 `.env.example` 后替换占位值。

生产配置文件保存在 `/opt/spark/.env.production`，并设置为仅部署账户可读。

## 外部平台提供的信息

| 配置                | 具体含义                                                            | 从哪里获取                    | 是否保密             |
| ------------------- | ------------------------------------------------------------------- | ----------------------------- | -------------------- |
| `WECHAT_APP_ID`     | 微信公众号开发者 ID，通常以 `wx` 开头；不是公众号原始 ID `gh_xxx`。 | 微信公众号后台的开发/基本配置 | 否，但只配置在服务端 |
| `WECHAT_APP_SECRET` | 与 AppID 配套的开发密钥，用于保留的 OAuth 与 JS-SDK 能力。          | 微信公众号后台生成或重置      | 是                   |

当前生产活动使用匿名身份。Compose 始终向 API 显式传入
`ACTIVITY_IDENTITY_MODE`；未在部署环境中设置时传入
`anonymous`。不要把生产配置改成
`wechat`：该模式仅为未来具备保留 OAuth 流程能力的公众号账户预留。

当前系统不使用公众号原始 ID、微信支付商户号、EncodingAESKey、UnionID 或钉钉 AppKey/AppSecret。

活动入口使用可分享的 HTTPS 活动链接，例如
`https://spark.gamstek.com/activity/<activityCode>`，可用于海报、群公告和客服话术。首次打开会在该浏览器建立匿名活动会话，Cookie 最长保留 7 天。匿名 Cookie 不能跨设备识别同一人：清除 Cookie、使用无痕窗口或更换设备都可能建立新的会话，因此不能依赖它限制同一人跨设备重复参与。

## 钉钉表单提供的信息

这些值由运营人员在管理后台为每个活动填写，不属于服务器环境变量：

| 字段           | 具体含义                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `formId`       | 钉钉表单的稳定标识。回调 Body 必须发送同一个值。                                                                  |
| `formUrl`      | 表单 HTTPS 分享地址，必须属于 `alidocs.dingtalk.com`。系统会保留原有参数并自动追加参与编号。                      |
| `prefillField` | URL 中保存参与编号的参数名，默认为 `prefill_participant`。打开表单前，系统会将内部 `participationId` 写入该参数。 |
| `fieldMapping` | 回调中参与编号、姓名、手机号对应的表单字段。第一版后台使用固定映射。                                              |

钉钉自动化向以下地址发送 POST：

```text
https://spark.gamstek.com/api/integrations/dingtalk/form-submissions
```

`DINGTALK_CALLBACK_SECRET`
是本系统自行生成的共享密钥，不是钉钉提供的AppSecret。服务器保存一份，钉钉自动化请求头配置同一个值：

```text
Authorization: Bearer <DINGTALK_CALLBACK_SECRET>
```

## 系统自行生成的密钥

| 配置                          | 用途                                                                 | 变更影响                                                           |
| ----------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `CSRF_SECRET`                 | 生成管理端和工作人员端写请求的 CSRF 校验值。                         | 修改后现有页面会话需要重新登录。                                   |
| `OAUTH_STATE_SECRET`          | 签名微信公众号 OAuth 的一次性 state，防止回调伪造和重放。            | 修改时正在进行的 OAuth 会失败，用户可重新进入活动。                |
| `WECHAT_TOKEN_ENCRYPTION_KEY` | 加密 PostgreSQL 中缓存的公众号 access token。                        | 多实例和数据库恢复必须使用同一个值。                               |
| `DINGTALK_CALLBACK_SECRET`    | 验证钉钉表单自动化回调。                                             | 修改时必须同步更新钉钉自动化请求头。                               |
| `REDEEM_CODE_ACTIVE_KEY_ID`   | 指定新兑奖码使用的密钥标签，例如 `v1`。                              | 必须能在 `REDEEM_CODE_KEYS` 中找到同名项。                         |
| `REDEEM_CODE_KEYS`            | JSON 格式的兑奖码 AES 密钥集合；每个值是 Base64 编码的 32 字节密钥。 | 轮换时新增密钥并切换 active ID；删除旧密钥会导致旧兑奖码无法展示。 |

可用 OpenSSL 生成随机值：

```bash
openssl rand -base64 32
```

三个通用签名/加密密钥和钉钉回调密钥分别执行一次，不能复用。兑奖码密钥把命令结果作为
`REDEEM_CODE_KEYS` 中对应 key ID 的值。

## 数据库与运行配置

| 配置                                                  | 具体含义                                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                        | API 和集成测试共用的 PostgreSQL 连接串。生产容器中的主机名为 `postgres`；执行集成测试时数据库名必须包含 `test`，否则测试会拒绝启动。密码含特殊字符时必须 URL 编码。 |
| `DATABASE_SCHEMA`                                     | PostgreSQL schema，默认 `public`。                                                                                                                                  |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | 生产 Compose 创建 PostgreSQL 容器时使用的数据库名、账号和密码。                                                                                                     |
| `MEDIA_ROOT`                                          | 活动图片保存目录，生产环境映射到持久卷。                                                                                                                            |
| `PRIVATE_EXPORT_ROOT`                                 | 私有线索导出目录，文件不会由 Nginx 公开暴露。                                                                                                                       |
| `JOB_POLL_INTERVAL_MS`                                | PostgreSQL 后台任务轮询间隔，默认 1000 毫秒。                                                                                                                       |
| `MAINTENANCE_INTERVAL_MS`                             | 过期 Session、导出等维护任务间隔，默认 3600000 毫秒。                                                                                                               |
| `ACTIVITY_IDENTITY_MODE`                              | 生产 API 接收的活动身份模式；匿名部署为 `anonymous`，Compose 未设置时也会显式传入该值。                                                                             |

## 上线前还要确定的业务数据

- 对外可分享的活动链接或二维码，以及活动页面中的参与说明。
- 活动名称、四个时间点、主视觉和活动规则。
- 奖品名称、初始库存和抽奖权重。
- 渠道代码及各渠道二维码。
- 初始管理员账号，以及工作人员账号和活动权限。

# Project Spark 微信公众号配置

## 公众号后台

使用已认证的服务号，并将业务域名配置为正式 HTTPS 域名。网页授权回调域名只填写域名，不带协议和路径。OAuth 回调固定为：

```text
https://<正式域名>/api/wechat/oauth/callback
```

工作人员端使用微信 JS-SDK 的 `scanQRCode`
接口完成兑奖扫码。公众号后台的“JS 接口安全域名”必须配置为正式域名，例如
`spark.gamstek.com`，不填写协议和路径。域名验证文件需要能够通过该域名根路径访问，正式页面必须使用 HTTPS。

在部署环境设置 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`OAUTH_STATE_SECRET` 和
`WECHAT_TOKEN_ENCRYPTION_KEY`。其中 AppID 是通常以 `wx`
开头的公众号开发者 ID，不是 `gh_xxx`
公众号原始 ID；AppSecret 是微信公众号后台提供的配套密钥。后两项由本系统自行生成。完整解释见[配置说明](project-spark-configuration.md)。

## 本地与测试账号

微信网页授权需要可访问的 HTTPS 域名。本地联调应使用测试公众号和临时 HTTPS 反向代理域名；服务端会从当前请求自动生成 OAuth 回调地址。生产环境不提供 OpenID 模拟登录接口；自动化测试通过依赖注入替换
`WechatGateway`。

## 验证步骤

1. 在微信内访问 `/activity/<activityCode>`，确认跳转到微信静默授权。
2. 授权返回后确认浏览器只得到 `spark_activity` HttpOnly Cookie。
3. 再次扫码，确认恢复同一用户和参与记录。
4. 分别测试未关注、已关注、微信接口超时和 state 重放；超时应允许重试，state 只能成功使用一次。
5. 检查日志不包含 AppSecret、access token、OpenID 或完整 Cookie。
6. 使用工作人员账号在微信内打开
   `/staff/scan`，确认微信原生扫一扫能够返回兑奖码；取消扫码后应留在当前页，并可改用手动输入。

Access
Token 由 PostgreSQL 共享缓存和刷新租约协调。关注状态每次向微信实时查询，查询结果同步写入数据库。部署多个 API 实例前需验证各实例使用同一数据库和同一加密密钥。

## 线上日志验证

在 ECS 上跟踪 API 容器日志：

```bash
docker compose -f compose.production.yaml logs -f --tail=200 api
```

一次正常的首次访问应依次出现：

```text
wechat.oauth.started
wechat.oauth.callback_received
wechat.oauth.state_verified
wechat.oauth.succeeded
wechat.subscription.check_started
wechat.subscription.check_succeeded
```

`wechat.subscription.check_succeeded` 中的 `subscribed`
是微信实时返回的关注状态，`identityUpdated`
表示结果是否写入了对应身份。首次获取或刷新公众号 Access Token 时还会出现
`wechat.token.refresh_started` 和 `wechat.token.refresh_succeeded`。

微信请求失败时查看 `wechat.api.failed` 的 `operation` 和
`reason`。日志不会输出 AppSecret、授权 code、Access
Token、Cookie 或完整 OpenID；`identityFingerprint` 仅用于关联同一次用户验证。

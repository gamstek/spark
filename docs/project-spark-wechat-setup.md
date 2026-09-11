# Project Spark 微信公众号配置

## 服务器配置

使用已认证的服务号，并将业务域名配置为正式 HTTPS 域名。生产部署必须设置以下环境变量：

```ini
WECHAT_APP_ID=<公众号 AppID>
WECHAT_APP_SECRET=<公众号 AppSecret>
WECHAT_CALLBACK_TOKEN=<部署者生成的随机 Token>
PUBLIC_BASE_URL=https://spark.gamstek.com
WECHAT_TOKEN_ENCRYPTION_KEY=<系统生成的加密密钥>
```

`WECHAT_CALLBACK_TOKEN`
只保存在部署环境和微信公众号后台；不要写入前端、活动链接、截图或日志。`PUBLIC_BASE_URL`
必须是精确的 HTTPS 根地址，不能带路径、查询参数或其他域名。完整的变量说明见[配置说明](project-spark-configuration.md)。

在微信公众号后台的「基本配置／服务器配置」填写：

| 项目           | 值                                              |
| -------------- | ----------------------------------------------- |
| URL            | `https://spark.gamstek.com/api/wechat/callback` |
| Token          | 与 `WECHAT_CALLBACK_TOKEN` 完全一致             |
| 消息加解密方式 | 明文模式                                        |

保存时微信会向该 URL 发起带 `signature`、`timestamp`、`nonce` 和 `echostr`
的 GET 验证。服务必须校验签名并原样返回
`echostr`；签名错误、缺少参数或 Token 不一致时会返回拒绝，不能绕过校验。不要在这里配置 EncodingAESKey，也不要启用兼容或安全模式。

工作人员端使用微信 JS-SDK 的 `scanQRCode`
接口完成兑奖扫码。公众号后台的「JS 接口安全域名」必须配置
`spark.gamstek.com`，不填写协议和路径；域名验证文件需要能从该域名根路径访问，正式页面必须使用 HTTPS。

## 菜单和活动入口

在自定义菜单新增一个点击菜单，名称按运营文案填写，菜单类型选择「click」，键值必须精确为
`LOTTERY`（大写）。关注事件和这个菜单点击事件都会生成活动入口回复。

发布前仅保留一个当前处于起止时间内、且有已发布版本的活动。收到关注或 `LOTTERY`
点击后，公众号会回复一个 `https://spark.gamstek.com/api/activity/entry?t=...`
链接。该链接仅属于收到消息的微信用户：十分钟有效，首次打开即消费并建立活动会话；再次打开、超时、修改或截断都会无效。不要把此类链接当作公共二维码、群公告或客服直链分发；公共物料应让用户关注公众号，或在公众号内点击
`LOTTERY` 获取自己的链接。

没有活动时，回复为「当前暂无可参与的活动，请稍后再试。」；同时命中多个活动时，回复为「活动配置异常，请联系现场工作人员。」。后一种情况应立即停止引流，并在后台修正重复的活动时间或发布状态后再测试。

## 验证步骤

1. 部署后确认 `WECHAT_CALLBACK_TOKEN` 和
   `PUBLIC_BASE_URL=https://spark.gamstek.com`
   已传入 API 容器，再在公众号后台保存服务器配置，确认 GET 验证成功。
2. 用测试号取消关注后重新关注，确认收到包含一次性入口链接的文本回复；在十分钟内第一次打开应进入对应活动，第二次打开应显示入口无效。
3. 在公众号内点击 `LOTTERY` 菜单，确认同样收到新的活动入口链接。
4. 分别在无活动和多个当前活动时执行关注或 `LOTTERY`
   点击，确认收到上述准确提示且没有入口 URL。
5. 使用工作人员账号在微信内打开
   `/staff/scan`，确认微信原生扫一扫能够返回兑奖码；取消扫码后应留在当前页，并可改用手动输入。

## 线上日志验证

在 ECS 上跟踪 API 容器日志：

```bash
docker compose -f compose.production.yaml logs -f --tail=200 api
```

正常的关注或 `LOTTERY` 点击会记录
`wechat.callback.handled`，并带请求 ID、事件类型和结果（例如 `issued` 或
`no-active-activity`）。服务失败会记录 `wechat.callback.failed` 后向微信确认
`success`，避免泄露内部异常。日志不得输出
`WECHAT_APP_SECRET`、`WECHAT_CALLBACK_TOKEN`、access
token、OpenID、一次性入口 token、完整 XML 或 Cookie；排障时只使用请求 ID 和结果字段关联记录。

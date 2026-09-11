# Project Spark 微信公众号配置

## 匿名活动部署

当前生产活动使用匿名身份。部署后 API 必须收到
`ACTIVITY_IDENTITY_MODE=anonymous`；生产 Compose 在环境变量未设置时也会显式传入该值。活动入口是可分享的 HTTPS 链接：

```text
https://spark.gamstek.com/activity/<activityCode>
```

该链接可以用于活动二维码、海报、群公告和客服话术。首次打开会建立浏览器专属的匿名活动会话，Cookie 最长保存 7 天。它不是跨设备身份：清除 Cookie、无痕窗口或更换设备会建立新会话，不能据此限制同一人跨设备重复参与。

匿名活动不要求关注验证，也不依赖公众号服务器回调或自定义菜单。不要为活动入口配置服务器回调地址、Token 或消息加解密方式。

## 保留的微信能力

工作人员端仍可使用微信 JS-SDK 的 `scanQRCode`
完成兑奖扫码。公众号后台的「JS 接口安全域名」配置
`spark.gamstek.com`（不带协议和路径），域名验证文件必须能从域名根路径访问，正式页面使用 HTTPS。

`WECHAT_APP_ID`、`WECHAT_APP_SECRET` 和 `WECHAT_TOKEN_ENCRYPTION_KEY`
仍由服务器保存，用于保留的 OAuth 与 JS-SDK 能力；不要写入浏览器代码、URL、截图或日志。`wechat`
身份模式仅为未来具备保留 OAuth 流程能力的公众号账户预留，当前生产部署不要启用它。完整变量说明见[配置说明](project-spark-configuration.md)。

## 验证步骤

1. 部署后确认 API 容器环境中的 `ACTIVITY_IDENTITY_MODE` 为 `anonymous`。
2. 从普通浏览器和微信内分别打开已发布活动的分享链接，确认都能进入对应活动。
3. 同一浏览器在 7 天内再次打开链接，确认会话按 Cookie 恢复；清除 Cookie 或更换设备后，确认会建立新的匿名会话，并按运营规则评估重复参与风险。
4. 使用工作人员账号在微信内打开
   `/staff/scan`，确认微信原生扫一扫能返回兑奖码；取消扫码后应留在当前页，并可改用手动输入。

# Project Spark 部署指南

## 部署模型

生产环境采用单 API 副本、一个 Nginx
Web 容器和 PostgreSQL。数据库、媒体和私有导出文件分别使用持久卷。Nginx 在同一域名下提供
`/activity/`、`/staff/`、`/admin/`，并将 `/api`
原样代理至 API，避免前端 fallback 吞掉 API 404。

## 准备

1. 在根目录 `.env.production` 设置
   `POSTGRES_PASSWORD`、`DATABASE_URL`、`PUBLIC_ORIGIN`、三个至少 32 字节的密钥及微信公众号凭据。容器内数据库地址使用
   `postgres`，密码中的特殊字符必须进行 URL 编码。
2. 将证书保存为 `nginx/certs/fullchain.pem` 和 `nginx/certs/privkey.pem`。
3. `PUBLIC_ORIGIN` 必须是用户访问的 HTTPS 源，例如
   `https://campaign.example.com`，不能带路径或结尾斜杠。
4. 将 `TRUST_PROXY` 限制为容器网络或实际反向代理网段。不要设置为任意来源。

启动并查看状态：

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml ps
curl -fsS https://campaign.example.com/api/health/live
curl -fsS https://campaign.example.com/api/health/ready
```

API 启动前自动运行数据库迁移。上传限制为 7 MiB，业务图片仍执行 5
MiB 校验；`/media/`
从只读持久卷提供已校验图片。API 内置 PostgreSQL 任务轮询和定期过期数据维护。Nginx 对普通 API 和登录/OAuth 路由采用不同限流；Session
Cookie 在生产环境使用 `Secure`、`HttpOnly` 和 `SameSite=Lax`。

## 备份与恢复

每日备份 PostgreSQL、`media`
卷及加密密钥；导出文件只保留 24 小时，不作为备份。恢复演练必须在隔离环境执行：恢复数据库和媒体卷，注入原加密密钥，运行迁移及
`templates:check`，再验证旧活动图片、兑奖码和失败任务重放。记录备份时间、恢复耗时、验证人员和结果。

升级前执行 `pnpm verify`。发布后用实际地址执行：

```bash
DEPLOYMENT_BASE_URL=https://campaign.example.com pnpm exec playwright test tests/e2e/deployment.spec.ts
```

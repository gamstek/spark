# Project Spark 部署指南

## 部署模型

生产环境采用单 API 副本、一个 Nginx
Web 容器和 PostgreSQL。数据库、媒体和私有导出文件分别使用持久卷。Nginx 在同一域名下提供
`/activity/`、`/staff/`、`/admin/`，并将 `/api`
原样代理至 API，避免前端 fallback 吞掉 API 404。

## 准备

1. 复制 `.env.example` 为根目录
   `.env.production`，按[配置说明](project-spark-configuration.md)设置数据库、正式域名、微信公众号凭据、钉钉回调密钥和兑奖码密钥。容器内数据库地址使用
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

## 自动化验证与镜像发布

PR 会验证 API 和 Web 两个 `linux/amd64`
镜像可以构建，但不会登录仓库或推送镜像。主分支的 `Quality Gates`
工作流成功后，`Publish Container Images` 工作流会检出同一个提交并发布：

- `ghcr.io/gamstek/spark-api:sha-<完整提交 SHA>`
- `ghcr.io/gamstek/spark-web:sha-<完整提交 SHA>`

发布按完整提交 SHA 标记镜像，不维护 `latest` 等移动标签。手动运行
`Publish Container Images` 只验证构建，不能绕过 `Quality Gates`
发布。镜像包含源码仓库 OCI 标签，首次发布时会关联到本仓库；镜像可见性及部署服务器的拉取权限在 GitHub
Packages 中管理。私有镜像需先登录再拉取：

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin
docker pull ghcr.io/gamstek/spark-api:sha-<完整提交 SHA>
docker pull ghcr.io/gamstek/spark-web:sha-<完整提交 SHA>
```

## 阿里云 ECS 自动部署

`Publish Container Images` 成功发布主分支镜像后，`Deploy to Aliyun ECS`
会通过 SSH 将根目录 `compose.production.yaml` 和本次 `.env.release`
传到 ECS，拉取对应 SHA 的 API、Web 镜像，然后运行迁移并更新容器。GitHub
Environment `production` 需要配置：

| Secret                | 内容                                                                   |
| --------------------- | ---------------------------------------------------------------------- |
| `ECS_HOST`            | ECS 公网 IP 或可解析域名                                               |
| `ECS_PORT`            | SSH 端口；不配置时使用 `22`                                            |
| `ECS_USER`            | 有权限执行 Docker Compose 的 SSH 用户                                  |
| `ECS_SSH_PRIVATE_KEY` | 与 ECS 公钥匹配的完整 SSH 私钥                                         |
| `ECS_SSH_KNOWN_HOSTS` | ECS 的固定 `known_hosts` 记录，避免跳过主机校验                        |
| `ECS_DEPLOY_PATH`     | 服务器部署目录，例如 `/opt/spark`                                      |
| `ECS_HEALTHCHECK_URL` | 就绪检查完整地址，例如 `https://campaign.example.com/api/health/ready` |

以上配置和 ECS 准备工作完成后，在仓库的 Actions Variables 中设置
`ECS_AUTO_DEPLOY_ENABLED=true`，才会启用主分支自动部署。未设置时自动部署任务保持跳过，手动部署不受影响。

首次部署前，在 ECS 安装 Docker Engine 和 Compose 插件，在 `ECS_DEPLOY_PATH` 放置
`.env.production` 与
`nginx/certs/fullchain.pem`、`nginx/certs/privkey.pem`。如果 GHCR 镜像是私有的，还需使用具有
`read:packages` 权限的令牌，以部署用户执行一次
`docker login ghcr.io`。可以在可信终端生成主机记录，再完整保存为 secret：

```bash
ssh-keyscan -p 22 -H ecs.example.com
```

需要回滚时，在 GitHub Actions 手动运行
`Deploy to Aliyun ECS`，输入已发布镜像对应的 40 位完整提交 SHA。工作流不会读取或覆盖 ECS 上的
`.env.production` 和证书。

## 备份与恢复

每日备份 PostgreSQL、`media`
卷及加密密钥；导出文件只保留 24 小时，不作为备份。恢复演练必须在隔离环境执行：恢复数据库和媒体卷，注入原加密密钥，运行迁移及
`templates:check`，再验证旧活动图片、兑奖码和失败任务重放。记录备份时间、恢复耗时、验证人员和结果。

升级前执行 `pnpm verify`。发布后用实际地址执行：

```bash
DEPLOYMENT_BASE_URL=https://campaign.example.com pnpm exec playwright test tests/e2e/deployment.spec.ts
```

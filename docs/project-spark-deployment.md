# Project Spark 部署指南

## 部署模型

生产环境采用宿主机 Nginx、单 API 容器、单 Web 容器和独立 PostgreSQL 容器。宿主机 Nginx 保留 80/443，通过
`127.0.0.1:18080`
访问 Web 容器；API 和 PostgreSQL 不发布宿主机端口。数据库、媒体和私有导出文件分别使用持久卷。

`spark.gamstek.com` 提供 `/activity/`、`/staff/`、`/admin/`，并将 `/api`
原样代理至 API。访问 `/activity`、`/staff` 或 `/admin`
会跳转到带尾斜杠的对应入口。

## 准备

1. 在 ECS 创建
   `/opt/spark/.env.production`，按[配置说明](project-spark-configuration.md)
   设置数据库、微信公众号凭据、钉钉回调密钥和兑奖码密钥，并执行
   `chmod 600 /opt/spark/.env.production`。容器内数据库主机名使用
   `postgres`，密码中的特殊字符必须进行 URL 编码。
2. 设置 `PUBLIC_ORIGIN=https://spark.gamstek.com`，不能带路径或结尾斜杠。
3. 安装 Docker Engine、Docker Compose 插件、系统 Nginx 和 Certbot。
4. 使用具有 `read:packages` 权限的 GitHub Token，以部署账户登录 GHCR。
5. 将仓库中的 `nginx/sites-available/spark.gamstek.com.conf`
   安装到系统 Nginx，创建 `sites-enabled` 软链接；只有 `nginx -t`
   成功后才能 reload。

启动并查看状态：

```bash
docker compose --env-file .env.production --env-file .env.release \
  -f compose.production.yaml up -d --no-build
docker compose --env-file .env.production --env-file .env.release \
  -f compose.production.yaml ps
curl -fsS http://127.0.0.1:18080/api/health/ready
```

API 启动前自动运行数据库迁移。上传限制为 7 MiB，业务图片仍执行 5
MiB 校验；`/media/`
从只读持久卷提供已校验图片。API 内置 PostgreSQL 任务轮询和定期过期数据维护。Session
Cookie 在生产环境使用 `Secure`、`HttpOnly` 和
`SameSite=Lax`。PostgreSQL数据保存在命名卷
`database`，普通发布不会删除或重建该卷。

## 域名与 HTTPS

先确认容器的本地就绪检查成功，再添加 `spark.gamstek.com`
指向 ECS 公网 IPv4 的 DNS A 记录。公共 DNS 生效后执行：

```bash
certbot --nginx -d spark.gamstek.com
nginx -t
curl -fsS https://spark.gamstek.com/api/health/ready
```

依次验证 `/activity/`、`/staff/`、`/admin/` 和
`/api/health/ready`。HTTPS 可用后，再配置微信公众号网页授权域名、接口 IP 白名单及钉钉正式回调。

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

| Secret                | 内容                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `ECS_HOST`            | ECS 公网 IP 或可解析域名                                         |
| `ECS_PORT`            | SSH 端口；不配置时使用 `22`                                      |
| `ECS_USER`            | 有权限执行 Docker Compose 的 SSH 用户                            |
| `ECS_PASSWORD`        | ECS 部署账户的 SSH 密码                                          |
| `ECS_SSH_KNOWN_HOSTS` | ECS 的固定 `known_hosts` 记录，避免跳过主机校验                  |
| `ECS_DEPLOY_PATH`     | 服务器部署目录，例如 `/opt/spark`                                |
| `ECS_HEALTHCHECK_URL` | 可选的公网检查地址：`https://spark.gamstek.com/api/health/ready` |

以上配置和 ECS 准备工作完成后，在仓库的 Actions Variables 中设置
`ECS_AUTO_DEPLOY_ENABLED=true`，才会启用主分支自动部署。未设置时自动部署任务保持跳过，手动部署不受影响。

workflow 使用 `sshpass`，通过 `SSHPASS` 环境变量读取
`ECS_PASSWORD`；密码不会写入 SSH 命令参数或上传文件。ECS 必须允许密码认证，部署账户必须有权操作
`ECS_DEPLOY_PATH`
和 Docker。SSH 仍执行严格主机身份校验，可以在可信终端生成记录，再完整保存为 secret：

```bash
ssh-keyscan -p 22 -H ecs.example.com
```

首次部署时 `ECS_HEALTHCHECK_URL` 可以不配置，workflow 会在 ECS 内检查
`http://127.0.0.1:18080/api/health/ready`。HTTPS 启用后再设置公网地址。需要回滚时，在 GitHub
Actions 手动运行
`Deploy to Aliyun ECS`，输入已发布镜像对应的 40 位完整提交 SHA。工作流不会读取或覆盖 ECS 上的
`.env.production` 和证书。

## 备份与恢复

项目不会在发布时执行 `pg_dump`，也不提供自动数据库备份。数据库、`media`
卷和加密密钥的备份由服务器运维策略负责；导出文件只保留 24 小时，不作为备份。恢复演练应在隔离环境恢复数据库和媒体卷，注入原加密密钥，运行迁移及
`templates:check`，再验证旧活动图片、兑奖码和失败任务重放。

升级前执行 `pnpm verify`。发布后用实际地址执行：

```bash
DEPLOYMENT_BASE_URL=https://spark.gamstek.com pnpm exec playwright test tests/e2e/deployment.spec.ts
```

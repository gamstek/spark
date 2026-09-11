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
2. 安装 Docker Engine、Docker Compose 插件、系统 Nginx 和 Certbot。
3. 使用具有 `read:packages` 权限的 GitHub Token，以部署账户登录 GHCR。
4. 将仓库中的 `nginx/sites-available/spark.gamstek.com.conf`
   安装到系统 Nginx，创建 `sites-enabled` 软链接；只有 `nginx -t`
   成功后才能 reload。

`Release`
只发布镜像。首次和后续版本都由操作人员在 ECS 上运行部署脚本激活。不要在
`/opt/spark` 使用平铺的 Compose 和 `.env.release` 文件直接执行
`up`，否则会绕过候选版本健康检查、自动回滚和 `current`
的原子切换。部署完成后检查当前版本和状态：

```bash
readlink /opt/spark/current
cd /opt/spark/current
docker compose -p spark --env-file /opt/spark/.env.production \
  --env-file /opt/spark/current/.env.release \
  -f /opt/spark/current/compose.production.yaml ps
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

GitHub Actions 包含三个 workflow：

- `CI`：PR 和 `main` 分支提交运行五个并行检查：`static`、`unit`、
  `build`、`integration`、`e2e`；它不会发布镜像或部署。
- `Release`：可从 Actions 手动运行，也可由严格 SemVer 标签触发。有效示例为
  `v1.2.3`、`v2.0.0-rc.1`；`v1.2`、`v01.2.3`、 `v1.2.3+build.1`
  均无效。发布提交必须属于 `main` 的历史。
- `Deploy Production`：仅保留显式手动入口，输入已经发布镜像对应的 40 位小写完整 source
  SHA。`Release` 不会调用它。

`Release` 先调用 `CI`，随后并行构建并发布两个 `linux/amd64` 镜像：

- `ghcr.io/gamstek/spark-api:sha-<完整提交 SHA>`
- `ghcr.io/gamstek/spark-web:sha-<完整提交 SHA>`

标签触发时还会生成对应版本标签，例如
`spark-api:v1.2.3`。构建作业输出 API 和 Web 的 `sha256:<64 位小写十六进制>` OCI
digest，生产部署只使用 `ghcr.io/gamstek/spark-api@sha256:...` 和
`ghcr.io/gamstek/spark-web@sha256:...`，不从可变标签拉取。镜像包含源码仓库 OCI 标签，首次发布时会关联到本仓库；镜像可见性及部署服务器的拉取权限在 GitHub
Packages 中管理。私有镜像需先登录再拉取：

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin
docker pull ghcr.io/gamstek/spark-api:sha-<完整提交 SHA>
docker pull ghcr.io/gamstek/spark-web:sha-<完整提交 SHA>
```

## 在 ECS 手动部署

`Release` 只构建并发布镜像，不连接 ECS。发布完成后，在 ECS 手动拉取 Release
summary 中的两个 digest 镜像：

```bash
docker pull ghcr.io/gamstek/spark-api@sha256:<API_DIGEST>
docker pull ghcr.io/gamstek/spark-web@sha256:<WEB_DIGEST>
docker pull postgres:18-alpine
```

然后在 ECS 上包含当前仓库文件的目录中准备候选版本。以下示例使用 `/sty/spark` 和
`v0.0.4`；两个镜像地址必须替换为同一次 Release 输出的完整 digest：

```bash
DEPLOY_ROOT=/sty/spark
RELEASE_ID=v0.0.4
INCOMING="$DEPLOY_ROOT/releases/.incoming-$RELEASE_ID"

install -d -m 700 "$INCOMING"
install -m 600 compose.production.yaml "$INCOMING/compose.production.yaml"
install -m 700 .github/scripts/deploy-production.sh "$INCOMING/deploy-production.sh"
printf '%s\n' \
  'SPARK_API_IMAGE=ghcr.io/gamstek/spark-api@sha256:<API_DIGEST>' \
  'SPARK_WEB_IMAGE=ghcr.io/gamstek/spark-web@sha256:<WEB_DIGEST>' \
  >"$INCOMING/.env.release"
printf '{"version":"%s"}\n' "$RELEASE_ID" >"$INCOMING/release.json"
chmod 600 "$INCOMING/.env.release" "$INCOMING/release.json"

bash "$INCOMING/deploy-production.sh" "$DEPLOY_ROOT" "$RELEASE_ID"
```

是的，最后一条命令就是实际部署命令。脚本将候选目录移动到
`$DEPLOY_ROOT/releases/$RELEASE_ID`，使用固定 Compose 项目名 `spark`
启动服务，健康检查通过后原子更新
`$DEPLOY_ROOT/current`。候选版本失败时会恢复上一版本。脚本使用
`--pull never`，不会下载镜像；未提前拉取镜像时部署会立即失败。

如需使用保留的 `Deploy Production`
workflow，必须在 Actions 中显式手动运行。其连接配置仅放在 `production`
Environment：

| Secret                | 内容                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `ECS_HOST`            | ECS 公网 IP 或可解析域名                                         |
| `ECS_PORT`            | SSH 端口；不配置时使用 `22`                                      |
| `ECS_USER`            | 有权限执行 Docker Compose 的 SSH 用户                            |
| `ECS_PASSWORD`        | ECS 部署账户的 SSH 密码                                          |
| `ECS_SSH_KNOWN_HOSTS` | ECS 的固定 `known_hosts` 记录，避免跳过主机校验                  |
| `ECS_DEPLOY_PATH`     | 服务器部署目录，例如 `/opt/spark`                                |
| `ECS_HEALTHCHECK_URL` | 可选的公网检查地址：`https://spark.gamstek.com/api/health/ready` |

workflow 使用 `sshpass`，通过 `SSHPASS` 环境变量读取
`ECS_PASSWORD`；密码不会写入 SSH 命令参数或上传文件。ECS 必须允许密码认证，部署账户必须有权操作
`ECS_DEPLOY_PATH`（生产值为
`/opt/spark`）和 Docker。SSH 仍执行严格主机身份校验，可以在可信终端生成记录，再完整保存为 secret：

```bash
ssh-keyscan -p 22 -H ecs.example.com
```

首次部署时 `ECS_HEALTHCHECK_URL` 可以不配置，workflow 会在 ECS 内检查
`http://127.0.0.1:18080/api/health/ready`。HTTPS 启用后再设置公网地址。候选版本的本地检查失败时，脚本自动重新启动
`current`
指向的上一版本并再次检查就绪状态；部署仍以失败结束，便于值班人员发现问题。公网 HTTPS 检查发生在本地激活之后，公网检查失败不会自动切换已经本地健康的版本。

需要手动回滚时，在 Actions 运行
`Deploy Production`，输入目标已发布版本对应的 40 位小写完整 source
SHA。workflow 会解析该 SHA 的 API/Web
digest，创建新的版本目录并经过正常审批与健康检查；数据库迁移不会反向执行。工作流不会读取或覆盖 ECS 上的
`.env.production` 和证书。

## GitHub 发布保护设置

在创建首个版本标签前完成以下仓库设置：

1. 为 `main` 的分支保护或 ruleset 要求 `CI` 的五个检查：`static`、`unit`、
   `build`、`integration`、`e2e`。
2. 创建 tag ruleset，保护匹配 `v*` 的标签，只允许发布负责人创建或更新。
3. 创建 `production` Environment，添加至少一名 required reviewer，并启用 prevent
   self-review，避免触发部署的人审批自己的运行。
4. 将 Environment 的 deployment branches and tags 限定为默认分支 `main`
   和受保护的 `v*` 标签。
5. 只在 `production` Environment 保存 `ECS_HOST`、`ECS_PORT`、
   `ECS_USER`、`ECS_PASSWORD`、`ECS_SSH_KNOWN_HOSTS`、
   `ECS_DEPLOY_PATH`、`ECS_HEALTHCHECK_URL`。

私有仓库必须使用支持 Environment required
reviewers 的 GitHub 套餐。如果当前套餐不支持，不能把标签触发视为审批边界；应由授权操作员手动运行部署，将这次人工操作作为生产审批边界，直到套餐或仓库可见性满足 Environment 审批要求。

## 备份与恢复

项目不会在发布时执行 `pg_dump`，也不提供自动数据库备份。数据库、`media`
卷和加密密钥的备份由服务器运维策略负责；导出文件只保留 24 小时，不作为备份。恢复演练应在隔离环境恢复数据库和媒体卷，注入原加密密钥，运行迁移及
`templates:check`，再验证旧活动图片、兑奖码和失败任务重放。

升级前执行 `pnpm verify`。发布后用实际地址执行：

```bash
DEPLOYMENT_BASE_URL=https://spark.gamstek.com pnpm exec playwright test tests/e2e/deployment.spec.ts
```

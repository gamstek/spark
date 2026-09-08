# Project Spark 阿里云 ECS 生产部署设计

## 目标与范围

将 Project Spark 部署到一台现有阿里云 ECS，并通过 `https://spark.gamstek.com`
对外服务。部署继续使用 GHCR 中按完整 Git
SHA 标记的镜像。服务器上的系统 Nginx 已承载其他站点，因此 Spark 容器不绑定宿主机的 80、443 端口。本次不实现
`pg_dump` 或其他自动数据库备份。

## 运行结构

宿主机 Nginx 负责 `spark.gamstek.com` 的 HTTPS 终止，并把全部请求转发到
`127.0.0.1:18080`。Web 容器仅通过该回环地址暴露 HTTP；API 和 PostgreSQL 只加入 Compose 内部网络，不发布宿主机端口。

Web 容器继续提供静态页面、媒体文件和 API 反向代理。入口行为为：

- `/` 跳转到 `/activity/`；
- `/activity`、`/staff`、`/admin` 分别跳转到带尾斜杠的路径；
- `/activity/*`、`/staff/*`、`/admin/*` 返回对应单页应用；
- `/api/*` 转发到 API 容器，`/media/*` 读取只读媒体卷。

PostgreSQL 使用独立容器和命名卷
`database`。数据库端口不对宿主机或公网开放；API 等待数据库健康检查通过后启动，并在启动时执行 TypeORM 迁移。镜像回滚不反向执行数据库迁移。

## Nginx 与域名启用顺序

仓库保存可审查的宿主机站点配置。首次上线先安装该 HTTP 配置，执行 `nginx -t`
后再 reload。服务部署完成后，通过 `http://127.0.0.1:18080/api/health/ready`
验证容器链路。

随后为 `spark.gamstek.com`
添加指向 ECS 公网 IPv4 的 A 记录。公共 DNS 生效后，执行
`certbot --nginx -d spark.gamstek.com` 申请证书并启用 HTTPS，最后验证
`/activity/`、`/staff/`、`/admin/` 和
`/api/health/ready`。微信公众号网页授权域名和接口 IP 白名单在 HTTPS 可用后配置。

## GitHub Actions 部署

流水线保持
`Quality Gates → Publish Container Images → Deploy to Aliyun ECS`。部署任务在 GitHub 托管的 Ubuntu
Runner 上安装 `sshpass`，通过环境变量 `SSHPASS`
使用服务器账户密码；密码只来自 GitHub Environment `production` 的 `ECS_PASSWORD`
secret，不写入命令参数、文件或日志。

部署仍校验固定 `known_hosts` 记录，并使用这些配置：

| 名称                  | 用途                                       |
| --------------------- | ------------------------------------------ |
| `ECS_HOST`            | ECS 公网 IP 或 SSH 主机名                  |
| `ECS_PORT`            | SSH 端口，缺省为 22                        |
| `ECS_USER`            | 有权操作部署目录和 Docker 的账户           |
| `ECS_PASSWORD`        | 该账户的 SSH 密码                          |
| `ECS_SSH_KNOWN_HOSTS` | 固定的 SSH 主机公钥记录                    |
| `ECS_DEPLOY_PATH`     | 固定部署目录，例如 `/opt/spark`            |
| `ECS_HEALTHCHECK_URL` | HTTPS 启用后的外部就绪检查地址，可暂不配置 |

workflow 上传 `compose.production.yaml` 和包含两个 SHA 镜像地址的
`.env.release`，保留服务器本地 `.env.production`。服务器需提前使用具有
`read:packages`
权限的凭据登录 GHCR。部署依次拉取镜像、更新容器、检查 Compose 状态和本地就绪端点；配置外部健康检查地址后，再检查公网 HTTPS。

`ECS_AUTO_DEPLOY_ENABLED`
在首次手动部署和 HTTPS 验收完成前保持关闭。手动运行允许输入已发布镜像的完整 SHA，用于重新部署或应用版本回滚。

## 生产保护

GitHub `production`
Environment 应启用人工审批。SSH 保留主机身份校验和连接超时；服务器安全组只开放 Web 所需的 80/443，并将 SSH 来源限制到实际需要的范围。部署账户密码不进入仓库或
`.env.production`。生产配置文件权限设为仅部署账户可读。

GitHub 托管 Runner 的出口地址会变化，因此密码 SSH 部署要求安全组允许当前 Runner 访问 SSH 端口。安全组维护 GitHub
Actions 公布的地址范围或组织提供的固定出口地址，不长期向 `0.0.0.0/0`
开放 SSH。workflow 不自动修改安全组；地址范围失效时部署明确失败，不放宽规则重试。

部署命令使用失败即停止策略。Nginx 配置只有在 `nginx -t`
通过后才 reload。容器端口绑定在回环地址，避免绕过宿主机的 HTTPS 和站点规则。数据库命名卷不会在普通发布、镜像回滚或
`docker compose up` 时删除；删除卷必须作为独立人工操作。

## 上线所需输入

执行服务器配置前需取得 ECS 公网 IP、SSH 端口、用户名和密码，并确认实例为
`x86_64`，与当前 `linux/amd64`
镜像一致。还需具备域名 DNS、GitHub 仓库 Environment、微信公众号后台和 ECS 安全组的配置权限。

服务器的 `.env.production` 必须提供全部生产密钥。当前本地 `.env`
不能直接作为生产配置，且尚未定义
`POSTGRES_PASSWORD`、`DINGTALK_CALLBACK_SECRET`、 `REDEEM_CODE_ACTIVE_KEY_ID` 和
`REDEEM_CODE_KEYS`。

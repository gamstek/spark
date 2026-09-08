# Project Spark GitHub Actions 发布流水线设计

## 目标与边界

将现有 GitHub
Actions 重构为清晰的持续集成、制品发布和生产部署三层流水线。普通 PR 与 `main`
提交只验证代码；只有手动发布或严格的 `v*`
SemVer 标签才构建并推送生产镜像。生产部署必须经过 GitHub `production`
Environment 的人工审批。

本次继续使用 GHCR、单台阿里云 ECS、Docker
Compose、宿主机 Nginx 和密码 SSH。PostgreSQL 仍是 ECS 上的独立容器，不增加
`pg_dump` 或自动备份。流水线不引入 `latest`
镜像、不自动创建 Git 标签，也不修改 DNS、安全组或 GitHub Environment 设置。

## 文件结构

保留三个顶层 workflow，并增加一个仓库内 composite action：

- `.github/workflows/ci.yml`：PR、`main` 和复用调用的质量门。
- `.github/workflows/release.yml`：手动或版本标签触发的发布编排器。
- `.github/workflows/deploy-production.yml`：可复用且可手动触发的 ECS 部署。
- `.github/actions/setup-node-pnpm/action.yml`：统一 Node、pnpm 与依赖缓存设置。

删除旧文件名，避免同一流程存在两个入口。可复用 workflow 之间只通过声明的 inputs、outputs 和 secrets 通信。

## 持续集成

`ci.yml` 响应针对 `main` 的 pull request、`main` push 和
`workflow_call`。同一 ref 的新运行取消旧运行；发布和生产部署使用不同并发组，不受 CI 取消影响。

质量门拆为可独立定位失败的任务：

1. `static`：工作流脚本测试、ESLint 和 TypeScript 类型检查。
2. `unit`：Vitest 单元测试。
3. `build`：Turborepo 生产构建。
4. `integration`：启动 PostgreSQL，执行迁移、模板兼容检查和 API 集成测试。
5. `e2e`：启动 PostgreSQL，安装 Chromium 并运行现有 Playwright 场景。

每个任务设置超时，使用锁文件缓存 pnpm store。数据库任务继续使用名称包含 `test`
的测试库。CI 不使用生产 secrets，也不根据路径跳过 required checks。

## 发布流程

`release.yml` 只响应 `workflow_dispatch` 和匹配 `v*`
的标签 push。工作流首先把触发来源归一化为 `source_sha` 和 `version`：

- 标签必须匹配 `vMAJOR.MINOR.PATCH`，可带 SemVer prerelease，例如
  `v1.2.0-rc.1`。
- 标签指向的提交必须是远端 `main` 的祖先。
- 手动发布使用运行界面选定 ref 的 `github.sha`，生成 `manual-<短 SHA>`
  显示版本；该提交同样必须属于 `main`。

验证通过后调用
`ci.yml`。质量门成功才分别构建 API 和 Web 镜像。两个构建任务输出 OCI
digest，并发布以下引用：

- `ghcr.io/gamstek/spark-api:sha-<完整提交 SHA>`；
- `ghcr.io/gamstek/spark-web:sha-<完整提交 SHA>`；
- 标签发布额外写入对应的 `vX.Y.Z` 标签。

构建启用 BuildKit
provenance 和 SBOM。部署不使用上述标签定位内容，而使用本次构建返回的
`image@sha256:...`，确保发布后镜像内容不能因标签移动而改变。只有 API 和 Web 都发布成功后才调用生产部署。

## 生产部署与回滚

`deploy-production.yml` 支持两种调用方式：

- 发布流水线传入 `source_sha`、`version`、API digest 和 Web digest；
- 手动回滚输入已发布的完整 `source_sha`，工作流从对应 `sha-<source_sha>`
  标签解析两个 digest，再按 digest 部署。

工作流验证 SHA、digest 和版本格式，并确认源码提交属于 `main`。部署 job 使用
`environment: production` 和固定并发组
`production-aliyun-ecs`，`cancel-in-progress` 为
`false`。生产 Environment 必须在 GitHub 设置 required
reviewer、防止发起人自审，并只允许受保护的版本标签和默认分支。生产 secrets 只保存在该 Environment；审批完成前 runner 不能读取它们。

ECS 目录使用版本化结构：

```text
/opt/spark/
├── .env.production
├── current -> releases/<release-id>
└── releases/<release-id>/
    ├── compose.production.yaml
    ├── .env.release
    └── release.json
```

`release.json`
记录版本、源码 SHA、配置 SHA、两个镜像 digest 和部署时间。上传完成后，服务器以固定 Compose
project 名 `spark` 启动候选版本，再检查
`http://127.0.0.1:18080/api/health/ready`。成功后更新
`current`；失败时使用部署前记录的版本目录恢复两个旧 digest 并再次检查健康状态。流水线报告首次部署失败与回滚结果，不把回滚成功描述为发布成功。

数据库迁移不能随应用镜像回滚。后续迁移必须遵守 expand/contract：先增加兼容结构，待旧版本不再可能回滚后再删除旧结构。首次没有上一版本时，健康检查失败只停止候选服务并明确失败。

## 权限与供应链安全

workflow 顶层默认 `contents: read`。只有镜像发布任务获得
`packages: write`；provenance 所需权限只授予构建任务；生产 secrets 只授予引用
`production` Environment 的部署任务。所有外部 Action 固定到完整 commit
SHA，checkout 禁用持久化凭据。

继续使用 `sshpass -e` 从 `ECS_PASSWORD` 读取密码，保留严格 `known_hosts`
校验、连接超时和密码不落盘要求。发布日志和 job
summary 只显示版本、源码 SHA、配置 SHA、镜像 digest、部署结果和回滚结果，不显示密码或业务配置。

## 失败行为

- 任一 CI 任务失败：不构建镜像。
- 任一镜像构建或推送失败：不进入生产审批，不生成可部署发布。
- 环境审批拒绝或超时：镜像保留，ECS 不变。
- SSH、上传或输入校验失败：ECS 当前版本不变。
- 容器启动或本地健康检查失败：尝试恢复上一版本并让工作流失败。
- 回滚也失败：保留现场状态，输出 Compose 状态和经过脱敏的最近日志，要求人工处理。
- 公网健康检查失败：工作流失败并报告；本地服务已健康时不自动回滚，避免 DNS 或证书故障造成错误回滚。

## 验证与仓库设置

本地验证包括 Prettier、`actionlint`、触发器和权限断言、release 输入校验脚本测试、Compose 渲染，以及 API/Web 镜像构建。代码相关修改完成后运行
`pnpm verify`。

GitHub 仓库需要人工完成以下设置：

1. 将 `ci.yml` 的五个任务设为 `main` required checks。
2. 保护 `v*` 标签，限制创建和更新权限。
3. 为 `production` Environment 配置 required
   reviewer、防自审和部署 tag/branch 规则。
4. 将 ECS secrets 仅保存在 `production` Environment。
5. 首次手动发布和部署验证成功后，再创建第一个版本标签。

若当前 GitHub 套餐不支持私有仓库的 required
reviewer，不得把标签发布视为已具备人工审批；应继续只用手动部署，直到升级套餐或接入等价的外部审批机制。

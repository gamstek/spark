# apps/staff 工作人员核销端静态高保真 Demo 实现计划

## Context（背景）

微信营销抽奖项目已具备 `apps/activity`（用户端静态 Demo，本地状态机推进）与后端 STAFF 核销 API（`POST /staff/auth/login`、`POST staff/redemptions/lookup|confirm`、`GET staff/activities`）。用户端设计稿已落地并验收。

本轮为用户提供 13 张 **工作人员核销端** 蓝湖设计稿（375×769 移动端 H5），目标是仿照 `apps/activity` 构建一个**静态、可交互、高保真的 React Demo**（不接后端），供设计/产品验收；后端 STAFF 契约已存在，后续可无缝切换为真实接口驱动。

`apps/staff` 当前是空壳：仅 `index.html`/`main.tsx`/`app.tsx`(两条占位路由)/`styles.css`(无 token)/`vite-env.d.ts`。`vite.config.ts` 已设 `base:'/staff/'`、dev 端口 5174、`/api` 代理。

## 范围边界

- 只做前端静态 Demo：无真实网络请求、无 STAFF 会话校验、无 CSRF。
- UI 由 13 张蓝湖稿重构为规范化 React + Tailwind v4 组件，不接后端 API。
- 复用 `apps/activity` 已沉淀的模式：`PageShell`、`ActionButton`、`StatusTag`（复制到 staff，不跨 app 引用）、`styles.css @theme` token、`import.meta.glob` 切片加载、dev 逐屏工具栏。
- **登录页：必须包含。** 依据：需求文档（MVP 第八节 8.1、V1.0 业务需求 5.1）均明确「工作人员账号 + 密码登录，管理员创建账号」；后端确留 `POST /staff/auth/login`（`apps/api/src/auth/auth.controller.ts` 的 `StaffAuthController`）；验收文档确认扫码核销为真实业务范围。13 张稿未画登录屏属漏画，不作为「不需要」依据。Demo 阶段登录页用本地 mock（用户名+密码 → 进工作台），UI 语义与 `POST /staff/auth/login` 对齐，后续无缝切换真实接口。

## 13 屏 → 应用结构映射

导航骨架：登录后为「三大 Tab（首页 / 奖品管理 / 我的）+ 各子页」。子页无底部 Tab。

| 设计稿 | 页面/路由 | 类型 |
|--------|----------|------|
| （补，mock）登录 | `/login` 账号+密码 | 首屏（不属 13 张） |
| 工作人员首页 | `/` 工作台（Tab 首页） | Tab 页 |
| 选择活动 | 弹层（挂工作台，首次进入/切换） | 弹层 |
| 我的 | `/profile` 个人中心（Tab 我的） | Tab 页 |
| 奖品管理 | `/prizes` 奖品库存列表（Tab 奖品管理） | Tab 页 |
| 奖品管理-编辑 | `/prizes/:id` 库存 `+/-` 步进编辑 | 子页 |
| 扫码 | `/scan` | 子页 |
| 输入兑奖码 | `/enter` | 子页 |
| 核销信息确认 | `/redeem/confirm` | 子页 |
| 核销成功 | `/redeem/success` | 结算页 |
| 已核销 | `/redeem/already` | 结算页 |
| 我的待办-全部 / 未核销 | `/todos`（Tab 筛选 全部/已核销/待核销） | 子页 |
| 奖品库存 | （并入 `/prizes`，见上） | Tab 页 |

## 目录结构

```
apps/staff/src/
├── app.tsx                    # 改写：Theme + BrowserRouter(basename=/staff) + StaffRuntimeProvider + 路由
├── main.tsx                   # 保持
├── styles.css                 # 改写：Tailwind v4 @theme 设计 token
├── lib/
│   ├── runtime.tsx            # StaffRuntimeProvider + useStaff（本地状态机：tab、活动、兑奖码、核销记录、step）
│   ├── demo-data.ts           # Demo 常量：活动、奖品库存、核销记录列表（全部/已核销/待核销）
│   └── tokens.ts              #（可选）状态文案/颜色映射（待核销橙、已核销绿等）
├── pages/
│   ├── login-page.tsx         # mock 登录
│   ├── app-shell.tsx          # Tab 容器（首页/奖品管理/我的 + 底部 tab 栏）
│   ├── home-page.tsx          # 工作台：活动卡、统计卡、扫一扫/手动入口、最近核销
│   ├── select-activity.tsx    # 底部弹层选择活动
│   ├── profile-page.tsx       # 我的
│   ├── prize-stock-page.tsx   # 奖品库存列表 + 编辑入口
│   ├── prize-edit-page.tsx    # 单个奖品库存 +/- 步进
│   ├── scan-page.tsx          # 相机取景页（静态示意 + 扫码完成跳转）
│   ├── enter-code-page.tsx    # 手输兑奖码
│   ├── redeem-confirm-page.tsx# 核销信息确认（确认发放/取消）
│   ├── redeem-success-page.tsx# 核销成功 / 已核销
│   └── todos-page.tsx         # 我的待办（Tab：全部/已核销/待核销）列表
└── components/
    ├── page-shell.tsx         # 375×769 容器（从 activity 复制调整）
    ├── action-button.tsx      # 主按钮（红底 286×51.5 白字 18px）
    ├── status-tag.tsx         # 状态胶囊（待核销橙/已核销绿/已过期，55×21）
    ├── bottom-tab-bar.tsx     # 底部 Tab（首页/奖品管理/我的，图标+12px 标签）
    ├── stat-card.tsx          # 工作台三列统计卡（图标圆 45 + 蓝 24px 数值）
    ├── activity-card.tsx      # 渐变活动横幅
    ├── list-row.tsx           # 核销记录行（淡蓝头像圆 + 两行信息 + 时间 + 状态胶囊）
    ├── prize-row.tsx          # 奖品库存行（序号圆 + 名 + 数量）
    ├── select-sheet.tsx       # 底部选择弹层（复用 select-activity）
    ├── scan-frame.tsx         # 扫码取景框 + 绿色四角描边
    └── dev-step-toolbar.tsx   # Demo 逐屏导航（DEV 门控）
```

## 设计 Token（styles.css，Tailwind v4 @theme）

参考 13 张稿与 activity，统一到 staff：

```css
@import "tailwindcss";
@theme {
  --color-brand:  #cf102c;  /* 主操作红（按钮/强调） */
  --color-blue:   #4b66d5;  /* 品牌蓝：统计数值/高亮 tab/核销成功标题 */
  --color-green:  #51b643;  /* 已核销绿 */
  --color-wait:   #f28e52;  /* 待核销橙 */
  --color-ink:    #333333;  /* 主文字 */
  --color-sub:    #666666;  /* 次文字 */
  --color-weak:   #999999;  /* 弱文字 */
  --color-line:   #cbcbcb;  /* 边框 */
  --color-canvas: #f4f5f9;  /* 内容区浅灰底 */
  --color-scan:   #393939;  /* 扫码页深色底 */
  --font-body: 'Alibaba PuHuiTi 3.0','PingFang SC','Microsoft YaHei',sans-serif;
}
```
字号规范：页头标题 18px 居中；主按钮文字 18px；列表正文 12–15px；统计数值 24px。

## 状态机（core）

- `StaffRuntimeProvider` 暴露：`{ tab, goTab, scanDestination, code, setCode, currentActivity, pickActivity, records, step }`。
- 推进链路（覆 key 遍历 13 屏）：
  - `login → home`
  - `home`（首次选活动：`select-activity` 弹层）→ `scan` 或 `enter`
  - `scan`（示意扫码完成）/ `enter`（输入码）→ `redeem-confirm`
  - `redeem-confirm`：`确认发放 → redeem-success`；`取消 → home`
  - 已核销码：`enter/already → redeem-already`
  - `home` 的「最近核销 → 查看全部」→ `todos`（Tab 全部/待核销/已核销）
- `?step=` query 直链预览 + dev 工具栏枚举全部页面（复用 activity 模式）。

## 关键文件

- 改：`apps/staff/src/app.tsx`、`apps/staff/src/styles.css`
- 新增：`apps/staff/src/lib/*`、`apps/staff/src/pages/*`、`apps/staff/src/components/*`
- 复制自 activity 后按 staff 调整：`page-shell.tsx`、`action-button.tsx`、`status-tag.tsx`（staff 三种状态沿用 activity 语义；`RedemptionStatus` 类型复用 `packages/contracts` 或本地定义）
- 参考：`apps/activity/src/`（结构/坐标写法）、13 张蓝湖稿（`docs` 无归档，坐标以本次分析为准）

## 验证方式

- 预览：`pnpm --filter @spark/staff dev` → `http://localhost:5174/staff/`，加 `?step=` 或 dev 工具栏逐屏遍历 13 屏。
- 类型/规范：`pnpm --filter @spark/staff typecheck`、`pnpm --filter @spark/staff lint`、`pnpm --filter @spark/staff build`。
- 格式化：`pnpm exec prettier --write apps/staff/src`。
- 验收：登录 → 选活动 → 扫/输码 → 确认 → 成功/已核销；`/todos` 三种筛选 tab 切换；`/prizes` 进编辑步进库存。
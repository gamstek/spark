# apps/activity 静态高保真可交互 Demo 实现计划

## Context（背景）

`apps/activity` 当前是纯占位空应用（`app.tsx` 只有一个打印 activityCode 的占位路由），而微信 H5 营销抽奖系统的用户活动端需求（`docs/project-spark-v1-business-requirements.md` 第四章）与后端状态机已就绪。蓝湖「抽奖小程序-用户端」分组共 **11 张设计稿**已全部提取并归档到 `docs/activity-ui-lanhu-prototype.md`。

本轮目标：**用真实设计稿构建一个静态、可交互、高保真的 React Demo**（不接后端 API），供设计/产品验收。Demo 采用「单 `:activityCode` 路由 + 本地状态机推进」的真实形态，便于后续无缝切换到后端 `RuntimeStep` 驱动。

## 范围边界

* 只做前端静态 Demo，无登录、无 API 请求、不使用 TanStack Query 取数。

* UI 由 11 张蓝湖稿（375×769 移动端画布）重构为规范化 React + Tailwind 组件，**不照搬 Sketch 绝对定位 HTML**。

* 不新增 packages、不新建共享 UI 包；全部落在 `apps/activity/src`。

* 新增 workspace 依赖仅 `@spark/contracts`（取权威 `RuntimeStep`/`WinView`/`RedemptionStatus` 类型）。

## 11 屏 → 状态机映射

后端 `RuntimeStep`（`packages/contracts/src/index.ts`）：`NOT_STARTED | SUBSCRIBE | FORM | WAITING_FORM | LOTTERY | OUT_OF_STOCK | PRIZE | REDEEMED | EXPIRED | ENDED`

| 蓝湖屏    | 对应 step                  | 页面组件                                  |
| ------ | ------------------------ | ------------------------------------- |
| 进入活动   | NOT\_STARTED             | `home-page`                           |
| 活动说明   | (子页/from home)           | `activity-info-page`                  |
| 用户活动协议 | (表单前置弹层)                 | `privacy-modal`                       |
| 扫码关注   | SUBSCRIBE                | `subscribe-page`                      |
| 关注成功   | FORM 前置确认                | `follow-success-page`                 |
| 填写活动信息 | FORM                     | `form-page`（首版为钉钉表单，Demo 保留原稿可预览）     |
| 提交成功   | WAITING\_FORM            | `submit-success-page`                 |
| 抽奖中    | LOTTERY / OUT\_OF\_STOCK | `lottery-page`                        |
| 恭喜中奖   | PRIZE                    | `prize-page`                          |
| 我的奖品   | REDEEMED / EXPIRED       | `redemption-page`                     |
| 核销成功   | 完成态                      | `redeemed-success-page`（标注为 staff 场景） |

## 目录结构

```
apps/activity/src/
├── app.tsx                    # 改写：Theme + BrowserRouter 单路由 + DemoRuntimeProvider
├── main.tsx                   # 不变
├── styles.css                 # 改写：Tailwind v4 @theme 设计 token
├── assets/screens/            # 11 张背景图（从蓝湖下载落地）
├── lib/
│   ├── runtime.tsx            # DemoRuntimeProvider + useDemoRuntime（伪后端状态机）
│   ├── runtime-steps.ts       # RuntimeStep → 页面 key 映射、推进表、标签色
│   ├── activity.ts            # Demo 活动详情常量（标题/时间/主办方/规则/说明文案）
│   ├── prizes.ts              # 奖品数据（六宫格 + 活动说明 6 条）
│   └── redemption.ts          # 兑奖数据（兑奖码、状态、二维码内容）
├── pages/
│   ├── home-page.tsx          # 进入活动
│   ├── activity-info-page.tsx # 活动说明
│   ├── subscribe-page.tsx     # 扫码关注
│   ├── follow-success-page.tsx# 关注成功
│   ├── form-page.tsx          # 填写活动信息
│   ├── submit-success-page.tsx# 提交成功
│   ├── lottery-page.tsx       # 抽奖中
│   ├── prize-page.tsx         # 恭喜中奖
│   ├── redemption-page.tsx    # 我的奖品
│   ├── redeemed-success-page.tsx # 核销成功
│   └── runtime-scene.tsx      # step → <Page> 分发
└── components/
    ├── page-shell.tsx         # 移动端 375 容器 + 背景图/渐变兜底
    ├── action-button.tsx      # 胶囊主按钮 292.5×58
    ├── status-tag.tsx         # 状态标签（待核销橙等）
    ├── app-qr.tsx             # 二维码方片容器
    ├── prize-grid.tsx         # 抽奖六宫格
    ├── bottom-entries.tsx     # 首页 规则/说明/我的奖品 三入口
    ├── privacy-modal.tsx      # 用户活动隐私协议弹层
    └── dev-step-toolbar.tsx   # Demo 步骤导航工具栏（仅开发期）
```

## 设计 Token（styles.css，Tailwind v4 @theme）

```css
@import "tailwindcss";
@theme {
  --color-brand: #cf102c;   /* 品牌红 rgba(207,16,44,1) */
  --color-prize: #f53c3c;   /* 奖品文字红 */
  --color-wait:  #f28e52;   /* 待核销橙 */
  --color-win:   #af4bc2;   /* 中奖紫 */
  --color-win2:  #4664d4;   /* 核销成功蓝紫 */
  --color-ink:   #333333;   /* 主文字 */
  --color-sub:   #666666;   /* 次要文字 */
  --color-line:  #cbcbcb;   /* 边框 */
  --color-canvas:#f4f5f9;   /* 页面浅灰底 */

  --font-display: 'Alibaba PuHuiTi 3.0', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-body:    'Microsoft YaHei', 'PingFang SC', sans-serif;
}
```

字号规范（375 画布）：标题 18–20px、大标题 40px(font-display)、正文 15px、辅助 12px。

## 路由与状态机（核心）

* **单路由**：保留真实形态 `Route path=":activityCode"`（用 `path="*"` 兜底到 ActivityEntry），切换活动时 `key={activityCode}` 重置状态机。

* `lib/runtime.tsx` 暴露 `{ step, go(step), reset(), win }`。`go()` 通过推进表 `TRANSITIONS` 约束；dev 工具栏走自由跳转分支。

* 可选 `?step=X` query 提供直链预览；`sessionStorage` 持久化 `lastStep` 模拟「已参与回访」。

* dev 工具栏用 `import.meta.env.DEV` 门控，固定悬浮，枚举全部 step，供验收逐屏查看。

* `RuntimeStep`/`WinView`/`RedemptionStatus` 从 `@spark/contracts` 导入类型，保证与后端枚举一致。

## 组装浏览器数据 / 图片落地

11 张背景图完整 URL 见 `docs/activity-ui-lanhu-prototype.md` 第四章资源表（`https://alipic.lanhuapp.com/<file>`）。落地步骤：用一次性脚本下载到 `apps/activity/src/assets/screens/`，**不热链蓝湖域名**（无 SLA/防盗链，生产不可依赖）。每屏 `PageShell` 背景图 + 顶部纯色渐变兜底，离线也可展示。

## 实施顺序

1. `styles.css` 加 `@theme` token
2. `lib/`（runtime/provider、activity/prizes/redemption 常量、runtime-steps 映射）
3. 下载 11 张背景图到 `assets/screens/`
4. `components/`（page-shell、action-button、status-tag、app-qr、prize-grid、bottom-entries、privacy-modal、dev-step-toolbar）
5. `pages/` 11 屏 + `runtime-scene.tsx`
6. 改写 `app.tsx`（单路由 + Provider）
7. 本地 dev 逐屏比对蓝湖坐标与字号

## 关键文件

* 改：`apps/activity/src/app.tsx`、`apps/activity/src/styles.css`

* 新增：`apps/activity/src/lib/*`、`apps/activity/src/pages/*`、`apps/activity/src/components/*`

* 依赖：`apps/activity/package.json` 增加 `@spark/contracts`

* 参考：`docs/activity-ui-lanhu-prototype.md`、`docs/project-spark-v1-business-requirements.md`、`apps/admin/src/api.ts`（CSRF/client 模式，接后端时用）

## 待确认事项（不阻塞 Demo 首版）

1. **我的奖品「已兑奖/已过期」两态**：当前仅「待核销」一份原稿；Demo 用 `StatusTag` 支持三色，已兑/过期以组件占位展示。
2. **填写活动信息 / 用户活动协议**：首版已改钉钉表单外链，但原稿仍在；Demo 保留为可预览屏，落地接后端时 FORM step 将改为外链跳转。
3. **核销成功「返回工作台」**：按钮文案为 staff 场景；C 端完成态 Demo 标注待确认（可能改为「返回首页」）。
4. **表单字段（职位/所在城市/感兴趣的产品）**：与需求 4.3 省字段表（仅姓名/手机/公司必填）略有出入，Demo 按原稿还原。

## 验证方式

* 预览：`pnpm --filter @spark/activity dev` → `http://localhost:5173/activity/<任意code>`，加 `?step=` 或点 dev 工具栏遍历 11 屏。

* 类型/规范：`pnpm --filter @spark/activity typecheck`、`pnpm lint`、`pnpm --filter @spark/activity build`。

* 格式化：`pnpm exec prettier --write apps/activity/src`。

* 验收路径：点击各 CTA 验证状态机推进与回访刷新恢复。


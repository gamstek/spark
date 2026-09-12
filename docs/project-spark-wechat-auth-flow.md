# Project Spark（火花）

> **实施规则更新（2026-09-12）**：下文 OAuth 流程与代码是保留能力的历史设计示例，不是当前表单的前提。当前生产使用
> `ACTIVITY_IDENTITY_MODE=anonymous`；首次打开活动链接建立浏览器匿名会话，FORM 步骤直接展示固定 13 题自有报名表。
>
> `POST /api/activity/:code/form-submissions`
> 使用活动会话及 CSRF 校验，在同一事务中保存首次答案并确认留资，重复提交不覆盖。提交成功后显示确认页，点击“去抽奖”再刷新 runtime；后台提供完整答案详情与分列导出。抽奖使用活动奖池锁及事务，没有可选抽奖结果时不消耗资格，已中奖结果优先恢复。当前配置以[配置说明](project-spark-configuration.md)为准，下文示例路由不作为自有表单实现依据。
>
> 部署前由获授权运维人员按[部署指南](project-spark-deployment.md)手动清空该应用数据库，再执行 `db:migrate` 创建当前结构；旧报名/回调答案不会迁移。

> H5 营销抽奖系统 · 微信无感身份与活动状态流程设计\
> Version: V1.0 MVP

## 1. 项目代号

**Project Spark（火花）**

"Spark"代表一次营销触达：扫码进入、关注、留资、抽奖、兑奖，最终沉淀为销售线索。

建议项目命名：

-   `spark-h5`：用户 H5 / 工作人员移动端
-   `spark-api`：后端服务
-   `spark-admin`：PC 管理后台

------------------------------------------------------------------------

## 2. 核心设计

当前采用 **纯微信内 H5**，不依赖小程序审核。

1.  用户扫描活动二维码进入 H5。
2.  首次进入立即执行微信公众号 `snsapi_base` 静默 OAuth。
3.  后端通过 OAuth `code` 获取公众号 `openid`。
4.  使用 `openid` 查找或静默创建系统内部匿名用户。
5.  后端建立自己的 Session。
6.  使用 `User + Activity` 查询用户在当前活动中的参与状态。
7.  后端统一计算 `nextStep`。
8.  H5 根据 `nextStep` 展示对应页面。
9.  用户刷新、退出或重新扫码，都恢复已有业务状态。

------------------------------------------------------------------------

## 3. 整体流程

``` text
用户扫描活动二维码
        ↓
进入 H5 活动地址
        ↓
是否已有 H5 Session？
   ├─ 否 → 微信 snsapi_base 静默 OAuth
   │          ↓
   │       获取 code
   │          ↓
   │       后端换取公众号 OpenID
   │          ↓
   │       创建 / 查询内部 User
   │          ↓
   │       建立 H5 Session
   │
   └─ 是 ─────────────────────┐
                              ↓
                    查询 User + Activity 状态
                              ↓
                     后端计算 nextStep
                              ↓
        SUBSCRIBE / FORM / LOTTERY / PRIZE / REDEEMED
                              ↓
                     H5 展示对应页面
```

------------------------------------------------------------------------

## 4. 活动二维码

``` text
https://lottery.example.com/activity/ACT001?channel=salesA
```

-   `ACT001`：活动 ID
-   `channel=salesA`：渠道来源

------------------------------------------------------------------------

## 5. 用户第一次进入 H5

``` ts
async function onPageLoad() {
  const activityId = getActivityId()
  const channel = getQuery("channel")

  if (!hasSession()) {
    redirect(`/api/auth/wechat?activityId=${activityId}&channel=${channel}`)
    return
  }

  await loadActivityState(activityId)
}
```

用户不需要点击"微信登录"，首次进入即自动开始身份识别。

------------------------------------------------------------------------

## 6. 发起微信静默 OAuth

``` ts
GET /api/auth/wechat

function startWechatOAuth(req, res) {
  const { activityId, channel } = req.query

  const state = encodeState({
    activityId,
    channel
  })

  const callbackUrl =
    "https://lottery.example.com/api/auth/wechat/callback"

  const oauthUrl =
    "https://open.weixin.qq.com/connect/oauth2/authorize" +
    `?appid=${WECHAT_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&response_type=code` +
    `&scope=snsapi_base` +
    `&state=${state}` +
    `#wechat_redirect`

  res.redirect(oauthUrl)
}
```

`snsapi_base` 用于静默身份识别。本阶段只需要获得公众号侧
`openid`，不获取头像、昵称等资料。

------------------------------------------------------------------------

## 7. OAuth 回调与匿名用户建立

``` ts
GET /api/auth/wechat/callback?code=xxx&state=xxx

async function wechatCallback(req, res) {
  const code = req.query.code
  const { activityId, channel } = decodeState(req.query.state)

  // OAuth code → OpenID
  const oauthResult = await wechat.exchangeCode(code)
  const openid = oauthResult.openid

  // OpenID → 系统内部 User
  let user = await db.user.findOne({
    wechatOpenid: openid
  })

  if (!user) {
    user = await db.user.create({
      id: generateUserId(), // USER_8F38A2C...
      wechatOpenid: openid,
      createdAt: now()
    })
  }

  await recordVisit({
    userId: user.id,
    activityId,
    channel,
    visitedAt: now()
  })

  // 建立 H5 自己的会话
  const session = createSession({
    userId: user.id
  })

  setHttpOnlyCookie(res, "session", session)

  res.redirect(`/activity/${activityId}?channel=${channel}`)
}
```

身份链路：

``` text
微信用户
   ↓
OpenID
   ↓
内部 User
   ↓
H5 Session
```

------------------------------------------------------------------------

## 8. 用户身份模型

``` text
User
├── id                 // USER_xxx，内部业务 ID
├── wechat_openid      // 微信公众号 OpenID
├── created_at
└── updated_at
```

职责：

-   `openid`：识别"这个微信用户是谁"
-   `User.id`：作为系统内部统一业务主键

不建议直接把 OpenID 当作业务主键。

------------------------------------------------------------------------

## 9. 用户与活动关系

``` text
ActivityParticipation
├── id
├── user_id
├── activity_id
├── form_submitted
├── lottery_qualified
├── lottery_completed
├── redeemed
├── created_at
└── updated_at
```

同一个用户可以参加多场活动，因此"一人一次"默认含义是：

> 同一个 User 在同一个 Activity 中只能成功抽奖一次。

------------------------------------------------------------------------

## 10. 获取当前活动状态

``` ts
GET /api/activity/:activityId/my-state

async function getMyActivityState(req, res) {
  const userId = req.session.userId
  const activityId = req.params.activityId

  const user = await db.user.findById(userId)

  // 查询公众号关注状态
  const wxUser =
    await wechat.getUserInfo(user.wechatOpenid)

  const subscribed =
    wxUser.subscribe === 1

  const participation =
    await getOrCreateParticipation(
      userId,
      activityId
    )

  const winRecord =
    await db.winRecord.findOne({
      userId,
      activityId
    })

  const redeemRecord =
    await db.redeemRecord.findOne({
      userId,
      activityId
    })

  const nextStep =
    resolveNextStep({
      subscribed,
      participation,
      winRecord,
      redeemRecord
    })

  res.json({
    nextStep,
    subscribed,
    formSubmitted: participation.formSubmitted,
    lotteryCompleted: participation.lotteryCompleted,
    prize: winRecord?.prize ?? null,
    redeemCode: winRecord?.redeemCode ?? null,
    redeemed: redeemRecord?.status === "REDEEMED"
  })
}
```

------------------------------------------------------------------------

## 11. 后端活动状态机

``` ts
function resolveNextStep(state) {
  if (state.redeemRecord?.status === "REDEEMED") {
    return "REDEEMED"
  }

  if (state.winRecord) {
    return "PRIZE"
  }

  if (
    state.participation.formSubmitted &&
    state.participation.lotteryQualified &&
    !state.participation.lotteryCompleted
  ) {
    return "LOTTERY"
  }

  if (!state.subscribed) {
    return "SUBSCRIBE"
  }

  return "FORM"
}
```

状态：

``` ts
enum NextStep {
  SUBSCRIBE = "SUBSCRIBE",
  FORM = "FORM",
  LOTTERY = "LOTTERY",
  PRIZE = "PRIZE",
  REDEEMED = "REDEEMED"
}
```

------------------------------------------------------------------------

## 12. H5 页面控制

``` ts
async function loadActivityState(activityId) {
  const state =
    await api.get(`/api/activity/${activityId}/my-state`)

  switch (state.nextStep) {
    case "SUBSCRIBE":
      showSubscribePage()
      break

    case "FORM":
      showFormPage()
      break

    case "LOTTERY":
      showLotteryPage()
      break

    case "PRIZE":
      showPrizePage(state.prize, state.redeemCode)
      break

    case "REDEEMED":
      showRedeemedPage()
      break
  }
}
```

原则：

> 前端负责体验，后端负责业务真相。

------------------------------------------------------------------------

## 13. 关注公众号后的重新检测

``` ts
async function onCheckSubscribe() {
  const result =
    await api.post("/api/wechat/check-subscribe")

  if (!result.subscribed) {
    toast("暂未检测到关注，请关注后再试")
    return
  }

  // 重新获取完整活动状态
  await loadActivityState(currentActivityId)
}
```

后端：

``` ts
POST /api/wechat/check-subscribe

async function checkSubscribe(req, res) {
  const user =
    await db.user.findById(req.session.userId)

  const wxUser =
    await wechat.getUserInfo(user.wechatOpenid)

  res.json({
    subscribed: wxUser.subscribe === 1
  })
}
```

------------------------------------------------------------------------

## 14. 提交表单并获得抽奖资格

``` ts
POST /api/activity/:activityId/form

async function submitForm(req, res) {
  const userId = req.session.userId
  const activityId = req.params.activityId

  await db.transaction(async tx => {
    const participation =
      await tx.participation.findForUpdate({
        userId,
        activityId
      })

    // 已提交过：保持幂等，不重复发资格
    if (participation.formSubmitted) {
      return
    }

    await tx.formSubmission.create({
      userId,
      activityId,
      data: req.body
    })

    await tx.participation.update({
      userId,
      activityId,
      formSubmitted: true,
      lotteryQualified: true
    })
  })

  res.json({ success: true })
}
```

关键原则：

> 表单提交必须幂等，重复点击、刷新、网络重试都不能重复获得抽奖资格。

------------------------------------------------------------------------

## 15. 抽奖

``` ts
POST /api/activity/:activityId/lottery

async function lottery(req, res) {
  const userId = req.session.userId
  const activityId = req.params.activityId

  const result =
    await db.transaction(async tx => {
      // 锁住参与记录
      const participation =
        await tx.participation.findForUpdate({
          userId,
          activityId
        })

      // 已抽过：返回原中奖结果
      if (participation.lotteryCompleted) {
        return tx.winRecord.findOne({
          userId,
          activityId
        })
      }

      if (!participation.lotteryQualified) {
        throw new Error("NO_LOTTERY_PERMISSION")
      }

      // 根据剩余库存抽奖
      const prize =
        await drawPrizeByRemainingStock(
          tx,
          activityId
        )

      // 扣减可中奖库存
      await tx.prize.decrementAvailableStock(
        prize.id
      )

      // 创建唯一中奖记录
      const win =
        await tx.winRecord.create({
          userId,
          activityId,
          prizeId: prize.id,
          redeemCode: generateSecureRedeemCode(),
          status: "WAIT_REDEEM"
        })

      await tx.participation.update({
        userId,
        activityId,
        lotteryCompleted: true
      })

      return win
    })

  res.json(result)
}
```

数据库层建议增加：

``` sql
UNIQUE(activity_id, user_id)
```

确保即使用户同时发送多个抽奖请求，也最多产生一条正式中奖记录。

------------------------------------------------------------------------

## 16. 用户刷新 / 重新扫码

  当前状态         再次进入
  ---------------- ---------------------
  未关注           关注引导页
  已关注、未填表   表单页
  已填表、未抽奖   抽奖页
  已中奖、未兑奖   中奖页 + 兑奖二维码
  已兑奖           已兑奖结果页

恢复过程：

``` text
关闭 H5
↓
重新扫码
↓
OAuth / Session 恢复 User
↓
查询 User + Activity
↓
读取已有状态
↓
恢复正确页面
```

因此关闭页面不会让用户重新获得一次参与机会。

------------------------------------------------------------------------

## 17. 核心数据关系

``` text
Wechat OpenID
      │
      ▼
    User
      │
      ├─────────────────────┐
      │                     │
      ▼                     ▼
ActivityParticipation   FormSubmission
      │
      ▼
  WinRecord ───────────→ Prize
      │
      ▼
 RedeemRecord
```

核心关系：

``` text
User + Activity = ActivityParticipation
```

------------------------------------------------------------------------

## 18. MVP 推荐接口

``` text
GET  /api/auth/wechat
     发起微信静默 OAuth

GET  /api/auth/wechat/callback
     微信 OAuth 回调

GET  /api/activity/:id/my-state
     获取当前用户活动状态

POST /api/wechat/check-subscribe
     重新检测公众号关注状态

POST /api/activity/:id/form
     提交活动表单

POST /api/activity/:id/lottery
     执行抽奖

GET  /api/activity/:id/prize
     查询当前用户中奖结果

POST /api/redeem/:code/confirm
     工作人员确认核销
```

------------------------------------------------------------------------

## 19. 一周 MVP 最重要的技术保障

相比页面配置、复杂数据分析等能力，V1.0 优先保证：

1.  **身份稳定**：OpenID 能稳定映射到内部 User。
2.  **状态可恢复**：用户退出、刷新、重新扫码不会重新开始。
3.  **表单幂等**：重复提交不会重复获得资格。
4.  **抽奖幂等**：同一用户同一活动只能中奖一次。
5.  **库存一致性**：并发抽奖不能造成超卖。
6.  **兑奖唯一性**：兑奖码只能成功核销一次。

------------------------------------------------------------------------

## 20. 最终模型

整个用户端可以简化理解为：

``` text
扫码
 ↓
微信 OAuth
 ↓
OpenID
 ↓
User
 ↓
User + Activity
 ↓
ActivityParticipation
 ↓
后端状态机 resolveNextStep()
 ↓
┌───────────┬──────┬─────────┬───────┬──────────┐
│ SUBSCRIBE │ FORM │ LOTTERY │ PRIZE │ REDEEMED │
└───────────┴──────┴─────────┴───────┴──────────┘
 ↓
H5 展示对应页面
```

**核心原则：H5
不决定用户有没有资格，所有关键业务状态都以后端记录为准。**

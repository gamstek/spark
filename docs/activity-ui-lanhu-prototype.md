# apps/activity 用户端 UI 对照文档（蓝湖「抽奖小程序-用户端」原型）

> 来源：蓝湖项目「引力波官网2026」分组「抽奖小程序-用户端」
> 数据方式：`mcp-lanhu` 提取（`lanhu_design` analyze，HTML + Design Tokens + Slices）
> 画布：全部为 **375 × 769** 移动端设计稿；HTML 为 Sketch 兜底生成（`DDS Schema unavailable for detailDetach`/`版本数据不存在`，以页面背景图 + 绝对定位图层呈现）
> 需求依据：[project-spark-v1-business-requirements.md](project-spark-v1-business-requirements.md) 第四章「用户活动端」

## 一、所属屏清单与流程映射

当前匿名用户端核心流程：**进入活动 → 填写自有表单 → 抽奖 → 中奖结果 → 兑奖二维码 → 我的兑奖状态**。下表保留原型屏幕索引，关注相关屏幕不属于当前匿名生产流程。

完整 11 屏（按用户流程排列）：

| # | 屏 | 对应需求 | 说明 |
| --- | --- | --- | --- |
| 1 | 进入活动 | 4.1 活动首页 | 活动标题/时间/主办方 + 立即参与 + 三入口(规则/说明/我的奖品) |
| 2 | 活动说明 | 4.1 子页 | 奖品介绍(6项) + 活动时间 + 幸运抽奖提示 |
| 3 | 用户活动协议 | 4.3 前置 | 隐私协议弹窗 + 复选「我已阅读《活动隐私协议》」 |
| 4 | 扫码关注 | 4.2 未关注 | 大字标题 + 公众号二维码 + 我已关注，立即验证 |
| 5 | 关注成功 | 4.2 已关注 | 成功图标 + 去填写信息 |
| 6 | 填写活动信息 | 4.3 表单 | 姓名*/手机/公司*/职位/城市/产品 + 提交信息 |
| 7 | 提交成功 | 4.3 完成 | 成功图标 + 去抽奖（同构「关注成功」） |
| 8 | 抽奖中 | 4.4 抽奖 | 奖品六宫格 + 立即抽奖 |
| 9 | 恭喜中奖 | 4.5 中奖结果 | 奖项 + 奖品 + 查看奖品 |
| 10 | 我的奖品 | 4.6 兑奖状态 | 兑奖码 + 核销二维码 + 待核销 + 出示说明 |
| 11 | 核销成功 | 5.3 核销 | 核销成功 + 时间/人员/核销点 + 返回工作台 |

> 实施更新（2026-09-12）：活动页采用自有固定 13 题表单，沿用现有品牌红、字体与表单布局。Q1–Q12 必填、Q13 可选，选中“其他”时显示必填说明；提交前须同意隐私协议。提交或网络失败时保留当前页面的填写内容并允许重试；刷新页面会重置尚未提交的内容。提交成功后显示确认页，点击“去抽奖”再刷新运行状态。后台提供完整详情和分列导出。下文原型中的旧字段仅供视觉参考，当前字段以共享表单定义为准。部署通过 `db:migrate` 前向升级；旧外部表单答案不迁移，关联用户需重新登记。

## 二、设计体系（跨屏 Design Tokens 汇总）

### 品牌色
| 名称 | 值 | 用途 |
| --- | --- | --- |
| 品牌红 | `rgba(207,16,44,1)` | 抽奖转盘/氛围、页面强调（多屏共现） |
| 奖品文字红 | `rgba(245,60,60,1)` | 抽奖屏奖品标签文字 |
| 主文字 | `rgba(51,51,51,1)` | 标题、正文主色 |
| 次要文字 | `rgba(102,102,102,1)` | 说明性文字（我的奖品·出示说明） |
| 边框灰 | `rgba(147,147,147,1)` / `rgba(203,203,203,1)` | 卡片边框 |
| 待核销橙 | `rgba(242,142,82,1)` | 状态标签「待核销」 |
| 中奖紫 | `rgba(175,75,194,1)` / `rgba(70,98,212,1)` | 恭喜中奖页强调色 |
| 页面背景 | `rgba(244,245,249,1)` / `rgba(246,246,246,1)` | 浅灰底 |

### 字体
| 值 | 用途 |
| --- | --- |
| Microsoft YaHei 400 | 绝大多数正文、按钮文字（字号 24-40px，对应 12-20pt） |
| Alibaba PuHuiTi 3.0 700 / 80px | 恭喜中奖大标题（常用于 H5 氛围感大字） |

### 主按钮
- 尺寸：`292.5 × 58px`（左右留白 43px，圆角大、胶囊形）
- 文字：18px 白色文字，水平居中
- 文案：进入活动=「立即参与」；抽奖屏=「立即抽奖」；中奖页=「查看奖品」
- 背景为品牌红系（输出 HTML 以 `<div class="elX" title="矩形 1626">` 形状承载，实际色值来自背景图）

## 三、逐屏明细

### 1. 进入活动（活动首页）— 需求 4.1
- 顶部主视觉 + 标语「参与抽奖赢礼品」
- 活动标题：「第八届新污染物环境健康风险及防控学术会议」（20px，居中）
- 信息行：「活动时间：2026.09.04 - 09.06 / 主办方：上海交通大学」（15px）
- CTA 按钮：「立即参与」（18px 白字）
- 底部三入口（12px + 40px 图标）：活动规则｜活动说明｜我的奖品

**图片资源**：`https://alipic.lanhuapp.com/PSUXPCovera683c39fe98f3791f571d591992d4ba5.png`（整页背景）
**切图**：4 张

```html
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Design</title><style>*{margin:0;padding:0;box-sizing:border-box}img{display:block}.design{position:relative;width:375px;height:769px;overflow:hidden;margin:0 auto;background:url(https://alipic.lanhuapp.com/PSUXPCovera683c39fe98f3791f571d591992d4ba5.png) no-repeat;background-size:375px 769px} .el1{position:absolute;left:0px;top:0px;width:375px;height:769px} .el2{position:absolute;left:0px;top:0px;width:375px;height:769px} .el3{position:absolute;left:0px;top:94px;width:375px;height:376px} .el4{position:absolute;left:0px;top:458.5px;width:375px;height:242px} .el5{position:absolute;left:54px;top:484.5px;width:266.5px;height:50px;z-index:10;color:#333;font-size:20px;font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-weight:400;text-align:center;line-height:30px} .el6{position:absolute;left:82.5px;top:559.5px;width:68.5px;height:44.5px;z-index:10;color:#333;font-size:15px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:right;line-height:30px} .el7{position:absolute;left:165px;top:559.5px;width:131px;height:43.5px;z-index:10;color:#333;font-size:15px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;line-height:30px} .el8{position:absolute;left:43px;top:623px;width:292.5px;height:58px} .el9{position:absolute;left:149.5px;top:638px;width:76.5px;height:18.5px;z-index:10;color:#FFF;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1} .el10{position:absolute;left:124px;top:53px;width:125px;height:18px;z-index:10;color:#333;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;line-height:1} .el11{position:absolute;left:0px;top:656.5px;width:375px;height:112.5px} .el12{position:absolute;left:39px;top:744.5px;width:47.5px;height:12px;z-index:10;color:#333;font-size:12px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:30px} .el13{position:absolute;left:43px;top:700px;width:40px;height:40px} .el14{position:absolute;left:164px;top:744.5px;width:47.5px;height:12px;z-index:10;color:#333;font-size:12px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:30px} .el15{position:absolute;left:168px;top:699.5px;width:40px;height:40px} .el16{position:absolute;left:289px;top:744.5px;width:47.5px;height:12px;z-index:10;color:#333;font-size:12px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:30px} .el17{position:absolute;left:292.5px;top:699.5px;width:40px;height:40px} .el18{position:absolute;left:124.5px;top:721px;width:1px;height:39.5px} .el19{position:absolute;left:249.5px;top:721px;width:1px;height:39.5px}</style></head><body><div class="design"><div class="el1" title="bg"></div><div class="el2" title="图层 644"></div><div class="el3" title="bg"></div><div class="el4" title="矩形 1640"></div><div class="el5" title="第八届新污染物环境健康风险 及防控学术会议">第八届新污染物环境健康风险 及防控学术会议</div><div class="el6" title="活动时间： 主办方：">活动时间： 主办方：</div><div class="el7" title="2026.09.04 - 09.06 上海交通大学">2026.09.04 - 09.06 上海交通大学</div><div class="el8" title="矩形 1626"></div><div class="el9" title="立即参与">立即参与</div><div class="el10" title="参与抽奖赢礼品">参与抽奖赢礼品</div><div class="el11" title="矩形 1640 拷贝"></div><div class="el12" title="活动规则">活动规则</div><div class="el13" title="矢量智能对象"></div><div class="el14" title="活动说明">活动说明</div><div class="el15" title="矢量智能对象"></div><div class="el16" title="我的奖品">我的奖品</div><div class="el17" title="矢量智能对象"></div><div class="el18" title="形状 1"></div><div class="el19" title="形状 1 拷贝"></div></div></body></html>
```

### 2. 抽奖中（抽奖页）— 需求 4.4
- 奖品转盘六宫格：小米充电宝、保温杯、定制手机支架、定制手提袋、手摇扇、定制笔记本（15px，奖品文字红 `rgba(245,60,60,1)`）
- CTA：「立即抽奖」（18px 白字，胶囊按钮）

**图片资源**：`https://alipic.lanhuapp.com/PSUXPCover2e6c9908d06aa83278b74319924be89a.png`
**切图**：3 张

```html
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Design</title><style>*{margin:0;padding:0;box-sizing:border-box}img{display:block}.design{position:relative;width:375px;height:769px;overflow:hidden;margin:0 auto;background:url(https://alipic.lanhuapp.com/PSUXPCover2e6c9908d06aa83278b74319924be89a.png) no-repeat;background-size:375px 769px} .el1{position:absolute;left:0px;top:0px;width:375px;height:769px} .el2{position:absolute;left:0px;top:0px;width:375px;height:769px} .el3{position:absolute;left:0px;top:192.5px;width:375px;height:375.5px} .el4{position:absolute;left:149.5px;top:285px;width:77.5px;height:14.5px;z-index:10;color:#f53c3c;font-size:15px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1} .el5{position:absolute;left:250px;top:314.5px;width:30.5px;height:42.5px;z-index:10;color:#f53c3c;font-size:15px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1} .el6{position:absolute;left:244.5px;top:398px;width:43px;height:50px;z-index:10;color:#f53c3c;font-size:15px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:18px} .el7{position:absolute;left:88.5px;top:405.5px;width:43.5px;height:45px;z-index:10;color:#f53c3c;font-size:15px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:18px} .el8{position:absolute;left:96px;top:315.5px;width:31px;height:43px;z-index:10;color:#f53c3c;font-size:15px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1} .el9{position:absolute;left:150px;top:470px;width:75px;height:15px;z-index:10;color:#f53c3c;font-size:15px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1} .el10{position:absolute;left:145.5px;top:321px;width:84.5px;height:99.5px} .el11{position:absolute;left:43px;top:573px;width:292.5px;height:58px} .el12{position:absolute;left:149.5px;top:589px;width:76.5px;height:18.5px;z-index:10;color:#FFF;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1} .el13{position:absolute;left:0px;top:0px;width:374.5px;height:769px}</style></head><body><div class="design"><div class="el1" title="bg"></div><div class="el2" title="bg"></div><div class="el3" title="形状 3"></div><div class="el4" title="小米充电宝">小米充电宝</div><div class="el5" title="保温杯">保温杯</div><div class="el6" title="定制手 机支架">定制手机支架</div><div class="el7" title="定制手 提袋">定制手提袋</div><div class="el8" title="手摇扇">手摇扇</div><div class="el9" title="定制笔记本">定制笔记本</div><div class="el10" title="图层 671"></div><div class="el11" title="矩形 1626"></div><div class="el12" title="立即抽奖">立即抽奖</div><div class="el13" title="图层 644"></div></div></body></html>
```

### 3. 恭喜中奖（中奖结果）— 需求 4.5
- 中奖主视觉：「组 2 / 组 3」承载祝贺动画与奖品图
- 奖项文字：「二等奖 定制手机支架」（18px，中奖紫 `rgba(175,75,194,1)`；大标题用 Alibaba PuHuiTi 700/80px）
- CTA：「查看奖品」（18px 白字胶囊）

**图片资源**：`https://alipic.lanhuapp.com/PSUXPCover8f64f83192e3d5378a52704b93b47861.png`
**切图**：3 张

```html
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Design</title><style>*{margin:0;padding:0;box-sizing:border-box}img{display:block}.design{position:relative;width:375px;height:769px;overflow:hidden;margin:0 auto;background:url(https://alipic.lanhuapp.com/PSUXPCover8f64f83192e3d5378a52704b93b47861.png) no-repeat;background-size:375px 769px} .el1{position:absolute;left:0px;top:0px;width:375px;height:769px} .el2{position:absolute;left:0px;top:0px;width:375px;height:769px} .el3{position:absolute;left:63px;top:122.5px;width:249.5px;height:95px} .el4{position:absolute;left:42px;top:222.5px;width:291px;height:289.5px} .el5{position:absolute;left:133px;top:432px;width:115.5px;height:50.5px;z-index:10;color:#af4bc2;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:25.3px} .el6{position:absolute;left:0px;top:0px;width:374.5px;height:769px} .el7{position:absolute;left:43px;top:543px;width:292.5px;height:58px} .el8{position:absolute;left:149px;top:559.5px;width:76px;height:18px;z-index:10;color:#FFF;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1}</style></head><body><div class="design"><div class="el1" title="bg"></div><div class="el2" title="bg"></div><div class="el3" title="组 2"></div><div class="el4" title="组 3"></div><div class="el5" title="二等奖 定制手机支架">二等奖 定制手机支架</div><div class="el6" title="图层 644"></div><div class="el7" title="矩形 1626"></div><div class="el8" title="查看奖品">查看奖品</div></div></body></html>
```

### 4. 扫码关注（关注公众号·未关注）— 需求 4.2
- 顶部标语「参与抽奖赢礼品」（18px）
- 大标题「关注公众号 参与抽奖」（Alibaba PuHuiTi 3.0 700 / 80px，白色，居中）
- 公众号二维码（271×271）
- 关注引导：「关注引力波智谱公众号 长按识别二维码关注」（18px，`rgba(58,58,58,1)`）
- CTA：「我已关注，立即验证」（18px 白字胶囊）

**图片资源**：`https://alipic.lanhuapp.com/PSUXPCover2bc609c60d3ebd83dfdf8a0f07d563fe.png`
**切图**：2 张

```html
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Design</title><style>*{margin:0;padding:0;box-sizing:border-box}img{display:block}.design{position:relative;width:375px;height:769px;overflow:hidden;margin:0 auto;background:url(https://alipic.lanhuapp.com/PSUXPCover2bc609c60d3ebd83dfdf8a0f07d563fe.png) no-repeat;background-size:375px 769px} .el1{position:absolute;left:0px;top:0px;width:375px;height:769px} .el2{position:absolute;left:0px;top:0px;width:375px;height:769px} .el3{position:absolute;left:0px;top:94px;width:375px;height:675px} .el4{position:absolute;left:52px;top:280px;width:271px;height:271px} .el5{position:absolute;left:79.5px;top:141px;width:216.5px;height:108.5px;z-index:10;color:#FFF;font-size:40px;font-family:"Alibaba PuHuiTi 3.0",sans-serif;font-weight:700;text-align:center;line-height:60px} .el6{position:absolute;left:91px;top:582.5px;width:193px;height:49.5px;z-index:10;color:#3a3a3a;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:24.8px} .el7{position:absolute;left:43px;top:658px;width:292.5px;height:58px} .el8{position:absolute;left:101px;top:674px;width:173.5px;height:18.5px;z-index:10;color:#FFF;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1} .el9{position:absolute;left:124px;top:53px;width:125px;height:18px;z-index:10;color:#333;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;line-height:1}</style></head><body><div class="design"><div class="el1" title="bg"></div><div class="el2" title="图层 644"></div><div class="el3" title="bg"></div><div class="el4" title="二维码"></div><div class="el5" title="关注公众号 参与抽奖">关注公众号 参与抽奖</div><div class="el6" title="关注引力波智谱公众号 长按识别二维码关注">关注引力波智谱公众号 长按识别二维码关注</div><div class="el7" title="矩形 1626"></div><div class="el8" title="我已关注，立即验证">我已关注，立即验证</div><div class="el9" title="参与抽奖赢礼品">参与抽奖赢礼品</div></div></body></html>
```

### 5. 关注成功（关注公众号·已关注）— 需求 4.2
- 顶部标语「参与抽奖赢礼品」（18px）
- 成功状态图标（118.5×118.5）
- CTA：「去填写信息」（18px 白字胶囊）

**图片资源**：`https://alipic.lanhuapp.com/PSUXPCover2fb3444456696b9defc73ea7a86986ed.png`
**切图**：2 张

```html
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Design</title><style>*{margin:0;padding:0;box-sizing:border-box}img{display:block}.design{position:relative;width:375px;height:769px;overflow:hidden;margin:0 auto;background:url(https://alipic.lanhuapp.com/PSUXPCover2fb3444456696b9defc73ea7a86986ed.png) no-repeat;background-size:375px 769px} .el1{position:absolute;left:0px;top:0px;width:375px;height:769px} .el2{position:absolute;left:0px;top:0px;width:375px;height:769px} .el3{position:absolute;left:0px;top:94px;width:375px;height:675px} .el4{position:absolute;left:130.5px;top:251px;width:118.5px;height:118.5px} .el5{position:absolute;left:43px;top:658px;width:292.5px;height:58px} .el6{position:absolute;left:139.5px;top:674.5px;width:96px;height:18px;z-index:10;color:#FFF;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1} .el7{position:absolute;left:124.5px;top:53px;width:125px;height:18px;z-index:10;color:#333;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1}</style></head><body><div class="design"><div class="el1" title="bg"></div><div class="el2" title="图层 644"></div><div class="el3" title="bg"></div><div class="el4" title="矢量智能对象"></div><div class="el5" title="矩形 1626"></div><div class="el6" title="去填写信息">去填写信息</div><div class="el7" title="参与抽奖赢礼品">参与抽奖赢礼品</div></div></body></html>
```

### 6. 我的奖品（我的兑奖状态）— 需求 4.6
- 标题：「我的奖品」（18px）
- 获奖卡片：「三等奖 定制手机支架」（18px）；状态标签「待核销」（12px，橙 `rgba(242,142,82,1)`，浅橙圆角底）
- 兑奖凭证卡：兑奖码「836 215」（18px）+ 核销二维码（158×158）+ 提示「请出示二维码给工作人员核销」（15px，`rgba(102,102,102,1)`）

**图片资源**：`https://alipic.lanhuapp.com/PSUXPCover5f01af2d624b3a40e0b06c3500ed9477.png`
**切图**：1 张

```html
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Design</title><style>*{margin:0;padding:0;box-sizing:border-box}img{display:block}.design{position:relative;width:375px;height:769px;overflow:hidden;margin:0 auto;background:url(https://alipic.lanhuapp.com/PSUXPCover5f01af2d624b3a40e0b06c3500ed9477.png) no-repeat;background-size:375px 769px} .el1{position:absolute;left:0px;top:0px;width:375px;height:769px} .el2{position:absolute;left:0px;top:0px;width:375px;height:769px} .el3{position:absolute;left:0px;top:94px;width:375px;height:675px} .el4{position:absolute;left:16px;top:107px;width:343px;height:207px} .el5{position:absolute;left:199px;top:154px;width:108px;height:49.5px;z-index:10;color:#333;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;line-height:24.8px} .el6{position:absolute;left:133.5px;top:272px;width:38.5px;height:14.5px;z-index:10;color:#333;font-size:15px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;line-height:1} .el7{position:absolute;left:178.5px;top:267px;width:55px;height:21px} .el8{position:absolute;left:187.5px;top:272px;width:36px;height:12px;z-index:10;color:#f28e52;font-size:12px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;line-height:1} .el9{position:absolute;left:16px;top:327px;width:343px;height:332px} .el10{position:absolute;left:108.5px;top:445px;width:158px;height:158px} .el11{position:absolute;left:105.5px;top:443px;width:163px;height:163px} .el12{position:absolute;left:35.5px;top:131px;width:145px;height:119px} .el13{position:absolute;left:0px;top:108px;width:202px;height:182px} .el14{position:absolute;left:136.5px;top:374px;width:102.5px;height:52px;z-index:10;color:#333;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:26px} .el15{position:absolute;left:90px;top:674px;width:194.5px;height:15px;z-index:10;color:#666;font-size:15px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1} .el16{position:absolute;left:151px;top:53px;width:71px;height:18px;z-index:10;color:#333;font-size:18px;font-family:"Microsoft YaHei",sans-serif;font-weight:400;text-align:center;line-height:1}</style></head><body><div class="design"><div class="el1" title="bg"></div><div class="el2" title="图层 644"></div><div class="el3" title="bg"></div><div class="el4" title="矩形 1641"></div><div class="el5" title="三等奖 定制手机支架">三等奖 定制手机支架</div><div class="el6" title="状态：">状态：</div><div class="el7" title="矩形 1647"></div><div class="el8" title="待核销">待核销</div><div class="el9" title="矩形 1641"></div><div class="el10" title="矩形 1642"></div><div class="el11" title="图层 663"></div><div class="el12" title="矩形 1643"></div><div class="el13" title="图层 664"></div><div class="el14" title="兑奖码 836 215">兑奖码 836 215</div><div class="el15" title="请出示二维码给工作人员核销">请出示二维码给工作人员核销</div><div class="el16" title="我的奖品">我的奖品</div></div></body></html>
```

## 四、切图与资源

| 屏 | 背景图 URL | 切图数 |
| --- | --- | --- |
| 进入活动 | `PSUXPCovera683c39fe98f3791f571d591992d4ba5.png` | 4 |
| 活动说明 | `PSUXPCover16d23eb2bddc63772603c31c0eeb13da.png` | 1 |
| 用户活动协议 | `PSUXPCover30693402242c4c02966c5e7e1d80d6ee.png` | 1 |
| 扫码关注 | `PSUXPCover2bc609c60d3ebd83dfdf8a0f07d563fe.png` | 2 |
| 关注成功 | `PSUXPCover2fb3444456696b9defc73ea7a86986ed.png` | 2 |
| 填写活动信息 | `PSUXPCovera90cff6fa0a58fe343673efc422d4542.png` | 1 |
| 提交成功 | `PSUXPCover32c46e7dc3df03c10ca2005381294101.png` | 2 |
| 抽奖中 | `PSUXPCover2e6c9908d06aa83278b74319924be89a.png` | 3 |
| 恭喜中奖 | `PSUXPCover8f64f83192e3d5378a52704b93b47861.png` | 3 |
| 我的奖品 | `PSUXPCover5f01af2d624b3a40e0b06c3500ed9477.png` | 1 |
| 核销成功 | `PSUXPCover6b8d30119e5e5be1ba3f9f6ca8fac7f4.png` | 2 |

所有背景图前缀：`https://alipic.lanhuapp.com/`（完整 URL = 前缀 + 上表文件名）

## 五、落地前需确认事项

1. **我的奖品状态**：目前仅有「待核销」样式，需求 4.6 还含「已兑奖 / 已过期」两态，是否需要在同一卡片上做三种样式？
2. **DDS 数据**：这些稿件为 Sketch 兜底输出（图片背景 + 绝对定位图层），落 activity 前端时建议以背景图切图为主、HTML 图层为辅还原，视觉精度依赖于 375 宽度下的坐标映射。

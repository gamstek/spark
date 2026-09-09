import { useState } from 'react';
import { useRuntime } from '../lib/runtime';
import { SLICES } from '../lib/assets';
import { PageShell } from '../components/page-shell';
import { ActionButton } from '../components/action-button';

/**
 * home 页布局。蓝湖设计稿 @1x 基准画布 = 375×769（version 尺寸 375×769；
 * artboard 750×1538 是 2× 导出画布）。下方全部是 MCP lanhu_design 权威 Layout
 * Summary 返回的 @1x 精确坐标（375 基准）。
 *
 *   背景底色    #F6F6F6  (0,0) 375×769
 *   主视觉图    homeBg    (0,94) 375×376
 *   白色卡片    矩形1640  (0,458.5) 375×242  #FFFFFF
 *   标题        (54,484.5) 266.5×50
 *   时间标签    (82.5,559.5)  / 信息 (165,559.5)
 *   按钮        矩形1626  (43,623) 292.5×58  渐变+阴影+描边
 *   底部tabs    矩形1640拷贝 (0,656.5) 375×112.5 #FFFFFF，外阴影
 *     - 图标    (43/168/292.5, 699.5/700) 40×40
 *     - 文字    (39/164/289, 744.5) 12px
 *     - 分隔线  (124.5,721) 与 (249.5,721) 1×39.5  #939393
 */
export function HomePage() {
  const { activity, participate, openView, showMyPrizes } = useRuntime();
  const [showRules, setShowRules] = useState(false);
  const TAB_TOP = 656.5; // 底部 tabs 容器顶部 @1x

  return (
    <PageShell className="bg-[#F6F6F6]">
      {/* 顶部标语 (124,53) 125×18 */}
      <header className="absolute inset-x-0 top-[53px] text-center text-[18px] text-ink">
        {activity.slug}
      </header>

      {/* 主视觉图：组bg 切片 (0,94) 375×376 */}
      <img
        src={SLICES.homeBg}
        alt="活动主视觉"
        className="absolute left-0 top-[94px] h-[376px] w-[375px] object-cover"
      />

      {/* 白色内容卡片 矩形1640 (0,458.5) 375×242 */}
      <div className="absolute left-0 top-[458px] h-[242px] w-[375px] bg-white" />

      {/* 活动标题 (54,484.5) 266.5×50 */}
      <h1 className="absolute left-[54px] top-[484px] w-[266px] text-center text-[20px] leading-[30px] text-ink">
        {activity.title}
      </h1>

      {/* 活动时间 / 主办方 (82.5,559.5) 与 (165,559.5) */}
      <p className="absolute left-[82px] top-[559px] w-[68px] text-right text-[15px] leading-[30px] text-ink">
        活动时间：
        {activity.organizer ? (
          <>
            <br />
            主办方：
          </>
        ) : null}
      </p>
      <p className="absolute left-[165px] top-[559px] w-[131px] text-[15px] leading-[30px] text-ink">
        {activity.dates}
        {activity.organizer ? (
          <>
            <br />
            {activity.organizer}
          </>
        ) : null}
      </p>

      {/* 主按钮 矩形1626 (43,623) 292.5×58：左上角(0% 0%)径向渐变 #BE1414→#FF4444 + 底 #CF102C；
          描边 #E94262→#F99494；阴影 X3.5/Y0/blur6.5/spread0 #C81C1C35%；圆角21.42 */}
      <div className="absolute left-[43px] top-[623px] z-10 w-[292px]">
        <ActionButton
          onClick={() => void participate()}
          style={{
            background:
              'radial-gradient(circle at 0% 0%, #BE1414 0%, #FF4444 99.58%), #CF102C',
            boxShadow: '3.5px 0px 6.5px 0px rgba(200,28,28,0.35)',
            border: '2px solid',
            borderImage:
              'radial-gradient(circle, rgba(233,66,98,1), rgba(249,148,148,1)) 2 2',
            borderRadius: '21.42px',
          }}
        >
          立即参与
        </ActionButton>
      </div>

      {/* 底部三入口 tabs 矩形1640拷贝 (0,656.5) 375×112.5 #FFFFFF，外阴影
          子元素用相对容器坐标：图标 y699.5/700 → 43/44、文字 y744.5 → 88、分隔线 y721 → 64.5 */}
      <div
        className="absolute left-0 w-[375px] bg-white"
        style={{
          top: TAB_TOP,
          height: 112.5,
          boxShadow: '6px 0 38px 0 rgba(99,99,99,0.3)',
        }}
      >
        {/* 图标 group：活动规则(43,700) 活动说明(168,699.5) 我的奖品(292.5,699.5) 40×40 */}
        <BottomNavItem
          icon={SLICES.homeIcon[0]}
          label="活动规则"
          iconLeft={43}
          iconTop={700 - TAB_TOP}
          textLeft={39}
          textTop={744.5 - TAB_TOP}
          onClick={() => setShowRules(true)}
        />
        <BottomNavItem
          icon={SLICES.homeIcon[1]}
          label="活动说明"
          iconLeft={168}
          iconTop={699.5 - TAB_TOP}
          textLeft={164}
          textTop={744.5 - TAB_TOP}
          onClick={() => openView('info')}
        />
        <BottomNavItem
          icon={SLICES.homeIcon[2]}
          label="我的奖品"
          iconLeft={292}
          iconTop={699.5 - TAB_TOP}
          textLeft={289}
          textTop={744.5 - TAB_TOP}
          onClick={showMyPrizes}
        />

        {/* 分隔线 (124.5,721) 与 (249.5,721)，1×39.5，#939393 */}
        <div
          className="absolute w-px bg-[#939393]"
          style={{ left: 124.5, top: 721 - TAB_TOP, height: 39.5 }}
        />
        <div
          className="absolute w-px bg-[#939393]"
          style={{ left: 249.5, top: 721 - TAB_TOP, height: 39.5 }}
        />
      </div>

      {/* 活动规则弹层 */}
      {showRules && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setShowRules(false)}
        >
          <div
            className="mx-auto w-full max-w-[375px] rounded-t-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[16px] text-ink">活动规则</span>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="text-ink"
              >
                ✕
              </button>
            </div>
            <p className="text-[14px] leading-[1.8] text-ink">
              {activity.rulesText}
            </p>
          </div>
        </div>
      )}
    </PageShell>
  );
}

/** 底部单个入口：图标(40×40) + 下方文字(12px)。坐标相对 tabs 容器。 */
function BottomNavItem({
  icon,
  label,
  iconLeft,
  iconTop,
  textLeft,
  textTop,
  onClick,
}: {
  icon: string | undefined;
  label: string;
  iconLeft: number;
  iconTop: number;
  textLeft: number;
  textTop: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute"
      style={{ left: iconLeft, top: iconTop }}
    >
      {icon ? (
        <img
          src={icon}
          alt={label}
          className="h-10 w-10 object-contain"
        />
      ) : null}
      <span
        className="absolute whitespace-nowrap text-[12px] text-ink"
        style={{ left: textLeft - iconLeft, top: textTop - iconTop }}
      >
        {label}
      </span>
    </button>
  );
}

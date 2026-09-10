import { ActionButton } from '../components/action-button';
import { PageShell } from '../components/page-shell';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useRuntime } from '../hooks/use-runtime';
import { SLICES } from '../lib/assets';

export function LotteryPage() {
  const { activity, step, win, draw, drawing, showPrize, openView } =
    useRuntime();
  const soldOut = step === 'OUT_OF_STOCK';
  const noPrize = step === 'NO_PRIZE';
  const disabled = drawing || soldOut || Boolean(win) || noPrize;
  const wheelOptions = (
    activity.noPrizeWeight > 0
      ? activity.prizes.flatMap((prize) => [
          prize,
          { prizeLevel: '', name: '谢谢参与' },
        ])
      : activity.prizes
  ).slice(0, 12);
  const winningIndex = win
    ? wheelOptions.findIndex(
        (prize) =>
          prize.prizeLevel === win.prizeLevel && prize.name === win.prizeName,
      )
    : noPrize
      ? wheelOptions.findIndex((option) => option.name === '谢谢参与')
      : -1;
  const slotAngle = 360 / Math.max(wheelOptions.length, 1);
  const restingRotation = winningIndex >= 0 ? winningIndex * -slotAngle : 0;

  useDocumentTitle(activity.title, '参与抽奖');

  return (
    <PageShell className="bg-[#ef363e]">
      <img
        src={SLICES.lotteryBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 size-full object-cover"
      />

      <div className="absolute left-[15px] top-[211px] size-[345px]">
        <div
          className={`relative size-full transition-transform duration-[1800ms] ease-[cubic-bezier(0.12,0.72,0.18,1)] ${drawing ? 'lottery-wheel--spinning' : ''}`}
          style={{ transform: `rotate(${restingRotation}deg)` }}
          aria-label="抽奖转盘"
        >
          <img
            src={SLICES.lotteryWheelFace}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-contain"
          />

          {wheelOptions.map((prize, index) => {
            const radians = ((index * slotAngle - 90) * Math.PI) / 180;
            const labelRotation = (index * slotAngle) % 180;
            return (
              <span
                key={`${prize.prizeLevel}-${prize.name}-${index}`}
                className="absolute flex h-[54px] w-[92px] items-center justify-center text-center text-[15px] leading-[18px] font-medium text-[#ff423d]"
                style={{
                  left: `${50 + Math.cos(radians) * 27.8}%`,
                  top: `${50 + Math.sin(radians) * 27.8}%`,
                  transform: `translate(-50%, -50%) rotate(${labelRotation}deg)`,
                }}
              >
                {prize.name}
              </span>
            );
          })}
        </div>

        <button
          type="button"
          aria-label={drawing ? '抽奖中' : win ? '抽奖完成' : '开始抽奖'}
          disabled={disabled}
          onClick={() => void draw()}
          className="absolute left-1/2 top-1/2 z-10 flex size-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[5px] border-[#fff0ce] bg-gradient-to-b from-[#ff5145] to-[#ed160d] p-0 text-[22px] font-medium text-white shadow-[0_3px_0_#f4a52d,0_6px_12px_rgba(181,35,8,0.35)] disabled:cursor-not-allowed"
        >
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-[-31px] -translate-x-1/2 border-x-[13px] border-b-[28px] border-x-transparent border-b-[#f13117] drop-shadow-[0_-2px_0_#ffb140]"
          />
          抽奖
        </button>
      </div>

      {win || noPrize ? (
        <div className="absolute inset-x-[43px] top-[555px] text-center text-[#8f1822] drop-shadow-[0_1px_0_rgba(255,255,255,0.65)]">
          <p className="text-[17px] font-medium">
            {win ? '恭喜抽中' : '很遗憾'}
          </p>
          <p className="mt-1 truncate text-[20px] font-semibold">
            {win ? `${win.prizeLevel} · ${win.prizeName}` : '未中奖'}
          </p>
          <div className="mt-3">
            <ActionButton onClick={win ? showPrize : () => openView('home')}>
              {win ? '查看奖品' : '返回首页'}
            </ActionButton>
          </div>
        </div>
      ) : (
        <div className="absolute left-[43px] top-[573px] w-[293px]">
          <ActionButton
            onClick={() => void draw()}
            disabled={disabled}
          >
            {soldOut ? '奖品已抽完' : drawing ? '抽奖中…' : '立即抽奖'}
          </ActionButton>
        </div>
      )}

      <p
        className="sr-only"
        aria-live="polite"
      >
        {drawing
          ? '转盘正在旋转，请稍候'
          : win
            ? `恭喜抽中${win.prizeLevel}${win.prizeName}`
            : noPrize
              ? '很遗憾，未中奖'
              : ''}
      </p>
    </PageShell>
  );
}

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { ActionButton } from '../components/action-button';
import { PageShell } from '../components/page-shell';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useRuntime } from '../hooks/use-runtime';
import { SLICES } from '../lib/assets';

const WHEEL_SPIN_CYCLE_MS = 720;
const WHEEL_MINIMUM_SPIN_MS = WHEEL_SPIN_CYCLE_MS * 2;
const WHEEL_SETTLE_MS = 1_800;
const WHEEL_STOP_MS = 600;

type WheelPhase = 'idle' | 'spinning' | 'settling' | 'stopping';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function LotteryPage() {
  const { activity, step, win, draw, drawing, showPrize, openView } =
    useRuntime();
  const soldOut = step === 'OUT_OF_STOCK';
  const noPrize = step === 'NO_PRIZE';
  const [wheelPhase, setWheelPhase] = useState<WheelPhase>('idle');
  const [drawRequestSettled, setDrawRequestSettled] = useState(false);
  const [outcomeRevealed, setOutcomeRevealed] = useState(
    () => Boolean(win) || noPrize,
  );
  const drawAttemptRef = useRef(0);
  const drawStartedAtRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const visualPhase =
    wheelPhase === 'idle' && drawing ? 'spinning' : wheelPhase;
  const animating = drawing || wheelPhase !== 'idle';
  const disabled = animating || soldOut || Boolean(win) || noPrize;
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
  const showOutcome =
    outcomeRevealed && !animating && (Boolean(win) || noPrize);

  useEffect(() => {
    if (wheelPhase !== 'spinning' || !drawRequestSettled) return;

    const elapsed = performance.now() - drawStartedAtRef.current;
    const boundary = reducedMotionRef.current
      ? elapsed
      : Math.max(
          WHEEL_MINIMUM_SPIN_MS,
          Math.ceil(elapsed / WHEEL_SPIN_CYCLE_MS) * WHEEL_SPIN_CYCLE_MS,
        );
    const timer = window.setTimeout(
      () => setWheelPhase(win || noPrize ? 'settling' : 'stopping'),
      Math.max(0, boundary - elapsed),
    );
    return () => window.clearTimeout(timer);
  }, [drawRequestSettled, noPrize, wheelPhase, win]);

  useEffect(() => {
    if (wheelPhase !== 'settling' && wheelPhase !== 'stopping') return;

    const duration = reducedMotionRef.current
      ? 120
      : wheelPhase === 'settling'
        ? WHEEL_SETTLE_MS
        : WHEEL_STOP_MS;
    const timer = window.setTimeout(() => {
      setOutcomeRevealed(wheelPhase === 'settling');
      setWheelPhase('idle');
    }, duration);
    return () => window.clearTimeout(timer);
  }, [wheelPhase]);

  useEffect(
    () => () => {
      drawAttemptRef.current += 1;
    },
    [],
  );

  const startDraw = () => {
    if (disabled) return;

    const attempt = ++drawAttemptRef.current;
    reducedMotionRef.current = prefersReducedMotion();
    drawStartedAtRef.current = performance.now();
    setDrawRequestSettled(false);
    setOutcomeRevealed(false);
    setWheelPhase('spinning');
    void draw()
      .catch(() => undefined)
      .finally(() => {
        if (drawAttemptRef.current === attempt) setDrawRequestSettled(true);
      });
  };

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
          className={`relative size-full ${visualPhase === 'spinning' ? 'lottery-wheel--spinning' : ''} ${visualPhase === 'settling' ? 'lottery-wheel--settling' : ''} ${visualPhase === 'stopping' ? 'lottery-wheel--stopping' : ''}`}
          style={
            {
              '--lottery-wheel-target': `${restingRotation}deg`,
              transform: `rotate(${restingRotation}deg)`,
            } as CSSProperties
          }
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
          aria-label={
            visualPhase === 'settling'
              ? '转盘减速中'
              : animating
                ? '抽奖中'
                : win || noPrize
                  ? '抽奖完成'
                  : '开始抽奖'
          }
          disabled={disabled}
          onClick={startDraw}
          className="absolute left-1/2 top-1/2 z-10 flex size-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[5px] border-[#fff0ce] bg-gradient-to-b from-[#ff5145] to-[#ed160d] p-0 text-[22px] font-medium text-white shadow-[0_3px_0_#f4a52d,0_6px_12px_rgba(181,35,8,0.35)] disabled:cursor-not-allowed"
        >
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-[-31px] -translate-x-1/2 border-x-[13px] border-b-[28px] border-x-transparent border-b-[#f13117] drop-shadow-[0_-2px_0_#ffb140]"
          />
          抽奖
        </button>
      </div>

      {showOutcome ? (
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
            onClick={startDraw}
            disabled={disabled}
            aria-busy={animating}
          >
            {soldOut
              ? '奖品已抽完'
              : visualPhase === 'settling'
                ? '即将揭晓…'
                : animating
                  ? '抽奖中…'
                  : '立即抽奖'}
          </ActionButton>
        </div>
      )}

      <p
        className="sr-only"
        aria-live="polite"
      >
        {visualPhase === 'settling'
          ? '转盘正在减速，即将揭晓结果'
          : animating
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

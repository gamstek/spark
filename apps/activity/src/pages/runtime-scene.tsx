import { useRuntime } from '../lib/runtime';
import { HomePage } from './home-page';
import { ActivityInfoPage } from './activity-info-page';
import { SubscribePage } from './subscribe-page';
import { FollowSuccessPage } from './follow-success-page';
import { FormPage } from './form-page';
import { SubmitSuccessPage } from './submit-success-page';
import { LotteryPage } from './lottery-page';
import { PrizePage } from './prize-page';
import { RedemptionPage } from './redemption-page';
import { RedeemedSuccessPage } from './redeemed-success-page';

/**
 * step → 页面分发。view (info / redeemed-success) 为独立于状态机的正交屏。
 * 其余按 RuntimeStep 渲染；顶部浮动展示全局提示消息。
 */
export function RuntimeScene() {
  const { step, view, message, setMessage } = useRuntime();

  let content;
  if (view === 'info') content = <ActivityInfoPage />;
  else if (view === 'follow-success') content = <FollowSuccessPage />;
  else if (view === 'redeemed-success') content = <RedeemedSuccessPage />;
  else
    switch (step) {
      case 'NOT_STARTED':
        content = <HomePage />;
        break;
      case 'SUBSCRIBE':
        content = <SubscribePage />;
        break;
      case 'FORM':
        content = <FormPage />;
        break;
      case 'WAITING_FORM':
        content = <SubmitSuccessPage />;
        break;
      case 'LOTTERY':
      case 'OUT_OF_STOCK':
        content = <LotteryPage />;
        break;
      case 'PRIZE':
        content = <PrizePage />;
        break;
      case 'REDEEMED':
      case 'EXPIRED':
        content = <RedemptionPage />;
        break;
      case 'ENDED':
      default:
        content = <HomePage />;
        break;
    }

  return (
    <>
      {content}
      {message && (
        <button
          type="button"
          onClick={() => setMessage(null)}
          className="fixed inset-x-0 top-3 z-[70] mx-auto w-fit max-w-[90vw] rounded-full bg-black/75 px-4 py-1.5 text-[13px] text-white"
        >
          {message}
        </button>
      )}
    </>
  );
}

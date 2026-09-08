import { useDemoRuntime } from '../lib/runtime';
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
 * 其余按 RuntimeStep 渲染。
 */
export function RuntimeScene() {
  const { step, view } = useDemoRuntime();

  if (view === 'info') return <ActivityInfoPage />;
  if (view === 'follow-success') return <FollowSuccessPage />;
  if (view === 'redeemed-success') return <RedeemedSuccessPage />;

  switch (step) {
    case 'NOT_STARTED':
      return <HomePage />;
    case 'SUBSCRIBE':
      return <SubscribePage />;
    case 'FORM':
      return <FormPage />;
    case 'WAITING_FORM':
      return <SubmitSuccessPage />;
    case 'LOTTERY':
    case 'OUT_OF_STOCK':
      return <LotteryPage />;
    case 'PRIZE':
      return <PrizePage />;
    case 'REDEEMED':
    case 'EXPIRED':
      return <RedemptionPage />;
    case 'ENDED':
      return <HomePage />;
    default:
      return <HomePage />;
  }
}

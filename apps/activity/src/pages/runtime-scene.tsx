import { useEffect } from 'react';
import { useRuntime } from '../hooks/use-runtime';
import { useDocumentTitle } from '../hooks/use-document-title';
import { HomePage } from './home-page';
import { ActivityInfoPage } from './activity-info-page';
import { ActivityRulesPage } from './activity-rules-page';
import { SubscribePage } from './subscribe-page';
import { SubmitSuccessPage } from './submit-success-page';
import { LotteryPage } from './lottery-page';
import { RedemptionPage } from './redemption-page';

function DingTalkFormRedirect() {
  const { activity, startForm } = useRuntime();
  useDocumentTitle(activity.title, '正在打开钉钉表单');

  useEffect(() => {
    void startForm();
  }, [startForm]);

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center justify-center bg-[#f5f6fa] px-6 text-center text-[15px] text-ink"
      role="status"
    >
      正在打开钉钉表单…
    </main>
  );
}

/**
 * step → 页面分发。活动说明是独立于状态机的正交页面。
 * 其余按 RuntimeStep 渲染；顶部浮动展示全局提示消息。
 */
export function RuntimeScene() {
  const { step, view, message, setMessage } = useRuntime();

  let content;
  if (view === 'home') content = <HomePage />;
  else if (view === 'rules') content = <ActivityRulesPage />;
  else if (view === 'info') content = <ActivityInfoPage />;
  else if (view === 'prizes') content = <RedemptionPage />;
  else
    switch (step) {
      case 'NOT_STARTED':
        content = <HomePage />;
        break;
      case 'SUBSCRIBE':
        content = <SubscribePage />;
        break;
      case 'FORM':
        content = <DingTalkFormRedirect />;
        break;
      case 'WAITING_FORM':
        content = <SubmitSuccessPage />;
        break;
      case 'LOTTERY':
      case 'NO_PRIZE':
      case 'OUT_OF_STOCK':
      case 'PRIZE':
      case 'REDEEMED':
      case 'EXPIRED':
        content = <LotteryPage />;
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

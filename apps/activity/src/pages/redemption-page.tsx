import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRuntime } from '../hooks/use-runtime';
import { StatusTag } from '../components/status-tag';
import { PageHeader } from '../components/page-header';
import { ActionButton } from '../components/action-button';
import { useDocumentTitle } from '../hooks/use-document-title';

export function RedemptionPage() {
  const {
    activity,
    win,
    refreshPrizeStatus,
    refreshingPrizeStatus,
    confirmPrizeReceipt,
    confirmingPrizeReceipt,
  } = useRuntime();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );
  const navigate = useNavigate();
  useDocumentTitle(activity.title, '我的奖品');
  const canRedeem = win?.redemptionStatus === 'WAIT_REDEEM';

  const handleConfirmReceipt = async () => {
    setConfirmationError(null);
    try {
      await confirmPrizeReceipt();
      setConfirmationOpen(false);
    } catch {
      setConfirmationError('确认失败，请检查网络后重试');
    }
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-[#f5f6fa] text-ink">
      <PageHeader
        title="我的奖品"
        onBack={() => navigate(-1)}
        position="sticky"
      />

      <div className="space-y-4 px-4 pt-4 pb-8">
        <section className="rounded-xl bg-white px-5 py-7">
          <div className="flex items-center gap-5">
            {win?.prizeImageUrl ? (
              <img
                src={win.prizeImageUrl}
                alt={win.prizeName}
                className="h-[138px] w-[48%] max-w-[169px] rounded-md bg-[#dfddd4] object-cover"
              />
            ) : (
              <div
                className="flex h-[138px] w-[48%] max-w-[169px] items-center justify-center rounded-md bg-[#eeeef0] text-[14px] text-sub"
                aria-label="暂无奖品图片"
              >
                暂无图片
              </div>
            )}
            <div className="min-w-0 flex-1 text-[20px] leading-8">
              <p>{win?.prizeLevel}</p>
              <p className="break-words">{win?.prizeName}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 text-[16px]">
            <span>状态：</span>
            {win && <StatusTag status={win.redemptionStatus} />}
          </div>
          <button
            type="button"
            className="mx-auto mt-4 block rounded-full border border-black/10 px-4 py-2 text-[14px] text-sub disabled:opacity-50"
            onClick={() => void refreshPrizeStatus()}
            disabled={refreshingPrizeStatus}
          >
            {refreshingPrizeStatus ? '刷新中…' : '刷新状态'}
          </button>
        </section>

        <section className="flex min-h-[250px] flex-col items-center justify-center rounded-xl bg-white px-5 py-9 text-center">
          <h2 className="text-[20px] font-medium">现场领奖</h2>
          {canRedeem ? (
            <>
              <p className="mt-3 max-w-[280px] text-[15px] leading-7 text-sub">
                到达领奖处后，请交由现场工作人员操作
              </p>
              <Dialog.Root
                open={confirmationOpen}
                onOpenChange={(open) => {
                  if (confirmingPrizeReceipt) return;
                  setConfirmationOpen(open);
                  if (!open) setConfirmationError(null);
                }}
              >
                <Dialog.Trigger asChild>
                  <ActionButton className="mt-7 cursor-pointer">
                    确认领奖
                  </ActionButton>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-[500] bg-black/45" />
                  <Dialog.Content className="fixed top-1/2 left-1/2 z-[600] w-[calc(100%-32px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white px-6 py-7 text-center shadow-xl focus:outline-none">
                    <Dialog.Title className="text-[20px] font-semibold text-ink">
                      工作人员确认领奖
                    </Dialog.Title>
                    <Dialog.Description className="mt-3 text-left text-[15px] leading-7 text-sub">
                      请工作人员确认奖品已交给参与者。确认后状态将更新为“已兑奖”，无法撤销。
                    </Dialog.Description>
                    {confirmationError && (
                      <p
                        role="alert"
                        className="mt-3 text-[14px] text-brand"
                      >
                        {confirmationError}
                      </p>
                    )}
                    <div className="mt-6 flex gap-3">
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          className="h-12 flex-1 cursor-pointer rounded-full border border-black/15 text-[16px] text-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={confirmingPrizeReceipt}
                        >
                          返回
                        </button>
                      </Dialog.Close>
                      <button
                        type="button"
                        className="h-12 flex-1 cursor-pointer rounded-full bg-brand text-[16px] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
                        aria-busy={confirmingPrizeReceipt}
                        disabled={confirmingPrizeReceipt}
                        onClick={() => void handleConfirmReceipt()}
                      >
                        {confirmingPrizeReceipt ? '确认中…' : '确认已发放'}
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </>
          ) : (
            <p className="mt-20 text-[16px] text-sub">
              {win?.redemptionStatus === 'REDEEMED'
                ? '该奖品已完成核销'
                : '该兑奖码已过期'}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

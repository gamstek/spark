import { useNavigate } from 'react-router-dom';
import { useRuntime } from '../hooks/use-runtime';
import { StatusTag } from '../components/status-tag';
import { AppQr } from '../components/app-qr';
import { PageHeader } from '../components/page-header';
import { useDocumentTitle } from '../hooks/use-document-title';

function formatRedemptionCode(code: string | undefined): string {
  if (!code) return '—';
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

export function RedemptionPage() {
  const { activity, win, prizeCode } = useRuntime();
  const navigate = useNavigate();
  useDocumentTitle(activity.title, '我的奖品');
  const canRedeem = win?.redemptionStatus === 'WAIT_REDEEM';

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
        </section>

        <section className="flex min-h-[385px] flex-col items-center rounded-xl bg-white px-5 pt-12 pb-9 text-center">
          <h2 className="text-[20px] font-normal">兑奖码</h2>
          {canRedeem ? (
            <>
              <p className="mt-1 text-[30px] leading-10 font-bold tracking-[0.04em]">
                {formatRedemptionCode(prizeCode?.code)}
              </p>
              <div className="mt-4">
                <AppQr
                  value={prizeCode?.qrUrl ?? ''}
                  size={184}
                />
              </div>
            </>
          ) : (
            <p className="mt-20 text-[16px] text-sub">
              {win?.redemptionStatus === 'REDEEMED'
                ? '该奖品已完成核销'
                : '该兑奖码已过期'}
            </p>
          )}
        </section>

        {canRedeem && (
          <p className="pt-0.5 text-center text-[16px] text-sub">
            请出示二维码给工作人员核销
          </p>
        )}
      </div>
    </main>
  );
}

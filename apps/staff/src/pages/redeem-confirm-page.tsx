import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { staffApi, ApiError, type RedemptionView } from '../lib/api';
import { ActionButton } from '../components/action-button';
import { PageShell } from '../components/page-shell';
import { StatusTag } from '../components/status-tag';
import { SLICES } from '../lib/assets';
import { confirmRedemptionAndUpdateRecords } from '../lib/redemption-confirmation';
import { useStaff } from '../lib/runtime';

/** 核销信息确认：进入即查询兑奖码，确认无误后发放。 */
export function RedeemConfirmPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { code, csrfToken } = useStaff();
  const [view, setView] = useState<RedemptionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!code) {
      navigate('/enter', { replace: true });
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    staffApi
      .lookup(code)
      .then((result) => {
        if (active) {
          setView(result);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(
          e instanceof ApiError && e.code === 'REDEMPTION_NOT_FOUND'
            ? '兑奖码无效或不在可核销活动内'
            : '查询失败，请返回重试',
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code, navigate]);

  const confirm = async () => {
    if (!csrfToken || !view) return;
    setConfirming(true);
    try {
      const result = await confirmRedemptionAndUpdateRecords(
        queryClient,
        code,
        csrfToken,
      );
      navigate('/redeem/success', {
        state: { redeemedAt: result.redeemedAt },
      });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'REDEMPTION_EXPIRED') {
          setError('该兑奖码已过期，无法核销');
          setView((prev) => (prev ? { ...prev, status: 'EXPIRED' } : prev));
        } else {
          setError('核销失败，请重试');
        }
      } else {
        setError('核销失败，请重试');
      }
    } finally {
      setConfirming(false);
    }
  };

  const alreadyRedeemed = view?.status === 'REDEEMED';
  const expired = view?.status === 'EXPIRED';

  return (
    <PageShell className="relative flex min-h-screen flex-col px-3">
      {/* 页面背景图 */}
      <img
        src={SLICES.redeemConfirm.bg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />

      <div className="relative">
        <header className="py-3 text-center text-[18px] text-ink">
          核销信息确认
        </header>

        {loading && (
          <p className="mt-10 text-center text-[15px] text-sub">查询中…</p>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-[14px] bg-white p-6 text-center shadow-sm">
            <p className="text-[16px] text-brand">{error}</p>
            <div className="mt-6 space-y-2">
              <ActionButton
                onClick={() => navigate('/enter')}
                className="w-full"
              >
                重新输入
              </ActionButton>
              <ActionButton
                variant="danger-outline"
                onClick={() => navigate('/')}
                className="w-full"
              >
                返回工作台
              </ActionButton>
            </div>
          </div>
        )}

        {!loading && !error && view && (
          <>
            {/* 校验通过提示 */}
            <div className="flex items-center gap-3 rounded-[14px] border border-blue/20 bg-[#EEF2FF] px-3 py-3">
              <img
                src={SLICES.redeemConfirm.verify}
                alt="验证通过"
                className="h-[66px] w-[66px] shrink-0 object-contain"
              />
              <div>
                <p className="text-[15px] text-ink">
                  {alreadyRedeemed
                    ? '该兑奖码已完成核销'
                    : expired
                      ? '该兑奖码已过期'
                      : '核销码验证通过'}
                </p>
                <p className="mt-1 text-[13px] text-sub">
                  {alreadyRedeemed || expired
                    ? '如对结果有疑问请联系管理员'
                    : '请确认以下信息无误后发放奖品'}
                </p>
              </div>
            </div>

            {/* 奖品卡 */}
            <div className="mt-3 rounded-[14px] bg-white p-4 shadow-sm">
              {view.prizeImageUrl ? (
                <img
                  src={view.prizeImageUrl}
                  alt={view.prizeName}
                  className="h-[140px] w-[147px] rounded-[10px] bg-[#DFDDD4] object-cover"
                />
              ) : (
                <div className="h-[140px] w-[147px] rounded-[10px] bg-[#DFDDD4]" />
              )}
              <p className="mt-3 text-center text-[18px] text-ink">
                {view.prizeName}
              </p>
            </div>

            {/* 参与人信息 */}
            <div className="mt-3 rounded-[14px] bg-white p-4 shadow-sm">
              <div className="space-y-2 text-[15px]">
                <div className="flex justify-between">
                  <span className="text-sub">参与人</span>
                  <span className="text-ink">{view.userHint}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sub">兑奖截止</span>
                  <span className="text-ink">
                    {new Date(view.redeemEndAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sub">兑奖状态</span>
                  <StatusTag status={view.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-sub">兑奖码</span>
                  <span className="text-ink">{code || '—'}</span>
                </div>
              </div>
            </div>

            <p className="mt-3 flex items-start gap-1.5 px-1 text-[14px] leading-snug text-sub">
              <img
                src={SLICES.redeemConfirm.warn}
                alt=""
                className="mt-0.5 h-[19px] w-[16px] shrink-0 object-contain"
              />
              请当面核对参与人身份信息，确认无误后发放奖品
            </p>

            {/* 双按钮 */}
            <div className="mt-4 space-y-2 pb-4">
              {!alreadyRedeemed && !expired && (
                <ActionButton
                  onClick={() => void confirm()}
                  disabled={confirming}
                  className="w-full"
                >
                  {confirming ? '核销中…' : '确认发放'}
                </ActionButton>
              )}
              {alreadyRedeemed && (
                <ActionButton
                  onClick={() =>
                    navigate('/redeem/already', {
                      state: { redeemedAt: view.redeemedAt },
                    })
                  }
                  className="w-full"
                >
                  查看核销结果
                </ActionButton>
              )}
              <ActionButton
                variant="danger-outline"
                onClick={() => navigate('/')}
                className="w-full"
              >
                返回工作台
              </ActionButton>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

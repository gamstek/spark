import { useNavigate } from 'react-router-dom';
import { useRuntime } from '../hooks/use-runtime';
import { SLICES } from '../lib/assets';
import { PageShell } from '../components/page-shell';
import { ActionButton } from '../components/action-button';
import { PageHeader } from '../components/page-header';
import { useDocumentTitle } from '../hooks/use-document-title';

/**
 * 提交成功（表单提交后的等待/确认屏）。
 * 背景：submit-success/bg.png 铺满整页；图标 + 「提交成功」蓝紫主标题
 *   + 深灰副文两行；下方「去抽奖」按钮（刷新运行时，由服务端判定可抽性）。
 */
export function SubmitSuccessPage() {
  const { activity, continueToLottery } = useRuntime();
  const navigate = useNavigate();
  useDocumentTitle(activity.title, '提交成功');

  return (
    <PageShell className="bg-canvas">
      {/* 整页背景图 */}
      <img
        src={SLICES.submitSuccessBg}
        alt=""
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-full object-cover"
      />
      <PageHeader
        title="提交成功"
        onBack={() => navigate(-1)}
      />

      {/* 成功图标 133.5×118.5 (120.5,242.5) */}
      <img
        src={SLICES.submitSuccessIcon}
        alt="提交成功"
        className="absolute left-[120px] top-[242px] h-[118px] w-[134px] object-contain"
      />

      {/* 主标题「提交成功」36px 蓝紫 (114.5,379.5) */}
      <h1 className="absolute left-[114px] top-[379px] w-[147px] text-center text-[36px] text-win2">
        提交成功
      </h1>

      {/* 副文「恭喜你 已获得本次抽奖机会」18px 深灰 两行 (102,447.5) */}
      <p className="absolute left-[102px] top-[447px] w-[173px] text-center text-[18px] text-[#3A3A3A]">
        恭喜你
        <br />
        已获得本次抽奖机会
      </p>

      {/* 按钮：去抽奖 (43,658) 293×58 */}
      <div className="absolute left-[43px] top-[658px] w-[293px]">
        <ActionButton onClick={() => void continueToLottery()}>
          去抽奖
        </ActionButton>
      </div>
    </PageShell>
  );
}

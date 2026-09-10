import { useState } from 'react';
import { useRuntime } from '../lib/runtime';
import { PageShell } from '../components/page-shell';
import { ActionButton } from '../components/action-button';
import { PrivacyModal } from '../components/privacy-modal';

/**
 * 填写活动信息：留资通过钉钉表单外链完成。
 * 点击提交后由后端下发已预填 participationId 的表单地址并跳转；
 * 用户提交钉钉表单后回调服务端记录线索，回到本页时运行时自动推进。
 */
export function FormPage() {
  const { startForm } = useRuntime();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = () => {
    setSubmitting(true);
    void startForm().finally(() => setSubmitting(false));
  };

  return (
    <PageShell className="bg-canvas">
      <main className="relative h-full px-0 pt-3">
        <header className="mx-auto text-[18px] text-ink">填写活动信息</header>

        <div className="mx-4 mt-4 flex-1 rounded-[14px] bg-white/90">
          <div className="flex flex-col gap-3 px-4 py-5 text-[15px] leading-[24px] text-ink">
            <p>1. 点击下方按钮打开钉钉活动表单</p>
            <p>2. 填写姓名、手机号等信息并提交</p>
            <p>3. 提交成功后返回本页即可参与抽奖</p>
          </div>

          {/* 协议复选 */}
          <div className="px-4 pb-2 text-[12px] text-ink">
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              className="text-left"
            >
              ☐ 我已阅读活动隐私协议《活动隐私协议》
            </button>
          </div>

          <div className="flex justify-center pb-12 pt-2">
            <ActionButton
              onClick={onSubmit}
              disabled={submitting}
              className="w-[286px]"
            >
              {submitting ? '正在打开表单…' : '前往填写'}
            </ActionButton>
          </div>
        </div>

        <PrivacyModal
          open={showPrivacy}
          onClose={() => setShowPrivacy(false)}
          onAgree={() => setShowPrivacy(false)}
        />
      </main>
    </PageShell>
  );
}

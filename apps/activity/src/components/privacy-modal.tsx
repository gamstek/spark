import { useEffect, useState } from 'react';
import { ACTIVITY } from '../lib/activity';

interface PrivacyModalProps {
  open: boolean;
  onClose: () => void;
  onAgree: () => void;
}

/**
 * 用户活动隐私协议弹层（蓝湖「用户活动协议」屏）。
 * Demo 展示协议全文 + 「我已阅读《活动隐私协议》」复选，勾选后可继续。
 */
export function PrivacyModal({ open, onClose, onAgree }: PrivacyModalProps) {
  const [ack, setAck] = useState(false);

  // 每次打开重置勾选
  useEffect(() => {
    if (open) setAck(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="mx-auto max-w-[375px] flex-col rounded-t-2xl bg-white">
        {/* 头部:标题 + 关闭 */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[16px] text-ink">用户活动隐私协议</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="text-ink"
          >
            ✕
          </button>
        </div>

        {/* 协议正文 */}
        <div className="max-h-[45vh] overflow-y-auto px-4 text-[14px] leading-[1.7] text-black">
          <p className="mb-2">
            为切实保护用户隐私权，优化用户体验，{ACTIVITY.organizer}
            根据现行法规及政策，制定本用户隐私政策。引力波智谱了解个人信息对客户的重要性，我们力求明确说明我们获取、管理及保护用户个人信息的政策及措施。
          </p>
          <p>本隐私政策将帮助您了解以下内容：</p>
          <ul className="ml-4 list-decimal">
            <li>我们会收集哪些信息（无论其是否为个人信息）</li>
            <li>我们如何使用信息</li>
            <li>我们如何共享信息</li>
            <li>我们如何转让信息</li>
            <li>我们如何公开披露信息</li>
            <li>一般储存期限</li>
            <li>我们如何确保您的信息安全</li>
            <li>本隐私政策不适用的范围</li>
            <li>本隐私政策如何更新</li>
            <li>联系我们</li>
          </ul>
        </div>

        {/* 复选 + 继续 */}
        <div className="p-4">
          <label className="flex items-center gap-2 text-[12px] text-ink">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            我已阅读活动隐私协议《活动隐私协议》
          </label>
          <AgreeButton
            disabled={!ack}
            onClick={onAgree}
          />
        </div>
      </div>
    </div>
  );
}

function AgreeButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`mt-4 block h-[48px] w-full rounded-full text-[16px] text-white ${
        disabled ? 'bg-line' : 'bg-brand active:opacity-90'
      }`}
    >
      同意并继续
    </button>
  );
}

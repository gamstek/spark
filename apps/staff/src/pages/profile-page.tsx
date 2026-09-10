import { ActionButton } from '../components/action-button';
import { SLICES } from '../lib/assets';
import { useStaff } from '../lib/runtime';
import { AppShell } from './app-shell';

const SYS_VERSION = 'v1.0.0';

export function ProfilePage() {
  const { displayName, me, logout } = useStaff();

  return (
    <AppShell bg={SLICES.profile.bg}>
      <div className="px-3 pb-4">
        <header className="py-3 text-center text-[18px] text-ink">我的</header>

        <div className="flex items-center gap-3 rounded-[14px] bg-white p-4 shadow-sm">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#DDE3FF] text-[20px] text-blue">
            {displayName.slice(0, 1)}
          </div>
          <div>
            <p className="text-[16px] text-ink">{displayName}</p>
            <p className="text-[13px] text-sub">工作人员</p>
          </div>
        </div>

        <div className="mt-3 divide-y divide-line/60 rounded-[14px] bg-white px-4 shadow-sm">
          <div className="flex items-center justify-between py-3">
            <span className="text-[14px] text-ink">账号</span>
            <span className="text-[14px] text-sub">{me?.id ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-[14px] text-ink">版本</span>
            <span className="text-[14px] text-sub">{SYS_VERSION}</span>
          </div>
        </div>

        <ActionButton
          variant="danger-outline"
          onClick={() => void logout()}
          className="mt-4 w-full"
        >
          退出登录
        </ActionButton>
      </div>
    </AppShell>
  );
}

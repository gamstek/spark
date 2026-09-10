import { useNavigate } from 'react-router-dom';

const STEPS: { label: string; path: string }[] = [
  { label: '登录', path: '/login' },
  { label: '工作台', path: '/' },
  { label: '我的', path: '/profile' },
  { label: '奖品', path: '/prizes' },
  { label: '扫码', path: '/scan' },
  { label: '输入码', path: '/enter' },
  { label: '核销确认', path: '/redeem/confirm' },
  { label: '核销成功', path: '/redeem/success' },
  { label: '已核销', path: '/redeem/already' },
  { label: '待办', path: '/todos' },
];

/** Demo 逐屏导航工具栏（仅开发环境显示）。 */
export function DevStepToolbar() {
  const navigate = useNavigate();
  if (!import.meta.env.DEV) return null;
  return (
    <div className="fixed bottom-2 left-1/2 z-50 flex max-w-[calc(100vw-16px)] -translate-x-1/2 gap-1 overflow-x-auto rounded-full bg-black/70 px-3 py-1.5">
      {STEPS.map((s) => (
        <button
          key={s.path}
          onClick={() => navigate(s.path)}
          className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[12px] text-white"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

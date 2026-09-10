import { useNavigate } from 'react-router-dom';

export function ChildPageHeader({ title }: { title: string }) {
  const navigate = useNavigate();

  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between bg-white px-4">
      <button
        type="button"
        aria-label="返回"
        onClick={() => navigate(-1)}
        className="flex h-11 w-11 items-center justify-start"
      >
        <span className="h-3.5 w-3.5 rotate-45 border-b-2 border-l-2 border-ink" />
      </button>
      <h1 className="absolute left-1/2 -translate-x-1/2 text-[18px] font-medium text-ink">
        {title}
      </h1>
      <button
        type="button"
        aria-label="打开菜单"
        onClick={() => navigate('/profile')}
        className="flex h-11 w-11 flex-col items-end justify-center gap-1.5"
      >
        <span className="h-0.5 w-5 rounded bg-ink" />
        <span className="h-0.5 w-5 rounded bg-ink" />
        <span className="h-0.5 w-5 rounded bg-ink" />
      </button>
    </header>
  );
}

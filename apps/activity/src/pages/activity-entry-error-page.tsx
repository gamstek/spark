import { useDocumentTitle } from '../hooks/use-document-title';

const ACTIVITY_ENTRY_ERROR_TITLE = '活动入口无效 - Gamstek 营销活动';

export function ActivityEntryNotice({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center bg-white px-8 text-center">
      <div
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-full bg-[#eef8f1] text-[32px]"
      >
        微信
      </div>
      <h1 className="mt-5 text-[20px] font-medium text-ink">{title}</h1>
      <p className="mt-2 text-[14px] leading-6 text-sub">{message}</p>
    </main>
  );
}

export function ActivityEntryErrorPage() {
  useDocumentTitle(ACTIVITY_ENTRY_ERROR_TITLE, null);

  return (
    <ActivityEntryNotice
      title="活动入口无效"
      message="活动入口无效，请从公众号“活动抽奖”菜单获取新链接"
    />
  );
}

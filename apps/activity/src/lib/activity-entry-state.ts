const INVALID_ENTRY_MESSAGE =
  '活动入口已失效，请从公众号“活动抽奖”菜单获取新链接';
const UNAUTHORIZED_ENTRY_MESSAGE = '请从公众号欢迎消息或“活动抽奖”菜单重新进入';

export function activityEntryError(
  search: string,
  unauthorized: boolean,
): string | null {
  if (new URLSearchParams(search).get('entryError') === 'invalid') {
    return INVALID_ENTRY_MESSAGE;
  }
  return unauthorized ? UNAUTHORIZED_ENTRY_MESSAGE : null;
}

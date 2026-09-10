/**
 * staff 切图统一加载：import.meta.glob 预加载 home 下所有 .png，按语义索引。
 * 仅被组件引用，未引用切图不打包。文件名（组 X / 矢量智能对象）来自蓝湖导出。
 */
const imgs: Record<string, string> = import.meta.glob(
  '../assets/slices/**/*.png',
  { eager: true, query: '?url', import: 'default' },
);

function pick(screen: string, name: string): string {
  const wanted = `/${screen}/${name}.png`;
  for (const [key, url] of Object.entries(imgs)) {
    if (key.endsWith(wanted)) return url;
  }
  return '';
}

export const SLICES = {
  home: {
    /** 活动卡渐变横幅（345×109） */
    activityCard: pick('home', '组 14'),
    /** 统计卡三列 icon（45×45） */
    statToday: pick('home', '组 10'),
    statPending: pick('home', '组 11'),
    statStock: pick('home', '组 12'),
    /** 核销入口 icon */
    scan: pick('home', '矢量智能对象(3)'),
    manual: pick('home', '矢量智能对象(4)'),
    /** 底部 Tab icons（30×31） */
    tabHome: pick('home', '矢量智能对象'),
    tabPrizes: pick('home', '矢量智能对象(1)'),
    tabProfile: pick('home', '矢量智能对象(2)'),
  },
  redeemConfirm: {
    /** 页面背景图 */
    bg: pick('redeem-confirm', 'bg'),
    /** 核销码验证通过图标（66×66） */
    verify: pick('redeem-confirm', '矢量智能对象'),
    /** 奖品图（147×140） */
    prize: pick('redeem-confirm', '组 1'),
    /** 警示图标（16×19） */
    warn: pick('redeem-confirm', '图层 678'),
  },
  redeemSuccess: {
    /** 页面背景图 */
    bg: pick('redeem-success', 'bg'),
    /** 核销成功图标（118×118） */
    icon: pick('redeem-success', '矢量智能对象'),
  },
  redeemAlready: {
    /** 已核销页背景图 */
    bg: pick('redeem-already', 'bg'),
    /** 已核销图标（118×118） */
    icon: pick('redeem-already', '矢量智能对象'),
  },
  /** 其余页面背景图（750×1350 整页底） */
  prizeStock: { bg: pick('prize-stock', 'bg') },
  profile: { bg: pick('profile', 'bg') },
  todos: { bg: pick('todos', 'bg') },
};

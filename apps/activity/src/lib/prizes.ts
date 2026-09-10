export interface PrizeItem {
  name: string;
  /** 抽奖屏建议奖品图；活动说明列表不需要 */
  imageUrl?: string;
}

/** 抽奖屏六宫格（顺序对应蓝湖坐标） */
export const LOTTERY_PRIZES: PrizeItem[] = [
  { name: '小米充电宝' },
  { name: '保温杯' },
  { name: '定制手机支架' },
  { name: '定制手提袋' },
  { name: '手摇扇' },
  { name: '定制笔记本' },
];

/** 活动说明页奖品介绍（带序号） */
export const INFO_PRIZES: { rank: number; name: string }[] = [
  { rank: 1, name: '小米充电宝' },
  { rank: 2, name: '定制保温杯' },
  { rank: 3, name: '定制手机支架' },
  { rank: 4, name: '定制单肩包' },
  { rank: 5, name: '定制笔记本' },
  { rank: 6, name: '定制手摇扇' },
];

/**
 * 蓝湖切图（slices）资源统一加载。
 * 通过 import.meta.glob 预加载 all slices 下的图片，按「屏/语义名」索引。
 * 仅被页面组件引用，未引用的切图不会打包。
 */

export interface SliceAssets {
  // home：主视觉图 + 底部三入口图标
  homeBg: string;
  homeIcon: string[];
  // 扫码关注
  subscribeQr: string;
  subscribeBg: string;
  // 提交成功
  submitSuccessIcon: string;
  submitSuccessBg: string;
  // 抽奖中：整页背景 + 转盘盘面
  lotteryBg: string;
  lotteryWheelFace: string;
}

const slices: Record<string, string> = import.meta.glob(
  '../assets/slices/**/*.{jpg,jpeg,png}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
);

function pick(
  screen: string,
  name: string,
  extension: 'jpg' | 'jpeg' | 'png' = 'png',
): string {
  const wanted = `/${screen}/${name}.${extension}`;
  for (const [key, url] of Object.entries(slices)) {
    if (key.endsWith(wanted)) return url;
  }
  return '';
}

export const SLICES: SliceAssets = {
  homeBg: pick('home', 'home-bg', 'jpg'),
  homeIcon: [
    pick('home', 'icon-1'),
    pick('home', 'icon-2'),
    pick('home', 'icon-3'),
  ],
  subscribeQr: pick('subscribe', 'qr'),
  subscribeBg: pick('subscribe', 'bg', 'jpg'),
  submitSuccessIcon: pick('submit-success', 'icon'),
  submitSuccessBg: pick('submit-success', 'bg', 'jpg'),
  lotteryBg: pick('lottery', 'bg', 'jpg'),
  lotteryWheelFace: pick('lottery', 'wheel-face'),
};

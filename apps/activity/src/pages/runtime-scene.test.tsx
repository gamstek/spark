import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RuntimeScene } from './runtime-scene';

const runtime = vi.hoisted(() => ({
  view: 'home',
  step: 'FORM',
  message: null as string | null,
  setMessage: vi.fn(),
  startForm: vi.fn(),
  activity: { title: '测试活动' },
}));

vi.mock('../hooks/use-runtime', () => ({ useRuntime: () => runtime }));
vi.mock('./home-page', () => ({ HomePage: () => <div>活动首页</div> }));
vi.mock('./activity-info-page', () => ({
  ActivityInfoPage: () => <div>活动说明</div>,
}));
vi.mock('./activity-rules-page', () => ({
  ActivityRulesPage: () => <div>活动规则</div>,
}));
vi.mock('./subscribe-page', () => ({
  SubscribePage: () => <div>关注公众号</div>,
}));
vi.mock('./submit-success-page', () => ({
  SubmitSuccessPage: () => <div>提交成功</div>,
}));
vi.mock('./lottery-page', () => ({ LotteryPage: () => <div>抽奖</div> }));
vi.mock('./redemption-page', () => ({
  RedemptionPage: () => <div>我的奖品</div>,
}));

describe('RuntimeScene', () => {
  beforeEach(() => {
    runtime.view = 'home';
    runtime.step = 'FORM';
  });

  it('shows the activity home before participation starts', () => {
    const markup = renderToStaticMarkup(<RuntimeScene />);

    expect(markup).toContain('活动首页');
    expect(markup).not.toContain('填写活动信息');
  });

  it('opens the DingTalk form instead of rendering a local form page', () => {
    runtime.view = 'flow';
    const markup = renderToStaticMarkup(<RuntimeScene />);

    expect(markup).toContain('正在打开钉钉表单');
    expect(markup).not.toContain('填写活动信息');
  });

  it('keeps the winning result on the lottery page', () => {
    runtime.view = 'flow';
    runtime.step = 'PRIZE';

    expect(renderToStaticMarkup(<RuntimeScene />)).toContain('抽奖');
  });

  it('renders redemption details only on the prizes route', () => {
    runtime.view = 'prizes';
    runtime.step = 'PRIZE';

    expect(renderToStaticMarkup(<RuntimeScene />)).toContain('我的奖品');
  });
});

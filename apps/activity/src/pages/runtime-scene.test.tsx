import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RuntimeScene } from './runtime-scene';

const runtime = vi.hoisted(() => ({
  view: 'home',
  step: 'FORM',
  formSubmitted: false,
  message: null as string | null,
  setMessage: vi.fn(),
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
    runtime.formSubmitted = false;
  });

  it('shows the activity home before participation starts', () => {
    const markup = renderToStaticMarkup(<RuntimeScene />);

    expect(markup).toContain('活动首页');
    expect(markup).not.toContain('填写活动信息');
  });

  it('renders the local registration page while the form is incomplete', () => {
    runtime.view = 'flow';
    const markup = renderToStaticMarkup(<RuntimeScene />);

    expect(markup).toContain('专家信息登记表单');
  });

  it('shows submission success ahead of the server runtime step', () => {
    runtime.view = 'flow';
    runtime.step = 'FORM';
    runtime.formSubmitted = true;

    expect(renderToStaticMarkup(<RuntimeScene />)).toContain('提交成功');
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

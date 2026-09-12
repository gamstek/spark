import { describe, expect, it } from 'vitest';

import {
  preparePrivacyAgreement,
  privacyAgreementSource,
} from './privacy-agreement';

describe('preparePrivacyAgreement', () => {
  it('prepares the supplied agreement for the current activity and collected answers', () => {
    const content = preparePrivacyAgreement(privacyAgreementSource, '测试活动');

    expect(content).toContain('测试活动');
    expect(content).toContain('用户活动隐私协议');
    for (const category of [
      '姓名',
      '单位',
      '部门',
      '职位',
      '手机号码',
      '电子邮箱',
      '研究方向',
      '仪器类型',
      '关注目的',
      '后续信息',
      '致电',
      '展台',
      '其他具体需求',
    ]) {
      expect(content).toContain(category);
    }
    expect(content).toContain('第三方服务清单为：无');
    expect(content).toContain('勾选');
    expect(content).toContain('提交');
    expect(content).not.toMatch(/[【】]/);
    expect(content).not.toContain('{{activityName}}');
    expect(content).not.toContain('验证码校验结果');
    expect(content).not.toContain('短信验证');
    expect(content).not.toContain('抽奖活动隐私协议');
  });

  it('replaces every exact activity token and leaves the rest of the source unchanged', () => {
    expect(
      preparePrivacyAgreement(
        '{{activityName}} / {{activityName}} / {{other}}',
        '测试活动',
      ),
    ).toBe('测试活动 / 测试活动 / {{other}}');
  });

  it('rejects stale sources without the required activity token', () => {
    expect(() => preparePrivacyAgreement('通用活动协议', '测试活动')).toThrow(
      'Privacy agreement is missing {{activityName}}',
    );
  });
});

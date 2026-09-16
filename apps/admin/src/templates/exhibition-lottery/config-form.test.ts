import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ConfigForm, getLotteryConfigError } from './config-form';

const config = {
  requireSubscribe: true,
  winningProbability: 0,
  halfDayPrizeLimits: {},
  rulesText: '填写信息后参与抽奖，每人每场活动限一次。',
};

describe('lottery activity configuration validation', () => {
  it('only exposes the activity rules input', () => {
    const html = renderToStaticMarkup(
      createElement(ConfigForm, { value: config }),
    );

    expect(
      [...html.matchAll(/name="([^"]+)"/g)].map((match) => match[1]),
    ).toEqual(['rulesText']);
    expect(html.match(/class="required-field-mark"/g)).toHaveLength(1);
    expect(html).toContain('活动规则');
    expect(html.match(/<h2\b/g)).toHaveLength(1);
    expect(html).not.toContain('主图资源 ID');
    expect(html).not.toContain('上传新主图');
  });

  it('accepts the self-hosted activity configuration', () => {
    expect(getLotteryConfigError(config)).toBeNull();
  });

  it('explains that activity rules are required', () => {
    expect(getLotteryConfigError({ ...config, rulesText: ' ' })).toBe(
      '请填写活动规则。',
    );
  });
});

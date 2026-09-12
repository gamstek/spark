import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ConfigForm, getLotteryConfigError } from './config-form';

const config = {
  requireSubscribe: true,
  noPrizeWeight: 1,
  heroAssetId: 'hero',
  rulesText: '填写信息后参与抽奖，每人每场活动限一次。',
};

describe('lottery activity configuration validation', () => {
  it('only exposes page content inputs and marks the two required fields', () => {
    const html = renderToStaticMarkup(
      createElement(ConfigForm, { value: config }),
    );

    expect(
      [...html.matchAll(/name="([^"]+)"/g)].map((match) => match[1]),
    ).toEqual(['heroAssetId', 'heroFile', 'rulesText']);
    expect(html.match(/class="required-field-mark"/g)).toHaveLength(2);
    expect(html).toContain('主视觉与活动规则');
    expect(html.match(/<h2\b/g)).toHaveLength(1);
    expect(html).not.toContain('type="url"');
  });

  it('accepts the self-hosted activity configuration', () => {
    expect(getLotteryConfigError(config)).toBeNull();
  });

  it('explains that a main image is required', () => {
    expect(getLotteryConfigError({ ...config, heroAssetId: '' })).toBe(
      '请上传活动主图，或填写已有的主图资源 ID。',
    );
  });

  it('explains that activity rules are required', () => {
    expect(getLotteryConfigError({ ...config, rulesText: ' ' })).toBe(
      '请填写活动规则。',
    );
  });
});

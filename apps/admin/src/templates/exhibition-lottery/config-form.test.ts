import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import * as configForm from './config-form';

describe('lottery activity configuration validation', () => {
  it('marks every required template field', () => {
    const html = renderToStaticMarkup(createElement(configForm.ConfigForm));

    expect(html.match(/class="required-field-mark"/g)).toHaveLength(5);
    expect(html).toContain('（必填）');
  });

  it('exposes validation for activity form submissions', () => {
    const exports = configForm as unknown as Record<string, unknown>;

    expect(exports.getLotteryConfigError).toBeTypeOf('function');
  });

  it('explains that a main image is required', () => {
    expect(
      configForm.getLotteryConfigError({
        formId: '1111',
        formUrl:
          'https://alidocs.dingtalk.com/notable/share/form/example?source=link',
        prefillField: 'participant',
        fieldMapping: {
          participationId: '参与编号',
          name: '姓名',
          phone: '手机号',
        },
        requireSubscribe: true,
        heroAssetId: '',
        rulesText: '活动规则',
      }),
    ).toBe('请上传活动主图，或填写已有的主图资源 ID。');
  });

  it('explains that the DingTalk form link is invalid', () => {
    expect(
      configForm.getLotteryConfigError({
        formId: '1111',
        formUrl: '[https://alidocs.dingtalk.com/notable/share/form/example]',
        prefillField: 'participant',
        fieldMapping: {
          participationId: '参与编号',
          name: '姓名',
          phone: '手机号',
        },
        requireSubscribe: true,
        heroAssetId: 'asset-1',
        rulesText: '活动规则',
      }),
    ).toBe('请输入 alidocs.dingtalk.com 域名下的 HTTPS 表单链接。');
  });
});

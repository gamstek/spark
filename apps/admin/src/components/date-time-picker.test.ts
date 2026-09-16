import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DateTimePicker } from './date-time-picker';

describe('DateTimePicker', () => {
  it('keeps the Shanghai form value without using a native datetime picker', () => {
    const html = renderToStaticMarkup(
      createElement(DateTimePicker, {
        id: 'startsAt',
        name: 'startsAt',
        label: '活动开始',
        defaultValue: '2026-09-15T09:30',
      }),
    );

    expect(html).toContain('2026年9月15日 09:30');
    expect(html).toContain('name="startsAt"');
    expect(html).not.toContain('datetime-local');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActivityPublicLink } from './activity-link';

describe('ActivityPublicLink', () => {
  it('opens the encoded public activity path in a safe new tab', () => {
    const markup = renderToStaticMarkup(
      <ActivityPublicLink code="expo / 2026" />,
    );
    expect(markup).toContain('href="/activity/expo%20%2F%202026"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('/activity/expo / 2026');
  });
});

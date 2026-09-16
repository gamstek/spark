import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './status-badge';

describe('StatusBadge redemption status labels', () => {
  it.each([
    ['WAIT_REDEEM', '待核销'],
    ['REDEEMED', '已核销'],
    ['EXPIRED', '已过期'],
  ])('renders %s as %s', (status, label) => {
    expect(renderToStaticMarkup(<StatusBadge status={status} />)).toContain(
      label,
    );
  });
});

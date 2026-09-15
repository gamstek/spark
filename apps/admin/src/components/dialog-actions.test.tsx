import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DialogActions } from './dialog-actions';

describe('DialogActions', () => {
  it('owns the canonical dialog action-row class without changing children', () => {
    const html = renderToStaticMarkup(
      <DialogActions>
        <button
          type="button"
          onClick={() => undefined}
        >
          取消
        </button>
        <button type="submit">确认</button>
      </DialogActions>,
    );

    expect(html).toContain('class="dialog-actions"');
    expect(html.indexOf('取消')).toBeLessThan(html.indexOf('确认'));
  });
});

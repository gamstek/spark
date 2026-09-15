import { describe, expect, it } from 'vitest';

import { ApiErrorSchema } from './index.js';

describe('lifecycle API errors', () => {
  it('parses the not-running conflict returned by draw, pause and resume', () => {
    const error = {
      code: 'ACTIVITY_NOT_RUNNING',
      message: 'ACTIVITY_NOT_RUNNING',
      requestId: 'request-1',
    };
    expect(ApiErrorSchema.parse(error)).toEqual(error);
  });
});

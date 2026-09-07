import { BadRequestException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ApiExceptionFilter } from './api-exception.filter.js';

describe('ApiExceptionFilter', () => {
  it('returns a stable error envelope and preserves the request id', () => {
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'request-1' }),
        getResponse: () => ({ status }),
      }),
    };

    new ApiExceptionFilter().catch(
      new BadRequestException('INVALID_ACTIVITY'),
      host as never,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(send).toHaveBeenCalledWith({
      code: 'INVALID_ACTIVITY',
      message: 'INVALID_ACTIVITY',
      requestId: 'request-1',
    });
  });

  it('maps known domain conflicts instead of exposing a 500', () => {
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'request-2' }),
        getResponse: () => ({ status }),
      }),
    };

    new ApiExceptionFilter().catch(
      new Error('VERSION_CONFLICT'),
      host as never,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(send).toHaveBeenCalledWith({
      code: 'VERSION_CONFLICT',
      message: 'VERSION_CONFLICT',
      requestId: 'request-2',
    });
  });
});

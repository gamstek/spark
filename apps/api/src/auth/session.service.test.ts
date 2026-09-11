import { describe, expect, it, vi } from 'vitest';

import { AppSession } from '../../database/entities/index.js';
import { SessionService } from './session.service.js';

describe('SessionService', () => {
  it('inserts an activity session through the supplied transaction manager', async () => {
    const defaultManager = { getRepository: vi.fn() };
    const dataSourceRepository = { insert: vi.fn() };
    const dataSource = {
      manager: defaultManager,
      getRepository: vi.fn().mockReturnValue(dataSourceRepository),
    };
    const suppliedManager = {
      getRepository: vi.fn().mockReturnValue({ insert: vi.fn() }),
    };
    const sessions = new SessionService(dataSource as never, 'csrf-secret');

    await sessions.create('ACTIVITY', 'user-id', suppliedManager as never);

    expect(suppliedManager.getRepository).toHaveBeenCalledWith(AppSession);
    expect(dataSource.getRepository).not.toHaveBeenCalled();
  });

  it('inserts an activity session through the default data-source manager', async () => {
    const defaultManager = {
      getRepository: vi.fn().mockReturnValue({ insert: vi.fn() }),
    };
    const dataSource = {
      manager: defaultManager,
      getRepository: vi.fn().mockReturnValue({ insert: vi.fn() }),
    };
    const sessions = new SessionService(dataSource as never, 'csrf-secret');

    await sessions.create('ACTIVITY', 'user-id');

    expect(defaultManager.getRepository).toHaveBeenCalledWith(AppSession);
    expect(dataSource.getRepository).not.toHaveBeenCalled();
  });
});

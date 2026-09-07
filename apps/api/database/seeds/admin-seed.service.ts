import { randomUUID } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { hashPassword } from '../../src/auth/accounts.service.js';
import { AdminAccount } from '../entities/index.js';

export interface CreateAdminAccountInput {
  username: string;
  password: string;
}

export async function createAdminAccount(
  dataSource: DataSource,
  input: CreateAdminAccountInput,
): Promise<AdminAccount> {
  const username = input.username.trim();
  if (!username) throw new Error('INVALID_USERNAME');
  if (
    input.password.length < 12 ||
    ['password', 'admin123456', 'changeme'].includes(
      input.password.toLowerCase(),
    )
  ) {
    throw new Error('PASSWORD_TOO_WEAK');
  }

  const repository = dataSource.getRepository(AdminAccount);
  return repository.save(
    repository.create({
      id: randomUUID(),
      username,
      passwordHash: await hashPassword(input.password),
      displayName: username,
      disabledAt: null,
    }),
  );
}

import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';

import {
  AdminAccount,
  AuditEvent,
  StaffAccount,
} from '../../database/entities/index.js';

const scrypt = promisify(scryptCallback);
type AccountRole = 'ADMIN' | 'STAFF';

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [algorithm, salt, expectedText] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedText) return false;
  const expected = Buffer.from(expectedText, 'base64url');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

@Injectable()
export class AccountsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async authenticate(
    role: AccountRole,
    username: string,
    password: string,
  ): Promise<{ id: string; displayName: string } | null> {
    const account =
      role === 'ADMIN'
        ? await this.dataSource.getRepository(AdminAccount).findOneBy({
            username,
            disabledAt: IsNull(),
          })
        : await this.dataSource.getRepository(StaffAccount).findOneBy({
            username,
            disabledAt: IsNull(),
          });
    if (!account || !(await verifyPassword(password, account.passwordHash)))
      return null;
    return { id: account.id, displayName: account.displayName };
  }

  async disable(
    role: AccountRole,
    subjectId: string,
    actorAdminId: string,
  ): Promise<void> {
    const table = role === 'ADMIN' ? 'admin_account' : 'staff_account';
    await this.dataSource.transaction(async (manager) => {
      if (role === 'ADMIN') {
        await manager.getRepository(AdminAccount).update(subjectId, {
          disabledAt: () => 'now()',
        });
      } else {
        await manager.getRepository(StaffAccount).update(subjectId, {
          disabledAt: () => 'now()',
        });
      }
      await manager.getRepository(AuditEvent).insert({
        id: randomUUID(),
        actorType: 'ADMIN',
        actorId: actorAdminId,
        action: 'ACCOUNT_DISABLED',
        resourceType: table,
        resourceId: subjectId,
      });
    });
  }
}

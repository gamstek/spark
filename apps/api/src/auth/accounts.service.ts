import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
    const table = role === 'ADMIN' ? 'admin_account' : 'staff_account';
    const rows = await this.dataSource.query<
      { id: string; display_name: string; password_hash: string }[]
    >(
      `SELECT id, display_name, password_hash FROM ${table} WHERE username=$1 AND disabled_at IS NULL`,
      [username],
    );
    const account = rows[0];
    if (!account || !(await verifyPassword(password, account.password_hash)))
      return null;
    return { id: account.id, displayName: account.display_name };
  }

  async disable(
    role: AccountRole,
    subjectId: string,
    actorAdminId: string,
  ): Promise<void> {
    const table = role === 'ADMIN' ? 'admin_account' : 'staff_account';
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`UPDATE ${table} SET disabled_at=now() WHERE id=$1`, [
        subjectId,
      ]);
      await manager.query(
        `INSERT INTO audit_event (id, actor_type, actor_id, action, resource_type, resource_id) VALUES ($1,'ADMIN',$2,'ACCOUNT_DISABLED',$3,$4)`,
        [randomUUID(), actorAdminId, table, subjectId],
      );
    });
  }
}

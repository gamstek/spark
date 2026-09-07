import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type SessionRole = 'ACTIVITY' | 'STAFF' | 'ADMIN';
export const CSRF_SECRET = Symbol('CSRF_SECRET');
const subjectColumns = { ACTIVITY: 'user_id', STAFF: 'staff_account_id', ADMIN: 'admin_account_id' } as const;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function csrfForSession(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('base64url');
}

@Injectable()
export class SessionService {
  private readonly csrfSecret: string;

  constructor(@Inject(DataSource) private readonly dataSource: DataSource, @Optional() @Inject(CSRF_SECRET) csrfSecret?: string) {
    const configuredSecret = csrfSecret ?? process.env.CSRF_SECRET;
    if (process.env.NODE_ENV === 'production' && !configuredSecret) throw new Error('CSRF_SECRET_REQUIRED');
    this.csrfSecret = configuredSecret ?? 'development-only-change-me';
  }

  async create(role: SessionRole, subjectId: string): Promise<{ token: string; csrfToken: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const csrfToken = csrfForSession(token, this.csrfSecret);
    const expiresAt = new Date(Date.now() + (role === 'ACTIVITY' ? 7 * 24 : 8) * 60 * 60 * 1000);
    await this.dataSource.query(
      `INSERT INTO app_session (id, session_hash, csrf_hash, role, ${subjectColumns[role]}, expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), tokenHash(token), tokenHash(csrfToken), role, subjectId, expiresAt],
    );
    return { token, csrfToken, expiresAt };
  }

  async resolve(token: string, role: SessionRole): Promise<{ subjectId: string; role: SessionRole; csrfToken: string } | null> {
    const accountJoin = role === 'ADMIN'
      ? 'JOIN admin_account account ON account.id=session.admin_account_id'
      : role === 'STAFF' ? 'JOIN staff_account account ON account.id=session.staff_account_id' : '';
    const activeAccount = role === 'ACTIVITY' ? '' : 'AND account.disabled_at IS NULL';
    const rows = await this.dataSource.query<{ subject_id: string; csrf_hash: string }[]>(
      `SELECT session.${subjectColumns[role]} AS subject_id, session.csrf_hash FROM app_session session ${accountJoin}
       WHERE session.session_hash=$1 AND session.role=$2 AND session.expires_at > now() ${activeAccount}`,
      [tokenHash(token), role],
    );
    const session = rows[0];
    if (!session) return null;
    const csrfToken = csrfForSession(token, this.csrfSecret);
    const suppliedHash = Buffer.from(tokenHash(csrfToken));
    const storedHash = Buffer.from(session.csrf_hash);
    if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) return null;
    return { subjectId: session.subject_id, role, csrfToken };
  }

  async revoke(token: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM app_session WHERE session_hash=$1`, [tokenHash(token)]);
  }

  async revokeAccount(role: SessionRole, subjectId: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM app_session WHERE role=$1 AND ${subjectColumns[role]}=$2`, [role, subjectId]);
  }
}

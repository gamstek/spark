import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import {
  AdminAccount,
  AppSession,
  StaffAccount,
} from '../../database/entities/index.js';

export type SessionRole = 'ACTIVITY' | 'STAFF' | 'ADMIN';
export const CSRF_SECRET = Symbol('CSRF_SECRET');
const subjectProperties = {
  ACTIVITY: 'userId',
  STAFF: 'staffAccountId',
  ADMIN: 'adminAccountId',
} as const;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function csrfForSession(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('base64url');
}

@Injectable()
export class SessionService {
  private readonly csrfSecret: string;

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Optional() @Inject(CSRF_SECRET) csrfSecret?: string,
  ) {
    const configuredSecret = csrfSecret ?? process.env.CSRF_SECRET;
    if (process.env.NODE_ENV === 'production' && !configuredSecret)
      throw new Error('CSRF_SECRET_REQUIRED');
    this.csrfSecret = configuredSecret ?? 'development-only-change-me';
  }

  async create(
    role: SessionRole,
    subjectId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<{ token: string; csrfToken: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const csrfToken = csrfForSession(token, this.csrfSecret);
    const expiresAt = new Date(
      Date.now() + (role === 'ACTIVITY' ? 7 * 24 : 8) * 60 * 60 * 1000,
    );
    await manager.getRepository(AppSession).insert({
      id: randomUUID(),
      sessionHash: tokenHash(token),
      csrfHash: tokenHash(csrfToken),
      role,
      [subjectProperties[role]]: subjectId,
      expiresAt,
    });
    return { token, csrfToken, expiresAt };
  }

  async resolve(
    token: string,
    role: SessionRole,
  ): Promise<{
    subjectId: string;
    role: SessionRole;
    csrfToken: string;
  } | null> {
    const query = this.dataSource
      .getRepository(AppSession)
      .createQueryBuilder('session')
      .select(`session.${subjectProperties[role]}`, 'subject_id')
      .addSelect('session.csrfHash', 'csrf_hash')
      .where('session.sessionHash = :hash', { hash: tokenHash(token) })
      .andWhere('session.role = :role', { role })
      .andWhere('session.expiresAt > now()');
    if (role !== 'ACTIVITY') {
      query
        .innerJoin(
          role === 'ADMIN' ? AdminAccount : StaffAccount,
          'account',
          `account.id = session.${subjectProperties[role]}`,
        )
        .andWhere('account.disabledAt IS NULL');
    }
    const session = await query.getRawOne<{
      subject_id: string;
      csrf_hash: string;
    }>();
    if (!session) return null;
    const csrfToken = csrfForSession(token, this.csrfSecret);
    const suppliedHash = Buffer.from(tokenHash(csrfToken));
    const storedHash = Buffer.from(session.csrf_hash);
    if (
      suppliedHash.length !== storedHash.length ||
      !timingSafeEqual(suppliedHash, storedHash)
    )
      return null;
    return { subjectId: session.subject_id, role, csrfToken };
  }

  async revoke(token: string): Promise<void> {
    await this.dataSource.getRepository(AppSession).delete({
      sessionHash: tokenHash(token),
    });
  }

  async revokeAccount(role: SessionRole, subjectId: string): Promise<void> {
    await this.dataSource.getRepository(AppSession).delete({
      role,
      [subjectProperties[role]]: subjectId,
    });
  }
}

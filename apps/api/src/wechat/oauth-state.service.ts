import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { OauthState } from '../../database/entities/accounts.entities.js';

export const OAUTH_STATE_SECRET = Symbol('OAUTH_STATE_SECRET');
type Clock = () => Date;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

function hasTraversalSegment(returnPath: string): boolean {
  const pathname = returnPath.split('?', 1)[0] ?? '';
  return pathname.split('/').some((segment) => {
    try {
      const decoded = decodeURIComponent(segment);
      return (
        decoded === '.' ||
        decoded === '..' ||
        decoded.includes('/') ||
        decoded.includes('\\')
      );
    } catch {
      return true;
    }
  });
}

@Injectable()
export class OAuthStateService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Optional()
    @Inject(OAUTH_STATE_SECRET)
    private readonly secret = process.env.OAUTH_STATE_SECRET ??
      'development-oauth-state-secret',
    private readonly clock: Clock = () => new Date(),
  ) {
    if (
      process.env.NODE_ENV === 'production' &&
      !process.env.OAUTH_STATE_SECRET &&
      this.secret === 'development-oauth-state-secret'
    ) {
      throw new Error('OAUTH_STATE_SECRET_REQUIRED');
    }
  }

  validateReturnPath(returnPath: string): void {
    if (
      !/^\/activity\/[a-z0-9-]+(?:\/[A-Za-z0-9_.~!$&'()*+,;=:@%/-]*)?(?:\?[A-Za-z0-9_.~!$&'()*+,;=:@%/?-]*)?$/.test(
        returnPath,
      ) ||
      returnPath.startsWith('//') ||
      hasTraversalSegment(returnPath)
    ) {
      throw new Error('RETURN_PATH_INVALID');
    }
  }

  async issue(
    returnPath: string,
  ): Promise<{ state: string; browserNonce: string; expiresAt: Date }> {
    this.validateReturnPath(returnPath);
    const id = randomUUID();
    const random = randomBytes(24).toString('base64url');
    const unsigned = `${id}.${random}`;
    const signature = createHmac('sha256', this.secret)
      .update(unsigned)
      .digest('base64url');
    const state = `${unsigned}.${signature}`;
    const browserNonce = randomBytes(24).toString('base64url');
    const expiresAt = new Date(this.clock().getTime() + 10 * 60 * 1000);
    await this.dataSource.getRepository(OauthState).insert({
      id,
      stateHash: sha256(state),
      browserNonceHash: sha256(browserNonce),
      returnPath,
      expiresAt,
      createdAt: this.clock(),
    });
    return { state, browserNonce, expiresAt };
  }

  async consume(state: string, browserNonce: string): Promise<string> {
    const [id, random, signature] = state.split('.');
    if (!id || !random || !signature) throw new Error('OAUTH_STATE_INVALID');
    const expected = createHmac('sha256', this.secret)
      .update(`${id}.${random}`)
      .digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error('OAUTH_STATE_INVALID');
    const result = await this.dataSource.query<
      [{ return_path: string }[], number]
    >(
      `UPDATE oauth_state SET consumed_at=$4 WHERE id=$1 AND state_hash=$2 AND browser_nonce_hash=$3
       AND consumed_at IS NULL AND expires_at > $4 RETURNING return_path`,
      [id, sha256(state), sha256(browserNonce), this.clock()],
    );
    const row = result[0][0];
    if (!row) throw new Error('OAUTH_STATE_INVALID');
    return row.return_path;
  }
}

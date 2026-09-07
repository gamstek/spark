import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

export interface CsrfInput {
  origin?: string;
  expectedOrigin: string;
  suppliedToken?: string;
  sessionToken: string;
  secret: string;
}

export function validateOrigin(origin: string | undefined, expectedOrigin: string): void {
  if (origin !== expectedOrigin) throw new Error('ORIGIN_INVALID');
}

export function validateCsrf(input: CsrfInput): void {
  validateOrigin(input.origin, input.expectedOrigin);
  if (!input.suppliedToken) throw new Error('CSRF_INVALID');
  const expected = createHmac('sha256', input.secret).update(input.sessionToken).digest('base64url');
  const actualBuffer = Buffer.from(input.suppliedToken);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) throw new Error('CSRF_INVALID');
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; sessionToken?: string }>();
    validateCsrf({
      origin: request.headers.origin,
      expectedOrigin: process.env.PUBLIC_ORIGIN ?? 'http://localhost:4173',
      suppliedToken: request.headers['x-csrf-token'],
      sessionToken: request.sessionToken ?? '',
      secret: process.env.CSRF_SECRET ?? 'development-only-change-me',
    });
    return true;
  }
}

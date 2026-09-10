import { createHmac, timingSafeEqual } from 'node:crypto';

import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

export interface CsrfInput {
  suppliedToken?: string;
  sessionToken: string;
  secret: string;
}

export function validateCsrf(input: CsrfInput): void {
  if (!input.suppliedToken) throw new ForbiddenException('CSRF_INVALID');
  const expected = createHmac('sha256', input.secret)
    .update(input.sessionToken)
    .digest('base64url');
  const actualBuffer = Buffer.from(input.suppliedToken);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  )
    throw new ForbiddenException('CSRF_INVALID');
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      sessionToken?: string;
    }>();
    validateCsrf({
      suppliedToken: request.headers['x-csrf-token'],
      sessionToken: request.sessionToken ?? '',
      secret: process.env.CSRF_SECRET ?? 'development-only-change-me',
    });
    return true;
  }
}

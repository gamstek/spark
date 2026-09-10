import { createHmac, timingSafeEqual } from 'node:crypto';

import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

export interface CsrfInput {
  origin?: string;
  expectedOrigin: string | string[];
  suppliedToken?: string;
  sessionToken: string;
  secret: string;
}

export function validateOrigin(
  origin: string | undefined,
  expectedOrigin: string | string[],
): void {
  const allowed = Array.isArray(expectedOrigin)
    ? expectedOrigin
    : [expectedOrigin];
  if (!origin || !allowed.includes(origin))
    throw new ForbiddenException('ORIGIN_INVALID');
}

/**
 * 本地/多前端联调时，除 PUBLIC_ORIGIN 外还允许的来源
 * （逗号分隔的 PUBLIC_ORIGIN_EXTRA，例如三个 Vite dev server 同时运行）。
 * 仅用于 Origin 校验；URL 构造仍以 PUBLIC_ORIGIN 为准。
 */
export function allowedOrigins(): string[] {
  const primary = process.env.PUBLIC_ORIGIN ?? 'http://localhost:4173';
  const extra = (process.env.PUBLIC_ORIGIN_EXTRA ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [primary, ...extra];
}

export function validateCsrf(input: CsrfInput): void {
  validateOrigin(input.origin, input.expectedOrigin);
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
    const request = context
      .switchToHttp()
      .getRequest<{
        headers: Record<string, string | undefined>;
        sessionToken?: string;
      }>();
    validateCsrf({
      origin: request.headers.origin,
      expectedOrigin: allowedOrigins(),
      suppliedToken: request.headers['x-csrf-token'],
      sessionToken: request.sessionToken ?? '',
      secret: process.env.CSRF_SECRET ?? 'development-only-change-me',
    });
    return true;
  }
}

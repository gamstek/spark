import { Inject, Injectable, SetMetadata } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SessionService, type SessionRole } from './session.service.js';

export const SESSION_ROLE = 'spark:session-role';
export const RequireSession = (role: SessionRole) => SetMetadata(SESSION_ROLE, role);
export const cookieNames = { ACTIVITY: 'spark_activity', STAFF: 'spark_staff', ADMIN: 'spark_admin' } as const;

export function readCookie(header: string | undefined, name: string): string | undefined {
  return header?.split(';').map((part) => part.trim().split('=')).find(([key]) => key === name)?.[1];
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector, @Inject(SessionService) private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const role = this.reflector.getAllAndOverride<SessionRole>(SESSION_ROLE, [context.getHandler(), context.getClass()]);
    if (!role) return true;
    const request = context.switchToHttp().getRequest<{ headers: { cookie?: string }; session?: unknown; sessionToken?: string }>();
    const token = readCookie(request.headers.cookie, cookieNames[role]);
    if (!token) return false;
    const session = await this.sessions.resolve(token, role);
    if (!session) return false;
    request.session = session;
    request.sessionToken = token;
    return true;
  }
}

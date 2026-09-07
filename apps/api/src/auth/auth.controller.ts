import { Body, Controller, Get, Inject, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AccountsService } from './accounts.service.js';
import { CsrfGuard, validateOrigin } from './csrf.guard.js';
import { cookieNames, readCookie, RequireSession, SessionGuard } from './session.guard.js';
import { SessionService, type SessionRole } from './session.service.js';

type AuthRequest = FastifyRequest & { session?: { subjectId: string; csrfToken: string }; sessionToken?: string };

function cookieHeader(role: SessionRole, token: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${cookieNames[role]}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

abstract class RoleAuthController {
  protected abstract readonly role: 'ADMIN' | 'STAFF';
  constructor(protected readonly accounts: AccountsService, protected readonly sessions: SessionService) {}

  protected async login(body: { username?: string; password?: string }, request: FastifyRequest, reply: FastifyReply) {
    validateOrigin(request.headers.origin, process.env.PUBLIC_ORIGIN ?? 'http://localhost:4173');
    const account = await this.accounts.authenticate(this.role, body.username ?? '', body.password ?? '');
    if (!account) throw new UnauthorizedException();
    const oldToken = readCookie(request.headers.cookie, cookieNames[this.role]);
    if (oldToken) await this.sessions.revoke(oldToken);
    const session = await this.sessions.create(this.role, account.id);
    reply.header('Set-Cookie', cookieHeader(this.role, session.token, 8 * 60 * 60));
    return { id: account.id, role: this.role, displayName: account.displayName };
  }

  protected me(request: AuthRequest) {
    return { id: request.session?.subjectId, role: this.role, csrfToken: request.session?.csrfToken };
  }

  protected async logout(request: AuthRequest, reply: FastifyReply) {
    if (request.sessionToken) await this.sessions.revoke(request.sessionToken);
    reply.header('Set-Cookie', cookieHeader(this.role, '', 0));
    return { success: true };
  }
}

@Controller('admin/auth')
export class AdminAuthController extends RoleAuthController {
  protected readonly role = 'ADMIN' as const;
  constructor(@Inject(AccountsService) accounts: AccountsService, @Inject(SessionService) sessions: SessionService) { super(accounts, sessions); }

  @Post('login') loginRoute(@Body() body: { username?: string; password?: string }, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.login(body, request, reply);
  }

  @Get('me') @RequireSession('ADMIN') @UseGuards(SessionGuard)
  meRoute(@Req() request: AuthRequest) { return this.me(request); }

  @Post('logout') @RequireSession('ADMIN') @UseGuards(SessionGuard, CsrfGuard)
  logoutRoute(@Req() request: AuthRequest, @Res({ passthrough: true }) reply: FastifyReply) { return this.logout(request, reply); }
}

@Controller('staff/auth')
export class StaffAuthController extends RoleAuthController {
  protected readonly role = 'STAFF' as const;
  constructor(@Inject(AccountsService) accounts: AccountsService, @Inject(SessionService) sessions: SessionService) { super(accounts, sessions); }

  @Post('login') loginRoute(@Body() body: { username?: string; password?: string }, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.login(body, request, reply);
  }

  @Get('me') @RequireSession('STAFF') @UseGuards(SessionGuard)
  meRoute(@Req() request: AuthRequest) { return this.me(request); }

  @Post('logout') @RequireSession('STAFF') @UseGuards(SessionGuard, CsrfGuard)
  logoutRoute(@Req() request: AuthRequest, @Res({ passthrough: true }) reply: FastifyReply) { return this.logout(request, reply); }
}

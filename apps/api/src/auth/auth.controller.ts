import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AccountsService } from './accounts.service.js';
import { CsrfGuard } from './csrf.guard.js';
import {
  cookieNames,
  readCookie,
  RequireSession,
  SessionGuard,
} from './session.guard.js';
import { SessionService, type SessionRole } from './session.service.js';
import { DataSource } from 'typeorm';

type AuthRequest = FastifyRequest & {
  session?: { subjectId: string; csrfToken: string };
  sessionToken?: string;
};

function cookieHeader(
  role: SessionRole,
  token: string,
  maxAge: number,
): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${cookieNames[role]}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

abstract class RoleAuthController {
  protected abstract readonly role: 'ADMIN' | 'STAFF';
  constructor(
    protected readonly accounts: AccountsService,
    protected readonly sessions: SessionService,
    protected readonly dataSource: DataSource,
  ) {}

  protected async login(
    body: { username?: string; password?: string },
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const account = await this.accounts.authenticate(
      this.role,
      body.username ?? '',
      body.password ?? '',
    );
    if (!account) throw new UnauthorizedException();
    const oldToken = readCookie(request.headers.cookie, cookieNames[this.role]);
    if (oldToken) await this.sessions.revoke(oldToken);
    const session = await this.sessions.create(this.role, account.id);
    reply.header(
      'Set-Cookie',
      cookieHeader(this.role, session.token, 8 * 60 * 60),
    );
    return {
      id: account.id,
      role: this.role,
      displayName: account.displayName,
    };
  }

  protected me(request: AuthRequest) {
    return {
      id: request.session?.subjectId,
      role: this.role,
      csrfToken: request.session?.csrfToken,
    };
  }

  /** me() enriched with the account display name (for the staff H5 header). */
  protected async meWithDisplayName(request: AuthRequest) {
    const table = this.role === 'ADMIN' ? 'admin_account' : 'staff_account';
    const rows = await this.dataSource.query<{ display_name: string }[]>(
      `SELECT display_name FROM ${table} WHERE id=$1`,
      [request.session?.subjectId],
    );
    return { ...this.me(request), displayName: rows[0]?.display_name ?? '' };
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
  constructor(
    @Inject(AccountsService) accounts: AccountsService,
    @Inject(SessionService) sessions: SessionService,
    @Inject(DataSource) dataSource: DataSource,
  ) {
    super(accounts, sessions, dataSource);
  }

  @Post('login') loginRoute(
    @Body() body: { username?: string; password?: string },
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.login(body, request, reply);
  }

  @Get('me')
  @RequireSession('ADMIN')
  @UseGuards(SessionGuard)
  meRoute(@Req() request: AuthRequest) {
    return this.me(request);
  }

  @Post('logout')
  @RequireSession('ADMIN')
  @UseGuards(SessionGuard, CsrfGuard)
  logoutRoute(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.logout(request, reply);
  }
}

@Controller('staff/auth')
export class StaffAuthController extends RoleAuthController {
  protected readonly role = 'STAFF' as const;
  constructor(
    @Inject(AccountsService) accounts: AccountsService,
    @Inject(SessionService) sessions: SessionService,
    @Inject(DataSource) dataSource: DataSource,
  ) {
    super(accounts, sessions, dataSource);
  }

  @Post('login') loginRoute(
    @Body() body: { username?: string; password?: string },
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.login(body, request, reply);
  }

  @Get('me')
  @RequireSession('STAFF')
  @UseGuards(SessionGuard)
  meRoute(@Req() request: AuthRequest) {
    return this.meWithDisplayName(request);
  }

  @Post('logout')
  @RequireSession('STAFF')
  @UseGuards(SessionGuard, CsrfGuard)
  logoutRoute(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.logout(request, reply);
  }
}

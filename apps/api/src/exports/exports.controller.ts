import { readFile } from 'node:fs/promises';
import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { requestOrigin } from '../common/request-origin.js';
import { ExportsService } from './exports.service.js';
type Request = FastifyRequest & { session: { subjectId: string } };
@Controller('admin')
@RequireSession('ADMIN')
@UseGuards(SessionGuard)
export class ExportsController {
  constructor(
    @Inject(ExportsService) private readonly exports: ExportsService,
  ) {}
  @Post('activities/:id/exports')
  @UseGuards(CsrfGuard)
  create(@Param('id') id: string, @Req() request: Request) {
    return this.exports.create(id, request.session.subjectId);
  }
  @Get('exports/:id') get(@Param('id') id: string, @Req() request: Request) {
    return this.exports.get(
      id,
      request.session.subjectId,
      requestOrigin(request),
    );
  }
  @Get('exports/:id/download')
  async download(
    @Param('id') id: string,
    @Req() request: Request,
    @Res() reply: FastifyReply,
  ) {
    const file = await this.exports.read(id, request.session.subjectId);
    return reply
      .header('Content-Disposition', `attachment; filename="${file.filename}"`)
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .send(await readFile(file.path));
  }
}

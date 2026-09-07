import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';

import { CsrfGuard } from '../auth/csrf.guard.js';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { MediaService } from './media.service.js';

@Controller('admin/media')
@RequireSession('ADMIN')
@UseGuards(SessionGuard)
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Post()
  @UseGuards(CsrfGuard)
  async upload(@Body() body: { fileName: string; contentBase64: string }) {
    const saved = await this.media.save({ bytes: Buffer.from(body.contentBase64, 'base64'), originalName: body.fileName });
    return { id: saved.id, url: `/media/${saved.storageKey}` };
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ExportsService } from './exports.service.js';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class ExportsCleanupService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(ExportsCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(ExportsService) private readonly exportsService: ExportsService,
  ) {}

  async onModuleInit() {
    await this.cleanup();
    this.timer = setInterval(() => void this.cleanup(), CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async cleanup() {
    try {
      const removed = await this.exportsService.cleanupExpired();

      if (removed > 0) this.logger.log(`Removed ${removed} expired exports`);
    } catch (error) {
      this.logger.error('Failed to clean expired exports', error);
    }
  }
}

import {
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { JobsWorker } from './jobs.worker.js';

export const JOB_POLL_INTERVAL_MS = 'JOB_POLL_INTERVAL_MS';

@Injectable()
export class JobsRunner
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(JobsRunner.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(JobsWorker) private readonly worker: JobsWorker,
    @Inject(JOB_POLL_INTERVAL_MS) private readonly intervalMs: number,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
    this.timer.unref();
    void this.poll();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.worker.runDueJobs(new Date());
    } catch (error) {
      this.logger.error('Background job polling failed', error);
    } finally {
      this.running = false;
    }
  }
}

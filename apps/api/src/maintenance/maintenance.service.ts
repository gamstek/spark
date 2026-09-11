import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

export const MAINTENANCE_INTERVAL_MS = 'MAINTENANCE_INTERVAL_MS';

@Injectable()
export class MaintenanceService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MaintenanceService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(MAINTENANCE_INTERVAL_MS) private readonly intervalMs: number,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runSafely();
    this.timer = setInterval(() => void this.runSafely(), this.intervalMs);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    await this.dataSource.query(
      `UPDATE redemption SET status='EXPIRED' WHERE status='WAIT_REDEEM' AND redeem_end_at<=now()`,
    );
    await this.dataSource.query(
      `DELETE FROM app_session WHERE expires_at<=now()`,
    );
    await this.dataSource.query(
      `DELETE FROM oauth_state WHERE expires_at<=now() OR consumed_at IS NOT NULL`,
    );
    await this.dataSource.query(
      `DELETE FROM wechat_activity_entry_token
       WHERE expires_at<=now()
          OR consumed_at<=now()-interval '1 day'`,
    );
    await this.dataSource.query(
      `DELETE FROM wechat_callback_receipt
       WHERE created_at<=now()-interval '10 minutes'`,
    );
  }

  private async runSafely(): Promise<void> {
    try {
      await this.runOnce();
    } catch (error) {
      this.logger.error('Periodic maintenance failed', error);
    }
  }
}

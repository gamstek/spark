import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccountsService } from './auth/accounts.service.js';
import { AdminAuthController, StaffAuthController } from './auth/auth.controller.js';
import { CsrfGuard } from './auth/csrf.guard.js';
import { SessionGuard } from './auth/session.guard.js';
import { SessionService } from './auth/session.service.js';
import { HealthController } from './health/health.controller.js';
import { StaffController } from './staff/staff.controller.js';
import { StaffService } from './staff/staff.service.js';
import { createDataSource } from '../database/data-source.js';

@Module({
  controllers: [HealthController, AdminAuthController, StaffAuthController, StaffController],
  providers: [
    { provide: DataSource, useFactory: async () => {
      const dataSource = createDataSource();
      return dataSource.initialize();
    } },
    AccountsService, SessionService, SessionGuard, CsrfGuard, StaffService,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccountsService } from './auth/accounts.service.js';
import {
  AdminAuthController,
  StaffAuthController,
} from './auth/auth.controller.js';
import { CsrfGuard } from './auth/csrf.guard.js';
import { SessionGuard } from './auth/session.guard.js';
import { SessionService } from './auth/session.service.js';
import { ActivitySessionController } from './auth/activity-session.controller.js';
import {
  ACTIVITY_IDENTITY_MODE,
  readActivityIdentityMode,
} from './auth/activity-identity-mode.js';
import { HealthController } from './health/health.controller.js';
import { StaffController } from './staff/staff.controller.js';
import { StaffService } from './staff/staff.service.js';
import { initializeApplicationDataSource } from '../database/data-source.js';
import { ParticipantsService } from './participants/participants.service.js';
import { OAuthController } from './wechat/oauth.controller.js';
import { OAuthStateService } from './wechat/oauth-state.service.js';
import { SubscriptionService } from './wechat/subscription.service.js';
import { WechatTokenService } from './wechat/token.service.js';
import { WechatGateway } from './wechat/wechat.gateway.js';
import { WechatJsSdkController } from './wechat/js-sdk.controller.js';
import { WechatJsSdkService } from './wechat/js-sdk.service.js';
import { WechatIdentityService } from './wechat/wechat-identity.service.js';
import { WechatActivityEntryService } from './wechat/activity-entry.service.js';
import { ActivityEntryController } from './wechat/activity-entry.controller.js';
import { WechatCallbackController } from './wechat/callback.controller.js';
import { WechatCallbackReplayService } from './wechat/callback-replay.service.js';
import { resolvePublicBaseUrl } from './wechat/entry-configuration.js';
import { ActivitiesController } from './activities/activities.controller.js';
import { ActivitiesService } from './activities/activities.service.js';
import { PublishService } from './activities/publish.service.js';
import { MediaController } from './media/media.controller.js';
import { MediaService } from './media/media.service.js';
import { PrizesController } from './prizes/prizes.controller.js';
import { PrizesService } from './prizes/prizes.service.js';
import { JobHandlers } from './jobs/jobs.handlers.js';
import { JobsController } from './jobs/jobs.controller.js';
import { JobsService } from './jobs/jobs.service.js';
import { DingTalkCallbackController } from './dingtalk/callback.controller.js';
import { DingTalkCallbackService } from './dingtalk/callback.service.js';
import { DingTalkPrefillService } from './dingtalk/prefill.service.js';
import { DingTalkSubmissionHandler } from './dingtalk/submission.handler.js';
import { LotteryController } from './lottery/lottery.controller.js';
import { LotteryService } from './lottery/lottery.service.js';
import { CodeService } from './redemptions/code.service.js';
import { RedemptionsController } from './redemptions/redemptions.controller.js';
import { RedemptionsService } from './redemptions/redemptions.service.js';
import { StaffAdminController } from './staff/staff-admin.controller.js';
import { ParticipantsAdminController } from './participants/participants-admin.controller.js';
import { ReportsController } from './reports/reports.controller.js';
import { ReportsService } from './reports/reports.service.js';
import { ExportsController } from './exports/exports.controller.js';
import { ExportsService } from './exports/exports.service.js';
import { ExportsHandler } from './exports/exports.handler.js';
import { ExportsCleanupService } from './exports/exports-cleanup.service.js';
import { JobsWorker } from './jobs/jobs.worker.js';
import { JOB_POLL_INTERVAL_MS, JobsRunner } from './jobs/jobs.runner.js';
import {
  RuntimeController,
  ActivityInfoController,
} from './runtime/runtime.controller.js';
import { RuntimeService } from './runtime/runtime.service.js';
import {
  MAINTENANCE_INTERVAL_MS,
  MaintenanceService,
} from './maintenance/maintenance.service.js';

@Module({
  controllers: [
    HealthController,
    AdminAuthController,
    StaffAuthController,
    StaffController,
    StaffAdminController,
    ParticipantsAdminController,
    OAuthController,
    WechatCallbackController,
    ActivityEntryController,
    WechatJsSdkController,
    ActivitiesController,
    PrizesController,
    MediaController,
    JobsController,
    DingTalkCallbackController,
    LotteryController,
    RedemptionsController,
    ReportsController,
    ExportsController,
    RuntimeController,
    ActivityInfoController,
    ActivitySessionController,
  ],
  providers: [
    {
      provide: DataSource,
      useFactory: initializeApplicationDataSource,
    },
    { provide: WechatGateway, useFactory: () => new WechatGateway() },
    {
      provide: OAuthStateService,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => new OAuthStateService(dataSource),
    },
    {
      provide: WechatIdentityService,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) =>
        new WechatIdentityService(dataSource),
    },
    AccountsService,
    {
      provide: WechatActivityEntryService,
      inject: [DataSource, WechatIdentityService, SessionService],
      useFactory: (
        dataSource: DataSource,
        identities: WechatIdentityService,
        sessions: SessionService,
      ) =>
        new WechatActivityEntryService(
          dataSource,
          identities,
          sessions,
          resolvePublicBaseUrl(process.env.PUBLIC_BASE_URL),
        ),
    },
    SessionService,
    {
      provide: ACTIVITY_IDENTITY_MODE,
      useFactory: () => readActivityIdentityMode(),
    },
    {
      provide: WechatCallbackReplayService,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) =>
        new WechatCallbackReplayService(dataSource),
    },
    SessionGuard,
    CsrfGuard,
    StaffService,
    ParticipantsService,
    WechatTokenService,
    {
      provide: WechatJsSdkService,
      inject: [WechatTokenService, WechatGateway],
      useFactory: (tokens: WechatTokenService, gateway: WechatGateway) =>
        new WechatJsSdkService(tokens, gateway),
    },
    SubscriptionService,
    {
      provide: ActivitiesService,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => new ActivitiesService(dataSource),
    },
    {
      provide: PublishService,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => new PublishService(dataSource),
    },
    PrizesService,
    MediaService,
    JobsService,
    JobHandlers,
    DingTalkCallbackService,
    DingTalkPrefillService,
    DingTalkSubmissionHandler,
    CodeService,
    {
      provide: LotteryService,
      inject: [DataSource, CodeService],
      useFactory: (dataSource: DataSource, codes: CodeService) =>
        new LotteryService(dataSource, codes),
    },
    {
      provide: RedemptionsService,
      inject: [DataSource, CodeService],
      useFactory: (dataSource: DataSource, codes: CodeService) =>
        new RedemptionsService(dataSource, codes),
    },
    ReportsService,
    {
      provide: ExportsService,
      inject: [DataSource, JobsService],
      useFactory: (dataSource: DataSource, jobs: JobsService) =>
        new ExportsService(dataSource, jobs),
    },
    ExportsCleanupService,
    {
      provide: ExportsHandler,
      inject: [DataSource, JobHandlers],
      useFactory: (dataSource: DataSource, handlers: JobHandlers) =>
        new ExportsHandler(dataSource, handlers),
    },
    {
      provide: RuntimeService,
      inject: [DataSource, ParticipantsService, SubscriptionService],
      useFactory: (
        dataSource: DataSource,
        participants: ParticipantsService,
        subscriptions: SubscriptionService,
      ) => new RuntimeService(dataSource, participants, subscriptions),
    },
    MaintenanceService,
    {
      provide: MAINTENANCE_INTERVAL_MS,
      useFactory: () =>
        Number(process.env.MAINTENANCE_INTERVAL_MS ?? 60 * 60 * 1000),
    },
    JobsWorker,
    JobsRunner,
    {
      provide: JOB_POLL_INTERVAL_MS,
      useFactory: () => Number(process.env.JOB_POLL_INTERVAL_MS ?? 1000),
    },
  ],
})
export class AppModule {}

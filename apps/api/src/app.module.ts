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
import { ParticipantsService } from './participants/participants.service.js';
import { OAuthController } from './wechat/oauth.controller.js';
import { OAuthStateService } from './wechat/oauth-state.service.js';
import { SubscriptionService } from './wechat/subscription.service.js';
import { WechatTokenService } from './wechat/token.service.js';
import { WechatGateway } from './wechat/wechat.gateway.js';
import { WechatIdentityService } from './wechat/wechat-identity.service.js';
import { ActivitiesController } from './activities/activities.controller.js';
import { ActivitiesService } from './activities/activities.service.js';
import { PublishService } from './activities/publish.service.js';
import { MediaController } from './media/media.controller.js';
import { MediaService } from './media/media.service.js';
import { PrizesController } from './prizes/prizes.controller.js';
import { PrizesService } from './prizes/prizes.service.js';

@Module({
  controllers: [HealthController, AdminAuthController, StaffAuthController, StaffController, OAuthController, ActivitiesController, PrizesController, MediaController],
  providers: [
    { provide: DataSource, useFactory: async () => {
      const dataSource = createDataSource();
      return dataSource.initialize();
    } },
    { provide: WechatGateway, useFactory: () => new WechatGateway() },
    { provide: OAuthStateService, inject: [DataSource], useFactory: (dataSource: DataSource) => new OAuthStateService(dataSource) },
    { provide: WechatIdentityService, inject: [DataSource], useFactory: (dataSource: DataSource) => new WechatIdentityService(dataSource) },
    AccountsService, SessionService, SessionGuard, CsrfGuard, StaffService, ParticipantsService,
    WechatTokenService, SubscriptionService,
    { provide: ActivitiesService, inject: [DataSource], useFactory: (dataSource: DataSource) => new ActivitiesService(dataSource) },
    PublishService, PrizesService, MediaService,
  ],
})
export class AppModule {}

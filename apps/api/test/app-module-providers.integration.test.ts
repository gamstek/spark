import 'reflect-metadata';

import {
  type INestApplicationContext,
  Module,
  type Provider,
  type Type,
} from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DataSource } from 'typeorm';
import { describe, expect, it } from 'vitest';
import type { ActivityFormSubmissionInput } from '@spark/contracts';

import { AppModule } from '../src/app.module.js';
import { ACTIVITY_IDENTITY_MODE } from '../src/auth/activity-identity-mode.js';
import { SessionService } from '../src/auth/session.service.js';
import { ActivityFormService } from '../src/activity-form/activity-form.service.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { ExportsHandler } from '../src/exports/exports.handler.js';
import { ExportsService } from '../src/exports/exports.service.js';
import { JobsService } from '../src/jobs/jobs.service.js';
import { JobHandlers } from '../src/jobs/jobs.handlers.js';
import { LotteryService } from '../src/lottery/lottery.service.js';
import { ParticipantsService } from '../src/participants/participants.service.js';
import { CodeService } from '../src/redemptions/code.service.js';
import { RedemptionsService } from '../src/redemptions/redemptions.service.js';
import { RuntimeService } from '../src/runtime/runtime.service.js';
import { SubscriptionService } from '../src/wechat/subscription.service.js';
import { WechatIdentityService } from '../src/wechat/wechat-identity.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario } from './support/fixtures.js';

const validForm: ActivityFormSubmissionInput = {
  name: 'HTTP 用户',
  organization: '星火科技',
  department: '研发部',
  jobTitle: '研究员',
  phone: '13800138000',
  email: 'http@example.com',
  researchAreas: ['life_sciences'],
  instrumentInterests: ['mass_spectrometry'],
  visitPurposes: ['new_products'],
  followUpPreferences: ['product_pdf'],
  contactPreference: 'call_welcome',
  onsiteAvailability: 'available',
  privacyAccepted: true,
};
const { privacyAccepted: _privacyAccepted, ...expectedStoredAnswers } =
  validForm;

const productionParameterTypes = new Map<Type, unknown[]>([
  [ActivityFormService, [DataSource, Function, Function]],
  [
    LotteryService,
    [DataSource, CodeService, ACTIVITY_IDENTITY_MODE, Function, Function],
  ],
  [RedemptionsService, [DataSource, CodeService, Function]],
  [
    RuntimeService,
    [
      DataSource,
      ParticipantsService,
      SubscriptionService,
      ACTIVITY_IDENTITY_MODE,
      Function,
    ],
  ],
  [ExportsService, [DataSource, JobsService, Object, Function]],
  [ExportsHandler, [DataSource, JobHandlers, Object]],
]);

function appProvider(service: Type): Provider {
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    AppModule,
  ) as Provider[];
  const provider = providers.find(
    (candidate) =>
      candidate === service ||
      (typeof candidate === 'object' &&
        candidate !== null &&
        'provide' in candidate &&
        candidate.provide === service),
  );
  if (!provider) throw new Error(`APP_PROVIDER_NOT_FOUND:${service.name}`);
  return provider;
}

describe('production module providers', () => {
  it('boots registered routes without callback entry services and retains OAuth', async () => {
    const originalIdentityMode = process.env.ACTIVITY_IDENTITY_MODE;
    let database: TestDatabase | undefined;
    let app: NestFastifyApplication | undefined;
    try {
      delete process.env.ACTIVITY_IDENTITY_MODE;
      database = await createTestDatabase();
      const dataSource = database.dataSource;
      const providers = Reflect.getMetadata(
        MODULE_METADATA.PROVIDERS,
        AppModule,
      ) as Provider[];
      class ApplicationRoutesModule {}
      Module({
        controllers: Reflect.getMetadata(
          MODULE_METADATA.CONTROLLERS,
          AppModule,
        ) as Type[],
        providers: providers.map((provider) =>
          typeof provider === 'object' &&
          'provide' in provider &&
          provider.provide === DataSource
            ? { provide: DataSource, useValue: dataSource }
            : provider,
        ),
      })(ApplicationRoutesModule);
      app = await NestFactory.create<NestFastifyApplication>(
        ApplicationRoutesModule,
        new FastifyAdapter(),
        { logger: false, abortOnError: false },
      );
      app.setGlobalPrefix('api');
      app.useGlobalFilters(new ApiExceptionFilter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      expect(app.get(ACTIVITY_IDENTITY_MODE)).toBe('anonymous');
      for (const [method, url] of [
        ['GET', '/api/wechat/callback'],
        ['POST', '/api/wechat/callback'],
        ['GET', '/api/activity/entry?t=retired-token'],
      ] as const) {
        const response = await app.inject({ method, url });
        expect(response.statusCode, `${method} ${url}`).toBe(404);
      }
      const scenario = await createScenario(dataSource, {
        now: new Date(Date.now() - 1_000),
      });
      await dataSource.query(
        `UPDATE activity_participation SET lead_completed=false,lead_completed_at=NULL WHERE id=$1`,
        [scenario.participationIds[1]],
      );
      const activityUserId = 'de4c8226-4ebc-4bb8-9bca-1da706a022ac';
      await dataSource.query(`INSERT INTO user_account (id) VALUES ($1)`, [
        activityUserId,
      ]);
      const sessions = app.get(SessionService);
      const activitySession = await sessions.create('ACTIVITY', activityUserId);
      const adminSession = await sessions.create('ADMIN', scenario.adminId);
      const staffSession = await sessions.create('STAFF', scenario.staffId);
      const invalidSessionResponse = await app.inject({
        method: 'POST',
        url: '/api/activity/expo-2026/form-submissions',
        headers: { cookie: 'spark_activity=invalid-session' },
        payload: validForm,
      });
      expect(invalidSessionResponse.statusCode).toBe(401);
      expect(invalidSessionResponse.json()).toMatchObject({
        code: 'UNAUTHORIZED',
      });
      const missingSessionResponse = await app.inject({
        method: 'POST',
        url: '/api/activity/expo-2026/form-submissions',
        payload: validForm,
      });
      expect(missingSessionResponse.statusCode).toBe(401);
      expect(missingSessionResponse.json()).toMatchObject({
        code: 'UNAUTHORIZED',
      });
      for (const session of [adminSession, staffSession]) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/activity/expo-2026/form-submissions',
          headers: { cookie: `spark_activity=${session.token}` },
          payload: validForm,
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
      }
      const missingCsrfResponse = await app.inject({
        method: 'POST',
        url: '/api/activity/expo-2026/form-submissions',
        headers: { cookie: `spark_activity=${activitySession.token}` },
        payload: validForm,
      });
      expect(missingCsrfResponse.statusCode).toBe(403);
      expect(missingCsrfResponse.json()).toMatchObject({
        code: 'CSRF_INVALID',
      });
      const invalidCsrfResponse = await app.inject({
        method: 'POST',
        url: '/api/activity/expo-2026/form-submissions',
        headers: {
          cookie: `spark_activity=${activitySession.token}`,
          'x-csrf-token': 'invalid-token',
        },
        payload: validForm,
      });
      expect(invalidCsrfResponse.statusCode).toBe(403);
      expect(invalidCsrfResponse.json()).toMatchObject({
        code: 'CSRF_INVALID',
      });
      const formResponse = await app.inject({
        method: 'POST',
        url: '/api/activity/expo-2026/form-submissions',
        headers: {
          cookie: `spark_activity=${activitySession.token}`,
          'x-csrf-token': activitySession.csrfToken,
        },
        payload: validForm,
      });
      expect(formResponse.statusCode).toBe(201);
      expect(formResponse.json()).toEqual({ submitted: true });
      expect(
        await dataSource.query(
          `SELECT p.user_id,p.lead_completed,s.answers FROM activity_participation p JOIN activity_form_submission s ON s.participation_id=p.id WHERE p.activity_id=$1 AND p.user_id=$2`,
          [scenario.activityId, activityUserId],
        ),
      ).toEqual([
        {
          user_id: activityUserId,
          lead_completed: true,
          answers: expectedStoredAnswers,
        },
      ]);
      expect(
        await dataSource.query(
          `SELECT lead_completed FROM activity_participation WHERE id=$1`,
          [scenario.participationIds[1]],
        ),
      ).toEqual([{ lead_completed: false }]);
      const providerNames = providers.map((provider) =>
        typeof provider === 'function'
          ? provider.name
          : typeof provider === 'object' &&
              'provide' in provider &&
              typeof provider.provide === 'function'
            ? provider.provide.name
            : '',
      );
      expect(providerNames).not.toContain('WechatActivityEntryService');
      expect(providerNames).not.toContain('WechatCallbackReplayService');
      const response = await app.inject({
        method: 'GET',
        url: '/api/wechat/oauth/start?returnPath=%2Factivity%2Fexpo-2026',
        headers: { host: 'spark.example' },
      });
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain(
        'https://open.weixin.qq.com/connect/oauth2/authorize',
      );
      expect(response.headers['set-cookie']).toContain('spark_oauth_nonce=');
      const identities = app.get(WechatIdentityService);
      const { userId } = await identities.getOrCreateUser(
        'retained-oauth-user',
      );
      await identities.markSubscribed('retained-oauth-user');
      expect(
        await database.dataSource.query(
          `SELECT user_id,subscribed FROM wechat_identity WHERE openid='retained-oauth-user'`,
        ),
      ).toEqual([{ user_id: userId, subscribed: true }]);
    } finally {
      try {
        await app?.close();
      } finally {
        try {
          await database?.close();
        } finally {
          if (originalIdentityMode === undefined)
            delete process.env.ACTIVITY_IDENTITY_MODE;
          else process.env.ACTIVITY_IDENTITY_MODE = originalIdentityMode;
        }
      }
    }
  });

  it('assembles services whose test seams are constructor defaults', async () => {
    const originalParameterTypes = new Map<Type, unknown>();
    for (const [service, parameterTypes] of productionParameterTypes) {
      originalParameterTypes.set(
        service,
        Reflect.getMetadata('design:paramtypes', service),
      );
      // Vitest omits decorator metadata emitted by the production TypeScript build.
      Reflect.defineMetadata('design:paramtypes', parameterTypes, service);
    }

    class ProviderAssemblyModule {}
    Module({
      providers: [
        { provide: DataSource, useValue: {} },
        { provide: CodeService, useValue: new CodeService() },
        { provide: ACTIVITY_IDENTITY_MODE, useValue: 'anonymous' },
        { provide: ParticipantsService, useValue: {} },
        { provide: SubscriptionService, useValue: {} },
        { provide: JobsService, useValue: {} },
        { provide: JobHandlers, useValue: { register() {} } },
        ...[...productionParameterTypes.keys()].map(appProvider),
      ],
    })(ProviderAssemblyModule);

    let context: INestApplicationContext | undefined;
    try {
      context = await NestFactory.createApplicationContext(
        ProviderAssemblyModule,
        { abortOnError: false, logger: false },
      );
      for (const service of productionParameterTypes.keys())
        expect(context.get(service)).toBeInstanceOf(service);
    } finally {
      await context?.close();
      for (const [service, parameterTypes] of originalParameterTypes) {
        if (parameterTypes === undefined)
          Reflect.deleteMetadata('design:paramtypes', service);
        else
          Reflect.defineMetadata('design:paramtypes', parameterTypes, service);
      }
    }
  });
});

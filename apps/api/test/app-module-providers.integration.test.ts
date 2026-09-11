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

import { AppModule } from '../src/app.module.js';
import { ACTIVITY_IDENTITY_MODE } from '../src/auth/activity-identity-mode.js';
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
import { createTestDatabase } from './support/database.js';

const productionParameterTypes = new Map<Type, unknown[]>([
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
    delete process.env.ACTIVITY_IDENTITY_MODE;
    const database = await createTestDatabase();
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
          ? { provide: DataSource, useValue: database.dataSource }
          : provider,
      ),
    })(ApplicationRoutesModule);
    let app: NestFastifyApplication | undefined;
    try {
      app = await NestFactory.create<NestFastifyApplication>(
        ApplicationRoutesModule,
        new FastifyAdapter(),
        { logger: false, abortOnError: false },
      );
      app.setGlobalPrefix('api');
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
      await app?.close();
      await database.close();
      if (originalIdentityMode === undefined)
        delete process.env.ACTIVITY_IDENTITY_MODE;
      else process.env.ACTIVITY_IDENTITY_MODE = originalIdentityMode;
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

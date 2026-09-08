import 'reflect-metadata';

import {
  type INestApplicationContext,
  Module,
  type Provider,
  type Type,
} from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
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

const productionParameterTypes = new Map<Type, Type[]>([
  [LotteryService, [DataSource, CodeService, Function, Function]],
  [RedemptionsService, [DataSource, CodeService, Function]],
  [
    RuntimeService,
    [DataSource, ParticipantsService, SubscriptionService, Function],
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

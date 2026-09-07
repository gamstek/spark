export * from './activities.js';
export * from './auth.js';
export * from './dingtalk.js';
export * from './errors.js';
export * from './exports.js';
export * from './lottery.js';
export * from './participants.js';
export * from './prizes.js';
export * from './redemptions.js';
export * from './staff.js';

import { z } from 'zod';

import { WinViewSchema } from './redemptions.js';

export const RuntimeStepSchema = z.enum([
  'NOT_STARTED',
  'SUBSCRIBE',
  'FORM',
  'WAITING_FORM',
  'LOTTERY',
  'OUT_OF_STOCK',
  'PRIZE',
  'REDEEMED',
  'EXPIRED',
  'ENDED',
]);
export type RuntimeStep = z.infer<typeof RuntimeStepSchema>;

export const ActivityRuntimeSchema = z
  .object({
    activityCode: z.string().min(1).max(64),
    templateId: z.string().min(1).max(64),
    templateVersion: z.int().positive(),
    participationId: z.uuid(),
    nextStep: RuntimeStepSchema,
    win: WinViewSchema.nullable(),
  })
  .strict();
export type ActivityRuntime = z.infer<typeof ActivityRuntimeSchema>;

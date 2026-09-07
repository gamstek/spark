import { LotteryConfigSchema } from '@spark/templates';
import { z } from 'zod';

export { LotteryConfigSchema, type LotteryConfig } from '@spark/templates';

export const ActivityStatusSchema = z.enum([
  'DRAFT',
  'PUBLISHED',
  'STARTED',
  'ENDED',
]);
export const ActivityInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    templateId: z.literal('exhibition-lottery'),
    templateVersion: z.literal(1),
    startsAt: z.iso.datetime({ offset: true }),
    drawEndsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    redeemEndsAt: z.iso.datetime({ offset: true }),
    config: LotteryConfigSchema,
  })
  .strict();
export type ActivityInput = z.infer<typeof ActivityInputSchema>;

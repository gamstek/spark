import { LotteryConfigSchema } from '@spark/templates';
import { z } from 'zod';

export { LotteryConfigSchema, type LotteryConfig } from '@spark/templates';

export const ActivityStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'STARTED', 'ENDED']);
export const ActivityInputSchema = z.object({
  code: z.string().regex(/^[a-z0-9-]{3,64}$/),
  name: z.string().trim().min(1).max(120),
  templateId: z.literal('exhibition-lottery'),
  templateVersion: z.literal(1),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  config: LotteryConfigSchema,
}).strict();
export type ActivityInput = z.infer<typeof ActivityInputSchema>;

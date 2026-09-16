import { z } from 'zod';

export const LotteryConfigSchema = z
  .object({
    requireSubscribe: z.boolean(),
    winningProbability: z.number().finite().min(0).max(100).default(0),
    halfDayPrizeLimits: z
      .record(z.string(), z.number().int().min(0))
      .default({}),
    noPrizeWeight: z.number().finite().min(0).optional(),
    heroAssetId: z.string().trim().min(1).max(128).optional(),
    rulesText: z.string().trim().min(1).max(4_000),
  })
  .strict();

export type LotteryConfig = z.infer<typeof LotteryConfigSchema>;

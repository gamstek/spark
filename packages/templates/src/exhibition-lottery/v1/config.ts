import { z } from 'zod';

export const LotteryConfigSchema = z
  .object({
    requireSubscribe: z.boolean(),
    noPrizeWeight: z.number().finite().min(0),
    heroAssetId: z.string().trim().min(1).max(128),
    rulesText: z.string().trim().min(1).max(4_000),
  })
  .strict();

export type LotteryConfig = z.infer<typeof LotteryConfigSchema>;

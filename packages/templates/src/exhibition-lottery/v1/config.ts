import { z } from 'zod';

const DingTalkFormUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'alidocs.dingtalk.com';
}, 'formUrl must use HTTPS on alidocs.dingtalk.com');

export const LotteryConfigSchema = z
  .object({
    formId: z.string().trim().min(1).max(128),
    formUrl: DingTalkFormUrlSchema,
    prefillField: z.string().trim().min(1).max(64),
    fieldMapping: z
      .object({
        participationId: z.string().trim().min(1).max(128),
        name: z.string().trim().min(1).max(128),
        phone: z.string().trim().min(1).max(128),
      })
      .strict(),
    requireSubscribe: z.boolean(),
    noPrizeWeight: z.number().finite().min(0),
    heroAssetId: z.string().trim().min(1).max(128),
    rulesText: z.string().trim().min(1).max(4_000),
  })
  .strict();

export type LotteryConfig = z.infer<typeof LotteryConfigSchema>;

import { z } from 'zod';

export const RedemptionStatusSchema = z.enum([
  'WAIT_REDEEM',
  'REDEEMED',
  'EXPIRED',
]);
export type RedemptionStatus = z.infer<typeof RedemptionStatusSchema>;
export const WinViewSchema = z
  .object({
    id: z.uuid(),
    prizeLevel: z.string().trim().min(1).max(40),
    prizeName: z.string().trim().min(1).max(120),
    prizeImageUrl: z.url().nullable(),
    redeemEndAt: z.iso.datetime(),
    redemptionStatus: RedemptionStatusSchema,
  })
  .strict();
export type WinView = z.infer<typeof WinViewSchema>;

export const RedeemInputSchema = z
  .object({ code: z.string().trim().min(6).max(128) })
  .strict();
export type RedeemInput = z.infer<typeof RedeemInputSchema>;

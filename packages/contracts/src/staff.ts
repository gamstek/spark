import { z } from 'zod';

import { RedemptionStatusSchema } from './redemptions.js';

export const StaffAccountInputSchema = z
  .object({
    username: z.string().trim().min(3).max(100),
    displayName: z.string().trim().min(1).max(100),
    activityIds: z.array(z.uuid()).max(100),
  })
  .strict();
export type StaffAccountInput = z.infer<typeof StaffAccountInputSchema>;

/** Staff-facing prize stock view (read-only; stock is managed by admins). */
export const StaffPrizeViewSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(120),
    totalStock: z.int().nonnegative(),
    awardedStock: z.int().nonnegative(),
  })
  .strict();
export type StaffPrizeView = z.infer<typeof StaffPrizeViewSchema>;

/** Redemption record shown in the staff to-do / history list. */
export const StaffRecordViewSchema = z
  .object({
    id: z.uuid(),
    activityId: z.uuid(),
    activityCode: z.string().min(1).max(64),
    activityName: z.string().trim().min(1).max(120),
    /** Masked participant name (e.g. 陈*明) or 匿名 when no lead was captured. */
    name: z.string(),
    /** Masked phone (e.g. 138****2210) or empty when no lead was captured. */
    phone: z.string(),
    prizeName: z.string().trim().min(1).max(120),
    prizeImageUrl: z.string().nullable(),
    status: RedemptionStatusSchema,
    wonAt: z.iso.datetime(),
    redeemedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type StaffRecordView = z.infer<typeof StaffRecordViewSchema>;


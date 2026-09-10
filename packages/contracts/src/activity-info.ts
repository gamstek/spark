import { z } from 'zod';

export const ActivityPrizeViewSchema = z
  .object({
    prizeLevel: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(120),
    imageUrl: z.string().nullable(),
  })
  .strict();
export type ActivityPrizeView = z.infer<typeof ActivityPrizeViewSchema>;

/** Read-only display data for the participant H5 (home / info / lottery pages). */
export const ActivityInfoSchema = z
  .object({
    code: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(120),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    drawEndsAt: z.iso.datetime(),
    rulesText: z.string().trim().min(1).max(4_000),
    noPrizeWeight: z.number().min(0),
    prizes: z.array(ActivityPrizeViewSchema).max(64),
  })
  .strict();
export type ActivityInfo = z.infer<typeof ActivityInfoSchema>;

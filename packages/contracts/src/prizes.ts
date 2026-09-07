import { z } from 'zod';

export const PrizeInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    imageAssetId: z.string().trim().min(1).max(128).nullable(),
    stock: z.int().min(0),
    weight: z.number().positive(),
  })
  .strict();
export type PrizeInput = z.infer<typeof PrizeInputSchema>;

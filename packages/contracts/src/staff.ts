import { z } from 'zod';

export const StaffAccountInputSchema = z.object({
  username: z.string().trim().min(3).max(100), displayName: z.string().trim().min(1).max(100), activityIds: z.array(z.uuid()).max(100),
}).strict();
export type StaffAccountInput = z.infer<typeof StaffAccountInputSchema>;

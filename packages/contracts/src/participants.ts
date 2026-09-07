import { z } from 'zod';

export const ParticipantViewSchema = z.object({
  id: z.uuid(), activityCode: z.string().min(1), leadCompleted: z.boolean(), createdAt: z.iso.datetime(),
}).strict();
export type ParticipantView = z.infer<typeof ParticipantViewSchema>;

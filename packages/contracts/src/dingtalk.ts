import { z } from 'zod';

export const CallbackInputSchema = z.object({
  formId: z.string().trim().min(1).max(128),
  recordId: z.string().trim().min(1).max(256),
  participationId: z.uuid(),
  fields: z.object({
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(1).max(32),
  }).catchall(z.unknown()),
}).strict();
export type CallbackInput = z.infer<typeof CallbackInputSchema>;

export const CallbackAckSchema = z.object({ accepted: z.literal(true) }).strict();
export type CallbackAck = z.infer<typeof CallbackAckSchema>;

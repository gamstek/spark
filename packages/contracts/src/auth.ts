import { z } from 'zod';

export const SessionRoleSchema = z.enum(['ACTIVITY', 'STAFF', 'ADMIN']);
export type SessionRole = z.infer<typeof SessionRoleSchema>;

export const SessionViewSchema = z.object({
  id: z.uuid(),
  role: SessionRoleSchema,
}).strict();
export type SessionView = z.infer<typeof SessionViewSchema>;

export const LoginInputSchema = z.object({ username: z.string().trim().min(1).max(100), password: z.string().min(8).max(200) }).strict();
export type LoginInput = z.infer<typeof LoginInputSchema>;

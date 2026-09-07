import { z } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  'OUT_OF_STOCK', 'ACTIVITY_ENDED', 'NOT_QUALIFIED', 'UNAUTHORIZED', 'FORBIDDEN',
  'RECORD_CONFLICT', 'REDEMPTION_EXPIRED', 'VERSION_CONFLICT', 'UNSUPPORTED_TEMPLATE',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({ code: ApiErrorCodeSchema, message: z.string().min(1).max(500), requestId: z.string().min(1).max(128) }).strict();
export type ApiError = z.infer<typeof ApiErrorSchema>;

import { z } from 'zod';

export const ExportStatusSchema = z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']);
export const ExportViewSchema = z.object({
  id: z.uuid(), status: ExportStatusSchema, downloadUrl: z.url().nullable(), createdAt: z.iso.datetime(),
}).strict();
export type ExportView = z.infer<typeof ExportViewSchema>;

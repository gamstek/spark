import type { z } from 'zod';

export interface TemplateDefinition<TSchema extends z.ZodType> {
  readonly id: string;
  readonly version: number;
  readonly configSchema: TSchema;
  readonly defaultConfig: z.infer<TSchema>;
}

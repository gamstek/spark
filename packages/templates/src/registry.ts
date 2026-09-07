import type { z } from 'zod';

import type { TemplateDefinition } from './definition.js';
import { exhibitionLotteryV1 } from './exhibition-lottery/v1/definition.js';

type RegisteredTemplate = TemplateDefinition<z.ZodType>;

const definitions: RegisteredTemplate[] = [exhibitionLotteryV1];
const registry = new Map(definitions.map((template) => [`${template.id}@${template.version}`, template]));

export function getTemplate(id: string, version: number): RegisteredTemplate {
  const template = registry.get(`${id}@${version}`);
  if (!template) throw new Error('UNSUPPORTED_TEMPLATE');
  return template;
}

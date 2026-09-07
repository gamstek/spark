import type { TemplateDefinition } from '../../definition.js';
import { LotteryConfigSchema } from './config.js';
import { lotteryDefaultConfig } from './defaults.js';

export const exhibitionLotteryV1 = {
  id: 'exhibition-lottery',
  version: 1,
  configSchema: LotteryConfigSchema,
  defaultConfig: lotteryDefaultConfig,
} satisfies TemplateDefinition<typeof LotteryConfigSchema>;

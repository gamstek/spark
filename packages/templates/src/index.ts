export type { TemplateDefinition } from './definition.js';
export {
  LotteryConfigSchema,
  type LotteryConfig,
} from './exhibition-lottery/v1/config.js';
export { lotteryDefaultConfig } from './exhibition-lottery/v1/defaults.js';
export { exhibitionLotteryV1 } from './exhibition-lottery/v1/definition.js';
export {
  activityFormDefinition,
  activityFormOptionLabels,
  contactPreferenceValues,
  followUpPreferenceValues,
  formatActivityFormAnswers,
  instrumentInterestValues,
  onsiteAvailabilityValues,
  researchAreaValues,
  visitPurposeValues,
  type ActivityFormAnswerValues,
} from './exhibition-lottery/v1/form-definition.js';
export { getTemplate } from './registry.js';

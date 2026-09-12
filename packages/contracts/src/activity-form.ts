import {
  contactPreferenceValues,
  followUpPreferenceValues,
  instrumentInterestValues,
  onsiteAvailabilityValues,
  researchAreaValues,
  visitPurposeValues,
} from '@spark/templates';
import { z } from 'zod';

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
} from '@spark/templates';

export const ResearchAreaSchema = z.enum(researchAreaValues);
export const InstrumentInterestSchema = z.enum(instrumentInterestValues);
export const VisitPurposeSchema = z.enum(visitPurposeValues);
export const FollowUpPreferenceSchema = z.enum(followUpPreferenceValues);
export const ContactPreferenceSchema = z.enum(contactPreferenceValues);
export const OnsiteAvailabilitySchema = z.enum(onsiteAvailabilityValues);

const nonEmptyUniqueArray = <T extends string>(itemSchema: z.ZodType<T>) =>
  z
    .array(itemSchema)
    .min(1)
    .refine((values) => new Set(values).size === values.length, '选项不能重复');

const validateConditionalAnswers = (
  answers: {
    researchAreas: readonly (typeof researchAreaValues)[number][];
    researchAreaOther?: string;
    instrumentInterests: readonly (typeof instrumentInterestValues)[number][];
    instrumentInterestOther?: string;
  },
  context: z.RefinementCtx,
) => {
  const hasOtherResearchArea = answers.researchAreas.includes('other');
  const hasResearchAreaExplanation = Boolean(answers.researchAreaOther);

  if (hasOtherResearchArea && !hasResearchAreaExplanation) {
    context.addIssue({
      code: 'custom',
      message: '请选择“其他”时请填写研究方向说明',
      path: ['researchAreaOther'],
    });
  }

  if (!hasOtherResearchArea && hasResearchAreaExplanation) {
    context.addIssue({
      code: 'custom',
      message: '仅在选择“其他”时填写研究方向说明',
      path: ['researchAreaOther'],
    });
  }

  const hasOtherInstrumentInterest =
    answers.instrumentInterests.includes('other');
  const hasInstrumentInterestExplanation = Boolean(
    answers.instrumentInterestOther,
  );

  if (hasOtherInstrumentInterest && !hasInstrumentInterestExplanation) {
    context.addIssue({
      code: 'custom',
      message: '请选择“其他”时请填写仪器类型说明',
      path: ['instrumentInterestOther'],
    });
  }

  if (!hasOtherInstrumentInterest && hasInstrumentInterestExplanation) {
    context.addIssue({
      code: 'custom',
      message: '仅在选择“其他”时填写仪器类型说明',
      path: ['instrumentInterestOther'],
    });
  }
};

export const ActivityFormSubmissionSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    organization: z.string().trim().min(1).max(200),
    department: z.string().trim().min(1).max(200),
    jobTitle: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(1).max(64),
    email: z.string().trim().min(1).max(254),
    researchAreas: nonEmptyUniqueArray(ResearchAreaSchema),
    researchAreaOther: z.string().trim().max(500).optional(),
    instrumentInterests: nonEmptyUniqueArray(InstrumentInterestSchema),
    instrumentInterestOther: z.string().trim().max(500).optional(),
    visitPurposes: nonEmptyUniqueArray(VisitPurposeSchema),
    followUpPreferences: nonEmptyUniqueArray(FollowUpPreferenceSchema),
    contactPreference: ContactPreferenceSchema,
    onsiteAvailability: OnsiteAvailabilitySchema,
    otherNeeds: z.string().trim().max(2_000).optional(),
    privacyAccepted: z
      .boolean()
      .refine((accepted) => accepted, '请阅读并同意用户活动隐私协议')
      .transform(() => true as const),
  })
  .strict()
  .superRefine(validateConditionalAnswers);

export type ActivityFormSubmissionDraft = z.input<
  typeof ActivityFormSubmissionSchema
>;

export type ActivityFormSubmissionInput = z.output<
  typeof ActivityFormSubmissionSchema
>;

export type ActivityFormAnswers = Omit<
  ActivityFormSubmissionInput,
  'privacyAccepted'
>;

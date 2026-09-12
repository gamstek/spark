import {
  activityFormDefinition,
  formatActivityFormAnswers,
  type ActivityFormAnswers,
} from '@spark/contracts';

const spreadsheetFormulaPrefix = /^[=+\-@]/;

export const spreadsheetText = (value: string | null | undefined): string => {
  const text = value ?? '';
  return spreadsheetFormulaPrefix.test(text) ? `'${text}` : text;
};

export const activityFormExportColumns = [
  { header: activityFormDefinition[0].label, key: 'name', width: 20 },
  { header: activityFormDefinition[1].label, key: 'organization', width: 30 },
  { header: activityFormDefinition[2].label, key: 'department', width: 28 },
  { header: activityFormDefinition[3].label, key: 'jobTitle', width: 20 },
  { header: activityFormDefinition[4].label, key: 'phone', width: 20 },
  { header: activityFormDefinition[5].label, key: 'email', width: 30 },
  { header: activityFormDefinition[6].label, key: 'researchAreas', width: 42 },
  {
    header: `${activityFormDefinition[6].label}（其他说明）`,
    key: 'researchAreaOther',
    width: 30,
  },
  {
    header: activityFormDefinition[7].label,
    key: 'instrumentInterests',
    width: 54,
  },
  {
    header: `${activityFormDefinition[7].label}（其他说明）`,
    key: 'instrumentInterestOther',
    width: 30,
  },
  { header: activityFormDefinition[8].label, key: 'visitPurposes', width: 38 },
  {
    header: activityFormDefinition[9].label,
    key: 'followUpPreferences',
    width: 42,
  },
  {
    header: activityFormDefinition[10].label,
    key: 'contactPreference',
    width: 36,
  },
  {
    header: activityFormDefinition[11].label,
    key: 'onsiteAvailability',
    width: 42,
  },
  { header: activityFormDefinition[12].label, key: 'otherNeeds', width: 34 },
] as const;

export type ActivityFormExportRow = {
  name: string;
  organization: string;
  department: string;
  jobTitle: string;
  phone: string;
  email: string;
  researchAreas: string;
  researchAreaOther: string;
  instrumentInterests: string;
  instrumentInterestOther: string;
  visitPurposes: string;
  followUpPreferences: string;
  contactPreference: string;
  onsiteAvailability: string;
  otherNeeds: string;
};

export const toActivityFormExportRow = (
  answers: ActivityFormAnswers,
): ActivityFormExportRow => {
  const formatted = formatActivityFormAnswers({
    ...answers,
    researchAreaOther: undefined,
    instrumentInterestOther: undefined,
  });

  return {
    name: spreadsheetText(formatted[0]!.value),
    organization: spreadsheetText(formatted[1]!.value),
    department: spreadsheetText(formatted[2]!.value),
    jobTitle: spreadsheetText(formatted[3]!.value),
    phone: spreadsheetText(formatted[4]!.value),
    email: spreadsheetText(formatted[5]!.value),
    researchAreas: spreadsheetText(formatted[6]!.value),
    researchAreaOther: spreadsheetText(answers.researchAreaOther),
    instrumentInterests: spreadsheetText(formatted[7]!.value),
    instrumentInterestOther: spreadsheetText(answers.instrumentInterestOther),
    visitPurposes: spreadsheetText(formatted[8]!.value),
    followUpPreferences: spreadsheetText(formatted[9]!.value),
    contactPreference: spreadsheetText(formatted[10]!.value),
    onsiteAvailability: spreadsheetText(formatted[11]!.value),
    otherNeeds: spreadsheetText(answers.otherNeeds),
  };
};

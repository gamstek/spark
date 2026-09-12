import source from '../../../../docs/用户活动隐私协议.md?raw';

export const privacyAgreementSource = source;

export function preparePrivacyAgreement(
  markdown: string,
  activityName: string,
): string {
  const token = '{{activityName}}';
  if (!markdown.includes(token)) {
    throw new Error(`Privacy agreement is missing ${token}`);
  }
  return markdown.replaceAll(token, () => activityName);
}

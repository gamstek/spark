import source from '../../../../docs/用户活动隐私协议.md?raw';

const activityNameToken = '{{activityName}}';

// Validate the source while leaving its placeholder for the post-parse binding.
export const privacyAgreementSource = preparePrivacyAgreement(
  source,
  activityNameToken,
);

export function preparePrivacyAgreement(
  markdown: string,
  activityName: string,
): string {
  if (!markdown.includes(activityNameToken)) {
    throw new Error(`Privacy agreement is missing ${activityNameToken}`);
  }
  return markdown.replaceAll(activityNameToken, () => activityName);
}

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
};

export function privacyAgreementNamePlugin({
  activityName,
}: {
  activityName: string;
}) {
  // Run after Markdown/GFM parsing (including autolink transforms). Only text
  // values change; activity names are never parsed into document nodes.
  return function bindName(node: MarkdownNode): void {
    if (node.type === 'text' && node.value?.includes(activityNameToken)) {
      node.value = preparePrivacyAgreement(node.value, activityName);
    }
    node.children?.forEach(bindName);
  };
}

import {
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
} from '@radix-ui/react-icons';
import { Callout } from '@radix-ui/themes';

type FeedbackCalloutProps = {
  message: string;
  tone?: 'success' | 'error' | 'warning' | 'info';
};

const presentation = {
  success: { color: 'jade', icon: CheckCircledIcon },
  error: { color: 'tomato', icon: CrossCircledIcon },
  warning: { color: 'amber', icon: ExclamationTriangleIcon },
  info: { color: 'blue', icon: InfoCircledIcon },
} as const;

export function FeedbackCallout({
  message,
  tone = 'info',
}: FeedbackCalloutProps) {
  const { color, icon: Icon } = presentation[tone];

  return (
    <Callout.Root color={color}>
      <Callout.Icon>
        <Icon />
      </Callout.Icon>
      <Callout.Text>{message}</Callout.Text>
    </Callout.Root>
  );
}

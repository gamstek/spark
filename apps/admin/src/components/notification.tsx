import { Cross2Icon } from '@radix-ui/react-icons';
import { IconButton } from '@radix-ui/themes';
import { Children, type ReactNode, useEffect } from 'react';

import { FeedbackCallout } from './feedback-callout';

type NotificationProps = {
  message: string;
  tone?: 'success' | 'error' | 'warning' | 'info';
  onDismiss: () => void;
};

export function Notification({
  message,
  tone = 'info',
  onDismiss,
}: NotificationProps) {
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      className="notification-card"
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <FeedbackCallout
        tone={tone}
        message={message}
      />
      <IconButton
        className="notification-close"
        type="button"
        size="1"
        variant="ghost"
        color="gray"
        aria-label="关闭通知"
        onClick={onDismiss}
      >
        <Cross2Icon />
      </IconButton>
    </div>
  );
}

export function NotificationViewport({ children }: { children: ReactNode }) {
  if (!Children.toArray(children).some(Boolean)) return null;
  return <div className="notification-viewport">{children}</div>;
}

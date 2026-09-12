import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  preparePrivacyAgreement,
  privacyAgreementSource,
} from '../lib/privacy-agreement';

type ContentDialogProps = {
  title: string;
  trigger: ReactElement;
  children: ReactNode;
};

export function ContentDialog({
  title,
  trigger,
  children,
}: ContentDialogProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog.Root>
      <Dialog.Trigger
        asChild
        className="content-dialog-trigger"
        type="button"
      >
        {trigger}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="content-dialog-backdrop" />
        <Dialog.Content
          className="content-dialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            bodyRef.current?.focus();
          }}
        >
          <header className="content-dialog-header">
            <Dialog.Title className="content-dialog-title">
              {title}
            </Dialog.Title>
            <Dialog.Close
              className="content-dialog-close"
              type="button"
              aria-label={`关闭${title}`}
            >
              <span aria-hidden="true">×</span>
            </Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">
            内容可上下滚动，按 Escape 或关闭按钮返回。
          </Dialog.Description>
          <div
            ref={bodyRef}
            tabIndex={0}
            role="region"
            aria-label={`${title}正文`}
            className="content-dialog-body overflow-y-auto"
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PrivacyAgreementContent({
  activityName,
}: {
  activityName: string;
}) {
  return (
    <article className="activity-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {preparePrivacyAgreement(privacyAgreementSource, activityName)}
      </ReactMarkdown>
    </article>
  );
}

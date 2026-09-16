import { ExternalLinkIcon } from '@radix-ui/react-icons';
import type { JSX } from 'react';

export function ActivityPublicLink({ code }: { code: string }): JSX.Element {
  const href = `/activity/${encodeURIComponent(code)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="activity-public-link"
      title={`/activity/${code}`}
    >
      <span className="activity-path">/activity/{code}</span>
      <ExternalLinkIcon aria-hidden="true" />
    </a>
  );
}

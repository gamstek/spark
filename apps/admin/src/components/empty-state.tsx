import { ArchiveIcon } from '@radix-ui/react-icons';
import { Flex, Heading, Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Flex
      className="empty-state"
      direction="column"
      align="center"
    >
      <span className="empty-state__icon">
        <ArchiveIcon
          width="22"
          height="22"
          aria-hidden="true"
        />
      </span>
      <Heading
        as="h2"
        size="4"
        mt="4"
      >
        {title}
      </Heading>
      <Text
        as="p"
        size="2"
        color="gray"
        mt="2"
      >
        {description}
      </Text>
      {action && <div className="empty-state__action">{action}</div>}
    </Flex>
  );
}

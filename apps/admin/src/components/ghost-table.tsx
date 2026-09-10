import { Flex, Table, Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';

type GhostTableProps = {
  children: ReactNode;
  className?: string;
};

type GhostTableFooterProps = {
  range: ReactNode;
  children?: ReactNode;
};

export function GhostTable({ children, className }: GhostTableProps) {
  return (
    <Table.Root
      className={['ghost-table', className].filter(Boolean).join(' ')}
      variant="ghost"
    >
      {children}
    </Table.Root>
  );
}

export function GhostTableFooter({ range, children }: GhostTableFooterProps) {
  return (
    <Flex
      className="ghost-table-footer"
      align="center"
      justify="between"
      gap="3"
      wrap="wrap"
    >
      <Text
        as="span"
        className="ghost-table-footer__range"
        role="status"
        size="1"
      >
        {range}
      </Text>
      {children && (
        <Flex className="ghost-table-footer__actions">{children}</Flex>
      )}
    </Flex>
  );
}

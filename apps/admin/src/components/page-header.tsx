import { Box, Flex, Heading, Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Flex
      className="page-header"
      align="start"
      justify="between"
      gap="5"
    >
      <Box className="page-header__copy">
        <Heading
          as="h1"
          size="6"
        >
          {title}
        </Heading>
        {description && (
          <Text
            as="p"
            size="2"
            color="gray"
            mt="2"
          >
            {description}
          </Text>
        )}
      </Box>
      {actions && <Flex className="page-header__actions">{actions}</Flex>}
    </Flex>
  );
}

import { Flex, Skeleton, Text } from '@radix-ui/themes';

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = '正在加载' }: LoadingStateProps) {
  return (
    <Flex
      className="loading-state"
      direction="column"
      gap="3"
      role="status"
      aria-live="polite"
    >
      <Text
        size="2"
        color="gray"
      >
        {label}
      </Text>
      <Skeleton height="18px" />
      <Skeleton
        height="18px"
        width="78%"
      />
      <Skeleton
        height="18px"
        width="54%"
      />
    </Flex>
  );
}

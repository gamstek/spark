import { Button, Dialog, Flex } from '@radix-ui/themes';
import {
  formatActivityFormAnswers,
  type ActivityFormAnswers,
} from '@spark/contracts';
import { useRef, type ComponentProps } from 'react';
import { EmptyState } from '../../components/empty-state';

type ParticipantDetailDialogProps = {
  open: boolean;
  answers: ActivityFormAnswers | null;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<typeof Dialog.Content>['onCloseAutoFocus'];
};

export function ParticipantDetailDialog({
  open,
  answers,
  onOpenChange,
  onCloseAutoFocus,
}: ParticipantDetailDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
    >
      <Dialog.Content
        className="participant-detail-dialog"
        maxWidth="680px"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          closeRef.current?.focus();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <Dialog.Title>登记详情</Dialog.Title>
        <Dialog.Description
          size="2"
          mb="4"
        >
          查看参与者提交的完整登记信息。
        </Dialog.Description>
        <div
          className="participant-detail-answers"
          tabIndex={0}
          role="region"
          aria-label="完整登记答案"
        >
          {answers ? (
            <dl>
              {formatActivityFormAnswers(answers).map(
                ({ number, label, value }) => (
                  <div key={number}>
                    <dt>{`${number} ${label}`}</dt>
                    <dd>{value}</dd>
                  </div>
                ),
              )}
            </dl>
          ) : (
            <EmptyState
              title="暂无登记详情"
              description="这位参与者尚未提交登记信息。"
            />
          )}
        </div>
        <Flex
          justify="end"
          mt="4"
        >
          <Dialog.Close>
            <Button
              ref={closeRef}
              type="button"
              variant="soft"
              color="gray"
            >
              关闭
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

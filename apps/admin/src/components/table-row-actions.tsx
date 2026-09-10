import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';

type TableRowActionsProps = {
  label: string;
  children: ReactNode;
  loading?: boolean;
  onOpen?: (trigger: HTMLButtonElement) => void;
  onCloseAutoFocus?: ComponentProps<
    typeof DropdownMenu.Content
  >['onCloseAutoFocus'];
};

export function TableRowActions({
  label,
  children,
  loading,
  onOpen,
  onCloseAutoFocus,
}: TableRowActionsProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreAfterLoading = useRef(false);

  useEffect(() => {
    if (!loading && restoreAfterLoading.current) {
      restoreAfterLoading.current = false;
      // Do not steal focus if the operator moved elsewhere while waiting.
      if (document.activeElement === document.body) triggerRef.current?.focus();
    }
  }, [loading]);

  return (
    <DropdownMenu.Root
      onOpenChange={(open) => {
        if (open && triggerRef.current) onOpen?.(triggerRef.current);
      }}
    >
      <DropdownMenu.Trigger disabled={loading}>
        <IconButton
          variant="ghost"
          color="gray"
          size="1"
          aria-label={label}
          ref={triggerRef}
          loading={loading}
          disabled={loading}
        >
          <DotsHorizontalIcon aria-hidden="true" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        size="1"
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (!event.defaultPrevented && loading) {
            event.preventDefault();
            restoreAfterLoading.current = true;
          }
        }}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

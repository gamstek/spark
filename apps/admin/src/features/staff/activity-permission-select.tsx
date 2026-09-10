import { Button, DropdownMenu } from '@radix-ui/themes';
import { ChevronDownIcon } from '@radix-ui/react-icons';

export type ActivityOption = {
  id: string;
  name: string;
};

export function activitySelectionLabel(
  selectedIds: string[],
  activities: ActivityOption[],
): string {
  const names = selectedIds
    .map((id) => activities.find((activity) => activity.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join('、') : '请选择可操作活动';
}

export function ActivityPermissionSelect({
  activities,
  selectedIds,
  onChange,
}: {
  activities: ActivityOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (activityId: string, checked: boolean) => {
    onChange(
      checked
        ? [...new Set([...selectedIds, activityId])]
        : selectedIds.filter((id) => id !== activityId),
    );
  };

  return (
    <>
      {selectedIds.map((activityId) => (
        <input
          key={activityId}
          type="hidden"
          name="activityIds"
          value={activityId}
        />
      ))}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Button
            type="button"
            variant="soft"
            color="gray"
            size="2"
            aria-label="可操作活动"
            className="activity-permission-select"
            disabled={activities.length === 0}
          >
            <span>{activitySelectionLabel(selectedIds, activities)}</span>
            <ChevronDownIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          align="start"
          className="activity-permission-menu"
        >
          {activities.map((activity) => (
            <DropdownMenu.CheckboxItem
              key={activity.id}
              checked={selectedIds.includes(activity.id)}
              onCheckedChange={(checked) =>
                toggle(activity.id, checked === true)
              }
              onSelect={(event) => event.preventDefault()}
            >
              {activity.name}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </>
  );
}

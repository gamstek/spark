import { SelectSheet } from '../components/select-sheet';
import { useStaff } from '../lib/runtime';

interface SelectActivityProps {
  open: boolean;
  onClose: () => void;
}

/** 底部弹出选择当前活动。 */
export function SelectActivity({ open, onClose }: SelectActivityProps) {
  const { activities, currentActivityId, pickActivity } = useStaff();
  if (!open) return null;
  return (
    <SelectSheet
      title="选择活动："
      options={activities.map((a) => ({ value: a.id, label: a.name }))}
      value={currentActivityId}
      onChange={pickActivity}
      onConfirm={onClose}
      onClose={onClose}
    />
  );
}

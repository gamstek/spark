import { CalendarIcon } from '@radix-ui/react-icons';
import { Button, Flex, Popover, Select, Text } from '@radix-ui/themes';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

type DateTimePickerProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
};

function parseValue(value?: string) {
  if (!value) return { date: undefined, hour: '09', minute: '00' };
  const [datePart, timePart = '09:00'] = value.split('T');
  const [year, month, day] = datePart!.split('-').map(Number);
  const [hour = '09', minute = '00'] = timePart.split(':');
  return {
    date: new Date(year!, month! - 1, day!),
    hour: hour.padStart(2, '0'),
    minute: minute.padStart(2, '0'),
  };
}

function serialize(date: Date | undefined, hour: string, minute: string) {
  return date ? `${format(date, 'yyyy-MM-dd')}T${hour}:${minute}` : '';
}

const hours = Array.from({ length: 24 }, (_, value) =>
  String(value).padStart(2, '0'),
);
const minutes = Array.from({ length: 60 }, (_, value) =>
  String(value).padStart(2, '0'),
);

export function DateTimePicker({
  id,
  name,
  label,
  defaultValue,
  disabled,
  required,
}: DateTimePickerProps) {
  const initial = parseValue(defaultValue);
  const [date, setDate] = useState<Date | undefined>(initial.date);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const value = serialize(date, hour, minute);
  const displayValue = date
    ? `${format(date, 'yyyy年M月d日', { locale: zhCN })} ${hour}:${minute}`
    : '选择日期和时间';

  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button
          id={id}
          type="button"
          variant="soft"
          color="gray"
          className="date-time-trigger"
          disabled={disabled}
          aria-label={`${label}：${displayValue}`}
        >
          <CalendarIcon aria-hidden="true" />
          {displayValue}
        </Button>
      </Popover.Trigger>
      <Popover.Content
        className="date-time-popover"
        align="start"
      >
        <DayPicker
          mode="single"
          locale={zhCN}
          selected={date}
          onSelect={setDate}
          weekStartsOn={1}
          required
        />
        <Flex
          className="date-time-controls"
          align="center"
          gap="2"
        >
          <Text size="2">时间</Text>
          <Select.Root
            value={hour}
            onValueChange={setHour}
          >
            <Select.Trigger aria-label="小时" />
            <Select.Content>
              {hours.map((item) => (
                <Select.Item
                  key={item}
                  value={item}
                >
                  {item} 时
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          <Text aria-hidden="true">:</Text>
          <Select.Root
            value={minute}
            onValueChange={setMinute}
          >
            <Select.Trigger aria-label="分钟" />
            <Select.Content>
              {minutes.map((item) => (
                <Select.Item
                  key={item}
                  value={item}
                >
                  {item} 分
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
      </Popover.Content>
      <input
        type="hidden"
        name={name}
        value={value}
        required={required}
      />
    </Popover.Root>
  );
}

import { Checkbox, RadioGroup } from '@radix-ui/themes';
import type { ReactNode, Ref } from 'react';

type ChoiceFieldProps = {
  id: string;
  number: string;
  label: string;
  required?: boolean;
  options: Record<string, string>;
  error?: string;
  disabled?: boolean;
  onBlur?: () => void;
  controlRef?: Ref<HTMLButtonElement>;
  children?: ReactNode;
} & (
  | {
      multiple: true;
      value: readonly unknown[];
      onChange: (value: unknown[]) => void;
    }
  | {
      multiple?: false;
      value: string | undefined;
      onChange: (value: string) => void;
    }
);

export function ChoiceField(props: ChoiceFieldProps) {
  const {
    id,
    number,
    label,
    required,
    options,
    error,
    disabled,
    onBlur,
    controlRef,
    children,
  } = props;
  const describedBy = `${id}-error`;
  return (
    <fieldset
      id={id}
      className="registration-question registration-choices"
      disabled={disabled}
      aria-describedby={describedBy}
      aria-invalid={Boolean(error)}
    >
      <legend
        className="registration-label"
        id={`${id}-label`}
      >
        <span className="registration-number">{number}</span>
        {label}
        {required && (
          <span
            className="registration-required"
            aria-label="必填"
          >
            *
          </span>
        )}
      </legend>
      <div className="registration-control">
        {props.multiple ? (
          <div className="registration-options">
            {Object.entries(options).map(([value, optionLabel], index) => (
              <label
                key={value}
                className="registration-option"
                data-disabled={disabled || undefined}
              >
                <Checkbox
                  color="gray"
                  highContrast
                  ref={index === 0 ? controlRef : undefined}
                  name={id}
                  value={value}
                  checked={props.value.includes(value)}
                  disabled={disabled}
                  onBlur={onBlur}
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy}
                  onCheckedChange={(checked) =>
                    props.onChange(
                      checked === true
                        ? [...props.value, value]
                        : props.value.filter((item) => item !== value),
                    )
                  }
                />
                <span>{optionLabel}</span>
              </label>
            ))}
          </div>
        ) : (
          <RadioGroup.Root
            color="gray"
            highContrast
            name={id}
            value={props.value ?? ''}
            onValueChange={props.onChange}
            required={required}
            disabled={disabled}
            onBlur={onBlur}
            aria-labelledby={`${id}-label`}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            className="registration-options"
          >
            {Object.entries(options).map(([value, optionLabel], index) => (
              <RadioGroup.Item
                key={value}
                value={value}
                ref={index === 0 ? controlRef : undefined}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                className="registration-option"
                data-disabled={disabled || undefined}
              >
                {optionLabel}
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        )}
        <p
          id={describedBy}
          className="registration-error"
        >
          {error}
        </p>
        {children}
      </div>
    </fieldset>
  );
}

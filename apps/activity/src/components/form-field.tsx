import type { ReactNode } from 'react';

type ControlProps = {
  id: string;
  required?: boolean;
  'aria-invalid': boolean;
  'aria-describedby': string;
};

export type FormFieldProps = {
  id: string;
  number?: string;
  label: string;
  required?: boolean;
  error?: string;
  children: (props: ControlProps) => ReactNode;
};

export function FormField({
  id,
  number,
  label,
  required,
  error,
  children,
}: FormFieldProps) {
  return (
    <div
      className={number ? 'registration-question' : 'registration-explanation'}
    >
      <label
        htmlFor={id}
        className="registration-label"
      >
        {number && <span className="registration-number">{number}</span>}
        {label}
        {required && (
          <span
            className="registration-required"
            aria-label="必填"
          >
            *
          </span>
        )}
      </label>
      <div className={number ? 'registration-control' : undefined}>
        {children({
          id,
          required,
          'aria-invalid': Boolean(error),
          'aria-describedby': `${id}-error`,
        })}
        <p
          id={`${id}-error`}
          className="registration-error"
        >
          {error}
        </p>
      </div>
    </div>
  );
}

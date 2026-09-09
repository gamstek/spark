export function RequiredFieldMark() {
  return (
    <>
      <span
        className="required-field-mark"
        aria-hidden="true"
      >
        *
      </span>
      <span className="sr-only">（必填）</span>
    </>
  );
}

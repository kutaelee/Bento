import React, { type ChangeEvent, type InputHTMLAttributes } from "react";

type InputBaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">;

export type TextFieldProps = InputBaseProps & {
  label?: string;
  hint?: string;
  error?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

let textFieldInstance = 0;

function getInputId(id?: string): string {
  if (id) {
    return id;
  }
  textFieldInstance += 1;
  return `nd-textfield-${textFieldInstance}`;
}

export function TextField({
  label,
  hint,
  error,
  className,
  id,
  name,
  type = "text",
  onChange,
  ...props
}: TextFieldProps) {
  const inputId = getInputId(id);
  const inputClassName = ["nd-input", error ? "nd-input--error" : null, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="nd-field">
      {label ? (
        <label className="nd-field__label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        {...props}
        id={inputId}
        name={name}
        type={type}
        className={inputClassName}
        aria-invalid={error ? true : undefined}
        onChange={onChange}
      />
      {error ? (
        <div className="nd-field__error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div className="nd-field__hint">{hint}</div>
      ) : null}
    </div>
  );
}

import React, { type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

function getVariantClassName(variant: ButtonVariant): string {
  switch (variant) {
    case "primary":
      return "nd-btn nd-btn--primary";
    case "secondary":
      return "nd-btn nd-btn--secondary";
    case "ghost":
      return "nd-btn nd-btn--ghost";
    case "danger":
      return "nd-btn nd-btn--danger";
    case "outline":
      return "nd-btn nd-btn--secondary";
  }
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const { type: buttonType, ...restProps } = props;
  const isDisabled = disabled || loading;
  const classes = [getVariantClassName(variant), className].filter(Boolean).join(" ");

  return (
    <button
      {...restProps}
      type={buttonType ?? "button"}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
    >
      {children}
      {loading ? "…" : null}
    </button>
  );
}

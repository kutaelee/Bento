import React, { type AnchorHTMLAttributes } from "react";

export type LinkVariant = "default" | "muted";

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: LinkVariant;
};

function getVariantClassName(variant: LinkVariant): string {
  switch (variant) {
    case "default":
      return "nd-link nd-link--default";
    case "muted":
      return "nd-link nd-link--muted";
  }
}

export function Link({ variant = "default", className, ...props }: LinkProps) {
  const classes = [getVariantClassName(variant), className].filter(Boolean).join(" ");
  return <a className={classes} {...props} />;
}

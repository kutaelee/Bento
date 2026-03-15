import React from "react";

type FavoriteIconProps = {
  active?: boolean;
  className?: string;
};

export function FavoriteIcon({ active = false, className }: FavoriteIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 3.75l2.55 5.16 5.7.83-4.12 4.02.97 5.68L12 16.76l-5.1 2.68.97-5.68L3.75 9.74l5.7-.83L12 3.75z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

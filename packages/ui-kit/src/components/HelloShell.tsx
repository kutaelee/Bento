import React from "react";

type HelloShellProps = {
  title?: string;
};

export function HelloShell({ title = "Nimbus Drive UI" }: HelloShellProps) {
  return <div data-testid="hello-shell">{title}</div>;
}

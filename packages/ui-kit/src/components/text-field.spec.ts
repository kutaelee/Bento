import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField";
import { PasswordField } from "./PasswordField";

function getInput(element: { props: { children?: ReactElement | ReactElement[] | string | null } }) {
  const children = Array.isArray(element.props.children)
    ? element.props.children
    : [element.props.children];
  return children.find(
    (child): child is ReactElement =>
      !!child && typeof child === "object" && "type" in child && child.type === "input"
  );
}

describe("TextField", () => {
  it("defaults to text input", () => {
    const element = TextField({ label: "Email", name: "email" });
    const input = getInput(element);
    expect(input).toBeDefined();
    if (!input) return;
    expect(input.props.type).toBe("text");
    expect(input.props.id).toMatch(/^nd-textfield-/);
    expect(input.props.id).not.toBe("email");
    expect(input.props.className).toContain("nd-input");
  });

  it("marks error state", () => {
    const element = TextField({ label: "Email", error: "Required" });
    const input = getInput(element);
    expect(input).toBeDefined();
    if (!input) return;
    expect(input.props.className).toContain("nd-input--error");
    expect(input.props["aria-invalid"]).toBe(true);
  });
});

describe("PasswordField", () => {
  it("forces password type", () => {
    const element = PasswordField({ label: "Password", name: "password" });
    expect(element.props.type).toBe("password");
  });
});

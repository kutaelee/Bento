import { describe, expect, it } from "vitest";
import { HelloShell } from "./components/HelloShell";

describe("HelloShell", () => {
  it("sets the default title", () => {
    const element = HelloShell({});
    expect(element.props["data-testid"]).toBe("hello-shell");
    expect(element.props.children).toBe("Bento UI");
  });
});

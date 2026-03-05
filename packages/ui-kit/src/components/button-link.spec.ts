import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Link } from "./Link";

describe("Button", () => {
  it("renders primary class by default", () => {
    const element = Button({ children: "ok" });
    expect(element.type).toBe("button");
    expect(element.props.className).toContain("nd-btn--primary");
  });

  it("keeps default type when props omit it", () => {
    const element = Button({ children: "ok", type: undefined });
    expect(element.props.type).toBe("button");
  });

  it("keeps accessible label while loading", () => {
    const element = Button({ children: "ok", loading: true });
    expect(element.props.disabled).toBe(true);
    expect(element.props["aria-busy"]).toBe(true);
    expect(element.props.children).toContain("ok");
  });
});

describe("Link", () => {
  it("renders class for variant", () => {
    const element = Link({ href: "#", children: "x", variant: "muted" });
    expect(element.type).toBe("a");
    expect(element.props.className).toContain("nd-link--muted");
  });
});

import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("returns null when closed", () => {
    const element = Dialog({ open: false });
    expect(element).toBeNull();
  });

  it("renders overlay when open", () => {
    const element = Dialog({ open: true, title: "Hello" });
    expect(element?.props.className).toContain("nd-dialog-overlay");
  });

  it("calls onClose on escape", () => {
    const onClose = vi.fn();
    const element = Dialog({ open: true, title: "Hello", onClose });
    const dialog = element?.props.children;
    dialog.props.onKeyDown({ key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

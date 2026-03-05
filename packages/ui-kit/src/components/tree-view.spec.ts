import { describe, expect, it, vi } from "vitest";
import { TreeView } from "./TreeView";

describe("TreeView", () => {
  it("renders expanded children", () => {
    const element = TreeView({
      nodes: [
        {
          id: "root",
          label: "Root",
          hasChildren: true,
          isExpanded: true,
          children: [{ id: "child", label: "Child" }],
        },
      ],
    });

    const rows = element.props.children;
    expect(rows).toHaveLength(2);
    expect(rows[0].props["data-testid"]).toBe("tree-node-root");
    expect(rows[1].props["data-testid"]).toBe("tree-node-child");
  });

  it("fires onToggle when toggle clicked", () => {
    const onToggle = vi.fn();
    const element = TreeView({
      nodes: [{ id: "root", label: "Root", hasChildren: true }],
      onToggle,
    });

    const rows = element.props.children;
    const toggleButton = rows[0].props.children[0];
    toggleButton.props.onClick({ stopPropagation: () => {} });

    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: "root" }),
    );
  });
});

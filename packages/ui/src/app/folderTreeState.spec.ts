import { describe, expect, it } from "vitest";
import {
  applyFolderNodeChildren,
  createFolderTreeState,
  toggleFolderNode,
} from "./folderTreeState";

const ROOT_ID = "root-node";

describe("folderTreeState", () => {
  it("loads children once and caches across collapse", () => {
    const initial = createFolderTreeState({
      rootId: ROOT_ID,
      rootLabel: "Root",
      expanded: false,
    });

    const firstToggle = toggleFolderNode(initial, ROOT_ID);
    expect(firstToggle.shouldLoad).toBe(true);

    const withChildren = applyFolderNodeChildren(firstToggle.nextState, ROOT_ID, [
      { id: "child-1", label: "Child", hasChildren: true },
    ]);

    const collapse = toggleFolderNode(withChildren, ROOT_ID);
    expect(collapse.shouldLoad).toBe(false);

    const reopen = toggleFolderNode(collapse.nextState, ROOT_ID);
    expect(reopen.shouldLoad).toBe(false);
  });
});

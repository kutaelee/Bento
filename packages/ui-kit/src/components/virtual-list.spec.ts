import { describe, expect, it } from "vitest";
import { VirtualList } from "./VirtualList";

describe("VirtualList", () => {
  it("renders a window of items", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);

    const element = VirtualList({
      items,
      itemHeightPx: 10,
      heightPx: 50,
      overscanCount: 0,
      scrollTopPx: 0,
      renderItem: (item) => item,
    });

    // height 50 / itemHeight 10 => 5 visible rows
    const containerChildren = element.props.children;
    const inner = containerChildren;
    const rows = inner.props.children;

    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(5);
    expect(rows[0].props.style.top).toBe("0px");
    expect(rows[4].props.style.top).toBe("40px");
  });
});

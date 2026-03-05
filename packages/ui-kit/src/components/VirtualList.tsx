import React from "react";

export type VirtualListProps<TItem> = {
  items: readonly TItem[];
  itemHeightPx: number;
  heightPx: number;
  overscanCount?: number;
  scrollTopPx?: number;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  renderItem: (item: TItem, index: number) => React.ReactNode;
};

export function VirtualList<TItem>({
  items,
  itemHeightPx,
  heightPx,
  overscanCount = 4,
  scrollTopPx,
  onScroll,
  renderItem,
}: VirtualListProps<TItem>) {
  // Minimal primitive: fixed-height windowing.
  // Keep hook-free so tests can call the component directly.
  const isScrollControlled = scrollTopPx !== undefined;
  const resolvedScrollTopPx = scrollTopPx ?? 0;
  const visibleCount = Math.max(0, Math.ceil(heightPx / itemHeightPx));
  const baseIndex = Math.max(0, Math.floor(resolvedScrollTopPx / itemHeightPx));
  const startIndex = isScrollControlled ? Math.max(0, baseIndex - overscanCount) : 0;
  const endIndex = isScrollControlled
    ? Math.min(items.length, baseIndex + visibleCount + overscanCount)
    : items.length;
  const windowItems = isScrollControlled ? items.slice(startIndex, endIndex) : items;

  const totalHeight = items.length * itemHeightPx;

  return (
    <div
      data-testid="virtual-list"
      onScroll={onScroll}
      style={{
        height: `${heightPx}px`,
        overflow: "auto",
        position: "relative",
      }}
    >
      <div style={{ height: `${totalHeight}px`, position: "relative" }}>
        {windowItems.map((item, index) => {
          const itemIndex = startIndex + index;
          return (
            <div
              key={itemIndex}
              data-testid="virtual-list-row"
              style={{
                position: "absolute",
                top: `${itemIndex * itemHeightPx}px`,
                left: 0,
                right: 0,
                height: `${itemHeightPx}px`,
              }}
            >
              {renderItem(item, itemIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

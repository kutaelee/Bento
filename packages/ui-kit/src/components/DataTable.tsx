import React from "react";
import { VirtualList } from "./VirtualList";

export type DataTableColumn<TItem> = {
  id: string;
  header: React.ReactNode;
  widthPx?: number;
  align?: "left" | "center" | "right";
  renderCell: (item: TItem, index: number) => React.ReactNode;
};

export type DataTableProps<TItem> = {
  items: readonly TItem[];
  columns: readonly DataTableColumn<TItem>[];
  heightPx: number;
  rowHeightPx: number;
  overscanCount?: number;
  getRowKey?: (item: TItem, index: number) => string | number;
  onRowClick?: (item: TItem, index: number) => void;
  getRowClassName?: (item: TItem, index: number) => string | undefined;
  scrollTopPx?: number;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
};

const DEFAULT_GRID_COLUMN = "1fr";

function getGridTemplateColumns<TItem>(columns: readonly DataTableColumn<TItem>[]) {
  return columns
    .map((column) => (column.widthPx ? `${column.widthPx}px` : DEFAULT_GRID_COLUMN))
    .join(" ");
}

export function DataTable<TItem>({
  items,
  columns,
  heightPx,
  rowHeightPx,
  overscanCount = 4,
  getRowKey,
  onRowClick,
  getRowClassName,
  scrollTopPx,
  onScroll,
}: DataTableProps<TItem>) {
  const gridTemplateColumns = getGridTemplateColumns(columns);

  return (
    <div className="nd-table" data-testid="data-table">
      <div
        className="nd-table__header"
        data-testid="data-table-header"
        style={{ gridTemplateColumns }}
      >
        {columns.map((column) => (
          <div
            key={column.id}
            className="nd-table__cell nd-table__cell--header"
            style={{ textAlign: column.align ?? "left" }}
          >
            {column.header}
          </div>
        ))}
      </div>
      <VirtualList
        items={items}
        itemHeightPx={rowHeightPx}
        heightPx={heightPx}
        overscanCount={overscanCount}
        scrollTopPx={scrollTopPx}
        onScroll={onScroll}
        renderItem={(item, index) => {
          const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onRowClick?.(item, index);
            }
          };

          return (
            <div
              key={getRowKey ? getRowKey(item, index) : index}
              className={["nd-table__row", getRowClassName?.(item, index)].filter(Boolean).join(" ")}
              data-testid="data-table-row"
              style={{
                gridTemplateColumns,
                height: `${rowHeightPx}px`,
                ...(onRowClick ? { cursor: "pointer" } : {}),
              }}
              role={onRowClick ? "button" : "row"}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(item, index) : undefined}
              onKeyDown={onRowClick ? handleRowKeyDown : undefined}
            >
              {columns.map((column) => (
                <div
                  key={column.id}
                  className="nd-table__cell"
                  style={{ textAlign: column.align ?? "left" }}
                >
                  {column.renderCell(item, index)}
                </div>
              ))}
            </div>
          );
        }}
      />
    </div>
  );
}

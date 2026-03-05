import React from "react";
import { DataTable, type DataTableColumn, type DataTableProps } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingSkeleton } from "./LoadingSkeleton";

export type PatternDataTableState = {
  emptyTitle: string;
  emptyDetail: string;
};

export type PatternDataTableProps<TItem> = Omit<
  DataTableProps<TItem>,
  "heightPx" | "rowHeightPx" | "onScroll" | "scrollTopPx"
> & {
  loading?: boolean;
  state?: PatternDataTableState;
  errorMessage?: string;
  heightPx?: number;
  rowHeightPx?: number;
};

const TABLE_FALLBACK_HEIGHT = 360;
const TABLE_DEFAULT_ROW_HEIGHT = 48;

export function PatternDataTable<TItem>({
  loading = false,
  errorMessage,
  state = {
    emptyTitle: "표시할 데이터가 없습니다",
    emptyDetail: "다시 불러오기를 시도하거나 조건을 바꿔보세요",
  },
  heightPx = TABLE_FALLBACK_HEIGHT,
  rowHeightPx = TABLE_DEFAULT_ROW_HEIGHT,
  ...tableProps
}: PatternDataTableProps<TItem>) {
  const hasItems = tableProps.items.length > 0;

  if (loading) {
    return <LoadingSkeleton lines={Math.max(3, Math.floor(heightPx / rowHeightPx))} />;
  }

  if (errorMessage && hasItems) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ErrorState title="데이터 조회 중 오류가 발생했습니다" detail={errorMessage} />
        <DataTable
          {...tableProps}
          heightPx={heightPx}
          rowHeightPx={rowHeightPx}
          columns={tableProps.columns as DataTableColumn<TItem>[]}
        />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState title="데이터 조회 중 오류가 발생했습니다" detail={errorMessage} />;
  }

  if (tableProps.items.length === 0) {
    return <EmptyState title={state.emptyTitle} detail={state.emptyDetail} />;
  }

  return (
    <DataTable
      {...tableProps}
      heightPx={heightPx}
      rowHeightPx={rowHeightPx}
      columns={tableProps.columns as DataTableColumn<TItem>[]}
    />
  );
}

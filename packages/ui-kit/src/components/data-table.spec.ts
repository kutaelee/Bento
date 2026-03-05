import { describe, expect, it } from "vitest";
import { DataTable, type DataTableColumn } from "./DataTable";

describe("DataTable", () => {
  it("renders header cells and passes items to VirtualList", () => {
    const items = [
      { name: "A", size: "1 MB" },
      { name: "B", size: "2 MB" },
    ];

    const columns: DataTableColumn<(typeof items)[number]>[] = [
      {
        id: "name",
        header: "Name",
        renderCell: (item) => item.name,
      },
      {
        id: "size",
        header: "Size",
        widthPx: 120,
        renderCell: (item) => item.size,
      },
    ];

    const element = DataTable({
      items,
      columns,
      heightPx: 120,
      rowHeightPx: 40,
    });

    const [header, list] = element.props.children;

    expect(header.props["data-testid"]).toBe("data-table-header");
    expect(header.props.children).toHaveLength(2);
    expect(list.props.items).toHaveLength(2);
    expect(list.props.itemHeightPx).toBe(40);
  });
});

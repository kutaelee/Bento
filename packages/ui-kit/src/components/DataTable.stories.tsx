import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { DataTable } from "./DataTable";

const meta: Meta<typeof DataTable> = {
  title: "components/DataTable",
  component: DataTable,
};

export default meta;

type Story = StoryObj<typeof DataTable>;

type FileRow = {
  name: string;
  owner: string;
  size: string;
  modifiedAt: string;
};

const rows: FileRow[] = Array.from({ length: 120 }, (_, index) => ({
  name: `파일 ${index + 1}`,
  owner: index % 2 === 0 ? "admin" : "guest",
  size: `${(index + 1) * 12} MB`,
  modifiedAt: `2026-02-${(index % 28) + 1}`,
}));

function DataTableInteractiveStory() {
  const [scrollTopPx, setScrollTopPx] = React.useState(0);

  return (
    <DataTable
      items={rows}
      columns={[
        {
          id: "name",
          header: "Name",
          renderCell: (item) => item.name,
        },
        {
          id: "owner",
          header: "Owner",
          widthPx: 120,
          renderCell: (item) => item.owner,
        },
        {
          id: "size",
          header: "Size",
          widthPx: 100,
          align: "right",
          renderCell: (item) => item.size,
        },
        {
          id: "modifiedAt",
          header: "Modified",
          widthPx: 160,
          renderCell: (item) => item.modifiedAt,
        },
      ]}
      heightPx={320}
      rowHeightPx={44}
      scrollTopPx={scrollTopPx}
      onScroll={(event) => setScrollTopPx(event.currentTarget.scrollTop)}
    />
  );
}

export const Basic: Story = {
  render: () => <DataTableInteractiveStory />,
};

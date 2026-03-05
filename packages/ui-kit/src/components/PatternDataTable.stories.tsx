import type { Meta, StoryObj } from "@storybook/react";
import type { DataTableColumn } from "./DataTable";
import { PatternDataTable } from "./PatternDataTable";

type Row = {
  name: string;
  size: string;
  type: string;
};

const columns: DataTableColumn<Row>[] = [
  {
    id: "name",
    header: "이름",
    renderCell: (item) => item.name,
  },
  {
    id: "size",
    header: "크기",
    renderCell: (item) => item.size,
  },
  {
    id: "type",
    header: "형식",
    renderCell: (item) => item.type,
  },
];

const meta: Meta<typeof PatternDataTable<Row>> = {
  title: "Foundation/PatternDataTable",
  component: PatternDataTable<Row>,
};

export default meta;

type Story = StoryObj<typeof PatternDataTable<Row>>;

export const Default: Story = {
  args: {
    items: [
      { name: "Design", size: "24 MB", type: "폴더" },
      { name: "avatar.png", size: "420 KB", type: "이미지" },
    ],
    columns,
    heightPx: 160,
    rowHeightPx: 44,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    columns,
    heightPx: 160,
    rowHeightPx: 44,
    state: {
      emptyTitle: "비어 있습니다",
      emptyDetail: "표시할 항목이 없습니다",
    },
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { TreeView } from "./TreeView";

const meta: Meta<typeof TreeView> = {
  title: "components/TreeView",
  component: TreeView,
};

export default meta;

type Story = StoryObj<typeof TreeView>;

export const Basic: Story = {
  args: {
    nodes: [
      {
        id: "root",
        label: "Root",
        hasChildren: true,
        isExpanded: true,
        children: [
          { id: "photos", label: "Photos" },
          {
            id: "projects",
            label: "Projects",
            hasChildren: true,
            isExpanded: true,
            children: [{ id: "nimbus", label: "Nimbus" }],
          },
        ],
      },
      { id: "shared", label: "Shared", hasChildren: true },
    ],
  },
};

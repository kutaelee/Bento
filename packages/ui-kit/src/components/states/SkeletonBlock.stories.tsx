import type { Meta, StoryObj } from "@storybook/react";
import { SkeletonBlock } from "./SkeletonBlock";

const meta: Meta<typeof SkeletonBlock> = {
  title: "States/SkeletonBlock",
  component: SkeletonBlock,
};

export default meta;

type Story = StoryObj<typeof SkeletonBlock>;

export const Line: Story = {
  args: {
    variant: "line",
  },
};

export const Card: Story = {
  args: {
    variant: "card",
  },
};

export const TableRow: Story = {
  args: {
    variant: "table-row",
  },
};

export const Avatar: Story = {
  args: {
    variant: "avatar",
  },
};

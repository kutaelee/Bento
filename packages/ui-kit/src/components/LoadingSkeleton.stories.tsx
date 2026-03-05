import type { Meta, StoryObj } from "@storybook/react";
import { LoadingSkeleton } from "./LoadingSkeleton";

const meta: Meta<typeof LoadingSkeleton> = {
  title: "Foundation/LoadingSkeleton",
  component: LoadingSkeleton,
};

export default meta;

type Story = StoryObj<typeof LoadingSkeleton>;

export const Default: Story = {
  args: {
    lines: 4,
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { ForbiddenState } from "./ForbiddenState";

const meta: Meta<typeof ForbiddenState> = {
  title: "States/ForbiddenState",
  component: ForbiddenState,
};

export default meta;

type Story = StoryObj<typeof ForbiddenState>;

export const Default: Story = {
  args: {
    title: "Access denied",
    description: "You do not have permission to view this section.",
    actionLabelKey: "Go back",
  },
};

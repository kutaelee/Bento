import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "States/EmptyState",
  component: EmptyState,
};

export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    icon: "📁",
    title: "No files yet",
    description: "Upload files or create a folder to get started.",
  },
};

export const WithAction: Story = {
  args: {
    icon: "📂",
    title: "Nothing in this folder",
    description: "Try changing filters or creating a new folder.",
    action: "Create folder",
  },
};

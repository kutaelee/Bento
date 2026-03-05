import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "Foundation/EmptyState",
  component: EmptyState,
};

export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: "항목이 비었습니다",
    detail: "항목을 추가하거나 필터를 변경해 보세요.",
  },
};

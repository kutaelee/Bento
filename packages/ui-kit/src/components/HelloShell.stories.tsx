import type { Meta, StoryObj } from "@storybook/react";
import { HelloShell } from "./HelloShell";

const meta: Meta<typeof HelloShell> = {
  title: "Foundation/HelloShell",
  component: HelloShell,
};

export default meta;

type Story = StoryObj<typeof HelloShell>;

export const Default: Story = {};

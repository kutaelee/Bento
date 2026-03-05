import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "components/Button",
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: "Primary", variant: "primary" },
};

export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
};

export const Ghost: Story = {
  args: { children: "Ghost", variant: "ghost" },
};

export const Loading: Story = {
  args: { children: "Save", loading: true },
};

export const Disabled: Story = {
  args: { children: "Disabled", disabled: true },
};

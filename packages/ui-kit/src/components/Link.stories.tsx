import type { Meta, StoryObj } from "@storybook/react";
import { Link } from "./Link";

const meta: Meta<typeof Link> = {
  title: "components/Link",
  component: Link,
};

export default meta;
type Story = StoryObj<typeof Link>;

export const Default: Story = {
  args: { children: "Link", href: "#", variant: "default" },
};

export const Muted: Story = {
  args: { children: "Muted", href: "#", variant: "muted" },
};

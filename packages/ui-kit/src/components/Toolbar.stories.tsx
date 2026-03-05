import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Toolbar } from "./Toolbar";

const meta: Meta<typeof Toolbar> = {
  title: "Foundation/Toolbar",
  component: Toolbar,
};

export default meta;

type Story = StoryObj<typeof Toolbar>;

export const Default: Story = {
  render: () => (
    <Toolbar>
      <button>필터</button>
      <button>정렬</button>
    </Toolbar>
  ),
};

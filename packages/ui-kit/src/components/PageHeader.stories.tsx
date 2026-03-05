import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { PageHeader } from "./PageHeader";

const meta: Meta<typeof PageHeader> = {
  title: "Foundation/PageHeader",
  component: PageHeader,
};

export default meta;

type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: "파일 탐색",
    metaLabel: "경로",
    metaValue: "/files",
    actions: <button>새 폴더</button>,
  },
};

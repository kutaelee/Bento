import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { DetailInspector } from "./DetailInspector";

const meta: Meta<typeof DetailInspector> = {
  title: "Foundation/DetailInspector",
  component: DetailInspector,
};

export default meta;

type Story = StoryObj<typeof DetailInspector>;

export const Default: Story = {
  args: {
    title: "상세 패널",
    children: <div style={{ padding: 12 }}>노드 상세 정보를 확인하세요.</div>,
  },
};

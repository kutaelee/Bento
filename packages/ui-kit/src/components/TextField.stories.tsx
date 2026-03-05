import type { Meta, StoryObj } from "@storybook/react";
import { TextField } from "./TextField";

const meta: Meta<typeof TextField> = {
  title: "components/TextField",
  component: TextField,
};

export default meta;

type Story = StoryObj<typeof TextField>;

export const Default: Story = {
  args: {
    label: "Email",
    name: "email",
    placeholder: "you@example.com",
  },
};

export const WithHint: Story = {
  args: {
    label: "Full name",
    name: "fullName",
    hint: "정부 발급 신분증 이름과 동일하게 입력하세요.",
  },
};

export const WithError: Story = {
  args: {
    label: "Email",
    name: "email",
    error: "필수 입력입니다.",
  },
};

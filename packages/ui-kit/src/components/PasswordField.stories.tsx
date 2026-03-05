import type { Meta, StoryObj } from "@storybook/react";
import { PasswordField } from "./PasswordField";

const meta: Meta<typeof PasswordField> = {
  title: "components/PasswordField",
  component: PasswordField,
};

export default meta;

type Story = StoryObj<typeof PasswordField>;

export const Default: Story = {
  args: {
    label: "Password",
    name: "password",
    placeholder: "8자 이상",
  },
};

export const Disabled: Story = {
  args: {
    label: "Password",
    name: "password",
    disabled: true,
    placeholder: "disabled",
  },
};

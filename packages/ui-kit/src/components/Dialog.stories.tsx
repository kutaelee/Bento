import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

const meta: Meta<typeof Dialog> = {
  title: "components/Dialog",
  component: Dialog,
};

export default meta;

type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  args: {
    open: true,
    title: "Modal title",
    description: "Short description for modal context.",
    closeLabel: "Close",
    children: "Dialog body content goes here.",
  },
};

export const WithFooter: Story = {
  args: {
    open: true,
    title: "Confirm action",
    description: "Use this dialog to confirm the action.",
    closeLabel: "Close",
    children: "Actions are aligned to the footer.",
    footer: (
      <div className="nd-dialog__actions">
        <Button variant="secondary">Cancel</Button>
        <Button>Save</Button>
      </div>
    ),
  },
};

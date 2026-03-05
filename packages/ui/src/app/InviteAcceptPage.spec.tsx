import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InviteAcceptView, type InviteAcceptFormState } from "./InviteAcceptPage";
import { t } from "../i18n/t";

const baseState: InviteAcceptFormState = {
  username: "user",
  password: "password123",
  displayName: "",
};

const noopChange = () => () => undefined;
const noopSubmit = () => undefined;

const renderView = (overrides: Partial<React.ComponentProps<typeof InviteAcceptView>> = {}) => {
  return renderToStaticMarkup(
    <InviteAcceptView
      tokenMissing={false}
      submitting={false}
      errorKey={null}
      formState={baseState}
      onFieldChange={noopChange}
      onSubmit={noopSubmit}
      {...overrides}
    />,
  );
};

describe("InviteAcceptView", () => {
  it("renders missing token state", () => {
    const html = renderView({ tokenMissing: true });
    expect(html).toContain(t("msg.inviteMissingToken"));
  });

  it("renders valid token state", () => {
    const html = renderView({ tokenMissing: false, errorKey: null });
    expect(html).toContain(t("action.acceptInvite"));
    expect(html).not.toContain(t("msg.inviteMissingToken"));
  });

  it("renders expired token state", () => {
    const html = renderView({ tokenMissing: false, errorKey: "msg.inviteExpired" });
    expect(html).toContain(t("msg.inviteExpired"));
  });
});

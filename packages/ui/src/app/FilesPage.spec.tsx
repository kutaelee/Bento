import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { FolderView } from "./FilesPage";
import { t } from "../i18n/t";
import type { NodeItem } from "../api/nodes";

const baseItem: NodeItem = {
  id: "node-1",
  type: "FOLDER",
  name: "Design",
  parent_id: "parent",
  path: "root.node-1",
  created_at: "2026-02-28T00:00:00Z",
  updated_at: "2026-02-28T00:00:00Z",
};

const renderWithSuppressedLayoutEffectWarning = (element: React.ReactElement) => {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const [message] = args;
    if (typeof message === "string" && message.includes("useLayoutEffect does nothing on the server")) {
      return;
    }
    originalError(...args);
  };

  try {
    return renderToStaticMarkup(element);
  } finally {
    console.error = originalError;
  }
};

const renderView = (overrides: Partial<React.ComponentProps<typeof FolderView>> = {}) =>
  renderWithSuppressedLayoutEffectWarning(
    <MemoryRouter>
      <FolderView
        title="Files"
        items={[baseItem]}
        nextCursor={null}
        loading={false}
        loadingMore={false}
        errorKey={null}
        onLoadMore={() => undefined}
        {...overrides}
      />
    </MemoryRouter>,
  );

describe("FolderView", () => {
  it("renders a load more button when pagination cursor exists", () => {
    const html = renderView({ nextCursor: "next-cursor" });
    expect(html).toContain(t("action.loadMore"));
    expect(html).toContain("Design");
  });

  it("hides load more button when pagination cursor is null", () => {
    const html = renderView({ nextCursor: null });
    expect(html).not.toContain(t("action.loadMore"));
  });

  it("renders empty state when folder has no items", () => {
    const html = renderView({ items: [] });
    expect(html).toContain(t("msg.emptyFolder"));
  });

  it("renders trash empty state when custom key is provided", () => {
    const html = renderView({ items: [], emptyKey: "msg.emptyTrash" });
    expect(html).toContain(t("msg.emptyTrash"));
  });
});

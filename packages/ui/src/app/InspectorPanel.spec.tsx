import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { InspectorPanel } from "./InspectorPanel";
import { FolderRefreshProvider } from "./folderRefresh";
import { InspectorProvider } from "./inspectorState";
import { t } from "../i18n/t";
import type { NodeItem } from "../api/nodes";

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

const renderPanel = (selectedNode: NodeItem | null) =>
  renderWithSuppressedLayoutEffectWarning(
    <MemoryRouter>
      <FolderRefreshProvider>
        <InspectorProvider initialSelectedNode={selectedNode}>
          <InspectorPanel />
        </InspectorProvider>
      </FolderRefreshProvider>
    </MemoryRouter>,
  );

describe("InspectorPanel", () => {
  it("renders empty state when no node is selected", () => {
    const html = renderPanel(null);
    expect(html).toContain(t("msg.detailsTitle"));
    expect(html).toContain(t("msg.selectItem"));
  });

  it("renders metadata for a selected node", () => {
    const node: NodeItem = {
      id: "node-1",
      type: "FILE",
      name: "report.pdf",
      parent_id: "parent",
      path: "root.node-1",
      owner_user_id: "user-1",
      size_bytes: 1024,
      created_at: "2026-02-28T00:00:00Z",
      updated_at: "2026-02-28T00:00:00Z",
    };

    const html = renderPanel(node);
    expect(html).toContain(t("field.name"));
    expect(html).toContain("report.pdf");
    expect(html).toContain("1.0 KB");
    expect(html).toContain("user-1");
  });
});

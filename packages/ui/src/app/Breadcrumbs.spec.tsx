import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, MemoryRouter } from "react-router-dom";
import { BreadcrumbTrail } from "./Breadcrumbs";
import { ROOT_NODE_ID } from "./nodes";

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

describe("BreadcrumbTrail", () => {
  it("links to parent paths and supports route change", async () => {
    const items = [
      { id: ROOT_NODE_ID, name: "Files" },
      { id: "node-1", name: "Design" },
    ];

    const html = renderWithSuppressedLayoutEffectWarning(
      <MemoryRouter initialEntries={["/files/node-1"]}>
        <BreadcrumbTrail items={items} />
      </MemoryRouter>,
    );

    expect(html).toContain('href="/files"');

    const router = createMemoryRouter(
      [
        { path: "/files", element: <div>Files root</div> },
        { path: "/files/:nodeId", element: <div>Files node</div> },
      ],
      { initialEntries: ["/files/node-1"] },
    );

    expect(router.state.location.pathname).toBe("/files/node-1");
    await router.navigate("/files");
    expect(router.state.location.pathname).toBe("/files");
  });
});

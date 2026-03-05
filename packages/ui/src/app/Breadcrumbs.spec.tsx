import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, MemoryRouter } from "react-router-dom";
import { BreadcrumbTrail } from "./Breadcrumbs";
import { ROOT_NODE_ID } from "./nodes";

describe("BreadcrumbTrail", () => {
  it("links to parent paths and supports route change", async () => {
    const items = [
      { id: ROOT_NODE_ID, name: "Files" },
      { id: "node-1", name: "Design" },
    ];

    const html = renderToStaticMarkup(
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

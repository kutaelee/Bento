import { beforeEach, describe, expect, it } from "vitest";
import { installVisualFixtures, ROOT_NODE_ID, isVisualFixtureEnabled } from "./visualFixtures";

class MemoryStorage {
  private data = new Map<string, string>();

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }

  get length() {
    return this.data.size;
  }
}

type TestWindow = {
  location: URL;
  localStorage: MemoryStorage;
  fetch: typeof fetch;
  __visualFixturesInstalled?: boolean;
};

function installFor(url: string) {
  const testWindow: TestWindow = {
    location: new URL(url),
    localStorage: new MemoryStorage(),
    fetch: globalThis.fetch.bind(globalThis),
  };

  Object.defineProperty(globalThis, "window", {
    value: testWindow,
    configurable: true,
    writable: true,
  });

  installVisualFixtures();
}

describe("visual fixtures", () => {
  beforeEach(() => {
    installFor("http://localhost:5555/files?visualFixtures=1");
  });

  it("supports folder creation and subsequent listing", async () => {
    const folderName = "New QA Folder";
    const createResponse = await window.fetch("/nodes/folders", {
      method: "POST",
      body: JSON.stringify({ parent_id: ROOT_NODE_ID, name: folderName }),
    });
    expect(createResponse.ok).toBe(true);

    const listResponse = await window.fetch(`/nodes/${ROOT_NODE_ID}/children`);
    const payload = (await listResponse.json()) as { items: Array<{ name: string }> };

    expect(payload.items.some((item) => item.name === folderName)).toBe(true);
  });

  it("supports upload lifecycle and exposes the uploaded file in the folder", async () => {
    const uploadName = "Upload-QA-Check.png";
    const createResponse = await window.fetch("/uploads", {
      method: "POST",
      body: JSON.stringify({
        parent_id: ROOT_NODE_ID,
        filename: uploadName,
        size_bytes: 4096,
        mime_type: "image/png",
      }),
    });
    expect(createResponse.status).toBe(201);
    const createPayload = (await createResponse.json()) as { upload_id: string };

    const chunkResponse = await window.fetch(`/uploads/${createPayload.upload_id}/chunks/0`, {
      method: "PUT",
      body: "chunk",
    });
    expect(chunkResponse.ok).toBe(true);

    const completeResponse = await window.fetch(`/uploads/${createPayload.upload_id}/complete`, {
      method: "POST",
    });
    expect(completeResponse.ok).toBe(true);

    const listResponse = await window.fetch(`/nodes/${ROOT_NODE_ID}/children`);
    const payload = (await listResponse.json()) as { items: Array<{ name: string }> };
    expect(payload.items.some((item) => item.name === uploadName)).toBe(true);
  });

  it("supports share-link creation and media thumbnail retries", async () => {
    const shareResponse = await window.fetch("/nodes/22222222-2222-2222-2222-222222222222/share-links", {
      method: "POST",
      body: JSON.stringify({ expires_in_seconds: 600 }),
    });
    const sharePayload = (await shareResponse.json()) as { token: string };
    expect(sharePayload.token).toBeTruthy();

    const firstThumbnail = await window.fetch("/media/22222222-2222-2222-2222-222222222222/thumbnail");
    expect(firstThumbnail.status).toBe(202);

    const secondThumbnail = await window.fetch("/media/22222222-2222-2222-2222-222222222222/thumbnail");
    expect(secondThumbnail.ok).toBe(true);
    expect(secondThumbnail.headers.get("content-type")).toContain("image/");
  });

  it("returns 1 TiB when validating volume paths", async () => {
    const response = await window.fetch("/admin/volumes/validate-path", {
      method: "POST",
      body: JSON.stringify({ path: "/mnt/bento-main" }),
    });
    expect(response.ok).toBe(true);

    const payload = (await response.json()) as { total_bytes: number };
    expect(payload.total_bytes).toBe(1024 ** 4);
  });

  it("returns the active volume with the same 1 TiB total", async () => {
    const response = await window.fetch("/admin/volumes");
    expect(response.ok).toBe(true);

    const payload = (await response.json()) as {
      items: Array<{ id: string; is_active: boolean; total_bytes: number }>;
    };
    const activeVolume = payload.items.find((item) => item.is_active);

    expect(activeVolume).toBeDefined();
    expect(activeVolume?.total_bytes).toBe(1024 ** 4);
  });

  it("supports volume deactivate and delete flows", async () => {
    const createResponse = await window.fetch("/admin/volumes", {
      method: "POST",
      body: JSON.stringify({ name: "Backup volume", base_path: "/mnt/bento-secondary" }),
    });
    expect(createResponse.ok).toBe(true);
    const createdVolume = (await createResponse.json()) as { id: string };

    const deactivateResponse = await window.fetch("/admin/volumes/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/deactivate", {
      method: "POST",
    });
    expect(deactivateResponse.ok).toBe(true);

    const deactivatePayload = (await deactivateResponse.json()) as { is_active: boolean };
    expect(deactivatePayload.is_active).toBe(false);

    const deleteResponse = await window.fetch(`/admin/volumes/${createdVolume.id}`, {
      method: "DELETE",
    });
    expect(deleteResponse.ok).toBe(true);

    const listResponse = await window.fetch("/admin/volumes");
    const payload = (await listResponse.json()) as { items: Array<{ id: string }> };
    expect(payload.items.some((item) => item.id === createdVolume.id)).toBe(false);
  });

  it("enables fixtures only when the query flag is present", () => {
    installFor("http://localhost:5555/files");
    expect(isVisualFixtureEnabled()).toBe(false);

    installFor("http://localhost:5555/files?visualFixtures=1");
    expect(isVisualFixtureEnabled()).toBe(true);
  });
});

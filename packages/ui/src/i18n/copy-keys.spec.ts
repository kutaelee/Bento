import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ko from "./locales/ko-KR.json";
import en from "./locales/en-US.json";

const ssotPath = resolve(__dirname, "../../../../docs/ui/COPY_KEYS_SSOT.md");

const extractKeys = (content: string): string[] => {
  const keys = new Set<string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const parts = trimmed.split("|").map((part) => part.trim());
    if (parts.length < 3) continue;
    const key = parts[1];
    if (!key || key === "key" || key === "---") continue;
    if (!key.includes(".")) continue;
    keys.add(key);
  }
  return Array.from(keys);
};

describe("COPY_KEYS_SSOT locales", () => {
  const content = readFileSync(ssotPath, "utf-8");
  const keys = extractKeys(content);

  it("ko-KR contains every SSOT key", () => {
    const missing = keys.filter((key) => !(key in ko));
    expect(missing).toEqual([]);
  });

  it("en-US contains every SSOT key", () => {
    const missing = keys.filter((key) => !(key in en));
    expect(missing).toEqual([]);
  });
});

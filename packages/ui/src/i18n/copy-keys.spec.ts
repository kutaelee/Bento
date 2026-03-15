import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ko from "./locales/ko-KR.json";
import en from "./locales/en-US.json";
import { t } from "./t";

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

const hasBrokenGlyphs = (value: string) =>
  value.includes("\uFFFD") ||
  value.includes("??") ||
  /[횄횂횖횗횠횧횩챨첸]{2,}/.test(value) ||
  /\b(?:[A-Za-z]{1,2}\s+){2,}[A-Za-z]{1,2}\b/.test(value);

const runtimeCoverageKeys = [
  "action.cancel",
  "action.close",
  "action.download",
  "action.loadMore",
  "action.refresh",
  "action.upload",
  "admin.appearance.themeDark",
  "admin.audit.column.action",
  "admin.storage.title",
  "admin.users.title",
  "err.notFound",
  "field.name",
  "msg.emptyFolder",
  "msg.filesDescription",
  "msg.filesViewToggle",
  "msg.loginHeroTitle",
  "msg.mediaDescription",
  "msg.mediaPreviewUnavailable",
  "msg.searchHeroTitle",
  "msg.volumeActivated",
  "msg.volumeCreated",
  "nav.files",
  "nav.media",
  "nav.trash",
] as const;

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

  it("returns clean Korean copy for high-visibility runtime strings", () => {
    expect(t("msg.loginHeroTitle", "ko-KR")).toBe("운영 중심 NAS 워크스페이스");
    expect(t("msg.filesDescription", "ko-KR")).toBe(
      "요약 카드, 메인 데이터 영역, 보조 패널을 사용해 반복적인 파일 작업을 빠르게 처리하세요.",
    );
    expect(t("err.notFound", "ko-KR")).toBe("항목을 찾을 수 없습니다.");
    expect(t("action.upload", "ko-KR")).toBe("업로드");
    expect(t("nav.media", "ko-KR")).toBe("미디어");
  });

  it("returns clean English copy for high-visibility runtime strings", () => {
    expect(t("msg.searchHeroTitle", "en-US")).toBe("Fast search with path context");
    expect(t("modal.share.title", "en-US")).toBe("Share");
    expect(t("action.refresh", "en-US")).toBe("Refresh");
  });

  it("returns clean Korean copy for admin chrome and settings labels", () => {
    expect(t("admin.audit.column.action", "ko-KR")).toBe("동작");
    expect(t("admin.appearance.themeDark", "ko-KR")).toBe("다크");
    expect(t("admin.users.title", "ko-KR")).toBe("사용자 및 초대");
  });

  it("does not expose broken glyph patterns through runtime translation on high-surface keys", () => {
    for (const key of runtimeCoverageKeys) {
      expect(hasBrokenGlyphs(t(key, "ko-KR"))).toBe(false);
      expect(hasBrokenGlyphs(t(key, "en-US"))).toBe(false);
    }
  });
});

import type { BreadcrumbItem, NodeItem } from "../api/nodes";

export type UserIdentity = {
  id: string;
  username?: string;
  display_name?: string;
};

export function formatOwnerLabel(
  ownerUserId: string | null | undefined,
  currentUser: UserIdentity | null,
  userDirectory: Map<string, string>,
) {
  if (!ownerUserId) return "-";
  const directoryMatch = userDirectory.get(ownerUserId);
  if (directoryMatch) return directoryMatch;
  if (currentUser && currentUser.id === ownerUserId) {
    return currentUser.username || currentUser.display_name || ownerUserId;
  }
  return ownerUserId;
}

export function buildDisplayPath(
  basePath: string | null | undefined,
  breadcrumbItems: BreadcrumbItem[] | null | undefined,
) {
  const normalizedBasePath = normalizeBasePath(basePath);
  const names = (breadcrumbItems ?? []).slice(1).map((item) => item.name).filter(Boolean);
  return appendPathSegments(normalizedBasePath, names);
}

export function buildChildDisplayPath(parentPath: string | null | undefined, childName: string) {
  if (!childName) return normalizeBasePath(parentPath);
  return appendPathSegments(normalizeBasePath(parentPath), [childName]);
}

const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif", "avif"]);
const videoExtensions = new Set(["mp4", "mov", "avi", "mkv", "webm", "m4v"]);

export function getNodePreviewKind(item: NodeItem): "image" | "video" | null {
  if (item.type !== "FILE") return null;

  const mimeType = item.mime_type?.toLowerCase() ?? "";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";

  const extension = item.name.split(".").pop()?.toLowerCase() ?? "";
  if (imageExtensions.has(extension)) return "image";
  if (videoExtensions.has(extension)) return "video";
  return null;
}

function appendPathSegments(basePath: string, segments: string[]) {
  if (!segments.length) return basePath;
  const separator = basePath.includes("\\") ? "\\" : "/";
  const trimmedBase = basePath.endsWith(separator) ? basePath.slice(0, -1) : basePath;
  return [trimmedBase, ...segments].filter(Boolean).join(separator);
}

function normalizeBasePath(basePath: string | null | undefined) {
  if (!basePath) return "/";
  return basePath.trim() || "/";
}

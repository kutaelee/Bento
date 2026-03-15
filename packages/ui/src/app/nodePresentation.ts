import type { BreadcrumbItem } from "../api/nodes";

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

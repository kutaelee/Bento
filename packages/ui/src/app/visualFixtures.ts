import type { components } from "../api/schema";

export const ROOT_NODE_ID = "00000000-0000-0000-0000-000000000001";

const SAMPLE_FOLDER_ID = "11111111-1111-1111-1111-111111111111";
const SAMPLE_IMAGE_ID = "22222222-2222-2222-2222-222222222222";
const SAMPLE_FILE_ID = "33333333-3333-3333-3333-333333333333";
const SAMPLE_TRASH_ID = "44444444-4444-4444-4444-444444444444";
const SAMPLE_USER_ID = "55555555-5555-5555-5555-555555555555";
const SAMPLE_CHILD_FILE_ID = "66666666-6666-6666-6666-666666666666";
const SAMPLE_VIDEO_ID = "77777777-7777-7777-7777-777777777777";
const PRIMARY_VOLUME_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ONE_TEBIBYTE = 1024 ** 4;

type NodeItem = components["schemas"]["Node"];
type Job = components["schemas"]["Job"];
type PerformanceState = components["schemas"]["PerformanceState"];
type SystemMode = components["schemas"]["SystemMode"];
type User = components["schemas"]["User"];
type Invite = components["schemas"]["Invite"];
type ShareLink = components["schemas"]["ShareLink"];
type UploadStatus = components["schemas"]["UploadStatus"];
type VolumeItem = components["schemas"]["Volume"] & {
  scan_state?: "queued" | "running" | "succeeded" | "failed";
  scan_job_id?: string | null;
  scan_progress?: number | null;
  scan_error?: string | null;
  scan_updated_at?: string | null;
};

type UploadRecord = {
  upload_id: string;
  parent_id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number;
  chunk_size_bytes: number;
  total_chunks: number;
  received_chunks: number[];
  status: UploadStatus;
  created_at: string;
  updated_at: string;
};

type VisualContext = {
  seed: string | null;
  visualState: string | null;
  fixturesEnabled: boolean;
};

type VisualStore = {
  rootChildren: NodeItem[];
  folderChildren: NodeItem[];
  trashItems: NodeItem[];
  invites: Invite[];
  jobs: Job[];
  volumes: VolumeItem[];
  preferences: User;
  shareLinks: Record<string, ShareLink[]>;
  pendingThumbnailIds: Set<string>;
  uploads: Record<string, UploadRecord>;
  systemMode: SystemMode;
  performance: PerformanceState;
};

const nowIso = () => new Date().toISOString();

const makeNode = (overrides: Partial<NodeItem> & Pick<NodeItem, "id" | "type" | "name" | "parent_id" | "path">): NodeItem => {
  const now = nowIso();
  return {
    created_at: now,
    updated_at: now,
    size_bytes: 0,
    mime_type: null,
    owner_user_id: SAMPLE_USER_ID,
    deleted_at: null,
    ...overrides,
  };
};

const makeRootChildren = (): NodeItem[] => [
  makeNode({
    id: SAMPLE_FOLDER_ID,
    type: "FOLDER",
    name: "Design Library",
    parent_id: ROOT_NODE_ID,
    path: "root.design",
  }),
  makeNode({
    id: SAMPLE_FILE_ID,
    type: "FILE",
    name: "Weekly-Report.pdf",
    parent_id: ROOT_NODE_ID,
    path: "root.report",
    size_bytes: 482000,
    mime_type: "application/pdf",
  }),
  makeNode({
    id: SAMPLE_IMAGE_ID,
    type: "FILE",
    name: "Campaign-Image.jpg",
    parent_id: ROOT_NODE_ID,
    path: "root.media.banner",
    size_bytes: 1240000,
    mime_type: "image/jpeg",
  }),
  makeNode({
    id: SAMPLE_VIDEO_ID,
    type: "FILE",
    name: "Brand-Demo.mp4",
    parent_id: ROOT_NODE_ID,
    path: "root.media.demo",
    size_bytes: 5242880,
    mime_type: "video/mp4",
  }),
];

const makeFolderChildren = (): NodeItem[] => [
  makeNode({
    id: SAMPLE_CHILD_FILE_ID,
    type: "FILE",
    name: "Project-Brief.docx",
    parent_id: SAMPLE_FOLDER_ID,
    path: "root.design.brief",
    size_bytes: 128000,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }),
];

const makeTrashItems = (): NodeItem[] => [
  makeNode({
    id: SAMPLE_TRASH_ID,
    type: "FILE",
    name: "Trash-Sample.txt",
    parent_id: ROOT_NODE_ID,
    path: "root.trash.sample",
    size_bytes: 4100,
    mime_type: "text/plain",
    deleted_at: nowIso(),
  }),
];

const makeSampleUser = (): User => ({
  id: SAMPLE_USER_ID,
  username: "admin",
  display_name: "Admin",
  role: "ADMIN",
  locale: "ko-KR",
  created_at: nowIso(),
  last_login_at: nowIso(),
});

const SAMPLE_TOKENS = {
  token_type: "Bearer" as const,
  access_token: "visual-access-token",
  refresh_token: "visual-refresh-token",
  expires_in_seconds: 3600,
};

const makeBaseJobs = (): Job[] => [
  {
    id: "88888888-8888-8888-8888-888888888888",
    type: "SCAN_CLEANUP",
    status: "SUCCEEDED",
    progress: 1,
    created_at: nowIso(),
    started_at: nowIso(),
    finished_at: nowIso(),
  },
  {
    id: "99999999-9999-9999-9999-999999999999",
    type: "MIGRATION",
    status: "RUNNING",
    progress: 0.42,
    created_at: nowIso(),
    started_at: nowIso(),
    finished_at: null,
  },
];

const makeBaseVolumes = (): VolumeItem[] => [
  {
    id: PRIMARY_VOLUME_ID,
    name: "Main volume",
    base_path: "/mnt/bento-main",
    is_active: true,
    status: "OK",
    fs_type: "ext4",
    free_bytes: 640 * 1024 ** 3,
    total_bytes: ONE_TEBIBYTE,
    created_at: nowIso(),
    scan_state: "succeeded",
    scan_job_id: "88888888-8888-8888-8888-888888888888",
    scan_progress: 1,
    scan_updated_at: nowIso(),
  },
];

const makePerformance = (): PerformanceState => ({
  profile: "BALANCED",
  limits: {
    bg_worker_concurrency_max: 2,
    thumbnail_rps_max: 14,
    transcode_concurrency_max: 2,
  },
  pressure: {
    cpu_percent: 42,
    iowait_percent: 3,
    mem_available_bytes: 8 * 1024 ** 3,
    api_p95_ms: 120,
  },
  allowed: {
    bg_worker_concurrency: 2,
    thumbnail_rps: 12,
    transcode_concurrency: 2,
    notes: "visual-fixture",
  },
});

const createStore = (): VisualStore => ({
  rootChildren: makeRootChildren(),
  folderChildren: makeFolderChildren(),
  trashItems: makeTrashItems(),
  invites: [],
  jobs: makeBaseJobs(),
  volumes: makeBaseVolumes(),
  preferences: makeSampleUser(),
  shareLinks: {},
  pendingThumbnailIds: new Set([SAMPLE_IMAGE_ID, SAMPLE_VIDEO_ID]),
  uploads: {},
  systemMode: {
    read_only: false,
    updated_at: nowIso(),
  },
  performance: makePerformance(),
});

let store = createStore();

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const parseBody = (body?: BodyInit | null) => {
  if (!body || typeof body !== "string") return null;
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(16).slice(2, 10)}-${Date.now()}`;

const getVisualContext = (): VisualContext => {
  if (typeof window === "undefined") {
    return { seed: null, visualState: null, fixturesEnabled: false };
  }

  const params = new URLSearchParams(window.location.search);
  const queryEnabled = params.get("visualFixtures") === "1" || params.get("visualFixtures") === "true";
  const fixturesEnabled = queryEnabled;

  return {
    seed: params.get("seed") ?? (fixturesEnabled ? "local-preview" : null),
    visualState: fixturesEnabled ? params.get("visualState") : null,
    fixturesEnabled,
  };
};

export const getVisualSeed = () => getVisualContext().seed;

export const getVisualState = () => getVisualContext().visualState;

export const isVisualFixtureEnabled = () => getVisualContext().fixturesEnabled;

export const getVisualFixtureSearch = (search = typeof window !== "undefined" ? window.location.search : "") => {
  const params = new URLSearchParams(search);
  const preserved = new URLSearchParams();
  for (const key of ["visualFixtures", "visualState", "seed"]) {
    const value = params.get(key);
    if (value) {
      preserved.set(key, value);
    }
  }
  const next = preserved.toString();
  return next ? `?${next}` : "";
};

const getAllActiveNodes = () => [...store.rootChildren, ...store.folderChildren];

const findNode = (nodeId: string) => getAllActiveNodes().find((node) => node.id === nodeId) ?? null;

const findAnyNode = (nodeId: string) => findNode(nodeId) ?? store.trashItems.find((node) => node.id === nodeId) ?? null;

const getChildrenArray = (parentId: string) => {
  if (parentId === ROOT_NODE_ID) return store.rootChildren;
  if (parentId === SAMPLE_FOLDER_ID) return store.folderChildren;
  return store.rootChildren;
};

const upsertNode = (node: NodeItem) => {
  const collection = getChildrenArray(node.parent_id);
  const index = collection.findIndex((item) => item.id === node.id);
  if (index >= 0) {
    collection[index] = node;
    return;
  }
  collection.unshift(node);
};

const removeNode = (nodeId: string) => {
  store.rootChildren = store.rootChildren.filter((item) => item.id !== nodeId);
  store.folderChildren = store.folderChildren.filter((item) => item.id !== nodeId);
};

const cloneNode = (node: NodeItem, overrides: Partial<NodeItem>): NodeItem => ({
  ...node,
  ...overrides,
  updated_at: nowIso(),
});

const resolveChildren = (nodeId: string, visualState: string | null): NodeItem[] => {
  if (visualState === "empty") return [];
  const children = getChildrenArray(nodeId);
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  if (currentPath.endsWith("/media") || currentPath.includes("/media/")) {
    return children.filter((item) => {
      const mimeType = item.mime_type ?? "";
      return mimeType.startsWith("image/") || mimeType.startsWith("video/");
    });
  }
  return children;
};

const getNodeForId = (nodeId: string): NodeItem =>
  findAnyNode(nodeId) ??
  makeNode({
    id: nodeId,
    type: "FOLDER",
    name: "폴더",
    parent_id: ROOT_NODE_ID,
    path: "root.folder",
  });

const searchNodes = (query: string, type: string | null) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return getAllActiveNodes().filter((item) => {
    if (type && item.type !== type) return false;
    const haystack = [item.name, item.path, item.mime_type ?? ""].join(" ").toLowerCase();
    return haystack.includes(normalized);
  });
};

const makeShareLink = (nodeId: string, payload: Record<string, unknown> | null): ShareLink => {
  const link: ShareLink = {
    id: makeId("share"),
    token: makeId("token"),
    node_id: nodeId,
    created_at: nowIso(),
    expires_at: new Date(Date.now() + Number(payload?.expires_in_seconds ?? 7 * 86400) * 1000).toISOString(),
    permission: payload?.permission === "READ_WRITE" ? "READ_WRITE" : "READ",
    password_required: Boolean(payload?.password),
  };

  store.shareLinks[nodeId] = [link, ...(store.shareLinks[nodeId] ?? [])];
  return link;
};

const makeBlobResponse = (content: BlobPart, type: string) =>
  new Response(new Blob([content], { type }), {
    status: 200,
    headers: { "content-type": type },
  });

const FIXTURE_VIDEO_WEBM_BASE64 =
  "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";

const decodeFixtureVideo = () =>
  Uint8Array.from(atob(FIXTURE_VIDEO_WEBM_BASE64), (character) => character.charCodeAt(0));

const makeThumbnailResponse = (node: NodeItem) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#dbeafe" />
      <rect x="32" y="32" width="576" height="296" rx="24" fill="#2563eb" opacity="0.18" />
      <text x="48" y="176" fill="#0f172a" font-size="32" font-family="Arial, sans-serif">${node.name}</text>
    </svg>
  `.trim();
  return makeBlobResponse(svg, "image/svg+xml");
};

const makeDownloadResponse = (node: NodeItem) => {
  const mimeType = node.mime_type ?? "application/octet-stream";
  if (mimeType.startsWith("image/")) return makeThumbnailResponse(node);
  if (mimeType.startsWith("video/")) return makeBlobResponse(decodeFixtureVideo(), "video/webm");
  const content = node.type === "FOLDER" ? `${node.name}\n` : `fixture:${node.name}\n`;
  return makeBlobResponse(content, mimeType);
};

const createUploadRecord = (payload: Record<string, unknown> | null): UploadRecord => {
  const sizeBytes = Number(payload?.size_bytes ?? 0);
  const chunkSize = Math.min(Math.max(1024 * 1024, sizeBytes || 1024 * 1024), 8 * 1024 * 1024);
  const totalChunks = Math.max(1, Math.ceil(sizeBytes / chunkSize));
  const createdAt = nowIso();
  return {
    upload_id: makeId("upload"),
    parent_id: String(payload?.parent_id ?? ROOT_NODE_ID),
    filename: String(payload?.filename ?? "업로드.bin"),
    mime_type: typeof payload?.mime_type === "string" ? payload.mime_type : null,
    size_bytes: sizeBytes,
    chunk_size_bytes: chunkSize,
    total_chunks: totalChunks,
    received_chunks: [],
    status: "INIT",
    created_at: createdAt,
    updated_at: createdAt,
  };
};

const completeUpload = (upload: UploadRecord) => {
  const extension = upload.filename.includes(".") ? upload.filename.split(".").pop()?.toLowerCase() : "";
  const node = makeNode({
    id: makeId("node"),
    type: "FILE",
    name: upload.filename,
    parent_id: upload.parent_id,
    path: `upload.${extension || "bin"}`,
    size_bytes: upload.size_bytes,
    mime_type: upload.mime_type,
  });
  upsertNode(node);
  delete store.uploads[upload.upload_id];
  return {
    node_id: node.id,
    blob_id: makeId("blob"),
    sha256: makeId("sha"),
    size_bytes: upload.size_bytes,
  };
};

const normalizeFixturePath = (pathname: string) => {
  if (pathname === "/bento") return "/";
  if (pathname.startsWith("/bento/")) return pathname.slice("/bento".length);
  return pathname;
};

const getFixtureResponse = (pathname: string, method: string, searchParams: URLSearchParams, body: BodyInit | null | undefined) => {
  const path = normalizeFixturePath(pathname);
  const { visualState } = getVisualContext();
  const parsed = parseBody(body);

  if (path === "/setup/status" && method === "GET") return jsonResponse({ setup_required: true });
  if (path === "/setup/admin" && method === "POST") return jsonResponse({ user: store.preferences, tokens: SAMPLE_TOKENS });
  if (path === "/auth/login" && method === "POST") return jsonResponse({ user: store.preferences, tokens: SAMPLE_TOKENS });
  if (path === "/auth/accept-invite" && method === "POST") return jsonResponse({ user: store.preferences, tokens: SAMPLE_TOKENS });
  if (path === "/auth/refresh" && method === "POST") return jsonResponse(SAMPLE_TOKENS);
  if (path === "/auth/logout" && method === "POST") return new Response(null, { status: 204 });

  if (path === "/me" && method === "GET") return jsonResponse(store.preferences);
  if (path === "/me/preferences" && method === "GET") return jsonResponse(store.preferences);
  if (path === "/me/preferences" && method === "PATCH") {
    store.preferences = {
      ...store.preferences,
      locale: parsed?.locale === "en-US" ? "en-US" : "ko-KR",
    };
    return jsonResponse(store.preferences);
  }

  if (path === "/admin/users" && method === "GET") return jsonResponse({ items: [store.preferences] });
  if (path === "/admin/invites" && method === "POST") {
    const invite: Invite = {
      id: makeId("invite"),
      token: "visual-invite-token",
      expires_at: new Date(Date.now() + Number(parsed?.expires_in_seconds ?? 7 * 86400) * 1000).toISOString(),
      created_at: nowIso(),
      used_at: null,
    };
    store.invites.unshift(invite);
    return jsonResponse(invite);
  }

  if (path === "/admin/volumes" && method === "GET") return jsonResponse({ items: store.volumes });
  if (path === "/admin/volumes" && method === "POST") {
    const volume: VolumeItem = {
      id: makeId("volume"),
      name: String(parsed?.name ?? "신규 볼륨"),
      base_path: String(parsed?.base_path ?? "/mnt/new-volume"),
      is_active: false,
      status: "OK",
      fs_type: "ext4",
      free_bytes: 500 * 1024 ** 3,
      total_bytes: ONE_TEBIBYTE,
      created_at: nowIso(),
    };
    store.volumes.unshift(volume);
    return jsonResponse(volume);
  }
  if (path === "/admin/volumes/validate-path" && method === "POST") {
    return jsonResponse({
      ok: true,
      writable: true,
      free_bytes: 512 * 1024 ** 3,
      total_bytes: ONE_TEBIBYTE,
      fs_type: "ext4",
      message: "OK",
    });
  }
  if (path.startsWith("/admin/volumes/") && path.endsWith("/activate") && method === "POST") {
    const volumeId = path.split("/")[3];
    store.volumes = store.volumes.map((volume) => ({ ...volume, is_active: volume.id === volumeId }));
    return jsonResponse(store.volumes.find((volume) => volume.id === volumeId) ?? store.volumes[0]);
  }
  if (path.startsWith("/admin/volumes/") && path.endsWith("/deactivate") && method === "POST") {
    const volumeId = path.split("/")[3];
    store.volumes = store.volumes.map((volume) => (volume.id === volumeId ? { ...volume, is_active: false } : volume));
    return jsonResponse(store.volumes.find((volume) => volume.id === volumeId) ?? store.volumes[0]);
  }
  if (path.startsWith("/admin/volumes/") && method === "DELETE") {
    const volumeId = path.split("/")[3];
    store.volumes = store.volumes.filter((volume) => volume.id !== volumeId);
    return jsonResponse({ ok: true });
  }
  if (path.startsWith("/admin/volumes/") && path.endsWith("/scan") && method === "POST") {
    const volumeId = path.split("/")[3];
    const job: Job = {
      id: makeId("job"),
      type: "SCAN_CLEANUP",
      status: "RUNNING",
      progress: 0.35,
      created_at: nowIso(),
      started_at: nowIso(),
      finished_at: null,
    };
    store.jobs.unshift(job);
    store.volumes = store.volumes.map((volume) =>
      volume.id === volumeId
        ? {
            ...volume,
            scan_state: "running",
            scan_job_id: job.id,
            scan_progress: job.progress ?? 0.35,
            scan_updated_at: nowIso(),
          }
        : volume,
    );
    return jsonResponse(job);
  }

  if (path === "/jobs" && method === "GET") return jsonResponse({ items: store.jobs, next_cursor: null });
  if (path.startsWith("/jobs/") && method === "GET") {
    const jobId = path.split("/")[2];
    return jsonResponse(store.jobs.find((item) => item.id === jobId) ?? store.jobs[0]);
  }

  if (path === "/admin/migrations" && method === "POST") {
    const job: Job = {
      id: makeId("migration"),
      type: "MIGRATION",
      status: "RUNNING",
      progress: 0.15,
      created_at: nowIso(),
      started_at: nowIso(),
      finished_at: null,
      payload: parsed ?? {},
    };
    store.jobs.unshift(job);
    return jsonResponse(job);
  }

  if (path === "/admin/storage/scan" && method === "POST") {
    const job: Job = {
      id: makeId("cleanup"),
      type: "SCAN_CLEANUP",
      status: "RUNNING",
      progress: 0.2,
      created_at: nowIso(),
      started_at: nowIso(),
      finished_at: null,
      payload: parsed ?? {},
    };
    store.jobs.unshift(job);
    store.volumes = store.volumes.map((volume, index) =>
      index === 0
        ? {
            ...volume,
            scan_state: "running",
            scan_job_id: job.id,
            scan_progress: 0.2,
            scan_updated_at: nowIso(),
          }
        : volume,
    );
    return jsonResponse(job);
  }

  if (path === "/admin/system-mode" && method === "GET") return jsonResponse(store.systemMode);
  if (path === "/admin/system-mode" && method === "PATCH") {
    store.systemMode = {
      read_only: Boolean(parsed?.read_only),
      updated_at: nowIso(),
    };
    return jsonResponse(store.systemMode);
  }

  if (path === "/system/performance" && method === "GET") return jsonResponse(store.performance);
  if (path === "/system/performance" && method === "PATCH") {
    store.performance = {
      ...store.performance,
      profile: (parsed?.profile as PerformanceState["profile"] | undefined) ?? store.performance.profile,
      limits: {
        ...store.performance.limits,
        ...(typeof parsed?.limits === "object" && parsed.limits ? parsed.limits : {}),
      },
      allowed: {
        ...store.performance.allowed,
        ...(typeof parsed?.allowed === "object" && parsed.allowed ? parsed.allowed : {}),
      },
    };
    return jsonResponse(store.performance);
  }

  if (path === "/uploads" && method === "POST") {
    const upload = createUploadRecord(parsed);
    store.uploads[upload.upload_id] = upload;
    return jsonResponse(upload, 201);
  }
  if (path.startsWith("/uploads/") && path.includes("/chunks/") && method === "PUT") {
    const [, , uploadId, , chunkIndexText] = path.split("/");
    const upload = store.uploads[uploadId];
    if (!upload) return jsonResponse({ message: "upload not found" }, 404);

    const chunkIndex = Number(chunkIndexText);
    if (!upload.received_chunks.includes(chunkIndex)) {
      upload.received_chunks.push(chunkIndex);
    }
    upload.status = upload.received_chunks.length >= upload.total_chunks ? "MERGING" : "UPLOADING";
    upload.updated_at = nowIso();
    return jsonResponse(upload);
  }
  if (path.startsWith("/uploads/") && path.endsWith("/complete") && method === "POST") {
    const uploadId = path.split("/")[2];
    const upload = store.uploads[uploadId];
    if (!upload) return jsonResponse({ message: "upload not found" }, 404);
    upload.status = "COMPLETED";
    return jsonResponse(completeUpload(upload));
  }
  if (path.startsWith("/uploads/") && method === "DELETE") {
    const uploadId = path.split("/")[2];
    delete store.uploads[uploadId];
    return jsonResponse({ ok: true });
  }

  if (path === "/nodes/folders" && method === "POST") {
    const node = makeNode({
      id: makeId("folder"),
      type: "FOLDER",
      name: String(parsed?.name ?? "새 폴더"),
      parent_id: String(parsed?.parent_id ?? ROOT_NODE_ID),
      path: `folder.${makeId("path")}`,
    });
    upsertNode(node);
    return jsonResponse(node);
  }

  if (path.startsWith("/nodes/") && path.endsWith("/rename") && method === "POST") {
    const nodeId = path.split("/")[2];
    const node = findNode(nodeId);
    if (!node) return jsonResponse({ message: "not found" }, 404);
    const renamed = cloneNode(node, { name: String(parsed?.new_name ?? node.name) });
    upsertNode(renamed);
    return jsonResponse(renamed);
  }

  if (path.startsWith("/nodes/") && path.endsWith("/move") && method === "POST") {
    const nodeId = path.split("/")[2];
    const node = findNode(nodeId);
    if (!node) return jsonResponse({ message: "not found" }, 404);
    removeNode(nodeId);
    const moved = cloneNode(node, {
      parent_id: String(parsed?.destination_parent_id ?? ROOT_NODE_ID),
      name: typeof parsed?.new_name === "string" ? String(parsed.new_name) : node.name,
    });
    upsertNode(moved);
    return jsonResponse(moved);
  }

  if (path.startsWith("/nodes/") && path.endsWith("/copy") && method === "POST") {
    const nodeId = path.split("/")[2];
    const node = findNode(nodeId);
    if (!node) return jsonResponse({ message: "not found" }, 404);
    const copied = cloneNode(node, {
      id: makeId("copy"),
      parent_id: String(parsed?.destination_parent_id ?? ROOT_NODE_ID),
      name: typeof parsed?.new_name === "string" ? String(parsed.new_name) : `${node.name} copy`,
    });
    upsertNode(copied);
    return jsonResponse(copied);
  }

  if (path.startsWith("/nodes/") && path.endsWith("/share-links") && method === "POST") {
    const nodeId = path.split("/")[2];
    return jsonResponse(makeShareLink(nodeId, parsed));
  }
  if (path.startsWith("/nodes/") && path.includes("/share-links/") && method === "DELETE") {
    const [, , nodeId, , shareLinkId] = path.split("/");
    store.shareLinks[nodeId] = (store.shareLinks[nodeId] ?? []).filter((item) => item.id !== shareLinkId);
    return jsonResponse({ ok: true });
  }

  if (path.startsWith("/nodes/") && path.endsWith("/children") && method === "GET") {
    if (visualState === "error") return jsonResponse({ message: "forbidden" }, 403);
    const nodeId = path.split("/")[2];
    return jsonResponse({ items: resolveChildren(nodeId, visualState), next_cursor: null });
  }

  if (path.startsWith("/nodes/") && path.endsWith("/breadcrumb") && method === "GET") {
    const nodeId = path.split("/")[2];
    const node = getNodeForId(nodeId);
    const items =
      node.parent_id === ROOT_NODE_ID
        ? [
            { id: ROOT_NODE_ID, name: "Files" },
            { id: node.id, name: node.name },
          ]
        : [
            { id: ROOT_NODE_ID, name: "Files" },
            { id: SAMPLE_FOLDER_ID, name: "Design Library" },
            { id: node.id, name: node.name },
          ];
    return jsonResponse({ items });
  }

  if (path.startsWith("/nodes/") && path.endsWith("/download") && method === "GET") {
    const nodeId = path.split("/")[2];
    const node = getNodeForId(nodeId);
    return makeDownloadResponse(node);
  }

  if (path.startsWith("/nodes/") && method === "DELETE") {
    const nodeId = path.split("/")[2];
    const node = findNode(nodeId);
    if (!node) return jsonResponse({ ok: true });
    removeNode(nodeId);
    store.trashItems.unshift({
      ...cloneNode(node, { deleted_at: nowIso() }),
      deleted_at: nowIso(),
    });
    return jsonResponse({ ok: true });
  }

  if (path.startsWith("/nodes/") && method === "GET") {
    const nodeId = path.split("/")[2];
    return jsonResponse(getNodeForId(nodeId));
  }

  if (path === "/trash" && method === "GET") {
    if (visualState === "error") return jsonResponse({ message: "forbidden" }, 403);
    return jsonResponse({ items: visualState === "empty" ? [] : store.trashItems, next_cursor: null });
  }
  if (path.startsWith("/trash/") && path.endsWith("/restore") && method === "POST") {
    const nodeId = path.split("/")[2];
    const node = store.trashItems.find((item) => item.id === nodeId);
    if (!node) return jsonResponse({ message: "not found" }, 404);
    store.trashItems = store.trashItems.filter((item) => item.id !== nodeId);
    const restored = cloneNode(node, { deleted_at: null, parent_id: ROOT_NODE_ID });
    upsertNode(restored);
    return jsonResponse(restored);
  }
  if (path.startsWith("/trash/") && method === "DELETE") {
    const nodeId = path.split("/")[2];
    store.trashItems = store.trashItems.filter((item) => item.id !== nodeId);
    return jsonResponse({ ok: true });
  }

  if (path === "/search" && method === "GET") {
    const query = searchParams.get("q") ?? "";
    const type = searchParams.get("type");
    return jsonResponse({ items: searchNodes(query, type), next_cursor: null });
  }

  if (path.startsWith("/media/") && path.endsWith("/thumbnail") && method === "GET") {
    const nodeId = path.split("/")[2];
    const node = getNodeForId(nodeId);
    if (store.pendingThumbnailIds.has(nodeId)) {
      store.pendingThumbnailIds.delete(nodeId);
      return new Response(null, { status: 202 });
    }
    return makeThumbnailResponse(node);
  }

  return null;
};

export const installVisualFixtures = () => {
  if (typeof window === "undefined") return;
  if (!isVisualFixtureEnabled()) return;

  const key = "__visualFixturesInstalled";
  if ((window as unknown as Record<string, boolean>)[key]) return;

  store = createStore();
  (window as unknown as Record<string, boolean>)[key] = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const urlString =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = new URL(urlString, window.location.origin);
    const fixture = getFixtureResponse(url.pathname, method, url.searchParams, init?.body ?? null);
    if (fixture) {
      return fixture;
    }
    return originalFetch(input, init);
  };
};

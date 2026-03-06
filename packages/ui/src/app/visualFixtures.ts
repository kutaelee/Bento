import type { components } from "../api/schema";

const ROOT_NODE_ID = "00000000-0000-0000-0000-000000000001";
const SAMPLE_FOLDER_ID = "11111111-1111-1111-1111-111111111111";
const SAMPLE_MEDIA_ID = "22222222-2222-2222-2222-222222222222";
const SAMPLE_FILE_ID = "33333333-3333-3333-3333-333333333333";
const SAMPLE_TRASH_ID = "44444444-4444-4444-4444-444444444444";
const SAMPLE_USER_ID = "55555555-5555-5555-5555-555555555555";

const nowIso = () => new Date().toISOString();

type NodeItem = components["schemas"]["Node"];
type Job = components["schemas"]["Job"];
type Volume = components["schemas"]["Volume"];
type PerformanceState = components["schemas"]["PerformanceState"];
type SystemMode = components["schemas"]["SystemMode"];
type User = components["schemas"]["User"];
type Invite = components["schemas"]["Invite"];

type VisualContext = {
  seed: string | null;
  visualState: string | null;
  fixturesEnabled: boolean;
};

const makeNode = (overrides: Partial<NodeItem> & Pick<NodeItem, "id" | "type" | "name" | "parent_id" | "path">): NodeItem => {
  const now = nowIso();
  return {
    created_at: now,
    updated_at: now,
    size_bytes: 0,
    mime_type: null,
    owner_user_id: SAMPLE_USER_ID,
    ...overrides,
  };
};

const ROOT_CHILDREN: NodeItem[] = [
  makeNode({
    id: SAMPLE_FOLDER_ID,
    type: "FOLDER",
    name: "디자인",
    parent_id: ROOT_NODE_ID,
    path: "root.design",
  }),
  makeNode({
    id: SAMPLE_FILE_ID,
    type: "FILE",
    name: "월간보고서.pdf",
    parent_id: ROOT_NODE_ID,
    path: "root.report",
    size_bytes: 482000,
    mime_type: "application/pdf",
  }),
  makeNode({
    id: SAMPLE_MEDIA_ID,
    type: "FILE",
    name: "캠핑_앨범.jpg",
    parent_id: ROOT_NODE_ID,
    path: "root.media",
    size_bytes: 1240000,
    mime_type: "image/jpeg",
  }),
];

const FOLDER_CHILDREN: NodeItem[] = [
  makeNode({
    id: "66666666-6666-6666-6666-666666666666",
    type: "FILE",
    name: "프로젝트_브리프.docx",
    parent_id: SAMPLE_FOLDER_ID,
    path: "root.design.brief",
    size_bytes: 128000,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }),
];

const TRASH_ITEMS: NodeItem[] = [
  makeNode({
    id: SAMPLE_TRASH_ID,
    type: "FILE",
    name: "삭제된_샘플.txt",
    parent_id: ROOT_NODE_ID,
    path: "root.trash.sample",
    size_bytes: 4100,
    mime_type: "text/plain",
    deleted_at: nowIso(),
  }),
];

const SAMPLE_USER: User = {
  id: SAMPLE_USER_ID,
  username: "admin",
  display_name: "관리자",
  role: "ADMIN",
  locale: "ko-KR",
  created_at: nowIso(),
  last_login_at: nowIso(),
};

const SAMPLE_INVITE: Invite = {
  id: "77777777-7777-7777-7777-777777777777",
  token: "visual-invite-token",
  expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  created_at: nowIso(),
};

const SAMPLE_TOKENS = {
  token_type: "Bearer" as const,
  access_token: "visual-access-token",
  refresh_token: "visual-refresh-token",
  expires_in_seconds: 3600,
};

const SAMPLE_JOBS: Job[] = [
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
  },
];

const SAMPLE_VOLUMES: Volume[] = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    name: "메인 볼륨",
    base_path: "/mnt/nimbus-data",
    is_active: true,
    status: "OK",
    fs_type: "ext4",
    free_bytes: 2400 * 1024 * 1024 * 1024,
    total_bytes: 4000 * 1024 * 1024 * 1024,
    created_at: nowIso(),
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    name: "백업 볼륨",
    base_path: "/mnt/nimbus-backup",
    is_active: false,
    status: "DEGRADED",
    fs_type: "ext4",
    free_bytes: 800 * 1024 * 1024 * 1024,
    total_bytes: 2000 * 1024 * 1024 * 1024,
    created_at: nowIso(),
  },
];

const SAMPLE_PERFORMANCE: PerformanceState = {
  profile: "BALANCED",
  limits: {
    bg_worker_concurrency_max: 2,
    thumbnail_rps_max: 14,
    transcode_concurrency_max: 2,
  },
  pressure: {
    cpu_percent: 42,
    iowait_percent: 3,
    mem_available_bytes: 8 * 1024 * 1024 * 1024,
    api_p95_ms: 120,
  },
  allowed: {
    bg_worker_concurrency: 2,
    thumbnail_rps: 12,
    transcode_concurrency: 2,
    notes: "visual-fixture",
  },
};

const SAMPLE_SYSTEM_MODE: SystemMode = {
  read_only: false,
  updated_at: nowIso(),
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const parseBody = (body?: BodyInit | null) => {
  if (!body || typeof body !== "string") return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

const getVisualContext = (): VisualContext => {
  if (typeof window === "undefined") {
    return { seed: null, visualState: null, fixturesEnabled: false };
  }
  const params = new URLSearchParams(window.location.search);
  const fixturesEnabled = params.get("visualFixtures") === "1" || params.get("visualFixtures") === "true";
  return {
    seed: params.get("seed"),
    visualState: fixturesEnabled ? params.get("visualState") : null,
    fixturesEnabled,
  };
};

export const getVisualSeed = () => getVisualContext().seed;

export const getVisualState = () => getVisualContext().visualState;

export const isVisualFixtureEnabled = () => {
  const ctx = getVisualContext();
  return Boolean(ctx.seed) && ctx.fixturesEnabled;
};

const getNodeForId = (nodeId: string): NodeItem => {
  if (nodeId === SAMPLE_FOLDER_ID) {
    return makeNode({
      id: SAMPLE_FOLDER_ID,
      type: "FOLDER",
      name: "디자인",
      parent_id: ROOT_NODE_ID,
      path: "root.design",
    });
  }
  if (nodeId === SAMPLE_MEDIA_ID) {
    return makeNode({
      id: SAMPLE_MEDIA_ID,
      type: "FILE",
      name: "캠핑_앨범.jpg",
      parent_id: ROOT_NODE_ID,
      path: "root.media",
      size_bytes: 1240000,
      mime_type: "image/jpeg",
    });
  }
  return makeNode({
    id: nodeId,
    type: "FOLDER",
    name: "폴더",
    parent_id: ROOT_NODE_ID,
    path: "root.folder",
  });
};

const resolveChildren = (nodeId: string, visualState: string | null): NodeItem[] => {
  if (visualState === "empty") return [];
  if (nodeId === SAMPLE_FOLDER_ID) {
    return FOLDER_CHILDREN;
  }
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  if (currentPath === "/media") {
    return ROOT_CHILDREN.filter((item) => (item.mime_type ?? "").startsWith("image/"));
  }
  return ROOT_CHILDREN;
};

const getFixtureResponse = (path: string, method: string, searchParams: URLSearchParams, body: BodyInit | null | undefined) => {
  const { visualState } = getVisualContext();

  if (path === "/setup/status" && method === "GET") {
    return jsonResponse({ setup_required: true });
  }

  if (path === "/setup/admin" && method === "POST") {
    return jsonResponse({ user: SAMPLE_USER, tokens: SAMPLE_TOKENS });
  }

  if (path === "/auth/login" && method === "POST") {
    return jsonResponse({ user: SAMPLE_USER, tokens: SAMPLE_TOKENS });
  }

  if (path === "/auth/accept-invite" && method === "POST") {
    return jsonResponse({ user: SAMPLE_USER, tokens: SAMPLE_TOKENS });
  }

  if (path === "/auth/refresh" && method === "POST") {
    return jsonResponse(SAMPLE_TOKENS);
  }

  if (path === "/auth/logout" && method === "POST") {
    return new Response(null, { status: 204 });
  }

  if (path === "/me" && method === "GET") {
    return jsonResponse(SAMPLE_USER);
  }

  if (path === "/me/preferences" && method === "GET") {
    return jsonResponse(SAMPLE_USER);
  }

  if (path === "/me/preferences" && method === "PATCH") {
    const parsed = parseBody(body);
    return jsonResponse({ ...SAMPLE_USER, locale: parsed?.locale ?? SAMPLE_USER.locale });
  }

  if (path === "/admin/users" && method === "GET") {
    return jsonResponse({ items: [SAMPLE_USER] });
  }

  if (path === "/admin/invites" && method === "POST") {
    return jsonResponse(SAMPLE_INVITE);
  }

  if (path === "/admin/volumes" && method === "GET") {
    return jsonResponse({ items: SAMPLE_VOLUMES });
  }

  if (path === "/admin/volumes" && method === "POST") {
    const parsed = parseBody(body);
    return jsonResponse({
      ...SAMPLE_VOLUMES[0],
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      name: parsed?.name ?? "신규 볼륨",
      base_path: parsed?.base_path ?? "/mnt/new",
      is_active: false,
      status: "OK",
    });
  }

  if (path === "/admin/volumes/validate-path" && method === "POST") {
    return jsonResponse({
      ok: true,
      writable: true,
      free_bytes: 500 * 1024 * 1024 * 1024,
      total_bytes: 2000 * 1024 * 1024 * 1024,
      fs_type: "ext4",
      message: "OK",
    });
  }

  if (path.startsWith("/admin/volumes/") && path.endsWith("/activate") && method === "POST") {
    const volumeId = path.split("/")[3];
    const active = SAMPLE_VOLUMES.find((volume) => volume.id === volumeId) ?? SAMPLE_VOLUMES[0];
    return jsonResponse({ ...active, is_active: true });
  }

  if (path === "/jobs" && method === "GET") {
    return jsonResponse({ items: SAMPLE_JOBS, next_cursor: null });
  }

  if (path.startsWith("/jobs/") && method === "GET") {
    const jobId = path.split("/")[2];
    const job = SAMPLE_JOBS.find((item) => item.id === jobId) ?? SAMPLE_JOBS[0];
    return jsonResponse(job);
  }

  if (path === "/admin/migrations" && method === "POST") {
    return jsonResponse({ ...SAMPLE_JOBS[1], id: "dddddddd-dddd-dddd-dddd-dddddddddddd" });
  }

  if (path === "/admin/storage/scan" && method === "POST") {
    return jsonResponse({ ...SAMPLE_JOBS[0], id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee" });
  }

  if (path === "/admin/system-mode" && method === "GET") {
    return jsonResponse(SAMPLE_SYSTEM_MODE);
  }

  if (path === "/admin/system-mode" && method === "PATCH") {
    const parsed = parseBody(body);
    return jsonResponse({
      read_only: Boolean(parsed?.read_only),
      updated_at: nowIso(),
    });
  }

  if (path === "/system/performance" && method === "GET") {
    return jsonResponse(SAMPLE_PERFORMANCE);
  }

  if (path === "/system/performance" && method === "PATCH") {
    const parsed = parseBody(body);
    return jsonResponse({
      ...SAMPLE_PERFORMANCE,
      profile: parsed?.profile ?? SAMPLE_PERFORMANCE.profile,
      limits: {
        ...SAMPLE_PERFORMANCE.limits,
        ...(parsed?.limits ?? {}),
      },
      allowed: {
        ...SAMPLE_PERFORMANCE.allowed,
        ...(parsed?.allowed ?? {}),
      },
    });
  }

  if (path.startsWith("/nodes/") && path.endsWith("/children") && method === "GET") {
    if (visualState === "error") {
      return jsonResponse({ message: "forbidden" }, 403);
    }
    const nodeId = path.split("/")[2];
    return jsonResponse({ items: resolveChildren(nodeId, visualState), next_cursor: null });
  }

  if (path.startsWith("/nodes/") && path.endsWith("/breadcrumb") && method === "GET") {
    const nodeId = path.split("/")[2];
    return jsonResponse({
      items: [
        { id: ROOT_NODE_ID, name: "파일" },
        { id: nodeId, name: "디자인" },
      ],
    });
  }

  if (path.startsWith("/nodes/") && method === "GET") {
    const nodeId = path.split("/")[2];
    return jsonResponse(getNodeForId(nodeId));
  }

  if (path === "/trash" && method === "GET") {
    if (visualState === "error") {
      return jsonResponse({ message: "forbidden" }, 403);
    }
    return jsonResponse({ items: visualState === "empty" ? [] : TRASH_ITEMS, next_cursor: null });
  }

  if (path.startsWith("/trash/") && method === "POST") {
    return jsonResponse(TRASH_ITEMS[0]);
  }

  if (path.startsWith("/trash/") && method === "DELETE") {
    return jsonResponse({ ok: true });
  }

  if (path === "/search" && method === "GET") {
    const query = searchParams.get("q")?.trim() ?? "";
    const items = query ? ROOT_CHILDREN : [];
    return jsonResponse({ items, next_cursor: null });
  }

  return null;
};

export const installVisualFixtures = () => {
  if (typeof window === "undefined") return;
  if (!isVisualFixtureEnabled()) return;

  const key = "__visualFixturesInstalled";
  if ((window as unknown as Record<string, boolean>)[key]) return;
  (window as unknown as Record<string, boolean>)[key] = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const urlString = typeof input === "string"
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

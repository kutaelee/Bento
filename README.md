# Nimbus Drive

Self-hosted NAS web application for 1–5 users (personal/family). Upload, browse, download, and share files from any device with automatic performance tuning that keeps your PC responsive.

---

## Key Features

### Core

- **Web file explorer** — folder/file list, breadcrumb, virtual-scroll, list/grid views
- **Chunked & resumable uploads** — idempotent, dedup-aware (SHA-256 CAS), configurable chunk size
- **Downloads with Range support** — HTTP 206 partial content, 416 handling
- **Search** — PostgreSQL `pg_trgm`-based fuzzy/partial-match search
- **Trash & garbage collection** — soft-delete with configurable retention, automatic hard-delete + blob ref-count cleanup
- **Share links** — time-limited, optional password, READ or READ_WRITE permission
- **ACL** — per-node, inheritable, deny-by-default (USER / GROUP / SHARE_LINK principals)
- **Media thumbnails** — on-demand generation via background jobs (QoS-throttled)

### Admin

- **First-time setup** — one-time initial admin creation (`POST /setup/admin`)
- **Invite-only onboarding** — no public signup; admin creates invite tokens, users accept via `/invite/accept?token=`
- **Storage volumes** — register, validate, activate host paths; multi-volume support
- **Migration** — move blobs between volumes with optional SHA-256 verification
- **Storage scan / cleanup** — detect and optionally delete orphan files and DB rows
- **Background jobs dashboard** — THUMBNAIL, TRANSCODE, MIGRATION, TRASH_GC, SCAN_CLEANUP, MOVE_TREE
- **System read-only mode** — blocks all mutating API calls during maintenance/migration

### Reliability & Performance

- **Interactive-first QoS** — UI requests always have priority; background workers (thumbnails, transcode, GC, migration) auto-throttle based on CPU, IO-wait, memory, and API P95 latency
- **Startup reconciler** — on boot, cleans up stuck upload sessions (UPLOADING/MERGING) and expired INIT sessions
- **HDD spin-up grace** — configurable timeouts for slow-start storage
- **Idempotency** — `Idempotency-Key` header for POST operations

---

## Architecture Overview

```
┌────────────────────────────────────────────────────┐
│                    Clients                         │
│         (Web UI · Mobile · curl / SDK)             │
└──────────────────────┬─────────────────────────────┘
                       │ HTTP (port 8080)
┌──────────────────────▼─────────────────────────────┐
│                  API Server                        │
│   packages/ui  ·  src/http  ·  src/policy          │
│   (OpenAPI-driven routes + middleware)              │
├────────────────────────────────────────────────────┤
│                  Domain Layer                      │
│   src/db · src/policy · src/util                   │
│   (DDD Bounded Contexts — see below)               │
├────────────────────────────────────────────────────┤
│                  Workers / Jobs                    │
│   THUMBNAIL · TRANSCODE · MIGRATION                │
│   TRASH_GC · SCAN_CLEANUP · MOVE_TREE              │
├────────────────────────────────────────────────────┤
│        UI (packages/ui) + ui-kit (packages/ui-kit) │
│        Stitch-absorbed tokens/components           │
└──────────────────────┬─────────────────────────────┘
                       │
         ┌─────────────▼─────────────┐
         │   PostgreSQL 16+          │
         │   (ltree, pg_trgm)        │
         │   + Host File System      │
         └───────────────────────────┘
```

**DDD Bounded Contexts** (from the spec):

| Context | Responsibility |
|---|---|
| Identity & Access | Admin setup, login/refresh, invite-only signup, users, roles |
| Storage Volume | `base_path` management, validation, activation, migration, scan/cleanup |
| Drive Tree | Nodes (folder/file), tree traversal, move/copy, rename, trash |
| Upload | Sessions, chunking, idempotency, merge, crash recovery (reconciler) |
| Sharing | Share link creation, token verification, public download |
| Media | Thumbnail/preview pipeline, QoS-throttled |
| Jobs | Background job state machine, retries, concurrency control |
| Search | `pg_trgm`-based search, cursor pagination |

**SSOT-driven**: every endpoint, schema, error code, state machine, and DB index is defined in `openapi/openapi.yaml`. Implementation must satisfy that contract.

---

## Source of Truth (SSOT)

All design and implementation decisions trace back to these files, in strict priority order:

| Priority | File | Governs |
|---|---|---|
| 1 (highest) | `openapi/openapi.yaml` | API contract, schemas, error codes, state machines (`x-state-machines`), DB/indexes (`x-db`), constants (`x-constants`) |
| 2 | `docs/NAS_SelfHosted_DDD_Spec_FINAL.md` | Domain model, contexts, policies, default-value rationale |
| 3 | `docs/NAS_OpenClaw_Evidence_Playbook_FINAL.md` | Development roadmap (P0–P12), task rules, evidence requirements |
| 4 | `docs/NAS_OpenClaw_TDD_Addendum_FINAL.md` | Test/evidence format, pass/fail rules, CLI-based verification |
| 5 | `docs/NAS_OpenClaw_Evidence_Playbook_P13_UI_Refactor.md` | UI roadmap (P13–P19), refactoring, hardening tasks |
| 6 | `docs/ui/IA_NAV_SSOT.md` | Navigation structure, page routes, layout rules |
| 7 | `docs/ui/COPY_KEYS_SSOT.md` | UI copy/i18n key registry |

### How to change contracts safely

1. Write an ADR in `docs/ADR/` explaining the change.
2. Update `openapi/openapi.yaml` **first** (schemas, paths, `x-db`, `x-state-machines`, `x-constants` as needed).
3. If UI-related: update `docs/ui/IA_NAV_SSOT.md` and/or `docs/ui/COPY_KEYS_SSOT.md`.
4. Update the DDD Spec or Playbooks only if the domain model or task sequence changes.
5. Implement to satisfy the updated contract; write evidence (see [Evidence / Testing](#evidence--testing-tdd-addendum)).

> **Rule**: if implementation and SSOT disagree, the **implementation is wrong**. Fix the contract first (via the process above), then the code.

---

## Screenshots / UI

No screenshots are included in this README. The UI information architecture and navigation routes are fixed by `docs/ui/IA_NAV_SSOT.md`.

**Design references** live in `design/stitch/ko-kr_final/`:

| Subdirectory | Content |
|---|---|
| `inventory/` | Completeness checklist for all screens |
| `pages/` | Page-level compositions |
| `modals/` | Modal/dialog references |
| `states/` | Component state variations |
| `mobile/` | Mobile-specific layouts |
| `ui-kit_tokens/` | Design tokens, primitives, spacing, color, typography |
| `en-us_preview/` | English locale preview |

UI is implemented by absorbing Stitch design tokens into `packages/ui-kit/` (tokens + reusable components), then composing pages in `packages/ui/`. Direct JSX copy-paste is prohibited.

---

## Quickstart (Local)

### Prerequisites

- **Node.js** (see `package.json` → `packageManager: pnpm@9.1.1`)
- **pnpm** 9.x (`corepack enable && corepack prepare pnpm@9.1.1 --activate`)
- **Docker** (for PostgreSQL)

### 1. Clone & install

```bash
git clone <repo-url> nimbus-drive
cd nimbus-drive
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL 15 on **host port 15432** with:
- DB: `nimbus_drive`, User: `nimbus`, Password: `nimbus`
- Init scripts from `db/init/` run automatically on first start.

### 3. Run the dev server

```bash
# TODO: confirm the exact dev command — check packages/ui/package.json or src/ entry point
node scripts/dev_server.mjs
```

> The API server listens on **`http://localhost:8080`** (per OpenAPI `servers` config).

### 4. Open the app

Navigate to `http://localhost:8080`. On first visit you will be redirected to `/setup` to create the initial admin account.

---

## Usage (User)

### Onboarding

1. **First-time setup** → `/setup` creates the initial ADMIN account (one-time only; returns 409 after).
2. **Invite users** → Admin creates invite tokens via `POST /admin/invites`. Share the link.
3. **Accept invite** → Invitee opens `/invite/accept?token=<token>`, sets username/password.

### File management

- **Browse** → `/files` (root) or `/files/:nodeId` (subfolder)
- **Create folder** → `POST /nodes/folders`
- **Upload** → Chunked upload: `POST /uploads` → `PUT /uploads/{id}/chunks/{i}` → `POST /uploads/{id}/complete`
- **Download** → `GET /nodes/{id}/download` (Range-aware: 200 / 206 / 416)
- **Move / Copy / Rename** → `POST /nodes/{id}/move`, `/copy`, `/rename`
- **Search** → `/search?q=` (fuzzy, `pg_trgm`)

### Trash

- **Soft-delete** → `DELETE /nodes/{id}` (moves to trash)
- **View trash** → `GET /trash`
- **Restore** → `POST /trash/{id}/restore`
- **Permanent delete** → `DELETE /trash/{id}` (decrements blob `ref_count`; physical file removed when 0)

### Sharing

- **Create share link** → `POST /nodes/{id}/share-links` (returns a one-time token)
  - Optional: `password` (min 6 chars), `expires_in_seconds` (default 7 days, max 365 days), `permission` (READ / READ_WRITE)
- **Access shared content** → `GET /s/{token}` (metadata) / `GET /s/{token}/download`
  - If password-protected: provide `X-Share-Password` header

### Admin

- **Volumes** → `POST /admin/volumes/validate-path`, `POST /admin/volumes`, `POST /admin/volumes/{id}/activate`
- **Migration** → `POST /admin/migrations` (creates a MIGRATION job)
- **Scan / cleanup** → `POST /admin/storage/scan` (finds orphans; optional delete)
- **System mode** → `GET/PATCH /admin/system-mode` (toggle read-only for maintenance)
- **Jobs** → `GET /jobs`, `GET /jobs/{id}` (filter by `type`, `status`)
- **Performance** → `GET /system/performance` (QoS state, pressure metrics)

---

## API (OpenAPI)

The full API contract is in `openapi/openapi.yaml` (OpenAPI 3.1.0).

### View / validate

```bash
# Validate the spec (any OpenAPI validator)
npx @redocly/cli lint openapi/openapi.yaml

# Serve interactive docs
npx @redocly/cli preview-docs openapi/openapi.yaml
```

### API areas by domain

| Domain | Endpoints |
|---|---|
| **System** | `GET /health`, `GET /system/version`, `GET /system/capabilities`, `GET /system/performance` |
| **Setup** | `GET /setup/status`, `POST /setup/admin` |
| **Auth** | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/accept-invite` |
| **Users** | `GET /me`, `PATCH /me/preferences`, `GET /admin/users`, `POST /admin/users`, `POST /admin/invites`, `GET /admin/invites` |
| **Nodes** | `POST /nodes/folders`, `GET /nodes/{id}`, `GET /nodes/{id}/children`, `GET /nodes/{id}/breadcrumb`, `POST /nodes/{id}/rename`, `POST /nodes/{id}/move`, `POST /nodes/{id}/copy`, `DELETE /nodes/{id}` |
| **Uploads** | `POST /uploads`, `GET /uploads/{id}`, `PUT /uploads/{id}/chunks/{i}`, `POST /uploads/{id}/complete`, `DELETE /uploads/{id}` |
| **Downloads** | `GET /nodes/{id}/download` |
| **Shares** | `POST /nodes/{id}/share-links`, `GET /nodes/{id}/share-links`, `DELETE /share-links/{id}`, `GET /s/{token}`, `GET /s/{token}/download` |
| **Trash** | `GET /trash`, `POST /trash/{id}/restore`, `DELETE /trash/{id}` |
| **ACL** | `GET /nodes/{id}/acl`, `PUT /nodes/{id}/acl`, `GET /nodes/{id}/access` |
| **Admin – Storage** | `POST /admin/volumes/validate-path`, `GET /admin/volumes`, `POST /admin/volumes`, `POST /admin/volumes/{id}/activate`, `GET/PATCH /admin/system-mode` |
| **Admin – Ops** | `POST /admin/migrations`, `POST /admin/storage/scan` |
| **Jobs** | `GET /jobs`, `GET /jobs/{id}` |
| **Media** | `GET /media/{id}/thumbnail` |
| **Search** | `GET /search` |

---

## Evidence / Testing (TDD Addendum)

All task completions are verified via **CLI-based evidence bundles**, not screenshots.

### Evidence bundle structure

```
evidence/<piece_id>/<task_id>/
├── expected.md           # Human-readable pass criteria
├── cases/
│   └── *.case.yaml       # Contract test cases (SSOT-based)
├── run.sh                # Single-command reproducible execution
├── actual/
│   ├── http/             # curl results (status/headers/body)
│   ├── db/               # psql output (if needed)
│   ├── fs/               # ls/find/sha256sum output (if needed)
│   └── logs/             # server/worker logs (if needed)
├── junit.xml             # Test runner output (if available)
└── summary.json          # Required: automated pass/fail judgment
```

### `summary.json` required fields

```json
{
  "piece_id": "P1",
  "task_id": "P1-T1",
  "result": "PASS",
  "pass": true,
  "checks": [
    {
      "name": "setup_required is true",
      "expected": ".setup_required == true",
      "actual_path": "actual/http/setup-status.json",
      "pass": true
    }
  ]
}
```

**PASS rule**: a task is complete only when `summary.json` has **both** `"pass": true` **and** `"result": "PASS"`.

**FAIL conditions** (any one triggers FAIL):
- Expected status ≠ actual status
- Any `jq` assertion returns false
- DB/FS evidence doesn't match expectations
- `junit.xml` contains any failure

### Case YAML format

```yaml
id: P1-T1-SETUP-STATUS-001
name: Setup status check
request:
  method: GET
  url: /setup/status
  headers:
    Accept-Language: ko-KR
expect:
  status: 200
  assertions:
    - type: jq
      expr: '.setup_required == true'
```

Assertion types: `jq` (JSON query), `regex` (string/header match), `equals` (exact match).

### 2-Lane verification (recommended)

| Lane | Target | Scope | Purpose |
|---|---|---|---|
| **Fast** (5–20 s) | Every save / PR push | lint, typecheck, unit tests, OpenAPI validate (no DB) | Catch mistakes early |
| **Slow** (30 s – 2 min+) | Task completion / PR update | `compose up` + DB migrate + contract cases + cleanup | Final pass/fail judgment |

### Running evidence

```bash
# Single task evidence
bash evidence/<P>/<T>/run.sh

# Full suite (PR/CI validation)
bash scripts/run_evidence.sh

# UI-specific evidence
bash scripts/run_ui_evidence.sh
```

> **No screenshots for evidence**. UI tasks use Storybook build, typecheck, lint, and headless tests.

---

## Development Workflow

Development follows the **Evidence Playbook** — a task-driven, SSOT-first approach.

### Core rules

1. **1 task = 1–2 OpenAPI operations** + their contract case PASS. Don't mix API + UI + worker + migration in one task.
2. **SSOT first** — before coding, confirm the operation exists in `openapi/openapi.yaml` with its schema, state machine, and DB entries.
3. **No mixing refactors and features** — a task is either a feature or a refactoring, never both.
4. **Evidence closes the task** — `summary.json` with `result: "PASS"` is the only way to mark a task complete.

### Task loop

```
1. Read SSOT (OpenAPI operation/schema/error/state-machine)
2. Write test cases (FAIL expected initially)
3. Implement
4. Test → PASS
5. Generate evidence bundle in evidence/<P>/<T>/
6. Confirm summary.json result=PASS → close task
```

### Playbook sequence

- **P0–P3**: Foundation — SSOT gate, DB skeleton, setup, auth, invite-only, volumes, read-only mode
- **P4–P6**: Drive tree core, uploads (chunked E2E + reconciler), downloads (Range)
- **P7–P9**: Trash/GC, share links, ACL
- **P10–P12**: Search, media/QoS, migration/scan cleanup
- **P13+**: UI — workspace scaffolding, i18n, routing, ui-kit components, app shell, auth/onboarding UI, file explorer, file ops, upload queue, share modal, admin pages
- **P18**: Refactoring/hardening — typed API types, error handling, module boundaries, performance
- **P19**: Enhancement (optional) — command palette, bulk ops, audit UI

> P13+ tasks follow `docs/NAS_OpenClaw_Evidence_Playbook_P13_UI_Refactor.md`. UI tasks are evidence-gated by Storybook build / typecheck / lint / test — **never screenshots**.

---

## Internationalization (i18n)

- **Default locale**: `ko-KR`
- **Supported**: `ko-KR`, `en-US` (toggle in user settings)
- **API errors** are localized via `Accept-Language` header (default `ko-KR`)
- **User preference** stored in `User.locale`, changed via `PATCH /me/preferences`

### COPY_KEYS rules (SSOT: `docs/ui/COPY_KEYS_SSOT.md`)

- All UI strings must use i18n keys (e.g., `t('nav.files')`). **Hardcoded strings are prohibited.**
- Key namespaces: `app`, `nav`, `action`, `field`, `msg`, `err`, `status`, `modal`, `admin`
- Adding a new string requires: (1) add key to `COPY_KEYS_SSOT.md`, (2) add translations to `locales/ko-KR.json` and `locales/en-US.json`

### UI IA routes (SSOT: `docs/ui/IA_NAV_SSOT.md`)

Navigation paths are fixed. Implementation must match exactly:

| Section | Routes |
|---|---|
| Core | `/files`, `/files/:nodeId`, `/search?q=`, `/recent`, `/favorites`, `/shared`, `/media`, `/trash` |
| Auth | `/login`, `/setup`, `/invite/accept?token=` |
| Admin | `/admin`, `/admin/users`, `/admin/storage`, `/admin/migration`, `/admin/performance`, `/admin/jobs`, `/admin/audit`, `/admin/security`, `/admin/appearance` |

### 한국어 Quick Notes (ko-KR 기본 정책)

- 기본 UI 언어는 **한국어(ko-KR)** 입니다.
- 영어(en-US)는 설정에서 토글할 수 있습니다.
- 모든 UI 문자열은 `COPY_KEYS_SSOT.md`의 키를 사용해야 하며, 하드코딩은 금지됩니다.
- 새로운 문자열 추가 시: SSOT 문서 + `locales/ko-KR.json` + `locales/en-US.json`을 동시에 업데이트하세요.

---

## Security Model

- **Invite-only access** — no public registration; admin creates one-time invite tokens
- **JWT authentication** — access token (15 min TTL), refresh token (14 days, rotating)
- **Password hashing** — Argon2id (memory 32 MiB, iterations 2, parallelism 1); bcrypt cost-12 fallback
- **Share link tokens** — stored **hashed** in DB (`token_hash bytea`); plaintext returned only once at creation
- **Share link security** — optional password (min 6 chars), mandatory expiry (default 7 days, max 365 days)
- **ACL** — deny-by-default, inheritable entries; principals: USER, GROUP, SHARE_LINK; effects: ALLOW, DENY; permissions: READ, WRITE, DELETE, SHARE
- **Upload security**:
  - Client-provided `Content-Type` is **never trusted** (`content_type_trust: never`)
  - Extension allowlist (default: jpg, jpeg, png, gif, webp, heic, mp4, mov, pdf, txt, zip)
  - Executable deny list (php, jsp, asp, aspx, exe, dll, sh, bat, cmd)
  - Server-generated filenames; path traversal prevention
- **Read-only mode** — `PATCH /admin/system-mode` blocks all mutating endpoints (except admin toggles)
- **Download** — Range support with proper 416 handling, cache control headers

---

## Performance / QoS

The QoS controller follows an **interactive-first** policy: user-facing requests (browsing, download, search) always take priority over background work.

### Pressure thresholds (from `x-constants.qos`)

| Metric | Soft | Hard |
|---|---|---|
| CPU % | 50 | 70 |
| IO-wait % | 5 | 10 |
| API P95 (ms) | 300 | 800 |
| Memory available | 512 MiB (soft) | — |

### Background worker defaults

| Setting | Value |
|---|---|
| `bg_worker_concurrency` | default 1, min 0, cap 4 |
| `thumbnail_enqueue_rps` | default 1.0, cap 5.0 |
| `thumbnail_worker_concurrency` | 1 |

### System defaults (from `x-constants`)

| Setting | Value |
|---|---|
| Upload chunk size | 8 MiB (min 1 MiB, max 32 MiB) |
| Parallel chunks | 2 |
| Upload session TTL | 48 hours |
| Max file size | 2 TiB |
| Trash retention | 30 days |
| Share link default expiry | 7 days |
| Share link max expiry | 365 days |
| Access token TTL | 900 s (15 min) |
| Refresh token TTL | 1,209,600 s (14 days) |
| API timeout | 10 s |
| Download timeout | 60 s |
| HDD spin-up grace | 30 s |

Performance profiles: **ECO**, **BALANCED** (default), **PERFORMANCE**, **CUSTOM** — viewable at `GET /system/performance`.

For the full QoS constant definitions, see `x-constants.qos` in `openapi/openapi.yaml`.

---

## Roadmap

Development is organized into **Pieces (P)** and **Tasks (T)**, tracked in the Evidence Playbook.

| Phase | Pieces | Status |
|---|---|---|
| Foundation | P0 (SSOT gate) · P1 (Setup/Health) · P2 (Auth/Invite) · P3 (Volumes/Read-only) | Backend |
| Core | P4 (Drive Tree) · P5 (Upload E2E) · P6 (Download/Range) | Backend |
| Features | P7 (Trash/GC) · P8 (Share Links) · P9 (ACL) | Backend |
| Advanced | P10 (Search) · P11 (Media/QoS) · P12 (Migration/Scan) | Backend |
| UI | P13 (Workspace/Evidence gate) · P14 (ui-kit primitives) · P15 (App Shell/Auth UI) · P16 (File Explorer) · P17 (File Ops/Upload/Share/Admin UI) | Frontend |
| Hardening | P18 (Typed API types, error handling, module boundaries, perf) | Refactoring |
| Enhancement | P19 (Command palette, bulk ops, audit UI) | Optional |

> No items beyond what is documented in the Playbooks are added here. See `docs/NAS_OpenClaw_Evidence_Playbook_FINAL.md` and `docs/NAS_OpenClaw_Evidence_Playbook_P13_UI_Refactor.md` for full task breakdowns.

---

## Contributing

### PR rules

1. **SSOT first** — if your change affects API contracts, update `openapi/openapi.yaml` before writing code.
2. **Evidence required** — every task PR must include an `evidence/<P>/<T>/` bundle with a passing `summary.json`.
3. **One task per PR** — don't combine unrelated changes.
4. **No feature + refactor mixing** — separate PRs for features and structural improvements.
5. **UI strings via keys only** — update `COPY_KEYS_SSOT.md` + locale JSONs; never hardcode strings.

### Lint / typecheck expectations

```bash
# Workspace-wide (if available)
pnpm -r lint
pnpm -r typecheck
pnpm -r test

# UI-specific
pnpm -C packages/ui lint
pnpm -C packages/ui typecheck
pnpm -C packages/ui-kit storybook:build
```

> TODO: Confirm exact lint/typecheck tooling configuration per package.

---

## License

> **TODO: Add LICENSE** — No license file currently exists in the repository. Add a `LICENSE` file before public release.

---

## Glossary

| Term | Meaning |
|---|---|
| **SSOT** | Single Source of Truth — `openapi/openapi.yaml` is the highest-priority SSOT |
| **Evidence** | CLI-based test output bundle (`evidence/<P>/<T>/`) that proves a task passes |
| **Piece / Task** | A Piece (P) is a feature group; a Task (T) is 1–2 operations within it |
| **QoS** | Quality of Service — interactive-first throttling of background workers |
| **Reconciler** | Startup process that cleans stuck upload sessions and expired temp files |
| **ui-kit** | Shared component library (`packages/ui-kit/`) absorbed from Stitch design tokens |
| **Stitch** | External design vendor; deliverables live in `design/stitch/ko-kr_final/` |

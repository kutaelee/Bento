# NAS OpenClaw Evidence Playbook — P13+ (UI + Refactoring + 고도화)

> 전제: P0~P12 완료(P12-T2 PASS). 이제부터는 **UI(외주 Stitch 흡수)** → **리팩토링/하드닝** → **고도화** 순으로 진행한다.
>
> HARD PRE-FLIGHT (매 Task 시작 전):
> 1) `openapi/openapi.yaml` (SSOT)
> 2) `.openclaw/skills/clean-code-enforcer/INSTRUCTIONS.md` (mandatory)
> 3) `docs/NAS_OpenClaw_TDD_Addendum_FINAL.md` (evidence 규격)
> 4) `docs/ui/IA_NAV_SSOT.md` (내비/IA SSOT)
> 5) `docs/ui/COPY_KEYS_SSOT.md` (카피/i18n SSOT)
> 6) 디자인 참조: `design/stitch/ko-kr_final/` (inventory로 누락 체크)
>
---

## 0) 운영 원칙(이 문서에서 추가로 강제)

### 0.x Merge conflict 자동 복구(안정적 자동 재개)
- 조건: open PR의 `mergeStateStatus=DIRTY` 또는 `mergeable=CONFLICTING`이고, 로컬 preflight가 clean(프로세스/락/최근 로그 없음 + working tree clean)일 때.
- 조치(자동): PR 브랜치를 `origin/main`으로 rebase하여 충돌을 해소(가능한 경우)하고 CI를 재시작한다.
  - `git fetch origin`
  - `git checkout <headRefName>`
  - `git rebase origin/main`
    - 충돌 발생 시: `git diff --name-only --diff-filter=U` 목록을 notes에 남기고 `needs-human-resolve`로 중단
    - 성공 시: `git push --force-with-lease`로 업데이트 후 CI 폴링 재개
- 목적: merge conflict로 인해 **checks=0**(CI 미시작) 상태에서 크론이 영구 대기/루프에 빠지는 것을 방지.


### 0.1 P13+ Task의 “작게” 정의(UI)
- **1 Task = 1개의 화면/컴포넌트 OR 1~2개의 OpenAPI operation 연결**
- UI Task는 “페이지 복붙” 금지. `ui-kit` 컴포넌트로 **흡수(Absorb) → 조합(Compose)** 만 한다.
- 결과물은 무조건 **CLI 증거(Storybook build / typecheck / lint / test / headless)** 로 닫는다. 스크린샷 금지.

### 0.2 리팩토링 Task의 “작게” 정의
- **1 Task = 하나의 리팩토링 축(예: 에러 처리 통일, API client 단일화, 경계 lint)**
- “기능 변경 + 리팩토링” 동시 수행 금지.

### 0.3 Evidence 번들(필수)
- 폴더: `evidence/<P>/<P-Tx>/` (기존 규격 그대로)
- `summary.json`은 아래 두 가지를 모두 포함(머지봇/도구 호환):
  - `pass: true|false` (top-level)
  - `result: "PASS"|"FAIL"` (top-level)

권장 구조(그대로 사용):
```
/evidence/<P>/<P-Tx>/
  expected.md
  cases/
    *.case.yaml
  run.sh
  actual/
    logs/
    fs/
    http/
  junit.xml            # 가능하면
  summary.json         # 필수
```

---

## 1) P13: UI 워크스페이스/증거 게이트(기반)

> 목표: 이후 UI Task들이 “최소 컨텍스트 + 최소 토큰”으로 반복 가능하게 만드는 기반.

### P13-T0. UI Evidence Harness(반복 비용 제거)
- Goal: UI/FE Task에서 공통으로 쓰는 `scripts/run_ui_evidence.sh` 추가
- Scope(수정/추가):
  - `scripts/run_ui_evidence.sh`
  - (선택) `scripts/_evidence_lib.sh` (공통 유틸)
- Constraints:
  - bash strict mode (`set -euo pipefail`)
  - 실행 커맨드 출력은 `actual/logs/*.log`로 저장
  - PASS/FAIL 자동 판정 → `summary.json` 생성
- Evidence:
  - `evidence/P13/P13-T0/`에 harness 자체 스모크 실행
  - `run.sh`: `bash scripts/run_ui_evidence.sh --self-test`

### P13-T1. FE/Storybook 워크스페이스(비침투적 추가)
- Goal: repo에 UI를 **추가만** 해서 빌드/타입체크/린트/테스트가 동작
- Repo 구조(권장, 현 트리에 “추가”):
  - `packages/ui/` : 웹 앱(라우팅/페이지)
  - `packages/ui-kit/` : 재사용 컴포넌트 + 토큰(Storybook)
- Scope(수정/추가):
  - `/package.json` (workspace 루트. 기존 백엔드 코드는 이동 금지)
  - `/pnpm-workspace.yaml` (또는 npm workspaces)
  - `packages/ui/package.json`
  - `packages/ui-kit/package.json`
  - `packages/*/tsconfig.json`, `tsconfig.base.json`
  - `packages/*/.eslintrc.*`, `packages/*/vitest.config.*`
- Constraints:
  - 첫 Task는 “Hello Shell” 수준(페이지 1개 + 빈 테스트 1개)
  - 백엔드 런타임/compose에 영향 최소(서비스 추가는 다음 Task)
- Evidence(최소):
  - `pnpm -r lint`
  - `pnpm -r typecheck`
  - `pnpm -r test`
  - `pnpm -C packages/ui-kit storybook:build`

### P13-T2. i18n SSOT 스캐폴딩(COPY_KEYS 강제)
- Goal: UI에서 문자열 하드코딩 금지(키 기반)
- SSOT:
  - `docs/ui/COPY_KEYS_SSOT.md`
- Scope:
  - `packages/ui/src/i18n/` (예: `t.ts`, `locales/ko-KR.json`, `locales/en-US.json`)
  - `packages/ui-kit/src/i18n/` (필요 시 공용)
  - 테스트: `packages/ui/src/i18n/copy-keys.spec.ts`
- Constraints:
  - `t('nav.files')` 형태만 허용
  - 신규 키 추가 시: SSOT 문서 + JSON 동시 반영
- Evidence:
  - `pnpm -C packages/ui test` (COPY_KEYS에 있는 key들이 JSON에 전부 존재하는지 검사)


## P25 전제(SSOT 잠금) — P25 시작 전 반드시 충족

P24에서 확인된 한계: “설정/매핑 PASS ≠ 실제 UI(AppShell/페이지) PASS”.
따라서 P25(Full Fidelity)는 아래 전제를 **문서로 먼저 잠근 뒤** 진행한다.

- SSOT: `docs/ui/IA_NAV_SSOT.md`에 **Topbar-first(상단 탭) + LeftNav 단순화 + Right Inspector** 레이아웃을 명시한다.
- 레퍼런스: `design/stitch/ko-kr_final/**/code.html + screen.png`는 정답 레이아웃/간격 스펙이며, 구현은 ui-kit 조합으로 재현한다(HTML 복붙 금지).
- Evidence: P25의 `test:visual`은 반드시 **실제 렌더링 기반(Playwright 등)** 으로 PASS/FAIL을 판정해야 한다.
- 주의: 문서 변경만으로 화면이 바뀌지 않는다(구현 태스크 필요).

### P13-T3. 라우팅/내비 SSOT 스캐폴딩(IA_NAV 고정)
- Goal: 라우팅 경로/섹션 구조가 IA SSOT와 1:1 매칭
- SSOT:
  - `docs/ui/IA_NAV_SSOT.md`
- Scope:
  - `packages/ui/src/routes.ts` (정규 경로 선언)
  - `packages/ui/src/nav.ts` (사이드바/탑바 구성 선언)
  - 테스트: `packages/ui/src/nav/ia-nav.spec.ts`
- Evidence:
  - `pnpm -C packages/ui test`

### P13-T4. API Client Skeleton(SSOT 기반 최소 래퍼)
- Goal: 모든 API 호출이 “단일 fetch 래퍼”를 통과(토큰/에러/Accept-Language)
- SSOT:
  - `openapi/openapi.yaml`의 공통 헤더(`Accept-Language`, `Authorization`) 및 에러 스키마
- Scope:
  - `packages/ui/src/api/client.ts`
  - `packages/ui/src/api/errors.ts` (err.* 키 매핑의 기반)
  - 테스트: `packages/ui/src/api/client.spec.ts` (mock fetch)
- Constraints:
  - 401/403/409/429는 UI 레이어에서 일관 처리(나중 리팩토링에 확장)
- Evidence:
  - `pnpm -C packages/ui test`

---

## 2) P14: ui-kit(토큰/프리미티브) — Stitch 흡수

> 목표: “페이지 복붙”을 불가능하게 만들 정도로, 필요한 구성요소를 ui-kit으로 먼저 확보.

### P14-T1. Token 흡수(디자인 → CSS Vars/TS)
- Goal: `design/stitch/ko-kr_final/ui-kit_tokens/`를 ui-kit 토큰으로 흡수
- SSOT:
  - `design/stitch/ko-kr_final/ui-kit_tokens/`
- Scope:
  - `packages/ui-kit/src/tokens/` (CSS 변수 + TS export)
  - `packages/ui-kit/src/styles/global.css`
- Constraints:
  - 토큰은 컴포넌트에 직접 숫자 하드코딩 금지
- Evidence:
  - `pnpm -C packages/ui-kit storybook:build`
  - `pnpm -C packages/ui-kit test` (토큰 파일 존재/로딩 스모크)

### P14-T2. Button / Link
- Goal: 버튼/링크 기본 상태(hover/disabled/loading) 제공
- Scope:
  - `packages/ui-kit/src/components/Button.*`
  - Storybook stories + 스냅샷 테스트
- Evidence:
  - storybook build + test PASS

### P14-T3. TextField / PasswordField
- Goal: 로그인/초대/설정 입력 필드 재사용
- Scope:
  - `packages/ui-kit/src/components/TextField.*`
  - stories + test

### P14-T4. Dialog / Modal Frame
- Goal: Share/Move/Rename 등 모달의 공통 프레임
- Scope:
  - `packages/ui-kit/src/components/Dialog.*`
  - focus trap / esc close (접근성 최소)

### P14-T5. VirtualList Primitive
- Goal: 대량 리스트/트리 성능 기반(가상 스크롤)
- Scope:
  - `packages/ui-kit/src/components/VirtualList.*`
- Constraints:
  - 아이템 5k에서도 렌더 타임 폭발 방지(간단한 perf 스모크 테스트 추가)

### P14-T6. DataTable
- Goal: 파일 리스트(정렬/선택) 기반 테이블
- Scope:
  - `packages/ui-kit/src/components/DataTable.*`
  - `VirtualList` 기반

### P14-T7. TreeView
- Goal: 좌측 폴더 트리 기반
- Scope:
  - `packages/ui-kit/src/components/TreeView.*`
  - lazy load hook은 app에서 주입(컴포넌트는 UI만)

---

## 3) P15: App Shell + Auth/Onboarding UI

> 목표: IA의 골격을 먼저 완성하고, Auth/Setup을 최소 기능으로 연결.

### P15-T1. App Shell(레이아웃) + 라우터 스켈레톤
- Goal: `/login`, `/setup`, `/invite/accept`, `/files` 라우팅 + 레이아웃(사이드바/탑바/본문)
- SSOT:
  - `docs/ui/IA_NAV_SSOT.md` (레이아웃/경로)
  - `docs/ui/COPY_KEYS_SSOT.md` (nav/action 키)
- Constraints:
  - 텍스트는 전부 i18n 키
  - InspectorPanel은 placeholder로 시작
- Evidence:
  - `pnpm -C packages/ui test`
  - `pnpm -C packages/ui build`

### P15-T2. Login UI + POST /auth/login 연결
- Goal: `/login`에서 로그인 성공/실패 처리
- SSOT(OpenAPI):
  - `POST /auth/login`
  - 에러 응답 스키마
- Evidence(권장):
  - MSW(mock) 기반 컴포넌트 테스트 2개
    - 200 성공 → 토큰 저장
    - 401 실패 → `err.unauthorized` 노출

### P15-T3. Session Refresh + Logout(무한루프 방지)
- SSOT(OpenAPI):
  - `POST /auth/refresh`, `POST /auth/logout`
- Constraints:
  - refresh 실패 시 강제 로그아웃(상태 정리)
- Evidence:
  - fetch wrapper 단위 테스트(401→refresh→재시도, refresh 실패 케이스)

### P15-T4. Setup UI + GET /setup/status, POST /setup/admin 연결
- Goal: DB empty일 때만 `/setup` 노출
- SSOT(OpenAPI):
  - `GET /setup/status`
  - `POST /setup/admin`
- Evidence:
  - 상태에 따라 `/setup` 접근 허용/리다이렉트 테스트

### P15-T5. Invite Accept UI + POST /auth/accept-invite
- Goal: `/invite/accept?token=` 처리
- SSOT(OpenAPI):
  - `POST /auth/accept-invite`
- Evidence:
  - token 없음/유효/만료 케이스 컴포넌트 테스트

---

## 4) P16: Files Explorer(Read-first) — 목록/탐색/가상화

> 목표: “읽기 전용 탐색”을 먼저 완성하고, 이후 조작(생성/이동/삭제)을 붙인다.

### P16-T1. Folder View(Read-only)
- Routes:
  - `/files` (루트)
  - `/files/:nodeId` (폴더)
- SSOT(OpenAPI):
  - `GET /nodes/{node_id}`
  - `GET /nodes/{node_id}/children`
- Evidence:
  - children pagination(cursor/limit) 렌더 테스트

### P16-T2. Breadcrumb
- SSOT(OpenAPI):
  - `GET /nodes/{node_id}/breadcrumb`
- Evidence:
  - breadcrumb 렌더 + 클릭 시 라우팅 변경 테스트

### P16-T3. Sidebar Folder Tree(Read-only, lazy)
- SSOT:
  - IA의 Folder Tree 규칙
  - (API) children endpoint 재사용
- Constraints:
  - 트리는 “lazy expand”만(전체 트리 프리로드 금지)
- Evidence:
  - expand 시 children 호출 1회, collapse는 재호출 없음(캐시) 테스트

### P16-T4. Inspector Panel(메타/상태)
- Goal: 선택한 노드의 기본 메타(이름/수정일/크기/소유자 등) 표시
- SSOT(OpenAPI):
  - `GET /nodes/{node_id}` 응답
- Evidence:
  - selection state 변화에 따른 패널 업데이트 테스트

### P16-T5. Search Page(Read-only)
- Route: `/search?q=`
- SSOT(OpenAPI):
  - `GET /search`
- Evidence:
  - query param 변경 시 debounced fetch 테스트

---

## 5) P17: File Ops + Upload + Share + Admin UI(필수 기능)

> 목표: “탐색(읽기)” 위에 “조작(쓰기)”를 안전하게 추가.

### P17-T1. Create Folder + POST /nodes/folders
- SSOT(OpenAPI):
  - `POST /nodes/folders`
- Evidence:
  - 201 성공
  - 409(name conflict) → `err.conflict`

### P17-T2. Rename + POST /nodes/{id}/rename
- Evidence:
  - 200 성공
  - 409 충돌 처리

### P17-T3. Move + POST /nodes/{id}/move
- Evidence:
  - 200 성공

### P17-T4. Copy + POST /nodes/{id}/copy
- Evidence:
  - 200 성공

### P17-T5. Trash List + Restore + Delete
- SSOT(OpenAPI):
  - `GET /trash`
  - `POST /trash/{node_id}/restore`
  - `DELETE /trash/{node_id}`
- Evidence:
  - empty state → `msg.emptyTrash`
  - restore 성공

### P17-T6. Upload Queue UI(세션/청크/완료)
- SSOT(OpenAPI):
  - `POST /uploads`
  - `PUT /uploads/{upload_id}/chunks/{chunk_index}`
  - `POST /uploads/{upload_id}/complete`
- Constraints:
  - 업로드 큐는 UI state로 관리(재시도/취소)
  - chunk 병렬은 기본값 2(SSOT 상수 있으면 그 값)
- Evidence:
  - mock 파일(작은 Blob) 업로드 플로우 테스트

### P17-T7. Download(파일)
- SSOT(OpenAPI):
  - `GET /nodes/{node_id}/download` (Range 지원은 있으면 추가)
- Evidence:
  - 다운로드 요청 생성(브라우저 링크/stream) 단위 테스트

### P17-T8. Share Modal + POST /nodes/{id}/share-links
- SSOT(OpenAPI):
  - `POST /nodes/{node_id}/share-links`
  - `GET /s/{token}` (public)
  - `GET /s/{token}/download` (public)
- Evidence:
  - 링크 생성 성공(201) → 링크 표시
  - 비밀번호 요구 시 헤더 `X-Share-Password` 처리 테스트

### P17-T9. Admin: System Mode(Read-only 토글)
- Route: `/admin/migration` 또는 `/admin` 배너
- SSOT(OpenAPI):
  - `GET/PATCH /admin/system-mode`
- Evidence:
  - read_only 켜짐/꺼짐 UI 반영

### P17-T10. Admin: Volumes(목록/검증/생성/활성화)
- Route: `/admin/storage`
- SSOT(OpenAPI):
  - `POST /admin/volumes/validate-path`
  - `GET/POST /admin/volumes`
  - `POST /admin/volumes/{volume_id}/activate`
- Evidence:
  - validate-path 성공/실패

### P17-T11. Admin: Migration Trigger + Storage Scan
- Route: `/admin/migration`, `/admin/storage`
- SSOT(OpenAPI):
  - `POST /admin/migrations`
  - `POST /admin/storage/scan`
  - `GET /jobs/{job_id}`
- Evidence:
  - job 생성(202) → jobs 상세 조회 렌더

### P17-T12. Admin: Jobs(리스트/상세)
- Route: `/admin/jobs`
- SSOT(OpenAPI):
  - `GET /jobs`
  - `GET /jobs/{job_id}`
- Evidence:
  - 필터(type/status) 변경 시 리스트 갱신 테스트

---

## 6) P18: 리팩토링/하드닝(유지보수성/확장성/퍼포먼스)

> 목표: UI/FE를 “실무적으로 봐도 모듈화가 잘 됐다” 수준으로 정리.
> 원칙: 기능 변경 없이 구조/성능/규약만 개선(가능하면).

### P18-T1. Typed API Types(SSOT → types 자동 생성)
- Goal: OpenAPI 기반 타입 생성으로 임의 필드/환각 방지
- SSOT:
  - `openapi/openapi.yaml`
- Scope:
  - `packages/ui/src/api/schema.d.ts` (생성물)
  - `packages/ui/src/api/*`에서 이를 참조
- Evidence:
  - `pnpm -C packages/ui typecheck` (타입 오류 0)

### P18-T2. Error Handling 표준화(err.* 키로 귀결)
- Goal: API 에러 → UI 메시지 매핑 단일화
- SSOT:
  - OpenAPI의 ErrorResponse
  - `docs/ui/COPY_KEYS_SSOT.md`의 `err.*`
- Evidence:
  - 401/403/404/409/429 케이스별 테스트

### P18-T3. 모듈 경계 강제(의존성 방향)
- Goal: `ui` → `ui-kit` 단방향, 페이지는 컴포넌트 복붙 금지
- Scope:
  - eslint rule(예: boundaries) 또는 TS project references
- Evidence:
  - 규칙 위반 샘플(테스트 fixture)에서 lint fail 확인 + 실제 코드 lint pass

### P18-T4. 성능 하드닝(가상화/메모이제이션/코드 스플릿)
- Goal: 대량 노드에서도 렌더/스크롤이 버벅이지 않게
- Constraints:
  - route-level lazy loading(`/admin/*` 분리)
  - VirtualList 기반 유지
- Evidence:
  - 간단한 perf 스모크(5k 아이템 렌더) 테스트

### P18-T5. FE 관측성(옵션)
- Goal: 에러 경로/성능 병목을 재현 가능하게 로그/메트릭 최소 추가
- Evidence:
  - 개발 모드에서만 활성화(프로덕션 오버헤드 최소)

---

## 7) P19: 고도화(선택, 리팩토링 이후)

> 목표: 제품 완성도/운영편의/사용성 강화. (필수 아님)

### P19-T1. Command Palette(Ctrl/Cmd+K)
- IA SSOT에 언급된 기능. 파일/액션 검색.

### P19-T2. Bulk Ops(다중 선택 이동/삭제/공유)

### P19-T3. Audit/Activity UI(있다면 API 추가 없이 표시)
- 단, OpenAPI에 없으면 “UI만” 만들지 말 것. 필요하면 SSOT 변경 절차(ADR→OpenAPI) 먼저.

---

## 8) Task 카드 템플릿(코딩봇 입력용)

각 Task는 아래를 **그대로** 채워 PR 1개로 처리한다.

- **Task ID**: Pxx-Ty
- **Goal**: (한 줄)
- **SSOT 참조**:
  - OpenAPI: `paths./...` (해당 operation만)
  - IA/COPY: (해당 섹션/키 범위)
  - Stitch: (필요 시 경로)
- **Files touched(최대 10개 권장)**:
  - ...
- **Constraints**:
  - (복붙 금지/단방향 의존/스크린샷 금지 등)
- **Evidence**:
  - `evidence/Pxx/Pxx-Ty/run.sh`에 들어갈 커맨드 3~6개
  - `summary.json` 생성 규칙(pass/result/checks)


## Loop prevention rules
- TaskID 결정 규칙(결정적): headRefName ^feature/((UI-)?P[0-9]+-T[0-9]+)- 우선, 없으면 PR title [(UI-)?Pxx-Ty]. 둘 다 없으면 STOP.
- MERGED TaskID = DONE sticky (resume/PR 생성/회귀 금지).
- **MERGE CONFLICT AUTO-RECOVERY(필수):** open PR의 `mergeStateStatus=DIRTY` 또는 `mergeable=CONFLICTING`이면, 워킹트리 clean 조건에서 PR 브랜치를 `origin/main`으로 rebase 후 `--force-with-lease`로 갱신하고 CI를 재시작한다. 충돌 파일이 남으면 `git rebase --abort`로 워킹트리를 원복한 뒤 `needs-human-resolve`로 중단한다.
- **PRE-FLIGHT CLEANUP(필수):** auto-recovery(rebase) 전에 워킹트리가 dirty면, (a) evidence/**/actual/** 또는 evidence/summary.json 변경만 있는 경우 자동 restore 후 진행하고, (b) docs/*.md 변경만 있는 경우 자동 restore 후 진행한다. 그 외 코드/설정 변경이 남아있으면 waiting으로 중단한다(충돌/루프 방지).
- post-merge main CI failure ≠ task regression (infra/integration incident로 보고).
- resume dirty는 evidence/** 한정 (그 외 변경 있으면 STOP).
- PR 생성은 TaskID 확정 + evidence PASS + nonzero commits 3조건.
- infra 확정은 동일 PR에서 rerun 1회 후 같은 실패 클래스 반복일 때만.

## CHANGELOG
- 2026-02-28: loop prevention hardening


---



## 8) P26: Visual Match Enforcement (/files 기준 결과 강제)

### P26-T0. Reference Baseline Lock
- route -> reference(screen.png) 매핑을 CI에서 강제하고 누락/오매핑 시 FAIL.

### P26-T1. Visual Harness(Playwright) 안정화
- /files 스냅샷(empty, with-items) 실제 렌더 생성.
- viewport/font/animation/timezone/locale 고정.

### P26-T2. Pixel Diff Gate(/files)
- reference screen.png 대비 diff PASS 아니면 머지 불가.
- baseline 임의 갱신 금지(승인 토큰/플래그 없으면 FAIL).

### P26-T3. AppShell Frame Match(files)
- 상단/좌측/우측 패널/본문 프레임을 레퍼런스 레이아웃과 정합.

### P26-T4. Data Fixture Lock(with-items)
- /files with-items 시드(정렬/시간/개수/라벨) 고정으로 플래키 제거.

### P26-T5. Files Page Match A(레이아웃)
- spacing/grid/섹션 배치(큰 형태) 정합.

### P26-T6. Files Page Match B(디테일)
- typography/color/border/shadow/empty-state 정합.

### P26-T7. Regression Stability
- 동일 SHA에서 visual 결과 재현성 확보(선택: 3회 연속 PASS).


## 99) 종료 태스크(Playbook 완주 후 자동화 종료)

### P99-T0. Playbook 완주 시 크론 디세이블 + 사람 승인 체크

- Trigger: Playbook의 **모든 Task가 PASS**이고, open PR이 0개이며, merge gate(S1/S2/S3)까지 완료된 이후.
- Goal: 반복 루프/재시도를 구조적으로 차단하고, 사람 승인 포인트를 명시적으로 남긴다.

#### 실행(필수, 서버에서)
- Audrey PR triage cron disable:
  - `openclaw cron disable <REDACTED_UUID>`
- Odchestra merge-gatekeeper cron disable:
  - `openclaw cron disable <REDACTED_UUID>`


#### Merge-ready 시 수동 gatekeeper 호출(권장)
- merge-gatekeeper 크론을 disable 해둔 경우, PR이 merge-ready(CI success + unresolved thread 없음)일 때만 수동으로 호출한다.
  - `openclaw cron run --expect-final --timeout 180000 <REDACTED_UUID>`
  - 또는 workspace 스크립트: `<LOCAL_PATH>`

#### 사람 승인 필요(서버 시간 기준 2026-02-28 09:00 KST까지)
- [x] (예정) 모든 open PR merge 여부 확인(현재 오픈 PR만)
- [x] (예정) cron disable 실행/반영 확인(`openclaw cron status`로 enabled=false 확인)
- [x] (예정) 다음 작업(신규 Piece/Task) 시작은 **사람이 명시적으로 승인**한 뒤에만 진행

Evidence(권장)
- `openclaw cron status` 출력 캡처를 내부 운영 노트에 보관(로그/스크린샷/메시지 ID 등)

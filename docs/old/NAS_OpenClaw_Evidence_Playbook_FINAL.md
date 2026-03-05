# NAS OpenClaw Evidence Playbook (FINAL)


## P20~P23 트랙 전용 규약 링크
- `docs/ui/NAS_UI-Kit_Design_Fidelity_Playbook.md`
- P20~P23의 CI/evidence/visual regression/summary.json 스키마는 위 문서를 우선 SSOT로 사용한다.


## HARD PRE-FLIGHT (Task 시작 전 필수)
OpenClaw MUST read and comply with:
1) `openapi/openapi.yaml` (SSOT)
2) `.openclaw/skills/clean-code-enforcer/INSTRUCTIONS.md` (mandatory)
3) `docs/NAS_OpenClaw_TDD_Addendum_FINAL.md` (evidence rules)

If any rule conflicts, the order above wins (SSOT > Skill > TDD Addendum).


> 목표: OpenClaw가 “대량 작업”을 수행해도 **컨텍스트 오염/환각**을 최소화하도록  
> 1) 피스를 더 작게 쪼개고, 2) 태스크마다 SSOT 참조를 고정하고, 3) CLI 증거로만 닫는다.

---

## 0. 절대 규칙(이 문서가 강제하는 운영 방식)

### 0.1 태스크는 “작게, 단일 목표, 단일 증거”
- 1 태스크 = 1~2개의 OpenAPI operation 구현 + 그 operation에 대한 contract case PASS
- 한 태스크에서 “API + UI + 워커 + 마이그레이션”을 같이 하지 않는다.
- “Task당 3회 제한 / 60분 제한 / 실패 리포트 텔레그램 의무”
### 0.2 SSOT 우선
- 구현 전에 반드시 `openapi/openapi.yaml`에서
  - operation(path/method)
  - request/response schema
  - 상태머신/DB 항목(x-state-machines/x-db)
  을 확인한다.

### 0.3 증거 제출 = CLI 기반 자동 판정
- 증거 구조는 `NAS_OpenClaw_TDD_Addendum_FINAL.md`를 따른다.
- `summary.json`이 PASS가 아니면 태스크는 닫히지 않는다.

### 0.3.1 2-Lane 검증(권장): Fast lane → Slow lane
- **Fast lane**: 5~20초 목표의 초단기 검증 루프
  - 용도: PR/로컬에서 자주 실행해 빠르게 실패를 포착.
  - 포함: lint / typecheck / unit tests / OpenAPI validate 등 **DB를 직접 쓰지 않는 항목**.
  - Fast lane PASS는 태스크 완료 근거가 아니다. (evidence 대체 불가)

- **Slow lane**: 30초~2분+의 통합 증거 게이트
  - 용도: 태스크 완료 판정/PR 업데이트 직전에 1~2회만 실행.
  - 포함: `compose up` + DB migrate/seed + contract cases + cleanup.
  - 태스크 완료 판정 고정 조건: `/evidence/<piece>/<task>/summary.json`에서 `pass=true` AND `result="PASS"`.

운영 최적화 가이드:
- 의존 제거가 아니라 **컨테이너 재사용**, **migrate/seed 변경 시만 실행**, **readiness 대기 최적화**, **캐시 활용**, **케이스 최소화(운영상 핵심 시나리오 중심)**로 도커/DB 시간을 줄인다.
- Playbook 실행흐름은 `태스크별 run.sh` → 필요 시 `scripts/run_evidence.sh`(최종) 순서와 정합한다.

### 0.4 증거 실행 정리 규칙
- evidence FAIL이 발생하면 `evidence/<P>/<T>/actual/logs`를 확인해 원인을 요약하고, SSOT 범위 내 최소 수정 후 동일 Task `run.sh`를 1회 재실행한다. PASS 시 CI rerun을 1회 트리거한다.
- stale/dirty 상태에서 자동 재개가 가능한 경우를 추가한다.
  - dirty가 `evidence/<P>/<T>/actual/**` 또는 `evidence/summary.json`에만 존재하고, 코드/설정 파일 변경이 없으며 실행 프로세스가 없을 때는 자동 정리(`git restore`) 후 동일 Task `run.sh`를 1회 재개할 수 있다.
  - 위 조건 외 dirty는 자동 재개 금지(NEEDS HUMAN RESOLVE).
- 태스크 증거(run.sh/commands.sh) 실행은 **성공/실패와 무관하게 종료 정리**가 선행되어야 한다.
- `node scripts/dev_server.mjs`를 띄운 경우, run.sh/commands.sh는 `trap`/`finally`/`cleanup`으로 종료 신호를 보내고 프로세스를 정리해야 한다.
- 작업 시작 시점에는 기존에 `node scripts/dev_server.mjs`가 기동되어 있는지 먼저 조회하고, 남아 있으면 **정리 후 종료**하거나 run을 중단하고 즉시 정리 오류로 간주한다.
- 작업 종료 후에도 `node scripts/dev_server.mjs` 프로세스가 잔존하면 즉시 kill(TERM/kill)하고, 정리 완료 후 다음 단계로 진행한다.


### 0.4.5 리뷰 대응 규칙 (PR triage)
- Codex/사람 리뷰에서 thread가 존재하면, 실질적 수정이 필요한지 여부와 무관하게 SSOT 근거를 남긴 코멘트를 먼저 달고 즉시 resolve 대상화한다.
- 처리 항목이 필요한 경우: 해당 스레드의 지적에 맞춘 코드 수정 또는 증거 보완 후 근거 코멘트를 남기고 resolve 한다.
- 처리 항목이 없는 것으로 판단되는 경우(안내/상태성 코멘트)는 PR 본문 또는 코멘트로 `No action required` 근거를 남긴 뒤 resolve 처리한다.
- 하나라도 unresolved thread가 남아 있으면 병합/클린으로 보고하지 않는다.

### 0.4.6 봇 코멘트 프리픽스 규칙 (SSOT)
코딩봇과 리뷰대응봇이 동일 에이전트(예: Audrey)로 운용되는 경우, GitHub 상에서 작성자 구분이 어려워 컨텍스트가 오염되기 쉽다. 따라서 **모든 봇 코멘트/리뷰/상태 업데이트는 아래 프리픽스를 첫 줄에 강제**한다.

허용 프리픽스(택1, 대문자 고정):
- `[CODING BOT]` 구현/수정/증거 생성 관련 코멘트
- `[PR TRIAGE]` 리뷰 스레드 대응/정리(Resolve 포함) 관련 코멘트
- `[MERGE BOT]` 머지 게이트(3신호 판정) 관련 코멘트

추가 규칙:
- 프리픽스 바로 다음 줄에 가능한 경우 `Task:` / `Evidence:` / `Head SHA:`를 1줄씩 기록한다.
- "action needed"/"no action"을 명확히 적어, 상태성 코멘트가 다음 런의 작업 트리거로 오해되지 않게 한다.
- 사람(HUMAN) 코멘트는 프리픽스 의무 없음(선택적으로 `[HUMAN]` 사용 가능).


### 0.4.7 Playbook 순서 고정 규칙 (피스/태스크 오케스트레이션)
- post-merge CI failure: 해당 Task PR이 MERGED 상태인데 main CI가 실패하면, 동일 Task로 회귀/재개하지 않고 인프라/회귀 이슈로 분류하여 NEEDS HUMAN RESOLVE로 보고한다.
- merge-dup guard: 동일 headRefName/TaskID의 MERGED PR이 이미 있으면 해당 Task는 완료로 간주하고 resume/PR 생성 금지.
- infra-fail guard: CI 실패가 인프라성(curl empty reply/psql socket/connection) 반복이면 같은 PR에서 재실행 1회까지만 허용하고 추가 PR 생성 금지(NEEDS HUMAN RESOLVE).
- resume 종료 규칙: head/base 동일(커밋 0개)이면 해당 태스크 재개를 중단하고 다음 Task로 이동한다.
- 중복 PR 방지: 동일 TaskID/branch에 대해 open PR이 이미 존재하면 새 PR을 생성하지 않는다(기존 PR만 갱신).
- PR 생성 전 확인: headRefName과 main 사이 커밋이 0개면 PR 생성 금지(NEEDS HUMAN RESOLVE).
- P12-T2까지 완료 후 다음 단계는 P13부터 시작하며 UI 작업이 먼저다.
- P13 이후 작업 규칙/피스-태스크 정의는 `docs/NAS_OpenClaw_Evidence_Playbook_P13_UI_Refactor.md`를 SSOT로 따른다.
- triage는 **항상 Playbook(문서의 순서) 기준으로 다음 Task를 선택**한다.
- 같은 피스 내에서 순서를 변경하지 않으며, Task는 완료(PASS) 전후를 포함해 **동시에 2개 이상 진행되지 않는다**.
- `open` 상태 PR이 존재하면, `Task` 진행은 해당 PR의 `Task ID`를 정리/머지 처리한 뒤에만 다음 Task로 전환한다.
- `evidence/<piece>/<task>/summary.json`이 `pass=true`와 `result="PASS"`를 만족하고, 필요한 review thread/merge gate가 정합될 때만 다음 task 후보를 계산한다.
- **자동 다음 태스크 진행 허용 조건:** 오픈 PR 0개 + 직전 Task PR이 머지됨 + working tree clean + 실행 중 프로세스 없음이면, Playbook 순서 기준으로 다음 Task를 자동 착수한다.
- 정합 실패/리스트 상태 불명확 시 자동 선택을 멈추고 `in_progress`로 표기하여 **추가 정리(리뷰·프로세스·working tree) 후 재개**한다.
- 작업 시작 전에 기존 dev_server 잔존/트리아지 상태 잔재(미정리 브랜치 아티팩트·증거 잔여물)를 확인하고, 정리 후에만 시작한다.
- **EVIDENCE SCOPE SSOT(필수):** UI 작업(P13~P19) 관련 변경은 CI에서 `EVIDENCE_SCOPE=ui`로 분류되어야 하며, API/DB evidence(P0~P12)를 함께 실행하지 않는다. (full로 떨어지는 경우는 workflow/scripts/compose 변경 등 ambiguous로 분류된 경우이며, 이때는 fail-closed로 full을 유지한다.)

- **자동 진행 파이프라인(반복 확인 금지):**
  1) 상태확인(git clean + 프로세스 없음)
  2) 다음 Task 착수
  3) **로컬 Task evidence만 실행** (`evidence/<P>/<T>/run.sh`)
   - CI/Runner 전제: pnpm/node_modules가 없을 수 있으므로, 공용 러너(`scripts/run_evidence.sh`)는 corepack 기반 pnpm 활성화 + `pnpm -w install --frozen-lockfile` 1회 부트스트랩을 수행해야 한다.

  4) PR 생성 (전체 CI는 GitHub에서 수행)
  5) 리뷰 대응(수정 → resolve)
  6) CI 실패 시 조치 후 재커밋
  7) 머지 확인
  8) 상태확인 후 **즉시 다음 Task로 이동** (동일 조건을 다시 묻지 않는다)

### 0.4.8 PR이 열려 있을 때 오드리(코딩봇) 역할
- **MERGE POLICY(필수):** 코딩봇/트리아지 크론은 `gh pr merge`를 직접 실행하지 않는다. 일반 Task PR은 merge-gatekeeper 판정/실행을 통해서만 병합한다. CI/문서 PR([CI]/[DOC], feature/ci- / feature/doc-)은 자동 머지/게이트 호출을 하지 않으며 사람(규태) 승인 후에만 병합한다.
- **외부 개발툴/에이전트 사용금지(사람 승인 필요):** 허용되지 않은 개발 툴(opencode/Codex CLI/Claude Code/Gemini CLI 등) 및 외부 에이전트/코딩봇 사용은 금지한다. 필요 시 반드시 사람(규태) 승인 후에만 사용한다.
- `open` 상태 PR 존재 시 코딩봇은 기본적으로 **새 태스크 시작 금지** 원칙을 따른다.
- 수행 범위:
  1) PR 상태 모니터링(선택된 PR, 브랜치, 리뷰 스레드)
  2) 리뷰 코멘트 실체 확인
  3) 필요한 경우 코드/증거 수정 반영 후 `evidence/<piece>/<task>/summary.json` 갱신
  4) 리뷰 스레드별 코멘트·`resolve` 처리
  5) CI 실패 재현/원인 분석 및 재실행 기반 재검증
- 다음 조건 충족 전에는 새 태스크로 점프하지 않는다:
  - 대상 PR의 리뷰 스레드/CI 실패 항목 상태가 정리됨
  - 최신 evidence(및 summary)가 PASS로 정합됨
  - merge gate/보안/리뷰 규칙 충족
  - 위 조건이 충족되어 `merged` 대기 상태가 될 수 있으면, 현재 브랜치가 실행 중 프로세스/스테이지를 갖지 않고 (run/tests/dev_server 종료) 워킹트리가 증거 정리 상태면 변경 없이 상태만 `idle/waiting-merge`로 남긴다.
- **CI FAILURE 조치 규칙:** CI evidence 실패가 보이면 로컬 작업트리 clean 상태에서 `scripts/run_evidence.sh`로 재현 → PASS 시 해당 PR의 CI rerun을 1회 트리거한다. 로컬에서 `scripts/run_evidence.sh`를 PASS한 경우, PR 코멘트에 실행 사실을 남긴다.
- 진행 중 판단 규칙(중요):
  - `git status`에서 tracked/untracked 증거 산출물 변경 + 브랜치 존재 + 관련 세션(예: `node scripts/dev_server.mjs`, 실행중의 `run.sh`, 작업세션)이 있으면 우선적으로 진행 중으로 본다.
  - 다만, 증거 산출물 용량이 **2회 연속 동일**할 때는 단발성 잔재가 아니라 "작업 정체(stalled)" 가능성이 높다고 보고, 해당 런에서 즉시 작업 중 종료로 간주하지 않는다.
  - **Dirty 브랜치 판정 규칙(working tree dirty ≠ 작업중):**
    - A) 실제 런 중 → 스킵 (근거 1줄 포함)
      - 프로세스 존재(dev_server/evidence runner 등) 또는
      - SSOT 근거 활성(pid 파일+프로세스 alive, LOCK 마커 존재, logs 최근 5분 내 갱신)
    - B) stale → 정리 후 재개
      - dirty + 프로세스 없음 + SSOT 근거 비활성 + 마지막 변경 5분 경과 + PR CI(evidence) 미진행
      - 정리 단계는 자동 커밋 없이 가이드 출력(커밋 권장 vs restore 권장) 후 다음 런 재개
    - C) 애매함 → 보수적 스킵
      - 애매 사유(예: lock 있음/ pid 없음 등) + 마지막 변경/로그 갱신 시각 1줄 출력
  - 진행 중 판단은 해당 산출물 디렉터리/상태파일(evidence + `.audrey_pr_triage_state.json`)의 `du`/`stat` 크기 변동으로 보조 증빙한다.
- PR triage는 3회 연속 진행 중 감지 시 `NEEDS HUMAN RESOLVE`로 전환하고, 사람이 승인/지시할 때까지 변경을 중단한다.

### 0.5 HARD PRE-FLIGHT
4) `docs/ui/IA_NAV_SSOT.md` (navigation SSOT)
5) `docs/ui/COPY_KEYS_SSOT.md` (copy/i18n SSOT)
---

## 1. 피스/태스크 템플릿(모든 태스크는 이 형식을 따른다)

### 템플릿
- **Piece ID / Task ID**
- **목표(Goal)**
- **SSOT 참조(필수)**
  - OpenAPI: `paths./...` , `components.schemas...`
  - 상태머신: `x-state-machines...`
  - DB/인덱스: `x-db.tables...`
- **구현 제약(Constraints)**
- **증거(Required Evidence)**
  - case 파일 목록
  - 실행 커맨드
  - 검증(assertion) 요약

---

## 2. 개발 순서(효율 + 완주 확률)

> P0~P3까지가 “기반”이며, 여기서 흔들리면 이후 태스크가 폭발합니다.

---

# P0. SSOT & 테스트 게이트(필수)

## P0-T1. OpenAPI SSOT 로드/검증 게이트
- Goal: `openapi/openapi.yaml`이 파싱 가능하고, CI에서 스키마 검증이 동작
- SSOT:
  - `openapi/openapi.yaml` (전체)
- Evidence:
  - `cases/P0-T1-OPENAPI-001.case.yaml` (간단 health 호출)
  - `run.sh`: openapi lint/validate + health curl
  - `summary.json PASS`

## P0-T2. DB 마이그레이션 스켈레톤 + 필수 확장 설치
- Goal: Postgres에 `ltree`, `pg_trgm` 설치 및 주요 테이블 생성(최소 users)
- SSOT:
  - `x-db.extensions_required`
  - `x-db.tables.users`
- Evidence:
  - `psql -c "\dx"` 결과에 ltree/pg_trgm 포함
  - `psql -c "\d users"` 스키마 확인

---

# P1. First-time Setup(최초 관리자 생성) + Health

## P1-T1. GET /setup/status
- Goal: DB가 비어있으면 `setup_required=true` 반환
- SSOT:
  - OpenAPI: `paths./setup/status.get`
  - DB: `x-db.tables.users`
- Evidence:
  - case: `P1-T1-SETUP-STATUS-001.case.yaml`
  - assertion: `.setup_required == true`

## P1-T2. POST /setup/admin (1회만)
- Goal: 최초 관리자 생성(이미 유저가 있으면 409)
- SSOT:
  - OpenAPI: `paths./setup/admin.post`
  - DB: `x-db.tables.users`
- Evidence:
  - case: create-admin 201
  - case: create-admin second time => 409

## P1-T3. GET /health
- Goal: 서버 기본 헬스체크(공개)
- SSOT: `paths./health.get`
- Evidence:
  - status 200, `{ ok: true }`

---

# P2. Auth(로그인/리프레시/로그아웃) + Invite-only

## P2-T1. POST /auth/login
- SSOT: `paths./auth/login.post`, `components.schemas.AuthTokens`
- Evidence:
  - login success 200
  - wrong password 401

## P2-T2. POST /auth/refresh (rotation)
- SSOT: `paths./auth/refresh.post`, `x-constants.auth.refresh_token_rotation`
- Evidence:
  - refresh success 200
  - old refresh token reuse => 401 또는 409(정책 고정)

## P2-T3. POST /auth/logout
- SSOT: `paths./auth/logout.post`
- Evidence:
  - logout 후 refresh 실패

## P2-T4. Invite-only: POST /admin/invites + POST /auth/accept-invite
- Goal: 로그인 화면에 회원가입 버튼 없이, 초대 토큰으로만 가입
- SSOT:
  - `paths./admin/invites.post`
  - `paths./auth/accept-invite.post`
  - DB: `x-db.tables.invites`
- Evidence:
  - invite 생성 201 (token 1회 반환)
  - accept-invite 201
  - 같은 token 재사용 실패

---

# P3. Storage Volume + Read-only Mode

## P3-T1. POST /admin/volumes/validate-path
- Goal: base_path에 쓰기/용량 확인
- SSOT: `paths./admin/volumes/validate-path.post`
- Evidence:
  - 존재/권한 없는 경로 => 400
  - 정상 경로 => writable=true

## P3-T2. POST /admin/volumes (create) + GET /admin/volumes
- SSOT: `paths./admin/volumes.*`, `x-db.tables.volumes`
- Evidence:
  - create 201
  - list에 포함

## P3-T3. GET/PATCH /admin/system-mode (read-only)
- Goal: read-only 켜면 mutating API가 403/409로 막힘
- SSOT:
  - `paths./admin/system-mode.*`
  - 상태머신: `x-state-machines.SystemMode`
- Evidence:
  - read_only=true 설정
  - 예: `POST /nodes/folders` 가 실패하는 케이스 포함

---

# P4. Drive Tree Core(폴더/파일 노드)

## P4-T1. POST /nodes/folders
- SSOT: `paths./nodes/folders.post`, `x-db.tables.nodes`
- Evidence:
  - 폴더 생성 201
  - 동일 parent/name 중복 => 409

## P4-T2. GET /nodes/{id} + GET /nodes/{id}/children
- SSOT: `paths./nodes/{node_id}.get`, `paths./nodes/{node_id}/children.get`
- Evidence:
  - children pagination cursor 동작
  - include_deleted=false 기본 확인

## P4-T3. Rename/Move/Copy
- SSOT: `paths./nodes/{node_id}/rename`, `/move`, `/copy`
- Evidence:
  - 작은 트리에서 즉시 처리 200
  - 큰 트리(옵션)에서는 202(Job) 반환 가능(정책 고정)

---

# P5. Upload(청크 업로드 E2E) + 정전/복구 기반

## P5-T1. POST /uploads (세션 생성, dedup 힌트)
- SSOT: `paths./uploads.post`, `x-db.tables.upload_sessions`
- Evidence:
  - create 201
  - sha256 지정 시 dedup_hit 여부 검증(환경에 따라 false 가능)

## P5-T2. PUT /uploads/{id}/chunks/{i} (멱등)
- SSOT: `paths./uploads/{upload_id}/chunks/{chunk_index}.put`
- Evidence:
  - 같은 chunk 재업로드 시 성공 + 상태 일관
  - checksum 불일치 => 400

## P5-T3. POST /uploads/{id}/complete (merge)
- SSOT: `paths./uploads/{upload_id}/complete.post`
- Evidence:
  - complete 200, node_id/blob_id 반환
  - 실제 다운로드 sha256 == 기대 sha256 (fs 증거 포함)

## P5-T4. Startup Reconciler(부팅 시 찌꺼기 정리)
- SSOT: `x-state-machines.UploadSession.startup_reconciler`
- Evidence:
  - 강제로 status=MERGING 세션 생성 → 서버 재시작 → cleanup/failed 처리 확인(DB+FS)

---

# P6. Download(Range 포함)

## P6-T1. GET /nodes/{id}/download 200/206/416
- SSOT:
  - `paths./nodes/{node_id}/download.get`
  - RFC Range 처리(206/416)
- Evidence:
  - Range=bytes=0-9 => 206 & length 10
  - Range=bytes=999999999- => 416

---

# P7. Trash/GC

## P7-T1. DELETE /nodes/{id} → Trash
- SSOT: `paths./nodes/{node_id}.delete`
- Evidence:
  - 삭제 후 /trash 목록에 나타남

## P7-T2. Restore
- SSOT: `paths./trash/{node_id}/restore.post`
- Evidence:
  - restore 후 정상 트리로 복귀

## P7-T3. Permanent delete (Hard delete + ref_count)
- SSOT:
  - `paths./trash/{node_id}.delete`
  - DB: `x-db.tables.blobs.ref_count`
- Evidence:
  - hard delete 후 blob ref_count 감소
  - ref_count==0이면 물리파일 삭제(옵션)

---

# P8. Share Link(만료/비번)

## P8-T1. POST /nodes/{id}/share-links
- SSOT: `paths./nodes/{node_id}/share-links.post`, `x-db.tables.share_links`
- Evidence:
  - 생성 201, token 1회 반환
  - expires_at 적용

## P8-T2. Public GET /s/{token} + download
- SSOT: `paths./s/{token}.get`, `paths./s/{token}/download.get`
- Evidence:
  - 비밀번호 없으면 바로 접근
  - 비밀번호 설정 시 비번 없으면 403, 헤더 제공 시 200

---

# P9. ACL(상속/효율)

## P9-T1. GET/PUT /nodes/{id}/acl
- SSOT: `paths./nodes/{node_id}/acl.*`, `x-db.tables.acl_entries`
- Evidence:
  - ACL 설정 후 접근권한 변화 확인

## P9-T2. GET /nodes/{id}/access (effective)
- SSOT: `paths./nodes/{node_id}/access.get`
- Evidence:
  - user별 allowed 액션이 기대와 동일

---

# P10. Search(pg_trgm 기반)

## P10-T1. GET /search
- SSOT:
  - `paths./search.get`
  - DB: `x-db.extensions_required` includes pg_trgm
  - Index: `idx_nodes_name_trgm`
- Evidence:
  - 오타/부분일치 검색이 동작(ILIKE/trgm 기반)
  - limit/cursor 적용

---

# P11. Media(썸네일) + QoS 자동조절

## P11-T1. GET /media/{id}/thumbnail (202→200)
- SSOT: `paths./media/{node_id}/thumbnail.get`, Job 상태머신
- Evidence:
  - 최초 호출 202(Job) → 완료 후 200 이미지

## P11-T2. QoS Controller(자동 조절)
- SSOT: `x-constants.qos`, `GET /system/performance`
- Evidence:
  - 부하 인위적으로 증가시키면(예: stress) allowed.bg_worker_concurrency 감소
  - idle 시 증가(캡 이하)

---

# P12. Migration/Scan Cleanup

## P12-T1. POST /admin/migrations
- SSOT: `paths./admin/migrations.post`
- Evidence:
  - job 생성 202
  - 진행률/완료 확인(/jobs/{id})

## P12-T2. POST /admin/storage/scan (고아 정리)
- SSOT: `paths./admin/storage/scan.post`
- Evidence:
  - orphan 발견/보고(삭제 옵션 off)
  - delete_orphan_files=true 시 실제 삭제(테스트 환경에서)

---

## 3. UI(외주 Stitch 연동) 피스(백엔드와 분리)
UI는 백엔드 안정 후 진행하거나 병렬로 진행하되, “컴포넌트 재사용”을 강제합니다.

- UI-P1: ui-kit 토큰/컴포넌트(버튼, 입력, 테이블, 트리, 다이얼로그)
- UI-P2: 파일 탐색기(가상 스크롤) + 업로드 큐
- UI-P3: 공유/권한/설정 페이지

> UI의 증거는 “스크린샷”이 아니라 Storybook 빌드/스냅샷 테스트(또는 Playwright headless)로 제출.

---

## 4. 컴포넌트 문서화(검색/AI 활용에 좋은 방식)
- **Storybook + MDX**: 컴포넌트 사용법/props/상태를 MDX로 명시
- **Typed Props(Typescript)**: props가 “계약”이 되게
- **예제 우선**: `examples/`에 최소 사용 예제 2개씩
- **검색 친화**:
  - 컴포넌트 상단에 `@keywords` 주석(검색용)
  - “왜 이 컴포넌트가 존재하는지” 3줄로 요약

## Loop prevention rules
- TaskID 결정 규칙(결정적): headRefName ^feature/((UI-)?P[0-9]+-T[0-9]+)- 우선, 없으면 PR title [(UI-)?Pxx-Ty]. 둘 다 없으면 STOP.
- MERGED TaskID = DONE sticky (resume/PR 생성/회귀 금지).
- post-merge main CI failure ≠ task regression (infra/integration incident로 보고).
- resume dirty는 evidence/** 한정 (그 외 변경 있으면 STOP).
- PR 생성은 TaskID 확정 + evidence PASS + nonzero commits 3조건.
- infra 확정은 동일 PR에서 rerun 1회 후 같은 실패 클래스 반복일 때만.

## CHANGELOG
- 2026-02-28: loop prevention hardening

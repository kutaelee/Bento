# Nimbus Drive — Unified Playbook Pack (Merged, Conflict-Free)

> Generated: 2026-03-02T00:00:00+09:00 (Asia/Seoul)
> Sources: Evidence Playbook (P0–P12), Evidence Playbook (P13+ UI/Refactor), TDD Addendum, IA_NAV SSOT, COPY_KEYS SSOT, UI-Kit Design Fidelity Playbook (P20–P23)


## Table of Contents
1. SSOT & Conflict Resolution Rules
2. Operating Rules (Global)
3. Evidence Standard (TDD Addendum)
4. Development Playbook — P0 to P12 (Backend/Core)
5. UI + Refactor Playbook — P13 to P19
6. UI-Kit Fidelity Playbook — P20 to P23
7. UI SSOT: Navigation & IA (IA_NAV_SSOT)
8. UI SSOT: Copy & i18n Keys (COPY_KEYS_SSOT)
9. Change Log

## 1. SSOT & Conflict Resolution Rules

### 1.1 Priority order (strong → weak)
1) `openapi/openapi.yaml` — API contract + state machines + DB/indexes (highest SSOT)
2) `docs/NAS_SelfHosted_DDD_Spec_FINAL.md` — domain policies/defaults
3) **This unified playbook pack** (task sequencing + operating rules)
4) `docs/NAS_OpenClaw_TDD_Addendum_FINAL.md` — evidence format & pass/fail rules
5) UI references (Stitch):
   - `design/stitch/ko-kr_final/inventory/`
   - `design/stitch/ko-kr_final/pages|modals|states|ui-kit_tokens/`

If any two sections conflict, the higher item above wins.

### 1.2 Unified “PASS” definition (tooling compatibility)
A task is **PASS** only when `evidence/<P>/<T>/summary.json` satisfies **both**:
- top-level `"pass": true`
- top-level `"result": "PASS"`

This unifies legacy checks that may look for either field.

### 1.3 UI hard constraints (non-negotiable)
- No hardcoded user-facing strings: **i18n keys only** (`COPY_KEYS_SSOT`).
- No page-level px/hex “tweaks”: use **ui-kit tokens/components only** (composition-only pages).
- Evidence is **CLI-based** (storybook build/typecheck/lint/headless/visual-regression). Screenshots are not acceptance evidence.

## 2. Operating Rules (Global)

### 2.1 Task sizing
- 1 Task = 1 small goal + 1 evidence bundle.
- Do not mix: (API + UI + migration) in one task.
- Do not mix: feature changes + refactor changes in one task.

### 2.2 Pre-flight (every task)
MUST confirm:
- SSOT (OpenAPI) is present for the operations being implemented.
- Evidence commands are deterministic / reproducible.
- Working tree and runtime are clean (no leftover dev servers, runners, locks).

### 2.3 Evidence-first closure
- Write contract/test first (FAIL is expected at first).
- Implement minimal change to satisfy SSOT.
- Run task-local evidence (`evidence/<P>/<T>/run.sh`) and produce `summary.json` PASS.
- Only then push/PR.

### 2.4 UI work isolation
For UI tasks (P13+ and P20+):
- Prefer `EVIDENCE_SCOPE=ui` (avoid running full backend suites unnecessarily).
- Enforce module direction: `ui -> ui-kit` only; pages should compose, not duplicate components.

## 3. Evidence Standard (TDD Addendum)

# NAS OpenClaw TDD Addendum (FINAL)

## Mandatory
- Evidence는 아래 규칙을 준수한 구현에 대해서만 인정됩니다.
  - `.openclaw/skills/clean-code-enforcer/INSTRUCTIONS.md`
- UI 검증은 스크린샷이 아니라, 가능한 경우 Storybook 스모크/타입체크/린트 등 CLI 기반으로 수행합니다.


> 목적: “스크린샷”이 아니라 **CLI 테스트 결과**로만 태스크를 닫는다.  
> 규칙: **기댓값(expected)** 과 **실제값(actual)** 이 다르면 무조건 실패 → 재구현.

---

## 0. SSOT 연결 규칙
- API 계약/스키마/에러: `openapi/openapi.yaml` (SSOT)
- 테스트는 SSOT를 “근거”로 한다.
- 구현이 SSOT와 다르면 **구현이 잘못된 것**이다. (SSOT 먼저 수정 후 구현)

---

## 1. 증거(Evidence) 번들 표준 구조(필수)

태스크 하나(Piece/Task) 완료 시, 아래 폴더가 반드시 생성되어야 합니다.

```
/evidence/<piece_id>/<task_id>/
  expected.md                # 이 태스크의 합격 기준(사람이 읽는 문서)
  cases/                     # 계약 테스트 케이스(구조화)
    *.case.yaml
  run.sh                     # 실행 커맨드(재현 가능해야 함)
  actual/                    # 실제 실행 결과
    http/                    # curl 결과, status/header/body
    db/                      # psql 출력(필요 시)
    fs/                      # ls/find/sha256sum 출력(필요 시)
    logs/                    # server/worker 로그(필요 시)
  junit.xml                  # 테스트 러너 결과(가능하면)
  summary.json               # 자동 요약(필수): pass/fail, 근거 경로
```

### 1.1 `summary.json` 필수 필드
- `piece_id`, `task_id`
- `result`: `"PASS" | "FAIL"`
- `checks`: 배열 (각 체크에 대해)
  - `name`
  - `expected`
  - `actual_path`
  - `pass` (boolean)

---

## 2. “계약 테스트 케이스” 포맷(SSOT 기반)

`/evidence/<piece>/<task>/cases/*.case.yaml` 는 아래 스키마를 따른다:

```yaml
id: P1-T1-LOGIN-001
name: 로그인 성공 케이스
depends_on: [] # 선행 케이스 id (선택)
request:
  method: POST
  url: /auth/login
  headers:
    Accept-Language: ko-KR
    Content-Type: application/json
  body:
    username: admin
    password: "admin1234!"
expect:
  status: 200
  assertions:
    - type: jq
      expr: '.user.username == "admin"'
    - type: jq
      expr: '.tokens.token_type == "Bearer"'
    - type: jq
      expr: '.tokens.expires_in_seconds > 0'
```

### 2.1 Assertion 타입(최소 지원)
- `jq`: JSON 응답을 jq 표현식으로 검증(참/거짓)
- `regex`: 문자열/헤더를 정규식으로 검증
- `equals`: 완전일치(정적 값에만)

### 2.2 동적 값 처리 원칙(토큰 등)
- access_token 같은 비결정 값은 “존재/형식/길이”로 검증한다.
- 예: `jq expr: '(.tokens.access_token | length) > 20'`

---

## 3. 테스트 실행 규칙(명시적으로 강제)

### 3.1 실행 원칙
- 테스트는 **단일 커맨드로 재현 가능**해야 함 (`run.sh`)
- 서버/DB/워커는 테스트 환경으로 띄운 뒤 실행
- 통과/실패는 자동 판단한다.
- PASS 못 만들면 중단 + 실패 보고, 무한루프 금지
- **PR에 푸시하기 전: 해당 `evidence/<P>/<T>/run.sh` 1회 실행으로 PASS를 확인한다. `scripts/run_evidence.sh`는 PR 후/최종 검증에서만 실행한다.**
- 로컬 CI 실패 시 1회 런에서 **최대 2회** 수정→재실행까지만 시도하고, 이후에는 다음 런으로 넘기며 보고한다.

### 3.2 실패 판정(자동)
아래 중 하나라도 발생하면 FAIL:
- 기대 status != 실제 status
- jq assertion 하나라도 false
- DB/FS 증거가 기대와 불일치
- `junit.xml`에서 fail 1개라도 존재

### 3.3 2-Lane 검증(권장, 시간 최적화)
목표는 **개발 중 루프는 매우 짧게(Fast lane)**, **태스크 완료 판정은 느리더라도 확실하게(Slow lane)** 분리하는 것입니다.

- **Fast lane**: 5~20초 목표(권장)
  - DB 없이 가능한 검증으로 구성: lint / typecheck / unit tests / OpenAPI validate.
  - PR/로컬에서 자주 실행해 실수를 빠르게 포착.
  - Fast lane PASS는 태스크 완료 근거가 아니다. (`summary.json` PASS와 동일하지 않음)

- **Slow lane**: 30초~2분+ 통합 증거
  - 실행 시점: 태스크 완료 선언/PR 업데이트 직전에 1~2회만.
  - 구성: `compose up` + DB migrate/seed + API contract cases + 정리(cleanup).
  - 판정은 `/evidence/<piece>/<task>/summary.json`에서만 최종 확정.

태스크 완료/PR 갱신의 고정 기준:
- `pass=true` **그리고** `result="PASS"`.

도커/DB 시간 최적화(의존 제거 아님):
- 컨테이너 재사용(케이스별로 up/down 반복 지양)
- migrate/seed는 스키마/데이터 변경 시에만 실행(해시/마커 기반 스킵 허용)
- readiness는 `pg_isready` 또는 `psql -c 'select 1'`로 빠르게 판정
- 캐시 활용(필수 테스트 환경 격리 유지 범위 내에서)
- 케이스는 최소화(해피 + 오류 케이스 중심, 오버테스트 지양)

Playbook 정합성:
- 이 규칙은 Playbook의 `run.sh` 중심 실행 후, PR 생성 전에는 task 단위 `run.sh`를 통한 로컬 PASS 확인, 그리고 PR 후 필요 시 `scripts/run_evidence.sh`로 최종 정합성 확인하는 흐름과 정렬되어야 한다.

---

## 4. 최소 필수 테스트 세트(“빠짐 방지”)

### 4.1 엔드포인트별 최소 테스트(권장 기준)
각 OpenAPI operation마다 최소 2개:
- Happy-path 1개 (정상)
- Permission/Invalid 1개 (401/403/400 등)

### 4.2 크리티컬 도메인 테스트(필수)
- First-time setup: `GET /setup/status`, `POST /setup/admin`
- Invite-only: `POST /admin/invites`, `POST /auth/accept-invite`
- Upload: `POST /uploads` → chunk 업로드 → `POST /complete` → 다운로드 검증
- Reconciler: “stuck upload session” 정리 시나리오
- Volume: validate-path / migration / activate
- Range download: 206/416 케이스 최소 1개

---

## 5. CLI 기반 증거 제출 예시(요구하신 스타일)

> 예시는 “사람이 읽는 expected.md”에 들어갈 템플릿입니다.

### 예시 1) API(GET)
- API(GET): `/setup/status`  
- 기대: `setup_required == true` (DB가 빈 상태)  
- 검증 커맨드:
  - `curl -s http://localhost:8080/setup/status | jq '.setup_required'`
- 기대 출력:
  - `true`

### 예시 2) API(POST)
- API(POST): `/auth/login`
- 요청(axios 예시):
  - `axios.post('/auth/login', { username: 'admin', password: 'admin1234!' })`
- 기대:
  - status `200`
  - `.user.username == "admin"`
  - `.tokens.token_type == "Bearer"`

---

## 6. OpenClaw 작업 루프(필수 운영 규칙)
태스크 단위로 아래를 고정:

1) **SSOT 확인**: OpenAPI에 operation/스키마/에러가 정의되어 있는가?  
2) **테스트 케이스 작성(FAIL이 떠야 정상)**  
3) 구현  
4) 테스트 PASS  
5) `/evidence/...` 번들 생성  
6) `summary.json result=PASS` 후 태스크 닫음

---

## 7. 추천 도구(완주 확률↑)
- HTTP 검증: `curl`, `jq`
- 테스트 러너: Jest/Vitest(선택), JUnit 출력
- DB 검증: `psql -c ...`
- 파일 검증: `sha256sum`, `stat`, `find`
- OpenAPI 스키마 검증: (선택) OpenAPI validator, 스키마 기반 계약 테스트

> 핵심은 “도구”가 아니라 **기대값 대비 자동 FAIL**이 가능한 구조입니다.

## 4. Development Playbook — P0 to P12 (Backend/Core)

# NAS OpenClaw Evidence Playbook (FINAL)

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

## 5. UI + Refactor Playbook — P13 to P19

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

## 6. UI-Kit Fidelity Playbook — P20 to P23

NAS UI-Kit Design Fidelity Playbook (P20~P23)

PLAYBOOK_VERSION: 2026-03-02.v1
Goal: Nimbus Drive Web 전체 라우트(/files, /admin 등)에서 ui-kit 적용률 100% + Stitch 최종안 fidelity 확보.
Approach: “페이지별 임시 UI 제거 → ui-kit 조합으로 통일 → 시안 누락분은 ‘파생(derived) 디자인 스펙’ 생성 → CLI 기반 시각 회귀(visual regression) 증거로 닫기”

0) SSOT 우선순위(강 → 약)

docs/ui/IA_NAV_SSOT.md (라우팅/IA 고정)

docs/ui/COPY_KEYS_SSOT.md (카피/i18n 키 고정)

design/stitch/ko-kr_final/inventory/ (완성도 체크리스트)

design/stitch/ko-kr_final/pages|modals|states|ui-kit_tokens/ (UI 레퍼런스)

1) 글로벌 규칙(HARD)

금지: 페이지에서 px 하드코딩/인라인 스타일로 “그럴듯하게 맞추기”

필수: packages/ui-kit 토큰/컴포넌트만으로 구성(레이아웃 포함)

필수: i18n 키 사용(문자열 하드코딩 금지)

필수: 상태(loading/empty/error/forbidden) 표준화 + 페이지별 동일 패턴

증거(Evidence): 가능하면 Storybook/타입체크/린트 + 시각 회귀 테스트(픽셀 diff) 를 CLI로 PASS 처리

스펙 생성 원칙(누락 페이지):

새 컬러/새 간격 스케일 발명 금지

기존 패턴(동일 IA 섹션의 페이지)에서 레이아웃/컴포넌트 조합을 재사용

“derived 디자인”은 원본 Stitch를 덮지 않고 추가 파일로만 기록

2) 파생(derived) 디자인 스펙 저장 규칙

시안에 없는 페이지/상태를 생성해야 할 때, 아래 경로로만 추가:

design/stitch/ko-kr_final/derived/pages/<route>.md

design/stitch/ko-kr_final/derived/states/<route>__<state>.md

design/stitch/ko-kr_final/inventory/_derived_checklist.md (누락분 채움 기록)

각 derived 스펙 템플릿(최소):

목적(페이지가 해결하는 유저 작업)

레이아웃(그리드/영역: Sidebar/Topbar/Toolbar/Content/Inspector)

사용 컴포넌트(ui-kit 이름 기준)

토큰(typography/space/radius/color 사용 범위)

상태 4종: loading / empty / error / forbidden

카피 키 목록(COPY_KEYS_SSOT 참조 키만)

3) Evidence(UI Fidelity) 표준 번들(권장)

각 Task마다 아래 중 최소 2개 이상 PASS:

pnpm -C packages/ui-kit lint && pnpm -C packages/ui-kit test

pnpm -C packages/ui lint && pnpm -C packages/ui test

pnpm -C packages/ui-kit storybook:build (또는 storybook smoke)

pnpm -C packages/ui test:visual (Playwright 등 픽셀 diff 기반, CLI PASS/FAIL)

스크린샷 “수동 비교”는 QA 참고로만. Task 완료 판정은 CLI PASS로만.

Piece P20 — Foundation (토큰/프레임/공통 컴포넌트/시각회귀)
P20-T0. 라우트×디자인 인벤토리 매핑 SSOT 생성

Goal: IA 라우트 전부를 “디자인 커버 여부”로 매핑해 누락을 수치화

Inputs(SSOT): docs/ui/IA_NAV_SSOT.md, design/stitch/ko-kr_final/inventory/

Outputs(SSOT):

design/stitch/ko-kr_final/inventory/route_coverage.md (표 형태)

design/stitch/ko-kr_final/inventory/_derived_checklist.md (누락 목록)

Acceptance:

IA의 모든 route가 coverage 표에 1:1로 존재

각 route에 “Stitch 존재/derived 필요/이미 구현됨(추정)” 상태가 기록됨

Evidence: evidence/P20/P20-T0/run.sh가 coverage 파일 존재/포맷 검증 PASS

P20-T1. ui-kit 토큰 “잠금”(디자인→CSS Vars/TS) + 누락 토큰 정리

Goal: 디자인 토큰을 ui-kit로 완전히 흡수하고, 페이지 구현은 토큰만 사용

Inputs(SSOT): design/stitch/ko-kr_final/ui-kit_tokens/

Scope(권장): packages/ui-kit/src/tokens/, packages/ui-kit/src/styles/global.css

Acceptance:

컬러/타이포/스페이싱/라운드/섀도우 토큰을 전부 ui-kit에서 export

페이지에서 raw hex/px 하드코딩 사용량이 “감소 추세”로 전환

Evidence: storybook build + ui-kit test PASS

P20-T2. AppShell(레이아웃) 단일화: Sidebar/Topbar/Content/Inspector

Goal: 모든 페이지가 동일한 프레임 컴포넌트를 공유

Inputs(SSOT): docs/ui/IA_NAV_SSOT.md, Stitch 레이아웃 레퍼런스

Outputs:

packages/ui/src/app/AppShell.tsx(또는 동등) 기반 통합

Acceptance:

/files, /admin, /login 등에서 프레임 불일치 제거(예: 패딩/간격/헤더 높이)

우측 상세 패널(Inspector)이 존재하는 페이지는 동일 컴포넌트 사용

Evidence: UI lint/test + 최소 3 route 시각회귀 PASS

P20-T3. 공통 UI 패턴 컴포넌트화(페이지에서 조합만)

Goal: 페이지별 “임시 UI 조립” 제거

Deliverables(ui-kit 또는 ui 공통):

PageHeader(타이틀/브레드크럼/액션)

Toolbar(검색/필터/정렬)

DataTable(열/행/빈상태/로딩스켈레톤)

EmptyState, ErrorState, ForbiddenState, LoadingSkeleton

DetailInspector(우측 패널)

Acceptance:

Core 페이지(/files, /recent 등) 최소 2개가 신규 공통 컴포넌트만 사용

Evidence: storybook에 컴포넌트 스토리 추가 + 시각회귀 PASS

P20-T4. Visual Regression Harness (라우트 스냅샷)

Goal: “디자인 반영”을 숫자로 고정(회귀 방지)

Requirements:

라우트별 스냅샷(1440 desktop) + 상태별 스냅샷(loading/empty/error/forbidden)

데이터 고정(seed/mock)로 flaky 제거

Acceptance:

최소 /files, /login, /admin 3개 라우트가 픽셀 diff 기준 PASS

Evidence: pnpm -C packages/ui test:visual PASS + diff 산출물 없음

Piece P21 — Core Pages (/files, /search, quick links)

각 Task 공통 규칙:
(1) 해당 route가 Stitch inventory에 없으면 derived 스펙을 먼저 생성
(2) 페이지 구현은 ui-kit 조합만
(3) 상태 4종 표준화
(4) 시각회귀 + lint/test PASS

P21-T1. /files (기본 파일 탐색기) ui-kit 100% 적용

Derived 필요 시: design/.../derived/pages/files.md

Acceptance: 테이블/툴바/우측 패널/빈폴더/업로드 에러 상태가 표준 컴포넌트로 통일

Evidence: visual PASS + ui test PASS

P21-T2. /files/:nodeId (폴더) + Breadcrumb/ContextMenu 일관화

Acceptance: 브레드크럼/경로 이동/폴더 액션 UI가 /files와 동일 패턴

Evidence: visual PASS

P21-T3. /search?q= 검색 결과 페이지 통일

Acceptance: 검색 입력/필터/정렬/결과 테이블이 공통 Toolbar/DataTable 패턴 사용

Evidence: visual PASS

P21-T4. /recent 최근 페이지 통일
P21-T5. /favorites 즐겨찾기 페이지 통일
P21-T6. /shared 공유됨 페이지 통일
P21-T7. /media 미디어 페이지 통일
P21-T8. /trash 휴지통 페이지 통일

각 Acceptance(공통):

헤더/툴바/리스트/빈상태/에러상태가 동일 패턴

COPY_KEYS_SSOT 키 사용(하드코딩 제거)

Evidence(각각): visual PASS + 최소 lint PASS

Piece P22 — Auth / Onboarding (/login, /setup, /invite)
P22-T1. /login 시안 fidelity 적용(타이포/간격/버튼/에러)

Derived 필요 시: derived/pages/login.md, derived/states/login__error.md

Acceptance: 폼 필드/에러 메세지/CTA 버튼/로딩 상태가 ui-kit 규격

Evidence: visual PASS

P22-T2. /setup 최초 관리자 생성 페이지 통일

Acceptance: “온보딩 레이아웃” 규격(폭/카드/step UI) 고정

Evidence: visual PASS

P22-T3. /invite/accept?token= 초대 수락 + 토큰 에러 상태

Acceptance: 정상/만료/무효/이미사용 상태 UI가 ErrorState 표준 컴포넌트로 통일

Evidence: visual PASS

Piece P23 — Admin Settings (/admin/*)
P23-T0. Admin Shell(좌측 섹션/헤더/폼 레이아웃) 단일화

Goal: Stripe 스타일 설정 IA를 ui-kit로 고정

Acceptance:

/admin 하위 모든 페이지가 동일한 SettingsShell 사용

섹션 타이틀/설명/폼 필드 간격/구분선 패턴 고정

Evidence: /admin + /admin/users visual PASS

P23-T1. /admin 설정 홈(대시보드) 통일
P23-T2. /admin/users 사용자/초대 통일
P23-T3. /admin/storage 볼륨 관리 통일
P23-T4. /admin/migration 마이그레이션 통일
P23-T5. /admin/performance 성능/QoS 통일
P23-T6. /admin/jobs 백그라운드 작업 통일
P23-T7. /admin/audit 활동/감사 로그 통일
P23-T8. /admin/security 공유/보안 정책 통일
P23-T9. /admin/appearance 언어/테마 통일

각 Acceptance(공통):

SettingsShell + 표준 FormSection(제목/설명/컨트롤) 사용

목록형 페이지는 DataTable 패턴, 설정형 페이지는 Form 패턴 고정

loading/empty/error/forbidden 상태가 표준 컴포넌트

Evidence(각각): visual PASS (최소 1 상태 포함) + ui lint PASS

4) 완료 정의(Definition of Done)

IA 라우트 전체가 ui-kit 기반 프레임/컴포넌트 로 동작

route coverage 표에서 “derived 필요”가 0 또는 모두 derived 스펙 생성 완료

visual regression이 최소:

Core 8 routes 중 5+

Auth 3 routes 중 2+

Admin 10 routes 중 5+
를 PASS (나머지는 단계적으로 확대)

페이지별 인라인 스타일/임시 컴포넌트가 “추세적으로” 제거(완전 0이 목표)

## 7. UI SSOT: Navigation & IA (IA_NAV_SSOT)

# IA_NAV_SSOT — Nimbus Drive Navigation & IA (SSOT)

이 문서는 **메뉴/내비게이션/설정 섹션 구조의 단일 진실 원천(SSOT)** 입니다.  
Stitch 보드의 메뉴가 흔들리더라도, **구현은 항상 이 문서를 우선**합니다.

- P13부터 UI 구현이 시작되며, `docs/NAS_OpenClaw_Evidence_Playbook_P13_UI_Refactor.md`를 따른다.

- 기본 언어: **ko-KR**
- 영어(en-US): 설정에서만 토글 가능(키는 동일)

---

## 0) 적용 범위와 우선순위

우선순위(상위가 더 강함):
1) `docs/ui/IA_NAV_SSOT.md`  ✅ (이 문서)
2) `docs/ui/COPY_KEYS_SSOT.md` (카피/i18n 키)
3) `design/stitch/ko-kr_final/inventory/` (완성도 체크)
4) `design/stitch/ko-kr_final/pages|modals|states|mobile|ui-kit_tokens/` (UI 레퍼런스)

---

## 1) Web (Desktop 1440) 전역 레이아웃 고정

### 1.1 좌측 사이드바(고정 영역)
**구성 순서(변경 금지):**
1) Workspace / Drive Switcher
2) Quick Links
3) Folder Tree
4) Admin/Settings (권한 기반)
5) Footer(계정/상태)

#### Quick Links (고정)
- 파일
- 최근
- 즐겨찾기
- 공유됨
- 미디어
- 휴지통

#### Folder Tree
- “내 드라이브” 루트 아래 트리(무한 중첩)
- 우클릭/컨텍스트 메뉴: 새 폴더, 업로드, 이름 변경, 이동, 삭제, 권한

#### Admin/Settings (관리자만 표시)
- 관리자 설정(⚙️)

### 1.2 상단바(고정)
- 브레드크럼 (현재 경로)
- 전역 검색 / 명령 팔레트 (Cmd/Ctrl + K)
- Primary Actions: [새로 만들기] [업로드] [공유]
- 사용자 메뉴(프로필/설정/로그아웃)

### 1.3 본문(고정)
- 뷰 토글: 리스트 / 그리드
- 정렬: 이름/수정일/크기
- 필터: 타입(폴더/문서/이미지/비디오)
- 무한 스크롤(가상화 전제)
- 선택 시 우측 인스펙터 패널(Details/Share/Permissions/Activity)

---

## 2) Web 페이지 라우팅(정규 경로)

### 2.1 Core
- `/files` : 파일 탐색기(기본)
- `/files/:nodeId` : 특정 폴더
- `/search?q=` : 전역 검색 결과
- `/recent`
- `/favorites`
- `/shared`
- `/media`
- `/trash`

### 2.2 Auth / Onboarding
- `/login`
- `/setup` : 최초 1회 관리자 생성(DB empty일 때만)
- `/invite/accept?token=` : 초대 수락(토큰 기반)

### 2.3 Admin Settings (관리자만)
- `/admin` : 설정 홈(대시보드)
- `/admin/users` : 사용자/초대
- `/admin/storage` : 볼륨 관리
- `/admin/migration` : 마이그레이션(읽기전용 포함)
- `/admin/performance` : 성능/QoS(자동조절 상태)
- `/admin/jobs` : 백그라운드 작업(큐/실패/재시도)
- `/admin/audit` : 활동/감사 로그
- `/admin/security` : 공유/보안 정책
- `/admin/appearance` : 언어/테마

> 구현 언어/라우터는 주제에 맞게 달라질 수 있으나, **경로 개념과 IA는 고정**입니다.

---

## 3) Settings IA (Stripe 스타일 섹션 트리)

### 3.1 Settings Home (`/admin`)
섹션 카드 6개:
1) 사용자 및 초대
2) 저장소 및 마이그레이션
3) 성능 / QoS
4) 백그라운드 작업
5) 보안 / 공유 정책
6) 언어 / 외관

### 3.2 Users (`/admin/users`)
탭(고정):
- 사용자
- 초대 링크

### 3.3 Storage (`/admin/storage`)
블록(고정):
- 활성 볼륨
- 볼륨 목록
- 경로 검증(쓰기 테스트/용량)
- 저장소 스캔/정리(고아 파일)

### 3.4 Migration (`/admin/migration`)
블록(고정):
- Read-only 전환 상태
- 진행률/로그
- 중단/재개(가능한 경우)
- 완료 확인

### 3.5 Performance (`/admin/performance`)
블록(고정):
- Capabilities(코어/램/디스크)
- QoS 상태(백그라운드 동시성/레이트 제한)
- 프로필(ECO/BALANCED/PERFORMANCE/CUSTOM)
- “PC 부담 없음” 원칙 설명(자동 조절)

### 3.6 Jobs (`/admin/jobs`)
탭(고정):
- 큐
- 실행 중
- 실패(재시도)
- 완료

### 3.7 Audit (`/admin/audit`)
필터(고정):
- 주체(사용자)
- 이벤트 타입(파일/권한/공유/로그인)
- 기간

### 3.8 Security (`/admin/security`)
블록(고정):
- 공유 링크 기본값(만료/비밀번호)
- 외부 노출 경고(포트포워딩)
- 세션/토큰 정책 요약

### 3.9 Appearance (`/admin/appearance`)
블록(고정):
- 언어 (ko-KR / en-US)
- 테마 (라이트/다크/시스템)
- 시간/날짜 표기 옵션

---

## 4) Mobile IA (하단 탭 고정)

탭(고정, 순서 변경 금지):
1) 파일
2) 업로드
3) 설정

Mobile 경로 개념:
- Files: 폴더 탐색 + 검색
- Uploads: 업로드 큐 + 최근 활동
- Settings: 언어/테마(기본), 계정, (관리자면) 주요 설정 링크

---

## 5) 변경 프로세스(필수)
내비게이션 항목을 바꾸려면:
1) ADR 작성 (`docs/ADR/`)
2) 이 문서 수정
3) `COPY_KEYS_SSOT.md` 키 동기화
4) UI Kit/페이지 반영 + evidence(스모크/타입체크) 제출

끝.

## 8. UI SSOT: Copy & i18n Keys (COPY_KEYS_SSOT)

# COPY_KEYS_SSOT — Nimbus Drive Copy & i18n Keys (SSOT)

이 문서는 **UI 마이크로카피의 단일 진실 원천(SSOT)** 입니다.  
- 기본 언어: **ko-KR**
- 영어: **en-US** (설정에서 토글)
- 구현은 i18n 키를 사용하고, 문자열을 하드코딩하지 않습니다.

- P13부터 UI 구현이 시작되며, `docs/NAS_OpenClaw_Evidence_Playbook_P13_UI_Refactor.md`를 따른다. UI 문자열 하드코딩 금지/키 SSOT 준수는 기존 규칙 그대로.

---

## 0) 키 규칙

- 네임스페이스: `app`, `nav`, `action`, `field`, `msg`, `err`, `status`, `modal`, `admin`
- 점 표기: `nav.files`, `action.upload`
- UI에서 직접 문자열을 쓰지 말고 키만 참조
- 신규 키는 반드시 여기와 `locales/ko-KR.json`, `locales/en-US.json`에 동시에 추가

---

## 1) App (app.*)

| key | ko-KR | en-US |
|---|---|---|
| app.greeting | 안녕하세요, Nimbus Drive | Hello Nimbus Drive |

## 2) Navigation (nav.*)

| key | ko-KR | en-US |
|---|---|---|
| nav.files | 파일 | Files |
| nav.recent | 최근 | Recent |
| nav.favorites | 즐겨찾기 | Favorites |
| nav.shared | 공유됨 | Shared with me |
| nav.media | 미디어 | Media |
| nav.trash | 휴지통 | Trash |
| nav.settings | 관리자 설정 | Admin settings |

---

## 3) Common Actions (action.*)

| key | ko-KR | en-US |
|---|---|---|
| action.newFolder | 새 폴더 | New folder |
| action.upload | 업로드 | Upload |
| action.download | 다운로드 | Download |
| action.share | 공유 | Share |
| action.move | 이동 | Move |
| action.copy | 복사 | Copy |
| action.rename | 이름 변경 | Rename |
| action.delete | 삭제 | Delete |
| action.restore | 복원 | Restore |
| action.deleteForever | 영구 삭제 | Delete forever |
| action.retry | 재시도 | Retry |
| action.cancel | 취소 | Cancel |
| action.close | 닫기 | Close |
| action.save | 저장 | Save |
| action.apply | 적용 | Apply |
| action.signIn | 로그인 | Sign in |
| action.acceptInvite | 초대 수락 | Accept invite |
| action.loadMore | 더 불러오기 | Load more |
| action.refresh | 새로고침 | Refresh |
| action.validatePath | 경로 검증 | Validate path |
| action.createVolume | 볼륨 생성 | Create volume |
| action.activateVolume | 볼륨 활성화 | Activate volume |
| action.startMigration | 마이그레이션 시작 | Start migration |
| action.startScan | 스캔 시작 | Start scan |

---

## 4) Fields / Labels (field.*)

| key | ko-KR | en-US |
|---|---|---|
| field.search | 검색 | Search |
| field.name | 이름 | Name |
| field.modifiedAt | 수정일 | Modified |
| field.owner | 소유자 | Owner |
| field.size | 크기 | Size |
| field.permissions | 권한 | Permissions |
| field.username | 사용자명 | Username |
| field.password | 비밀번호 | Password |
| field.displayName | 표시 이름 | Display name |
| field.expiry | 만료일 | Expiry |
| field.path | 경로 | Path |
| field.destination | 대상 폴더 | Destination folder |
| field.freeSpace | 남은 용량 | Free space |
| field.totalSpace | 전체 용량 | Total space |
| field.status | 상태 | Status |
| field.active | 활성 | Active |
| field.fileSystem | 파일 시스템 | File system |
| field.targetVolumeId | 대상 볼륨 ID | Target volume ID |
| field.verifySha256 | SHA-256 검증 | Verify SHA-256 |
| field.deleteSourceAfter | 원본 삭제 | Delete source after |
| field.deleteOrphanFiles | 고아 파일 삭제 | Delete orphan files |
| field.deleteOrphanDbRows | 고아 DB 행 삭제 | Delete orphan DB rows |
| field.jobId | 작업 ID | Job ID |
| field.jobType | 작업 유형 | Job type |
| field.jobStatus | 작업 상태 | Job status |
| field.jobProgress | 진행률 | Progress |
| field.createdAt | 생성 시각 | Created at |
| field.startedAt | 시작 시각 | Started at |
| field.finishedAt | 완료 시각 | Finished at |

---

## 5) Status / Banners (status.*)

| key | ko-KR | en-US |
|---|---|---|
| status.readOnly | 읽기 전용 모드 | Read-only mode |
| status.migrating | 저장소 마이그레이션 진행 중 | Storage migration in progress |
| status.diskWaking | 디스크를 깨우는 중… | Waking up disk… |
| status.uploadPaused | 업로드 일시정지됨 | Upload paused |
| status.jobQueued | 대기 중 | Queued |
| status.jobRunning | 실행 중 | Running |
| status.jobDone | 완료 | Done |
| status.jobFailed | 실패 | Failed |
| status.jobCancelled | 취소됨 | Cancelled |
| status.jobTypeMigration | 마이그레이션 | Migration |
| status.jobTypeScanCleanup | 저장소 스캔 | Storage scan |
| status.ok | 정상 | OK |
| status.fail | 실패 | Failed |
| status.active | 활성 | Active |
| status.validation | 검증 | Validation |
| status.writable | 쓰기 가능 | Writable |
| status.volumeOk | 정상 | OK |
| status.volumeDegraded | 성능 저하 | Degraded |
| status.volumeOffline | 오프라인 | Offline |

---

## 6) Empty / Info Messages (msg.*)

| key | ko-KR | en-US |
|---|---|---|
| msg.emptyFolder | 이 폴더는 비어 있습니다. | This folder is empty. |
| msg.emptyRecent | 최근 항목이 없습니다. | No recent items. |
| msg.emptyFavorites | 즐겨찾기가 없습니다. | No favorites. |
| msg.emptyShared | 공유된 항목이 없습니다. | No shared items. |
| msg.emptySearch | 검색 결과가 없습니다. | No search results. |
| msg.emptyTrash | 휴지통이 비어 있습니다. | Trash is empty. |
| msg.dropToUpload | 여기에 파일을 끌어다 놓아 업로드하세요. | Drop files here to upload. |
| msg.changesSaved | 변경사항이 저장되었습니다. | Changes saved. |
| msg.loginTitle | 로그인 | Sign in |
| msg.inviteAcceptTitle | 초대 수락 | Accept invite |
| msg.inviteAcceptSubtitle | 계정을 생성해 초대를 완료하세요. | Create your account to finish the invite. |
| msg.inviteMissingToken | 초대 토큰이 없습니다. | Missing invite token. |
| msg.inviteExpired | 초대 링크가 만료되었습니다. | Invite link has expired. |
| msg.detailsTitle | 상세 정보 | Details |
| msg.selectItem | 항목을 선택하면 상세 정보가 표시됩니다. | Select an item to see details. |
| msg.noActiveVolume | 활성 볼륨이 없습니다. | No active volume. |
| msg.emptyVolumes | 등록된 볼륨이 없습니다. | No volumes yet. |
| msg.volumeCreated | 볼륨이 생성되었습니다. | Volume created. |
| msg.volumeActivated | 볼륨이 활성화되었습니다. | Volume activated. |
| msg.selectedVolume | 선택된 볼륨 | Selected volume. |
| msg.noVolumeSelected | 선택된 볼륨이 없습니다. | No volume selected. |
| msg.noJobs | 표시할 작업이 없습니다. | No jobs to display. |

---

## 7) Error Messages (err.*)

| key | ko-KR | en-US |
|---|---|---|
| err.unauthorized | 로그인 후 이용해 주세요. | Please sign in. |
| err.forbidden | 접근 권한이 없습니다. | You don't have permission. |
| err.notFound | 항목을 찾을 수 없습니다. | Item not found. |
| err.conflict | 이름 충돌이 발생했습니다. | Name conflict occurred. |
| err.rateLimited | 요청이 너무 많습니다. 잠시 후 다시 시도하세요. | Too many requests. Try again later. |
| err.network | 네트워크 오류가 발생했습니다. | Network error occurred. |
| err.validation | 입력값을 확인해 주세요. | Please check your input. |
| err.server | 서버 오류가 발생했습니다. | Server error occurred. |
| err.unknown | 알 수 없는 오류가 발생했습니다. | Something went wrong. |

---

## 8) Modals (modal.*)

| key | ko-KR | en-US |
|---|---|---|
| modal.share.title | 공유 | Share |
| modal.share.link | 공유 링크 | Share link |
| modal.share.requirePassword | 비밀번호 필요 | Require password |
| modal.share.setExpiry | 만료일 설정 | Set expiry |
| modal.delete.title | 삭제 확인 | Confirm delete |
| modal.delete.desc | 이 항목을 삭제하시겠습니까? | Delete this item? |
| modal.move.title | 이동 | Move |
| modal.copy.title | 복사 | Copy |
| modal.rename.title | 이름 변경 | Rename |
| modal.invite.title | 사용자 초대 | Invite user |
| modal.storageValidate.title | 저장 경로 확인 | Validate storage path |
| modal.cleanup.title | 저장소 정리 | Storage cleanup |
| modal.migrationStart.title | 마이그레이션 시작 | Start migration |
| modal.errorDetails.title | 오류 상세 | Error details |

---

## 9) Admin (admin.*)

| key | ko-KR | en-US |
|---|---|---|
| admin.users.title | 사용자 및 초대 | Users & invites |
| admin.storage.title | 저장소 관리 | Storage |
| admin.storage.activeTitle | 활성 볼륨 | Active volume |
| admin.storage.listTitle | 볼륨 목록 | Volumes |
| admin.storage.createTitle | 볼륨 생성 | Create volume |
| admin.storage.activateTitle | 볼륨 활성화 | Activate volume |
| admin.migration.title | 마이그레이션 | Migration |
| admin.performance.title | 성능 / QoS | Performance / QoS |
| admin.jobs.title | 백그라운드 작업 | Background jobs |
| admin.audit.title | 활동 로그 | Activity log |
| admin.security.title | 보안 및 공유 정책 | Security & sharing |
| admin.appearance.title | 언어 및 외관 | Language & appearance |

---

## 10) Notes
- 이 표는 최소 키 세트입니다. UI 구현 중 신규 문구가 필요하면:
  1) 키 추가
  2) ko/en 동시 채움
  3) 하드코딩 금지
- 긴 문장(설명/도움말)은 `msg.*`로 관리하고, 가능한 짧게 유지합니다.

끝.

## 9. Change Log

- 2026-03-02: Initial merged pack generated from the provided sources. Conflict rules and unified PASS definition added.

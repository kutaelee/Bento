요청하신 Nimbus Drive 리포지토리의 README 한국어 번역입니다. 기술적인 뉘앙스와 마크다운 서식을 원본에 맞게 최대한 살려 번역했습니다.

---

# Nimbus Drive

1~5인(개인/가족)을 위한 구축형(Self-hosted) NAS 웹 애플리케이션입니다. PC의 응답성을 유지해 주는 자동 성능 조정 기능을 통해 모든 기기에서 파일을 업로드, 탐색, 다운로드 및 공유할 수 있습니다.

---

## 주요 기능

### 핵심 기능

* **웹 파일 탐색기** — 폴더/파일 목록, 브레드크럼, 가상 스크롤(virtual-scroll), 목록/그리드 뷰
* **청크 분할 및 재개 가능한 업로드** — 멱등성 보장, 중복 제거 인식(SHA-256 CAS), 청크 크기 설정 가능
* **Range 지원 다운로드** — HTTP 206 부분 콘텐츠(partial content) 및 416 처리 지원
* **검색** — PostgreSQL `pg_trgm` 기반 퍼지(fuzzy)/부분 일치 검색
* **휴지통 및 가비지 컬렉션** — 보존 기간 설정이 가능한 소프트 삭제(soft-delete), 자동 하드 삭제(hard-delete) 및 백그라운드 블롭(blob) 참조 카운트 정리
* **공유 링크** — 시간 제한, 선택적 비밀번호, READ 또는 READ_WRITE 권한 부여
* **ACL (접근 제어 목록)** — 노드별, 상속 가능, 기본 거부(deny-by-default) 원칙 (USER / GROUP / SHARE_LINK 주체)
* **미디어 썸네일** — 백그라운드 작업(QoS 기반 스로틀링 적용)을 통한 온디맨드 생성

### 관리자 기능

* **최초 설정** — 일회성 초기 관리자 생성 (`POST /setup/admin`)
* **초대 전용 가입** — 공개 가입 불가; 관리자가 초대 토큰을 생성하고, 사용자는 `/invite/accept?token=`을 통해 수락
* **스토리지 볼륨** — 호스트 경로 등록, 검증, 활성화; 다중 볼륨 지원
* **마이그레이션** — 선택적 SHA-256 검증을 통한 볼륨 간 블롭 이동
* **스토리지 스캔 / 정리** — 고아(orphan) 파일 및 DB 행(row) 탐지 및 선택적 삭제
* **백그라운드 작업 대시보드** — THUMBNAIL, TRANSCODE, MIGRATION, TRASH_GC, SCAN_CLEANUP, MOVE_TREE
* **시스템 읽기 전용 모드** — 유지보수 및 마이그레이션 중 상태를 변경하는 모든 API 호출 차단

### 안정성 및 성능

* **상호작용 최우선 QoS** — UI 요청에 항상 우선순위 부여; 백그라운드 워커(썸네일, 트랜스코딩, GC, 마이그레이션)는 CPU, IO 대기(IO-wait), 메모리 및 API P95 지연 시간을 기반으로 자동 스로틀링 됨
* **시작 조정자 (Startup reconciler)** — 부팅 시 멈춘 업로드 세션(UPLOADING/MERGING) 및 만료된 INIT 세션 정리
* **HDD 스핀업 대기** — 시작이 느린 스토리지를 위한 설정 가능한 타임아웃
* **멱등성 (Idempotency)** — POST 작업을 위한 `Idempotency-Key` 헤더 지원

---

## 아키텍처 개요

```text
┌────────────────────────────────────────────────────┐
│                    클라이언트 (Clients)                   │
│         (Web UI · Mobile · curl / SDK)             │
└──────────────────────┬─────────────────────────────┘
                       │ HTTP (포트 8080)
┌──────────────────────▼─────────────────────────────┐
│                    API 서버                        │
│   packages/ui  ·  src/http  ·  src/policy          │
│   (OpenAPI 기반 라우트 + 미들웨어)                     │
├────────────────────────────────────────────────────┤
│                    도메인 계층                     │
│   src/db · src/policy · src/util                   │
│   (DDD 바운디드 컨텍스트 — 하단 참조)                  │
├────────────────────────────────────────────────────┤
│                    워커 / 작업                     │
│   THUMBNAIL · TRANSCODE · MIGRATION                │
│   TRASH_GC · SCAN_CLEANUP · MOVE_TREE              │
├────────────────────────────────────────────────────┤
│        UI (packages/ui) + ui-kit (packages/ui-kit) │
│        Stitch 디자인에서 흡수한 토큰/컴포넌트              │
└──────────────────────┬─────────────────────────────┘
                       │
         ┌─────────────▼─────────────┐
         │   PostgreSQL 16+          │
         │   (ltree, pg_trgm)        │
         │   + 호스트 파일 시스템       │
         └───────────────────────────┘

```

**DDD 바운디드 컨텍스트 (Bounded Contexts)** (사양서 기준):

| 컨텍스트 | 역할 |
| --- | --- |
| 신원 및 접근 (Identity & Access) | 관리자 설정, 로그인/토큰 갱신, 초대 전용 가입, 사용자, 역할 |
| 스토리지 볼륨 (Storage Volume) | `base_path` 관리, 검증, 활성화, 마이그레이션, 스캔/정리 |
| 드라이브 트리 (Drive Tree) | 노드(폴더/파일), 트리 순회, 이동/복사, 이름 변경, 휴지통 |
| 업로드 (Upload) | 세션, 청크 분할, 멱등성, 병합, 크래시 복구(조정자) |
| 공유 (Sharing) | 공유 링크 생성, 토큰 검증, 공개 다운로드 |
| 미디어 (Media) | 썸네일/미리보기 파이프라인, QoS 기반 스로틀링 |
| 작업 (Jobs) | 백그라운드 작업 상태 머신, 재시도, 동시성 제어 |
| 검색 (Search) | `pg_trgm` 기반 검색, 커서 페이지네이션 |

**SSOT 주도 (SSOT-driven)**: 모든 엔드포인트, 스키마, 에러 코드, 상태 머신, DB 인덱스는 `openapi/openapi.yaml`에 정의됩니다. 구현은 이 계약을 반드시 충족해야 합니다.

---

## 단일 진실 공급원 (SSOT, Source of Truth)

모든 설계 및 구현 결정은 다음 파일들에 기반하며, 엄격한 우선순위를 따릅니다:

| 우선순위 | 파일 | 관할 영역 |
| --- | --- | --- |
| 1 (최고) | `openapi/openapi.yaml` | API 계약, 스키마, 에러 코드, 상태 머신(`x-state-machines`), DB/인덱스(`x-db`), 상수(`x-constants`) |
| 2 | `docs/NAS_SelfHosted_DDD_Spec_FINAL.md` | 도메인 모델, 컨텍스트, 정책, 기본값 산정 근거 |
| 3 | `docs/NAS_OpenClaw_Evidence_Playbook_FINAL.md` | 개발 로드맵(P0–P12), 작업 규칙, 증명(Evidence) 요구사항 |
| 4 | `docs/NAS_OpenClaw_TDD_Addendum_FINAL.md` | 테스트/증명 포맷, 통과/실패 규칙, CLI 기반 검증 |
| 5 | `docs/NAS_OpenClaw_Evidence_Playbook_P13_UI_Refactor.md` | UI 로드맵(P13–P19), 리팩토링, 안정화 작업 |
| 6 | `docs/ui/IA_NAV_SSOT.md` | 내비게이션 구조, 페이지 라우트, 레이아웃 규칙 |
| 7 | `docs/ui/COPY_KEYS_SSOT.md` | UI 텍스트/다국어(i18n) 키 레지스트리 |

### 계약을 안전하게 변경하는 방법

1. 변경 이유를 설명하는 ADR을 `docs/ADR/`에 작성합니다.
2. `openapi/openapi.yaml`을 **가장 먼저** 업데이트합니다 (필요에 따라 스키마, 경로, `x-db`, `x-state-machines`, `x-constants` 수정).
3. UI와 관련된 경우: `docs/ui/IA_NAV_SSOT.md` 또는 `docs/ui/COPY_KEYS_SSOT.md`를 업데이트합니다.
4. 도메인 모델이나 작업 순서가 변경되는 경우에만 DDD 사양서나 플레이북을 업데이트합니다.
5. 업데이트된 계약을 충족하도록 구현하고 증명(evidence)을 작성합니다 ([증명 / 테스트](https://www.google.com/search?q=%23%EC%A6%9D%EB%AA%85--%ED%85%8C%EC%8A%A4%ED%8A%B8-tdd-%EB%B6%80%EB%A1%9D) 참조).

> **규칙**: 구현과 SSOT가 일치하지 않으면 **구현이 잘못된 것**입니다. 위의 프로세스를 통해 계약을 먼저 수정한 다음 코드를 수정하세요.

---

## 스크린샷 / UI

이 README에는 스크린샷이 포함되어 있지 않습니다. UI 정보 아키텍처와 내비게이션 라우트는 `docs/ui/IA_NAV_SSOT.md`에 의해 고정되어 있습니다.

**디자인 레퍼런스**는 `design/stitch/ko-kr_final/`에 있습니다:

| 하위 디렉터리 | 내용 |
| --- | --- |
| `inventory/` | 모든 화면의 완성도 체크리스트 |
| `pages/` | 페이지 단위 컴포지션 |
| `modals/` | 모달/다이얼로그 레퍼런스 |
| `states/` | 컴포넌트 상태 변형(variations) |
| `mobile/` | 모바일 전용 레이아웃 |
| `ui-kit_tokens/` | 디자인 토큰, 원시값(primitives), 여백, 색상, 타이포그래피 |
| `en-us_preview/` | 영어 로케일 미리보기 |

UI는 외부 디자인(Stitch) 토큰을 `packages/ui-kit/`(토큰 + 재사용 가능한 컴포넌트)에 흡수한 뒤, `packages/ui/`에서 페이지를 구성하는 방식으로 구현됩니다. JSX 코드를 직접 복사하여 붙여넣는 것은 엄격히 금지됩니다.

---

## 빠른 시작 (로컬 환경)

### 사전 요구사항

* **Node.js** (`package.json` → `packageManager: pnpm@9.1.1` 참조)
* **pnpm** 9.x (`corepack enable && corepack prepare pnpm@9.1.1 --activate`)
* **Docker** (PostgreSQL 실행용)

### 1. 클론 및 설치

```bash
git clone <repo-url> nimbus-drive
cd nimbus-drive
pnpm install

```

### 2. PostgreSQL 시작

```bash
docker compose up -d

```

이 명령은 **호스트 포트 15432**에서 PostgreSQL 15를 시작합니다:

* DB: `nimbus_drive`, 사용자: `nimbus`, 비밀번호: `nimbus`
* `db/init/`의 초기화 스크립트가 첫 시작 시 자동으로 실행됩니다.

### 3. 개발 서버 실행

```bash
# TODO: 정확한 개발 환경 실행 명령어를 확인하세요 (packages/ui/package.json 또는 src/ 진입점 확인)
node scripts/dev_server.mjs

```

> API 서버는 **`http://localhost:8080`**에서 수신 대기합니다 (OpenAPI `servers` 설정 기준).

### 4. 앱 열기

`http://localhost:8080`으로 이동합니다. 첫 방문 시 초기 관리자 계정을 생성하기 위해 `/setup`으로 리디렉션됩니다.

---

## 사용법 (사용자)

### 온보딩

1. **최초 설정** → `/setup`에서 최초 ADMIN 계정을 생성합니다 (1회성; 이후 409 반환).
2. **사용자 초대** → 관리자가 `POST /admin/invites`를 통해 초대 토큰을 생성하고 링크를 공유합니다.
3. **초대 수락** → 초대받은 사용자가 `/invite/accept?token=<token>`을 열고 사용자명/비밀번호를 설정합니다.

### 파일 관리

* **탐색** → `/files` (루트) 또는 `/files/:nodeId` (하위 폴더)
* **폴더 생성** → `POST /nodes/folders`
* **업로드** → 청크 분할 업로드: `POST /uploads` → `PUT /uploads/{id}/chunks/{i}` → `POST /uploads/{id}/complete`
* **다운로드** → `GET /nodes/{id}/download` (Range 인식: 200 / 206 / 416)
* **이동 / 복사 / 이름 변경** → `POST /nodes/{id}/move`, `/copy`, `/rename`
* **검색** → `/search?q=` (퍼지 검색, `pg_trgm`)

### 휴지통

* **소프트 삭제** → `DELETE /nodes/{id}` (휴지통으로 이동)
* **휴지통 보기** → `GET /trash`
* **복원** → `POST /trash/{id}/restore`
* **영구 삭제** → `DELETE /trash/{id}` (블롭 `ref_count` 감소; 0이 되면 물리적 파일 제거)

### 공유

* **공유 링크 생성** → `POST /nodes/{id}/share-links` (일회성 토큰 반환)
* 선택 사항: `password` (최소 6자), `expires_in_seconds` (기본 7일, 최대 365일), `permission` (READ / READ_WRITE)


* **공유 콘텐츠 접근** → `GET /s/{token}` (메타데이터) / `GET /s/{token}/download`
* 비밀번호로 보호된 경우: `X-Share-Password` 헤더 제공 필요



### 관리자

* **볼륨** → `POST /admin/volumes/validate-path`, `POST /admin/volumes`, `POST /admin/volumes/{id}/activate`
* **마이그레이션** → `POST /admin/migrations` (MIGRATION 작업 생성)
* **스캔 / 정리** → `POST /admin/storage/scan` (고아 파일 찾기; 선택적 삭제)
* **시스템 모드** → `GET/PATCH /admin/system-mode` (유지보수를 위한 읽기 전용 모드 전환)
* **작업 (Jobs)** → `GET /jobs`, `GET /jobs/{id}` (`type`, `status`로 필터링)
* **성능** → `GET /system/performance` (QoS 상태, 부하 지표)

---

## API (OpenAPI)

전체 API 계약은 `openapi/openapi.yaml` (OpenAPI 3.1.0)에 있습니다.

### 보기 / 검증

```bash
# 스펙 검증 (아무 OpenAPI 검증기 사용 가능)
npx @redocly/cli lint openapi/openapi.yaml

# 인터랙티브 문서 서빙
npx @redocly/cli preview-docs openapi/openapi.yaml

```

### 도메인별 API 영역

| 도메인 | 엔드포인트 |
| --- | --- |
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

## 증명 / 테스트 (TDD 부록)

모든 작업 완료 여부는 스크린샷이 아닌 **CLI 기반 증명(evidence) 번들**을 통해 검증됩니다.

### 증명 번들 구조

```text
evidence/<piece_id>/<task_id>/
├── expected.md           # 사람이 읽을 수 있는 통과 기준
├── cases/
│   └── *.case.yaml       # 계약 테스트 케이스 (SSOT 기반)
├── run.sh                # 단일 명령어로 재현 가능한 실행 스크립트
├── actual/
│   ├── http/             # curl 결과 (상태/헤더/본문)
│   ├── db/               # psql 출력 (필요시)
│   ├── fs/               # ls/find/sha256sum 출력 (필요시)
│   └── logs/             # 서버/워커 로그 (필요시)
├── junit.xml             # 테스트 러너 출력 (사용 가능한 경우)
└── summary.json          # 필수: 자동화된 통과/실패 판정 결과

```

### `summary.json` 필수 필드

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

**PASS 규칙**: 작업은 `summary.json`에 `"pass": true`와 `"result": "PASS"`가 **모두** 있어야만 완료된 것으로 간주됩니다.

**FAIL 조건** (하나라도 해당되면 실패):

* 예상 상태(status)와 실제 상태가 다름
* `jq` 단언(assertion) 중 하나라도 false를 반환
* DB/FS 증명이 예상과 일치하지 않음
* `junit.xml`에 실패 내역이 포함됨

### 케이스 YAML 형식

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

단언(Assertion) 타입: `jq` (JSON 쿼리), `regex` (문자열/헤더 매치), `equals` (정확히 일치).

### 2-레인 검증 (권장)

| 레인 | 대상 | 범위 | 목적 |
| --- | --- | --- | --- |
| **Fast** (5–20초) | 모든 저장 / PR 푸시 | 린트(lint), 타입 체크, 단위 테스트, OpenAPI 검증 (DB 없음) | 실수를 조기에 발견 |
| **Slow** (30초 – 2분+) | 작업 완료 / PR 업데이트 | `compose up` + DB 마이그레이션 + 계약 케이스 + 정리 | 최종 통과/실패 판정 |

### 증명 실행

```bash
# 단일 작업 증명
bash evidence/<P>/<T>/run.sh

# 전체 스위트 (PR/CI 검증)
bash scripts/run_evidence.sh

# UI 전용 증명
bash scripts/run_ui_evidence.sh

```

> **증명에 스크린샷은 사용하지 않습니다**. UI 작업은 Storybook 빌드, 타입 체크, 린트, 헤드리스(headless) 테스트로 검증합니다.

---

## 개발 워크플로우

개발은 태스크 중심의 SSOT 우선 접근 방식인 **증명 플레이북(Evidence Playbook)**을 따릅니다.

### 핵심 규칙

1. **1 작업 = 1–2개의 OpenAPI 오퍼레이션** + 계약 케이스 PASS. 하나의 작업에 API + UI + 워커 + 마이그레이션을 섞지 마세요.
2. **SSOT 우선** — 코딩하기 전에 `openapi/openapi.yaml`에 스키마, 상태 머신, DB 항목이 포함된 오퍼레이션이 존재하는지 확인하세요.
3. **리팩토링과 기능 개발 혼합 금지** — 작업은 기능 개발이거나 리팩토링 중 하나여야 하며, 절대 두 가지를 동시에 진행하지 마세요.
4. **증명으로 작업 마감** — `result: "PASS"`가 기록된 `summary.json`만이 작업을 완료로 표시할 수 있는 유일한 방법입니다.

### 작업 루프

```text
1. SSOT 읽기 (OpenAPI 오퍼레이션/스키마/에러/상태 머신)
2. 테스트 케이스 작성 (초기에는 FAIL 예상)
3. 구현
4. 테스트 → PASS
5. evidence/<P>/<T>/ 에 증명 번들 생성
6. summary.json result=PASS 확인 → 작업 닫기

```

### 플레이북 순서

* **P0–P3**: 파운데이션 — SSOT 게이트, DB 스켈레톤, 설정, 인증, 초대 전용 가입, 볼륨, 읽기 전용 모드
* **P4–P6**: 드라이브 트리 코어, 업로드 (청크 E2E + 조정자), 다운로드 (Range 지원)
* **P7–P9**: 휴지통/GC, 공유 링크, ACL
* **P10–P12**: 검색, 미디어/QoS, 마이그레이션/스캔 정리
* **P13+**: UI — 워크스페이스 스캐폴딩, i18n, 라우팅, ui-kit 컴포넌트, 앱 셸, 인증/온보딩 UI, 파일 탐색기, 파일 작업, 업로드 대기열, 공유 모달, 관리자 페이지
* **P18**: 안정화 (Hardening) — 타입이 지정된 API 타입, 에러 처리, 모듈 경계, 성능 최적화
* **P19**: 개선 (선택 사항) — 커맨드 팔레트, 일괄 작업, 감사(audit) UI

> 플레이북에 문서화되지 않은 항목은 여기에 추가하지 않습니다. 전체 작업 내역은 `docs/NAS_OpenClaw_Evidence_Playbook_FINAL.md` 및 `docs/NAS_OpenClaw_Evidence_Playbook_P13_UI_Refactor.md`를 참조하세요. UI 작업은 스크린샷이 아닌 Storybook 빌드 / 타입 체크 / 린트 / 테스트로 증명 단계를 통과해야 합니다.

---

## 다국어 (i18n)

* **기본 로케일**: `ko-KR`
* **지원 로케일**: `ko-KR`, `en-US` (사용자 설정에서 토글 가능)
* **API 에러**는 `Accept-Language` 헤더를 통해 현지화됩니다 (기본값 `ko-KR`).
* **사용자 환경설정**은 `User.locale`에 저장되며 `PATCH /me/preferences`를 통해 변경합니다.

### COPY_KEYS 규칙 (SSOT: `docs/ui/COPY_KEYS_SSOT.md`)

* 모든 UI 텍스트는 i18n 키(예: `t('nav.files')`)를 사용해야 합니다. **하드코딩된 텍스트는 금지됩니다.**
* 키 네임스페이스: `app`, `nav`, `action`, `field`, `msg`, `err`, `status`, `modal`, `admin`
* 새 텍스트 추가 시 요구사항: (1) `COPY_KEYS_SSOT.md`에 키 추가, (2) `locales/ko-KR.json` 및 `locales/en-US.json`에 번역 추가

### UI IA 라우트 (SSOT: `docs/ui/IA_NAV_SSOT.md`)

내비게이션 경로는 고정되어 있습니다. 구현은 아래와 정확히 일치해야 합니다:

| 섹션 | 라우트 |
| --- | --- |
| Core | `/files`, `/files/:nodeId`, `/search?q=`, `/recent`, `/favorites`, `/shared`, `/media`, `/trash` |
| Auth | `/login`, `/setup`, `/invite/accept?token=` |
| Admin | `/admin`, `/admin/users`, `/admin/storage`, `/admin/migration`, `/admin/performance`, `/admin/jobs`, `/admin/audit`, `/admin/security`, `/admin/appearance` |

### 한국어 Quick Notes (ko-KR 기본 정책)

* 기본 UI 언어는 **한국어(ko-KR)** 입니다.
* 영어(en-US)는 설정에서 토글할 수 있습니다.
* 모든 UI 문자열은 `COPY_KEYS_SSOT.md`의 키를 사용해야 하며, 하드코딩은 금지됩니다.
* 새로운 문자열 추가 시: SSOT 문서 + `locales/ko-KR.json` + `locales/en-US.json`을 동시에 업데이트하세요.

---

## 보안 모델

* **초대 전용 접근** — 공개 가입 불가; 관리자가 일회성 초대 토큰 생성
* **JWT 인증** — 액세스 토큰(TTL 15분), 리프레시 토큰(14일, 자동 갱신)
* **비밀번호 해싱** — Argon2id (메모리 32 MiB, 반복 2, 병렬성 1); bcrypt cost-12 폴백(fallback)
* **공유 링크 토큰** — DB에 **해시 처리되어** 저장(`token_hash bytea`); 생성 시 한 번만 평문으로 반환
* **공유 링크 보안** — 선택적 비밀번호(최소 6자), 필수 만료 기한(기본 7일, 최대 365일)
* **ACL** — 기본 거부, 상속 가능한 항목; 주체: USER, GROUP, SHARE_LINK; 효과: ALLOW, DENY; 권한: READ, WRITE, DELETE, SHARE
* **업로드 보안**:
* 클라이언트가 제공한 `Content-Type`은 **절대 신뢰하지 않음** (`content_type_trust: never`)
* 확장자 허용 목록 (기본: jpg, jpeg, png, gif, webp, heic, mp4, mov, pdf, txt, zip)
* 실행 파일 차단 목록 (php, jsp, asp, aspx, exe, dll, sh, bat, cmd)
* 서버에서 생성하는 파일명; 경로 탐색(path traversal) 방지


* **읽기 전용 모드** — `PATCH /admin/system-mode`는 관리자 토글을 제외한 모든 상태 변경 엔드포인트를 차단합니다.
* **다운로드** — 적절한 416 처리 및 캐시 제어 헤더가 포함된 Range 지원

---

## 성능 / QoS

QoS 컨트롤러는 **상호작용 최우선(interactive-first)** 정책을 따릅니다: 사용자 대상 요청(탐색, 다운로드, 검색)은 항상 백그라운드 작업보다 우선순위를 가집니다.

### 부하 임계값 (`x-constants.qos` 기준)

| 지표 | 소프트 (Soft) | 하드 (Hard) |
| --- | --- | --- |
| CPU % | 50 | 70 |
| IO-wait % | 5 | 10 |
| API P95 (ms) | 300 | 800 |
| 가용 메모리 | 512 MiB (소프트) | — |

### 백그라운드 워커 기본값

| 설정 | 값 |
| --- | --- |
| `bg_worker_concurrency` | 기본 1, 최소 0, 최대 4 |
| `thumbnail_enqueue_rps` | 기본 1.0, 최대 5.0 |
| `thumbnail_worker_concurrency` | 1 |

### 시스템 기본값 (`x-constants` 기준)

| 설정 | 값 |
| --- | --- |
| 업로드 청크 크기 | 8 MiB (최소 1 MiB, 최대 32 MiB) |
| 병렬 청크 수 | 2 |
| 업로드 세션 TTL | 48시간 |
| 최대 파일 크기 | 2 TiB |
| 휴지통 보존 기간 | 30일 |
| 공유 링크 기본 만료 기한 | 7일 |
| 공유 링크 최대 만료 기한 | 365일 |
| 액세스 토큰 TTL | 900초 (15분) |
| 리프레시 토큰 TTL | 1,209,600초 (14일) |
| API 타임아웃 | 10초 |
| 다운로드 타임아웃 | 60초 |
| HDD 스핀업 대기 시간 | 30초 |

성능 프로필: **ECO**, **BALANCED**(기본), **PERFORMANCE**, **CUSTOM** — `GET /system/performance`에서 확인 가능.

전체 QoS 상수 정의는 `openapi/openapi.yaml`의 `x-constants.qos`를 참조하세요.

---

## 로드맵

개발은 증명 플레이북에서 추적되는 **조각(Pieces, P)**과 **작업(Tasks, T)**으로 구성됩니다.

| 단계 | 조각 (Pieces) | 상태 |
| --- | --- | --- |
| 파운데이션 | P0 (SSOT 게이트) · P1 (설정/상태) · P2 (인증/초대) · P3 (볼륨/읽기 전용) | 백엔드 |
| 코어 | P4 (드라이브 트리) · P5 (업로드 E2E) · P6 (다운로드/Range) | 백엔드 |
| 기능 | P7 (휴지통/GC) · P8 (공유 링크) · P9 (ACL) | 백엔드 |
| 고급 | P10 (검색) · P11 (미디어/QoS) · P12 (마이그레이션/스캔) | 백엔드 |
| UI | P13 (워크스페이스/증명 게이트) · P14 (ui-kit 원시값) · P15 (앱 셸/인증 UI) · P16 (파일 탐색기) · P17 (파일 작업/업로드/공유/관리자 UI) | 프론트엔드 |
| 안정화 | P18 (타입이 지정된 API 타입, 에러 처리, 모듈 경계, 성능 최적화) | 리팩토링 |
| 개선 | P19 (커맨드 팔레트, 일괄 작업, 감사 UI) | 선택 사항 |

> 플레이북에 문서화된 내용 외의 항목은 여기에 추가하지 않습니다. 전체 작업 내역은 `docs/NAS_OpenClaw_Evidence_Playbook_FINAL.md` 및 `docs/NAS_OpenClaw_Evidence_Playbook_P13_UI_Refactor.md`를 확인하세요.

---

## 기여 가이드

### PR 규칙

1. **SSOT 우선** — 변경 사항이 API 계약에 영향을 미치는 경우, 코드를 작성하기 전에 `openapi/openapi.yaml`을 먼저 업데이트하세요.
2. **증명 필수** — 모든 작업 PR은 통과한 `summary.json`이 포함된 `evidence/<P>/<T>/` 번들을 포함해야 합니다.
3. **PR당 하나의 작업** — 관련 없는 변경 사항을 결합하지 마세요.
4. **기능 개발과 리팩토링 혼합 금지** — 기능 추가와 구조적 개선은 별도의 PR로 분리하세요.
5. **키를 통해서만 UI 텍스트 작성** — `COPY_KEYS_SSOT.md` + 로케일 JSON 파일을 업데이트하세요. 하드코딩은 절대 불가합니다.

### 린트 / 타입 체크 기대치

```bash
# 워크스페이스 전체 (사용 가능한 경우)
pnpm -r lint
pnpm -r typecheck
pnpm -r test

# UI 전용
pnpm -C packages/ui lint
pnpm -C packages/ui typecheck
pnpm -C packages/ui-kit storybook:build

```

> TODO: 각 패키지별 정확한 린트/타입 체크 도구 설정을 확인하세요.

---

## 라이선스

> **TODO: 라이선스 추가** — 현재 리포지토리에 라이선스 파일이 없습니다. 공개 릴리스 전에 `LICENSE` 파일을 추가하세요.

---

## 용어집

| 용어 | 의미 |
| --- | --- |
| **SSOT** | 단일 진실 공급원 (Single Source of Truth) — `openapi/openapi.yaml`이 최상위 SSOT입니다. |
| **증명 (Evidence)** | 작업이 통과되었음을 증명하는 CLI 기반 테스트 출력 번들 (`evidence/<P>/<T>/`) |
| **조각 / 작업 (Piece / Task)** | 조각(P)은 기능 그룹이며, 작업(T)은 해당 그룹 내 1~2개의 API 오퍼레이션을 의미합니다. |
| **QoS** | 서비스 품질 (Quality of Service) — 상호작용 우선순위를 보장하기 위한 백그라운드 작업 스로틀링 |
| **조정자 (Reconciler)** | 멈춘 업로드 세션과 만료된 임시 파일을 정리하는 시작 프로세스 |
| **ui-kit** | Stitch 디자인 토큰에서 흡수한 공용 컴포넌트 라이브러리 (`packages/ui-kit/`) |
| **Stitch** | 외부 디자인 벤더; 결과물은 `design/stitch/ko-kr_final/`에 저장되어 있습니다. |
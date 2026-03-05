<!-- [SUSPENDED] UI 레퍼런스(=Stitch) 기반 작업/규칙은 현재 중단 상태입니다. -->
<!-- [SUSPENDED] 본 문서 내 UI 레퍼런스/픽셀 diff/시각회귀 관련 문장은 주석 처리되었습니다. -->

NAS UI-Kit Design Fidelity Playbook

PLAYBOOK_VERSION: 2026-03-02.v1
<!-- [SUSPENDED:UI_REFERENCE] Goal: Nimbus Drive Web 전체 라우트(/files, /admin 등)에서 ui-kit 적용률 100% + Stitch 최종안 fidelity 확보. -->
<!-- [SUSPENDED:UI_REFERENCE] Approach: “페이지별 임시 UI 제거 → ui-kit 조합으로 통일 → 시안 누락분은 ‘파생(derived) 디자인 스펙’ 생성 → CLI 기반 시각 회귀(visual regression) 증거로 닫기” -->

0) SSOT 우선순위(강 → 약)

docs/ui/IA_NAV_SSOT.md (라우팅/IA 고정)

docs/ui/COPY_KEYS_SSOT.md (카피/i18n 키 고정)

<!-- [SUSPENDED:UI_REFERENCE] design/stitch/ko-kr_final/inventory/ (완성도 체크리스트) -->

<!-- [SUSPENDED:UI_REFERENCE] design/stitch/ko-kr_final/pages|modals|states|ui-kit_tokens/ (UI 레퍼런스) -->

1) 글로벌 규칙(HARD)

금지: 페이지에서 px 하드코딩/인라인 스타일로 “그럴듯하게 맞추기”

필수: packages/ui-kit 토큰/컴포넌트만으로 구성(레이아웃 포함)

필수: i18n 키 사용(문자열 하드코딩 금지)

필수: 상태(loading/empty/error/forbidden) 표준화 + 페이지별 동일 패턴

<!-- [SUSPENDED:UI_REFERENCE] 증거(Evidence): 가능하면 Storybook/타입체크/린트 + 시각 회귀 테스트(픽셀 diff) 를 CLI로 PASS 처리 -->

스펙 생성 원칙(누락 페이지):

새 컬러/새 간격 스케일 발명 금지

기존 패턴(동일 IA 섹션의 페이지)에서 레이아웃/컴포넌트 조합을 재사용

“derived 디자인”은 원본 Stitch를 덮지 않고 추가 파일로만 기록

2) 파생(derived) 디자인 스펙 저장 규칙

시안에 없는 페이지/상태를 생성해야 할 때, 아래 경로로만 추가:

<!-- [SUSPENDED:UI_REFERENCE] design/stitch/ko-kr_final/derived/pages/<route>.md -->

<!-- [SUSPENDED:UI_REFERENCE] design/stitch/ko-kr_final/derived/states/<route>__<state>.md -->

<!-- [SUSPENDED:UI_REFERENCE] design/stitch/ko-kr_final/inventory/_derived_checklist.md (누락분 채움 기록) -->

각 derived 스펙 템플릿(최소):

목적(페이지가 해결하는 유저 작업)

레이아웃(그리드/영역: Sidebar/Topbar/Toolbar/Content/Inspector)

사용 컴포넌트(ui-kit 이름 기준)

토큰(typography/space/radius/color 사용 범위)

상태 4종: loading / empty / error / forbidden

카피 키 목록(COPY_KEYS_SSOT 참조 키만)

3) Evidence(UI Fidelity) 표준 번들(권장)

3-A) P20~P23 CI/evidence 규약 (SSOT, HARD)

목적: 크론/운영 루프가 CI 스코프를 추측하지 않도록, P20~P23 트랙의 실행/판정 규칙을 고정한다.

SSOT 대상 범위:
- 트랙: P20~P23 only
- 근거 문서: 본 문서 + `.github/workflows/ci.yml` + `scripts/run_evidence.sh`

실행 표준(로컬):
- 기본 증거 실행: `bash evidence/<P>/<TaskID>/run.sh`
- CI는 `scripts/run_evidence.sh --scope <ui|api|full>`를 호출하며, 결과 파일 `evidence/summary.json`의 top-level `pass`/`result`를 검증한다.

PASS 판정(트랙 규약):
- 공통 필수: `evidence/<P>/<TaskID>/summary.json`의 top-level `pass: true`
- P20~P23 기본: `evidence PASS`
<!-- [SUSPENDED:UI_REFERENCE] - visual regression이 해당 Task의 Acceptance/Evidence에 명시된 경우 추가 필수: `visual regression PASS` -->

<!-- [SUSPENDED:UI_REFERENCE] visual regression 명령(SSOT 고정): -->
- 표준 명령: `pnpm -C packages/ui test:visual`
- 적용 규칙:
  - 필수: 해당 Task 본문에 Evidence로 visual PASS가 명시된 경우
  - 선택: 해당 Task 본문에 visual 요구가 없는 경우(불필요 시 실행 금지)
- 주의: 현재 `packages/ui/package.json`에 `test:visual` 스크립트가 없으면, visual 필수 Task는 구현 전에 해당 스크립트(또는 동등 실행 경로)부터 명시적으로 추가해야 한다.

summary.json 스키마(트랙 규약):
- 필수 필드:
  - `taskId` (string)
  - `result` ("PASS" | "FAIL")
  - `pass` (boolean)
- 권장 필드:
  - `rootCause` (string, FAIL 원인 1줄)
  - `checks` (string[])

비용/속도 제약(HARD):
- P20~P23 PR은 "최소 변경 파일만" 원칙(대규모 리포맷/리팩토링 금지).
- CI에서 트랙 외 전구간 테스트 확장 금지. Task 증거에 필요한 최소 커맨드만 실행.
<!-- [SUSPENDED:UI_REFERENCE] - visual regression은 "해당 Task에서 명시된 경우에만" 실행(항상 실행 금지). -->

실패 reason 분기(운영 합의):
- `no task candidate`: 플레이북 로드/헤딩 파싱이 성공했으나 P20~P23 후보가 0개일 때만 사용.
- 플레이북 파일 미존재/읽기 실패/헤딩 파싱 실패는 별도 reason으로 `needs-human-resolve` 처리.


각 Task마다 아래 중 최소 2개 이상 PASS:

pnpm -C packages/ui-kit lint && pnpm -C packages/ui-kit test

pnpm -C packages/ui lint && pnpm -C packages/ui test

pnpm -C packages/ui-kit storybook:build (또는 storybook smoke)

<!-- [SUSPENDED:UI_REFERENCE] pnpm -C packages/ui test:visual (Playwright 등 픽셀 diff 기반, CLI PASS/FAIL) -->

스크린샷 “수동 비교”는 QA 참고로만. Task 완료 판정은 CLI PASS로만.

Piece P20 — Foundation (토큰/프레임/공통 컴포넌트/시각회귀)
### P20-T0. 라우트×디자인 인벤토리 매핑 SSOT 생성

Goal: IA 라우트 전부를 “디자인 커버 여부”로 매핑해 누락을 수치화

<!-- [SUSPENDED:UI_REFERENCE] Inputs(SSOT): docs/ui/IA_NAV_SSOT.md, design/stitch/ko-kr_final/inventory/ -->

Outputs(SSOT):

<!-- [SUSPENDED:UI_REFERENCE] design/stitch/ko-kr_final/inventory/route_coverage.md (표 형태) -->

<!-- [SUSPENDED:UI_REFERENCE] design/stitch/ko-kr_final/inventory/_derived_checklist.md (누락 목록) -->

Acceptance:

IA의 모든 route가 coverage 표에 1:1로 존재

<!-- [SUSPENDED:UI_REFERENCE] 각 route에 “Stitch 존재/derived 필요/이미 구현됨(추정)” 상태가 기록됨 -->

Evidence: evidence/P20/P20-T0/run.sh가 coverage 파일 존재/포맷 검증 PASS

### P20-T1. ui-kit 토큰 “잠금”(디자인→CSS Vars/TS) + 누락 토큰 정리

Goal: 디자인 토큰을 ui-kit로 완전히 흡수하고, 페이지 구현은 토큰만 사용

<!-- [SUSPENDED:UI_REFERENCE] Inputs(SSOT): design/stitch/ko-kr_final/ui-kit_tokens/ -->

Scope(권장): packages/ui-kit/src/tokens/, packages/ui-kit/src/styles/global.css

Acceptance:

컬러/타이포/스페이싱/라운드/섀도우 토큰을 전부 ui-kit에서 export

페이지에서 raw hex/px 하드코딩 사용량이 “감소 추세”로 전환

Evidence: storybook build + ui-kit test PASS

### P20-T2. AppShell(레이아웃) 단일화: Sidebar/Topbar/Content/Inspector

Goal: 모든 페이지가 동일한 프레임 컴포넌트를 공유

<!-- [SUSPENDED:UI_REFERENCE] Inputs(SSOT): docs/ui/IA_NAV_SSOT.md, Stitch 레이아웃 레퍼런스 -->

Outputs:

packages/ui/src/app/AppShell.tsx(또는 동등) 기반 통합

Acceptance:

/files, /admin, /login 등에서 프레임 불일치 제거(예: 패딩/간격/헤더 높이)

우측 상세 패널(Inspector)이 존재하는 페이지는 동일 컴포넌트 사용

Evidence: UI lint/test + 최소 3 route 시각회귀 PASS

### P20-T3. 공통 UI 패턴 컴포넌트화(페이지에서 조합만)

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

### P20-T4. Visual Regression Harness (라우트 스냅샷)

Goal: “디자인 반영”을 숫자로 고정(회귀 방지)

Requirements:

라우트별 스냅샷(1440 desktop) + 상태별 스냅샷(loading/empty/error/forbidden)

데이터 고정(seed/mock)로 flaky 제거

Acceptance:

<!-- [SUSPENDED:UI_REFERENCE] 최소 /files, /login, /admin 3개 라우트가 픽셀 diff 기준 PASS -->

Evidence: pnpm -C packages/ui test:visual PASS + diff 산출물 없음

Piece P21 — Core Pages (/files, /search, quick links)

각 Task 공통 규칙:
<!-- [SUSPENDED:UI_REFERENCE] (1) 해당 route가 Stitch inventory에 없으면 derived 스펙을 먼저 생성 -->
(2) 페이지 구현은 ui-kit 조합만
(3) 상태 4종 표준화
(4) 시각회귀 + lint/test PASS

### P21-T1. /files (기본 파일 탐색기) ui-kit 100% 적용

Derived 필요 시: design/.../derived/pages/files.md

Acceptance: 테이블/툴바/우측 패널/빈폴더/업로드 에러 상태가 표준 컴포넌트로 통일

Evidence: visual PASS + ui test PASS

### P21-T2. /files/:nodeId (폴더) + Breadcrumb/ContextMenu 일관화

Acceptance: 브레드크럼/경로 이동/폴더 액션 UI가 /files와 동일 패턴

Evidence: visual PASS

### P21-T3. /search?q= 검색 결과 페이지 통일

Acceptance: 검색 입력/필터/정렬/결과 테이블이 공통 Toolbar/DataTable 패턴 사용

Evidence: visual PASS

### P21-T4. /recent 최근 페이지 통일
### P21-T5. /favorites 즐겨찾기 페이지 통일
### P21-T6. /shared 공유됨 페이지 통일
### P21-T7. /media 미디어 페이지 통일
### P21-T8. /trash 휴지통 페이지 통일

각 Acceptance(공통):

헤더/툴바/리스트/빈상태/에러상태가 동일 패턴

COPY_KEYS_SSOT 키 사용(하드코딩 제거)

Evidence(각각): visual PASS + 최소 lint PASS

Piece P22 — Auth / Onboarding (/login, /setup, /invite)
### P22-T1. /login 시안 fidelity 적용(타이포/간격/버튼/에러)

Derived 필요 시: derived/pages/login.md, derived/states/login__error.md

Acceptance: 폼 필드/에러 메세지/CTA 버튼/로딩 상태가 ui-kit 규격

Evidence: visual PASS

### P22-T2. /setup 최초 관리자 생성 페이지 통일

Acceptance: “온보딩 레이아웃” 규격(폭/카드/step UI) 고정

Evidence: visual PASS

### P22-T3. /invite/accept?token= 초대 수락 + 토큰 에러 상태

Acceptance: 정상/만료/무효/이미사용 상태 UI가 ErrorState 표준 컴포넌트로 통일

Evidence: visual PASS

Piece P23 — Admin Settings (/admin/*)
### P23-T0. Admin Shell(좌측 섹션/헤더/폼 레이아웃) 단일화

Goal: Stripe 스타일 설정 IA를 ui-kit로 고정

Acceptance:

/admin 하위 모든 페이지가 동일한 SettingsShell 사용

섹션 타이틀/설명/폼 필드 간격/구분선 패턴 고정

Evidence: /admin + /admin/users visual PASS

### P23-T1. /admin 설정 홈(대시보드) 통일
### P23-T2. /admin/users 사용자/초대 통일
### P23-T3. /admin/storage 볼륨 관리 통일
### P23-T4. /admin/migration 마이그레이션 통일
### P23-T5. /admin/performance 성능/QoS 통일
### P23-T6. /admin/jobs 백그라운드 작업 통일
### P23-T7. /admin/audit 활동/감사 로그 통일
### P23-T8. /admin/security 공유/보안 정책 통일
### P23-T9. /admin/appearance 언어/테마 통일

각 Acceptance(공통):

SettingsShell + 표준 FormSection(제목/설명/컨트롤) 사용

목록형 페이지는 DataTable 패턴, 설정형 페이지는 Form 패턴 고정

loading/empty/error/forbidden 상태가 표준 컴포넌트

Evidence(각각): visual PASS (최소 1 상태 포함) + ui lint PASS


<!-- [SUSPENDED:UI_REFERENCE] Piece P24 — Full Fidelity Hardening (Stitch code.html SSOT + visual gate) -->

<!-- [SUSPENDED:UI_REFERENCE] 목적: “대충 비슷한 톤”이 아니라, design/stitch/ko-kr_final/**/code.html을 **정답 레이아웃/스타일 스펙(SSOT)** 으로 삼아 -->
<!-- [SUSPENDED:UI_REFERENCE] 현 repo의 IA/기능(= IA_NAV_SSOT)을 유지한 채, UI를 ui-kit로 재현하고 **visual regression으로 잠근다**. -->

P24 적용 SSOT 우선순위(강 → 약)
1) docs/ui/IA_NAV_SSOT.md (라우트/IA/기능 구조)
<!-- [SUSPENDED:UI_REFERENCE] 2) design/stitch/ko-kr_final/**/code.html (레이아웃/컴포넌트 조합/스타일 스펙) -->
<!-- [SUSPENDED:UI_REFERENCE] 3) design/stitch/ko-kr_final/**/screen.png (시각 레퍼런스/검증용) -->
<!-- [SUSPENDED:UI_REFERENCE] 4) design/stitch/ko-kr_final/ui-kit_tokens/** (토큰 근거) -->

핵심 원칙(HARD)
- 구현은 항상 packages/ui-kit 컴포넌트 조합으로 한다. (레퍼런스 HTML을 그대로 복사/붙여넣기 금지)
- 레퍼런스에 없는 화면/상태는 derived 스펙을 먼저 작성하고, derived는 반드시 “어떤 reference 패턴을 재사용했는지”를 명시한다.
- ‘페이지별 인라인 스타일로 맞추기’ 금지. (토큰/컴포넌트 확장으로 해결)
- 완료 판정은 “설명/느낌”이 아니라 CLI 기반 visual gate PASS로만 한다.

<!-- [SUSPENDED:UI_REFERENCE] ### P24-T0. Route × Reference(code.html/screen.png) 매핑 SSOT 고정 -->

<!-- [SUSPENDED:UI_REFERENCE] Goal: 각 route가 어떤 Stitch reference(page/modal/state)의 code.html을 따라야 하는지, 논쟁 없이 고정한다. -->

Outputs(SSOT):
<!-- [SUSPENDED:UI_REFERENCE] - design/stitch/ko-kr_final/inventory/route_reference_map.md -->
<!-- [SUSPENDED:UI_REFERENCE]   - route -> reference(code.html 경로) / reference(screen.png 경로) / derived 링크 -->

Acceptance:
- IA_NAV_SSOT의 모든 route가 1:1로 존재
- 레퍼런스 없는 route는 derived 문서 링크가 존재

Evidence: evidence/P24/P24-T0/run.sh에서 파일 존재/포맷 검증 PASS

### P24-T1. Reference-driven UI Kit 구현 규칙 고정(매핑 기반)

<!-- [SUSPENDED:UI_REFERENCE] Goal: reference code.html을 “스펙”으로 읽고, 실제 구현은 ui-kit 컴포넌트 조합으로 재현하는 규칙을 고정한다. -->

Acceptance:
- 각 페이지는 route_reference_map.md에 정의된 reference를 근거로 UI Kit로 재현됨
- 레퍼런스와 불일치가 생기면: (1) ui-kit 개선(토큰/컴포넌트) → (2) 페이지 조합 수정 순서로 해결

Evidence: ui lint PASS + (해당 route) visual PASS

### P24-T2. Visual Gate 기준 고정(Reference baseline)

Goal: “레퍼런스와 똑같음”을 기계적으로 판정한다.

Acceptance:
<!-- [SUSPENDED:UI_REFERENCE] - 레퍼런스가 있는 route는, reference screen.png와 동일 조건(해상도/테마/데이터 고정)으로 스냅샷을 생성하고 픽셀 diff PASS -->
<!-- [SUSPENDED:UI_REFERENCE] - 레퍼런스 없는 route는 derived spec 기반으로 baseline을 고정하고 픽셀 diff PASS -->

Evidence: pnpm -C packages/ui test:visual PASS

### P24-T3. Typography/Font 로딩 SSOT(Inter/Noto Sans KR) + 렌더링 일치

Goal: 폰트는 “font-family에 이름만”이 아니라 실제 로딩까지 보장해 레퍼런스 렌더링과 수렴시킨다.

Acceptance:
- Inter/Noto Sans KR가 실제 로드됨
- 기본 타이포 스케일이 ui-kit 토큰과 일치

Evidence: visual PASS + ui lint PASS

### P24-T4. Inline Style / Legacy HTML Control 제거(전 페이지)

Goal: 일부 페이지가 옛 스타일/인라인으로 남아 레퍼런스 수렴을 방해하는 혼종을 제거한다.

Acceptance:
- packages/ui/src/app/**에서 <button style={...}> / <input style={...}> 등의 패턴을 ui-kit(또는 공통 프리미티브)로 교체
- (권장) eslint guard로 인라인 스타일 사용을 제한

Evidence: ui lint PASS + visual PASS(대표 라우트)

### P24-T5. Derived Spec 강제(레퍼런스 없는 페이지/상태)

Goal: 레퍼런스 없는 화면을 ‘감’으로 구현하지 않도록, derived 문서가 없으면 구현을 막는다.

Acceptance:
<!-- [SUSPENDED:UI_REFERENCE] - 레퍼런스 없는 route/state는 design/stitch/ko-kr_final/derived/** 문서가 반드시 존재 -->
- derived 문서에는 “재사용 reference” 링크가 포함됨
- inventory/_derived_checklist.md 누락이 0으로 수렴

Evidence: evidence/P24/P24-T5/run.sh에서 derived 문서/체크리스트 정합 검증 PASS


4) 완료 정의(Definition of Done)

IA 라우트 전체가 ui-kit 기반 프레임/컴포넌트 로 동작

route coverage 표에서 “derived 필요”가 0 또는 모두 derived 스펙 생성 완료

<!-- [SUSPENDED:UI_REFERENCE] visual regression이 최소: -->

Core 8 routes 중 5+

Auth 3 routes 중 2+

Admin 10 routes 중 5+
를 PASS (나머지는 단계적으로 확대)

페이지별 인라인 스타일/임시 컴포넌트가 “추세적으로” 제거(완전 0이 목표)
### P24-T6. Self-host fonts 도입(Inter/Noto Sans KR) + 외부 의존 제거

Goal: Google Fonts 등 외부 egress에 의존하지 않고, 오프라인/사설망 배포에서도 레퍼런스 타이포가 안정적으로 재현되게 한다.

Scope(권장):
- packages/ui/index.html(또는 엔트리)에서 외부 font import 제거
- packages/ui/src/styles/fonts.css (신규) + assets/fonts/ (woff2)
- CSP 정책(필요 시) 문서화

Acceptance:
- Inter/Noto Sans KR 폰트 파일이 repo(또는 빌드 산출)에 포함되고, 런타임에서 실제 로드된다.
- 외부 네트워크 차단 환경에서도 폰트 fallback 없이 동일 폰트 패밀리로 렌더링된다.
<!-- [SUSPENDED:UI_REFERENCE] - visual regression이 동일 head에서 안정 PASS한다(플레이키 감소). -->

Evidence:
- pnpm -C packages/ui test:visual PASS
- (추가) 폰트 로드 확인: Playwright로 font 요청/적용 확인(또는 최소한 문서/스크린샷 증거)



Piece P25 — Full Fidelity Application (AppShell/Pages + Real Visual Regression)

<!-- [SUSPENDED:UI_REFERENCE] 목적: Stitch(code.html + screen.png) 기준으로 “실제 화면”이 레퍼런스와 동일한 레이아웃/컴포넌트/간격을 갖도록 만든다. -->
P24의 한계(구성/매핑 PASS지만 UI 미반영)를 해소하기 위해, (1) AppShell을 SSOT대로 재구성하고 (2) visual gate를 실제 렌더링 기반으로 바꾼다.

HARD 원칙
- docs/ui/IA_NAV_SSOT.md를 UI 구현의 최상위 SSOT로 유지한다(메뉴 위치/구성 포함).
<!-- [SUSPENDED:UI_REFERENCE] - 레퍼런스는 design/stitch/ko-kr_final/**/code.html을 ‘정답 스펙’으로 사용하고, 구현은 ui-kit 조합으로 재현한다(HTML 복붙 금지). -->
- 완료 판정은 반드시 “실제 렌더링 기반 visual gate PASS”로 한다(설정 정합성만으로 PASS 금지).

### P25-T0. AppShell 1차 내비게이션 상단 고정 + ⚙️ Admin 진입(SSOT 반영)

Goal: Quick Links(파일/최근/즐겨찾기/공유됨/미디어/휴지통)을 상단바로 고정하고, 좌측 사이드바는 FolderTree 중심으로 단순화한다.

Acceptance:
- Quick Links가 Topbar 탭으로 렌더링된다.
- Admin 진입은 Topbar ⚙️ 아이콘 버튼으로 고정(/admin).
- LeftNav는 FolderTree 중심이며 Quick Links 중복 배치 금지.

Evidence:
- pnpm -C packages/ui lint PASS
- pnpm -C packages/ui test:visual PASS (실제 렌더링 기반)

<!-- [SUSPENDED:UI_REFERENCE] ### P25-T1. Real Visual Gate: Playwright 기반 라우트 스냅샷/픽셀 diff(실제 렌더링) -->

Goal: test:visual이 “설정/맵 정합성”이 아니라 실제 브라우저 렌더링을 스냅샷으로 고정하고 diff로 판정하게 만든다.

Acceptance:
- 최소 /files,/login,/admin 에 대해 실제 렌더링 스냅샷이 생성된다.
- 레퍼런스 baseline이 있는 라우트는 reference 기준(diff 허용범위 포함)으로 PASS 한다.

Evidence:
- pnpm -C packages/ui test:visual PASS

### P25-T2. IA 전체 라우트 커버리지로 확장(/media 포함) + fixture 기반 렌더링

Goal: IA_NAV_SSOT 전체 route를 스냅샷 대상으로 포함하고, 빈 화면이 아닌 fixture(seed/mock) 기반으로 안정적으로 렌더링한다.

Acceptance:
- /media 포함, IA_NAV_SSOT의 모든 route가 스냅샷 대상에 포함된다.
- 각 route는 최소 1개 state 스냅샷을 가진다.

Evidence:
- pnpm -C packages/ui test:visual PASS

### P25-T3. Reference-driven 페이지 적용(우선순위: /files → /media → 나머지)

Goal: 레퍼런스 페이지(main_file_explorer/media_gallery_viewer 등)에 맞춰 실제 페이지 UI를 ui-kit 조합으로 재현한다.

Evidence:
- pnpm -C packages/ui test:visual PASS

### P25-T4. Mixed legacy 제거(전 페이지): 인라인 스타일/레거시 컨트롤 금지 가드

Goal: 레거시 인라인 스타일 기반 UI를 제거하고 재발 방지 가드를 추가한다.

Evidence:
- pnpm -C packages/ui lint PASS
- pnpm -C packages/ui test:visual PASS



Piece P26 — Visual Match Enforcement (/files first, must-be-visible outcomes)

목적: 구조 정비가 아니라 실제 화면 유사도를 강제한다. 현재 CI에서는 신규 UI 이식 게이트를 blocking으로 사용하며, P26은 `legacy gate (pre-new-UI SSOT), non-blocking` 리포트로 분리해 추적한다.

HARD 원칙
- baseline 임의 업데이트 금지(관리자 승인 없는 baseline 갱신 금지)
- fixture/seed/time/locale/font/view-port를 고정해 재현성을 최우선으로 한다.
- PASS 기준은 “실제 렌더 결과”이며, 설정 정합성만으로 PASS 금지.

### P26-T0. Reference Baseline Lock

<!-- [SUSPENDED:UI_REFERENCE] Goal: route -> reference(screen.png) 매핑을 CI에서 강제해 누락/오매핑 시 즉시 실패. -->

Acceptance:
- /files, /media 최소 핵심 라우트의 reference 매핑이 SSOT로 고정된다.
- 매핑 누락/중복/오경로면 CI FAIL.

Evidence:
- pnpm -C packages/ui test:visual PASS

### P26-T1. Visual Harness (Playwright) Snapshot Stabilization

Goal: /files의 실제 렌더 스냅샷(empty, with-items)을 안정적으로 생성.

Acceptance:
- /files empty + with-items 최소 2개 state를 실제 렌더로 캡처.
- viewport/font/animation/timezone/locale 고정.

Evidence:
- pnpm -C packages/ui test:visual PASS

### P26-T2. Pixel Diff Gate (No baseline drift)

<!-- [SUSPENDED:UI_REFERENCE] Goal: /files reference pixel diff는 legacy non-blocking 리포트로 유지한다. -->

Acceptance:
- /files diff threshold 초과 시 legacy gate 리포트에 FAIL로 기록된다(merge non-blocking).
- baseline 업데이트는 기본 금지(관리자 승인 토큰/플래그 있을 때만 허용).

Evidence:
- pnpm -C packages/ui test:visual PASS

### P26-T3. AppShell Frame Match (/files)

Goal: 상단/좌측/우측 패널/본문 그리드를 레퍼런스 프레임과 정합.

Acceptance:
- AppShell 주요 레이아웃 치수/정렬이 reference 기준으로 일치.

Evidence:
- pnpm -C packages/ui test:visual PASS

### P26-T4. Data Fixture Lock (with-items 고정)

Goal: with-items 렌더링 데이터(정렬/시간/개수/라벨)를 고정해 픽셀 플래키 제거.

Acceptance:
- /files with-items 시드가 고정되어 재실행 간 동일 렌더 보장.

Evidence:
- pnpm -C packages/ui test:visual PASS

### P26-T5. Files Page Match A (Layout)

Goal: spacing/grid/section 배치(큰 형태)를 reference에 맞춤.

Acceptance:
- 주요 블록 위치/간격/폭/높이 오차가 허용 범위 내.

Evidence:
- pnpm -C packages/ui test:visual PASS

### P26-T6. Files Page Match B (Detail)

Goal: typography/color/border/shadow/empty-state 디테일을 reference에 맞춤.

Acceptance:
- 텍스트 계층/톤/상태 스타일(hover/selected/empty)이 reference와 정합.

Evidence:
- pnpm -C packages/ui test:visual PASS

### P26-T7. Regression Stability Gate

Goal: CI 재실행 안정성 확보(선택: 3회 연속 PASS).

Acceptance:
- 동일 SHA 재실행 시 visual 결과가 안정적으로 재현.
- 플래키 원인(로딩 타이밍/폰트 지연) 제거.

Evidence:
- pnpm -C packages/ui test:visual PASS
- (선택) 동일 SHA 3회 연속 PASS 로그

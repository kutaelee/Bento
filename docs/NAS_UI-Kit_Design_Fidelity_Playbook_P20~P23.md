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

각 Task마다 아래 중 최소 2개 이상 PASS:

pnpm -C packages/ui-kit lint && pnpm -C packages/ui-kit test

pnpm -C packages/ui lint && pnpm -C packages/ui test

pnpm -C packages/ui-kit storybook:build (또는 storybook smoke)

<!-- [SUSPENDED:UI_REFERENCE] pnpm -C packages/ui test:visual (Playwright 등 픽셀 diff 기반, CLI PASS/FAIL) -->

스크린샷 “수동 비교”는 QA 참고로만. Task 완료 판정은 CLI PASS로만.

Piece P20 — Foundation (토큰/프레임/공통 컴포넌트/시각회귀)
P20-T0. 라우트×디자인 인벤토리 매핑 SSOT 생성

Goal: IA 라우트 전부를 “디자인 커버 여부”로 매핑해 누락을 수치화

<!-- [SUSPENDED:UI_REFERENCE] Inputs(SSOT): docs/ui/IA_NAV_SSOT.md, design/stitch/ko-kr_final/inventory/ -->

Outputs(SSOT):

<!-- [SUSPENDED:UI_REFERENCE] design/stitch/ko-kr_final/inventory/route_coverage.md (표 형태) -->

<!-- [SUSPENDED:UI_REFERENCE] design/stitch/ko-kr_final/inventory/_derived_checklist.md (누락 목록) -->

Acceptance:

IA의 모든 route가 coverage 표에 1:1로 존재

<!-- [SUSPENDED:UI_REFERENCE] 각 route에 “Stitch 존재/derived 필요/이미 구현됨(추정)” 상태가 기록됨 -->

Evidence: evidence/P20/P20-T0/run.sh가 coverage 파일 존재/포맷 검증 PASS

P20-T1. ui-kit 토큰 “잠금”(디자인→CSS Vars/TS) + 누락 토큰 정리

Goal: 디자인 토큰을 ui-kit로 완전히 흡수하고, 페이지 구현은 토큰만 사용

<!-- [SUSPENDED:UI_REFERENCE] Inputs(SSOT): design/stitch/ko-kr_final/ui-kit_tokens/ -->

Scope(권장): packages/ui-kit/src/tokens/, packages/ui-kit/src/styles/global.css

Acceptance:

컬러/타이포/스페이싱/라운드/섀도우 토큰을 전부 ui-kit에서 export

페이지에서 raw hex/px 하드코딩 사용량이 “감소 추세”로 전환

Evidence: storybook build + ui-kit test PASS

P20-T2. AppShell(레이아웃) 단일화: Sidebar/Topbar/Content/Inspector

Goal: 모든 페이지가 동일한 프레임 컴포넌트를 공유

<!-- [SUSPENDED:UI_REFERENCE] Inputs(SSOT): docs/ui/IA_NAV_SSOT.md, Stitch 레이아웃 레퍼런스 -->

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

<!-- [SUSPENDED:UI_REFERENCE] 최소 /files, /login, /admin 3개 라우트가 픽셀 diff 기준 PASS -->

Evidence: pnpm -C packages/ui test:visual PASS + diff 산출물 없음

Piece P21 — Core Pages (/files, /search, quick links)

각 Task 공통 규칙:
<!-- [SUSPENDED:UI_REFERENCE] (1) 해당 route가 Stitch inventory에 없으면 derived 스펙을 먼저 생성 -->
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

<!-- [SUSPENDED:UI_REFERENCE] visual regression이 최소: -->

Core 8 routes 중 5+

Auth 3 routes 중 2+

Admin 10 routes 중 5+
를 PASS (나머지는 단계적으로 확대)

페이지별 인라인 스타일/임시 컴포넌트가 “추세적으로” 제거(완전 0이 목표)

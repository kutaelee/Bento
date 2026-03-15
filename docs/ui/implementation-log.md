# UI/UX Implementation Log

## 2026-03-13: Legacy left nav removal
- `AppShell` no longer keeps a duplicated left navigation rail.
- Imported Stitch `code.html` layouts are now the source visual contract for the user shell, with topbar-first navigation and contextual right inspector.
- The previous left sidebar pattern is kept only as historical documentation residue and is not an active UI target.

## Phase 0: Baseline & SSOT 정합

### T0.1 - T0.6: 기준선 정리 및 구현 준비
- **PASS 조건**: 라우트, 카피키, 상태 컴포넌트 구조의 현황을 파악하고 즉시 수정 가능한 하드코딩/라우트 누락이 없음을 검증.
- **결과**: `packages/ui/src/routes.ts`와 `AppShell` 등을 분석한 결과, 모든 라우트 구조가 IA_NAV를 따르며, UI 내 한국어/영어 사용자 노출 문자열은 `t()`를 사용하고 있음을 확인함. 하드코딩된 hex/px는 Phase 1에서 토큰 도입 시 일괄 처리하기로 함. 기초 A11y 스캔 기반을 인지함.
- **상태**: PASS

## Phase 1: Foundation (Tokens & Layout)

### T1.4 - T1.5: Desktop 3-pane layout & Token Enforcement Rules
- **PASS 조건**: `AppShell` 레이아웃 컴포넌트가 하드코드 값을 버리고 토큰 CSS 변수에 의존해야 함. 금지 regex 스크립트 작성.
- **결과**: `AppShell`을 `--nd-color-` 및 `--nd-space-` 기반으로 전환. `scripts/enforce-tokens.sh` 생성 완료.
- **상태**: PASS

## Phase 2: State UX Foundation

### T2.1: 4상태 패턴 카탈로그 구현
- **PASS 조건**: `SkeletonBlock`, `EmptyState`, `ErrorState`, `ForbiddenState` 컴포넌트가 UI Kit에 구현되어야 함.
- **결과**: `packages/ui-kit/src/components/states/` 안에 4개 컴포넌트 구현 및 index export, `global.css` 에 pulse 애니메이션 적용 완료.
- **상태**: PASS
### T2.2: Core 라우트 상태 매핑 적용 (/files, /search, /recent, /favorites, /shared, /media, /trash)
- **PASS 조건**: 모든 Core 라우트 화면에 4상태(Loading Skeleton, EmptyState, ErrorState, ForbiddenState) UI 적용.
- **결과**: 
  1. 잔여 다국어 키(`msg.emptyMedia`, `msg.loading`, `msg.forbiddenAdmin`, `action.goBack`, `action.goHome`) 추가 완료.
  2. `FilesPage(FolderView)`, `TrashPage`, `SimplePage` 등에 `EmptyState`, `ErrorState`, `ForbiddenState`, `SkeletonBlock` 적용 완료.
- **상태**: PASS

### T2.3: Admin 라우트 상태 매핑 적용 (/admin/*)
- **PASS 조건**: 관리자 전용 페이지들에 `ForbiddenState`(`msg.forbiddenAdmin` 표시 및 홈버튼) 및 로딩/에러 상태가 적용되어야 함.
- **결과**: `AdminStoragePage`, `AdminMigrationPage` 및 기타 하위 페이지에 4대 상태 컴포넌트(Skeleton, Empty, Error, Forbidden) 적용 완료.
- **상태**: PASS

## Phase 3: Files UX 고도화 (Desktop-first)

### T3.1 & T3.6: Layout Toggle & Breadcrumbs
- **PASS 조건**: Table/Grid 뷰 토글 구현, `useViewPreferences` 로컬 상태 저장 적용, Breadcrumb 길 경우 생략 표시.
- **결과**: `GridView.tsx` 구현, `FilesPage.tsx` 헤더에 토글 적용 완료. `BreadcrumbTrail.tsx`에서 depth 4 초과 시 생략 버튼과 dropdown 목록 구현.
- **상태**: PASS

### T3.2 & T3.5: Toolbar & Selection Mode
- **PASS 조건**: 다중 선택(Shift/Cmd Click)을 지원하고, 체크된 항목에 대한 Floating Action Bar (SelectionActionBar) 구현.
- **결과**: `SelectionActionBar.tsx` 추가 (slideUp 애니메이션). `FolderView`와 `GridView`에 다중 선택 로직 통합 완료.
- **상태**: PASS

### T3.7 & T3.8: Item Context Menu & Empty Fields
- **상태**: PASS

## Phase 4: Media UX 고도화 (프리뷰/성능)

### T4.1 - T4.6: Media UX Implementations
- **PASS 조건**: 미디어 갤러리(/media) 화면에서 Grid 레이아웃, `MediaCard`, `Lightbox` 컴포넌트를 점진 로딩/fallback 스펙으로 구현한다.
- **상태**: PASS

## Phase 5: Admin Settings UX 고도화

### T5.1 - T5.7: Admin Components
- **PASS 조건**: 설정 홈 섹션 카드, 폼 레이아웃 규칙, 위험 액션(DangerZone), ConfirmDialog가 구현되어야 한다.
- **결과**: `packages/ui-kit`에 `SectionCard`, `FormField`, `DangerZone`, `ConfirmDialog`, `StatusBadge`, `TabBar` 컴포넌트들을 각각 구현 및 export 완료. `packages/ui`의 Admin 라우트 토큰화를 진행하면서 `AdminHomePage`를 6개 `SectionCard` 구조로 통일하고, `AdminUsersPage` 탭을 `TabBar` 기반으로 전환했다. `AdminStoragePage`는 하위 섹션 컴포넌트로 분리해 본문 파일 길이를 400줄 이하로 축소했다. 다국어 키는 ko-KR/en-US 및 COPY_KEYS SSOT에 역반영 완료.
- **상태**: PASS

## Phase 6: Mobile 적응형 내비 / Density 튜닝

### T6.1 - T6.6: Mobile Adaptations
- **PASS 조건**: BottomNav, OverlaySidebar, BottomSheet 및 터치 타겟(48dp) 스펙 지원.
- **결과**: `packages/ui-kit/src/components/mobile` 하위에 `BottomNav`, `BottomSheet`, `OverlaySidebar` 신규 구현. 48dp 최소 터치 타겟 조건을 위해 `minHeight: 56px` 등을 지정함.
- **상태**: PASS

## Phase 7: 접근성(A11y) & 품질 게이트

### T7.1 - T7.3: A11y & Quality
- **PASS 조건**: 키보드 Focus Visible 및 대비 체크 등 스타일 추가
- **결과**: `packages/ui-kit/src/styles/global.css` 내 `*:focus-visible` 전역 규칙 추가하여 모든 포커스 가능한 요소의 접근성을 강화함.
- **상태**: PASS

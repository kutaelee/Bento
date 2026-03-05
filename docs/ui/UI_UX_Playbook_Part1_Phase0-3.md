# Nimbus Drive — UI/UX 고도화 페이즈별 플레이북

> Generated: 2026-03-03 · Design-only (구현 코드 금지)
> SSOT 기준: `IA_NAV_SSOT.md` rev HEAD, `COPY_KEYS_SSOT.md` rev HEAD

---

## 전체 페이즈 개요

| Phase | 이름 | 핵심 산출물 | 의존 |
|-------|------|------------|------|
| 0 | Baseline & SSOT 정합 | 라우트별 현황표, gap list | — |
| 1 | 디자인 토큰 / 레이아웃 규격 | semantic token 스펙, 레이아웃 규칙 | P0 |
| 2 | 상태 UX 표준화 | State 카탈로그, 화면별 상태 매핑표 | P0, P1 |
| 3 | Files UX 고도화 | 3-pane 컴포지션 스펙, 선택/벌크 액션 규칙 | P1, P2 |
| 4 | Media UX 고도화 | 미디어 카드/프리뷰 스펙, 점진 로딩 규칙 | P1, P2 |
| 5 | Admin Settings UX | 섹션 맵, 폼 규격, 위험 액션 분리 | P1, P2 |
| 6 | Mobile 적응형 | breakpoint 규칙, touch target, bottom nav | P1-P5 |
| 7 | 접근성 & 품질 게이트 | A11y 체크리스트, CI 게이트 설계 | P1-P6 |

---

## 현재 코드베이스 Gap 분석 요약

| 항목 | 현황 | Gap |
|------|------|-----|
| **토큰** | `colors.ts`(10), `typography.ts`(7 sizes), `radius.ts`(4) | spacing·elevation·shadow·semantic color 토큰 **미존재** |
| **하드코딩** | `packages/ui/src/app/` 14개 파일 전체에 hex/px 인라인 | 토큰 참조 0% |
| **상태 UX** | grep "skeleton\|loading\|empty\|error\|forbidden" → 0 hit | 4-state 패턴 **미구현** |
| **컴포넌트** | ui-kit 8개 (Button, DataTable, Dialog, TextField, TreeView, VirtualList, Link, PasswordField) | Skeleton, EmptyState, ErrorBoundary, Badge, Card, Toolbar, Toast **미존재** |
| **i18n** | 90키 → COPY_KEYS_SSOT와 일치 | state UX 관련 키 부족 (loading/forbidden 메시지 등) |
| **레이아웃** | AppShell 1개 (sidebar 260px 고정) | responsive breakpoint·inspector·mobile 규칙 **없음** |
| **다크모드** | `colors.background.dark`, `colors.surface.dark` 정의됨 | 적용 로직·CSS 변수 매핑 **미구현** |

---

## Phase 0 — Baseline & SSOT 정합

### 1) Goal
현재 UI의 IA·COPY·컴포넌트·토큰·상태 커버리지를 inventory로 고정하여 이후 Phase의 기준선을 확보한다.

### 2) In-scope / Out-of-scope
- **In**: 라우트 현황 수집, 하드코드 문자열 목록, 토큰 미사용 부위 목록, 상태 미정의 목록, 접근성 기초 점검
- **Out**: 백엔드/API 변경, IA 라우트 추가·삭제, 토큰 구현

### 3) Affected routes (IA_NAV 기준)
모든 라우트 — `/files`, `/files/:nodeId`, `/search`, `/recent`, `/favorites`, `/shared`, `/media`, `/trash`, `/login`, `/setup`, `/invite/accept`, `/admin`, `/admin/users`, `/admin/storage`, `/admin/migration`, `/admin/performance`, `/admin/jobs`, `/admin/audit`, `/admin/security`, `/admin/appearance`

### 4) Design patterns
1. **Inventory Table** — 라우트×항목 매트릭스로 커버리지를 시각화
2. **Hardcode Audit** — AST/grep 기반 하드코딩 발견→토큰 매핑 계획
3. **State Coverage Matrix** — 라우트별 loading/empty/error/forbidden 정의 여부 체크
4. **Copy Key Reconciliation** — 코드 내 i18n key 사용 vs SSOT 키 비교

### 5) Required tokens/components
- (이 Phase에서는 신규 토큰/컴포넌트 생성 없음—현황 수집만)

### 6) COPY_KEYS 영향
- 사용 중인 키: 전수 조사 대상 (~90개)
- **추가 필요 예상 키**: `msg.loading`, `err.forbidden`, `msg.emptyMedia`, `msg.emptyAdmin*`, `status.loading` (Phase 2에서 정식 추가 태스크로 분리)

### 7) Tasks

| # | Task | 단위 | 산출물 |
|---|------|------|--------|
| T0.1 | 라우트 전체 커버리지 표 작성 | 1 표 | `docs/ui/baseline/route-inventory.md` |
| T0.2 | 하드코딩 hex/px 전수 조사 | 14 파일 grep | `docs/ui/baseline/hardcode-audit.csv` |
| T0.3 | COPY_KEYS 사용 매핑 (코드 vs SSOT) | grep + diff | `docs/ui/baseline/copy-key-reconciliation.md` |
| T0.4 | 상태 커버리지 매트릭스 | 20 라우트 × 4상태 | `docs/ui/baseline/state-coverage-matrix.md` |
| T0.5 | 컴포넌트 인벤토리 (ui-kit vs 필요) | 8 기존 + gap | `docs/ui/baseline/component-inventory.md` |
| T0.6 | 접근성 기초 점검 목록 | axe-core dry-run | `docs/ui/baseline/a11y-baseline.md` |

### 8) DoD
- [ ] IA_NAV 라우트 20개 전체 커버리지 표 100% 채움
- [ ] 하드코딩 발견 목록 작성 ≥ 1개 파일
- [ ] COPY_KEYS 매핑에서 `코드 사용 키 ⊆ SSOT 키` 검증 결과 문서화
- [ ] 상태 커버리지 매트릭스에서 "미정의" 셀 목록 추출

### 9) Evidence plan

| Evidence | 명령 | Pass 조건 |
|----------|------|-----------|
| 라우트 커버 | `grep -c "path:" packages/ui/src/routes.ts` → 20개 이상 | routes.ts 라우트 수 = IA_NAV 라우트 수 |
| 하드코딩 | `grep -rn "#[0-9a-fA-F]\{3,6\}" packages/ui/src/app/` | 결과를 audit CSV에 전수 기록 |
| 카피키 | `grep -roh "\"[a-z]\+\.[a-z.]\+\"" packages/ui/src/ \| sort -u` vs SSOT 키 비교 | 코드 키 ⊆ SSOT 키 |
| 상태 매트릭스 | 수동 분석 → matrix MD 파일 존재 | 모든 라우트에 4열 채움 |

### 10) Risks & mitigations
| Risk | Mitigation |
|------|-----------|
| grep 패턴이 CSS-in-JS 변수를 놓침 | AST 기반 보조 스크립트(선택, Phase 1에서 린트로 전환) |
| 라우트 추가 시 inventory 깨짐 | routes.ts 변경 → inventory 업데이트 자동 리마인더(CI 코멘트) |

---

## Phase 1 — 디자인 토큰 / 레이아웃 규격 (Foundation) ★ 최우선 Phase

### 1) Goal
spacing·typography·radius·elevation·semantic color를 토큰으로 규격화하고, Desktop 3-pane / Tablet 2-pane / Mobile single-pane 레이아웃 표준을 확립한다.

### 2) In-scope / Out-of-scope
- **In**: 토큰 스펙 설계, CSS 변수 네이밍, semantic 토큰(light/dark), 레이아웃 breakpoint 규칙, 컴포넌트 density 규격
- **Out**: 실제 코드 마이그레이션(Phase 3-6에서), IA 변경

### 3) Affected routes
전체 (토큰은 global foundation)

### 4) Design patterns
1. **Semantic Token Layer** — primitive → semantic → component 3계층 (Material 3 참조)
2. **Elevation Tiers** — 5단계 얕은 depth (`elevation.0` ~ `elevation.4`), subtle shadow
3. **Spacing Scale** — 4px base grid (4·8·12·16·20·24·32·40·48·64)
4. **Responsive Layout Grid** — Desktop ≥1280: 3-pane, Tablet 768-1279: 2-pane, Mobile <768: single-pane
5. **Dark-first Color Mapping** — 모든 semantic 토큰에 light/dark 쌍 정의
6. **Density Modes** — compact(32px row) / comfortable(40px row) / spacious(48px row)
7. **Token Enforcement** — 정적분석 규칙(해당 패턴의 금지 regex)

### 5) Required tokens/components

**신규 토큰 (스펙 산출물)**:

| 카테고리 | 키 패턴 | 예시 |
|----------|---------|------|
| spacing | `space.{1..16}` | `space.1`=4px, `space.4`=16px |
| elevation | `elevation.{0..4}` | `elevation.1`="0 1px 2px rgba(0,0,0,.06)" |
| shadow | `shadow.{sm,md,lg}` | 토큰 정의만 |
| semantic color | `color.surface.{primary,secondary,tertiary}` | light/dark 쌍 |
| semantic color | `color.text.{primary,secondary,disabled}` | light/dark 쌍 |
| semantic color | `color.border.{default,subtle,strong}` | light/dark 쌍 |
| semantic color | `color.status.{success,warning,danger,info}` | light/dark 쌍 |
| semantic color | `color.accent.{default,hover,pressed}` | light/dark 쌍 |

**레이아웃 상수 (스펙 산출물)**:

| 상수 | 값 |
|------|-----|
| sidebar.width.desktop | 260px |
| sidebar.width.collapsed | 56px |
| topbar.height | 56px |
| inspector.width | 320px |
| breakpoint.mobile | 768px |
| breakpoint.tablet | 1280px |

### 6) COPY_KEYS 영향
- 이 Phase에서 카피키 변경 없음 (토큰/레이아웃은 비문자열)

### 7) Tasks

| # | Task | 산출물 |
|---|------|--------|
| T1.1 | Spacing scale 스펙 문서 | `docs/ui/tokens/spacing.md` |
| T1.2 | Semantic color 토큰 스펙 (light + dark) | `docs/ui/tokens/semantic-colors.md` |
| T1.3 | Elevation & shadow 스펙 | `docs/ui/tokens/elevation.md` |
| T1.4 | Typography 토큰 보강 스펙 (line-height, letter-spacing 추가) | `docs/ui/tokens/typography-extended.md` |
| T1.5 | Radius 토큰 보강 (component-level alias 추가) | `docs/ui/tokens/radius-extended.md` |
| T1.6 | Desktop 3-pane 레이아웃 규격 | `docs/ui/layout/desktop-3pane.md` |
| T1.7 | Tablet 2-pane 레이아웃 규격 | `docs/ui/layout/tablet-2pane.md` |
| T1.8 | Mobile single-pane 레이아웃 규격 | `docs/ui/layout/mobile-single.md` |
| T1.9 | Density 모드 규격 (compact / comfortable / spacious) | `docs/ui/tokens/density.md` |
| T1.10 | Token enforcement 규칙 설계 (금지 regex + CI 게이트 초안) | `docs/ui/tokens/enforcement-rules.md` |
| T1.11 | CSS 변수 네이밍 컨벤션 문서 | `docs/ui/tokens/css-var-convention.md` |
| T1.12 | 토큰 마이그레이션 체크리스트 (파일 14개 × 변환 규칙) | `docs/ui/tokens/migration-checklist.md` |

### 8) DoD
- [ ] 모든 토큰 카테고리(spacing, color, elevation, typography, radius)에 스펙 문서 존재
- [ ] 각 semantic color가 light/dark 값 쌍을 가짐
- [ ] "임의 px/hex 금지" 검증 가능한 regex 규칙이 `enforcement-rules.md`에 포함
- [ ] Breakpoint 3구간(mobile/tablet/desktop) 레이아웃 규칙이 문서화

### 9) Evidence plan

| Evidence | 명령 | Pass 조건 |
|----------|------|-----------|
| 토큰 문서 존재 | `ls docs/ui/tokens/*.md \| wc -l` | ≥ 7 파일 |
| semantic color 쌍 | 스펙 내 `light:` / `dark:` 쌍 검증 (grep) | 모든 semantic 키에 2개 값 |
| 금지 regex | `enforcement-rules.md`에 regex 패턴 ≥3개 | 패턴이 '#fff', '16px' 등을 매칭 |
| 레이아웃 문서 | `ls docs/ui/layout/*.md \| wc -l` | ≥ 3 파일 |

### 10) Risks & mitigations
| Risk | Mitigation |
|------|-----------|
| 토큰 과잉/부족 | Phase 3-5 적용 시 피드백 루프로 토큰 추가/병합 |
| 다크모드 대비 부적합 | WCAG AA 대비비(4.5:1 텍스트, 3:1 UI) 기준을 스펙에 명시 |
| CSS 변수 이름 충돌 | `--nd-` 네임스페이스 프리픽스 강제 |

---

## Phase 2 — 상태 UX 표준화 (State System)

### 1) Goal
모든 핵심 화면에 loading/empty/error/forbidden 4상태를 동일 패턴으로 제공하는 State System을 설계한다.

### 2) In-scope / Out-of-scope
- **In**: 4상태 패턴 카탈로그, 라우트별 상태 매핑, 필요 COPY_KEYS 목록, 스켈레톤/empty/error/forbidden 컴포넌트 스펙
- **Out**: 컴포넌트 구현 코드, 백엔드 에러 코드 변경

### 3) Affected routes
핵심: `/files`, `/files/:nodeId`, `/search`, `/recent`, `/favorites`, `/shared`, `/media`, `/trash`, `/admin`, `/admin/users`, `/admin/storage`, `/admin/migration`, `/admin/performance`, `/admin/jobs`, `/admin/audit`, `/admin/security`, `/admin/appearance`

### 4) Design patterns
1. **Skeleton-first Loading** — 페이지 구조를 유지한 채 pulse 애니메이션
2. **Contextual Empty State** — 아이콘 + 메시지 + CTA 버튼 (라우트별 차별화)
3. **Inline Error + Retry** — 에러 메시지 + retry 버튼 (페이지 이탈 방지)
4. **Forbidden Guard** — 권한 부족 시 안내 메시지 + 대안 동선 (뒤로가기/홈)
5. **Toast Feedback** — 액션 결과를 non-blocking toast로 전달

### 5) Required tokens/components (스펙 수준)

| 컴포넌트 (설계) | 역할 |
|-----------------|------|
| `<SkeletonBlock>` | 사각형/원형 pulse placeholder |
| `<EmptyState>` | icon + titleKey + descKey + CTA |
| `<ErrorState>` | icon + errorKey + retry action |
| `<ForbiddenState>` | icon + forbiddenKey + back/home action |
| `<Toast>` | status color + message + auto-dismiss |

### 6) COPY_KEYS 영향
**추가 필요 키 (SSOT 변경 제안서로 분리)**:

| key | ko-KR | en-US |
|-----|-------|-------|
| `msg.loading` | 불러오는 중… | Loading… |
| `err.forbidden` | (이미 존재) | — |
| `msg.emptyMedia` | 미디어가 없습니다. | No media. |
| `msg.emptyJobs` | (=`msg.noJobs`, 이미 존재) | — |
| `msg.forbiddenAdmin` | 관리자만 접근할 수 있습니다. | Admin access only. |
| `action.goBack` | 뒤로 가기 | Go back |
| `action.goHome` | 홈으로 | Go to home |

### 7) Tasks

| # | Task | 산출물 |
|---|------|--------|
| T2.1 | 4상태 패턴 카탈로그 (스켈레톤 규칙, empty CTA, error retry, forbidden 안내) | `docs/ui/states/state-pattern-catalog.md` |
| T2.2 | Core 라우트 상태 매핑표 (/files, /search, /recent, /favorites, /shared, /media, /trash) | `docs/ui/states/core-state-mapping.md` |
| T2.3 | Admin 라우트 상태 매핑표 (/admin/*) | `docs/ui/states/admin-state-mapping.md` |
| T2.4 | Auth 라우트 상태 매핑표 (/login, /setup, /invite/accept) | `docs/ui/states/auth-state-mapping.md` |
| T2.5 | 추가 필요 COPY_KEYS 목록 (SSOT 변경 제안서) | `docs/ui/states/copy-keys-addition-proposal.md` |
| T2.6 | 스켈레톤 컴포넌트 스펙 | `docs/ui/states/skeleton-spec.md` |
| T2.7 | EmptyState / ErrorState / ForbiddenState 컴포넌트 스펙 | `docs/ui/states/state-components-spec.md` |
| T2.8 | Toast 컴포넌트 스펙 | `docs/ui/states/toast-spec.md` |

### 8) DoD
- [ ] 핵심 라우트(core 8 + admin 9 = 17개)에 4상태 정의 완료
- [ ] 카피는 COPY_KEYS만 사용 — 추가 필요 키 목록이 별도 문서로 분리
- [ ] 스켈레톤 규칙(블록 크기·pulse 속도·개수)이 명시
- [ ] empty CTA가 라우트별로 차별화(예: /files→"업로드", /trash→"비어있음")

### 9) Evidence plan

| Evidence | 명령 | Pass 조건 |
|----------|------|-----------|
| 상태 매핑 100% | 매핑표에서 "미정의" 셀 0개 | 17 라우트 × 4 상태 = 68 셀 모두 채움 |
| 키 제안서 | `copy-keys-addition-proposal.md` 존재 | 추가 키 ≥ 3개 |
| 컴포넌트 스펙 | `docs/ui/states/{skeleton,state-components,toast}-spec.md` 존재 | 3 파일 |

### 10) Risks & mitigations
| Risk | Mitigation |
|------|-----------|
| 상태 조합 폭발 (loading + error 동시?) | 우선순위 규칙 명시: forbidden > error > loading > empty |
| 스켈레톤이 실제 레이아웃과 불일치 | Phase 1 레이아웃 규격 참조, 스켈레톤은 레이아웃 규격에 종속 |

---

## Phase 3 — Files UX 고도화 (Desktop-first)

### 1) Goal
3-pane(좌 트리 / 중 리스트·그리드 / 우 인스펙터) + toolbar + selection/bulk action 패턴을 표준화한다.

### 2) In-scope / Out-of-scope
- **In**: 3-pane 컴포지션 스펙, 리스트↔그리드 전환, 정렬/필터 UX, 선택 모드, 벌크 액션 바, 컨텍스트 메뉴 규칙, 드래그&드롭 규칙
- **Out**: 백엔드 API 변경, 새 라우트 추가, 실제 컴포넌트 구현

### 3) Affected routes
`/files`, `/files/:nodeId`, `/search`, `/recent`, `/favorites`, `/shared`, `/trash`

### 4) Design patterns
1. **3-Pane Composition** — sidebar tree(260px) + main list/grid(flex) + inspector(320px, toggle)
2. **View Toggle** — list/grid 전환, 사용자 preference 로컬 저장
3. **Contextual Toolbar** — 0선택: 정렬/필터/뷰토글, 1+선택: 벌크 액션
4. **Multi-select** — click=단일, Shift+click=범위, Ctrl+click=토글
5. **Bulk Action Bar** — 선택 카운트 + 이동/복사/삭제/공유/다운로드 아이콘 버튼
6. **Context Menu** — 우클릭 → 항목별 액션(rename, move, copy, share, delete, details)
7. **Drag & Drop** — 파일→폴더 이동 시각 피드백(drop zone highlight)
8. **Breadcrumb Navigation** — 클릭 시 해당 폴더로 이동, 경로 길 때 축소

### 5) Required tokens/components (스펙)
- `<Toolbar>` — 상황별 액션 바
- `<BulkActionBar>` — 선택 시 표시
- `<ContextMenu>` — 우클릭 메뉴
- `<FileRow>` / `<FileCard>` — 리스트/그리드 항목
- `<ViewToggle>` — list/grid 스위치
- `<SortDropdown>` — 정렬 드롭다운
- `<FilterChips>` — 타입 필터

### 6) COPY_KEYS 영향
- 기존 키 사용: `action.move`, `action.copy`, `action.delete`, `action.share`, `action.download`, `action.rename`, `field.name`, `field.modifiedAt`, `field.size`
- **추가 필요 키**: `action.selectAll`, `msg.nSelected` (예: "{n}개 선택됨"), `action.deselectAll`

### 7) Tasks

| # | Task | 산출물 |
|---|------|--------|
| T3.1 | 3-pane 컴포지션 스펙 (비율, 토글, 최소폭) | `docs/ui/files/3pane-composition.md` |
| T3.2 | Toolbar 상태 흐름 스펙 (0선택/1선택/N선택) | `docs/ui/files/toolbar-states.md` |
| T3.3 | 리스트/그리드 전환 규칙 | `docs/ui/files/view-toggle.md` |
| T3.4 | 정렬/필터 UX 규칙 | `docs/ui/files/sort-filter.md` |
| T3.5 | 선택 모드 + 벌크 액션 바 스펙 | `docs/ui/files/selection-bulk.md` |
| T3.6 | 컨텍스트 메뉴 규칙 | `docs/ui/files/context-menu.md` |
| T3.7 | 드래그&드롭 규칙 | `docs/ui/files/drag-drop.md` |
| T3.8 | 검색 결과 페이지 UX 스펙 | `docs/ui/files/search-results.md` |
| T3.9 | 추가 COPY_KEYS 제안서 | `docs/ui/files/copy-keys-proposal.md` |

### 8) DoD
- [ ] 흐름(탐색→선택→액션→확인)이 라우트 전반에서 일관
- [ ] 선택 상태/벌크 액션이 "명확한 시각 언어"로 통일 (토큰 기반 색상)
- [ ] Toolbar가 0/1/N 선택 각각에서 다른 액션을 표시하는 규칙 명시
- [ ] 3-pane 각 패널의 최소/최대 폭, 토글 조건 정의

### 9) Evidence plan

| Evidence | 명령 | Pass 조건 |
|----------|------|-----------|
| 스펙 문서 존재 | `ls docs/ui/files/*.md \| wc -l` | ≥ 8 파일 |
| 3-pane 규격 | `grep "최소폭\|minimum width" docs/ui/files/3pane-composition.md` | ≥ 3 값 (sidebar/main/inspector) |
| Toolbar 상태 | 0/1/N 선택 케이스가 모두 정의 | 3 케이스 |

### 10) Risks & mitigations
| Risk | Mitigation |
|------|-----------|
| 드래그&드롭이 모바일에서 미지원 | Phase 6에서 long-press 대체 규칙 별도 설계 |
| 그리드 뷰가 다양한 파일 타입에 대응 어려움 | 파일 타입별 썸네일 규칙을 Phase 4에서 병행 |

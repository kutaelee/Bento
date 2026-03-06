# Bento — UI/UX 고도화 플레이북 (Part 2: Phase 4-7 + 우선 Task + 체크리스트)

---

## Phase 4 — Media UX 고도화 (프리뷰/성능)

### 1) Goal
미디어 그리드/프리뷰/메타 인스펙터 패턴을 표준화하고, 대용량·느린 로딩 시에도 사용자 불안이 없도록 점진 로딩 규칙을 확립한다.

### 2) In-scope / Out-of-scope
- **In**: 미디어 카드 스펙, 썸네일 규칙(크기/비율/placeholder), 프리뷰 오버레이/라이트박스 규칙, 비디오 플레이 상태, 메타 인스펙터 표시 항목, 점진 로딩(lazy+skeleton)
- **Out**: 백엔드 썸네일 생성 로직, CDN 설정, 코덱 변환

### 3) Affected routes
`/media`

### 4) Design patterns
1. **Masonry/Grid Layout** — 정사각 또는 비율유지 그리드, gap=space.2
2. **Progressive Image Loading** — blur-up placeholder → 실제 이미지
3. **Lightbox Preview** — 클릭→전체화면 오버레이, 좌우 네비, ESC 닫기
4. **Video Inline Play** — hover시 auto-preview(음소거), 클릭시 lightbox
5. **Broken Thumbnail Fallback** — 생성 실패 시 파일 타입 아이콘 + overlay badge

### 5) Required tokens/components (스펙)
- `<MediaCard>` — 썸네일 + overlay 액션(select, preview, download)
- `<Lightbox>` — 전체화면 프리뷰 + nav + close
- `<ThumbnailPlaceholder>` — skeleton / blur-up / fallback icon

### 6) COPY_KEYS 영향
- 사용: `msg.emptyMedia`(추가 제안), `action.download`, `action.share`, `action.delete`
- **추가 필요**: `msg.thumbnailFailed`("미리보기를 생성할 수 없습니다")

### 7) Tasks

| # | Task | 산출물 |
|---|------|--------|
| T4.1 | 미디어 그리드 레이아웃 스펙 | `docs/ui/media/grid-layout.md` |
| T4.2 | 미디어 카드 컴포넌트 스펙 | `docs/ui/media/media-card-spec.md` |
| T4.3 | 점진 로딩 + placeholder 규칙 | `docs/ui/media/progressive-loading.md` |
| T4.4 | Lightbox 프리뷰 스펙 | `docs/ui/media/lightbox-spec.md` |
| T4.5 | 비디오 인라인/플레이 상태 규칙 | `docs/ui/media/video-states.md` |
| T4.6 | 썸네일 실패 fallback 규칙 | `docs/ui/media/thumbnail-fallback.md` |

### 8) DoD
- [ ] 대용량/느린 로딩 시 "점진 로딩 규칙" 문서에 명시 (blur-up, skeleton 크기, timeout)
- [ ] broken thumbnail fallback이 파일 타입별로 정의
- [ ] Lightbox 키보드 네비게이션(←→, ESC) 규칙 포함

### 9) Evidence plan

| Evidence | 명령 | Pass 조건 |
|----------|------|-----------|
| 스펙 문서 존재 | `ls docs/ui/media/*.md \| wc -l` | ≥ 5 파일 |
| 점진 로딩 | `grep -c "blur-up\|skeleton\|placeholder" docs/ui/media/progressive-loading.md` | ≥ 3 규칙 |

### 10) Risks & mitigations
| Risk | Mitigation |
|------|-----------|
| 대용량 갤러리 성능 | 가상 스크롤(VirtualList 재활용) 규칙을 스펙에 포함 |
| 지원 코덱 범위 | 스펙에 지원 MIME 목록을 명시, 미지원은 fallback 처리 |

---

## Phase 5 — Admin Settings UX 고도화

### 1) Goal
설정 화면을 "섹션 카드 + 폼 레이아웃 + 위험 액션 분리"로 정리한다.

### 2) In-scope / Out-of-scope
- **In**: 설정 홈 섹션 카드 레이아웃, 폼 컴포넌트 규격, 필수/검증/도움말/저장 피드백, 위험 액션 zone + 확인 다이얼로그
- **Out**: 백엔드 API 변경, 새 설정 항목 추가, IA 변경

### 3) Affected routes
`/admin`, `/admin/users`, `/admin/storage`, `/admin/migration`, `/admin/performance`, `/admin/jobs`, `/admin/audit`, `/admin/security`, `/admin/appearance`

### 4) Design patterns
1. **Section Card Grid** — 설정 홈에 6개 섹션 카드(아이콘+제목+설명+화살표)
2. **Form Layout Standard** — label 위/필드 아래, 도움말 텍스트, 검증 에러 인라인
3. **Save Feedback** — 저장 성공 toast, 실패 시 인라인 에러
4. **Danger Zone** — 빨간 테두리 영역, 확인 다이얼로그 필수(타이핑 확인 옵션)
5. **Tab Navigation** — Users(사용자/초대), Jobs(큐/실행 중/실패/완료) 탭
6. **Inline Status Badge** — 볼륨/작업 상태를 color-coded badge로 표시

### 5) Required tokens/components (스펙)
- `<SectionCard>` — 아이콘+제목+설명+chevron
- `<FormField>` — label+input+help+error
- `<DangerZone>` — 빨간 border 영역
- `<ConfirmDialog>` — 위험 액션 확인 (타이핑 확인 variant)
- `<StatusBadge>` — 상태별 배지 (ok/degraded/offline/failed)
- `<TabBar>` — 탭 전환

### 6) COPY_KEYS 영향
- 사용: `admin.*` 전체, `modal.delete.*`, `modal.storageValidate.*`, `msg.changesSaved`
- **추가 필요**: `admin.dangerZone`("위험 영역"), `modal.confirm.typeToConfirm`("확인하려면 '{name}' 입력")

### 7) Tasks

| # | Task | 산출물 |
|---|------|--------|
| T5.1 | Admin 홈 섹션 카드 레이아웃 스펙 | `docs/ui/admin/home-section-cards.md` |
| T5.2 | 폼 레이아웃 표준 스펙 | `docs/ui/admin/form-layout-standard.md` |
| T5.3 | 위험 액션 zone + 확인 다이얼로그 규칙 | `docs/ui/admin/danger-zone.md` |
| T5.4 | Users 탭/초대 UX 스펙 | `docs/ui/admin/users-tab-spec.md` |
| T5.5 | Storage 블록 구성 스펙 | `docs/ui/admin/storage-blocks.md` |
| T5.6 | Jobs 탭 + 상태 배지 스펙 | `docs/ui/admin/jobs-tab-spec.md` |
| T5.7 | 저장 피드백(toast/inline error) 규칙 | `docs/ui/admin/save-feedback.md` |

### 8) DoD
- [ ] 위험 액션(삭제/토큰 재발급 등)은 별도 zone + 확인 다이얼로그 규칙 고정
- [ ] 폼 필드의 필수/검증/도움말/에러 4요소가 스펙에 포함
- [ ] 설정 홈 6개 섹션 카드가 IA_NAV §3.1과 1:1 매칭

### 9) Evidence plan

| Evidence | 명령 | Pass 조건 |
|----------|------|-----------|
| 스펙 문서 | `ls docs/ui/admin/*.md \| wc -l` | ≥ 6 파일 |
| 위험 액션 | 스펙 내 "확인 다이얼로그" 규칙 존재 | grep hit ≥ 1 |

### 10) Risks & mitigations
| Risk | Mitigation |
|------|-----------|
| 설정 항목 증가 시 스크롤 과잉 | 섹션 접기/펼치기(Accordion) 패턴 예비 제안 |

---

## Phase 6 — Mobile 적응형 내비 / Density 튜닝

### 1) Goal
모바일 bottom nav 기반으로 핵심 동선(파일/업로드/설정)을 안정화하고, breakpoint별 정보 밀도를 조절한다.

### 2) In-scope / Out-of-scope
- **In**: Bottom nav 스펙 (IA_NAV §4 '파일/업로드/설정'), overlay sidebar, single-pane 규칙, touch target 크기, 스크롤/툴바 고정 규칙
- **Out**: 네이티브 앱, IA 변경(탭 순서·이름 변경 금지)

### 3) Affected routes
모든 라우트 (레이아웃 전환)

### 4) Design patterns
1. **Bottom Navigation** — 3탭 고정(파일/업로드/설정), IA_NAV §4 종속
2. **Overlay Sidebar** — 폴더 트리를 햄버거→오버레이로 제공
3. **Single-pane Priority** — 인스펙터는 만 스크린 모달/bottom sheet
4. **Touch Target 48dp** — 최소 터치 영역 48×48dp
5. **Sticky Toolbar** — 스크롤 시 toolbar 상단 고정
6. **Swipe Actions** — 좌/우 스와이프로 삭제/공유(선택적)

### 5) Required tokens/components (스펙)
- `<BottomNav>` — 3탭 네비게이션 바
- `<OverlaySidebar>` — 모바일 트리 오버레이
- `<BottomSheet>` — 인스펙터/액션 시트 대체

### 6) COPY_KEYS 영향
- 사용: `nav.files`, `action.upload`, `nav.settings` (기존 키)
- 추가 필요 없음

### 7) Tasks

| # | Task | 산출물 |
|---|------|--------|
| T6.1 | Bottom nav 스펙 | `docs/ui/mobile/bottom-nav.md` |
| T6.2 | Overlay sidebar 스펙 | `docs/ui/mobile/overlay-sidebar.md` |
| T6.3 | Single-pane 전환 규칙 | `docs/ui/mobile/single-pane.md` |
| T6.4 | Touch target / spacing 규칙 | `docs/ui/mobile/touch-target.md` |
| T6.5 | Toolbar 고정 / 스크롤 규칙 | `docs/ui/mobile/sticky-toolbar.md` |
| T6.6 | Breakpoint별 검증 매트릭스 (360/768/1280) | `docs/ui/mobile/breakpoint-matrix.md` |

### 8) DoD
- [ ] 대표 폭 3구간(360px / 768px / 1280px)에서 레이아웃·액션 접근성 유지 규칙 정의
- [ ] Bottom nav 3탭이 IA_NAV §4와 1:1
- [ ] 모든 interactive element에 48dp 최소 터치 규칙 명시

### 9) Evidence plan

| Evidence | 명령 | Pass 조건 |
|----------|------|-----------|
| 스펙 문서 | `ls docs/ui/mobile/*.md \| wc -l` | ≥ 5 파일 |
| 터치 타겟 | `grep "48" docs/ui/mobile/touch-target.md` | ≥ 1 hit |

### 10) Risks & mitigations
| Risk | Mitigation |
|------|-----------|
| 모바일 레이아웃이 desktop 전용 컴포넌트와 충돌 | 컴포넌트에 responsive slot/variant를 스펙 수준에서 정의 |

---

## Phase 7 — 접근성(A11y) & 품질 게이트

### 1) Goal
키보드 포커스, 대비, aria, 상태 안내를 "게이트(차단 규칙)"로 만들어 위반 시 머지 불가 정책을 확립한다.

### 2) In-scope / Out-of-scope
- **In**: A11y 체크리스트, 키보드 Nav 규칙, 대비비 기준, aria 라벨 규칙, CI 게이트 도구 제안, fail-closed 기준
- **Out**: 실제 CI 파이프라인 구축, axe-core 설치

### 3) Affected routes
전체

### 4) Design patterns
1. **Focus Visible** — 모든 interactive 요소에 focus ring(2px, accent color)
2. **WCAG AA Contrast** — 텍스트 4.5:1, UI 3:1 최소
3. **ARIA Labels** — 아이콘 버튼에 `aria-label`, 모달에 `aria-modal`+`role=dialog`
4. **Live Region** — toast/status 변경 시 `aria-live="polite"`
5. **Skip Link** — 페이지 상단 "본문 바로가기" 숨김 링크

### 5) Required tokens/components (스펙)
- Focus ring 토큰: `focus.ring.width`=2px, `focus.ring.color`=`color.accent.default`
- `<SkipLink>` 컴포넌트 스펙

### 6) COPY_KEYS 영향
- **추가 필요**: `a11y.skipToContent`("본문 바로가기" / "Skip to content")

### 7) Tasks

| # | Task | 산출물 |
|---|------|--------|
| T7.1 | A11y 체크리스트 (컴포넌트별) | `docs/ui/a11y/checklist.md` |
| T7.2 | 키보드 네비게이션 규칙 | `docs/ui/a11y/keyboard-nav.md` |
| T7.3 | 색상 대비 기준 + 검증 방법 | `docs/ui/a11y/contrast-standard.md` |
| T7.4 | ARIA 규칙 (라벨, 역할, 라이브 리전) | `docs/ui/a11y/aria-rules.md` |
| T7.5 | CI 게이트 설계 (도구/규칙/fail-closed 기준) | `docs/ui/a11y/ci-gate-design.md` |
| T7.6 | SkipLink + focus ring 스펙 | `docs/ui/a11y/focus-skip-spec.md` |

### 8) DoD
- [ ] Fail-closed 기준 명확 — "axe 위반 1개 이상 → 머지 불가" 규칙 문서화
- [ ] 모든 ui-kit 컴포넌트(8개+신규)에 A11y 체크리스트 행 존재
- [ ] 대비비 검증 방법이 CLI 재현 가능(axe-core CLI 또는 동등)

### 9) Evidence plan

| Evidence | 명령 | Pass 조건 |
|----------|------|-----------|
| 체크리스트 | 컴포넌트 수 ≥ 8개 행 | 체크리스트 내 행 count |
| CI 게이트 | `ci-gate-design.md`에 도구명 + fail 조건 명시 | ≥ 1 도구 |

### 10) Risks & mitigations
| Risk | Mitigation |
|------|-----------|
| axe-core false positive | 허용 목록(known exceptions) 관리 규칙을 게이트 설계에 포함 |
| 접근성 테스트가 빌드 시간 증가 | CI에서 변경 파일만 대상으로 실행하는 incremental 전략 제안 |

---

## ★ 최우선 Phase: Phase 1 — 상세 Task 카드 5개

> Phase 1을 최우선으로 선정한 이유: 토큰 시스템이 없으면 이후 모든 Phase에서 하드코딩이 반복된다. Foundation이 먼저 확립되어야 Phase 2-7이 토큰 기반으로 일관성을 유지할 수 있다.

### Task Card T1.1: Spacing Scale 스펙

- **ID**: T1.1
- **제목**: spacing scale 토큰 스펙 문서 작성
- **선행 조건**: P0 완료 (하드코딩 audit 필요)
- **산출물**: `docs/ui/tokens/spacing.md`
- **상세 내용**:
  - 4px base grid 확정: `space.1`=4, `space.2`=8, `space.3`=12, `space.4`=16, `space.5`=20, `space.6`=24, `space.8`=32, `space.10`=40, `space.12`=48, `space.16`=64
  - CSS 변수 명명: `--nd-space-1` ~ `--nd-space-16`
  - 사용 가이드: 컴포넌트 내부 padding+gap은 space.2~space.4, 섹션 간격은 space.6~space.8, 페이지 margin은 space.8~space.12
  - P0 audit 결과에서 발견된 px 값→토큰 매핑 테이블
- **DoD**: 10개 이상 spacing 토큰 정의 + CSS 변수 네이밍 + 사용 가이드
- **Evidence**: `grep -c "space\." docs/ui/tokens/spacing.md` ≥ 10

### Task Card T1.2: Semantic Color 토큰 스펙

- **ID**: T1.2
- **제목**: semantic color 토큰 스펙 (light + dark)
- **선행 조건**: T1.1 (네이밍 컨벤션 공유)
- **산출물**: `docs/ui/tokens/semantic-colors.md`
- **상세 내용**:
  - 3계층: primitive(hex) → semantic(역할) → component(용도)
  - Semantic 카테고리: surface(primary/secondary/tertiary), text(primary/secondary/disabled), border(default/subtle/strong), accent(default/hover/pressed), status(success/warning/danger/info)
  - 각 semantic 키에 light/dark 값 쌍 필수
  - WCAG AA 대비비(4.5:1 text, 3:1 UI) 기준 명시
  - CSS 변수: `--nd-color-surface-primary`, `--nd-color-text-primary` 등
  - 현재 `colors.ts`의 10개 primitive를 semantic으로 매핑하는 변환 테이블
- **DoD**: ≥20 semantic 토큰, 각각 light+dark 값, 대비비 기준 명시
- **Evidence**: `grep -c "light:\|dark:" docs/ui/tokens/semantic-colors.md` ≥ 40 (20 토큰 × 2)

### Task Card T1.3: Elevation & Shadow 스펙

- **ID**: T1.3
- **제목**: elevation tier + shadow 토큰 스펙
- **선행 조건**: T1.2 (surface color에 elevation 연동)
- **산출물**: `docs/ui/tokens/elevation.md`
- **상세 내용**:
  - 5단계: `elevation.0`(flat), `elevation.1`(card), `elevation.2`(dropdown/popover), `elevation.3`(modal), `elevation.4`(toast/notification)
  - 각 단계에 shadow 값 (light/dark 분리)
  - "절제된 깊이" 원칙: 최대 shadow blur 16px, opacity 0.08 이하(light), 0.24 이하(dark)
  - CSS 변수: `--nd-elevation-0` ~ `--nd-elevation-4`
  - 사용 가이드: 어떤 컴포넌트가 어떤 elevation을 사용하는지 매핑
- **DoD**: 5 elevation 단계 정의, shadow 값 light/dark 각 5개
- **Evidence**: `grep -c "elevation\." docs/ui/tokens/elevation.md` ≥ 5

### Task Card T1.4: Desktop 3-Pane 레이아웃 규격

- **ID**: T1.4
- **제목**: Desktop 3-pane 레이아웃 규격 문서
- **선행 조건**: T1.1 (spacing 토큰)
- **산출물**: `docs/ui/layout/desktop-3pane.md`
- **상세 내용**:
  - Sidebar: 260px 고정 (collapsible→56px), IA_NAV §1.1 순서 준수
  - Main: flex-grow, min-width 480px
  - Inspector: 320px (toggle, 기본 숨김), IA_NAV §1.3 구성
  - Topbar: 56px 고정, IA_NAV §1.2 구성
  - 각 영역의 padding/gap은 spacing 토큰 참조
  - resize handle 규칙 (draggable or fixed breakpoint)
- **DoD**: 3-pane 각 패널 폭/높이/padding 정의, spacing 토큰 참조
- **Evidence**: `grep -c "260\|320\|56\|space\." docs/ui/layout/desktop-3pane.md` ≥ 6

### Task Card T1.5: Token Enforcement 규칙 설계

- **ID**: T1.5
- **제목**: 토큰 하드코딩 금지 정적검사 규칙 설계
- **선행 조건**: T1.1, T1.2
- **산출물**: `docs/ui/tokens/enforcement-rules.md`
- **상세 내용**:
  - 금지 regex 목록:
    - `/#[0-9a-fA-F]{3,8}/` in `.tsx`/`.ts` (colors.ts 제외)
    - `/\d+px/` in style objects (tokens 디렉토리 제외)
    - `/rgba?\(/` in `.tsx`/`.ts`
  - ESLint custom rule 또는 grep 기반 CI 게이트 초안
  - 허용 예외 목록 (tokens/ 디렉토리, 테스트 파일)
  - 리뷰 체크리스트 항목 (PR에서 수동 확인)
- **DoD**: ≥3 금지 regex, CI 게이트 실행 방법 명시, 예외 목록
- **Evidence**: `grep -c "regex\|금지\|forbid" docs/ui/tokens/enforcement-rules.md` ≥ 3

---

## 구현 착수 전 체크리스트 10개

| # | 항목 | 확인 |
|---|------|------|
| 1 | **IA_NAV_SSOT 정합**: `routes.ts`의 20 라우트가 IA_NAV §2와 1:1 매칭 | `[ ]` |
| 2 | **COPY_KEYS_SSOT 정합**: `ko-KR.json`·`en-US.json` 키가 SSOT 표와 동기화 | `[ ]` |
| 3 | **Phase 0 Baseline 완료**: 라우트 현황표·하드코딩 audit·상태 매트릭스 존재 | `[ ]` |
| 4 | **토큰 스펙 확정**: spacing·semantic color·elevation·typography·radius 문서 리뷰 완료 | `[ ]` |
| 5 | **Token enforcement 규칙**: 금지 regex가 CI 또는 lint에서 실행 가능 | `[ ]` |
| 6 | **COPY_KEYS 추가 제안서**: Phase 2-5에서 필요한 신규 키 목록이 SSOT 변경 제안서로 분리 | `[ ]` |
| 7 | **시각회귀 기준선**: pixel diff 대상 스냅샷 또는 대안 전략 결정 | `[ ]` |
| 8 | **A11y 기초 점검**: axe-core 또는 동등 도구로 현재 baseline 위반 목록 확보 | `[ ]` |
| 9 | **증거 폴더 구조**: `evidence/<phase>/<task>/` 디렉토리 컨벤션이 팀에서 합의 | `[ ]` |
| 10 | **리스크 대응 완료**: flake 방지(retry 규칙), 토큰 누락 fallback, i18n 누락 lint 중 최소 1개 활성화 | `[ ]` |

---

> **다음 단계**: 이 플레이북을 리뷰 후, Phase 0 태스크부터 착수합니다. Phase 1은 Phase 0 완료 직후 병행 가능합니다.

# UI_REBUILD_EXECUTION_PLAYBOOK — Nimbus Drive Frontend SSOT

> **문서 역할**: 이 문서는 프론트엔드 UI 재구축의 **단일 실행 원천(SSOT)** 입니다.
> 코딩봇은 이 문서의 Phase→Task 순서대로, **질문 없이** 수행합니다.
> 기존 Stitch/UI 레퍼런스는 더 이상 기준이 아닙니다.

---

## 0) Executive Summary

### 최종 목표
Nimbus Drive의 전체 프론트엔드 UI를 `packages/ui-kit` 디자인 시스템 기반으로 **처음부터 재적용**하여,
모든 라우트에서 일관된 토큰/컴포넌트/상태 UX를 달성하고 CI 게이트를 통과하는 것.

### 버리는 것 (Legacy)
| 항목 | 설명 |
|------|------|
| Stitch 레퍼런스 의존 | `design/stitch/` 산출물은 참고만, SSOT 아님 |
| 하드코딩 스타일 | `#hex`, 인라인 `px`, ad-hoc CSS 클래스 |
| 깡통 HTML 상태 처리 | `if (loading) return <div>로딩...</div>` 패턴 |
| 구 PR #163 코드 | 재사용 가능 부분만 Phase별로 흡수 |

### 고정하는 것 (Backend SSOT)
| 항목 | 설명 |
|------|------|
| `openapi/openapi.yaml` | API 계약 — 프론트는 이 계약만 지킴 |
| 백엔드/DB/서버/워커 | 일체 변경 금지 |
| `evidence/` 구조 | 증거 번들 형식 유지 |

### CI 게이트 전략 요약
| 게이트 | 내용 | 적용 시점 |
|--------|------|-----------|
| **Gate A** (필수) | tsc --noEmit + ESLint + enforce-tokens + 라우트 스모크 | Phase 1~ 모든 PR |
| **Gate B** (확장) | Vitest 유닛 + Storybook 빌드 | Phase 3~ |
| **Gate C** (시각회귀) | Playwright 픽셀 디프 | Phase 5~ (선택→필수 전환) |

### PR 전략
**1 PR = 1 Phase** (고정). 브랜치: `feature/ui-rebuild-P{N}`

---

## 1) 정책 결정 (Phase 0 — Human Decisions 확정)

> 아래 4개 정책은 **확정**입니다. 코딩봇은 질문하지 않고 이 정책을 따릅니다.

### 정책 1: Visual QA — `선택적`
- **채택**: 선택적 (Phase 5부터 Gate C로 점진 도입)
- **이유**: 초기 Phase에서 픽셀 디프는 불안정(flake). 구조/타입 안정성 확보 후 도입이 안전.
- **CI 반영**: Phase 1~4는 Gate A+B만 필수. Phase 5~6에서 Gate C 활성화.
- **flake 대응**: 3회 재시도 후 실패 시 flake allowlist에 추가 (TTL: 해당 Phase 종료 시 만료). Phase 6 완료 시점에 flake allowlist는 **반드시 0건**이어야 함.
- **스냅샷 갱신 규칙**: `--update-snapshots`는 **"의도된 디자인 변경 Task"에서만** 허용. Task 카드에 `[visual-update]` 태그가 있는 경우에만 스냅샷 갱신 커밋 가능. 그 외 Task에서 스냅샷 불일치가 발생하면 코드를 수정해야 함(스냅샷 갱신 금지).

### 정책 2: i18n — `신규 키 허용 + 규칙`
- **채택**: 신규 키 허용 + 네이밍 규칙 필수 준수
- **이유**: UI 재구축 시 신규 상태 메시지가 불가피. 단, 기존 `COPY_KEYS_SSOT.md` 네임스페이스 규칙(`app.*`, `nav.*`, `action.*`, `field.*`, `msg.*`, `err.*`, `status.*`, `modal.*`, `admin.*`) 엄수.
- **CI 반영**: 각 Phase 완료 시 `ko-KR.json`과 `en-US.json`에 동일 키 존재 확인 스크립트 실행.
- **규칙**: (1) 키 네임스페이스 9종 중 하나 사용 (2) `ko-KR.json` + `en-US.json` 동시 추가 (3) 하드코딩 문자열 금지 (4) **i18n 키를 추가/변경한 Task로부터 최대 1~2 Task 이내**에 `COPY_KEYS_SSOT.md` 테이블에 역병합(같은 Phase 내 즉시).

### 정책 3: IA/라우팅 — `점진 변경`
- **채택**: 점진 변경 (Phase별 제어)
- **이유**: 전면 라우트 교체는 위험. Phase당 변경 라우트를 명시하고 스모크 테스트로 보호.
- **CI 반영**: 각 Phase에서 `Affected routes` 목록 내 라우트만 변경 허용. 라우트 스모크 테스트(`/login`, `/files`, `/admin/storage`)가 Gate A에 포함.
- **`IA_NAV_SSOT.md` 동기화**: 라우트 변경이 발생한 Task로부터 **최대 1~2 Task 이내**에 IA_NAV에 즉시 반영. Phase 말미까지 미루지 않음.

### 정책 4: 레거시 제거 — `게이트 완화 후 재강화`
- **채택**: 게이트 완화 후 재강화
- **이유**: `enforce-tokens.sh`의 hex 검사가 현재 일부 레거시에 걸림. Phase 1에서 allowlist를 도입하여 CI 통과, Phase 6에서 allowlist를 0으로 줄여 완전 제거.
- **CI 반영**:
  - Phase 1: `enforce-tokens.sh`에 `--allowlist` 옵션 추가. 기존 레거시 파일을 allowlist에 등록.
  - Phase 2~5: 각 Phase에서 해당 파일을 토큰화하며 allowlist에서 제거.
  - Phase 6: allowlist가 비어 있어야 CI PASS. 비어있지 않으면 FAIL.

---

## 2) CI 게이트 정의 (프론트 전용)

### Gate Set A — 필수 (모든 PR, ~30초)
| # | 검사 | 명령 | 실패 시 행동 |
|---|------|------|-------------|
| A1 | TypeScript 컴파일 | `pnpm -C packages/ui-kit tsc --noEmit && pnpm -C packages/ui tsc --noEmit` | 즉시 수정, 다음 Task 진행 금지 |
| A2 | ESLint | `pnpm -C packages/ui lint` | 즉시 수정 |
| A3 | 토큰 강제 | `bash scripts/enforce-tokens.sh` | allowlist 확인 후 수정 또는 allowlist 추가(Phase 1~5만) |
| A4 | i18n 키 동기화 | `node scripts/check-i18n-sync.js` (Phase 0에서 생성) | 누락 키 즉시 추가 |
| A5 | 라우트 스모크 | 핵심 3개 라우트 import 체크 (컴파일 시 자동 검증) | 라우트 복원 |

### Gate Set B — 확장, **fail-closed** (Phase 3~)
| # | 검사 | 명령 | 실패 시 행동 |
|---|------|------|-------------|
| B1 | Vitest 유닛 테스트 | `pnpm -C packages/ui test` | **즉시 수정 필수. `.skip` 금지.** 수정 불가 시 해당 테스트를 별도 Task(P{N}-Txx-FIX)로 분리하고 현재 Task를 `BLOCKED`로 마크. 다음 Task 진행 금지. |
| B2 | Storybook 빌드 | `pnpm -C packages/ui-kit build-storybook` | **즉시 수정 필수.** 스토리 파일 수정 후 재실행. 수정 불가 시 `BLOCKED`. |

### Gate Set C — 시각회귀 (Phase 5~)
| # | 검사 | 명령 | 실패 시 행동 |
|---|------|------|-------------|
| C1 | Playwright 픽셀 디프 | `pnpm -C packages/ui test:visual` | 3회 재시도 → 여전히 실패 시: (a) Task에 `[visual-update]` 태그가 있으면 스냅샷 갱신 허용, (b) 없으면 코드 수정 필수. flake로 판단되면 flake allowlist 추가(TTL: 해당 Phase 종료 시 만료, **Phase 6 종료 시 0건 강제**). |

### 게이트 실패 시 코딩봇 행동 규칙
1. **Gate A 실패**: 현재 Task 내에서 즉시 수정. 수정 불가 시 해당 Task 커밋을 `git revert`하고 이전 Task 상태로 복원.
2. **Gate B 실패 (fail-closed)**: **`.skip` 사용 금지.** 현재 Task 내에서 즉시 수정. 수정 불가 시 해당 실패를 별도 Task(`P{N}-Txx-FIX: {실패 테스트명}`)로 분리하여 Task 카드에 추가하고, 현재 Task를 `BLOCKED`로 마크. **BLOCKED 해소 전 다음 Task 진행 금지.**
3. **Gate C 실패**: (a) Task 카드에 `[visual-update]` 태그가 있는 경우에만 `--update-snapshots`로 갱신 허용. (b) 태그 없음 = 코드 수정 필수 (스냅샷 갱신 금지). (c) flake 판단 시 flake allowlist에 추가하되 TTL을 명시(해당 Phase 종료 시 만료). **Phase 6 종료 시 flake allowlist = 0건 강제.**
4. **연속 3회 Gate A 또는 B 실패**: 해당 Phase를 중단하고 `BLOCKED` 라벨로 PR 생성. 사람 리뷰 대기.

---

## 3) Phase 계획

### Phase 0: 정책 확정 & CI 기반 구조
- **Goal**: 코딩봇 실행 환경 준비. 정책 고정, CI 스크립트 정비, 도구 검증.
- **In-scope**: CI 스크립트(`check-i18n-sync.js`, `enforce-tokens.sh` 개선), 이 문서 커밋
- **Out-of-scope**: UI 코드 변경 없음
- **Affected routes**: 없음
- **Deliverables**: `scripts/check-i18n-sync.js`, 개선된 `enforce-tokens.sh`, 이 문서
- **DoD**: Gate A1~A4 전부 PASS (빈 프로젝트 상태에서)
- **Risks**: enforce-tokens allowlist 로직 버그 → 단위 테스트로 검증

### Phase 1: 토큰/테마/레이아웃 골격
- **Goal**: `ui-kit` 토큰 체계 완성 + AppShell 레이아웃을 CSS 변수 100%로 전환 + 다크 테마 기본값 적용.
- **In-scope**: `packages/ui-kit/src/tokens/*`, `packages/ui-kit/src/styles/global.css`, `AppShell.tsx`, `AppShell.css`, 테마 토글 훅
- **Out-of-scope**: 개별 페이지 컴포넌트 변경 없음
- **Affected routes**: `/` (AppShell — 모든 라우트의 부모)
- **Deliverables**: 완성된 토큰 6종(colors, spacing, typography, radius, elevation, shadows) + CSS 변수 매핑 + 다크/라이트 테마 전환 + AppShell 레이아웃(Topbar/LeftNav/Content/Inspector)
- **DoD**: Gate A PASS + AppShell이 `/files`에서 렌더링 확인(tsc 통과)
- **Risks**: 토큰 이름 불일치 → PR 단위로 확인

### Phase 2: 상태 UX 공통화
- **Goal**: Loading/Empty/Error/Forbidden 4종 상태 패턴을 `ui-kit` 컴포넌트로 표준화하고, 모든 페이지에 적용 규칙 확정.
- **In-scope**: `packages/ui-kit/src/components/states/*`, `packages/ui-kit/src/components/LoadingSkeleton.tsx`, 상태 패턴 HOC/wrapper
- **Out-of-scope**: 개별 페이지 적용은 Phase 3~5에서 수행
- **Affected routes**: 없음 (라이브러리 레벨)
- **Deliverables**: `EmptyState`, `ErrorState`, `ForbiddenState`, `SkeletonBlock` 컴포넌트 완성 + Storybook Stories + 적용 가이드 주석
- **DoD**: Gate A PASS + 각 컴포넌트 Storybook 렌더 확인
- **Risks**: Props 인터페이스 변경 시 Phase 3~5 영향 → Props를 이 Phase에서 확정(freeze)

### Phase 3: `/files` 완전 적용
- **Goal**: 핵심 라우트 `/files`와 `/files/:nodeId`를 새 UI 시스템으로 100% 전환.
- **In-scope**: `FilesPage.tsx`, `FilesPage.css`, `Breadcrumbs.tsx`, `FolderTree.tsx`, `GridView.tsx`, `InspectorPanel.tsx`, `SelectionActionBar.tsx`, `SearchPage.tsx`
- **Out-of-scope**: Admin 페이지, Auth 페이지, Media 전용 뷰
- **Affected routes**: `/files`, `/files/:nodeId`, `/search`
- **Deliverables**: 토큰화된 FilesPage + 상태 UX 4종 적용 + Inspector 패널 + 가상 스크롤 유지
- **DoD**: Gate A+B PASS + `/files` 라우트 import 정상 + FilesPage 유닛 테스트 통과
- **Risks**: VirtualList 성능 저하 → 가상화 로직 유지, 스타일만 교체

### Phase 4: `/media`, `/trash`, 보조 라우트 적용
- **Goal**: `/media`, `/trash`, `/recent`, `/favorites`, `/shared` 라우트를 새 UI로 전환.
- **In-scope**: `MediaPage.tsx`, `TrashPage.tsx`, `TrashPage.css`, `SimplePage.tsx`
- **Out-of-scope**: Admin 페이지
- **Affected routes**: `/media`, `/trash`, `/recent`, `/favorites`, `/shared`
- **Deliverables**: 토큰화된 5개 라우트 + 상태 UX 적용
- **DoD**: Gate A+B PASS + 각 라우트 tsc 통과
- **Risks**: SimplePage 범용성 부족 → 필요 시 라우트별 전용 페이지로 분리

### Phase 5: `/admin/*` 완전 적용
- **Goal**: 전체 Admin 라우트(9개)를 새 UI 시스템으로 전환. `AdminShell` 내부 네비게이션 정비.
- **In-scope**: `AdminShell.tsx`, `AdminHomePage.tsx`, `AdminStoragePage.tsx`, `AdminMigrationPage.tsx`, `AdminPerformancePage.tsx`, `AdminJobsPage.tsx`, `AdminUsersPage.tsx`, `AdminAuditPage.tsx`, `AdminSecurityPage.tsx`, `AdminAppearancePage.tsx`, `AdminRoutes.tsx`, 각 `.css` 파일
- **Out-of-scope**: 새로운 Admin 기능 추가
- **Affected routes**: `/admin`, `/admin/users`, `/admin/storage`, `/admin/migration`, `/admin/performance`, `/admin/jobs`, `/admin/audit`, `/admin/security`, `/admin/appearance`
- **Deliverables**: 토큰화된 Admin 10개 페이지 + SectionCard/FormField/DangerZone/TabBar/StatusBadge 활용 + Gate C 활성화
- **DoD**: Gate A+B+C PASS + 모든 Admin 라우트 tsc 통과
- **Risks**: AdminStoragePage 복잡도(458줄) → 하위 컴포넌트로 분리

### Phase 6: Auth/Onboarding + 모바일 반응형 + 레거시 제거 완료
- **Goal**: Auth 라우트(`/login`, `/setup`, `/invite/accept`) 적용, 모바일 반응형 적용, 레거시 allowlist 0건 달성.
- **In-scope**: `LoginPage.tsx`, `SetupPage.tsx`, `InviteAcceptPage.tsx`, 각 `.css`, 모바일 미디어 쿼리, `enforce-tokens.sh` allowlist 제거
- **Out-of-scope**: 새로운 기능 추가
- **Affected routes**: `/login`, `/setup`, `/invite/accept`
- **Deliverables**: 토큰화된 Auth 3개 페이지 + 모바일 반응형 + allowlist 빈 배열 + SSOT 문서 역병합 완료
- **DoD**: Gate A+B+C PASS + `enforce-tokens.sh` allowlist 0건 + `COPY_KEYS_SSOT.md`에 모든 신규 키 반영 + `IA_NAV_SSOT.md` 최신화
- **Risks**: 모바일 뷰포트 이슈 → 브레이크포인트 768px/1024px 고정

---

## 4) Task 카드

> 모든 Task는 아래 템플릿을 따릅니다. `1 Task = 1 commit`.

### Phase 0 Tasks

#### P0-T01: enforce-tokens.sh에 allowlist 옵션 추가
- **Intent**: 레거시 파일을 CI에서 임시 면제하는 allowlist 메커니즘 도입
- **Scope**: `scripts/enforce-tokens.sh`
- **Acceptance**: `bash scripts/enforce-tokens.sh` 실행 시 allowlist 파일이 존재하면 해당 파일 제외 후 exit 0
- **Non-goals**: 실제 레거시 코드 수정 없음
- **Failure & fallback**: allowlist 파싱 오류 시 allowlist 무시하고 전체 검사(기존 동작)
- **Commit**: `fix(ci): add allowlist support to enforce-tokens.sh`

#### P0-T02: i18n 키 동기화 검사 스크립트 생성
- **Intent**: `ko-KR.json`과 `en-US.json`의 키 집합이 동일한지 검증
- **Scope**: `scripts/check-i18n-sync.js` (신규)
- **Acceptance**: 키 불일치 시 exit 1 + 누락 키 목록 출력. 일치 시 exit 0.
- **Non-goals**: 번역 품질 검사 없음
- **Failure & fallback**: 스크립트 자체 오류 시 exit 1 (fail-closed)
- **Commit**: `feat(ci): add i18n key sync checker`

#### P0-T03: CI 워크플로에 Gate A 통합
- **Intent**: `ci.yml`의 UI scope에 Gate A1~A4 단계 추가
- **Scope**: `.github/workflows/ci.yml`
- **Acceptance**: PR에서 UI 파일 변경 시 Gate A 4개 단계 실행 확인
- **Non-goals**: Gate B/C는 이 Task에서 추가하지 않음
- **Failure & fallback**: 기존 CI 흐름을 깨뜨리면 revert
- **Commit**: `ci: integrate Gate A checks for UI scope`

#### P0-T04: enforce-tokens allowlist 초기 목록 생성
- **Intent**: 현재 레거시 hex 사용 파일을 스캔하여 allowlist 파일 생성
- **Scope**: `scripts/enforce-tokens-allowlist.txt` (신규)
- **Acceptance**: `bash scripts/enforce-tokens.sh` 실행 시 exit 0
- **Non-goals**: 레거시 코드 수정 없음
- **Failure & fallback**: grep 결과가 0이면 빈 파일 생성
- **Commit**: `chore: generate initial enforce-tokens allowlist`

#### P0-T05: 이 문서 커밋 + IA_NAV SUSPENDED 태그 정리
- **Intent**: 이 플레이북을 SSOT로 커밋하고 IA_NAV의 SUSPENDED 주석 정리
- **Scope**: `docs/ui/UI_REBUILD_EXECUTION_PLAYBOOK.md`, `docs/ui/IA_NAV_SSOT.md`
- **Acceptance**: 두 파일이 커밋에 포함, tsc에 영향 없음
- **Non-goals**: IA_NAV 내용 자체 변경 없음 (주석 정리만)
- **Failure & fallback**: 문서 전용이므로 실패 가능성 없음
- **Commit**: `docs: add UI Rebuild Execution Playbook as frontend SSOT`

### Phase 1 Tasks

#### P1-T01: 토큰 체계 완성 (colors/spacing/typography/radius/elevation/shadows)
- **Intent**: 6종 토큰 파일을 최종 값으로 확정 + `tokens/index.ts` export 통합
- **Scope**: `packages/ui-kit/src/tokens/*.ts` (6파일 + index.ts)
- **Acceptance**: `tsc --noEmit -p packages/ui-kit/tsconfig.json` exit 0 + 모든 토큰 export 확인
- **Non-goals**: CSS 변수 매핑은 T02에서 수행
- **Failure & fallback**: 타입 오류 시 해당 토큰 값 수정
- **Commit**: `feat(ui-kit): finalize token definitions (6 categories)`

#### P1-T02: CSS 변수 매핑 (global.css)
- **Intent**: 토큰 값을 `:root` / `.dark` CSS 변수로 매핑
- **Scope**: `packages/ui-kit/src/styles/global.css`
- **Acceptance**: `--nd-color-*`, `--nd-space-*`, `--nd-radius-*`, `--nd-elevation-*` 변수가 정의됨. tsc PASS.
- **Non-goals**: 컴포넌트 스타일 변경 없음
- **Failure & fallback**: CSS 구문 오류 시 수정
- **Commit**: `feat(ui-kit): map all tokens to CSS custom properties`

#### P1-T03: 다크 테마 기본값 + 테마 토글 훅
- **Intent**: `html.dark` 클래스로 다크 테마 적용 + `useTheme()` 훅 생성
- **Scope**: `packages/ui/src/app/useTheme.ts` (신규), `global.css` 다크 섹션
- **Acceptance**: tsc PASS + `useTheme` 훅이 localStorage에서 테마를 읽고 적용
- **Non-goals**: 서버 사이드 테마 동기화
- **Failure & fallback**: localStorage 접근 실패 시 다크 기본값 유지
- **Commit**: `feat(ui): add useTheme hook with dark-first default`

#### P1-T04: AppShell 레이아웃 CSS 변수 전환
- **Intent**: AppShell의 모든 하드코딩 스타일을 CSS 변수로 교체
- **Scope**: `packages/ui/src/app/AppShell.tsx`, `AppShell.css`
- **Acceptance**: Gate A PASS (tsc + enforce-tokens) + AppShell이 Topbar/LeftNav/Content/Inspector 4영역 렌더링
- **Non-goals**: Inspector 내부 로직 변경 없음
- **Failure & fallback**: 레이아웃 깨짐 시 이전 값으로 복원 후 CSS 변수 값 조정
- **Commit**: `refactor(ui): convert AppShell to CSS custom properties`

#### P1-T05: Topbar 1차 내비게이션 구현
- **Intent**: IA_NAV_SSOT의 Topbar 구성(Brand/Search/Tabs/Actions/User/Admin)을 구현
- **Scope**: `AppShell.tsx` Topbar 영역
- **Acceptance**: tsc PASS + 6개 탭(Files/Recent/Favorites/Shared/Media/Trash) 렌더링
- **Non-goals**: 검색 기능 자체 구현 아님 (UI 셸만)
- **Failure & fallback**: 라우트 링크 오류 시 `to` prop 수정
- **Commit**: `feat(ui): implement Topbar primary navigation per IA_NAV`

#### P1-T06: LeftNav를 Folder Tree 전용으로 전환
- **Intent**: IA_NAV_SSOT 정책에 따라 LeftNav에서 Quick Links 제거, Folder Tree만 남김
- **Scope**: `AppShell.tsx` LeftNav 영역, `FolderTree.tsx`
- **Acceptance**: tsc PASS + LeftNav에 Quick Links 없음 확인 (grep)
- **Non-goals**: FolderTree 데이터 페칭 로직 변경 없음
- **Failure & fallback**: Quick Links 의존 코드가 있으면 Topbar 탭으로 리다이렉트
- **Commit**: `refactor(ui): convert LeftNav to folder-tree-only per IA_NAV`

### Phase 2 Tasks

#### P2-T01: EmptyState/ErrorState/ForbiddenState Props 확정
- **Intent**: 3종 상태 컴포넌트의 Props 인터페이스를 freeze (icon, title, description, action)
- **Scope**: `packages/ui-kit/src/components/states/*.tsx`
- **Acceptance**: tsc PASS + Props에 `icon?`, `title`, `description?`, `action?` 포함
- **Non-goals**: 비주얼 변경 없음
- **Failure & fallback**: 기존 Props와 하위 호환 유지
- **Commit**: `feat(ui-kit): freeze state component props interface`

#### P2-T02: SkeletonBlock 패턴 확장
- **Intent**: SkeletonBlock에 variant(line/card/table-row/avatar) 추가
- **Scope**: `packages/ui-kit/src/components/states/SkeletonBlock.tsx`
- **Acceptance**: tsc PASS + 4개 variant 렌더링 가능
- **Non-goals**: 애니메이션 최적화는 Phase 6
- **Failure & fallback**: variant 미지원 시 기본 block으로 fallback
- **Commit**: `feat(ui-kit): add SkeletonBlock variants`

#### P2-T03: 상태 패턴 적용 가이드 + Storybook 스토리
- **Intent**: 4종 상태 컴포넌트의 사용법 문서화 + Stories 파일 정비
- **Scope**: `packages/ui-kit/src/components/states/*.stories.tsx`, `EmptyState.stories.tsx`, `LoadingSkeleton.stories.tsx` 정비
- **Acceptance**: `pnpm -C packages/ui-kit build-storybook` exit 0
- **Non-goals**: 다른 컴포넌트 Stories 수정 없음
- **Failure & fallback**: Stories 빌드 실패 시 해당 Story 주석 처리
- **Commit**: `docs(ui-kit): add state pattern stories and usage guide`

### Phase 3 Tasks

#### P3-T01: FilesPage 토큰화 — 레이아웃/색상
- **Intent**: `FilesPage.tsx`와 `FilesPage.css`의 하드코딩 스타일을 CSS 변수로 전환
- **Scope**: `FilesPage.tsx`, `FilesPage.css`
- **Acceptance**: Gate A PASS + enforce-tokens에서 FilesPage 관련 경고 0건
- **Non-goals**: 기능 로직 변경 없음
- **Failure & fallback**: 레이아웃 깨짐 시 CSS 변수 값 조정
- **Commit**: `refactor(ui): tokenize FilesPage layout and colors`

#### P3-T02: FilesPage 상태 UX 적용
- **Intent**: FilesPage의 loading/empty/error 처리를 ui-kit 상태 컴포넌트로 교체
- **Scope**: `FilesPage.tsx`
- **Acceptance**: tsc PASS + `SkeletonBlock`/`EmptyState`/`ErrorState` import 확인 (grep)
- **Non-goals**: API 호출 로직 변경 없음
- **Failure & fallback**: 상태 컴포넌트 렌더 오류 시 텍스트 fallback 유지
- **Commit**: `feat(ui): apply state UX components to FilesPage`

#### P3-T03: Breadcrumbs + FolderTree 토큰화
- **Intent**: Breadcrumbs와 FolderTree의 스타일을 CSS 변수로 전환
- **Scope**: `Breadcrumbs.tsx`, `Breadcrumbs.css`, `FolderTree.tsx`
- **Acceptance**: Gate A PASS
- **Non-goals**: 트리 데이터 로직 변경 없음
- **Commit**: `refactor(ui): tokenize Breadcrumbs and FolderTree`

#### P3-T04: InspectorPanel 토큰화 + 상태 UX
- **Intent**: Inspector 패널의 스타일 토큰화 + 선택 없음/로딩 상태 적용
- **Scope**: `InspectorPanel.tsx`, `InspectorPanel.css`
- **Acceptance**: Gate A PASS + EmptyState("항목을 선택하면...") 렌더링
- **Non-goals**: Inspector 탭 구조 변경 없음
- **Commit**: `refactor(ui): tokenize InspectorPanel with state UX`

#### P3-T05: GridView + SelectionActionBar 토큰화
- **Intent**: 그리드 뷰와 선택 액션바의 스타일을 CSS 변수로 전환
- **Scope**: `GridView.tsx`, `SelectionActionBar.tsx`
- **Acceptance**: Gate A PASS
- **Non-goals**: 선택 로직 변경 없음
- **Commit**: `refactor(ui): tokenize GridView and SelectionActionBar`

#### P3-T06: SearchPage 토큰화 + 상태 UX
- **Intent**: SearchPage의 스타일 토큰화 + empty/loading 상태 적용
- **Scope**: `SearchPage.tsx`
- **Acceptance**: Gate A PASS + EmptyState("검색 결과가 없습니다") 렌더링
- **Non-goals**: 검색 API 로직 변경 없음
- **Commit**: `refactor(ui): tokenize SearchPage with state UX`

#### P3-T07: ShareDialog 토큰화
- **Intent**: ShareDialog의 스타일을 CSS 변수로 전환
- **Scope**: `ShareDialog.tsx`, `ShareDialog.css`
- **Acceptance**: Gate A PASS
- **Non-goals**: 공유 링크 생성 로직 변경 없음
- **Commit**: `refactor(ui): tokenize ShareDialog`

#### P3-T08: Phase 3 Gate B 활성화 + 테스트 실행
- **Intent**: CI에 Gate B(Vitest + Storybook 빌드) 추가, 기존 테스트 통과 확인
- **Scope**: `.github/workflows/ci.yml`
- **Acceptance**: Gate A+B PASS (B는 fail-closed — 모든 테스트 통과 필수)
- **Non-goals**: 새로운 테스트 작성 없음
- **Failure & fallback**: 실패 테스트는 별도 Task(`P3-T08-FIX`)로 분리 후 수정. `.skip` 금지.
- **Commit**: `ci: activate Gate B (vitest + storybook build)`

#### P3-T09: Phase 3 SSOT 역병합 (i18n + IA_NAV)
- **Intent**: Phase 3에서 추가/변경된 i18n 키와 라우트를 COPY_KEYS_SSOT, IA_NAV_SSOT에 즉시 반영
- **Scope**: `docs/ui/COPY_KEYS_SSOT.md`, `docs/ui/IA_NAV_SSOT.md`, `ko-KR.json`, `en-US.json`
- **Acceptance**: `node scripts/check-i18n-sync.js` PASS + IA_NAV와 AppRouter 라우트 일치
- **Non-goals**: 다른 Phase의 키 반영 없음
- **Failure & fallback**: 키 누락 시 즉시 추가
- **Commit**: `docs: backport Phase 3 i18n keys and route changes to SSOT`

### Phase 4 Tasks

#### P4-T01: MediaPage 토큰화 + 상태 UX
- **Intent**: MediaPage의 스타일 토큰화 + 갤러리 그리드에 상태 UX 적용
- **Scope**: `MediaPage.tsx`
- **Acceptance**: Gate A+B PASS
- **Commit**: `refactor(ui): tokenize MediaPage with state UX`

#### P4-T02: TrashPage 토큰화 + 상태 UX
- **Intent**: TrashPage의 스타일/액션 바 토큰화
- **Scope**: `TrashPage.tsx`, `TrashPage.css`
- **Acceptance**: Gate A+B PASS
- **Commit**: `refactor(ui): tokenize TrashPage with state UX`

#### P4-T03: SimplePage 범용 상태 UX 적용
- **Intent**: `/recent`, `/favorites`, `/shared`의 SimplePage에 EmptyState 적용
- **Scope**: `SimplePage.tsx`, `SimplePage.css`
- **Acceptance**: Gate A+B PASS
- **Commit**: `refactor(ui): apply EmptyState to SimplePage routes`

#### P4-T04: UploadQueue UI 토큰화
- **Intent**: 업로드 큐 UI의 스타일 토큰화
- **Scope**: `uploadQueue.tsx`, `UploadQueue.css`
- **Acceptance**: Gate A+B PASS
- **Commit**: `refactor(ui): tokenize UploadQueue UI`

#### P4-T05: Phase 4 SSOT 역병합 (i18n + IA_NAV)
- **Intent**: Phase 4에서 추가/변경된 i18n 키와 라우트를 COPY_KEYS_SSOT, IA_NAV_SSOT에 즉시 반영
- **Scope**: `docs/ui/COPY_KEYS_SSOT.md`, `docs/ui/IA_NAV_SSOT.md`, `ko-KR.json`, `en-US.json`
- **Acceptance**: `node scripts/check-i18n-sync.js` PASS + COPY_KEYS+IA_NAV에 Phase 4 변경 모두 반영
- **Commit**: `docs: backport Phase 4 i18n keys and route changes to SSOT`

### Phase 5 Tasks

#### P5-T01: AdminShell 레이아웃 + 내부 네비 정비
- **Intent**: AdminShell의 사이드바 네비게이션을 IA_NAV 기준으로 재구성
- **Scope**: `AdminShell.tsx`, `AdminShell.css`, `AdminRoutes.tsx`
- **Acceptance**: Gate A+B PASS + 9개 Admin 라우트 네비 링크 렌더링
- **Commit**: `refactor(ui): restructure AdminShell navigation per IA_NAV`

#### P5-T02: AdminHomePage 토큰화 (SectionCard 6개)
- **Intent**: Admin 홈의 6개 섹션 카드를 SectionCard 컴포넌트로 교체
- **Scope**: `AdminHomePage.tsx`, `AdminHomePage.css`
- **Acceptance**: Gate A+B PASS + SectionCard 6개 렌더링
- **Commit**: `refactor(ui): tokenize AdminHomePage with SectionCard`

#### P5-T03: AdminStoragePage 토큰화 + 하위 분리
- **Intent**: 458줄의 AdminStoragePage를 토큰화하고 복잡한 섹션을 하위 컴포넌트로 분리
- **Scope**: `AdminStoragePage.tsx`, `AdminStoragePage.css`
- **Acceptance**: Gate A+B PASS + 파일 400줄 이하
- **Commit**: `refactor(ui): tokenize and decompose AdminStoragePage`

#### P5-T04: AdminMigrationPage + AdminPerformancePage 토큰화
- **Intent**: 마이그레이션/성능 페이지 스타일 토큰화
- **Scope**: `AdminMigrationPage.tsx`, `AdminMigrationPage.css`, `AdminPerformancePage.tsx`, `AdminPerformancePage.css`
- **Acceptance**: Gate A+B PASS
- **Commit**: `refactor(ui): tokenize Migration and Performance pages`

#### P5-T05: AdminJobsPage + AdminUsersPage 토큰화
- **Intent**: 작업/사용자 페이지 스타일 토큰화 + TabBar 컴포넌트 활용
- **Scope**: `AdminJobsPage.tsx`, `AdminJobsPage.css`, `AdminUsersPage.tsx`, `AdminUsersPage.css`
- **Acceptance**: Gate A+B PASS
- **Commit**: `refactor(ui): tokenize Jobs and Users pages with TabBar`

#### P5-T06: AdminAuditPage + AdminSecurityPage 토큰화
- **Intent**: 감사/보안 페이지 스타일 토큰화
- **Scope**: `AdminAuditPage.tsx`, `AdminAuditPage.css`, `AdminSecurityPage.tsx`, `AdminSecurityPage.css`
- **Acceptance**: Gate A+B PASS
- **Commit**: `refactor(ui): tokenize Audit and Security pages`

#### P5-T07: AdminAppearancePage 토큰화 + 테마 연동
- **Intent**: 외관 설정 페이지 토큰화 + useTheme 훅 연동
- **Scope**: `AdminAppearancePage.tsx`, `AdminAppearancePage.css`
- **Acceptance**: Gate A+B PASS
- **Commit**: `refactor(ui): tokenize Appearance page with theme hook`

#### P5-T08: Gate C 활성화 (Playwright 픽셀 디프) `[visual-update]`
- **Intent**: CI에 Gate C 추가, `/files`와 `/admin/storage` 2개 라우트 스냅샷 기준 생성
- **Scope**: `.github/workflows/ci.yml`, 스냅샷 기준 파일
- **Acceptance**: Gate A+B+C PASS
- **Failure & fallback**: flake 시 3회 재시도 → flake allowlist 추가(TTL: Phase 5 종료 시 만료)
- **Commit**: `ci: activate Gate C (visual regression) for /files and /admin`

#### P5-T09: Phase 5 SSOT 역병합 (i18n + IA_NAV)
- **Intent**: Phase 5에서 추가/변경된 Admin 관련 i18n 키와 라우트를 SSOT에 즉시 반영
- **Scope**: `docs/ui/COPY_KEYS_SSOT.md`, `docs/ui/IA_NAV_SSOT.md`
- **Acceptance**: `node scripts/check-i18n-sync.js` PASS + IA_NAV Admin 섹션이 AdminRoutes와 일치
- **Non-goals**: Phase 6 키 선반영 없음
- **Commit**: `docs: backport Phase 5 i18n keys and route changes to SSOT`

### Phase 6 Tasks

#### P6-T01: LoginPage 토큰화 + 상태 UX
- **Intent**: 로그인 페이지의 스타일을 CSS 변수로 전환
- **Scope**: `LoginPage.tsx`, `LoginPage.css`
- **Acceptance**: Gate A+B+C PASS
- **Commit**: `refactor(ui): tokenize LoginPage`

#### P6-T02: SetupPage + InviteAcceptPage 토큰화
- **Intent**: 초기설정/초대수락 페이지 토큰화
- **Scope**: `SetupPage.tsx`, `SetupPage.css`, `InviteAcceptPage.tsx`, `InviteAcceptPage.css`
- **Acceptance**: Gate A+B+C PASS
- **Commit**: `refactor(ui): tokenize Setup and InviteAccept pages`

#### P6-T03: 모바일 반응형 미디어 쿼리 적용
- **Intent**: 모든 페이지에 `@media (max-width: 768px)` / `(max-width: 1024px)` 반응형 적용
- **Scope**: `AppShell.css`, `FilesPage.css`, `global.css`
- **Acceptance**: Gate A+B+C PASS + 768px 뷰포트에서 LeftNav 숨김 확인
- **Commit**: `feat(ui): add responsive breakpoints for mobile`

#### P6-T04: enforce-tokens allowlist 0건 달성
- **Intent**: 남은 allowlist 파일들의 하드코딩을 모두 제거하고 allowlist를 비움
- **Scope**: allowlist에 남은 모든 파일 + `scripts/enforce-tokens-allowlist.txt`
- **Acceptance**: `bash scripts/enforce-tokens.sh` PASS + allowlist 파일 0줄
- **Commit**: `refactor(ui): remove all legacy hardcoded values`

#### P6-T05: COPY_KEYS_SSOT + IA_NAV_SSOT 최종 검증
- **Intent**: Phase 3/4/5에서 이미 역병합된 SSOT와 실제 코드의 최종 일치 확인. Phase 6 신규 키 반영.
- **Scope**: `docs/ui/COPY_KEYS_SSOT.md`, `docs/ui/IA_NAV_SSOT.md`
- **Acceptance**: `node scripts/check-i18n-sync.js` PASS + IA_NAV의 라우트 목록이 AppRouter와 100% 일치 + COPY_KEYS에 누락 키 0건
- **Commit**: `docs: final SSOT verification and Phase 6 key sync`

#### P6-T06: 마이그레이션 종료 검증 + 이 문서에 완료 마크
- **Intent**: 모든 라우트가 토큰화되었는지 최종 확인 + 이 문서에 `[COMPLETED]` 마크
- **Scope**: 이 문서, 전체 라우트 14개 검증
- **Acceptance**: Gate A+B+C PASS + grep으로 `packages/ui/src/app/*.tsx`에 하드코딩 0건
- **Commit**: `docs: mark UI Rebuild Execution Playbook as COMPLETED`

---

## 5) PR 운영 규칙 (코딩봇용)

### 브랜치/PR 네이밍
- 브랜치: `feature/ui-rebuild-P{N}` (예: `feature/ui-rebuild-P0`)
- PR 제목: `[UI-Rebuild] Phase {N}: {Phase Goal 요약}`
- 예: `[UI-Rebuild] Phase 1: Token system + AppShell layout`

### PR 설명 템플릿
```markdown
## Phase {N}: {Goal}

### Tasks
- [ ] P{N}-T01: {Intent}
- [ ] P{N}-T02: {Intent}
...

### Gate 결과
- [ ] Gate A: tsc + lint + enforce-tokens + i18n sync
- [ ] Gate B: vitest + storybook (Phase 3~)
- [ ] Gate C: pixel diff (Phase 5~)

### Affected routes
{라우트 목록}
```

### 리뷰 기준
- **필수**: CI PASS(해당 Phase의 Gate Set) + DoD 충족 + 변경 범위가 Phase Scope 내
- **금지**: 주관적 디자인 의견, Phase 범위 밖 변경 요구

### 머지 기준
| Phase | 필수 Gate | 선택 Gate |
|-------|-----------|-----------|
| 0~2 | A | — |
| 3~4 | A + B | — |
| 5~6 | A + B + C | — |

---

## 6) 마이그레이션 종료 기준

### 전 라우트 적용 완료 정의

아래 14개 라우트에서 **모두** 다음 조건을 만족해야 합니다:
1. 하드코딩 hex 색상 0건 (`enforce-tokens.sh` PASS)
2. 상태 UX(loading/empty/error) 중 해당하는 것이 ui-kit 컴포넌트 사용
3. CSS가 `var(--nd-*)` 변수 사용

| # | 라우트 | 담당 Phase |
|---|--------|-----------|
| 1 | `/files` | Phase 3 |
| 2 | `/files/:nodeId` | Phase 3 |
| 3 | `/search` | Phase 3 |
| 4 | `/media` | Phase 4 |
| 5 | `/trash` | Phase 4 |
| 6 | `/recent` | Phase 4 |
| 7 | `/favorites` | Phase 4 |
| 8 | `/shared` | Phase 4 |
| 9 | `/admin` ~ `/admin/appearance` (9개) | Phase 5 |
| 10 | `/login` | Phase 6 |
| 11 | `/setup` | Phase 6 |
| 12 | `/invite/accept` | Phase 6 |

### 레거시 제거 완료 기준
- `scripts/enforce-tokens-allowlist.txt` = 0줄
- `grep -rn '#[0-9a-fA-F]{3,6}' packages/ui/src/` = 0건
- 예외: `*.spec.ts` 테스트 파일 내 fixture 데이터는 허용

### 운영 안정화 기준 (항상 켜져야 하는 Gate)
| Gate | 상태 |
|------|------|
| A1 (tsc) | **항상 필수** |
| A2 (lint) | **항상 필수** |
| A3 (enforce-tokens) | **항상 필수** (allowlist 비활성) |
| A4 (i18n sync) | **항상 필수** |
| B1 (vitest) | **항상 필수** |
| B2 (storybook build) | **항상 필수** |
| C1 (pixel diff) | **항상 필수** (flake allowlist TTL 만료로 Phase 6 이후 0건 강제) |

---

> **문서 끝.** 이 문서는 프론트엔드 UI 재구축의 유일한 실행 SSOT입니다.
> 코딩봇은 P0-T01부터 순서대로 실행합니다.

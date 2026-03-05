# P20-T3 Evidence: 공통 UI 패턴 컴포넌트화(페이지에서 조립만)

## Goal
- 페이지별 임시 UI 조립을 줄이고, 공통 페이지 패턴 컴포넌트를 도입한다.

## Scope
- `packages/ui/src/app/components/*`:
  - `PageHeader`
  - `Toolbar`
  - `EmptyState`
  - `ErrorState`
  - `ForbiddenState`
  - `LoadingSkeleton`
  - `PatternDataTable`
- `/files`, `/search` 페이지는 새 공통 컴포넌트 조합으로 렌더링

## PASS 기준
- 공통 컴포넌트 파일 6개 존재
- `/files`, `/search`가 신규 공통 컴포넌트를 직접 임포트해서 사용
- 기본 렌더/빈 상태/로딩 상태/에러 상태에 대한 최소 정합성 체크 통과
- Storybook stories for 페이지 패턴 컴포넌트 존재

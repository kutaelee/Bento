# P21-T4 Evidence

Goal: `/recent` 페이지가 `/files`/`/search`와 동일한 FolderView 기반 코어 패턴을 사용해 레이아웃/헤더/테이블/로딩/에러 상태를 통일한다.

Acceptance:
- `/recent` 라우트가 `FilesPage` 기반 패턴으로 렌더링됨
- `AppRouter`에 `/recent` 경로가 단순 문구 페이지가 아닌 패턴 컴포넌트로 구성됨
- 헤더/테이블/무한스크롤 로직이 공통 패턴을 재사용함
- `FolderView` 패턴 결합성 기본 점검을 통과

Run command:
- `bash evidence/P21/P21-T4/run.sh`

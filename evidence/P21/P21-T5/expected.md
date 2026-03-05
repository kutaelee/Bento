# P21-T5 Evidence

Goal: `/favorites` 페이지가 `/files`/`/search`/`/recent`와 동일한 FolderView 기반 패턴으로 통일된다.

Acceptance:
- `/favorites` 라우트가 `FilesPage` 기반 패턴을 사용해 렌더링됨
- `/favorites` 헤더/툴바/목록/빈상태/로딩 처리 패턴이 핵심 페이지와 동일한 컴포넌트로 구성됨
- 기본 i18n 키(`nav.favorites`, `msg.emptyFavorites`) 사용
- 최소 ui test + 라우팅/컴포넌트 정합성 체크 PASS

Run command:
- `bash evidence/P21/P21-T5/run.sh`

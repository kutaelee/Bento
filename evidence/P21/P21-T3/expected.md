# P21-T3 Evidence

Goal: `/search?q=...` 검색 결과 페이지가 파일 리스트 화면 규격을 통일한다.

Acceptance:
- `/search` 라우트가 `SearchPage` 컴포넌트를 통해 렌더링됨
- `SearchPage`는 `FolderView` 기반 목록 패턴을 사용
- 검색 페이지가 `FolderView`의 공통 헤더/테이블/무한스크롤 패턴을 유지
- 기본 검색 플로우에서 에러/빈 상태/로딩 상태 처리가 일관됨
- 최소 회귀 확인 스크립트 통과

Run command:
- `bash evidence/P21/P21-T3/run.sh`

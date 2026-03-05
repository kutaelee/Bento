# P21-T6 Evidence

Goal: `/shared` 페이지가 핵심 파일 페이지 패턴을 사용해 페이지 통일을 달성한다.

Acceptance:
- `/shared` 라우트가 `FilesPage` 기반 패턴으로 렌더링됨
- 헤더/툴바/목록/빈상태/에러 처리 패턴이 핵심 페이지와 동일한 컴포넌트로 구성됨
- 기본 i18n 키(`nav.shared`, `msg.emptyShared`) 사용
- 최소 ui test + 라우팅/컴포넌트 정합성 체크 PASS

Run command:
- `bash evidence/P21/P21-T6/run.sh`

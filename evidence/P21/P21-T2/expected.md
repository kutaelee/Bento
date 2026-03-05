# P21-T2 Evidence

Goal: /files/:nodeId(폴더) 화면에서 /files와 동일한 탐색 패턴을 유지하고, breadcrumb/상태 패턴을 통일한다.

Acceptance:
- /files와 /files/:nodeId 모두 같은 `FilesPage` 컴포넌트 사용
- /files/:nodeId에서 nodeId 기반 제목/경로 표기가 i18n 기반 패턴으로 표시
- `Breadcrumbs` 경로 조회/상태 처리(loading/empty/error)가 경로별 일관 패턴을 유지
- ui-kit 패턴 컴포넌트(`PageHeader`, `Toolbar`, `PatternDataTable`) 사용
- 최소 회귀 테스트 통과

Run command:
- `bash evidence/P21/P21-T2/run.sh`

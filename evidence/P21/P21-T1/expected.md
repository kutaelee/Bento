# P21-T1 Evidence

Goal: /files (기본 파일 탐색기) 페이지를 ui-kit 조합으로 정합화.

Acceptance:
- /files 및 /files/:nodeId 라우트가 app router에서 FilesPage로 렌더링
- FilesPage가 공용 패턴 컴포넌트(`PageHeader`, `Toolbar`, `PatternDataTable`)를 사용
- 상태(loading/empty/error) 문자열이 i18n 키로 렌더링
- ui-kit 범위 내 테스트 및 visual 회귀 확인

Run command:
- `bash evidence/P21/P21-T1/run.sh`

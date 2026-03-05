# Expected (P18-T3)

- `ui -> ui-kit` 단방향 의존성을 lint 규칙으로 강제한다.
- `ui-kit`에서 `ui`를 참조하는 fixture 코드는 lint에서 실패해야 한다.
- fixture 제거 후 실제 `ui-kit` 코드베이스 lint는 PASS 해야 한다.

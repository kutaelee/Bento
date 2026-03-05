# P25-T1 Expected

- `test:visual:config`는 visual-regression.config.json ↔ route_reference_map.md ↔ reference screen 경로 정합성을 검증한다.
- `test:visual`은 실제 렌더링(Playwright) 기반으로 스냅샷을 생성한다.
- 기본 모드(VISUAL_DIFF_MODE=structure)에서는 레이아웃의 핵심 구성요소(Topbar/LeftNav/Inspector 존재)를 검증한다.
- 픽셀 diff(VISUAL_DIFF_MODE=pixel)는 reference-ready allowlist 라우트에 한해 단계적으로 활성화한다.
- 빈 화면 비교 금지: fixture/seed/mock 기반으로 동일 상태를 재현해야 한다.

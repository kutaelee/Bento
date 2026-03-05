# P26-T0 Expected

- visual regression 설정(visual-regression.config.json)과 route_reference_map.md의 매핑이 일치해야 한다.
- reference(screen.png)가 있는 라우트는 반드시 config에 포함되어야 하며, 누락/오매핑 시 FAIL.
- 검증은 `pnpm -C packages/ui run test:visual:config`로 수행한다.

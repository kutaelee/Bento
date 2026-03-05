# P25-T2 Expected

- IA_NAV_SSOT 전체 라우트(/media 포함)가 visual-regression.config.json에 포함된다.
- 각 route는 최소 1개 state 스냅샷을 갖는다.
- visual test는 seed/fixture 기반 렌더링을 사용한다.
- `pnpm -C packages/ui test:visual` PASS.

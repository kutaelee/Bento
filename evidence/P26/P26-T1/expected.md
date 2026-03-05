# P26-T1 — Visual Harness(Playwright) 안정화

Goal:
- Playwright 기반 route snapshot harness가 환경(폰트/애니메이션/타임존/로케일) 차이로 흔들리지 않게 안정화한다.

Pass criteria:
- `pnpm -C packages/ui test:visual`가 CI/로컬에서 재현 가능하게 PASS한다.

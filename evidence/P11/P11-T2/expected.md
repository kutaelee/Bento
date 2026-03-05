# P11-T2 QoS Controller (자동 조절)

## 목표
- GET `/system/performance`가 PerformanceState를 반환한다.
- CPU 부하 증가 시 `allowed.bg_worker_concurrency`가 감소한다.
- idle 상태에서는 `allowed.bg_worker_concurrency`가 캡 이하로 증가한다.

## 근거 (SSOT)
- `openapi/openapi.yaml`:
  - `paths./system/performance.get`
  - `components.schemas.PerformanceState`
  - `x-constants.qos`

## 검증 커맨드 요약
- 서버 기동 후 `/system/performance` 호출
- 인위적 부하 생성(stress) 후 `/system/performance` 호출
- 부하 종료 후 `/system/performance` 재호출

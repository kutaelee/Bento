# P12-T1 Storage Migration Job

## 목표
- POST `/admin/migrations`가 마이그레이션 Job을 생성하고 202를 반환한다.
- 생성된 Job은 `/jobs/{job_id}`에서 상태/진행률을 조회할 수 있다.
- Job 상태가 최종적으로 `SUCCEEDED`로 전이된다.

## 근거 (SSOT)
- `openapi/openapi.yaml`
  - `paths./admin/migrations.post`
  - `paths./jobs.get`
  - `paths./jobs/{job_id}.get`
  - `components.schemas.StartMigrationRequest`
  - `components.schemas.Job`

## 검증 커맨드 요약
- admin 토큰 확보 후 `/admin/volumes`로 대상 볼륨 생성
- `/admin/migrations` 요청 → 202 + job 반환 확인
- `/jobs/{job_id}` 폴링으로 상태 전이(SUCCEEDED) 확인

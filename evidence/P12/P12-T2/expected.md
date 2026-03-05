# P12-T2 Storage Scan/Cleanup Job

## 목표
- POST `/admin/storage/scan`이 스토리지 스캔 Job을 생성하고 202를 반환한다.
- 삭제 옵션 없이 스캔 시 orphan 파일/DB row가 결과에 보고된다.
- `delete_orphan_files=true` 시 orphan 파일이 실제로 삭제된다.

## 근거 (SSOT)
- `openapi/openapi.yaml`
  - `paths./admin/storage/scan.post`
  - `components.schemas.ScanCleanupRequest`
  - `components.schemas.Job`

## 검증 커맨드 요약
- admin 토큰 확보 후 활성 볼륨을 구성
- orphan 파일/DB row를 만든 뒤 `/admin/storage/scan` 요청 → 202 + job 반환 확인
- `/jobs/{job_id}` 결과에서 orphan 보고 확인
- delete_orphan_files=true 요청 후 orphan 파일 삭제 확인

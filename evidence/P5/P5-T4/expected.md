# P5-T4 — Startup Reconciler (UploadSession)

## Goal
- 부팅 시 업로드 세션 정리 규칙을 수행한다.
- SSOT: `x-state-machines.UploadSession.startup_reconciler`

## SSOT
- Stuck: status in (UPLOADING, MERGING) and updated_at < now()-30m => FAILED + cleanup temp chunks
- Expired: status INIT and created_at < now()-session_ttl => ABORTED + cleanup temp chunks
- `x-constants.uploads.session_ttl_seconds = 172800`

## Required Evidence
- MERGING 세션(업데이트 30분 초과 경과)을 부팅 후 FAILED로 변경
- INIT 세션(생성 2일 초과 경과)을 부팅 후 ABORTED로 변경
- 두 케이스 모두 temp_dir 삭제 + upload_chunks 삭제 확인

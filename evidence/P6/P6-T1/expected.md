# P6-T1 — GET /nodes/{id}/download (Range)

## Goal
- 파일 노드를 node_id로 다운로드한다.
- Range 요청을 지원한다.

## SSOT
- openapi/openapi.yaml
  - paths./nodes/{node_id}/download.get

## Acceptance
- Range: bytes=0-9 → HTTP 206, body length = 10
- Range: bytes=999999999- → HTTP 416
- Range 없음 → HTTP 200, 전체 파일 다운로드

# P11-T1 Evidence Expectations

- API: `GET /media/{node_id}/thumbnail`
- 목적: 썸네일 요청 시 202(Job) → 재요청 시 200 이미지 반환

## 기대 조건
1) 첫 요청은 HTTP 202를 반환하고, body의 `type`은 `THUMBNAIL`이어야 한다.
2) 두 번째 요청은 HTTP 200을 반환하고, `Content-Type`은 `image/png`이며 응답 바디가 비어있지 않아야 한다.

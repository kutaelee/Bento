# P8-T1 — POST /nodes/{node_id}/share-links

## Goal
- 노드 공유 링크 생성 (만료/비밀번호 옵션)

## SSOT
- OpenAPI: `paths./nodes/{node_id}/share-links.post`
- Schema: `ShareLinkCreateRequest`, `ShareLink`
- DB: `x-db.tables.share_links`

## Required Evidence
- 정상 생성 201, token 반환 + expires_at 존재
- 잘못된 expires_in_seconds(범위 밖) 요청은 400

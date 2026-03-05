# P9-T1 /nodes/{node_id}/acl evidence

- GET/PUT /nodes/{node_id}/acl 은 인증 후 사용 가능하다.
- PUT은 entries 배열을 통째로 저장(교체)하고, 갱신 후 GET으로 동일한 목록을 조회해야 한다.
- payload 검증 실패 시 400을 반환해야 한다.

## Cases
- P9-T1-ACL-001: Set ACL and read back
- P9-T1-ACL-002: Reject invalid payload (entries is not array)

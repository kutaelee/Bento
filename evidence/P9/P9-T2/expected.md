# P9-T2 /nodes/{node_id}/access evidence

- 인증된 사용자는 노드 접근 권한을 조회할 수 있다.
- Admin/owner는 READ/WRITE/DELETE/SHARE 전체가 허용된다.
- 존재하지 않는 노드는 404를 반환한다.

## Cases
- P9-T2-ACCESS-001: Owner/Admin access returns all permissions
- P9-T2-ACCESS-002: Missing node returns 404

# P20-T0 Route Coverage Matrix

## Scope
- Source: `docs/ui/IA_NAV_SSOT.md`
- Inputs: `design/stitch/ko-kr_final/inventory/*`
- 기준: IA 라우트별 디자인 커버 상태를 1:1로 기록

| Route | IA Scope | Stitch 존재 | Derived 필요 | 이미 구현됨(추정) |
| --- | --- | --- | --- | --- |
| `/files` | Core | yes | no | yes |
| `/files/:nodeId` | Core | yes | no | yes |
| `/search` | Core | yes | yes | yes |
| `/recent` | Core | no | yes | yes |
| `/favorites` | Core | no | yes | yes |
| `/shared` | Core | no | yes | yes |
| `/media` | Core | yes | no | yes |
| `/trash` | Core | no | yes | yes |
| `/login` | Auth | no | yes | yes |
| `/setup` | Auth | no | yes | yes |
| `/invite/accept` | Auth | no | yes | yes |
| `/admin` | Admin | yes | no | yes |
| `/admin/users` | Admin | no | yes | yes |
| `/admin/storage` | Admin | no | yes | yes |
| `/admin/migration` | Admin | no | yes | yes |
| `/admin/performance` | Admin | no | yes | yes |
| `/admin/jobs` | Admin | yes | no | yes |
| `/admin/audit` | Admin | no | yes | yes |
| `/admin/security` | Admin | no | yes | yes |
| `/admin/appearance` | Admin | no | yes | yes |

### Notes
- `stitch_coverage` uses direct stitch page files under `design/stitch/ko-kr_final` 기준
- `derived_needed`은 직접 매핑 자산 부재 시 /admin, 검색/인증 관련 기능의 state 계열을 기준으로 산출

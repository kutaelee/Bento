# Backend QA - 2026-03-15

## Environment

- UI dev server: `http://127.0.0.1:15555`
- API server: `http://127.0.0.1:18080`
- Database: Docker `bento-postgres`
- Active volume path: `C:\codex\Bento\artifacts\qa\backend-volume`
- QA admin:
  - username: `admin`
  - password: `admin1234!`

## Fixes Validated

- Added Vite proxy coverage for `/uploads`, removing real-backend upload `404`.
- Restored damaged `ko-KR` locale extension keys used by files, media, and admin pages.
- Confirmed folder-create dialog keeps focus while typing.
- Confirmed top-level files flow uses real backend volume state.

## Browser QA Evidence

- Login:
  - `/login` renders localized Korean copy correctly.
  - Valid credentials redirect to `/files`.
- Storage:
  - path validation works for `C:\codex\Bento\artifacts\qa\backend-volume`
  - volume creation and activation completed earlier in this session
  - `/admin/storage` renders Korean summary and action labels without raw key leakage
- Upload:
  - real UI upload flow completed against backend
  - request chain observed:
    - `201 POST /uploads`
    - `200 PUT /uploads/{id}/chunks/0`
    - `200 POST /uploads/{id}/complete`
  - uploaded file appeared in `/files`
- Folder navigation:
  - created `QA Folder 0315`
  - opened folder from table row action
  - breadcrumb and `뒤로 가기` returned to root listing
- Media:
  - `/media` lists only media files
  - `qa-image.png` appears as image media item
  - media summary labels render in Korean

## Local Verification

- `pnpm --dir C:\codex\Bento\packages\ui typecheck`
- `pnpm --dir C:\codex\Bento\packages\ui test`
- `pnpm --dir C:\codex\Bento\packages\ui build`


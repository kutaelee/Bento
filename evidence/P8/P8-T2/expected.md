# P8-T2 Expected (Public share access + download)

- GET `/s/{token}` (public)
  - without password: 200
  - when share link has password:
    - missing `X-Share-Password`: 403
    - with correct `X-Share-Password`: 200

- GET `/s/{token}/download` (public)
  - supports `Range` (expect 206)
  - when share link has password:
    - missing `X-Share-Password`: 403
    - with correct `X-Share-Password`: 206

- Invalid share URLs
  - `/s/{token}/download/extra`: 404
  - `/s/{token}/abc`: 404
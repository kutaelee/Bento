# Public Transition Secret Rotation Checklist

## 반드시 퍼블릭 전환 전에 rotate
- [ ] 앱 인증 토큰 체계 (access_token / refresh_token 발급 비밀값)
- [ ] Telegram bot token
- [ ] Telegram chat id / delivery target 식별자 검토
- [ ] OpenClaw/Gateway token
- [ ] Session key / session identifier
- [ ] CI secrets (DB_URL, API keys, webhook secrets)

## 위치
- GitHub Repository Settings > Secrets and variables > Actions
- 배포 환경(서버/컨테이너) 환경변수 저장소
- OpenClaw/Gateway 런타임 시크릿 저장소

## 완료 기록
- [ ] rotate 완료일:
- [ ] 담당자:
- [ ] 영향 범위 점검 완료:

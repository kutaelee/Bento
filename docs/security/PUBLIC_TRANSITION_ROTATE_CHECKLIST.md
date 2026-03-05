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

## 먼저 해야 되는 체크리스트 (실행 전)
- [ ] 현재 사용 중인 시크릿 인벤토리 확정(이름/용도/사용 시스템/소유자)
- [ ] 미사용 시크릿은 즉시 폐기 후보로 분리
- [ ] 교체 순서 확정(다운타임 없는 순서: 발급 -> 배포 -> 검증 -> 폐기)
- [ ] 롤백 플랜 준비(새 시크릿 장애 시 임시 대응)
- [ ] 자동화 잡/크론/봇 일시 중지 계획 수립(오발송 방지)
- [ ] 담당자/검증자 2인 확인 체계 지정

## 로테이션 실행 체크리스트
- [ ] 새 시크릿 발급
- [ ] 런타임/CI에 새 시크릿 반영
- [ ] 배포 및 헬스체크
- [ ] 인증/웹훅/봇 동작 검증
- [ ] 구 시크릿 폐기(revoke/delete)
- [ ] 감사 로그/접근 로그 이상 여부 점검

## 완료 기록
- [ ] rotate 완료일:
- [ ] 담당자:
- [ ] 영향 범위 점검 완료:
- [ ] 구 시크릿 폐기 완료:

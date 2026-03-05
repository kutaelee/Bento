# P13-T2 i18n SSOT 스캐폴딩(COPY_KEYS 강제)

## 목표
- UI 문자열 하드코딩 없이 COPY_KEYS_SSOT에 정의된 키로만 접근한다.
- ko-KR/en-US 로케일 JSON이 SSOT 키를 모두 포함한다.

## 검증 방식
- 커맨드:
  - `pnpm -C packages/ui test`
- 기대 결과:
  - 테스트 PASS
  - `summary.json`의 `pass=true`, `result="PASS"`

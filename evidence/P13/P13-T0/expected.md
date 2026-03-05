# P13-T0 UI Evidence Harness (Self-test)

## 목표
- UI/FE 공통 증거 실행 스크립트(`scripts/run_ui_evidence.sh`)가 존재하고, 자체 스모크 테스트가 PASS로 기록된다.

## 검증 방식
- 커맨드: `bash scripts/run_ui_evidence.sh --self-test`
- 기대 결과:
  - `evidence/P13/P13-T0/summary.json`에 `pass=true`, `result="PASS"`
  - `actual/logs/cmd_1.log`에 self-test 로그가 기록됨

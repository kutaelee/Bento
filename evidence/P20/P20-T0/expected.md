# P20-T0 Evidence: 라우트×디자인 인벤토리 매핑 SSOT

## 목표
- IA 전 라우트를 디자인 커버율 관점에서 정량화하고 누락 항목을 도출한다.

## Scope/입력
- SSOT 입력: `docs/ui/IA_NAV_SSOT.md`
- 디자인 산출물: `design/stitch/ko-kr_final/inventory/*`

## 산출물 규칙
- `route_coverage.md`
  - IA 모든 route를 1:1로 표시
  - 상태 컬럼(`stitch_coverage`, `derived_needed`, `implemented_in_code`) 존재
- `_derived_checklist.md`
  - `derived_needed` 라우트에 대해 후속 파생 산출물/디자인보완 항목을 작성

## PASS 기준
- `route_coverage.md`에 IA 경로 18개 모두 1개 행씩 존재
- 각 행이 위 3 상태를 모두 포함
- `_derived_checklist.md`가 누락 경로를 나열

## 실행 체크
- coverage 파일 존재 및 헤더/행 포맷 검증
- IA 라우트 총수와 coverage 행 수 일치
- 필수 컬럼 값이 비어있지 않음

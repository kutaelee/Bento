# P18-T4 Evidence: 성능 하드닝(가상화/메모이제이션/코드 스플릿)

## 목표
- 대량 노드에서도 렌더/스크롤이 버벅이지 않게

## 제약
- route-level lazy loading(`/admin/*` 분리)
- VirtualList 기반 유지

## 증거(체크)
- 라우트 레벨 lazy loading 적용 여부 확인
- perf smoke(5k 아이템 렌더) 실행 및 결과 PASS

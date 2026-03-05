# P14-T5 VirtualList Primitive

## Goal
- 대량 리스트 렌더링을 위한 최소 VirtualList 프리미티브를 제공한다.
- 아이템 렌더 함수(renderItem) 기반으로, 고정 itemHeight 조건에서 windowing(가시 영역만 렌더)을 수행한다.

## Evidence
- `pnpm -C packages/ui-kit storybook:build`
- `pnpm -C packages/ui-kit test`
- `summary.json` pass=true, result="PASS"

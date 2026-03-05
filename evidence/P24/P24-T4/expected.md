# P24-T4 Inline Style / Legacy HTML Control 제거

## Goal
- packages/ui/src/app/**에서 <button style={...}> / <input style={...}> 등의 패턴을 ui-kit(또는 공통 프리미티브)로 교체한다.
- (권장) eslint guard로 인라인 스타일 사용 제한.

## Evidence
- ui lint PASS
- visual PASS(대표 라우트)

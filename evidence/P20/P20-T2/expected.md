# P20-T2 Evidence

Goal:
- AppShell(레이아웃) 단일화: Sidebar/Topbar/Content/Inspector

Acceptance checks:
- 모든 핵심 라우트가 AppShell 기반 레이아웃 내에서 렌더링되는지 정적 점검
- /files 및 /admin 라우트에서 frame/레이아웃 불일치가 없는지 확인
- InspectorPanel 컴포넌트를 포함하는 단일 AppShell이 존재

Run:
- bash evidence/P20/P20-T2/run.sh

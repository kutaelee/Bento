<!-- [SUSPENDED] UI 레퍼런스(=Stitch) 기반 작업/규칙은 현재 중단 상태입니다. -->
<!-- [SUSPENDED] 본 문서 내 UI 레퍼런스/픽셀 diff/시각회귀 관련 문장은 주석 처리되었습니다. -->

# IA_NAV_SSOT — Nimbus Drive Navigation & IA (SSOT)

이 문서는 **메뉴/내비게이션/설정 섹션 구조의 단일 진실 원천(SSOT)** 입니다.  
<!-- [SUSPENDED:UI_REFERENCE] Stitch 보드의 메뉴가 흔들리더라도, **구현은 항상 이 문서를 우선**합니다. -->

- P13부터 UI 구현이 시작되며, `docs/NAS_OpenClaw_Evidence_Playbook_P13_UI_Refactor.md`를 따른다.
- UI 재구축 실행 SSOT는 `docs/ui/UI_REBUILD_EXECUTION_PLAYBOOK.md`를 따른다. (Stitch 기준 비활성)

- 기본 언어: **ko-KR**
- 영어(en-US): 설정에서만 토글 가능(키는 동일)

---

## Before/After 요약(SSOT 변경점, 10줄 이내)
<!-- [SUSPENDED:UI_REFERENCE] - BEFORE: 좌측 사이드바에 Quick Links + Admin 진입이 섞여 구현되어 레퍼런스(AppShell)와 불일치 가능성이 있었다. -->
- AFTER: 1차 내비(탭/Quick Links)는 **Topbar 고정**, 좌측은 **Folder Tree 중심**, 우측은 **Inspector 고정**으로 SSOT를 확정한다.
- Admin 진입은 Topbar의 **⚙️ 버튼**으로 고정하고, /admin/* 하위 메뉴는 Admin Shell 내부에서 제공한다.
- 기본 테마는 **다크 우선(dark-first)** 이며, 토글/저장 규칙을 SSOT로 명시한다.
<!-- [SUSPENDED:UI_REFERENCE] - Stitch 산출물(code.html/screen.png)은 ‘정답 레이아웃/간격 스펙’이며, 구현은 ui-kit 조합으로 재현한다(HTML 복붙 금지). -->

---

## 0) 적용 범위와 우선순위

우선순위(상위가 더 강함):
1) `docs/ui/IA_NAV_SSOT.md`  ✅ (이 문서)
2) `docs/ui/COPY_KEYS_SSOT.md` (카피/i18n 키)
<!-- [SUSPENDED:UI_REFERENCE] 3) `design/stitch/ko-kr_final/inventory/` (완성도 체크) -->
<!-- [SUSPENDED:UI_REFERENCE] 4) `design/stitch/ko-kr_final/pages|modals|states|mobile|ui-kit_tokens/` (UI 레퍼런스) -->

---

## 1) Web (Desktop 1440) 전역 레이아웃(AppShell) SSOT

<!-- [SUSPENDED:UI_REFERENCE] > Stitch 레퍼런스(특히 `design/stitch/ko-kr_final/pages/*/code.html`)의 AppShell 특징을 SSOT로 고정한다. -->
> **레퍼런스 = 정답(레이아웃/컴포넌트/간격)** 이며, 구현은 ui-kit 조합으로 재현한다(HTML 복붙 금지).

### 1.1 Topbar(상단바, 항상 존재/고정)

상단바는 1차 내비게이션(탭)과 핵심 액션을 제공한다.

구성(좌→우, 순서 고정):
1) **Brand/Workspace**: 로고 + 워크스페이스(또는 드라이브) 식별
2) **Search / Command Palette**: 전역 검색 입력 + Cmd/Ctrl+K
3) **Primary Tabs(= 1차 내비, Quick Links 승격)**
   - 파일(`/files`)
   - 최근(`/recent`)
   - 즐겨찾기(`/favorites`)
   - 공유됨(`/shared`)
   - 미디어(`/media`)
   - 휴지통(`/trash`)
4) **Primary Actions**: 업로드(필수) / 새로 만들기 / 공유(필요 시)
5) **User**: 프로필/로그아웃
6) **Admin Entry(관리자만)**: **⚙️ 아이콘 버튼** → `/admin`

#### Admin 하위 메뉴 제공 규칙
- `/admin/*` 하위 메뉴는 Topbar/LeftNav에 노출하지 않고, **Admin Shell 내부**에서 페이지별 내비를 제공한다.

### 1.2 LeftNav(좌측: Folder Tree 중심, Quick Links 제거/최소화)

좌측 영역은 “탐색 트리(폴더)”에 집중한다.

구성(변경 금지):
1) Folder Tree (내 드라이브 루트 아래 트리)
2) Footer(계정/상태)

금지: Quick Links(파일/미디어/휴지통 등 1차 내비)를 좌측에 중복 배치

### 1.3 Content(본문: 목록/그리드 + 필터/정렬)

- 뷰 토글: 리스트 / 그리드
- 정렬: 이름/수정일/크기
- 필터: 타입(폴더/문서/이미지/비디오)
- 무한 스크롤(가상화 전제)
- 선택 모델: 단일/다중 선택(Inspector와 연동)

### 1.4 Inspector(우측: 선택 항목 인스펙터, 고정 패널)

선택된 항목이 있을 때 우측 패널이 활성화된다.

탭 구조(권장, 순서 고정):
- 정보(요약)
- 세부(메타데이터/EXIF 등)
- 공유(링크/권한)
- 활동(최근 변경/로그)

### 1.5 테마 정책(다크 우선, SSOT)

- 기본값: **다크(dark-first)**
- 토글: 라이트/다크/시스템 (설정 `/admin/appearance`)
- 저장 위치: (권장) `localStorage.theme` + 서버 사용자 설정 동기화(가능한 경우)
- 렌더 규칙: `html.dark` 클래스로 토큰 스코프 적용

### 1.6 데모 데이터/빈 화면 차이 원칙(SSOT)

<!-- [SUSPENDED:UI_REFERENCE] - Stitch 레퍼런스 화면은 데모 데이터가 있을 수 있다. -->
<!-- [SUSPENDED:UI_REFERENCE] - 따라서 visual regression/QA는 “빈 화면”이 아니라 **고정된 fixture(seed 데이터 또는 mock 응답)** 로 렌더링해야 한다. -->
- 구현에서 이미지/HTML을 하드코딩하는 것은 금지. 레퍼런스는 레이아웃/컴포넌트/간격 기준이다.

## 2) Web 페이지 라우팅(정규 경로)

### 2.1 Core
- `/files` : 파일 탐색기(기본)
- `/files/:nodeId` : 특정 폴더
- `/search?q=` : 전역 검색 결과
- `/recent`
- `/favorites`
- `/shared`
- `/media`
- `/trash`

### 2.2 Auth / Onboarding
- `/login`
- `/setup` : 최초 1회 관리자 생성(DB empty일 때만)
- `/invite/accept?token=` : 초대 수락(토큰 기반)

### 2.3 Admin Settings (관리자만)
- `/admin` : 설정 홈(대시보드)
- `/admin/users` : 사용자/초대
- `/admin/storage` : 볼륨 관리
- `/admin/migration` : 마이그레이션(읽기전용 포함)
- `/admin/performance` : 성능/QoS(자동조절 상태)
- `/admin/jobs` : 백그라운드 작업(큐/실패/재시도)
- `/admin/audit` : 활동/감사 로그
- `/admin/security` : 공유/보안 정책
- `/admin/appearance` : 언어/테마

> 구현 언어/라우터는 주제에 맞게 달라질 수 있으나, **경로 개념과 IA는 고정**입니다.

---

## 3) Settings IA (Stripe 스타일 섹션 트리)

### 3.1 Settings Home (`/admin`)
섹션 카드 6개:
1) 사용자 및 초대
2) 저장소 및 마이그레이션
3) 성능 / QoS
4) 백그라운드 작업
5) 보안 / 공유 정책
6) 언어 / 외관

### 3.2 Users (`/admin/users`)
탭(고정):
- 사용자
- 초대 링크

### 3.3 Storage (`/admin/storage`)
블록(고정):
- 활성 볼륨
- 볼륨 목록
- 경로 검증(쓰기 테스트/용량)
- 저장소 스캔/정리(고아 파일)

### 3.4 Migration (`/admin/migration`)
블록(고정):
- Read-only 전환 상태
- 진행률/로그
- 중단/재개(가능한 경우)
- 완료 확인

### 3.5 Performance (`/admin/performance`)
블록(고정):
- Capabilities(코어/램/디스크)
- QoS 상태(백그라운드 동시성/레이트 제한)
- 프로필(ECO/BALANCED/PERFORMANCE/CUSTOM)
- “PC 부담 없음” 원칙 설명(자동 조절)

### 3.6 Jobs (`/admin/jobs`)
탭(고정):
- 큐
- 실행 중
- 실패(재시도)
- 완료

### 3.7 Audit (`/admin/audit`)
필터(고정):
- 주체(사용자)
- 이벤트 타입(파일/권한/공유/로그인)
- 기간

### 3.8 Security (`/admin/security`)
블록(고정):
- 공유 링크 기본값(만료/비밀번호)
- 외부 노출 경고(포트포워딩)
- 세션/토큰 정책 요약

### 3.9 Appearance (`/admin/appearance`)
블록(고정):
- 언어 (ko-KR / en-US)
- 테마 (라이트/다크/시스템)
- 시간/날짜 표기 옵션

---

## 4) Mobile IA (하단 탭 고정)

탭(고정, 순서 변경 금지):
1) 파일
2) 업로드
3) 설정

Mobile 경로 개념:
- Files: 폴더 탐색 + 검색
- Uploads: 업로드 큐 + 최근 활동
- Settings: 언어/테마(기본), 계정, (관리자면) 주요 설정 링크

---

## 5) 변경 프로세스(필수)
내비게이션 항목을 바꾸려면:
1) ADR 작성 (`docs/ADR/`)
2) 이 문서 수정
3) `COPY_KEYS_SSOT.md` 키 동기화
4) UI Kit/페이지 반영 + evidence(스모크/타입체크) 제출

끝.

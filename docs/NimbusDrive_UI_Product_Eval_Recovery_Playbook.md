# NimbusDrive UI Product Eval Recovery Playbook

## 목적
현재 모든 phase는 완료되었지만, 제품형 eval 기준에서 다음 문제가 남아 있다.
- UI/UX 완성도 부족
- 페이지별 핵심 기능 오류 또는 미구현
- 공통 프레임/정보 구조의 일관성 부족
- 상태/빈 화면/에러/로딩 처리 미흡
- i18n, IA, SSOT 일관성 부족

이 문서는 페이지별 구현 체크리스트와 리팩토링 지시를 제공하여, 실제 사용자 기준의 제품 완성도를 회복하기 위한 실행용 플레이북이다.

---

## 기준 문서
- `NAS_SelfHosted_DDD_Spec_FINAL.md`
- `NAS_OpenClaw_TDD_Addendum_FINAL.md`
- `IA_NAV_SSOT.md`
- `COPY_KEYS_SSOT.md`
- `NimbusDrive_single_Playbook_Pack.md`

판단 우선순위:
1. IA/Route/Domain 경계
2. 사용자 과업 성공 여부
3. 제품형 eval 완성도
4. 시각 일관성
5. evidence 재현성

---

## 제품형 eval 관점의 합격선
각 페이지는 다음 6개를 만족해야 한다.
1. 사용자가 페이지 목적을 3초 내 이해할 수 있다.
2. 주요 액션이 시각적으로 명확하고, 클릭 후 상태 변화가 예측 가능하다.
3. 로딩/빈 상태/에러/권한 없음 상태가 모두 설계되어 있다.
4. 모바일/태블릿/데스크톱에서 정보 구조가 무너지지 않는다.
5. 하드코딩 문자열 없이 i18n key 기반으로 관리된다.
6. evidence로 기능 회귀 여부를 검증할 수 있다.

---

## 공통 리팩토링 원칙

### UX 원칙
- NAS 제품답게 **도구형 UI**를 유지한다.
- 화려한 마케팅형 랜딩이 아니라, **정보 밀도·명확한 상태·빠른 조작성**을 우선한다.
- 모든 페이지는 1차 과업(primary job)이 명확해야 한다.

### 시각 원칙
- 최신형 **Bento grid 감성**을 적용하되, 장식보다 정보 구조 중심으로 사용한다.
- 큰 카드 + 보조 카드 + 요약 지표 + 최근 활동 + 빠른 액션 구조를 기본 패턴으로 삼는다.
- 카드마다 역할이 달라야 하며, 단순히 박스만 나열하지 않는다.
- 간격, 라운드, 계층, hover, focus-visible, skeleton 규칙을 통일한다.

### 구현 원칙
- AppShell, page header, section card, toolbar, filter bar, table/list, empty/error panel을 공통 컴포넌트화한다.
- page별 중복 CSS를 줄이고 토큰/공통 스타일 계층으로 올린다.
- 상태 모델을 `idle/loading/success/empty/error/submitting` 기준으로 정리한다.
- destructive action은 confirm/undo 또는 명확한 안전장치가 있어야 한다.

### 금지사항
- 임시 문구 하드코딩
- 페이지마다 다른 spacing scale 사용
- 의미 없는 gradient 남용
- 빈 상태에서 무의미한 박스만 렌더링
- CTA 우선순위가 뒤섞인 배치

---

## 공통 체크리스트

### A. 레이아웃
- [ ] 상단 헤더에 현재 위치와 페이지 목적이 드러난다.
- [ ] primary action 1개, secondary action 1~2개로 정리된다.
- [ ] 정보 영역과 액션 영역이 시각적으로 분리된다.
- [ ] 반응형에서 card → stack 전환이 자연스럽다.

### B. 상태
- [ ] 최초 로딩 skeleton 제공
- [ ] empty state 제공
- [ ] error state 제공
- [ ] retry/action 제공
- [ ] partial failure를 구분해서 보여준다.

### C. 상호작용
- [ ] keyboard focus 가능
- [ ] hover/active/focus-visible 상태 정의
- [ ] destructive action confirm 처리
- [ ] long-running action 진행 상태 표시

### D. 데이터
- [ ] 실제 API/도메인 상태와 UI 상태가 분리되지 않는다.
- [ ] optimistic update 사용 시 rollback 전략이 있다.
- [ ] 정렬/필터/검색 조건이 UI에 노출된다.

### E. 텍스트/i18n
- [ ] 하드코딩 문자열 제거
- [ ] COPY_KEYS SSOT 네이밍 준수
- [ ] 오류 문구는 사용자 친화적 문장으로 변환

### F. evidence
- [ ] route snapshot
- [ ] 주요 액션 smoke
- [ ] error/empty 상태 확인 evidence
- [ ] visual regression evidence

---

## 페이지별 구현 체크리스트

## 1. Login Page (`/login`)
### 목적
사용자가 빠르게 로그인 진입점을 이해하고, 실패 시 이유를 이해하며 다시 시도할 수 있어야 한다.

### 체크리스트
- [ ] 로그인 카드의 시각적 중심이 명확하다.
- [ ] 제품명/설명/보안 안내가 과하지 않게 정리된다.
- [ ] 입력 필드, submit 버튼, loading 상태가 일관적이다.
- [ ] 잘못된 인증 정보, 네트워크 실패, 서버 오류가 구분된다.
- [ ] Caps Lock, disabled, pending 상태가 명확하다.
- [ ] 접근성 label과 error association이 연결된다.

### 제품형 eval 기준
- [ ] 첫 화면에서 어디에 무엇을 입력해야 하는지 즉시 이해 가능
- [ ] 실패 메시지가 추상적이지 않음
- [ ] submit 중 중복 클릭 방지

### evidence
- [ ] 성공 로그인
- [ ] 실패 로그인
- [ ] 네트워크 오류 모의

---

## 2. Setup Page (`/setup`)
### 목적
최초 설정 또는 시스템 연결 절차를 단계적으로 완료하게 해야 한다.

### 체크리스트
- [ ] 단계(stepper) 또는 진행 구조가 명확하다.
- [ ] 현재 단계/다음 단계/완료 조건이 보인다.
- [ ] 입력 검증이 필드 근처에서 즉시 피드백된다.
- [ ] 연결 테스트 결과가 성공/실패로 명확히 표현된다.
- [ ] 실패 시 복구 방법 또는 재시도 경로를 제시한다.
- [ ] 완료 후 어디로 이동하는지 예측 가능하다.

### 제품형 eval 기준
- [ ] 사용자가 길을 잃지 않는다.
- [ ] 설정 실패가 막다른 길이 되지 않는다.
- [ ] 시스템 상태와 사용자 액션이 연결된다.

### evidence
- [ ] happy path setup
- [ ] validation fail
- [ ] connection test fail/retry

---

## 3. Invite Accept Page (`/invite/accept`)
### 목적
초대 수락 여부와 결과를 명확히 전달하고, 권한/멤버십 변경을 이해시켜야 한다.

### 체크리스트
- [ ] 어떤 workspace/resource 초대인지 명확히 보인다.
- [ ] 초대 유효/만료/이미 수락/권한 없음 상태가 구분된다.
- [ ] accept/reject 액션이 명확하다.
- [ ] 처리 후 결과 상태가 확실히 보인다.
- [ ] 로그인 필요 시 자연스럽게 유도한다.

### evidence
- [ ] valid invite accept
- [ ] expired invite
- [ ] already accepted

---

## 4. Files Page (`/files`)
### 목적
핵심 작업 화면이다. 파일 탐색, 선택, 정렬, 업로드, 이동, 삭제, 복구의 기준점이 되어야 한다.

### 체크리스트
- [ ] 상단에 현재 경로(breadcrumb)가 있다.
- [ ] toolbar에 upload/new folder/search/sort/view toggle이 정리된다.
- [ ] 파일 리스트/그리드 전환이 일관된다.
- [ ] multi-select, bulk action, context action이 명확하다.
- [ ] 업로드 진행률, 실패 항목, 재시도 가능 여부가 보인다.
- [ ] 빈 폴더 상태에서 다음 행동을 유도한다.
- [ ] 파일 유형별 icon/preview 정책이 일관된다.
- [ ] 정렬/필터 상태가 UI에 드러난다.
- [ ] rename/move/delete/share 등 액션 결과가 즉시 반영된다.

### 제품형 eval 기준
- [ ] “이 제품의 핵심 가치”가 가장 잘 보이는 화면이어야 한다.
- [ ] 정보량이 많아도 혼란스럽지 않아야 한다.
- [ ] 반복 작업이 빠르게 가능해야 한다.

### NAS Bento grid 가이드
- [ ] 좌상단: storage summary / quick stats
- [ ] 상단 메인: current folder + primary actions
- [ ] 보조 카드: recent uploads / shared items / storage health
- [ ] 하단 메인: files table or smart grid
- [ ] 우측 보조: selection inspector or activity panel

### evidence
- [ ] upload success/fail
- [ ] create folder
- [ ] rename/move/delete
- [ ] empty folder
- [ ] bulk action
- [ ] visual snapshot

---

## 5. Search Page (`/search`)
### 목적
검색 결과가 빠르고 명확하며, 필터/정렬/결과 이동이 쉬워야 한다.

### 체크리스트
- [ ] query 입력과 즉시 피드백이 자연스럽다.
- [ ] 최근 검색 또는 추천 검색이 있다.
- [ ] 파일명/경로/유형/수정일 등 메타가 결과에 보인다.
- [ ] 검색어 없음 / 결과 없음 / 로딩 / 에러 상태가 분리된다.
- [ ] 필터 chips 또는 패널이 정리된다.
- [ ] 검색 결과에서 원위치 이동(path reveal)이 가능하다.

### evidence
- [ ] keyword search
- [ ] no result
- [ ] filter change

---

## 6. Trash Page (`/trash`)
### 목적
삭제된 파일의 복구와 영구 삭제를 안전하게 수행하게 해야 한다.

### 체크리스트
- [ ] 복구 가능 기간/정책이 보인다.
- [ ] restore / delete forever 액션이 구분된다.
- [ ] bulk restore/delete가 안전하게 동작한다.
- [ ] empty trash, partially failed restore 상태가 처리된다.

### evidence
- [ ] restore single
- [ ] restore bulk
- [ ] permanent delete confirm

---

## 7. Admin / Settings 계열 (`/admin/*`)
### 목적
운영 설정은 설명 가능성과 안전성이 중요하다.

### 체크리스트
- [ ] 섹션 분류가 명확하다.
- [ ] 변경 전 현재 값과 영향 범위를 보여준다.
- [ ] 저장 성공/실패/검증 오류를 구분한다.
- [ ] 위험 설정은 confirm 또는 secondary step이 있다.
- [ ] audit/log/history 접근이 가능하면 연결한다.

### evidence
- [ ] setting update success/fail
- [ ] validation error
- [ ] destructive admin action safeguard

---

## 디자인 시스템 고도화 지시

### 목표 미감
- NAS 제품에 맞는 차분하고 정교한 최신 UI
- dark/light 모두 견디는 중성 톤
- 과장된 네온 대신, 얕은 유리감/레이어감/정리된 카드 구조
- 생산성 도구 느낌을 유지한 Bento composition

### 구현 포인트
- [ ] AppShell의 좌측 nav, 상단 page header, content grid를 재정렬
- [ ] card radius / border / surface / shadow 토큰 통일
- [ ] dense mode에서도 readable한 line-height와 spacing 유지
- [ ] stat card, action card, data card, panel card의 역할 분리
- [ ] skeleton, empty panel, error panel 시각 규칙 통일
- [ ] table/grid/list 간 토큰 공유

### 권장 결과물
- 공통 UI primitives 리팩토링
- page별 CSS 중복 제거
- design token 정리
- 주요 route visual baseline 갱신

---

## 실행 순서 권장
1. AppShell / global tokens / shared card primitives 정리
2. Files page를 제품 대표 화면으로 재설계
3. Login / Setup / Invite 흐름 복구
4. Search / Trash 보강
5. Admin 계열 안전성/설명력 보강
6. route snapshot / smoke / visual evidence 정리

---

## Task 카드 템플릿
```md
### Task: PXX-TY
- Scope:
- Route/Page:
- User job:
- Problem:
- Required changes:
- Acceptance checklist:
  - [ ]
  - [ ]
- Evidence:
  - [ ] route snapshot
  - [ ] smoke
  - [ ] visual
- BLOCKER if:
  - SSOT 위반
  - i18n 하드코딩
  - empty/error state 누락
  - 제품형 eval 기준 미달
```

---

## 최종 DoD
- [ ] 모든 주요 페이지가 공통 레이아웃 규칙을 따른다.
- [ ] page별 핵심 기능이 실제로 동작한다.
- [ ] loading/empty/error/success 상태가 완비된다.
- [ ] i18n 하드코딩이 제거된다.
- [ ] Bento grid 감성이 적용되지만 도구형 UX가 유지된다.
- [ ] visual/e2e/evidence로 회귀 검증 가능하다.

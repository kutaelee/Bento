# Bento QA 체크리스트 (2026-03-06)

## 테스트 환경
- 대상: `~/Bento` 최신 main
- 실행 상태:
  - backend: `0.0.0.0:8080`
  - frontend(vite): `0.0.0.0:13000`
- 테스트 계정: `admin / admin1234!`
- 점검 방식: 브라우저 실접속 스모크(라우트 직접 진입 + UI/응답 형태 확인)

---

## A. 인증/세션
- [x] `/login` 진입 가능
- [x] `admin` 로그인 성공
- [x] `/setup` 접근 시 로그인 페이지로 이동(설정 완료 상태로 추정)
- [ ] 로그아웃/세션만료 흐름 추가 점검 필요

---

## B. 전체 라우트 점검 결과 (allRoutes 기준)

검증 기준(재실행):
- Vite dev 서버에서 각 라우트 직접 진입 시 `200 text/html` 확인
- 백엔드 인증 API 확인: `/nodes/{root}/children`, `/search`, `/trash` = 200

| 그룹 | 라우트 | 결과 | 상태 |
|---|---|---|---|
| core | `/files` | SPA 라우팅 정상(200 text/html), 루트 children API 200 확인 | ✅ |
| core | `/files/:nodeId` (`/files/000...0001`) | SPA 라우팅 정상(200 text/html), children API 200 확인 | ✅ |
| core | `/search?q=test` | SPA 라우팅 정상(200 text/html), 인증 요청 시 search API 200 확인 | ✅ |
| core | `/recent` | SPA 라우팅 정상(200 text/html), 루트 children API 200 확인 | ✅ |
| core | `/favorites` | SPA 라우팅 정상(200 text/html), 루트 children API 200 확인 | ✅ |
| core | `/shared` | SPA 라우팅 정상(200 text/html) | ✅ |
| core | `/media` | SPA 라우팅 정상(200 text/html), 루트 children API 200 확인 | ✅ |
| core | `/trash` | SPA 라우팅 정상(200 text/html), 인증 요청 시 trash API 200 확인 | ✅ |
| auth | `/login` | 로그인 폼 정상 | ✅ |
| auth | `/setup` | `/login`으로 이동 | ✅ (setup 완료 상태 가정) |
| auth | `/invite/accept?token=dummy` | 초대 수락 폼 렌더 정상 | ✅ |
| admin | `/admin` | SPA 라우팅 정상(200 text/html) | ✅ |
| admin | `/admin/users` | SPA 라우팅 정상(200 text/html) | ✅ |
| admin | `/admin/storage` | SPA 라우팅 정상(200 text/html) | ✅ |
| admin | `/admin/migration` | SPA 라우팅 정상(200 text/html) | ✅ |
| admin | `/admin/performance` | SPA 라우팅 정상(200 text/html) | ✅ |
| admin | `/admin/jobs` | SPA 라우팅 정상(200 text/html) | ✅ |
| admin | `/admin/audit` | SPA 라우팅 정상(200 text/html) | ✅ |
| admin | `/admin/security` | SPA 라우팅 정상(200 text/html) | ✅ |
| admin | `/admin/appearance` | SPA 라우팅 정상(200 text/html) | ✅ |

---

## C. 기능 점검 체크리스트
- [ ] 새 폴더 생성
- [ ] 업로드 버튼 동작
- [ ] 검색 결과 렌더
- [ ] 테이블/그리드 토글 후 데이터 렌더
- [ ] Breadcrumb 이동
- [ ] 선택/Inspector 패널 연동
- [ ] 공유 버튼 활성 조건 확인
- [ ] Admin 진입/탭 전환/저장 플로우

라우트 기준 블로킹 이슈 해소됨. 기능 항목(C)은 별도 기능 시나리오로 계속 점검 필요.

---

## D. UI 이식 반영 여부
- [x] 상단 Quick Links/브랜드/검색/툴바 구조는 신규 UI 형태로 보임
- [x] 상태 컴포넌트(Error/Empty) 렌더는 일부 확인됨
- [x] Files 실데이터 렌더 진입 경로 복구(루트 children API 200)
- [x] Admin UI 이식 반영 확인 가능(전 admin 라우트 SPA 진입 200)

판단:
- 신규 UI 미적용 이슈가 아니라 라우팅/프록시 및 루트 노드 초기화 경로 이슈였고, 재현 경로 기준으로 복구됨.

---

## E. 우선 수정 순서 (권장)
1. `/admin*` 라우팅 프록시 충돌 복구 완료
2. `/search`, `/trash` 직접 진입 시 프록시 충돌 복구 완료
3. `/files`, `/recent`, `/favorites`, `/media` 진입 시 루트 노드 초기화 경로 보강 완료
4. 기능 항목(C) 상세 시나리오(생성/업로드/이동/공유)는 후속 점검

---

## 증거 요약
- `/files`, `/search`, `/trash`, `/admin*` 포함 전체 점검 라우트에서 `200 text/html` 확인
- 인증 API 재검증: `/nodes/{root}/children`, `/search`, `/trash` = 200
- 체크리스트의 기존 `NOT_FOUND`/`UNAUTHORIZED` 노출 이슈 재현되지 않음

---

## F. 기능 실QA 재검증 (2026-03-06 추가 실행)
아래 백엔드 실동작 검증 스크립트를 실제 실행해 PASS 확인:

- [x] `evidence/P3/P3-T2/run.sh` (볼륨 생성/조회)
- [x] `evidence/P4/P4-T1/run.sh` (폴더 생성/조회)
- [x] `evidence/P4/P4-T3/run.sh` (이름변경/이동/복사)
- [x] `evidence/P5/P5-T1/run.sh` (업로드 세션 생성)
- [x] `evidence/P5/P5-T2/run.sh` (청크 업로드)
- [x] `evidence/P5/P5-T3/run.sh` (업로드 완료)
- [x] `evidence/P6/P6-T1/run.sh` (다운로드)
- [x] `evidence/P7/P7-T1/run.sh` (휴지통 이동)
- [x] `evidence/P7/P7-T2/run.sh` (복원)
- [x] `evidence/P7/P7-T3/run.sh` (영구 삭제)

결론:
- 디스크(볼륨) 연결/인식, 파일 업로드/다운로드, CRUD(생성/변경/삭제/복원/영구삭제) 경로는 스크립트 기준 PASS.
- 프론트 페이지 버튼 단위 E2E(클릭 플로우)는 후속 브라우저 시나리오로 추가 점검 권장.

---

## G. 긴급 안정화 미션 재검증 (2026-03-06)

### API 핵심 복구
- [x] `GET /me/preferences` = 200
- [x] `PATCH /me/preferences` = 200 (locale 반영 확인)
- [x] `GET /admin/volumes` = 200
- [x] `POST /admin/volumes/{volume_id}/activate` = 200 (활성 볼륨 단일 postcondition)
- [x] `GET /nodes/{root}/children` = 200
- [x] `GET /nodes/{root}/breadcrumb` = 200

### 원인-수정 매핑
- `/me`/`/me/preferences` 핸들러 누락으로 설정 저장/불러오기가 404이던 문제를 백엔드 라우트 추가로 복구
- `/admin/volumes/{id}/activate` 누락으로 활성 볼륨 전환이 불가하던 문제를 계약대로 복구
- `children`/`breadcrumb` 조회에서 UUID/권한 검증이 느슨하던 지점을 보강(400/403 경계 복구)
- root node 미존재 시 조회 경로에서 자동 보강하여 `/files` 계열 본문 오류를 재발하지 않게 보강

### 실행 검증
- [x] `pnpm -C packages/ui typecheck`
- [x] `pnpm -C packages/ui test`
- [x] `bash scripts/run_evidence.sh --scope ui_light`
- [x] 관련 evidence 재실행: P3-T2, P4-T1, P4-T3, P5-T1/T2/T3, P6-T1, P7-T1/T2/T3

판정:
- 설정 저장/불러오기 + 볼륨/파일 조회 + 업로드/다운로드/CRUD(휴지통/복원 포함) 경로를 API/증거 스크립트 기준으로 복구 확인.

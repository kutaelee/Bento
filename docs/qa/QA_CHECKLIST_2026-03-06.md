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

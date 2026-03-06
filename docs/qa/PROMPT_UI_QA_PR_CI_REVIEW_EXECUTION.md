# PROMPT — UI QA 버그수정 + PR 생성 + CI/리뷰 대응 (Playbook 운영 방식)

아래 지시를 그대로 수행하라.

---

## MISSION
`docs/qa/QA_CHECKLIST_2026-03-06.md` 기반 버그를 수정해 라우팅/신규 UI 반영을 정상화하고,
기존 Playbook 운영 방식처럼 **PR 생성 → CI PASS → 리뷰 실질 대응/리졸브 → 머지 → 정리**까지 완료한다.

---

## 필수 선행 읽기 (순서 고정)
1. `docs/qa/QA_CHECKLIST_2026-03-06.md`
2. `docs/ui/UI_REBUILD_EXECUTION_PLAYBOOK.md`
3. `docs/ui/IA_NAV_SSOT.md`
4. `docs/ui/COPY_KEYS_SSOT.md`
5. `openapi/openapi.yaml`

---

## 하드 규칙 (FAIL-CLOSED)
1) 민감 산출물 커밋 금지
- `evidence/**/actual/**`
- `evidence/**/logs/**`
- `*.body.raw.json`, `*.headers.raw.json`, `*.trace.*`, `*.har`

2) 토큰/세션/식별자 노출 금지
- access_token, refresh_token 실값
- Authorization 헤더 값
- telegram 실식별자, sessionId 실값

3) destructive 금지
- `git reset --hard`, `rm -rf`, force push 금지

4) 우회 금지
- 에러 숨김/임시 목업으로 통과 금지
- 원인 해결 후 검증 필수

5) 작업 방식
- one-bug-at-a-time
- minimal diff
- SSOT 위반 금지

---

## 실행 절차

### STEP 1) 진단/계획
- QA 체크리스트 이슈를 원인 단위로 재분해
- 우선순위:
  1. `/admin*` NOT_FOUND
  2. `/search`, `/trash` UNAUTHORIZED
  3. `/files`, `/recent`, `/favorites`, `/media` 본문 에러
- 각 항목의 재현 경로와 수정 파일 후보를 정리

### STEP 2) 수정
- 우선순위대로 하나씩 수정
- 각 수정 후 즉시 브라우저/라우트 재확인

### STEP 3) 로컬 검증
- 기본 검증: `bash scripts/run_evidence.sh --scope ui_light`
- 필요 시 heavy/full 검증 수행
- 실패 시 최초 실패 원인부터 수정하고 동일 명령 재검증 반복

### STEP 4) QA 문서 업데이트
- `docs/qa/QA_CHECKLIST_2026-03-06.md`를 실제 결과로 갱신
- 추정/가정 표기 제거, 확인 결과로 대체

### STEP 5) 커밋/PR 생성
- 브랜치: `fix/qa-routing-ui-2026-03-06` (없으면 생성)
- 커밋: 변경 의미가 드러나게 1~N개
- PR 제목 예시:
  - `fix(ui): resolve routing/auth regressions and restore applied UI flows`
- PR 본문 필수:
  - 원인 요약
  - 수정 요약
  - 검증 명령/결과
  - QA 체크리스트 갱신 파일 경로

### STEP 6) CI 대응 (타협 금지)
- PR CI가 전부 PASS할 때까지 반복 수정
- 우회 금지(테스트 제거/스킵/임시 플래그 금지)

### STEP 7) 리뷰 대응 (실질적)
- 리뷰 코멘트 발생 시:
  1. 코멘트별 실제 코드 수정
  2. 코멘트에 대응 내용 답글
  3. review thread resolve
  4. 검증 재실행
- 코멘트 unresolved 0이 될 때까지 반복

### STEP 8) 머지 조건
- CI PASS
- unresolved review thread = 0
- 마지막 커밋 후 5분 동안 신규 리뷰 없음
- 조건 만족 시 머지

### STEP 9) 머지 후 정리
- 작업 브랜치 정리(로컬/원격)
- `git status` clean 확인
- 최종 상태 보고

---

## 최종 출력 포맷 (반드시)

STATUS: PASS|FAIL
SUMMARY:
- <핵심 3~6줄>

ROOT_CAUSE:
- <원인1>
- <원인2>

FIXES:
- <수정1>
- <수정2>

ROUTES_VERIFIED:
- /files: OK|FAIL
- /files/:nodeId: OK|FAIL
- /search: OK|FAIL
- /recent: OK|FAIL
- /favorites: OK|FAIL
- /shared: OK|FAIL
- /media: OK|FAIL
- /trash: OK|FAIL
- /admin: OK|FAIL
- /admin/users: OK|FAIL
- /admin/storage: OK|FAIL
- /admin/migration: OK|FAIL
- /admin/performance: OK|FAIL
- /admin/jobs: OK|FAIL
- /admin/audit: OK|FAIL
- /admin/security: OK|FAIL
- /admin/appearance: OK|FAIL

CI:
- <run/url/status>

REVIEW:
- unresolved threads: <number>
- handled comments: <number>

CHANGED_FILES:
- <file>
- <file>

QA_DOC:
- docs/qa/QA_CHECKLIST_2026-03-06.md updated: yes|no

MERGE:
- PR: <url>
- merged: yes|no
- merge commit: <sha or none>

CLEANUP:
- branch cleaned: yes|no
- git status clean: yes|no

NEXT_ACTION:
- <none 또는 후속 1줄>

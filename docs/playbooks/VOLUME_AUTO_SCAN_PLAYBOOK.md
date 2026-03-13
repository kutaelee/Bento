# VOLUME AUTO-SCAN PLAYBOOK (Performance-aware)

## 목표
볼륨 등록/활성화 시 기존 파일을 자동 스캔하여 파일 트리에 반영한다.
성능 저하를 막기 위해 단계적/비동기 방식으로 설계하고, 기존 UI/API 계약을 깨지 않는다.

---

## 범위
- 대상 레포: `~/Bento`
- 백엔드 중심 구현 (`scripts/dev_server.mjs` + 관련 API/DB 로직)
- UI는 상태 노출(스캔 진행/완료/오류) 최소 반영
- SSOT 준수: `openapi/openapi.yaml`, `docs/ui/IA_NAV_SSOT.md`, `docs/ui/COPY_KEYS_SSOT.md`

---

## 핵심 요구사항
1. 볼륨 등록/활성화 시 자동 스캔 트리거
2. `/mnt/storage` 기존 파일/디렉토리 트리 반영
3. 대용량 디렉토리에서도 서버 응답성 유지
4. 재실행 안전(idempotent) + 중복 노드 방지
5. 실패 복구 가능(중간 실패 후 재개)

---

## 설계 원칙 (성능/안정성)
- API 요청 스레드에서 전체 스캔 수행 금지 (비동기 잡 큐)
- 스캔 단위 분할(배치 처리): 디렉토리 단위/파일 N개 단위
- DB upsert 기반으로 중복 방지
- 경로 해시/mtime/size 기반 변경 탐지(최소 재처리)
- 스캔 중에도 `/files` 읽기 가능 유지
- 스캔 상태(job progress) 노출

---

## 구현 단계 (Playbook)

### Phase 1 — 데이터 모델/계약 정렬
- [ ] OpenAPI에 자동 스캔 동작/상태 필드 명시
- [ ] 볼륨/잡 스키마에 scan state(queued/running/succeeded/failed) 정의
- [ ] DB 컬럼/인덱스 필요한 경우 추가

완료 기준:
- API/스키마 정의가 코드 구현과 일치

### Phase 2 — 스캔 엔진 MVP
- [ ] 볼륨 경로 walk 구현 (심볼릭 링크/권한 에러 처리 포함)
- [ ] 디렉토리/파일을 nodes에 upsert (path 기준)
- [ ] root children에 반영되도록 parent-path 매핑
- [ ] dry-run 모드(로그만) 지원

완료 기준:
- `/mnt/storage` 파일이 `/nodes/{root}/children`에 노출

### Phase 3 — 비동기 잡/성능 제어
- [ ] 볼륨 activate/create 시 scan job enqueue
- [ ] 스캔 워커 분리(요청-응답과 분리)
- [ ] 배치 처리 + 주기적 progress 업데이트
- [ ] 시간 제한/중단/재시도 정책 추가

완료 기준:
- 대용량에서도 API 응답 지연 과도 증가 없음

### Phase 4 — 증분 스캔/재실행 안전성
- [ ] 이전 스캔 결과와 비교해 변경분만 반영
- [ ] 삭제/이동 파일 처리 정책 정의(soft-delete 또는 re-link)
- [ ] 중복/충돌(name/path) 처리 일관화

완료 기준:
- 재스캔 시 중복 노드 없이 일관성 유지

### Phase 5 — UI/운영 가시성
- [ ] Admin Storage에 스캔 상태/진행률 표시
- [ ] 실패 원인 메시지/재시도 버튼 제공
- [ ] 최초 스캔 전 사용자 안내(시간 소요/영향)

완료 기준:
- 관리자 UI에서 상태 파악/재시도 가능

### Phase 6 — 검증/릴리즈
- [ ] 기능 검증: 등록→활성화→자동스캔→목록 노출
- [ ] 회귀 검증: 업로드/다운로드/CRUD 기존 기능 유지
- [ ] `bash scripts/run_evidence.sh --scope ui_light` PASS
- [ ] 관련 evidence task PASS

완료 기준:
- CI PASS + 리뷰 반영 + 머지

---

## 운영 규칙
- 1 Phase = 1 PR
- CI PASS 전 머지 금지
- 리뷰 발생 시 실질 수정 + 답글 + thread resolve
- 마지막 커밋 후 5분 신규 리뷰 없을 때 머지
- 머지 후 브랜치/dirty 정리

---

## 금지 사항
- 민감 산출물 커밋 금지 (`evidence/**/actual/**`, logs, raw json 등)
- 토큰/세션 실값 커밋 금지
- destructive 명령 금지 (`reset --hard`, `rm -rf`, force push)
- 테스트 스킵/우회 금지

---

## 최종 보고 포맷
STATUS: PASS|FAIL
PHASE: <current>
ROOT_CAUSE:
- <...>
CHANGED_FILES:
- <...>
VALIDATION:
- <command>: <result>
CI:
- <url/status>
REVIEW:
- unresolved threads: <n>
MERGE:
- <pr url>
NEXT:
- <next phase>

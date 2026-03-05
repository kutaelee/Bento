# NAS OpenClaw TDD Addendum (FINAL)

## Mandatory
- Evidence는 아래 규칙을 준수한 구현에 대해서만 인정됩니다.
  - `.openclaw/skills/clean-code-enforcer/INSTRUCTIONS.md`
- UI 검증은 스크린샷이 아니라, 가능한 경우 Storybook 스모크/타입체크/린트 등 CLI 기반으로 수행합니다.


> 목적: “스크린샷”이 아니라 **CLI 테스트 결과**로만 태스크를 닫는다.  
> 규칙: **기댓값(expected)** 과 **실제값(actual)** 이 다르면 무조건 실패 → 재구현.

---

## 0. SSOT 연결 규칙
- API 계약/스키마/에러: `openapi/openapi.yaml` (SSOT)
- 테스트는 SSOT를 “근거”로 한다.
- 구현이 SSOT와 다르면 **구현이 잘못된 것**이다. (SSOT 먼저 수정 후 구현)

---

## 1. 증거(Evidence) 번들 표준 구조(필수)

태스크 하나(Piece/Task) 완료 시, 아래 폴더가 반드시 생성되어야 합니다.

```
/evidence/<piece_id>/<task_id>/
  expected.md                # 이 태스크의 합격 기준(사람이 읽는 문서)
  cases/                     # 계약 테스트 케이스(구조화)
    *.case.yaml
  run.sh                     # 실행 커맨드(재현 가능해야 함)
  actual/                    # 실제 실행 결과
    http/                    # curl 결과, status/header/body
    db/                      # psql 출력(필요 시)
    fs/                      # ls/find/sha256sum 출력(필요 시)
    logs/                    # server/worker 로그(필요 시)
  junit.xml                  # 테스트 러너 결과(가능하면)
  summary.json               # 자동 요약(필수): pass/fail, 근거 경로
```

### 1.1 `summary.json` 필수 필드
- `piece_id`, `task_id`
- `result`: `"PASS" | "FAIL"`
- `checks`: 배열 (각 체크에 대해)
  - `name`
  - `expected`
  - `actual_path`
  - `pass` (boolean)

---

## 2. “계약 테스트 케이스” 포맷(SSOT 기반)

`/evidence/<piece>/<task>/cases/*.case.yaml` 는 아래 스키마를 따른다:

```yaml
id: P1-T1-LOGIN-001
name: 로그인 성공 케이스
depends_on: [] # 선행 케이스 id (선택)
request:
  method: POST
  url: /auth/login
  headers:
    Accept-Language: ko-KR
    Content-Type: application/json
  body:
    username: admin
    password: "admin1234!"
expect:
  status: 200
  assertions:
    - type: jq
      expr: '.user.username == "admin"'
    - type: jq
      expr: '.tokens.token_type == "Bearer"'
    - type: jq
      expr: '.tokens.expires_in_seconds > 0'
```

### 2.1 Assertion 타입(최소 지원)
- `jq`: JSON 응답을 jq 표현식으로 검증(참/거짓)
- `regex`: 문자열/헤더를 정규식으로 검증
- `equals`: 완전일치(정적 값에만)

### 2.2 동적 값 처리 원칙(토큰 등)
- access_token 같은 비결정 값은 “존재/형식/길이”로 검증한다.
- 예: `jq expr: '(.tokens.access_token | length) > 20'`

---

## 3. 테스트 실행 규칙(명시적으로 강제)

### 3.1 실행 원칙
- 테스트는 **단일 커맨드로 재현 가능**해야 함 (`run.sh`)
- 서버/DB/워커는 테스트 환경으로 띄운 뒤 실행
- 통과/실패는 자동 판단한다.
- PASS 못 만들면 중단 + 실패 보고, 무한루프 금지
- **PR에 푸시하기 전: 해당 `evidence/<P>/<T>/run.sh` 1회 실행으로 PASS를 확인한다. `scripts/run_evidence.sh`는 PR 후/최종 검증에서만 실행한다.**
- 로컬 CI 실패 시 1회 런에서 **최대 2회** 수정→재실행까지만 시도하고, 이후에는 다음 런으로 넘기며 보고한다.

### 3.2 실패 판정(자동)
아래 중 하나라도 발생하면 FAIL:
- 기대 status != 실제 status
- jq assertion 하나라도 false
- DB/FS 증거가 기대와 불일치
- `junit.xml`에서 fail 1개라도 존재

### 3.3 2-Lane 검증(권장, 시간 최적화)
목표는 **개발 중 루프는 매우 짧게(Fast lane)**, **태스크 완료 판정은 느리더라도 확실하게(Slow lane)** 분리하는 것입니다.

- **Fast lane**: 5~20초 목표(권장)
  - DB 없이 가능한 검증으로 구성: lint / typecheck / unit tests / OpenAPI validate.
  - PR/로컬에서 자주 실행해 실수를 빠르게 포착.
  - Fast lane PASS는 태스크 완료 근거가 아니다. (`summary.json` PASS와 동일하지 않음)

- **Slow lane**: 30초~2분+ 통합 증거
  - 실행 시점: 태스크 완료 선언/PR 업데이트 직전에 1~2회만.
  - 구성: `compose up` + DB migrate/seed + API contract cases + 정리(cleanup).
  - 판정은 `/evidence/<piece>/<task>/summary.json`에서만 최종 확정.

태스크 완료/PR 갱신의 고정 기준:
- `pass=true` **그리고** `result="PASS"`.

도커/DB 시간 최적화(의존 제거 아님):
- 컨테이너 재사용(케이스별로 up/down 반복 지양)
- migrate/seed는 스키마/데이터 변경 시에만 실행(해시/마커 기반 스킵 허용)
- readiness는 `pg_isready` 또는 `psql -c 'select 1'`로 빠르게 판정
- 캐시 활용(필수 테스트 환경 격리 유지 범위 내에서)
- 케이스는 최소화(해피 + 오류 케이스 중심, 오버테스트 지양)

Playbook 정합성:
- 이 규칙은 Playbook의 `run.sh` 중심 실행 후, PR 생성 전에는 task 단위 `run.sh`를 통한 로컬 PASS 확인, 그리고 PR 후 필요 시 `scripts/run_evidence.sh`로 최종 정합성 확인하는 흐름과 정렬되어야 한다.

---

## 4. 최소 필수 테스트 세트(“빠짐 방지”)

### 4.1 엔드포인트별 최소 테스트(권장 기준)
각 OpenAPI operation마다 최소 2개:
- Happy-path 1개 (정상)
- Permission/Invalid 1개 (401/403/400 등)

### 4.2 크리티컬 도메인 테스트(필수)
- First-time setup: `GET /setup/status`, `POST /setup/admin`
- Invite-only: `POST /admin/invites`, `POST /auth/accept-invite`
- Upload: `POST /uploads` → chunk 업로드 → `POST /complete` → 다운로드 검증
- Reconciler: “stuck upload session” 정리 시나리오
- Volume: validate-path / migration / activate
- Range download: 206/416 케이스 최소 1개

---

## 5. CLI 기반 증거 제출 예시(요구하신 스타일)

> 예시는 “사람이 읽는 expected.md”에 들어갈 템플릿입니다.

### 예시 1) API(GET)
- API(GET): `/setup/status`  
- 기대: `setup_required == true` (DB가 빈 상태)  
- 검증 커맨드:
  - `curl -s http://localhost:8080/setup/status | jq '.setup_required'`
- 기대 출력:
  - `true`

### 예시 2) API(POST)
- API(POST): `/auth/login`
- 요청(axios 예시):
  - `axios.post('/auth/login', { username: 'admin', password: 'admin1234!' })`
- 기대:
  - status `200`
  - `.user.username == "admin"`
  - `.tokens.token_type == "Bearer"`

---

## 6. OpenClaw 작업 루프(필수 운영 규칙)
태스크 단위로 아래를 고정:

1) **SSOT 확인**: OpenAPI에 operation/스키마/에러가 정의되어 있는가?  
2) **테스트 케이스 작성(FAIL이 떠야 정상)**  
3) 구현  
4) 테스트 PASS  
5) `/evidence/...` 번들 생성  
6) `summary.json result=PASS` 후 태스크 닫음

---

## 7. 추천 도구(완주 확률↑)
- HTTP 검증: `curl`, `jq`
- 테스트 러너: Jest/Vitest(선택), JUnit 출력
- DB 검증: `psql -c ...`
- 파일 검증: `sha256sum`, `stat`, `find`
- OpenAPI 스키마 검증: (선택) OpenAPI validator, 스키마 기반 계약 테스트

> 핵심은 “도구”가 아니라 **기대값 대비 자동 FAIL**이 가능한 구조입니다.

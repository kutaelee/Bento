# NAS Self-Hosted DDD Spec (FINAL)

## OpenClaw Execution Rules (HARD)
- OpenClaw는 어떤 구현/리팩토링/테스트 작성 전 반드시 아래를 읽고 준수해야 합니다.
  1) `openapi/openapi.yaml` (SSOT)
  2) `.openclaw/skills/clean-code-enforcer/INSTRUCTIONS.md` (mandatory)
  3) `docs/NAS_OpenClaw_TDD_Addendum_FINAL.md` (검증 규칙)
  4) `docs/NAS_OpenClaw_Evidence_Playbook_FINAL.md` (태스크 진행 규칙)
- 위 규칙을 위반한 산출물은 **INVALID**이며, 재구현 대상입니다.

## UI Source of Truth (HARD)
- UI 참조 원천: `design/stitch/ko-kr_final/`
- 누락 체크: `design/stitch/ko-kr_final/inventory/`
- 기본 언어: ko-KR, en-US는 `design/stitch/ko-kr_final/en-us_preview/`에서만 프리뷰
- 페이지 구현은 `ui-kit_tokens/`의 토큰/컴포넌트를 우선 사용하고, 페이지는 조합(composition)만 수행합니다.


> 타겟: **1~5인 개인/가족용(Self-hosted) NAS 웹/앱**  
> 핵심 목표: “PC를 NAS로 띄워도 **사용자 체감 성능을 해치지 않게**”, 시스템이 **하드웨어/부하를 자동 감지해 백그라운드 작업을 스스로 조절**  
> UI: Stitch(외주) 산출물을 **ui-kit(토큰/컴포넌트)**로 흡수해 재사용 중심으로 구현

---

## 0. 문서 세트 / SSOT(단일 진실의 원천) 규칙

### 0.1 문서 파일 세트(이 프로젝트의 “정답”)
이 설계는 다음 3개의 문서 + 1개의 SSOT 파일이 **최종판**입니다.

- **(A) DDD 스펙 (본 문서)**  
  `docs/NAS_SelfHosted_DDD_Spec_FINAL.md`  
  - “무엇을 만들지(도메인/컨텍스트/정책/기본값)”의 기준 문서
  - **OpenClaw가 반드시 처음 읽는 문서**

- **(B) TDD/검증 표준**  
  `docs/NAS_OpenClaw_TDD_Addendum_FINAL.md`  
  - “어떻게 테스트로 증명할지(입/출력/기대값/증거 번들)”의 기준 문서

- **(C) 개발 로드맵/플레이북**  
  `docs/NAS_OpenClaw_Evidence_Playbook_FINAL.md`  
  - “어떤 순서로, 얼마나 잘게 쪼개서, 어떤 증거로 닫을지”의 기준 문서

- **(SSOT) 계약/상태머신/DB·인덱스**  
  `openapi/openapi.yaml`  
  - **API 계약(OpenAPI) + 상태머신 + DB/인덱스**를 한 파일에 넣은 SSOT  
  - 엔드포인트/스키마/상태 전이는 이 파일이 최종 결정권자

### 0.2 SSOT 우선순위(충돌 시 적용 규칙)
문서 간 내용이 충돌하면 아래 우선순위로 판단합니다.

1) `openapi/openapi.yaml` (API + 상태머신 + DB/인덱스)  
2) 본 DDD 스펙  
3) Playbook(로드맵)  
4) TDD Addendum(검증 규칙)

### 0.3 OpenClaw가 혼동하지 않게 하는 “참조 매트릭스”
| 개발하려는 것 | 참조 1 (필수) | 참조 2 | 참조 3 |
|---|---|---|---|
| API 추가/변경 | `openapi/openapi.yaml` | 본 문서(도메인 규칙) | Playbook(해당 태스크) |
| 도메인 로직 구현 | 본 문서 | `openapi/openapi.yaml`(입출력 계약) | TDD Addendum(테스트) |
| 테스트/증거 제출 | TDD Addendum | Playbook(태스크 증거요건) | `openapi/openapi.yaml`(기대값) |
| 개발 순서/피스 분해 | Playbook | 본 문서 | `openapi/openapi.yaml` |
| UI 구현(외주 디자인 반영) | Stitch 산출물(Figma) | `ui-kit` 규칙(본 문서) | Playbook(UI 피스) |

---

## 1. 제품 범위(스코프)와 비범위

### 1.1 범위(MVP → 확장)
- 웹 파일 탐색기(폴더/파일 리스트, breadcrumb, 검색)
- 업로드(대용량, 중단/재개, 멱등성)
- 다운로드(HTTP Range 지원)
- 썸네일(이미지/동영상 일부), 미디어 미리보기(선택)
- 휴지통(소프트 삭제, 보관기간, 정리)
- 공유 링크(만료/비밀번호)
- 권한(ACL, 상속)
- 저장소 볼륨(경로 설정/검증/마이그레이션/스캔 정리)
- 온보딩: 최초 관리자 1회 생성 + Invite-only 가입

### 1.2 비범위(최소 1.0에서는 제외)
- 실시간 공동편집
- 데스크톱 동기화 클라이언트(Drive/Dropbox급 sync)
- E2EE(종단간 암호화) 기본 탑재

---

## 2. 핵심 설계 원칙(완주 확률과 성능을 동시에)

### 2.1 “Interactive-first” QoS(자동 조절이 기본)
- 사용자 UI 동작(탐색/다운로드/검색)이 **항상 우선**
- 백그라운드 워커(썸네일/트랜스코딩/GC/마이그레이션)는
  - **CPU/IO/메모리/응답지연**을 관측해 자동으로 스로틀링
  - 장비 성능이 좋아지면(코어/램 증가) **자동으로 허용치 상향**
- 이 정책의 구체 값은 `openapi/openapi.yaml`의 `x-constants.qos`가 SSOT

### 2.2 계약 기반 개발(Contract-first)
- 엔드포인트/스키마/에러코드/상태전이는 **OpenAPI SSOT**로 고정
- 구현은 계약을 만족시키는 가장 단순한 형태부터 시작(TDD 루프)

### 2.3 셀프호스티드 현실 반영(정전/저사양/단일 디스크)
- 정전/강제 종료 시 **DB-파일 정합성 깨짐**을 전제로 설계
- 부팅 시 “Reconciler”가 찌꺼기 세션/임시 파일을 정리(SSOT 상태머신 규칙)
- HDD spin-up 지연을 고려해 다운로드/스트리밍은 넉넉한 타임아웃 적용

---

## 3. 아키텍처 개요(DDD Bounded Context)

### 3.1 컨텍스트 분리(추천)
- **Identity & Access Context**
  - 최초 관리자 생성, 로그인/리프레시, Invite-only, 사용자/권한
- **Storage Volume Context**
  - base_path 관리, 검증, 활성 볼륨, 마이그레이션, 스캔/정리
- **Drive Tree Context**
  - 노드(폴더/파일), 트리 탐색, 이동/복사, 휴지통
- **Upload Context**
  - 업로드 세션/청크, 멱등성, 머지, 정전복구
- **Sharing Context**
  - 공유 링크 생성/검증/다운로드
- **Media Context**
  - 썸네일/미리보기 파이프라인(QoS 우선)
- **Jobs Context**
  - 백그라운드 잡 상태/재시도/작업량 조절
- **Search Context**
  - Postgres 기반 검색(초기), 필요 시 외부 검색엔진 확장(옵션)

---

## 4. 국제화(i18n) 정책(명시적 값)
- 사이트 기본 언어: **한국어(ko-KR)**
- 설정에서 영어(en-US)만 추가 제공
- 사용자 선호 locale은 `User.locale` 및 `PATCH /me/preferences`로 관리
- API 에러 메시지는 `Accept-Language`(ko-KR/en-US) 기준으로 로컬라이즈(SSOT: OpenAPI)

---

## 5. 디렉토리 구조 SSOT(개발자가 흔들리지 않게)

> 아래는 **권장 레포 구조**이며, OpenClaw 태스크는 항상 “경로”를 명시해야 합니다.

```
/openapi/openapi.yaml                 # SSOT: API + 상태머신 + DB/인덱스
/docs/
  NAS_SelfHosted_DDD_Spec_FINAL.md    # 본 문서
  NAS_OpenClaw_TDD_Addendum_FINAL.md  # 테스트/증거 표준
  NAS_OpenClaw_Evidence_Playbook_FINAL.md # 로드맵/태스크/증거
/packages/
  api-server/                         # HTTP API
  domain/                             # 도메인 모델/서비스(DDD)
  workers/                            # BullMQ 등 워커
  ui/                                 # 웹 UI
  ui-kit/                             # 재사용 컴포넌트 + 토큰(Storybook 권장)
/tests/
  unit/
  integration/
  contract/                           # OpenAPI 기반 계약 테스트
/evidence/                            # 태스크별 증거 번들(Playbook 규칙)
/scripts/
  run_evidence.sh                     # 증거 자동 생성(권장)
```

---

## 6. 기본값(완주 확률↑ / 성능↑ / 저사양 안전)
**모든 기본값은 `openapi/openapi.yaml`의 `x-constants`가 SSOT**이며, 본 문서는 의미를 설명합니다.

### 6.1 업로드 기본값
- 청크 크기 기본: **8 MiB**
- 청크 병렬 업로드 기본: **2**
- 세션 TTL: **48시간**
- 파일 최대 크기 기본: **2 TiB**
- Dedup(CAS): `sha256` 제공 시 서버가 동일 blob 보유 여부를 확인해 **업로드 생략 가능**

### 6.2 휴지통/GC
- 보관기간 기본: **30일**
- 정리(GC) 정책:
  - 소프트 삭제 → Trash 노출
  - 보관기간 경과 → Hard delete + blob ref_count 기반 물리파일 삭제

### 6.3 공유 링크
- 기본 만료: **7일**
- 최대 만료: **365일**
- 비밀번호 최소 길이: **6**

### 6.4 인증(보안/성능 균형)
- Access token: 15분
- Refresh token: 14일, **회전(rotation)**
- 비밀번호 해시: Argon2id 기본(OWASP 권장 최소치 이상), 저사양이면 파라미터 튜닝 가능

---

## 7. 보안 설계(셀프호스티드라도 기본기 고정)
- 업로드 보안: Content-Type 신뢰 금지, 확장자 allowlist/denylist, 서버 생성 파일명, 경로 조합 시 traversal 방지
- 공유 링크: 토큰은 **DB에 해시로만 저장**, 노출은 생성 시 1회
- 권한: Deny-by-default, ACL 상속
- 다운로드: Range 지원 시 416 처리, 헤더/캐시 제어

---

## 8. 스키마/상태머신/인덱스: “문서가 아니라 SSOT”
- DB/인덱스/상태전이는 전부 `openapi/openapi.yaml`의
  - `x-db`
  - `x-state-machines`
  - `x-constants`
  를 참조합니다.
- 본 문서에서는 “왜 필요한지/어떻게 쓰는지”만 설명합니다.

---

## 9. UI 설계(외주 Stitch 반영 + 재사용 중심)
- UI는 외주(스티치/Figma) 산출물 기반
- 엔지니어링은 **ui-kit**(토큰/컴포넌트)로 흡수해 재사용
- 페이지는 조합만 수행(복붙 JSX 금지)
- 반드시 포함할 컴포넌트(우선순위 상):
  - TreeView(가상 스크롤)
  - DataTable(가상 스크롤)
  - Breadcrumb
  - UploadQueueDrawer
  - InspectorPanel(메타/공유/권한/활동)
  - CommandPalette(옵션)

---

## 10. “빠지는 항목 없이”를 보장하는 체크리스트(프로젝트 게이트)
아래 항목이 빠지면 설계가 “완성”이 아닙니다.

- [ ] OpenAPI 엔드포인트/스키마/에러코드가 SSOT에 존재  
- [ ] UploadSession 상태머신 + Reconciler 규칙이 SSOT에 존재  
- [ ] DB 테이블/인덱스/제약이 SSOT에 존재  
- [ ] 디렉토리 구조/증거 번들 구조가 문서에 명시  
- [ ] 기본값(청크, TTL, 보관기간, 언어 정책)이 SSOT에 명시  
- [ ] Invite-only 온보딩이 계약/테스트로 검증 가능  
- [ ] QoS 자동조절 정책이 수치로 명시(SSOT)  

> 위 체크리스트는 Playbook의 P0에서 “게이트 태스크”로 검증합니다.

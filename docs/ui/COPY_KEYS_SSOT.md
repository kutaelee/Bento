# COPY_KEYS_SSOT — Nimbus Drive Copy & i18n Keys (SSOT)

이 문서는 **UI 마이크로카피의 단일 진실 원천(SSOT)** 입니다.  
- 기본 언어: **ko-KR**
- 영어: **en-US** (설정에서 토글)
- 구현은 i18n 키를 사용하고, 문자열을 하드코딩하지 않습니다.

- P13부터 UI 구현이 시작되며, `docs/NAS_OpenClaw_Evidence_Playbook_P13_UI_Refactor.md`를 따른다. UI 문자열 하드코딩 금지/키 SSOT 준수는 기존 규칙 그대로.

---

## 0) 키 규칙

- 네임스페이스: `app`, `nav`, `action`, `field`, `msg`, `err`, `status`, `modal`, `admin`, `setup`
- 점 표기: `nav.files`, `action.upload`
- UI에서 직접 문자열을 쓰지 말고 키만 참조
- 신규 키는 반드시 여기와 `locales/ko-KR.json`, `locales/en-US.json`에 동시에 추가

---

## 1) App (app.*)

| key | ko-KR | en-US |
|---|---|---|
| app.brand | Nimbus Drive | Nimbus Drive |
| app.greeting | 안녕하세요, Nimbus Drive | Hello Nimbus Drive |

## 2) Navigation (nav.*)

| key | ko-KR | en-US |
|---|---|---|
| nav.files | 파일 | Files |
| nav.recent | 최근 | Recent |
| nav.favorites | 즐겨찾기 | Favorites |
| nav.shared | 공유됨 | Shared with me |
| nav.media | 미디어 | Media |
| nav.trash | 휴지통 | Trash |
| nav.settings | 관리자 설정 | Admin settings |

---

## 3) Common Actions (action.*)

| key | ko-KR | en-US |
|---|---|---|
| action.newFolder | 새 폴더 | New folder |
| action.upload | 업로드 | Upload |
| action.download | 다운로드 | Download |
| action.share | 공유 | Share |
| action.move | 이동 | Move |
| action.copy | 복사 | Copy |
| action.rename | 이름 변경 | Rename |
| action.delete | 삭제 | Delete |
| action.restore | 복원 | Restore |
| action.deleteForever | 영구 삭제 | Delete forever |
| action.retry | 재시도 | Retry |
| action.cancel | 취소 | Cancel |
| action.close | 닫기 | Close |
| action.save | 저장 | Save |
| action.createAdmin | 관리자 생성 | Create admin |
| action.apply | 적용 | Apply |
| action.signIn | 로그인 | Sign in |
| action.acceptInvite | 초대 수락 | Accept invite |
| action.loadMore | 더 불러오기 | Load more |
| action.refresh | 새로고침 | Refresh |
| action.validatePath | 경로 검증 | Validate path |
| action.createVolume | 볼륨 생성 | Create volume |
| action.activateVolume | 볼륨 활성화 | Activate volume |
| action.startMigration | 마이그레이션 시작 | Start migration |
| action.startScan | 스캔 시작 | Start scan |
| action.goBack | 뒤로 가기 | Go back |
| action.goHome | 홈으로 | Go to home |

---

## 4) Fields / Labels (field.*)

| key | ko-KR | en-US |
|---|---|---|
| field.search | 검색 | Search |
| field.name | 이름 | Name |
| field.modifiedAt | 수정일 | Modified |
| field.owner | 소유자 | Owner |
| field.size | 크기 | Size |
| field.permissions | 권한 | Permissions |
| field.username | 사용자명 | Username |
| setup.displayName | 표시 이름 | Display name |
| field.password | 비밀번호 | Password |
| field.displayName | 표시 이름 | Display name |
| field.email | 이메일 | Email |
| field.expiry | 만료일 | Expiry |
| field.path | 경로 | Path |
| field.destination | 대상 폴더 | Destination folder |
| field.freeSpace | 남은 용량 | Free space |
| field.totalSpace | 전체 용량 | Total space |
| field.status | 상태 | Status |
| field.active | 활성 | Active |
| field.fileSystem | 파일 시스템 | File system |
| field.targetVolumeId | 대상 볼륨 ID | Target volume ID |
| field.verifySha256 | SHA-256 검증 | Verify SHA-256 |
| field.deleteSourceAfter | 원본 삭제 | Delete source after |
| field.deleteOrphanFiles | 고아 파일 삭제 | Delete orphan files |
| field.deleteOrphanDbRows | 고아 DB 행 삭제 | Delete orphan DB rows |
| field.jobId | 작업 ID | Job ID |
| field.jobType | 작업 유형 | Job type |
| field.jobStatus | 작업 상태 | Job status |
| field.jobProgress | 진행률 | Progress |
| field.createdAt | 생성 시각 | Created at |
| field.startedAt | 시작 시각 | Started at |
| field.finishedAt | 완료 시각 | Finished at |

---

## 5) Status / Banners (status.*)

| key | ko-KR | en-US |
|---|---|---|
| status.readOnly | 읽기 전용 모드 | Read-only mode |
| status.migrating | 저장소 마이그레이션 진행 중 | Storage migration in progress |
| status.diskWaking | 디스크를 깨우는 중… | Waking up disk… |
| status.uploadPaused | 업로드 일시정지됨 | Upload paused |
| status.jobQueued | 대기 중 | Queued |
| status.jobRunning | 실행 중 | Running |
| status.jobDone | 완료 | Done |
| status.jobFailed | 실패 | Failed |
| status.jobCancelled | 취소됨 | Cancelled |
| status.jobTypeMigration | 마이그레이션 | Migration |
| status.jobTypeScanCleanup | 저장소 스캔 | Storage scan |
| status.ok | 정상 | OK |
| status.fail | 실패 | Failed |
| status.active | 활성 | Active |
| status.validation | 검증 | Validation |
| status.writable | 쓰기 가능 | Writable |
| status.volumeOk | 정상 | OK |
| status.volumeDegraded | 성능 저하 | Degraded |
| status.volumeOffline | 오프라인 | Offline |

---

## 6) Empty / Info Messages (msg.*)

| key | ko-KR | en-US |
|---|---|---|
| msg.emptyFolder | 이 폴더는 비어 있습니다. | This folder is empty. |
| msg.emptyRecent | 최근 항목이 없습니다. | No recent items. |
| msg.emptyFavorites | 즐겨찾기가 없습니다. | No favorites. |
| msg.emptyShared | 공유된 항목이 없습니다. | No shared items. |
| msg.emptySearch | 검색 결과가 없습니다. | No search results. |
| msg.emptyTrash | 휴지통이 비어 있습니다. | Trash is empty. |
| msg.emptyMedia | 미디어가 없습니다. | No media. |
| msg.loading | 불러오는 중… | Loading… |
| msg.forbiddenAdmin | 관리자만 접근할 수 있습니다. | Admin access only. |
| msg.dropToUpload | 여기에 파일을 끌어다 놓아 업로드하세요. | Drop files here to upload. |
| msg.changesSaved | 변경사항이 저장되었습니다. | Changes saved. |
| msg.loginTitle | 로그인 | Sign in |
| setup.title | 초기 설정 | Initial setup |
| setup.subtitle | 첫 번째 관리자 계정을 생성하세요. | Create the first admin account. |
| setup.loading | 설정 상태 확인 중… | Checking setup status… |
| msg.inviteAcceptTitle | 초대 수락 | Accept invite |
| msg.inviteAcceptSubtitle | 계정을 생성해 초대를 완료하세요. | Create your account to finish the invite. |
| msg.inviteMissingToken | 초대 토큰이 없습니다. | Missing invite token. |
| msg.inviteExpired | 초대 링크가 만료되었습니다. | Invite link has expired. |
| msg.detailsTitle | 상세 정보 | Details |
| msg.selectItem | 항목을 선택하면 상세 정보가 표시됩니다. | Select an item to see details. |
| msg.noActiveVolume | 활성 볼륨이 없습니다. | No active volume. |
| msg.emptyVolumes | 등록된 볼륨이 없습니다. | No volumes yet. |
| msg.volumeCreated | 볼륨이 생성되었습니다. | Volume created. |
| msg.volumeActivated | 볼륨이 활성화되었습니다. | Volume activated. |
| msg.selectedVolume | 선택된 볼륨 | Selected volume. |
| msg.noVolumeSelected | 선택된 볼륨이 없습니다. | No volume selected. |
| msg.noJobs | 표시할 작업이 없습니다. | No jobs to display. |

---

## 7) Error Messages (err.*)

| key | ko-KR | en-US |
|---|---|---|
| err.unauthorized | 로그인 후 이용해 주세요. | Please sign in. |
| err.forbidden | 접근 권한이 없습니다. | You don't have permission. |
| err.notFound | 항목을 찾을 수 없습니다. | Item not found. |
| err.conflict | 이름 충돌이 발생했습니다. | Name conflict occurred. |
| err.rateLimited | 요청이 너무 많습니다. 잠시 후 다시 시도하세요. | Too many requests. Try again later. |
| err.network | 네트워크 오류가 발생했습니다. | Network error occurred. |
| err.validation | 입력값을 확인해 주세요. | Please check your input. |
| err.server | 서버 오류가 발생했습니다. | Server error occurred. |
| err.unknown | 알 수 없는 오류가 발생했습니다. | Something went wrong. |

---

## 8) Modals (modal.*)

| key | ko-KR | en-US |
|---|---|---|
| modal.share.title | 공유 | Share |
| modal.share.link | 공유 링크 | Share link |
| modal.share.requirePassword | 비밀번호 필요 | Require password |
| modal.share.setExpiry | 만료일 설정 | Set expiry |
| modal.delete.title | 삭제 확인 | Confirm delete |
| modal.delete.desc | 이 항목을 삭제하시겠습니까? | Delete this item? |
| modal.move.title | 이동 | Move |
| modal.copy.title | 복사 | Copy |
| modal.rename.title | 이름 변경 | Rename |
| modal.invite.title | 사용자 초대 | Invite user |
| modal.storageValidate.title | 저장 경로 확인 | Validate storage path |
| modal.cleanup.title | 저장소 정리 | Storage cleanup |
| modal.migrationStart.title | 마이그레이션 시작 | Start migration |
| modal.errorDetails.title | 오류 상세 | Error details |

---

## 9) Admin (admin.*)

| key | ko-KR | en-US |
|---|---|---|
| admin.users.title | 사용자 및 초대 | Users & invites |
| admin.storage.title | 저장소 관리 | Storage |
| admin.storage.activeTitle | 활성 볼륨 | Active volume |
| admin.storage.listTitle | 볼륨 목록 | Volumes |
| admin.storage.createTitle | 볼륨 생성 | Create volume |
| admin.storage.activateTitle | 볼륨 활성화 | Activate volume |
| admin.migration.title | 마이그레이션 | Migration |
| admin.performance.title | 성능 / QoS | Performance / QoS |
| admin.jobs.title | 백그라운드 작업 | Background jobs |
| admin.audit.title | 활동 로그 | Activity log |
| admin.audit.event.actorAdminA | 관리자 A | Admin A |
| admin.audit.event.actorAdminB | 관리자 B | Admin B |
| admin.audit.event.actorSystem | 시스템 | System |
| admin.audit.event.actionLogin | 로그인 | Sign in |
| admin.audit.event.actionInviteCreated | 초대 생성 | Invite created |
| admin.audit.event.actionBackupDone | 백업 완료 | Backup completed |
| admin.audit.event.detailLoginSuccess | 정상 로그인 성공 | Successful sign-in |
| admin.audit.event.detailInviteIssued | 초대 링크 발급 | Issued invite link |
| admin.audit.event.detailBackgroundJobSuccess | 백그라운드 작업 성공 | Background job completed |
| admin.audit.event.time2m | 2분 전 | 2 minutes ago |
| admin.audit.event.time18m | 18분 전 | 18 minutes ago |
| admin.audit.event.time40m | 40분 전 | 40 minutes ago |
| admin.security.title | 보안 및 공유 정책 | Security & sharing |
| admin.appearance.title | 언어 및 외관 | Language & appearance |
| admin.home.card.users | 사용자 권한과 초대를 관리합니다. | Manage users, roles, and invites. |
| admin.home.card.storage | 볼륨과 저장소 상태를 관리합니다. | Manage volumes and storage health. |
| admin.home.card.performance | 성능 및 QoS 정책을 조정합니다. | Tune performance and QoS profiles. |
| admin.home.card.jobs | 백그라운드 작업 상태를 점검합니다. | Monitor background jobs and statuses. |
| admin.home.card.security | 공유 및 보안 정책을 검토합니다. | Review sharing and security policies. |
| admin.home.card.appearance | 언어와 테마 환경을 관리합니다. | Manage language and theme preferences. |
| admin.users.inviteAction | 사용자 초대 | Invite user |
| admin.users.clearAction | 초기화 | Clear |
| admin.users.createAction | 생성 | Create |
| admin.users.inviteDialogTitle | 사용자 초대 생성 | Create user invite |
| admin.users.inviteExpiryDays | 초대 만료일수 | Invite expiry days |
| admin.users.createdToken | 생성된 토큰 | Created token |
| admin.users.inviteToken | 초대 토큰 | Invite token |
| admin.users.invitedBy | 초대자 | Invited by |
| admin.users.invitedAt | 초대일 | Invited at |
| admin.users.tab.users | 사용자 목록 | Users |
| admin.users.tab.invites | 초대 목록 | Invites |
| admin.users.loadingDetail | 목록을 불러오는 중입니다. | Loading user list. |
| admin.users.emptyTitle | 항목이 없습니다 | No items found |
| admin.users.emptyDetail | 검색 조건을 바꿔보세요. | Try changing your search filters. |
| admin.users.status.inactive | 비활성 | Inactive |
| admin.users.status.pending | 대기 | Pending |
| admin.users.status.expired | 만료 | Expired |
| admin.jobs.runningSectionTitle | 실행중인 작업 목록 | Running jobs |
| admin.jobs.detailSectionTitle | 작업 상세 | Job details |
| admin.performance.saving | 저장 중 | Saving |

---

## 10) Notes
- 이 표는 최소 키 세트입니다. UI 구현 중 신규 문구가 필요하면:
  1) 키 추가
  2) ko/en 동시 채움
  3) 하드코딩 금지
- 긴 문장(설명/도움말)은 `msg.*`로 관리하고, 가능한 짧게 유지합니다.

끝.

# Invite Sandbox Access Slice

## Product target

- ICP: self-hosted Bento admins inviting internal teammates into a shared NAS workspace
- Core user problem: invited users can currently sign up without a bounded workspace, no direct invite-code entry exists, and session exit is unclear
- Target workflow:
  1. Admin issues invite code
  2. User enters code from login or invite screen
  3. Bento provisions the user's home folder inside the enabled workspace
  4. User sees only their sandbox home and folders explicitly shared to them
- Business outcome: Bento becomes usable as a governed multi-user NAS slice instead of a single-admin demo
- Why product capability: this is the minimum trust boundary for shared deployment, not a one-off UX fix

## Slice scope

- In scope
  - Manual invite-code entry from login and invite acceptance
  - Explicit logout affordance in user and admin shells
  - Automatic per-user sandbox home provisioning on invite accept
  - Non-admin read visibility bounded to own home plus explicitly shared folders
  - Non-admin media/search visibility aligned with the same access rule
- Non-goals
  - Full admin UI for ACL authoring
  - Group-based sharing
  - Per-user multi-volume assignment
  - Background migration of existing node ownership

## Success criteria

- User can enter an invite code without editing the URL manually
- User can log out from both normal and admin shells
- Newly invited user receives a default home directory automatically
- Non-admin root listing does not expose other users' folders
- Non-admin media and search do not leak files outside owned or shared paths

## Failure criteria

- Invite code still requires URL manipulation
- Non-admin root shows unrelated folders
- Media/search reveals files outside owned/shared scope
- Missing logout leaves stale session in browser

## Acceptance

- `POST /auth/accept-invite` provisions sandbox home
- `GET /nodes/root/children` for non-admin returns home plus directly shared nodes only
- `GET /media` and `GET /search` for non-admin are filtered by effective read access
- UI exposes invite-code input and logout entry points

## Evaluation method

- Local typecheck/build
- Invite creation and acceptance smoke test
- Non-admin root/media/search smoke test with a shared folder fixture
- Manual browser verification on login and admin shell logout

## Evidence artifacts

- This document
- Git commits for UI and backend changes
- Typecheck/build logs
- Runtime smoke results for invite accept, root listing, media, and search

## Rollout

1. Observe on dev server with admin + invited user accounts
2. Verify non-admin root/media/search bounds
3. Human QA on operating server
4. Limited rollout on current single operating instance

## Rollback

- Revert the invite sandbox commit range
- Restart `bento-api` and `bento-ui`
- Fallback behavior returns to owner-only root and URL-based invite accept

## Major risks

- ACL authoring UI is still missing, so shared-folder usability depends on existing API/manual setup
- Existing data seeded under the old root model may need cleanup if operators expect a different root shape
- Search filtering uses an access filter after query execution, so very large datasets may need a more SQL-native access path later

## Decision log

- Chose `global root + per-user home + ACL-filtered visibility` over mutating root ownership per user
- Chose manual invite-code entry in the current auth flow instead of a separate onboarding wizard

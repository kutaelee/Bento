# Maintainer Automation Plan

Bento is designed for small, reversible, evidence-backed maintenance. Codex is intended to reduce maintainer load while keeping the human maintainer responsible for final review and release decisions.

## Goals

- Help more people run private self-hosted storage safely.
- Keep file, ACL, share-link, upload, and storage-cleanup changes reviewable.
- Shorten the path from issue report to validated PR.
- Make releases easier to audit before users upgrade their own machines.

## Codex Workflows

### Pull Request Review

Codex should check PRs against:

- `openapi/openapi.yaml` contract changes;
- ACL and share-link security rules;
- upload idempotency and storage cleanup invariants;
- UI route and i18n key source-of-truth files;
- required evidence bundle structure.

### Issue Triage

Codex can help classify issues into:

- upload/download correctness;
- access control and sharing;
- storage scan, trash, migration, and data-safety behavior;
- UI routing, copy, and responsive layout;
- performance and background job QoS.

### Release Workflow

Codex should help prepare:

- changelog drafts from merged PRs;
- risk summaries for storage, auth, ACL, and migration changes;
- validation checklists;
- rollback notes and known limitations.

### Security Review

Codex is useful for first-pass review of:

- path traversal risks;
- token storage and one-time plaintext token handling;
- permission inheritance mistakes;
- destructive operations in trash, scan, cleanup, and migration;
- generated code that touches files, SQL, shell commands, or auth.

## Guardrails

- Codex output is advisory until reviewed by the maintainer.
- Contract changes must still start from the source-of-truth files.
- Evidence must be reproducible from the repository.
- Security and destructive storage behavior require conservative review.
- No private user files, credentials, or secrets should be pasted into prompts or issues.

# P7-T3 — Permanent delete (Hard delete + ref_count) (Expected)

## Goal
- `DELETE /trash/{node_id}` permanently deletes a node from trash.
- For file nodes, the referenced blob `ref_count` must be decremented.
- If `ref_count` reaches 0, the blob may be marked deleted and the physical file may be removed.

## Evidence
- A file is uploaded (creating `node_id`, `blob_id` with `ref_count=1`).
- Node is soft-deleted (moved to trash).
- Hard delete succeeds (200).
- DB shows:
  - node row removed
  - blob `ref_count` decremented to 0
  - blob `deleted_at` set (best-effort rule)
- Optional: physical blob file removed.

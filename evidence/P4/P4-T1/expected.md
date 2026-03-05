# P4-T1 — POST /nodes/folders

## Goal
Create a folder node under a parent node.

## SSOT
- OpenAPI: `paths./nodes/folders.post`
- Schema: `components.schemas.CreateFolderRequest`, `components.schemas.Node`

## Required Evidence
1) Happy path: create folder returns **201** and a **Node** payload.
2) Duplicate name under same parent returns **409**.

## Commands
- `bash evidence/P4/P4-T1/run.sh`

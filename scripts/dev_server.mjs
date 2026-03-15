#!/usr/bin/env node
/**
 * Minimal dev server for P0-T1 gate.
 * - Binds to 0.0.0.0:8080 (matches OpenAPI servers.url)
 * - Implements GET /health -> { ok: true }
 *
 * NOTE: This is a scaffold to support evidence-driven development.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { execPsql, quoteSqlLiteral } from '../src/db/pool.mjs';
import { errorResponse } from '../src/http/errors.mjs';
import {
  normalizeNodeName,
  normalizeUploadFilename,
  parseBooleanQueryParam,
  parseCreateUploadSizeBytes,
  parseCursorParam,
  parseLimitQueryParam,
  parseMimeType,
  parseModifiedAt,
  parseNodeChildrenOrder,
  parseNodeChildrenSort,
  parseSearchLimitQueryParam,
  parseSha256,
  readJsonBody,
} from '../src/http/request.mjs';
import { parseHttpRangeHeader, sendJson } from '../src/http/response.mjs';
import { parseAclRequestEntries, loadAclEntriesByNodeId, loadAclEntriesForPrincipal } from '../src/policy/acl.mjs';
import { hashInviteToken } from '../src/policy/share.mjs';
import { isValidUuid, uuidToLtreeLabel } from '../src/util/ids.mjs';
import { createQosController } from '../src/util/qos.mjs';

const port = Number(process.env.PORT || 8080);
const qosController = createQosController();

// Diagnostic: log DB name (masked) once at startup.
// IMPORTANT: do not block startup when DB container is absent (e.g., P0-T1).
try {
  const prevMax = process.env.EXEC_PSQL_MAX_ATTEMPTS;
  process.env.EXEC_PSQL_MAX_ATTEMPTS = '1';
  const dbName = String(execPsql('select current_database();')).trim();
  console.log(`[db] current_database=${dbName}`);
  if (prevMax === undefined) delete process.env.EXEC_PSQL_MAX_ATTEMPTS;
  else process.env.EXEC_PSQL_MAX_ATTEMPTS = prevMax;
} catch (err) {
  console.log(`[db] current_database=unavailable`);
}

const THUMBNAIL_PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const THUMBNAIL_PLACEHOLDER_PNG = Buffer.from(THUMBNAIL_PLACEHOLDER_PNG_BASE64, 'base64');
const thumbnailCache = new Map();

const jobStore = new Map();
const jobOrder = [];
const JOB_TYPES = new Set(['THUMBNAIL', 'TRANSCODE', 'MIGRATION', 'TRASH_GC', 'SCAN_CLEANUP', 'MOVE_TREE', 'VOLUME_AUTO_SCAN']);
const JOB_STATUSES = new Set(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']);
const volumeScanRuns = new Map();

function shouldAutoScanOnActivate() {
  const raw = String(process.env.BENTO_AUTO_SCAN_ON_ACTIVATE || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function registerJob(job) {
  jobStore.set(job.id, job);
  jobOrder.push(job.id);
  return job;
}

function setJobStatus(job, status, progress) {
  if (!JOB_STATUSES.has(status)) {
    return;
  }
  job.status = status;
  if (typeof progress === 'number') {
    job.progress = progress;
  }
  if (status === 'RUNNING' && !job.started_at) {
    job.started_at = new Date().toISOString();
  }
  if ((status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED') && !job.finished_at) {
    job.finished_at = new Date().toISOString();
  }
}

function scheduleMigrationJob(job) {
  setTimeout(() => {
    if (!jobStore.has(job.id)) return;
    setJobStatus(job, 'RUNNING', 0.2);
    setTimeout(() => {
      if (!jobStore.has(job.id)) return;
      job.result = { migrated: true };
      setJobStatus(job, 'SUCCEEDED', 1);
    }, 150);
  }, 20);
}

function createMigrationJob(payload) {
  const job = {
    id: crypto.randomUUID(),
    type: 'MIGRATION',
    status: 'QUEUED',
    progress: 0,
    payload,
    result: null,
    error: null,
    created_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
  };
  registerJob(job);
  scheduleMigrationJob(job);
  return job;
}

function normalizeStorageRelativePath(input) {
  const raw = String(input || '');
  return raw.split(path.sep).join(path.posix.sep);
}

function loadNodeByParentAndName(parentId, name) {
  const escapedParent = quoteSqlLiteral(parentId);
  const escapedName = String(name).replace(/'/g, "''");
  const rowJson = execPsql(
    "select row_to_json(n) from (" +
      "select id::text as id, type, name, parent_id::text as parent_id, path::text as path, " +
        "owner_user_id::text as owner_user_id, blob_id::text as blob_id, size_bytes, mime_type, metadata, " +
        "to_char(created_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at, " +
        "to_char(updated_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as updated_at, " +
        "to_char(deleted_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as deleted_at " +
      "from nodes where parent_id='" + escapedParent + "'::uuid and name='" + escapedName + "' and deleted_at is null limit 1" +
    ") n;"
  ).trim();
  if (!rowJson) return null;
  const node = JSON.parse(rowJson);
  if (node && node.deleted_at === null) delete node.deleted_at;
  return node;
}

function ensureScannedFolderNode({ parentNode, name, ownerUserId, volumeId, relativeDir }) {
  const existing = loadNodeByParentAndName(parentNode.id, name);
  if (existing) {
    if (existing.type !== 'FOLDER') {
      throw new Error(`Node type conflict at ${relativeDir || name}`);
    }
    return existing;
  }
  return createFolderNode({
    parent: parentNode,
    name,
    owner_user_id: ownerUserId,
  });
}

function upsertScannedBlob({ volumeId, storageKey, stat, dryRun }) {
  const escapedVolumeId = quoteSqlLiteral(volumeId);
  const escapedStorageKey = quoteSqlLiteral(storageKey);
  const pseudoSha = crypto
    .createHash('sha256')
    .update(`${volumeId}:${storageKey}:${Number(stat.size || 0)}:${Number(stat.mtimeMs || 0)}`)
    .digest('hex');
  if (dryRun) {
    return {
      blob: {
        id: `dryrun-blob-${pseudoSha.slice(0, 16)}`,
        volume_id: volumeId,
        storage_key: storageKey,
        sha256: pseudoSha,
        size_bytes: Number(stat.size || 0),
        content_type: null,
        ref_count: 1,
        base_path: '',
      },
      changed: true,
    };
  }

  const existingJson = execPsql(
    "select row_to_json(b) from (" +
      "select id::text as id, volume_id::text as volume_id, storage_key, sha256::text as sha256, " +
        "size_bytes, content_type, ref_count, ''::text as base_path " +
      "from blobs where volume_id='" + escapedVolumeId + "'::uuid and storage_key='" + escapedStorageKey + "' and deleted_at is null limit 1" +
    ") b;"
  ).trim();
  if (existingJson) {
    const existing = JSON.parse(existingJson);
    if (String(existing.sha256) === pseudoSha && Number(existing.size_bytes || 0) === Number(stat.size || 0)) {
      return { blob: existing, changed: false };
    }
  }

  execPsql(
    "insert into blobs (id, volume_id, storage_key, sha256, size_bytes, content_type, ref_count, created_at, deleted_at) values (" +
      "gen_random_uuid(), '" + escapedVolumeId + "'::uuid, '" + escapedStorageKey + "', '" + pseudoSha + "'::char(64), " + Number(stat.size || 0) + ", NULL, 1, now(), NULL" +
    ") on conflict (volume_id, storage_key) do update set " +
      "size_bytes=excluded.size_bytes, sha256=excluded.sha256, content_type=excluded.content_type, deleted_at=NULL;"
  );

  const rowJson = execPsql(
    "select row_to_json(b) from (" +
      "select id::text as id, volume_id::text as volume_id, storage_key, sha256::text as sha256, " +
        "size_bytes, content_type, ref_count, ''::text as base_path " +
      "from blobs where volume_id='" + escapedVolumeId + "'::uuid and storage_key='" + escapedStorageKey + "' and deleted_at is null limit 1" +
    ") b;"
  ).trim();

  if (!rowJson) {
    throw new Error(`Failed to load blob row for ${storageKey}`);
  }
  return { blob: JSON.parse(rowJson), changed: true };
}

function upsertScannedFileNode({ parentNode, fileName, ownerUserId, blobId, stat, dryRun }) {
  const existing = loadNodeByParentAndName(parentNode.id, fileName);
  if (dryRun) {
    return {
      node: {
        id: existing ? existing.id : `dryrun-node-${parentNode.id}-${fileName}`,
        type: 'FILE',
        name: fileName,
        parent_id: parentNode.id,
        owner_user_id: ownerUserId,
        blob_id: blobId,
        size_bytes: Number(stat.size || 0),
      },
      changed: true,
    };
  }

  if (existing) {
    if (existing.type !== 'FILE') {
      throw new Error(`Node type conflict for file ${fileName}`);
    }
    if (String(existing.blob_id || '') === String(blobId) && Number(existing.size_bytes || 0) === Number(stat.size || 0)) {
      return { node: existing, changed: false };
    }
    execPsql(
      "update nodes set blob_id='" + quoteSqlLiteral(blobId) + "'::uuid, size_bytes=" + Number(stat.size || 0) + ", mime_type=NULL, updated_at=now(), deleted_at=NULL " +
      "where id='" + quoteSqlLiteral(existing.id) + "'::uuid;"
    );
    const reloaded = loadNodeById(existing.id);
    if (!reloaded) {
      throw new Error(`Failed to load updated node for ${fileName}`);
    }
    return { node: reloaded, changed: true };
  }

  const created = createFileNode({
    parent: parentNode,
    name: fileName,
    owner_user_id: ownerUserId,
    blob_id: blobId,
    size_bytes: Number(stat.size || 0),
    mime_type: null,
  });
  return { node: created, changed: true };
}

function updateVolumeScanState({ volumeId, state, jobId = null, progress = null, errorMessage = null }) {
  const escapedState = quoteSqlLiteral(state);
  const escapedJobId = jobId ? quoteSqlLiteral(jobId) : null;
  const escapedError = errorMessage ? quoteSqlLiteral(String(errorMessage).slice(0, 2000)) : null;
  execPsql(
    "update volumes set " +
      "scan_state='" + escapedState + "', " +
      "scan_job_id=" + (escapedJobId ? "'" + escapedJobId + "'::uuid" : 'NULL') + ", " +
      "scan_progress=" + (progress === null || progress === undefined ? 'NULL' : String(progress)) + ", " +
      "scan_error=" + (escapedError ? "'" + escapedError + "'" : 'NULL') + ", " +
      "scan_updated_at=now() " +
    "where id='" + quoteSqlLiteral(volumeId) + "'::uuid;"
  );
}

function listScannedVolumeArtifacts(volumeId) {
  const escapedVolumeId = quoteSqlLiteral(volumeId);
  const rowsJson = execPsql(
    "select coalesce(json_agg(row_to_json(x)), '[]'::json) from (" +
      "select b.id::text as blob_id, b.storage_key, n.id::text as node_id " +
      "from blobs b left join nodes n on n.blob_id=b.id and n.deleted_at is null " +
      "where b.volume_id='" + escapedVolumeId + "'::uuid and b.deleted_at is null" +
    ") x;"
  ).trim();
  return rowsJson ? JSON.parse(rowsJson) : [];
}

function cleanupMissingScannedArtifacts({ volumeId, seenStorageKeys, dryRun }) {
  const artifacts = listScannedVolumeArtifacts(volumeId);
  const missing = artifacts.filter((row) => !seenStorageKeys.has(String(row.storage_key)));
  if (!dryRun) {
    for (const row of missing) {
      if (row.node_id) {
        execPsql(
          "update nodes set deleted_at=now(), updated_at=now() where id='" + quoteSqlLiteral(row.node_id) + "'::uuid and deleted_at is null;"
        );
      }
      execPsql(
        "update blobs set deleted_at=now() where id='" + quoteSqlLiteral(row.blob_id) + "'::uuid and deleted_at is null;"
      );
    }
  }
  return {
    removed_nodes: missing.filter((row) => Boolean(row.node_id)).length,
    removed_blobs: missing.length,
  };
}

function listFilesRecursive(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function loadBlobRowsByVolume(volumeId) {
  const escaped = quoteSqlLiteral(volumeId);
  const rowsJson = execPsql(
    "select coalesce(json_agg(row_to_json(b)), '[]'::json) from (" +
      "select id::text as id, storage_key from blobs where volume_id='" + escaped + "'::uuid and deleted_at is null" +
    ") b;"
  ).trim();
  return rowsJson ? JSON.parse(rowsJson) : [];
}

function scanCleanupVolume({ volume_id, delete_orphan_files, delete_orphan_db_rows }) {
  const volume = loadVolumeById(volume_id);
  if (!volume) {
    throw new Error('volume not found');
  }

  const basePath = path.resolve(String(volume.base_path));
  if (!fs.existsSync(basePath)) {
    throw new Error('volume base path not found');
  }
  const blobRows = loadBlobRowsByVolume(volume.id);
  const storageKeySet = new Set(blobRows.map((row) => row.storage_key));

  const orphanDbRows = [];
  for (const row of blobRows) {
    const blobPath = path.resolve(basePath, String(row.storage_key));
    const basePrefix = basePath.endsWith(path.sep) ? basePath : basePath + path.sep;
    if (blobPath !== basePath && !blobPath.startsWith(basePrefix)) {
      continue;
    }
    if (!fs.existsSync(blobPath)) {
      orphanDbRows.push({ id: row.id, storage_key: row.storage_key });
    }
  }

  const diskFiles = listFilesRecursive(basePath);
  const orphanFiles = [];
  for (const filePath of diskFiles) {
    const relative = path.relative(basePath, filePath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      continue;
    }
    const storageKey = relative.split(path.sep).join(path.posix.sep);
    if (!storageKeySet.has(storageKey)) {
      orphanFiles.push(storageKey);
    }
  }

  let deletedFiles = 0;
  if (delete_orphan_files) {
    for (const storageKey of orphanFiles) {
      const target = path.resolve(basePath, storageKey);
      const basePrefix = basePath.endsWith(path.sep) ? basePath : basePath + path.sep;
      if (target !== basePath && !target.startsWith(basePrefix)) {
        continue;
      }
      if (fs.existsSync(target)) {
        fs.rmSync(target, { force: true });
        deletedFiles += 1;
      }
    }
  }

  let deletedDbRows = 0;
  if (delete_orphan_db_rows) {
    for (const row of orphanDbRows) {
      execPsql(
        "update blobs set deleted_at=now() where id='" + quoteSqlLiteral(row.id) + "'::uuid and deleted_at is null;"
      );
      deletedDbRows += 1;
    }
  }

  return {
    volume_id: volume.id,
    orphan_files: orphanFiles,
    orphan_db_rows: orphanDbRows,
    deleted_files: deletedFiles,
    deleted_db_rows: deletedDbRows,
    scanned_at: new Date().toISOString(),
  };
}

function scheduleScanCleanupJob(job) {
  setTimeout(() => {
    if (!jobStore.has(job.id)) return;
    setJobStatus(job, 'RUNNING', 0.2);
    setTimeout(() => {
      if (!jobStore.has(job.id)) return;
      try {
        job.result = scanCleanupVolume(job.payload);
        setJobStatus(job, 'SUCCEEDED', 1);
      } catch (err) {
        job.error = { message: String(err && err.message ? err.message : err) };
        setJobStatus(job, 'FAILED', 1);
      }
    }, 120);
  }, 20);
}

function createScanCleanupJob(payload) {
  const job = {
    id: crypto.randomUUID(),
    type: 'SCAN_CLEANUP',
    status: 'QUEUED',
    progress: 0,
    payload,
    result: null,
    error: null,
    created_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
  };
  registerJob(job);
  scheduleScanCleanupJob(job);
  return job;
}

function runVolumeAutoScanBatch(runState) {
  const { job, volumeId, ownerUserId, basePath, dryRun } = runState;
  if (!jobStore.has(job.id)) {
    volumeScanRuns.delete(volumeId);
    return;
  }

  if (job.status === 'QUEUED') {
    setJobStatus(job, 'RUNNING', 0.01);
    try {
      updateVolumeScanState({ volumeId, state: 'running', jobId: job.id, progress: 0.01 });
    } catch {
      // do not fail job only because metadata update failed
    }
  }

  if (Date.now() > runState.deadlineAtMs) {
    handleVolumeAutoScanFailure(runState, new Error('volume auto-scan timed out'));
    return;
  }

  const MAX_BATCH_DIRS = 24;
  let processedDirs = 0;

  while (runState.pendingDirs.length > 0 && processedDirs < MAX_BATCH_DIRS) {
    const current = runState.pendingDirs.shift();
    if (!current) break;
    processedDirs += 1;

    const absoluteDir = path.resolve(basePath, current.relativeDir);
    const basePrefix = basePath.endsWith(path.sep) ? basePath : `${basePath}${path.sep}`;
    if (absoluteDir !== basePath && !absoluteDir.startsWith(basePrefix)) {
      continue;
    }

    let entries;
    try {
      entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    } catch (err) {
      runState.warnings.push({
        path: current.relativeDir,
        code: String(err && err.code ? err.code : 'UNKNOWN'),
        message: String(err && err.message ? err.message : err),
      });
      continue;
    }

    for (const entry of entries) {
      const childRelative = current.relativeDir
        ? path.posix.join(current.relativeDir, entry.name)
        : entry.name;
      if (entry.isSymbolicLink()) {
        runState.warnings.push({
          path: childRelative,
          code: 'SYMLINK_SKIPPED',
          message: 'Symbolic link skipped',
        });
        continue;
      }

      if (entry.isDirectory()) {
        try {
          const folderNode = ensureScannedFolderNode({
            parentNode: current.parentNode,
            name: entry.name,
            ownerUserId,
            volumeId,
            relativeDir: childRelative,
          });
          runState.pendingDirs.push({
            relativeDir: childRelative,
            parentNode: folderNode,
          });
          runState.scannedDirs += 1;
        } catch (err) {
          runState.warnings.push({
            path: childRelative,
            code: 'FOLDER_UPSERT_FAILED',
            message: String(err && err.message ? err.message : err),
          });
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const absoluteFile = path.resolve(basePath, childRelative);
      let st;
      try {
        st = fs.statSync(absoluteFile);
      } catch (err) {
        runState.warnings.push({
          path: childRelative,
          code: String(err && err.code ? err.code : 'STAT_FAILED'),
          message: String(err && err.message ? err.message : err),
        });
        continue;
      }

      const storageKey = normalizeStorageRelativePath(childRelative);
      runState.seenStorageKeys.add(storageKey);
      runState.scannedFiles += 1;

      try {
        const blobResult = upsertScannedBlob({
          volumeId,
          storageKey,
          stat: st,
          dryRun,
        });
        const fileResult = upsertScannedFileNode({
          parentNode: current.parentNode,
          fileName: entry.name,
          ownerUserId,
          blobId: blobResult.blob.id,
          stat: st,
          dryRun,
        });
        if (blobResult.changed || fileResult.changed) {
          runState.changedFiles += 1;
        } else {
          runState.unchangedFiles += 1;
        }
      } catch (err) {
        runState.warnings.push({
          path: childRelative,
          code: 'FILE_UPSERT_FAILED',
          message: String(err && err.message ? err.message : err),
        });
      }
    }
  }

  const processedUnits = runState.scannedDirs + runState.scannedFiles;
  const remainingUnits = runState.pendingDirs.length;
  const progress = Math.min(0.95, processedUnits / Math.max(1, processedUnits + remainingUnits));
  setJobStatus(job, 'RUNNING', progress);
  try {
    updateVolumeScanState({ volumeId, state: 'running', jobId: job.id, progress });
  } catch {
    // ignore volume state update failure for scan continuity
  }

  if (runState.pendingDirs.length > 0) {
    scheduleVolumeAutoScanBatch(runState, 0);
    return;
  }

  const cleanup = cleanupMissingScannedArtifacts({
    volumeId,
    seenStorageKeys: runState.seenStorageKeys,
    dryRun,
  });
  job.result = {
    volume_id: volumeId,
    dry_run: dryRun,
    scanned_directories: runState.scannedDirs,
    scanned_files: runState.scannedFiles,
    changed_files: runState.changedFiles,
    unchanged_files: runState.unchangedFiles,
    skipped_or_failed: runState.warnings.length,
    removed_nodes: cleanup.removed_nodes,
    removed_blobs: cleanup.removed_blobs,
    warnings: runState.warnings,
    scanned_at: new Date().toISOString(),
  };
  setJobStatus(job, 'SUCCEEDED', 1);
  volumeScanRuns.delete(volumeId);
  try {
    updateVolumeScanState({ volumeId, state: 'succeeded', jobId: job.id, progress: 1, errorMessage: null });
  } catch {
    // ignore volume state update failure for successful completion
  }
}

function handleVolumeAutoScanFailure(runState, err) {
  const { job, volumeId } = runState;
  job.error = { message: String(err && err.message ? err.message : err) };
  setJobStatus(job, 'FAILED', 1);
  volumeScanRuns.delete(volumeId);
  try {
    updateVolumeScanState({ volumeId, state: 'failed', jobId: job.id, progress: 1, errorMessage: job.error.message });
  } catch {
    // ignore scan metadata update failure
  }
}

function scheduleVolumeAutoScanBatch(runState, delayMs) {
  setTimeout(() => {
    try {
      runVolumeAutoScanBatch(runState);
    } catch (err) {
      handleVolumeAutoScanFailure(runState, err);
    }
  }, delayMs);
}

function createOrReuseVolumeAutoScanJob({ volumeId, ownerUserId, dryRun, trigger }) {
  const currentRun = volumeScanRuns.get(volumeId);
  if (currentRun && jobStore.has(currentRun.job.id) && (currentRun.job.status === 'QUEUED' || currentRun.job.status === 'RUNNING')) {
    return currentRun.job;
  }

  const volume = loadVolumeById(volumeId);
  if (!volume) {
    throw new Error('Volume not found');
  }
  const basePath = path.resolve(String(volume.base_path));
  if (!fs.existsSync(basePath)) {
    throw new Error('volume base path not found');
  }
  if (!fs.statSync(basePath).isDirectory()) {
    throw new Error('volume base path must be a directory');
  }

  const root = ensureRootFolderForUser(ownerUserId);
  if (!root) {
    throw new Error('Root folder not available for scan owner');
  }

  const job = {
    id: crypto.randomUUID(),
    type: 'VOLUME_AUTO_SCAN',
    status: 'QUEUED',
    progress: 0,
    payload: {
      volume_id: volumeId,
      dry_run: Boolean(dryRun),
      trigger: trigger || 'manual',
      owner_user_id: ownerUserId,
    },
    result: null,
    error: null,
    created_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
  };
  registerJob(job);

  const runState = {
    job,
    volumeId,
    ownerUserId,
    basePath,
    dryRun: Boolean(dryRun),
    startedAtMs: Date.now(),
    deadlineAtMs: Date.now() + 5 * 60 * 1000,
    pendingDirs: [{ relativeDir: '', parentNode: root }],
    seenStorageKeys: new Set(),
    scannedDirs: 0,
    scannedFiles: 0,
    changedFiles: 0,
    unchangedFiles: 0,
    warnings: [],
  };
  volumeScanRuns.set(volumeId, runState);

  try {
    updateVolumeScanState({ volumeId, state: 'queued', jobId: job.id, progress: 0 });
  } catch {
    // ignore metadata update failure at enqueue time
  }

  scheduleVolumeAutoScanBatch(runState, 20);

  return job;
}

function listJobs({ type, status, cursor, limit }) {
  const offset = cursor;
  const queryLimit = limit + 1;
  const filtered = jobOrder
    .map((id) => jobStore.get(id))
    .filter(Boolean)
    .filter((job) => (type ? job.type === type : true))
    .filter((job) => (status ? job.status === status : true));

  const page = filtered.slice(offset, offset + queryLimit);
  const hasMore = page.length > limit;
  const items = hasMore ? page.slice(0, limit) : page;

  return {
    items,
    next_cursor: hasMore ? String(offset + limit) : null,
  };
}

function selectThumbnailContentType(acceptHeader) {
  if (typeof acceptHeader === 'string' && acceptHeader.includes('image/svg+xml')) {
    return 'image/svg+xml';
  }
  if (typeof acceptHeader === 'string' && acceptHeader.includes('image/png')) {
    return 'image/png';
  }
  return 'image/png';
}

function inferMediaKind(node) {
  const mimeType = String(node?.mime_type || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';

  const extension = String(node?.name || '').split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif', 'avif'].includes(extension)) {
    return 'image';
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(extension)) {
    return 'video';
  }
  return 'file';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildThumbnailSvg(node, mediaKind) {
  const label = mediaKind === 'video' ? 'VIDEO' : mediaKind === 'image' ? 'IMAGE' : 'FILE';
  const accent = mediaKind === 'video' ? '#38BDF8' : mediaKind === 'image' ? '#4ADE80' : '#8B949E';
  const safeName = escapeHtml(String(node?.name || 'Untitled'));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="${safeName}">
      <rect width="640" height="360" rx="28" fill="#111827"/>
      <rect x="24" y="24" width="592" height="312" rx="22" fill="#1F2937" stroke="#30363D" stroke-width="2"/>
      <circle cx="112" cy="112" r="42" fill="${accent}" fill-opacity="0.18" />
      <path d="M102 88h20l18 24-18 24h-20l18-24-18-24z" fill="${accent}" />
      <text x="180" y="108" fill="#F0F6FC" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${label}</text>
      <text x="180" y="146" fill="#8B949E" font-size="18" font-family="Segoe UI, Arial, sans-serif">${safeName.slice(0, 44)}</text>
      <text x="180" y="182" fill="#6B7280" font-size="14" font-family="Segoe UI, Arial, sans-serif">Bento media preview</text>
    </svg>`,
    'utf8',
  );
}

function buildThumbnailJob(nodeId) {
  return {
    id: crypto.randomUUID(),
    type: 'THUMBNAIL',
    status: 'QUEUED',
    created_at: new Date().toISOString(),
    payload: { node_id: nodeId },
    started_at: null,
    finished_at: null,
  };
}

function ensureThumbnailEntry(node, acceptHeader) {
  const existing = thumbnailCache.get(node.id);
  if (existing) {
    return { fresh: false, entry: existing };
  }

  const mediaKind = inferMediaKind(node);
  let entry;

  if (mediaKind === 'image' && node.blob_id) {
    const blob = loadBlobById(node.blob_id);
    if (blob) {
      const filePathResult = resolveBlobAbsolutePath(blob);
      if (filePathResult.ok && fs.existsSync(filePathResult.value)) {
        const stat = fs.statSync(filePathResult.value);
        entry = {
          contentType: blob.content_type || node.mime_type || 'image/jpeg',
          filePath: filePathResult.value,
          contentLength: stat.size,
        };
      }
    }
  }

  if (!entry) {
    const contentType = mediaKind === 'video' ? 'image/svg+xml' : selectThumbnailContentType(acceptHeader);
    entry = {
      contentType,
      buffer: mediaKind === 'video'
        ? buildThumbnailSvg(node, mediaKind)
        : THUMBNAIL_PLACEHOLDER_PNG,
      job: buildThumbnailJob(node.id),
    };
  }

  thumbnailCache.set(node.id, entry);
  return { fresh: true, entry };
}

function getUsersCount() {
  // Query the running postgres container to derive setup_required from DB state.
  // Requires docker + nimbus-postgres container.
  const output = execPsql('select count(*) from users;');
  const count = Number(String(output).trim());
  if (Number.isNaN(count)) {
    throw new Error('users count is NaN');
  }
  return count;
}

function loadSystemMode() {
  // SSOT: SystemMode is stored under x-db.tables.system_settings key=READ_ONLY_MODE.
  // When missing (or system_settings is absent), default is read_only=false.
  let row;
  try {
    // Return a single JSON payload to avoid delimiter parsing bugs (reason may contain '|').
    row = execPsql(
      "select json_build_object(\n" +
        "  'value', value,\n" +
        "  'updated_at', to_char(updated_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')\n" +
        ")::text\n" +
        "from system_settings where key='READ_ONLY_MODE' limit 1;"
    ).trim();
  } catch (err) {
    // If the table doesn't exist (e.g., already-initialized DB without re-running init scripts),
    // do NOT hard-fail all mutating endpoints. Treat as read_only=false.
    console.warn(
      '[system-mode] load failed; defaulting to read_only=false:',
      String(err && err.message ? err.message : err)
    );
    return { read_only: false };
  }

  if (!row) {
    return { read_only: false };
  }

  let payload;
  try {
    payload = JSON.parse(row);
  } catch {
    return { read_only: false };
  }

  const value = payload && typeof payload.value === 'object' && payload.value ? payload.value : {};
  const readOnly = typeof value.read_only === 'boolean' ? value.read_only : false;
  const mode = { read_only: readOnly };
  if (typeof value.reason === 'string') {
    mode.reason = value.reason;
  }
  if (payload && typeof payload.updated_at === 'string' && payload.updated_at.length > 0) {
    mode.updated_at = payload.updated_at;
  }
  return mode;
}

function saveSystemMode(input) {
  const readOnly = Boolean(input.read_only);
  const payload = { read_only: readOnly };
  if (typeof input.reason === 'string' && input.reason.length > 0) {
    payload.reason = input.reason;
  }

  const jsonText = JSON.stringify(payload).replace(/'/g, "''");

  const row = execPsql(
    "insert into system_settings (key, value, updated_at) values (" +
      "'READ_ONLY_MODE', '" + jsonText + "'::jsonb, now()) " +
    "on conflict (key) do update set value=excluded.value, updated_at=now() " +
    "returning value::text, to_char(updated_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"');"
  ).trim();

  const first = row
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)[0];
  const [valueText, updatedAt] = String(first || '').split('|').map((s) => s.trim());

  let value;
  try {
    value = JSON.parse(valueText || '{}');
  } catch {
    value = {};
  }

  const out = { read_only: typeof value.read_only === 'boolean' ? value.read_only : readOnly };
  if (typeof value.reason === 'string') {
    out.reason = value.reason;
  }
  if (updatedAt) {
    out.updated_at = updatedAt;
  }
  return out;
}


const UPLOAD_STUCK_THRESHOLD_MINUTES = 30; // SSOT: x-state-machines.UploadSession.startup_reconciler

function cleanupUploadSession(uploadId, tempDir, nextStatus) {
  const escapedId = quoteSqlLiteral(uploadId);
  try {
    execPsql(
      "begin;" +
        "update upload_sessions set status='" + String(nextStatus) + "', received_chunks='{}', updated_at=now() " +
        "where id='" + escapedId + "'::uuid;" +
        "delete from upload_chunks where upload_id='" + escapedId + "'::uuid;" +
      "commit;"
    );
  } catch (err) {
    try { execPsql('rollback;'); } catch (_) {}
    throw err;
  }

  if (tempDir && String(tempDir).length > 0) {
    try {
      fs.rmSync(String(tempDir), { recursive: true, force: true });
    } catch (_) {}
  }
}

function runUploadStartupReconciler() {
  try {
    const staleJson = execPsql(
      "select coalesce(json_agg(row_to_json(t)), '[]'::json) from (" +
        "select id::text as id, temp_dir from upload_sessions " +
        "where status in ('UPLOADING','MERGING') and updated_at < now() - interval '" + Number(UPLOAD_STUCK_THRESHOLD_MINUTES) + " minutes'" +
      ") t;"
    ).trim();

    const staleSessions = staleJson ? JSON.parse(staleJson) : [];
    for (const session of staleSessions) {
      cleanupUploadSession(session.id, session.temp_dir, 'FAILED');
    }

    const expiredJson = execPsql(
      "select coalesce(json_agg(row_to_json(t)), '[]'::json) from (" +
        "select id::text as id, temp_dir from upload_sessions " +
        "where status='INIT' and created_at < now() - interval '" + Number(UPLOAD_SESSION_TTL_SECONDS) + " seconds'" +
      ") t;"
    ).trim();

    const expiredSessions = expiredJson ? JSON.parse(expiredJson) : [];
    for (const session of expiredSessions) {
      cleanupUploadSession(session.id, session.temp_dir, 'ABORTED');
    }
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    // In evidence runs, DB may be torn down between tasks; startup reconciler must be best-effort.
    if (
      msg.includes('No such container: nimbus-postgres') ||
      msg.includes('relation \"upload_sessions\" does not exist') ||
      msg.includes('database system is shutting down') ||
      msg.includes('connection to server on socket')
    ) {
      // Keep logs compact/stable in CI: avoid dumping full child-process stderr.
      let reason = 'transient-db-unavailable';
      if (msg.includes('No such container: nimbus-postgres')) reason = 'postgres-container-missing';
      else if (msg.includes('relation "upload_sessions" does not exist')) reason = 'upload-sessions-table-missing';
      else if (msg.includes('database system is shutting down')) reason = 'postgres-shutting-down';
      else if (msg.includes('connection to server on socket')) reason = 'postgres-socket-unavailable';
      console.warn('[startup-reconciler] skipped:', reason);
      return;
    }
    console.warn('[startup-reconciler] failed:', msg);
  }
}
function isMutatingMethod(method) {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function isReadOnlyExemptPath(url) {
  // SSOT: "READ_ONLY blocks all mutating endpoints ... except admin-only toggles and safe operations."
  // Allow toggling while already in read-only.
  if (url === '/admin/system-mode') return true;

  // Operational safety: allow auth endpoints even while read-only, otherwise admins can get locked out
  // (can't login/refresh to turn read-only back off).
  if (url.startsWith('/auth/')) return true;

  return false;
}

function hasSiblingNameConflict(parentId, name, excludeNodeId = null) {
  const escapedParentId = quoteSqlLiteral(parentId);
  const escapedName = String(name).replace(/'/g, "''");
  const exclusion = excludeNodeId
    ? " and id <> '" + quoteSqlLiteral(excludeNodeId) + "'::uuid"
    : '';
  const countText = execPsql(
    "select count(*)::bigint from nodes where parent_id='" + escapedParentId + "'::uuid and name='" + escapedName + "' and deleted_at is null" + exclusion + ";"
  ).trim();
  const count = Number(countText || 0);
  return Number.isFinite(count) && count > 0;
}

function ensureUniqueInParent(parentId, name, excludeNodeId = null) {
  return !hasSiblingNameConflict(parentId, name, excludeNodeId);
}

function splitFilenameParts(name) {
  const input = String(name || '').trim();
  const lastDot = input.lastIndexOf('.');
  if (lastDot <= 0) {
    return { stem: input, ext: '' };
  }
  return {
    stem: input.slice(0, lastDot),
    ext: input.slice(lastDot),
  };
}

function resolveAvailableSiblingName(parentId, requestedName, excludeNodeId = null) {
  const normalized = String(requestedName || '').trim();
  if (!normalized) {
    return normalized;
  }

  if (ensureUniqueInParent(parentId, normalized, excludeNodeId)) {
    return normalized;
  }

  const { stem, ext } = splitFilenameParts(normalized);
  const baseStem = stem || 'untitled';

  for (let attempt = 1; attempt <= 9999; attempt += 1) {
    const candidate = `${baseStem} (${attempt})${ext}`;
    if (ensureUniqueInParent(parentId, candidate, excludeNodeId)) {
      return candidate;
    }
  }

  throw new Error(`Unable to resolve unique sibling name for ${normalized}`);
}

function isAncestorPath(ancestorPath, targetPath) {
  return targetPath === ancestorPath || targetPath.startsWith(`${ancestorPath}.`);
}

function loadNodeDescendantsByPath(rootPath) {
  const escaped = quoteSqlLiteral(rootPath);
  const rowsJson = execPsql(
    "select coalesce(json_agg(row_to_json(t) order by (nlevel((t.path::ltree))) asc), '[]'::json) from (" +
      "select id::text as id, parent_id::text as parent_id, path::text as path, name, type, owner_user_id::text as owner_user_id, blob_id::text as blob_id, size_bytes, mime_type, metadata " +
      "from nodes where path <@ '" + escaped + "'::ltree and deleted_at is null" +
    ") t"
  ).trim();

  if (!rowsJson) {
    return [];
  }
  const rows = JSON.parse(rowsJson);
  return Array.isArray(rows) ? rows : [];
}

function loadNodeAncestorsByPath(nodePath) {
  const escaped = quoteSqlLiteral(nodePath);
  const rowsJson = execPsql(
    "select coalesce(json_agg(row_to_json(t) order by nlevel(t.path::ltree) asc), '[]'::json) from (" +
      "select id::text as id, parent_id::text as parent_id, path::text as path, name, owner_user_id::text as owner_user_id " +
      "from nodes where path @> '" + escaped + "'::ltree and deleted_at is null" +
    ") t"
  ).trim();

  if (!rowsJson) {
    return [];
  }
  const rows = JSON.parse(rowsJson);
  return Array.isArray(rows) ? rows : [];
}

function updateUserLocale(userId, locale) {
  const escapedUserId = quoteSqlLiteral(userId);
  const escapedLocale = String(locale).replace(/'/g, "''");
  execPsql(
    "update users set locale='" + escapedLocale + "', updated_at=now() where id='" + escapedUserId + "'::uuid;"
  );
}

function updateNodePath(nodeId, nextParentId, nextName, nextPath) {
  const escapedNodeId = quoteSqlLiteral(nodeId);
  const escapedParent = quoteSqlLiteral(nextParentId);
  const escapedName = String(nextName).replace(/'/g, "''");
  const escapedPath = String(nextPath).replace(/'/g, "''");
  execPsql(
    "update nodes set parent_id='" + escapedParent + "'::uuid, name='" + escapedName + "', path='" + escapedPath + "'::ltree, updated_at=now() where id='" + escapedNodeId + "'::uuid;"
  );
}



const UPLOAD_TMP_ROOT = '/tmp/nimbus-upload-tmp';
const UPLOAD_CHUNK_SIZE_BYTES_DEFAULT = 8_388_608; // 8 MiB
const UPLOAD_CHUNK_SIZE_MIN = 1_048_576;
const UPLOAD_CHUNK_SIZE_MAX = 33_554_432;
const UPLOAD_SESSION_TTL_SECONDS = 172_800;
const SHARE_DEFAULT_EXPIRES_SECONDS = 604_800; // SSOT: x-constants.shares.default_expires_in_seconds
const SHARE_MAX_EXPIRES_SECONDS = 31_536_000; // SSOT: x-constants.shares.max_expires_in_seconds
const SHARE_PASSWORD_MIN_LENGTH = 6; // SSOT: x-constants.shares.password_min_length

function computeUploadTotalChunks(sizeBytes, chunkSize) {
  return Math.max(1, Math.ceil(sizeBytes / chunkSize));
}

function loadUploadSessionById(uploadId) {
  const escaped = quoteSqlLiteral(uploadId);
  const rowJson = execPsql(
    "select row_to_json(t) from (" +
      "select id::text as upload_id, status, size_bytes, chunk_size_bytes, total_chunks, received_chunks, " +
      "to_char(created_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at, " +
      "to_char(updated_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as updated_at, parent_id::text as parent_id, filename, sha256::text, mime_type, temp_dir " +
    "from upload_sessions where id='" + escaped + "'::uuid limit 1" +
    ") t;"
  ).trim();

  if (!rowJson) return null;

  return JSON.parse(rowJson);
}

function doesBlobExistBySha256(sha256Text) {
  const escaped = quoteSqlLiteral(sha256Text);
  const existsText = execPsql(
    "select count(*)::bigint from blobs where sha256='" + escaped + "' and deleted_at is null limit 1"
  ).trim();
  const existsCount = Number(existsText || 0);
  return Number.isFinite(existsCount) && existsCount > 0;
}

function ensureUploadTmpDir(uploadId) {
  const safeUploadId = String(uploadId);
  const dir = path.join(UPLOAD_TMP_ROOT, safeUploadId);
  fs.mkdirSync(UPLOAD_TMP_ROOT, { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildUploadSessionDefaults(sizeBytes) {
  const chunkSize = Math.min(Math.max(UPLOAD_CHUNK_SIZE_MIN, Math.min(UPLOAD_CHUNK_SIZE_MAX, UPLOAD_CHUNK_SIZE_BYTES_DEFAULT)), UPLOAD_CHUNK_SIZE_MAX);
  const totalChunks = computeUploadTotalChunks(Number(sizeBytes || 0), chunkSize);
  return { chunkSize, totalChunks };
}


function listNodeChildren({ parentId, includeDeleted, limit, sortBy, order, cursor }) {
  const whereDeleted = includeDeleted ? '' : ' and deleted_at is null';
  const sortDirection = order === 'desc' ? 'DESC' : 'ASC';
  const columnMap = {
    name: 'name',
    updated_at: 'updated_at',
    size_bytes: 'size_bytes',
  };
  const sortColumn = columnMap[sortBy] || 'name';

  const offset = cursor;
  const queryLimit = limit + 1;

  const rowsJson = execPsql(
    `select coalesce(json_agg(row_to_json(n) order by ${sortColumn} ${sortDirection}, id::text ${sortDirection}) , '[]'::json) from (` +
      `select id::text as id, type, name, parent_id::text as parent_id, path::text as path, ` +
        `owner_user_id::text as owner_user_id, blob_id::text as blob_id, size_bytes, mime_type, metadata, ` +
        `to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at, ` +
        `to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at, ` +
        `to_char(deleted_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as deleted_at ` +
      `from nodes ` +
      `where parent_id='${quoteSqlLiteral(parentId)}'::uuid and true ${whereDeleted} ` +
      `order by ${sortColumn} ${sortDirection}, id::text ${sortDirection} ` +
      `limit ${queryLimit} offset ${offset}` +
    `) n;`
  ).trim();

  const parsed = rowsJson ? JSON.parse(rowsJson) : [];
  const safeRows = Array.isArray(parsed) ? parsed : [];
  const hasMore = safeRows.length > limit;
  const items = hasMore ? safeRows.slice(0, limit) : safeRows;

  for (const node of items) {
    if (node && node.deleted_at === null) {
      delete node.deleted_at;
    }
  }

  return {
    items,
    next_cursor: hasMore ? String(cursor + limit) : null
  };
}

function listTrashNodes({ limit, cursor, ownerUserId, includeAll }) {
  const offset = cursor;
  const queryLimit = limit + 1;

  const ownershipClause = includeAll ? '' : ` and owner_user_id='${quoteSqlLiteral(ownerUserId)}'::uuid`;

  const rowsJson = execPsql(
    `select coalesce(json_agg(row_to_json(n) order by deleted_at desc, id::text desc), '[]'::json) from (` +
      `select id::text as id, type, name, parent_id::text as parent_id, path::text as path, ` +
        `owner_user_id::text as owner_user_id, blob_id::text as blob_id, size_bytes, mime_type, metadata, ` +
        `to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at, ` +
        `to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at, ` +
        `to_char(deleted_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as deleted_at ` +
      `from nodes ` +
      `where deleted_at is not null` +
      ownershipClause +
      ` order by deleted_at desc, id::text desc ` +
      `limit ${queryLimit} offset ${offset}` +
    `) n;`
  ).trim();

  const parsed = rowsJson ? JSON.parse(rowsJson) : [];
  const all = Array.isArray(parsed) ? parsed : [];
  const hasMore = all.length > limit;
  const items = hasMore ? all.slice(0, limit) : all;

  return {
    items,
    next_cursor: hasMore ? String(cursor + limit) : null
  };
}

function escapeLikePattern(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

function searchNodes({ queryText, parentId, type, limit, cursor, ownerUserId, includeAll, includeMetadata }) {
  const offset = cursor;
  const queryLimit = limit + 1;
  const escapedQuery = escapeLikePattern(queryText).replace(/'/g, "''");
  const likePattern = `%${escapedQuery}%`;
  const whereDeleted = ' and deleted_at is null';
  const ownerClause = includeAll ? '' : ` and owner_user_id='${quoteSqlLiteral(ownerUserId)}'::uuid`;
  const parentClause = parentId ? ` and parent_id='${quoteSqlLiteral(parentId)}'::uuid` : '';
  const typeClause = type ? ` and type='${String(type).replace(/'/g, "''")}'` : '';
  const searchClause = includeMetadata
    ? `(name ilike '${likePattern}' escape '\\' or metadata::text ilike '${likePattern}' escape '\\')`
    : `name ilike '${likePattern}' escape '\\'`;

  const rowsJson = execPsql(
    `select coalesce(json_agg(row_to_json(n) order by name asc, id::text asc), '[]'::json) from (` +
      `select id::text as id, type, name, parent_id::text as parent_id, path::text as path, ` +
        `owner_user_id::text as owner_user_id, blob_id::text as blob_id, size_bytes, mime_type, metadata, ` +
        `to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at, ` +
        `to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at, ` +
        `to_char(deleted_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as deleted_at ` +
      `from nodes ` +
      `where ${searchClause}` +
      whereDeleted +
      ownerClause +
      parentClause +
      typeClause +
      ` order by name asc, id::text asc ` +
      `limit ${queryLimit} offset ${offset}` +
    `) n;`
  ).trim();

  const parsed = rowsJson ? JSON.parse(rowsJson) : [];
  const all = Array.isArray(parsed) ? parsed : [];
  const hasMore = all.length > limit;
  const items = hasMore ? all.slice(0, limit) : all;

  for (const node of items) {
    if (node && node.deleted_at === null) {
      delete node.deleted_at;
    }
  }

  return {
    items,
    next_cursor: hasMore ? String(cursor + limit) : null
  };
}
function statFsBytes(basePath) {
  // Node.js v18+ supports statfsSync.
  const st = fs.statfsSync(basePath);
  const bsize = BigInt(st.bsize);
  const freeBytes = BigInt(st.bavail) * bsize;
  const totalBytes = BigInt(st.blocks) * bsize;
  const clampToSafeInt = (v) => {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    return Number(v > max ? max : v);
  };
  return {
    free_bytes: clampToSafeInt(freeBytes),
    total_bytes: clampToSafeInt(totalBytes)
  };
}

function checkWritableDir(basePath) {
  fs.accessSync(basePath, fs.constants.W_OK);

  // Some FS setups allow W_OK but fail actual writes (e.g., ACL quirks).
  // Do a tiny write/delete probe.
  const probeName = `.nimbus_write_probe_${crypto.randomBytes(6).toString('hex')}`;
  const probePath = path.join(basePath, probeName);
  fs.writeFileSync(probePath, 'ok', { encoding: 'utf8' });
  fs.unlinkSync(probePath);
}

function validateUsername(username) {
  if (typeof username !== 'string') {
    return 'username must be a string';
  }
  if (username.length < 3 || username.length > 32) {
    return 'username length must be 3..32';
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return 'username has invalid format';
  }
  return null;
}

function validatePassword(password) {
  // Setup-time password policy (NOT used for login).
  if (typeof password !== 'string') {
    return 'password must be a string';
  }
  if (password.length < 8 || password.length > 128) {
    return 'password length must be 8..128';
  }
  return null;
}

function validateLoginPassword(password) {
  // SSOT: LoginRequest only requires password to be a string.
  // Do not enforce setup-time password policy here.
  if (typeof password !== 'string') {
    return 'password must be a string';
  }
  return null;
}

function validateRole(role) {
  if (role !== 'ADMIN' && role !== 'USER') {
    return 'role must be one of: ADMIN,USER';
  }
  return null;
}

function validateLocale(locale) {
  if (locale !== 'ko-KR' && locale !== 'en-US') {
    return 'locale must be one of: ko-KR,en-US';
  }
  return null;
}

function validateTheme(theme) {
  if (theme !== 'system' && theme !== 'light' && theme !== 'dark') {
    return 'theme must be one of: system,light,dark';
  }
  return null;
}

function validateTimeFormat(timeFormat) {
  if (timeFormat !== '24h' && timeFormat !== '12h') {
    return 'time_format must be one of: 24h,12h';
  }
  return null;
}

function hashPassword(password) {
  // NOTE: openapi SSOT specifies argon2id preferred. This minimal dev server uses
  // SHA-256 with per-user salt to avoid storing plaintext, as a scaffold.
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return `sha256:${salt}:${digest}`;
}

function makeTokens() {
  const accessToken = crypto.randomBytes(24).toString('base64url');
  const refreshToken = crypto.randomBytes(32).toString('base64url');
  return {
    token_type: 'Bearer',
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in_seconds: 900
  };
}

// In-memory token stores (scaffold)
// SSOT: refresh_token_rotation=true => old refresh token must become invalid after use.
// SSOT: x-constants.auth.refresh_token_ttl_seconds (openapi/openapi.yaml)
const REFRESH_TOKEN_TTL_SECONDS = 1_209_600; // 14 days
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_SECONDS * 1000;

// refresh_token -> { user_id, issued_at_ms }
const refreshTokenStore = new Map();

// access_token -> { user_id, refresh_token, issued_at_ms }
// NOTE: This is a minimal scaffold to support bearerAuth + logout behavior.
const accessTokenStore = new Map();
const adminAppearanceStore = new Map();

function rememberRefreshToken(refreshToken, userId) {
  refreshTokenStore.set(refreshToken, { user_id: userId, issued_at_ms: Date.now() });
}

function rememberAccessToken(accessToken, userId, refreshToken) {
  accessTokenStore.set(accessToken, { user_id: userId, refresh_token: refreshToken, issued_at_ms: Date.now() });
}

function rememberTokens(tokens, userId) {
  rememberRefreshToken(tokens.refresh_token, userId);
  rememberAccessToken(tokens.access_token, userId, tokens.refresh_token);
}

function revokeAccessTokensLinkedToRefresh(refreshToken) {
  // Remove access tokens that were issued alongside a refresh token that is no longer valid.
  // This prevents unbounded `accessTokenStore` growth in refresh-rotation flows.
  for (const [accessToken, row] of accessTokenStore.entries()) {
    if (row.refresh_token === refreshToken) {
      accessTokenStore.delete(accessToken);
    }
  }
}

function revokeAllTokensForUser(userId) {
  // Logout should revoke the *current* session token chain, even if the presented
  // access token is stale (e.g., user refreshed and then logs out with an older tab).
  for (const [refreshToken, row] of refreshTokenStore.entries()) {
    if (row.user_id === userId) {
      refreshTokenStore.delete(refreshToken);
    }
  }

  for (const [accessToken, row] of accessTokenStore.entries()) {
    if (row.user_id === userId) {
      accessTokenStore.delete(accessToken);
    }
  }
}

function rotateRefreshToken(oldRefreshToken) {
  const row = refreshTokenStore.get(oldRefreshToken);
  if (!row) {
    return null;
  }

  // Enforce refresh token TTL (reject even if token has not been rotated/used yet).
  const ageMs = Date.now() - row.issued_at_ms;
  if (!Number.isFinite(ageMs) || ageMs > REFRESH_TOKEN_TTL_MS) {
    refreshTokenStore.delete(oldRefreshToken);
    revokeAccessTokensLinkedToRefresh(oldRefreshToken);
    return null;
  }

  // Invalidate the old token on successful rotation.
  refreshTokenStore.delete(oldRefreshToken);
  revokeAccessTokensLinkedToRefresh(oldRefreshToken);

  const tokens = makeTokens();
  rememberTokens(tokens, row.user_id);
  return tokens;
}

function requireBearerAuth(req) {
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.toLowerCase().startsWith('bearer ')) {
    return { ok: false, status: 401, body: errorResponse('UNAUTHORIZED', 'Missing or invalid Authorization header') };
  }

  const accessToken = auth.slice('bearer '.length).trim();
  if (!accessToken) {
    return { ok: false, status: 401, body: errorResponse('UNAUTHORIZED', 'Missing bearer token') };
  }

  const row = accessTokenStore.get(accessToken);
  if (!row) {
    return { ok: false, status: 401, body: errorResponse('UNAUTHORIZED', 'Invalid access token') };
  }

  return { ok: true, user_id: row.user_id };
}

function loadUserById(userId) {
  const escaped = String(userId).replace(/'/g, "''");
  const rowJson = execPsql(
    "select row_to_json(u) from (" +
      "select id::text as id, username::text as username, display_name, role, locale, created_at, last_login_at " +
      "from users where id='" + escaped + "' limit 1" +
    ") u;"
  ).trim();

  if (!rowJson) {
    return null;
  }

  return JSON.parse(rowJson);
}


function loadNodeById(nodeId) {
  const escaped = quoteSqlLiteral(nodeId);
  const rowJson = execPsql(
    "select row_to_json(n) from (" +
      "select id::text as id, type, name, parent_id::text as parent_id, path::text as path, " +
        "owner_user_id::text as owner_user_id, blob_id::text as blob_id, size_bytes, mime_type, metadata, " +
        "to_char(created_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at, " +
        "to_char(updated_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as updated_at, " +
        "to_char(deleted_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as deleted_at " +
      "from nodes where id='" + escaped + "' and deleted_at is null limit 1" +
    ") n;"
  ).trim();

  if (!rowJson) return null;

  const n = JSON.parse(rowJson);
  if (n && n.deleted_at === null) delete n.deleted_at;
  return n;
}

function loadDeletedNodeById(nodeId) {
  const escaped = quoteSqlLiteral(nodeId);
  const rowJson = execPsql(
    "select row_to_json(n) from (" +
      "select id::text as id, type, name, parent_id::text as parent_id, path::text as path, " +
        "owner_user_id::text as owner_user_id, blob_id::text as blob_id, size_bytes, mime_type, metadata, " +
        "to_char(created_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at, " +
        "to_char(updated_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as updated_at, " +
        "to_char(deleted_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as deleted_at " +
      "from nodes where id='" + escaped + "' and deleted_at is not null limit 1" +
    ") n;"
  ).trim();

  if (!rowJson) return null;

  return JSON.parse(rowJson);
}

function loadBlobById(blobId) {
  const escaped = quoteSqlLiteral(blobId);
  const rowJson = execPsql(
    "select row_to_json(b) from (" +
      "select bl.id::text as id, bl.volume_id::text as volume_id, bl.storage_key, bl.sha256::text as sha256, " +
        "bl.size_bytes, bl.content_type, bl.ref_count, v.base_path " +
      "from blobs bl join volumes v on v.id=bl.volume_id " +
      "where bl.id='" + escaped + "'::uuid and bl.deleted_at is null limit 1" +
    ") b;"
  ).trim();

  if (!rowJson) return null;
  return JSON.parse(rowJson);
}

function loadBlobBySha256(sha256Text) {
  const escaped = quoteSqlLiteral(sha256Text);
  const rowJson = execPsql(
    "select row_to_json(b) from (" +
      "select bl.id::text as id, bl.volume_id::text as volume_id, bl.storage_key, bl.sha256::text as sha256, " +
        "bl.size_bytes, bl.content_type, bl.ref_count, v.base_path " +
      "from blobs bl join volumes v on v.id=bl.volume_id " +
      "where bl.sha256='" + escaped + "'::char(64) and bl.deleted_at is null limit 1" +
    ") b;"
  ).trim();

  if (!rowJson) return null;
  return JSON.parse(rowJson);
}

function loadActiveVolume() {
  const rowJson = execPsql(
    "select row_to_json(v) from (" +
      "select id::text as id, base_path " +
      "from volumes where is_active=true limit 1" +
    ") v;"
  ).trim();
  if (!rowJson) return null;
  return JSON.parse(rowJson);
}

function loadVolumeById(volumeId) {
  const escaped = quoteSqlLiteral(volumeId);
  const rowJson = execPsql(
    "select row_to_json(v) from (" +
      "select id::text as id, name, base_path, is_active, status, scan_state, scan_job_id::text as scan_job_id, scan_progress, scan_error, " +
        "to_char(scan_updated_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as scan_updated_at, " +
        "fs_type, free_bytes, total_bytes, created_at " +
      "from volumes where id='" + escaped + "'::uuid limit 1" +
    ") v;"
  ).trim();
  if (!rowJson) return null;
  return JSON.parse(rowJson);
}

function resolveBlobAbsolutePath(blob) {
  const basePath = blob && typeof blob.base_path === 'string' ? blob.base_path : '';
  const storageKey = blob && typeof blob.storage_key === 'string' ? blob.storage_key : '';
  if (!basePath || !storageKey) {
    return { ok: false, error: 'blob storage path is missing' };
  }

  if (path.isAbsolute(storageKey)) {
    return { ok: false, error: 'storage_key must be a relative path' };
  }

  const resolvedBase = path.resolve(basePath);
  const resolvedFile = path.resolve(resolvedBase, storageKey);

  const basePrefix = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
  if (resolvedFile !== resolvedBase && !resolvedFile.startsWith(basePrefix)) {
    return { ok: false, error: 'storage_key escapes base_path' };
  }

  return { ok: true, value: resolvedFile };
}

function ensureRootFolderForUser(userId) {
  const rootId = '00000000-0000-0000-0000-000000000001';
  const escapedRootId = quoteSqlLiteral(rootId);
  const escapedUserId = quoteSqlLiteral(userId);

  execPsql(
    `insert into nodes (id, type, parent_id, name, path, owner_user_id, size_bytes, metadata, created_at, updated_at, deleted_at)` +
      ` values ('${escapedRootId}'::uuid, 'FOLDER', NULL, 'root', 'root'::ltree, '${escapedUserId}'::uuid, 0, '{}'::jsonb, now(), now(), NULL)` +
    ` on conflict (id) do update set` +
      ` type='FOLDER', parent_id=NULL, name='root', path='root', owner_user_id=EXCLUDED.owner_user_id, size_bytes=0, metadata='{}'::jsonb, updated_at=now(), deleted_at=NULL`
  );

  const existing = loadNodeById(rootId);
  return existing && existing.type === 'FOLDER' ? existing : null;
}

function createFolderNode({ parent, name, owner_user_id }) {
  const id = crypto.randomUUID();
  const label = uuidToLtreeLabel(id);
  const parentPath = String(parent.path);
  const fullPath = `${parentPath}.${label}`;

  const escapedName = String(name).replace(/'/g, "''");
  const escapedOwner = String(owner_user_id).replace(/'/g, "''");
  const escapedParent = String(parent.id).replace(/'/g, "''");
  const escapedId = String(id).replace(/'/g, "''");
  const escapedPath = String(fullPath).replace(/'/g, "''");

  // Insert; rely on unique index (parent_id,name) where deleted_at is null for 409.
  const rowJson = execPsql(
    "insert into nodes (id, type, parent_id, name, path, owner_user_id, size_bytes, metadata, created_at, updated_at) values (" +
      "'" + escapedId + "'::uuid, 'FOLDER', '" + escapedParent + "'::uuid, '" + escapedName + "', '" + escapedPath + "'::ltree, '" + escapedOwner + "'::uuid, 0, '{}'::jsonb, now(), now()" +
    ") returning json_build_object(" +
      "'id', id::text, " +
      "'type', type, " +
      "'name', name, " +
      "'parent_id', parent_id::text, " +
      "'path', path::text, " +
      "'owner_user_id', owner_user_id::text, " +
      "'blob_id', blob_id::text, " +
      "'size_bytes', size_bytes, " +
      "'mime_type', mime_type, " +
      "'metadata', metadata, " +
      "'created_at', to_char(created_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), " +
      "'updated_at', to_char(updated_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), " +
      "'deleted_at', to_char(deleted_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')" +
    ")::text;"
  ).trim();

  if (!rowJson) {
    throw new Error('DB returned empty response when creating folder node');
  }

  const node = JSON.parse(rowJson);
  if (node && node.deleted_at === null) delete node.deleted_at;
  return node;
}

function createFileNode({ parent, name, owner_user_id, blob_id, size_bytes, mime_type }) {
  const id = crypto.randomUUID();
  const label = uuidToLtreeLabel(id);
  const parentPath = String(parent.path);
  const fullPath = `${parentPath}.${label}`;

  const escapedName = String(name).replace(/'/g, "''");
  const escapedOwner = String(owner_user_id).replace(/'/g, "''");
  const escapedParent = String(parent.id).replace(/'/g, "''");
  const escapedId = String(id).replace(/'/g, "''");
  const escapedPath = String(fullPath).replace(/'/g, "''");
  const escapedBlob = String(blob_id).replace(/'/g, "''");
  const escapedMime = mime_type === null || mime_type === undefined ? null : String(mime_type).replace(/'/g, "''");

  const rowJson = execPsql(
    "insert into nodes (id, type, parent_id, name, path, owner_user_id, blob_id, size_bytes, mime_type, metadata, created_at, updated_at) values (" +
      "'" + escapedId + "'::uuid, 'FILE', '" + escapedParent + "'::uuid, '" + escapedName + "', '" + escapedPath + "'::ltree, '" + escapedOwner + "'::uuid, '" + escapedBlob + "'::uuid, " + Number(size_bytes || 0) + ", " + (escapedMime === null ? 'NULL' : "'" + escapedMime + "'") + ", '{}'::jsonb, now(), now()" +
    ") returning json_build_object(" +
      "'id', id::text, " +
      "'type', type, " +
      "'name', name, " +
      "'parent_id', parent_id::text, " +
      "'path', path::text, " +
      "'owner_user_id', owner_user_id::text, " +
      "'blob_id', blob_id::text, " +
      "'size_bytes', size_bytes, " +
      "'mime_type', mime_type, " +
      "'metadata', metadata, " +
      "'created_at', to_char(created_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), " +
      "'updated_at', to_char(updated_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), " +
      "'deleted_at', to_char(deleted_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')" +
    ")::text;"
  ).trim();

  if (!rowJson) {
    throw new Error('DB returned empty response when creating file node');
  }

  const node = JSON.parse(rowJson);
  if (node && node.deleted_at === null) delete node.deleted_at;
  return node;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, errorResponse('BAD_REQUEST', 'Missing URL'));
    return;
  }

  const authHeader = req.headers.authorization;
  const shouldRecordLatency = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
  const startAt = shouldRecordLatency ? process.hrtime.bigint() : null;
  if (shouldRecordLatency) {
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startAt) / 1e6;
      qosController.recordApiLatencyMs(durationMs);
    });
  }

  const { method, url } = req;
  const parsedUrl = new URL(`http://localhost${url}`);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.searchParams;

  if (method && url && isMutatingMethod(method) && !isReadOnlyExemptPath(url)) {
    try {
      const mode = loadSystemMode();
      if (mode.read_only) {
        sendJson(res, 409, errorResponse('READ_ONLY', 'System is in read-only mode'));
        return;
      }
    } catch (err) {
      // If system mode cannot be loaded, fail safe: do not allow mutation.
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  if (method === 'GET' && url === '/health') {
    // OpenAPI SSOT: components.schemas.SuccessResponse
    // Compatibility: P0 evidence gate expects `run_id` to echo back when RUN_ID is provided.
    const runId = process.env.RUN_ID;
    const body = runId ? { ok: true, run_id: runId } : { ok: true };
    sendJson(res, 200, body);
    return;
  }

  if (method === 'GET' && url === '/setup/status') {
    try {
      const usersCount = getUsersCount();
      const setupRequired = usersCount === 0;
      sendJson(res, 200, { setup_required: setupRequired });
    } catch (err) {
      sendJson(res, 500, errorResponse('DB_UNAVAILABLE', String(err)));
    }
    return;
  }

  if (method === 'POST' && url === '/setup/admin') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    const usernameError = validateUsername(body.username);
    if (usernameError) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', usernameError));
      return;
    }

    const passwordError = validatePassword(body.password);
    if (passwordError) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', passwordError));
      return;
    }

    const displayName = body.display_name;
    if (displayName !== undefined && typeof displayName !== 'string') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'display_name must be a string'));
      return;
    }
    if (typeof displayName === 'string' && displayName.length > 64) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'display_name maxLength is 64'));
      return;
    }

    // locale is optional, but must be a valid enum string when provided.
    // Reject explicit null (OpenAPI does not allow null for Locale).
    let locale = 'ko-KR';
    if (Object.prototype.hasOwnProperty.call(body, 'locale')) {
      if (body.locale === null) {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'locale must be a string (null is not allowed)'));
        return;
      }
      if (body.locale !== undefined && typeof body.locale !== 'string') {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'locale must be a string'));
        return;
      }
      if (typeof body.locale === 'string') {
        locale = body.locale;
      }
    }

    if (locale !== 'ko-KR' && locale !== 'en-US') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'locale must be one of: ko-KR,en-US'));
      return;
    }

    try {
      const usersCount = getUsersCount();
      if (usersCount > 0) {
        sendJson(res, 409, errorResponse('SETUP_ALREADY_COMPLETED', 'Initial admin already exists'));
        return;
      }

      const userId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const passwordHash = hashPassword(body.password);

      const username = String(body.username);
      const escapedUsername = username.replace(/'/g, "''");
      const escapedDisplayName = (typeof displayName === 'string')
        ? `'${displayName.replace(/'/g, "''")}'`
        : 'NULL';
      const escapedPasswordHash = passwordHash.replace(/'/g, "''");
      const escapedLocale = String(locale).replace(/'/g, "''");

      execPsql(
        `insert into users (id, username, display_name, role, password_hash, locale, created_at, updated_at)` +
        ` values ('${userId}', '${escapedUsername}', ${escapedDisplayName}, 'ADMIN', '${escapedPasswordHash}', '${escapedLocale}', now(), now());`
      );


      const tokens = makeTokens();
      rememberTokens(tokens, userId);

      try {
        ensureRootFolderForUser(userId);
      } catch (err) {
        // Keep setup success even if nodes schema migration is not yet available.
        console.warn('[setup/admin] root node seed failed:', String(err && err.message ? err.message : err));
      }

      sendJson(res, 201, {
        user: {
          id: userId,
          username,
          display_name: typeof displayName === 'string' ? displayName : undefined,
          role: 'ADMIN',
          locale,
          created_at: nowIso,
        },
        tokens
      });
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
    }
    return;
  }

  if (method === 'POST' && url === '/auth/login') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    const usernameError = validateUsername(body.username);
    if (usernameError) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', usernameError));
      return;
    }

    const passwordError = validateLoginPassword(body.password);
    if (passwordError) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', passwordError));
      return;
    }

    try {
      const username = String(body.username);
      const escapedUsername = username.replace(/'/g, "''");

      const rowJson = execPsql(
        "select row_to_json(u) from (" +
          "select " +
            "id::text as id, " +
            "username::text as username, " +
            "display_name, " +
            "role, " +
            "locale, " +
            "created_at, " +
            "last_login_at, " +
            "password_hash " +
          "from users where username='" + escapedUsername + "' limit 1" +
        ") u;"
      ).trim();

      if (!rowJson) {
        sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid username or password'));
        return;
      }

      const dbUser = JSON.parse(rowJson);
      const stored = String(dbUser.password_hash);

      const parts = stored.split(':');
      if (parts.length !== 3 || parts[0] !== 'sha256') {
        sendJson(res, 500, errorResponse('INTERNAL', 'Unsupported password hash format'));
        return;
      }

      const salt = parts[1];
      const expectedDigest = parts[2];
      const actualDigest = crypto
        .createHash('sha256')
        .update(`${salt}:${String(body.password)}`)
        .digest('hex');

      const ok = crypto.timingSafeEqual(
        Buffer.from(expectedDigest, 'hex'),
        Buffer.from(actualDigest, 'hex')
      );

      if (!ok) {
        sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid username or password'));
        return;
      }

      execPsql(
        "update users set last_login_at=now(), updated_at=now() where id='" +
          String(dbUser.id).replace(/'/g, "''") +
          "';"
      );

      const tokens = makeTokens();
      rememberTokens(tokens, dbUser.id);

      sendJson(res, 200, {
        user: {
          id: dbUser.id,
          username: dbUser.username,
          display_name: dbUser.display_name === null ? undefined : dbUser.display_name,
          role: dbUser.role,
          locale: dbUser.locale,
          created_at: dbUser.created_at,
          last_login_at: new Date().toISOString(),
        },
        tokens,
      });
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
    }
    return;
  }

  if (method === 'POST' && url === '/auth/logout') {
    const auth = req.headers.authorization;
    if (typeof auth !== 'string' || !auth.toLowerCase().startsWith('bearer ')) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Missing or invalid Authorization header'));
      return;
    }

    const accessToken = auth.slice('bearer '.length).trim();
    if (!accessToken) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Missing bearer token'));
      return;
    }

    const row = accessTokenStore.get(accessToken);
    if (!row) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    // Logout should revoke the whole session token chain for this user.
    // (login -> refresh -> logout with older access token) must not leave the
    // latest rotated refresh token usable.
    revokeAllTokensForUser(row.user_id);

    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && url === '/auth/refresh') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    if (typeof body.refresh_token !== 'string') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'refresh_token must be a string'));
      return;
    }

    const tokens = rotateRefreshToken(body.refresh_token);
    if (!tokens) {
      // SSOT: refresh_token_rotation=true => old token reuse should fail.
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid refresh token'));
      return;
    }

    sendJson(res, 200, tokens);
    return;
  }

  if (method === 'GET' && pathname === '/me') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const user = loadUserById(auth.user_id);
    if (!user) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'User not found'));
      return;
    }

    sendJson(res, 200, user);
    return;
  }

  if (method === 'GET' && pathname === '/me/preferences') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const user = loadUserById(auth.user_id);
    if (!user) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'User not found'));
      return;
    }

    sendJson(res, 200, user);
    return;
  }

  if (method === 'PATCH' && pathname === '/me/preferences') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    if (typeof body.locale !== 'string') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'locale must be a string'));
      return;
    }

    const localeError = validateLocale(body.locale);
    if (localeError) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', localeError));
      return;
    }

    try {
      updateUserLocale(auth.user_id, body.locale);
      const user = loadUserById(auth.user_id);
      if (!user) {
        sendJson(res, 404, errorResponse('NOT_FOUND', 'User not found'));
        return;
      }
      sendJson(res, 200, user);
      return;
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  if (method === 'GET' && pathname === '/admin/appearance') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const user = loadUserById(auth.user_id);
    if (!user) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'User not found'));
      return;
    }
    if (user.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    const appearance = adminAppearanceStore.get(user.id) || { theme: 'system', time_format: '24h' };
    sendJson(res, 200, {
      locale: user.locale,
      theme: appearance.theme,
      time_format: appearance.time_format,
    });
    return;
  }

  if (method === 'PATCH' && pathname === '/admin/appearance') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const user = loadUserById(auth.user_id);
    if (!user) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'User not found'));
      return;
    }
    if (user.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'locale')) {
      if (typeof body.locale !== 'string') {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'locale must be a string'));
        return;
      }
      const localeError = validateLocale(body.locale);
      if (localeError) {
        sendJson(res, 400, errorResponse('BAD_REQUEST', localeError));
        return;
      }
      updateUserLocale(auth.user_id, body.locale);
    }

    const current = adminAppearanceStore.get(user.id) || { theme: 'system', time_format: '24h' };
    const next = { ...current };

    if (Object.prototype.hasOwnProperty.call(body, 'theme')) {
      if (typeof body.theme !== 'string') {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'theme must be a string'));
        return;
      }
      const themeError = validateTheme(body.theme);
      if (themeError) {
        sendJson(res, 400, errorResponse('BAD_REQUEST', themeError));
        return;
      }
      next.theme = body.theme;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'time_format')) {
      if (typeof body.time_format !== 'string') {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'time_format must be a string'));
        return;
      }
      const timeFormatError = validateTimeFormat(body.time_format);
      if (timeFormatError) {
        sendJson(res, 400, errorResponse('BAD_REQUEST', timeFormatError));
        return;
      }
      next.time_format = body.time_format;
    }

    adminAppearanceStore.set(user.id, next);

    const updatedUser = loadUserById(auth.user_id);
    if (!updatedUser) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'User not found'));
      return;
    }

    sendJson(res, 200, {
      locale: updatedUser.locale,
      theme: next.theme,
      time_format: next.time_format,
    });
    return;
  }

  if (method === 'POST' && url === '/admin/invites') {
    const authResult = requireBearerAuth(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    const caller = loadUserById(authResult.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (body !== null && (typeof body !== 'object' || Array.isArray(body))) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body must be an object'));
      return;
    }

    let expiresInSeconds = 604800;
    if (body && Object.prototype.hasOwnProperty.call(body, 'expires_in_seconds')) {
      if (!Number.isInteger(body.expires_in_seconds)) {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'expires_in_seconds must be an integer'));
        return;
      }
      expiresInSeconds = body.expires_in_seconds;
    }

    if (expiresInSeconds < 300 || expiresInSeconds > 31536000) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'expires_in_seconds out of range'));
      return;
    }

    let role = 'USER';
    if (body && Object.prototype.hasOwnProperty.call(body, 'role')) {
      if (typeof body.role !== 'string') {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'role must be a string'));
        return;
      }
      role = body.role;
    }

    const roleError = validateRole(role);
    if (roleError) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', roleError));
      return;
    }

    let locale = 'ko-KR';
    if (body && Object.prototype.hasOwnProperty.call(body, 'locale')) {
      if (body.locale === null) {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'locale must be a string (null is not allowed)'));
        return;
      }
      if (typeof body.locale !== 'string') {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'locale must be a string'));
        return;
      }
      locale = body.locale;
    }

    const localeError = validateLocale(locale);
    if (localeError) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', localeError));
      return;
    }

    try {
      const inviteId = crypto.randomUUID();
      const token = crypto.randomBytes(24).toString('base64url');
      const tokenHashHex = hashInviteToken(token);

      const rowJson = execPsql(
        "insert into invites (id, token_hash, role, locale, created_by, created_at, expires_at, used_at, used_by) " +
          "values (" +
            "'" + inviteId.replace(/'/g, "''") + "', " +
            "decode('" + tokenHashHex + "','hex'), " +
            "'" + String(role).replace(/'/g, "''") + "', " +
            "'" + String(locale).replace(/'/g, "''") + "', " +
            "'" + String(caller.id).replace(/'/g, "''") + "', " +
            "now(), " +
            "now() + interval '" + expiresInSeconds + " seconds', " +
            "NULL, NULL" +
          ") " +
          "returning json_build_object(" +
            "'id', id::text, " +
            "'expires_at', to_char(expires_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), " +
            "'created_at', to_char(created_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')" +
          ")::text;"
      ).trim();

      if (!rowJson) {
        throw new Error('failed to insert invite');
      }

      const invite = JSON.parse(rowJson);

      sendJson(res, 201, {
        id: invite.id,
        token,
        expires_at: invite.expires_at,
        created_at: invite.created_at,
      });
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
    }
    return;
  }

  if (method === 'POST' && url === '/auth/accept-invite') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    if (typeof body.token !== 'string' || body.token.length === 0) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'token must be a string'));
      return;
    }

    const usernameError = validateUsername(body.username);
    if (usernameError) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', usernameError));
      return;
    }

    const passwordError = validatePassword(body.password);
    if (passwordError) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', passwordError));
      return;
    }

    const displayName = body.display_name;
    if (displayName !== undefined && typeof displayName !== 'string') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'display_name must be a string'));
      return;
    }
    if (typeof displayName === 'string' && displayName.length > 64) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'display_name maxLength is 64'));
      return;
    }

    try {
      const tokenHashHex = hashInviteToken(body.token);

      const inviteRow = execPsql(
        "select id::text, role, locale, created_by::text, " +
          "to_char(expires_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as expires_at, " +
          "used_at is not null as used " +
        "from invites where token_hash=decode('" + tokenHashHex + "','hex') limit 1;"
      ).trim();

      if (!inviteRow) {
        sendJson(res, 404, errorResponse('INVITE_NOT_FOUND', 'Invite token not found'));
        return;
      }

      const [inviteId, inviteRole, inviteLocale, inviteCreatedBy, inviteExpiresAt, usedStr] = inviteRow.split('|').map((s) => s.trim());
      const used = usedStr === 't' || usedStr === 'true';

      // Expiry check
      const isExpired = execPsql(
        "select now() > expires_at from invites where id='" + inviteId.replace(/'/g, "''") + "' limit 1;"
      ).trim();
      if (isExpired === 't' || isExpired === 'true') {
        sendJson(res, 409, errorResponse('INVITE_EXPIRED', 'Invite token expired'));
        return;
      }

      if (used) {
        sendJson(res, 409, errorResponse('INVITE_ALREADY_USED', 'Invite token already used'));
        return;
      }

      const roleError = validateRole(inviteRole);
      if (roleError) {
        sendJson(res, 500, errorResponse('INTERNAL', roleError));
        return;
      }

      const localeError = validateLocale(inviteLocale);
      if (localeError) {
        sendJson(res, 500, errorResponse('INTERNAL', localeError));
        return;
      }

      // Ensure username is unique
      const username = String(body.username);
      const escapedUsername = username.replace(/'/g, "''");
      const exists = execPsql(
        "select 1 from users where username='" + escapedUsername + "' limit 1;"
      ).trim();
      if (exists === '1') {
        sendJson(res, 409, errorResponse('USERNAME_TAKEN', 'Username already exists'));
        return;
      }

      const userId = crypto.randomUUID();
      const passwordHash = hashPassword(body.password);

      const escapedDisplayName = (typeof displayName === 'string')
        ? "'" + displayName.replace(/'/g, "''") + "'"
        : 'NULL';

      const consumeAndCreateRow = execPsql(
        "with updated as (" +
          "update invites set used_at=now(), used_by='" + userId.replace(/'/g, "''") + "' " +
          "where id='" + inviteId.replace(/'/g, "''") + "' and used_at is null " +
          "returning 1" +
        "), inserted as (" +
          "insert into users (id, username, display_name, role, password_hash, locale, created_at, updated_at) " +
          "select " +
            "'" + userId.replace(/'/g, "''") + "', " +
            "'" + escapedUsername + "', " +
            escapedDisplayName + ", " +
            "'" + String(inviteRole).replace(/'/g, "''") + "', " +
            "'" + String(passwordHash).replace(/'/g, "''") + "', " +
            "'" + String(inviteLocale).replace(/'/g, "''") + "', " +
            "now(), now() " +
          "where exists (select 1 from updated) " +
          "returning 1" +
        ") " +
        "select json_build_object(" +
          "'updated', (select count(*) from updated), " +
          "'inserted', (select count(*) from inserted)" +
        ")::text;"
      ).trim();

      const consumeResult = JSON.parse(consumeAndCreateRow || '{}');
      const updatedCount = Number(consumeResult.updated);
      const insertedCount = Number(consumeResult.inserted);

      if (updatedCount !== 1 || insertedCount !== 1) {
        // updatedCount=0 indicates the invite was consumed concurrently.
        // insertedCount=0 should not happen if updatedCount=1, but treat defensively.
        sendJson(res, 409, errorResponse('INVITE_ALREADY_USED', 'Invite token already used'));
        return;
      }

      const tokens = makeTokens();
      rememberTokens(tokens, userId);

      sendJson(res, 201, {
        user: {
          id: userId,
          username,
          display_name: typeof displayName === 'string' ? displayName : undefined,
          role: inviteRole,
          locale: inviteLocale,
          created_at: new Date().toISOString(),
        },
        tokens,
      });
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
    }
    return;
  }

  if (method === 'GET' && url === '/admin/system-mode') {
    const authResult = requireBearerAuth(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    const caller = loadUserById(authResult.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    try {
      const mode = loadSystemMode();
      sendJson(res, 200, mode);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
    }
    return;
  }

  if (method === 'PATCH' && url === '/admin/system-mode') {
    const authResult = requireBearerAuth(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    const caller = loadUserById(authResult.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    if (typeof body.read_only !== 'boolean') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'read_only must be a boolean'));
      return;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'reason')) {
      if (body.reason !== undefined && typeof body.reason !== 'string') {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'reason must be a string'));
        return;
      }
    }

    try {
      const mode = saveSystemMode({ read_only: body.read_only, reason: body.reason });
      sendJson(res, 200, mode);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
    }
    return;
  }

  if (method === 'GET' && pathname === '/system/performance') {
    const authResult = requireBearerAuth(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    const caller = loadUserById(authResult.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    try {
      const state = await qosController.sampleState();
      sendJson(res, 200, state);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
    }
    return;
  }

  if (method === 'POST' && url === '/nodes/folders') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    const parentId = body.parent_id;
    const name = body.name;

    if (typeof parentId !== 'string' || parentId.trim().length === 0) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'parent_id must be a non-empty UUID string'));
      return;
    }

    // UUID shape validation (5 groups of hex). Keep permissive on version/variant
    // because our deterministic root node id uses zeros in those nibbles.
    // This still blocks malformed values like "------------------------------------".
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRe.test(parentId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'parent_id must be a UUID'));
      return;
    }

    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'name must be a non-empty string (<=255)'));
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    let parent;
    try {
      parent = loadNodeById(parentId);
      if (!parent && parentId === '00000000-0000-0000-0000-000000000001') {
        parent = ensureRootFolderForUser(auth.user_id);
      }
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!parent || parent.type !== 'FOLDER') {
      sendJson(res, 404, errorResponse('PARENT_NOT_FOUND', 'Parent folder not found'));
      return;
    }

    // Authorization: must be able to write under the parent folder.
    // Minimal rule until ACLs are introduced: owner or admin.
    if (caller.role !== 'ADMIN' && String(parent.owner_user_id) !== String(auth.user_id)) {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'No write permission for parent folder'));
      return;
    }

    try {
      const node = createFolderNode({ parent, name: name.trim(), owner_user_id: auth.user_id });
      sendJson(res, 201, node);
      return;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes('duplicate key value') || msg.includes('idx_nodes_parent_name_active_unique')) {
        sendJson(res, 409, errorResponse('NODE_NAME_CONFLICT', 'A node with the same name already exists under this parent'));
        return;
      }
      sendJson(res, 500, errorResponse('INTERNAL', msg));
      return;
    }
  }

  if (method === 'POST' && url === '/uploads') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    const parentId = body.parent_id;
    const filenameResult = normalizeUploadFilename(body.filename);
    if (!filenameResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', filenameResult.error));
      return;
    }

    if (!isValidUuid(parentId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'parent_id must be a UUID'));
      return;
    }

    const sizeResult = parseCreateUploadSizeBytes(body.size_bytes);
    if (!sizeResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', sizeResult.error));
      return;
    }

    const sha256Result = parseSha256(body.sha256);
    if (!sha256Result.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', sha256Result.error));
      return;
    }

    const mimeTypeResult = parseMimeType(body.mime_type);
    if (!mimeTypeResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', mimeTypeResult.error));
      return;
    }

    const modifiedAtResult = parseModifiedAt(body.modified_at);
    if (!modifiedAtResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', modifiedAtResult.error));
      return;
    }

    let parentNode;
    try {
      parentNode = loadNodeById(parentId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!parentNode || parentNode.type !== 'FOLDER') {
      sendJson(res, 404, errorResponse('PARENT_NOT_FOUND', 'Parent folder not found'));
      return;
    }

    const uploadId = crypto.randomUUID();
    const { chunkSize, totalChunks } = buildUploadSessionDefaults(sizeResult.value);
    const dedupHit = sha256Result.value ? doesBlobExistBySha256(sha256Result.value) : false;

    const uploadTempDir = ensureUploadTmpDir(uploadId);

    const escapedUploadId = quoteSqlLiteral(uploadId);
    const escapedUserId = quoteSqlLiteral(auth.user_id);
    const escapedParentId = quoteSqlLiteral(parentId);
    const escapedFilename = filenameResult.value.replace(/'/g, "''");
    const escapedSize = Number(sizeResult.value);
    const escapedSha256 = sha256Result.value === null
      ? null
      : quoteSqlLiteral(sha256Result.value);
    const escapedMime = mimeTypeResult.value === null
      ? null
      : quoteSqlLiteral(mimeTypeResult.value);
    const escapedChunkSize = Number(chunkSize);
    const escapedTotalChunks = Number(totalChunks);
    const escapedTempDir = quoteSqlLiteral(uploadTempDir);

    const expiresAtExpr = `now() + interval '${UPLOAD_SESSION_TTL_SECONDS} seconds'`;

    try {
      const rowJson = execPsql(
        "insert into upload_sessions (id, user_id, parent_id, filename, size_bytes, sha256, mime_type, status, chunk_size_bytes, total_chunks, received_chunks, temp_dir, created_at, updated_at, expires_at) values (" +
          "'" + escapedUploadId + "'::uuid, " +
          "'" + escapedUserId + "'::uuid, " +
          "'" + escapedParentId + "'::uuid, " +
          "'" + escapedFilename + "', " +
          escapedSize + ", " +
          (sha256Result.value === null ? 'NULL' : "'" + escapedSha256 + "'::char(64)") + ", " +
          (mimeTypeResult.value === null ? 'NULL' : "'" + escapedMime + "'") + ", " +
          "'INIT'::text, " +
          escapedChunkSize + ", " +
          escapedTotalChunks + ", '{}'::int[], " +
          "'" + escapedTempDir + "', now(), now(), " + expiresAtExpr + ") " +
          "returning json_build_object(" +
            "'upload_id', id::text, " +
            "'status', status, " +
            "'chunk_size_bytes', chunk_size_bytes, " +
            "'total_chunks', total_chunks" +
          ")::text;"
      ).trim();

      if (!rowJson) {
        throw new Error('Failed to create upload session');
      }

      const createdUpload = JSON.parse(rowJson);

      sendJson(res, 201, {
        upload_id: createdUpload.upload_id,
        status: createdUpload.status,
        chunk_size_bytes: Number(createdUpload.chunk_size_bytes),
        total_chunks: Number(createdUpload.total_chunks),
        dedup_hit: dedupHit,
      });
      return;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes('relation "upload_sessions" does not exist')) {
        sendJson(res, 500, errorResponse('INTERNAL', 'Upload session table is not initialized'));
        return;
      }
      sendJson(res, 500, errorResponse('INTERNAL', msg));
      return;
    }
  }

  if (method === 'PUT') {
    const match = pathname.match(/^\/uploads\/([0-9a-fA-F-]{36})\/chunks\/(\d+)$/);
    if (match) {
      const auth = requireBearerAuth(req);
      if (!auth.ok) {
        sendJson(res, auth.status, auth.body);
        return;
      }

      const uploadId = match[1];
      const escapedUploadId = quoteSqlLiteral(uploadId);
      const chunkIndexText = match[2];
      const chunkIndex = Number(chunkIndexText);
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'chunk_index must be a non-negative integer'));
        return;
      }

      const shaHeader = req.headers['x-chunk-sha256'];
      const shaText = Array.isArray(shaHeader) ? shaHeader[0] : shaHeader;
      const hasChunkChecksum = typeof shaText === 'string' && shaText.trim().length > 0;
      let requestedChunkSha = null;
      if (hasChunkChecksum) {
        const shaResult = parseSha256(shaText);
        if (!shaResult.ok || shaResult.value === null) {
          sendJson(res, 400, errorResponse('BAD_REQUEST', 'X-Chunk-SHA256 header must be 64 hex chars when provided'));
          return;
        }
        requestedChunkSha = shaResult.value;
      }

      const session = loadUploadSessionById(uploadId);
      if (!session) {
        sendJson(res, 404, errorResponse('NOT_FOUND', 'Upload session not found'));
        return;
      }

      const ownerUserId = execPsql(
        "select user_id::text from upload_sessions where id='" + escapedUploadId + "'::uuid limit 1;"
      ).trim();

      if (!ownerUserId) {
        // Should not happen if session JSON was loaded, but keep behavior consistent.
        sendJson(res, 404, errorResponse('NOT_FOUND', 'Upload session not found'));
        return;
      }

      if (String(ownerUserId) !== String(auth.user_id)) {
        sendJson(res, 403, errorResponse('FORBIDDEN', 'Upload session not owned by caller'));
        return;
      }

      if (chunkIndex >= Number(session.total_chunks)) {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'chunk_index out of range'));
        return;
      }

      const maxBytes = Number(session.chunk_size_bytes);
      const bodyBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on('data', (c) => {
          const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
          total += buf.length;
          if (total > maxBytes) {
            reject(new Error('chunk too large'));
            return;
          }
          chunks.push(buf);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      }).catch((err) => {
        sendJson(res, 400, errorResponse('BAD_REQUEST', String(err && err.message ? err.message : err)));
        return null;
      });

      if (!bodyBuffer) {
        return;
      }

      const actualSha = crypto.createHash('sha256').update(bodyBuffer).digest('hex');
      if (requestedChunkSha !== null && actualSha !== requestedChunkSha) {
        sendJson(res, 400, errorResponse('CHECKSUM_MISMATCH', 'Body checksum does not match X-Chunk-SHA256'));
        return;
      }
      const effectiveChunkSha = requestedChunkSha ?? actualSha;

      // Authorization: the upload session must belong to the caller. (checked above)

      // Idempotency: one chunk per (upload_id, chunk_index).
      // - If already exists and checksum matches, return OK.
      // - If already exists and checksum differs, conflict.
      // - Otherwise, insert metadata first to win the PK race, then write the file.
      const tempDir = String(session.temp_dir);
      fs.mkdirSync(tempDir, { recursive: true });
      const chunkFilename = `chunk_${chunkIndex}.bin`;
      const storedPath = path.join(tempDir, chunkFilename);

      const escapedStoredPath = quoteSqlLiteral(storedPath);
      const escapedChecksum = quoteSqlLiteral(effectiveChunkSha);
      const sizeBytes = bodyBuffer.length;

      // Try to insert first. If another request already inserted, we handle idempotent/conflict below.
      let inserted = false;
      try {
        execPsql(
          "insert into upload_chunks (upload_id, chunk_index, checksum_sha256, size_bytes, stored_path) values (" +
            "'" + escapedUploadId + "'::uuid, " + Number(chunkIndex) + ", '" + escapedChecksum + "'::char(64), " + Number(sizeBytes) + ", '" + escapedStoredPath + "');"
        );
        inserted = true;
      } catch (err) {
        const msg = String(err && err.message ? err.message : err);
        // Duplicate key means someone else won the PK race; treat as idempotent/conflict based on checksum.
        if (!msg.includes('duplicate key')) {
          sendJson(res, 500, errorResponse('INTERNAL', msg));
          return;
        }
      }

      if (!inserted) {
        const existingJson = execPsql(
          "select json_build_object('checksum', checksum_sha256::text, 'stored_path', stored_path, 'size_bytes', size_bytes)::text " +
          "from upload_chunks where upload_id='" + escapedUploadId + "'::uuid and chunk_index=" + Number(chunkIndex) + " limit 1;"
        ).trim();

        if (existingJson) {
          const existing = JSON.parse(existingJson);
          if (existing.checksum !== effectiveChunkSha) {
            sendJson(res, 409, errorResponse('CHUNK_CONFLICT', 'Chunk already uploaded with different checksum'));
            return;
          }

          const sessionOut = loadUploadSessionById(uploadId);
          sendJson(res, 200, sessionOut);
          return;
        }

        // If we couldn't find it, something went wrong.
        sendJson(res, 500, errorResponse('INTERNAL', 'Chunk insert conflict without existing row'));
        return;
      }

      // We won the insert; now persist the file. If file write fails, roll back the metadata row.
      try {
        fs.writeFileSync(storedPath, bodyBuffer);
      } catch (err) {
        const msg = String(err && err.message ? err.message : err);
        try {
          execPsql(
            "delete from upload_chunks where upload_id='" + escapedUploadId + "'::uuid and chunk_index=" + Number(chunkIndex) + ";"
          );
        } catch (_) {}
        sendJson(res, 500, errorResponse('INTERNAL', msg));
        return;
      }

      try {
        // Update session: mark as UPLOADING and add chunk_index to received_chunks.
        execPsql(
          "update upload_sessions set " +
            "status='UPLOADING', " +
            "received_chunks=(case when array_position(received_chunks, " + Number(chunkIndex) + ") is null then array_append(received_chunks, " + Number(chunkIndex) + ") else received_chunks end), " +
            "updated_at=now() " +
          "where id='" + escapedUploadId + "'::uuid;"
        );
      } catch (err) {
        const msg = String(err && err.message ? err.message : err);
        sendJson(res, 500, errorResponse('INTERNAL', msg));
        return;
      }

      const out = loadUploadSessionById(uploadId);
      sendJson(res, 200, out);
      return;
    }
  }


  if (method === 'POST') {
    const match = pathname.match(/^\/uploads\/([0-9a-fA-F-]{36})\/complete$/);
    if (match) {
      const auth = requireBearerAuth(req);
      if (!auth.ok) {
        sendJson(res, auth.status, auth.body);
        return;
      }

      const uploadId = match[1];
      const session = loadUploadSessionById(uploadId);
      if (!session) {
        sendJson(res, 404, errorResponse('NOT_FOUND', 'Upload session not found'));
        return;
      }

      // Authorization: upload session must belong to caller.
      if (String(session.parent_id || '') === '' || String(auth.user_id) !== String(execPsql(
        "select user_id::text from upload_sessions where id='" + quoteSqlLiteral(uploadId) + "'::uuid limit 1;"
      ).trim())) {
        // Use explicit DB lookup so we don't accidentally trust a stale session JSON.
        sendJson(res, 403, errorResponse('FORBIDDEN', 'Upload session not owned by caller'));
        return;
      }

      const totalChunks = Number(session.total_chunks);
      if (!Number.isInteger(totalChunks) || totalChunks < 1) {
        sendJson(res, 500, errorResponse('INTERNAL', 'Invalid upload session total_chunks'));
        return;
      }

      // Verify all chunks exist.
      const chunksCountText = execPsql(
        "select count(*)::bigint from upload_chunks where upload_id='" + quoteSqlLiteral(uploadId) + "'::uuid;"
      ).trim();
      const chunksCount = Number(chunksCountText || 0);
      if (!Number.isFinite(chunksCount) || chunksCount !== totalChunks) {
        sendJson(res, 409, errorResponse('UPLOAD_INCOMPLETE', 'Not all chunks have been uploaded'));
        return;
      }

      const tempDir = String(session.temp_dir || '');
      if (!tempDir) {
        sendJson(res, 500, errorResponse('INTERNAL', 'Upload session temp_dir missing'));
        return;
      }

      // Merge chunks into a single buffer (safe for evidence sizes). For large uploads,
      // this should stream; playbook sizes are small.
      const buffers = [];
      for (let i = 0; i < totalChunks; i += 1) {
        const chunkPath = path.join(tempDir, `chunk_${i}.bin`);
        if (!fs.existsSync(chunkPath)) {
          sendJson(res, 409, errorResponse('UPLOAD_INCOMPLETE', `Missing chunk file: ${i}`));
          return;
        }
        buffers.push(fs.readFileSync(chunkPath));
      }
      const merged = Buffer.concat(buffers);
      const mergedSha = crypto.createHash('sha256').update(merged).digest('hex');
      const mergedSize = merged.length;

      // If session declared sha256, enforce it.
      if (session.sha256 && String(session.sha256).length > 0 && String(session.sha256) !== mergedSha) {
        sendJson(res, 409, errorResponse('CHECKSUM_MISMATCH', 'Merged file sha256 does not match session.sha256'));
        return;
      }

      const volume = loadActiveVolume();
      if (!volume || !volume.id || !volume.base_path) {
        sendJson(res, 500, errorResponse('VOLUME_NOT_CONFIGURED', 'No active volume configured'));
        return;
      }

      // Dedup: reuse blob if sha256 already exists.
      let blob = loadBlobBySha256(mergedSha);
      let blobId = blob ? blob.id : null;
      let blobWasCreated = false;
      let blobPath = null;

      if (!blobId) {
        blobId = crypto.randomUUID();
        const storageKey = path.posix.join('blobs', mergedSha.slice(0, 2), `${mergedSha}.bin`);

        const basePath = path.resolve(String(volume.base_path));
        const absTarget = path.resolve(basePath, storageKey);
        const basePrefix = basePath.endsWith(path.sep) ? basePath : basePath + path.sep;
        if (absTarget !== basePath && !absTarget.startsWith(basePrefix)) {
          sendJson(res, 500, errorResponse('INTERNAL', 'Computed storage_key escapes base_path'));
          return;
        }

        fs.mkdirSync(path.dirname(absTarget), { recursive: true });

        const tmpPath = path.join(path.dirname(absTarget), `.${blobId}.tmp`);
        try {
          fs.writeFileSync(tmpPath, merged);
          fs.renameSync(tmpPath, absTarget);
        } catch (err) {
          try { fs.rmSync(tmpPath, { force: true }); } catch (_) {}
          sendJson(res, 500, errorResponse('INTERNAL', String(err && err.message ? err.message : err)));
          return;
        }

        // Insert blob metadata. If we lose a sha256 uniqueness race, reuse existing.
        try {
          execPsql(
            "begin;" +
              "insert into blobs (id, volume_id, storage_key, sha256, size_bytes, content_type, ref_count, created_at) values (" +
                "'" + quoteSqlLiteral(blobId) + "'::uuid, '" + quoteSqlLiteral(volume.id) + "'::uuid, '" + String(storageKey).replace(/'/g, "''") + "', '" + quoteSqlLiteral(mergedSha) + "'::char(64), " + Number(mergedSize) + ", " + (session.mime_type ? ("'" + String(session.mime_type).replace(/'/g, "''") + "'") : 'NULL') + ", 0, now()" +
              ");" +
            "commit;"
          );
          blobWasCreated = true;
          blobPath = absTarget;
        } catch (err) {
          const msg = String(err && err.message ? err.message : err);
          if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
            // Another request created the blob; reuse existing blob record.
            const existing = loadBlobBySha256(mergedSha);
            if (!existing) {
              sendJson(res, 500, errorResponse('INTERNAL', 'Blob dedup race without existing row'));
              return;
            }
            blobId = existing.id;
            // Do not delete absTarget here; it may belong to the winning insert.
          } else {
            sendJson(res, 500, errorResponse('INTERNAL', msg));
            return;
          }
        }
      }

      // Create node.
      let parentNode;
      try {
        parentNode = loadNodeById(session.parent_id);
      } catch (err) {
        sendJson(res, 500, errorResponse('INTERNAL', String(err)));
        return;
      }
      if (!parentNode || parentNode.type !== 'FOLDER') {
        sendJson(res, 404, errorResponse('PARENT_NOT_FOUND', 'Parent folder not found'));
        return;
      }

      // Minimal auth: owner or admin.
      const caller = loadUserById(auth.user_id);
      if (!caller) {
        sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
        return;
      }
      if (caller.role !== 'ADMIN' && String(parentNode.owner_user_id) !== String(auth.user_id)) {
        sendJson(res, 403, errorResponse('FORBIDDEN', 'No write permission for parent folder'));
        return;
      }

        let node;
        try {
          const resolvedFilename = resolveAvailableSiblingName(parentNode.id, String(session.filename));
          node = createFileNode({
            parent: parentNode,
            name: resolvedFilename,
            owner_user_id: auth.user_id,
            blob_id: blobId,
            size_bytes: mergedSize,
            mime_type: session.mime_type || null,
        });
      } catch (err) {
        const msg = String(err && err.message ? err.message : err);
        if (blobWasCreated) {
          try { execPsql("delete from blobs where id='" + quoteSqlLiteral(blobId) + "'::uuid;"); } catch (_) {}
          if (blobPath) {
            try { fs.rmSync(blobPath, { force: true }); } catch (_) {}
          }
        }
        if (msg.includes('duplicate key value') || msg.includes('idx_nodes_parent_name_active_unique')) {
          sendJson(res, 409, errorResponse('NODE_NAME_CONFLICT', 'A node with the same name already exists under this parent'));
          return;
        }
        sendJson(res, 500, errorResponse('INTERNAL', msg));
        return;
      }

      // Now that the node exists, bump blob ref_count. (Avoids leaking ref_count increments on name conflicts.)
      try {
        execPsql("update blobs set ref_count=ref_count+1 where id='" + quoteSqlLiteral(blobId) + "'::uuid;");
      } catch (err) {
        sendJson(res, 500, errorResponse('INTERNAL', String(err)));
        return;
      }

      // Mark session completed.
      try {
        execPsql(
          "update upload_sessions set status='COMPLETED', updated_at=now() where id='" + quoteSqlLiteral(uploadId) + "'::uuid;"
        );
      } catch (err) {
        sendJson(res, 500, errorResponse('INTERNAL', String(err)));
        return;
      }

      // Best-effort cleanup temp chunks.
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}

      sendJson(res, 200, {
        node_id: node.id,
        blob_id: blobId,
        sha256: mergedSha,
        size_bytes: mergedSize,
      });
      return;
    }
  }


  if (method === 'GET' && url === '/admin/volumes') {
    const authResult = requireBearerAuth(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    const caller = loadUserById(authResult.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    try {
      const rowsJson = execPsql(
        "select coalesce(json_agg(row_to_json(v)), '[]'::json) from (" +
          "select id::text as id, name, base_path, is_active, status, scan_state, scan_job_id::text as scan_job_id, scan_progress, scan_error, " +
            "to_char(scan_updated_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as scan_updated_at, " +
            "fs_type, free_bytes, total_bytes, created_at " +
          "from volumes order by created_at asc" +
        ") v;"
      ).trim();

      const items = rowsJson ? JSON.parse(rowsJson) : [];
      sendJson(res, 200, { items });
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
    }
    return;
  }

  if (method === 'POST' && url === '/admin/volumes') {
    const authResult = requireBearerAuth(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    const caller = loadUserById(authResult.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    const name = body.name;
    if (typeof name !== 'string' || name.trim().length === 0) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'name must be a non-empty string'));
      return;
    }
    if (name.length > 64) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'name maxLength is 64'));
      return;
    }

    const basePath = body.base_path;
    if (typeof basePath !== 'string' || basePath.trim().length === 0) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'base_path must be a non-empty string'));
      return;
    }

    const trimmedBasePath = basePath.trim();
    if (!path.isAbsolute(trimmedBasePath)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'base_path must be an absolute path'));
      return;
    }

    const normalized = path.resolve(trimmedBasePath);

    try {
      const volumeId = crypto.randomUUID();
      execPsql(
        "insert into volumes (id, name, base_path, is_active, status, created_at) values (" +
          `'${volumeId}', '` + String(name).replace(/'/g, "''") + `', '` + normalized.replace(/'/g, "''") + `', false, 'OK', now()` +
        ");"
      );

      const rowJson = execPsql(
        "select row_to_json(v) from (" +
          "select id::text as id, name, base_path, is_active, status, scan_state, scan_job_id::text as scan_job_id, scan_progress, scan_error, " +
            "to_char(scan_updated_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as scan_updated_at, " +
            "fs_type, free_bytes, total_bytes, created_at " +
          `from volumes where id='${volumeId}' limit 1` +
        ") v;"
      ).trim();

      if (!rowJson) {
        sendJson(res, 500, errorResponse('INTERNAL', 'Failed to load created volume'));
        return;
      }
      const createdVolume = JSON.parse(rowJson);
      try {
        createOrReuseVolumeAutoScanJob({
          volumeId,
          ownerUserId: caller.id,
          dryRun: false,
          trigger: 'create',
        });
      } catch (err) {
        updateVolumeScanState({
          volumeId,
          state: 'failed',
          jobId: null,
          progress: 1,
          errorMessage: String(err && err.message ? err.message : err),
        });
      }

      const refreshed = loadVolumeById(volumeId);
      sendJson(res, 201, refreshed || createdVolume);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
    }
    return;
  }

  if (method === 'POST' && pathname.startsWith('/admin/volumes/') && pathname.endsWith('/activate')) {
    const authResult = requireBearerAuth(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    const caller = loadUserById(authResult.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    const volumeId = pathname.slice('/admin/volumes/'.length, -('/activate'.length));
    if (!isValidUuid(volumeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'volume_id must be a UUID'));
      return;
    }

    try {
      const volume = loadVolumeById(volumeId);
      if (!volume) {
        sendJson(res, 404, errorResponse('NOT_FOUND', 'Volume not found'));
        return;
      }

      execPsql(
        "begin;" +
          "update volumes set is_active=false where is_active=true and id<>'" + quoteSqlLiteral(volumeId) + "'::uuid;" +
          "update volumes set is_active=true, scan_state='succeeded', scan_job_id=null, scan_progress=1, scan_error=null, scan_updated_at=now() " +
            "where id='" + quoteSqlLiteral(volumeId) + "'::uuid;" +
        "commit;"
      );
      const activeCountText = execPsql("select count(*)::bigint from volumes where is_active=true;").trim();
      const activeCount = Number(activeCountText || 0);
      if (!Number.isFinite(activeCount) || activeCount !== 1) {
        throw new Error('active volume postcondition failed');
      }

      const updated = loadVolumeById(volumeId);
      if (!updated) {
        sendJson(res, 500, errorResponse('INTERNAL', 'Failed to load activated volume'));
        return;
      }

      sendJson(res, 200, updated);
      if (shouldAutoScanOnActivate()) {
        setTimeout(() => {
          try {
            createOrReuseVolumeAutoScanJob({
              volumeId,
              ownerUserId: caller.id,
              dryRun: false,
              trigger: 'activate',
            });
          } catch (scanErr) {
            try {
              updateVolumeScanState({
                volumeId,
                state: 'failed',
                jobId: null,
                progress: 1,
                errorMessage: String(scanErr && scanErr.message ? scanErr.message : scanErr),
              });
            } catch {
              // ignore scan-state update failure for background activation scan
            }
          }
        }, 25);
      }
      return;
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  if (method === 'POST' && pathname.startsWith('/admin/volumes/') && pathname.endsWith('/deactivate')) {
    const authResult = requireBearerAuth(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    const caller = loadUserById(authResult.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    const volumeId = pathname.slice('/admin/volumes/'.length, -('/deactivate'.length));
    if (!isValidUuid(volumeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'volume_id must be a UUID'));
      return;
    }

    try {
      const volume = loadVolumeById(volumeId);
      if (!volume) {
        sendJson(res, 404, errorResponse('NOT_FOUND', 'Volume not found'));
        return;
      }

      execPsql(
        "update volumes set is_active=false, scan_state='succeeded', scan_job_id=null, scan_progress=1, scan_error=null, scan_updated_at=now() " +
        "where id='" + quoteSqlLiteral(volumeId) + "'::uuid;"
      );

      const updated = loadVolumeById(volumeId);
      if (!updated) {
        sendJson(res, 500, errorResponse('INTERNAL', 'Failed to load deactivated volume'));
        return;
      }

      sendJson(res, 200, updated);
      return;
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  if (method === 'DELETE' && pathname.startsWith('/admin/volumes/')) {
    const authResult = requireBearerAuth(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    const caller = loadUserById(authResult.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    const volumeId = pathname.slice('/admin/volumes/'.length);
    if (!isValidUuid(volumeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'volume_id must be a UUID'));
      return;
    }

    try {
      const volume = loadVolumeById(volumeId);
      if (!volume) {
        sendJson(res, 404, errorResponse('NOT_FOUND', 'Volume not found'));
        return;
      }
      if (volume.is_active) {
        sendJson(res, 409, errorResponse('CONFLICT', 'Active volume cannot be deleted'));
        return;
      }

      const blobCount = Number(
        execPsql("select count(*)::bigint from blobs where volume_id='" + quoteSqlLiteral(volumeId) + "'::uuid and deleted_at is null;").trim() || 0,
      );
      if (Number.isFinite(blobCount) && blobCount > 0) {
        sendJson(res, 409, errorResponse('CONFLICT', 'Volume still contains blobs'));
        return;
      }

      execPsql("delete from volumes where id='" + quoteSqlLiteral(volumeId) + "'::uuid;");
      sendJson(res, 200, { ok: true });
      return;
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  if (method === 'POST' && pathname.startsWith('/admin/volumes/') && pathname.endsWith('/scan')) {
    const authResult = requireBearerAuth(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    const caller = loadUserById(authResult.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    const volumeId = pathname.slice('/admin/volumes/'.length, -('/scan'.length));
    if (!isValidUuid(volumeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'volume_id must be a UUID'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (body === null) {
      body = {};
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body must be an object'));
      return;
    }

    const dryRun = body.dry_run === undefined ? false : body.dry_run;
    if (typeof dryRun !== 'boolean') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'dry_run must be a boolean'));
      return;
    }

    try {
      const job = createOrReuseVolumeAutoScanJob({
        volumeId,
        ownerUserId: caller.id,
        dryRun,
        trigger: 'manual',
      });
      sendJson(res, 202, job);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
    }
    return;
  }

  if (method === 'POST' && url === '/admin/volumes/validate-path') {
    const authResult = requireBearerAuth(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    const caller = loadUserById(authResult.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    const basePath = body.base_path;
    if (typeof basePath !== 'string' || basePath.trim().length === 0) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'base_path must be a non-empty string'));
      return;
    }

    const normalized = path.resolve(basePath);

    let st;
    try {
      st = fs.statSync(normalized);
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err.code === 'ENOENT' || err.code === 'EACCES')) {
        // Playbook P3-T1: non-existent or permission-denied path => 400
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'Invalid base_path'));
        return;
      }
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!st.isDirectory()) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'base_path must be a directory'));
      return;
    }

    let writable = true;
    let message;
    try {
      checkWritableDir(normalized);
    } catch (err) {
      writable = false;
      message = String(err);
    }

    let freeBytes = 0;
    let totalBytes = 0;
    try {
      const bytes = statFsBytes(normalized);
      freeBytes = bytes.free_bytes;
      totalBytes = bytes.total_bytes;
    } catch (err) {
      // statfs may fail on some platforms; keep response consistent.
      message = message || `statfs failed: ${String(err)}`;
    }

    const resp = {
      ok: true,
      writable,
      free_bytes: freeBytes,
      total_bytes: totalBytes,
      message,
    };

    sendJson(res, 200, resp);
    return;
  }

  if (method === 'POST' && url === '/admin/storage/scan') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (body === null) {
      body = {};
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body must be an object'));
      return;
    }

    const deleteOrphanFiles = body.delete_orphan_files === undefined ? false : body.delete_orphan_files;
    if (typeof deleteOrphanFiles !== 'boolean') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'delete_orphan_files must be a boolean'));
      return;
    }

    const deleteOrphanDbRows = body.delete_orphan_db_rows === undefined ? false : body.delete_orphan_db_rows;
    if (typeof deleteOrphanDbRows !== 'boolean') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'delete_orphan_db_rows must be a boolean'));
      return;
    }

    let volume;
    try {
      volume = loadActiveVolume();
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!volume) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Active volume not found'));
      return;
    }

    const job = createScanCleanupJob({
      volume_id: volume.id,
      delete_orphan_files: deleteOrphanFiles,
      delete_orphan_db_rows: deleteOrphanDbRows,
    });
    sendJson(res, 202, job);
    return;
  }

  if (method === 'POST' && url === '/admin/migrations') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    const targetVolumeId = body.target_volume_id;
    if (typeof targetVolumeId !== 'string' || targetVolumeId.trim().length === 0 || !isValidUuid(targetVolumeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'target_volume_id must be a UUID'));
      return;
    }

    const verifySha256 = body.verify_sha256 === undefined ? true : body.verify_sha256;
    if (typeof verifySha256 !== 'boolean') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'verify_sha256 must be a boolean'));
      return;
    }

    const deleteSourceAfter = body.delete_source_after === undefined ? false : body.delete_source_after;
    if (typeof deleteSourceAfter !== 'boolean') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'delete_source_after must be a boolean'));
      return;
    }

    let volume;
    try {
      volume = loadVolumeById(targetVolumeId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!volume) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Target volume not found'));
      return;
    }

    const job = createMigrationJob({
      target_volume_id: targetVolumeId,
      verify_sha256: verifySha256,
      delete_source_after: deleteSourceAfter,
    });
    sendJson(res, 202, job);
    return;
  }

  if (method === 'GET' && pathname === '/jobs') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    const cursorResult = parseCursorParam(query.get('cursor'));
    if (!cursorResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', cursorResult.error));
      return;
    }

    const limitResult = parseSearchLimitQueryParam(query.get('limit'), 50);
    if (!limitResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', limitResult.error));
      return;
    }

    const typeFilter = query.get('type');
    const statusFilter = query.get('status');
    if (typeFilter && typeFilter !== 'null' && !JOB_TYPES.has(typeFilter)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'type must be a valid job type'));
      return;
    }
    if (statusFilter && statusFilter !== 'null' && !JOB_STATUSES.has(statusFilter)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'status must be a valid job status'));
      return;
    }

    const result = listJobs({
      type: typeFilter && typeFilter !== 'null' ? typeFilter : null,
      status: statusFilter && statusFilter !== 'null' ? statusFilter : null,
      cursor: cursorResult.value,
      limit: limitResult.value,
    });
    sendJson(res, 200, result);
    return;
  }

  if (method === 'GET' && pathname.startsWith('/jobs/')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN') {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'Admin role required'));
      return;
    }

    const jobId = pathname.slice('/jobs/'.length);
    if (!jobId || !isValidUuid(jobId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'job_id must be a UUID'));
      return;
    }

    const job = jobStore.get(jobId);
    if (!job) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Job not found'));
      return;
    }

    sendJson(res, 200, job);
    return;
  }

  if (method === 'POST' && url === '/nodes/folders') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    const parentId = body.parent_id;
    const name = body.name;

    if (typeof parentId !== 'string' || parentId.trim().length === 0) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'parent_id must be a non-empty UUID string'));
      return;
    }

    if (!/^[0-9a-fA-F-]{36}$/.test(parentId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'parent_id must be a UUID'));
      return;
    }

    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'name must be a non-empty string (<=255)'));
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    let parent;
    try {
      parent = loadNodeById(parentId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!parent || parent.type !== 'FOLDER') {
      sendJson(res, 404, errorResponse('PARENT_NOT_FOUND', 'Parent folder not found'));
      return;
    }

    // Authorization: must be able to write under the parent folder.
    // Minimal rule until ACLs are introduced: owner or admin.
    if (caller.role !== 'ADMIN' && String(parent.owner_user_id) !== String(auth.user_id)) {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'No write permission for parent folder'));
      return;
    }

    try {
      const node = createFolderNode({ parent, name: name.trim(), owner_user_id: auth.user_id });
      sendJson(res, 201, node);
      return;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      // Postgres unique violation
      if (msg.includes('duplicate key value') || msg.includes('idx_nodes_parent_name_active_unique')) {
        sendJson(res, 409, errorResponse('NODE_NAME_CONFLICT', 'A node with the same name already exists under this parent'));
        return;
      }
      sendJson(res, 500, errorResponse('INTERNAL', msg));
      return;
    }
  }

  if (method === 'POST' && pathname.startsWith('/nodes/') && pathname.endsWith('/rename')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length, -('/rename'.length));
    if (!nodeId || nodeId.includes('/') || !isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    const nameResult = normalizeNodeName(body.new_name);
    if (!nameResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', nameResult.error));
      return;
    }

    let target;
    try {
      target = loadNodeById(nodeId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
    if (!target) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    if (!target.parent_id) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Cannot rename root node'));
      return;
    }

    if (!ensureUniqueInParent(target.parent_id, nameResult.value, target.id)) {
      sendJson(res, 409, errorResponse('NODE_NAME_CONFLICT', 'A node with the same name already exists under this parent'));
      return;
    }

    try {
      execPsql("update nodes set name='" + nameResult.value.replace(/'/g, "''") + "', updated_at=now() where id='" + quoteSqlLiteral(target.id) + "'::uuid;");
      const updated = loadNodeById(target.id);
      sendJson(res, 200, updated);
      return;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes('duplicate key value') || msg.includes('idx_nodes_parent_name_active_unique')) {
        sendJson(res, 409, errorResponse('NODE_NAME_CONFLICT', 'A node with the same name already exists under this parent'));
        return;
      }
      sendJson(res, 500, errorResponse('INTERNAL', msg));
      return;
    }
  }

  if (method === 'POST' && pathname.startsWith('/nodes/') && pathname.endsWith('/move')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length, -('/move'.length));
    if (!nodeId || nodeId.includes('/') || !isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    const destinationParentId = body.destination_parent_id;
    let finalName = body.new_name === undefined ? null : normalizeNodeName(body.new_name);
    if (finalName && !finalName.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', finalName.error));
      return;
    }
    const nextName = finalName ? finalName.value : null;

    if (!isValidUuid(destinationParentId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'destination_parent_id must be a UUID'));
      return;
    }

    let node;
    let destination;
    try {
      node = loadNodeById(nodeId);
      destination = loadNodeById(destinationParentId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!node || !destination) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    if (destination.type !== 'FOLDER') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'destination parent must be a folder'));
      return;
    }

    if (node.id === destination.id || isAncestorPath(node.path, destination.path)) {
      sendJson(res, 409, errorResponse('INVALID_OPERATION', 'Cannot move a node into its own subtree'));
      return;
    }

    const newName = nextName || node.name;
    if (!ensureUniqueInParent(destination.id, newName, node.id)) {
      sendJson(res, 409, errorResponse('NODE_NAME_CONFLICT', 'A node with the same name already exists under this parent'));
      return;
    }

    try {
      const sourcePath = node.path;
      const subtree = loadNodeDescendantsByPath(sourcePath);
      const rootLabel = uuidToLtreeLabel(node.id);
      const movedRootPath = `${destination.path}.${rootLabel}`;

      for (const item of subtree) {
        const newPath = item.id === node.id
          ? movedRootPath
          : `${destination.path}.${rootLabel}.${item.path.slice(sourcePath.length + 1)}`;

        const parentId = item.id === node.id ? destination.id : item.parent_id;
        const name = item.id === node.id ? newName : item.name;

        updateNodePath(item.id, parentId, name, newPath);
      }

      const updated = loadNodeById(node.id);
      sendJson(res, 200, updated);
      return;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes('duplicate key value') || msg.includes('idx_nodes_parent_name_active_unique')) {
        sendJson(res, 409, errorResponse('NODE_NAME_CONFLICT', 'A node with the same name already exists under this parent'));
        return;
      }
      sendJson(res, 500, errorResponse('INTERNAL', msg));
      return;
    }
  }

  if (method === 'POST' && pathname.startsWith('/nodes/') && pathname.endsWith('/copy')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length, -('/copy'.length));
    if (!nodeId || nodeId.includes('/') || !isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body is required'));
      return;
    }

    const destinationParentId = body.destination_parent_id;
    if (!isValidUuid(destinationParentId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'destination_parent_id must be a UUID'));
      return;
    }

    const copyNameResult = body.new_name === undefined
      ? { ok: true, value: null }
      : normalizeNodeName(body.new_name);
    if (!copyNameResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', copyNameResult.error));
      return;
    }

    let source;
    let destination;
    try {
      source = loadNodeById(nodeId);
      destination = loadNodeById(destinationParentId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!source || !destination) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    if (destination.type !== 'FOLDER') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'destination parent must be a folder'));
      return;
    }

    if (isAncestorPath(source.path, destination.path) || source.id === destination.id) {
      sendJson(res, 409, errorResponse('INVALID_OPERATION', 'Cannot copy into own subtree'));
      return;
    }

    const rootName = copyNameResult.value || source.name;
    const sourcePath = source.path;
    const sourceSubnodes = loadNodeDescendantsByPath(sourcePath);
    if (!sourceSubnodes.length) {
      sendJson(res, 500, errorResponse('INTERNAL', 'Failed to load source nodes'));
      return;
    }

    if (!ensureUniqueInParent(destination.id, rootName, null)) {
      sendJson(res, 409, errorResponse('NODE_NAME_CONFLICT', 'A node with the same name already exists under this parent'));
      return;
    }

    try {
      const copiedRootId = crypto.randomUUID();
      const newRootLabel = uuidToLtreeLabel(copiedRootId);
      const copiedRootPath = `${destination.path}.${newRootLabel}`;

      execPsql(
        "insert into nodes (id, type, parent_id, name, path, owner_user_id, blob_id, size_bytes, mime_type, metadata, created_at, updated_at) values (" +
          "'" + quoteSqlLiteral(copiedRootId) + "'::uuid, '" + String(source.type).replace(/'/g, "''") + "', '" + quoteSqlLiteral(destination.id) + "'::uuid, '" + String(rootName).replace(/'/g, "''") + "', '" + copiedRootPath + "'::ltree, '" + quoteSqlLiteral(source.owner_user_id) + "'::uuid, " +
          (source.blob_id ? "'" + quoteSqlLiteral(source.blob_id) + "'::uuid" : 'null') + ", " + Number(source.size_bytes || 0) + ", " +
          (source.mime_type == null ? 'null' : "'" + String(source.mime_type).replace(/'/g, "''") + "'::text") + ", '" + JSON.stringify(source.metadata || {}).replace(/'/g, "''") + "'::jsonb, now(), now()" +
        ")"
      );

      const copyByOldId = new Map();
      copyByOldId.set(source.id, copiedRootId);

      for (const item of sourceSubnodes.slice(1)) {
        const copiedId = crypto.randomUUID();
        const parentNewId = copyByOldId.get(item.parent_id);
        if (!parentNewId) {
          sendJson(res, 500, errorResponse('INTERNAL', 'Parent copy id missing'));
          return;
        }

        const remaining = item.path.slice(sourcePath.length + 1);
        const copiedPath = `${copiedRootPath}.${remaining}`;

        execPsql(
          "insert into nodes (id, type, parent_id, name, path, owner_user_id, blob_id, size_bytes, mime_type, metadata, created_at, updated_at) values (" +
            "'" + quoteSqlLiteral(copiedId) + "'::uuid, '" + String(item.type).replace(/'/g, "''") + "', '" + quoteSqlLiteral(parentNewId) + "'::uuid, '" + String(item.name).replace(/'/g, "''") + "', '" + copiedPath + "'::ltree, '" + quoteSqlLiteral(item.owner_user_id) + "'::uuid, " +
            (item.blob_id ? "'" + quoteSqlLiteral(item.blob_id) + "'::uuid" : 'null') + ", " + Number(item.size_bytes || 0) + ", " +
            (item.mime_type == null ? 'null' : "'" + String(item.mime_type).replace(/'/g, "''") + "'::text") + ", '" + JSON.stringify(item.metadata || {}).replace(/'/g, "''") + "'::jsonb, now(), now()" +
          ")"
        );

        copyByOldId.set(item.id, copiedId);
      }

      const copiedRoot = loadNodeById(copiedRootId);
      sendJson(res, 201, copiedRoot);
      return;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes('duplicate key value') || msg.includes('idx_nodes_parent_name_active_unique')) {
        sendJson(res, 409, errorResponse('NODE_NAME_CONFLICT', 'A node with the same name already exists under this parent'));
        return;
      }
      sendJson(res, 500, errorResponse('INTERNAL', msg));
      return;
    }
  }

  if (method === 'DELETE' && pathname.startsWith('/nodes/') && pathname.length > '/nodes/'.length) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length);
    if (!nodeId || nodeId.includes('/') || !isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    let node;
    try {
      node = loadNodeById(nodeId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!node) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    if (!node.parent_id) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Cannot delete root node'));
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    if (caller.role !== 'ADMIN' && String(caller.id) !== String(node.owner_user_id)) {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'No delete permission for node'));
      return;
    }

    try {
      const targetPath = quoteSqlLiteral(node.path);
      execPsql(
        "update nodes set deleted_at=now(), updated_at=now() where path <@ '" + targetPath + "'::ltree and deleted_at is null;"
      );
      sendJson(res, 200, { ok: true });
      return;
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  if (method === 'POST' && pathname.startsWith('/nodes/') && pathname.endsWith('/share-links')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length, -('/share-links'.length));
    if (!nodeId || nodeId.includes('/') || !isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    const node = loadNodeById(nodeId);
    if (!node) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }
    if (caller.role !== 'ADMIN' && String(node.owner_user_id) !== String(caller.id)) {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'No share permission for node'));
      return;
    }

    let body = null;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (body !== null && (typeof body !== 'object' || Array.isArray(body))) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body must be an object'));
      return;
    }

    let expiresInSeconds = SHARE_DEFAULT_EXPIRES_SECONDS;
    if (body && Object.prototype.hasOwnProperty.call(body, 'expires_in_seconds')) {
      if (!Number.isInteger(body.expires_in_seconds)) {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'expires_in_seconds must be an integer'));
        return;
      }
      expiresInSeconds = body.expires_in_seconds;
    }

    if (expiresInSeconds < 300 || expiresInSeconds > SHARE_MAX_EXPIRES_SECONDS) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'expires_in_seconds out of range'));
      return;
    }

    let permission = 'READ';
    if (body && Object.prototype.hasOwnProperty.call(body, 'permission')) {
      if (typeof body.permission !== 'string') {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'permission must be a string'));
        return;
      }
      permission = body.permission;
    }

    if (permission !== 'READ' && permission !== 'READ_WRITE') {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'permission must be READ or READ_WRITE'));
      return;
    }

    let passwordHash = null;
    if (body && Object.prototype.hasOwnProperty.call(body, 'password')) {
      // If the client explicitly sends a password field, it must be a valid string.
      // Reject null to avoid silently creating an unprotected link due to client serialization bugs.
      if (body.password === null) {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'password must be a string'));
        return;
      }
      if (body.password !== undefined) {
        if (typeof body.password !== 'string') {
          sendJson(res, 400, errorResponse('BAD_REQUEST', 'password must be a string'));
          return;
        }
        if (body.password.length < SHARE_PASSWORD_MIN_LENGTH || body.password.length > 128) {
          sendJson(res, 400, errorResponse('BAD_REQUEST', 'password length out of range'));
          return;
        }
        passwordHash = hashPassword(body.password);
      }
    }

    const shareId = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString('base64url');
    const tokenHashHex = hashInviteToken(token);

    let rowJson = '';
    try {
      rowJson = execPsql(
        "insert into share_links (id, node_id, token_hash, password_hash, permission, created_at, expires_at, revoked_at) values (" +
          "'" + quoteSqlLiteral(shareId) + "'::uuid, " +
          "'" + quoteSqlLiteral(nodeId) + "'::uuid, " +
          "decode('" + tokenHashHex + "','hex'), " +
          (passwordHash ? ("'" + String(passwordHash).replace(/'/g, "''") + "'") : 'NULL') + ", " +
          "'" + String(permission).replace(/'/g, "''") + "', " +
          "now(), " +
          "now() + interval '" + Number(expiresInSeconds) + " seconds', " +
          "NULL" +
        ") returning json_build_object(" +
          "'id', id::text, " +
          "'node_id', node_id::text, " +
          "'permission', permission, " +
          "'created_at', to_char(created_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), " +
          "'expires_at', to_char(expires_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), " +
          "'password_required', (password_hash is not null)" +
        ")::text;"
      ).trim();
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', 'Failed to create share link'));
      return;
    }

    if (!rowJson) {
      sendJson(res, 500, errorResponse('INTERNAL', 'Failed to create share link'));
      return;
    }

    const share = JSON.parse(rowJson);
    share.token = token;
    sendJson(res, 201, share);
    return;
  }

  if (method === 'GET' && pathname.startsWith('/nodes/') && pathname.endsWith('/acl')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length, -('/acl'.length));
    if (!nodeId || !isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    let node;
    try {
      node = loadNodeById(nodeId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!node) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    if (caller.role !== 'ADMIN' && String(caller.id) !== String(node.owner_user_id)) {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'No ACL access permission'));
      return;
    }

    try {
      const entries = loadAclEntriesByNodeId(nodeId);
      sendJson(res, 200, { entries });
      return;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes('relation "acl_entries" does not exist')) {
        sendJson(res, 500, errorResponse('INTERNAL', 'ACL table is not initialized'));
        return;
      }
      sendJson(res, 500, errorResponse('INTERNAL', msg));
      return;
    }
  }

  if (method === 'PUT' && pathname.startsWith('/nodes/') && pathname.endsWith('/acl')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length, -('/acl'.length));
    if (!nodeId || !isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    let node;
    try {
      node = loadNodeById(nodeId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!node) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    if (caller.role !== 'ADMIN' && String(caller.id) !== String(node.owner_user_id)) {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'No ACL modify permission'));
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', String(err)));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Request body must be an object'));
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(body, 'entries')) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'entries is required'));
      return;
    }

    const parsed = parseAclRequestEntries(body.entries);
    if (!parsed.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', parsed.error));
      return;
    }

    const safeNodeId = quoteSqlLiteral(nodeId);
    try {
      // Atomic replacement: delete + insert must succeed/fail together.
      // Otherwise a mid-way failure could leave the node with an empty/partial ACL.
      let tx = 'begin;';
      tx += "delete from acl_entries where node_id='" + safeNodeId + "'::uuid;";

      if (parsed.value.length > 0) {
        const valuesSql = parsed.value.map((entry) => {
          const principalType = String(entry.principal_type).replace(/'/g, "''");
          const principalId = String(entry.principal_id).replace(/'/g, "''");
          const effect = String(entry.effect).replace(/'/g, "''");
          const permissions = entry.permissions.map((perm) => "'" + String(perm).replace(/'/g, "''") + "'").join(',');
          const inheritable = entry.inheritable ? 'true' : 'false';
          return (
            "('" + crypto.randomUUID() + "'::uuid, '" + safeNodeId + "'::uuid, '" + principalType + "', '" + principalId + "', '" + effect + "', ARRAY[" + permissions + "]::text[], " + inheritable + ")"
          );
        }).join(',');

        tx +=
          'insert into acl_entries (id, node_id, principal_type, principal_id, effect, permissions, inheritable) values ' + valuesSql + ';';
      }

      tx += 'commit;';
      execPsql(tx);

      const entries = loadAclEntriesByNodeId(nodeId);
      sendJson(res, 200, { entries });
      return;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes('relation "acl_entries" does not exist')) {
        sendJson(res, 500, errorResponse('INTERNAL', 'ACL table is not initialized'));
        return;
      }
      sendJson(res, 500, errorResponse('INTERNAL', msg));
      return;
    }
  }

  if (method === 'GET' && pathname.startsWith('/nodes/') && pathname.endsWith('/access')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length, -('/access'.length));
    if (!nodeId || !isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    let node;
    try {
      node = loadNodeById(nodeId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!node) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    const allPermissions = ['READ', 'WRITE', 'DELETE', 'SHARE'];
    if (caller.role === 'ADMIN' || String(caller.id) === String(node.owner_user_id)) {
      sendJson(res, 200, { node_id: nodeId, allowed: allPermissions, reason: null });
      return;
    }

    try {
      const ancestors = loadNodeAncestorsByPath(node.path);
      const allowed = new Set();

      for (const ancestor of ancestors) {
        const isSelf = String(ancestor.id) === String(nodeId);
        const entries = loadAclEntriesForPrincipal(ancestor.id, 'USER', caller.id, !isSelf);
        for (const entry of entries) {
          const effect = entry && entry.effect ? String(entry.effect) : '';
          const permissions = Array.isArray(entry && entry.permissions) ? entry.permissions : [];
          if (effect === 'ALLOW') {
            for (const perm of permissions) {
              allowed.add(perm);
            }
          } else if (effect === 'DENY') {
            for (const perm of permissions) {
              allowed.delete(perm);
            }
          }
        }
      }

      sendJson(res, 200, { node_id: nodeId, allowed: Array.from(allowed), reason: null });
      return;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes('relation "acl_entries" does not exist')) {
        sendJson(res, 500, errorResponse('INTERNAL', 'ACL table is not initialized'));
        return;
      }
      sendJson(res, 500, errorResponse('INTERNAL', msg));
      return;
    }
  }

  if (method === 'GET' && pathname.startsWith('/s/') && pathname.length > '/s/'.length) {
    // Public share endpoints (no bearer auth)
    // SSOT: openapi/openapi.yaml paths./s/{token}.*

    const rest = pathname.slice('/s/'.length);
    const parts = rest.split('/');
    if (parts.length !== 1 && !(parts.length === 2 && parts[1] === 'download')) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Invalid share URL'));
      return;
    }

    const token = parts[0];
    const maybeDownload = parts[1];

    if (!token || token.length < 10 || token.length > 200) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'token must be a string'));
      return;
    }

    // base64url-ish token expected; allow only url-safe chars to avoid ambiguous routing
    if (!/^[A-Za-z0-9_-]+$/.test(token)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'token has invalid format'));
      return;
    }

    const tokenHashHex = hashInviteToken(token);

    let shareRowJson = '';
    try {
      shareRowJson = execPsql(
        "select row_to_json(s) from (" +
          "select id::text as id, node_id::text as node_id, permission, password_hash, " +
            "to_char(created_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at, " +
            "to_char(expires_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as expires_at " +
          "from share_links " +
          "where token_hash=decode('" + tokenHashHex + "','hex') and revoked_at is null and expires_at > now() " +
          "limit 1" +
        ") s;"
      ).trim();
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', 'Failed to load share link'));
      return;
    }

    if (!shareRowJson) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Share link not found'));
      return;
    }

    const share = JSON.parse(shareRowJson);

    if (share.password_hash) {
      const provided = req.headers['x-share-password'];
      if (!provided || typeof provided !== 'string') {
        sendJson(res, 403, errorResponse('FORBIDDEN', 'Share password required'));
        return;
      }

      const stored = String(share.password_hash);
      const parts = stored.split(':');
      if (parts.length !== 3 || parts[0] !== 'sha256') {
        sendJson(res, 500, errorResponse('INTERNAL', 'Unsupported password hash format'));
        return;
      }

      const salt = parts[1];
      const expectedDigest = parts[2];
      const actualDigest = crypto
        .createHash('sha256')
        .update(`${salt}:${String(provided)}`)
        .digest('hex');

      const ok = crypto.timingSafeEqual(
        Buffer.from(expectedDigest, 'hex'),
        Buffer.from(actualDigest, 'hex')
      );

      if (!ok) {
        sendJson(res, 403, errorResponse('FORBIDDEN', 'Invalid share password'));
        return;
      }
    }

    let node;
    try {
      node = loadNodeById(share.node_id);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!node) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    if (maybeDownload === 'download') {
      if (node.type !== 'FILE') {
        sendJson(res, 409, errorResponse('CONFLICT', 'Node is not a file'));
        return;
      }

      if (!node.blob_id) {
        sendJson(res, 409, errorResponse('CONFLICT', 'Node has no blob'));
        return;
      }

      let blob;
      try {
        blob = loadBlobById(node.blob_id);
      } catch (err) {
        sendJson(res, 500, errorResponse('INTERNAL', String(err)));
        return;
      }

      if (!blob) {
        sendJson(res, 404, errorResponse('NOT_FOUND', 'Blob not found'));
        return;
      }

      const filePathResult = resolveBlobAbsolutePath(blob);
      if (!filePathResult.ok) {
        sendJson(res, 500, errorResponse('INTERNAL', filePathResult.error));
        return;
      }

      const filePath = filePathResult.value;

      let st;
      try {
        st = fs.statSync(filePath);
      } catch {
        sendJson(res, 404, errorResponse('NOT_FOUND', 'Blob content missing'));
        return;
      }

      const totalSize = Number(st.size);
      const rangeParsed = parseHttpRangeHeader(req.headers.range, totalSize);
      if (!rangeParsed.ok) {
        const status = rangeParsed.status || 400;
        if (status === 416) {
          res.setHeader('Content-Range', `bytes */${totalSize}`);
          sendJson(res, 416, errorResponse('RANGE_NOT_SATISFIABLE', rangeParsed.error));
          return;
        }
        sendJson(res, status, errorResponse('BAD_REQUEST', rangeParsed.error));
        return;
      }

      const range = rangeParsed.value;
      const contentType = 'application/octet-stream';
      res.setHeader('Accept-Ranges', 'bytes');

      if (!range) {
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', String(totalSize));

        const stream = fs.createReadStream(filePath);
        stream.on('error', (err) => {
          if (!res.headersSent) {
            sendJson(res, 500, errorResponse('INTERNAL', String(err)));
          }
        });
        stream.pipe(res);
        return;
      }

      const length = range.end - range.start + 1;
      res.statusCode = 206;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(length));
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${range.total}`);

      const stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
      stream.on('error', (err) => {
        if (!res.headersSent) {
          sendJson(res, 500, errorResponse('INTERNAL', String(err)));
        }
      });
      stream.pipe(res);
      return;
    }

    // /s/{token}
    if (maybeDownload && maybeDownload.length > 0) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Not found'));
      return;
    }

    sendJson(res, 200, node);
    return;
  }

  if (method === 'POST' && pathname.startsWith('/trash/') && pathname.endsWith('/restore')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/trash/'.length, -('/restore'.length));
    if (!nodeId || nodeId.includes('/') || !isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    let deletedNode;
    try {
      deletedNode = loadDeletedNodeById(nodeId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!deletedNode) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    if (!deletedNode.parent_id) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Cannot restore root node'));
      return;
    }

    if (caller.role !== 'ADMIN' && String(caller.id) !== String(deletedNode.owner_user_id)) {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'No restore permission for node'));
      return;
    }

    let parent;
    try {
      parent = loadNodeById(deletedNode.parent_id);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!parent) {
      sendJson(res, 409, errorResponse('CONFLICT', 'Parent node is missing or deleted'));
      return;
    }

    if (!ensureUniqueInParent(deletedNode.parent_id, deletedNode.name, deletedNode.id)) {
      sendJson(res, 409, errorResponse('CONFLICT', 'A node with the same name already exists in parent'));
      return;
    }

    try {
      // IMPORTANT: Restore must rebuild ltree paths from the *current* parent location.
      // Deleted subtrees can have stale paths if an ancestor moved while they were deleted,
      // because move logic updates only active descendants.
      const oldRootPath = quoteSqlLiteral(deletedNode.path);

      const subtreeJson = execPsql(
        "select coalesce(json_agg(row_to_json(t)), '[]'::json) from (" +
          "select id::text as id, parent_id::text as parent_id from nodes where path <@ '" + oldRootPath + "'::ltree" +
        ") t;"
      ).trim();

      const subtree = subtreeJson ? JSON.parse(subtreeJson) : [];
      const childrenByParent = new Map();
      for (const row of Array.isArray(subtree) ? subtree : []) {
        const pid = row.parent_id || null;
        if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
        childrenByParent.get(pid).push(row.id);
      }

      const newPathById = new Map();
      const rootNewPath = `${String(parent.path)}.${uuidToLtreeLabel(nodeId)}`;
      newPathById.set(nodeId, rootNewPath);

      const queue = [nodeId];
      while (queue.length > 0) {
        const currentId = queue.shift();
        const currentPath = newPathById.get(currentId);
        const kids = childrenByParent.get(currentId) || [];
        for (const kidId of kids) {
          const kidPath = `${currentPath}.${uuidToLtreeLabel(kidId)}`;
          newPathById.set(kidId, kidPath);
          queue.push(kidId);
        }
      }

      // Update paths + undelete in topological order (parents first).
      for (const [id, nextPath] of newPathById.entries()) {
        execPsql(
          "update nodes set path='" + String(nextPath).replace(/'/g, "''") + "'::ltree, deleted_at=null, updated_at=now() where id='" + quoteSqlLiteral(id) + "'::uuid;"
        );
      }

      const restored = loadNodeById(nodeId);
      if (!restored) {
        sendJson(res, 500, errorResponse('INTERNAL', 'Restore succeeded but node re-load failed'));
        return;
      }

      sendJson(res, 200, restored);
      return;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes('duplicate key value') || msg.includes('idx_nodes_parent_name_active_unique')) {
        sendJson(res, 409, errorResponse('CONFLICT', 'Name conflict while restoring nodes'));
        return;
      }
      sendJson(res, 500, errorResponse('INTERNAL', msg));
      return;
    }
  }

  if (method === 'DELETE' && pathname.startsWith('/trash/')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/trash/'.length);
    if (!nodeId || nodeId.includes('/') || !isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    let deletedNode;
    try {
      deletedNode = loadDeletedNodeById(nodeId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!deletedNode) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    if (!deletedNode.parent_id) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'Cannot hard-delete root node'));
      return;
    }

    if (caller.role !== 'ADMIN' && String(caller.id) !== String(deletedNode.owner_user_id)) {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'No delete permission for node'));
      return;
    }

    try {
      const oldRootPath = quoteSqlLiteral(deletedNode.path);

      // Collect blob reference counts in the deleted subtree.
      const blobCountsJson = execPsql(
        "select coalesce(json_agg(row_to_json(t)), '[]'::json) from (" +
          "select blob_id::text as blob_id, count(*)::int as n " +
          "from nodes " +
          "where deleted_at is not null and type='FILE' and blob_id is not null and path <@ '" + oldRootPath + "'::ltree " +
          "group by blob_id" +
        ") t;"
      ).trim();

      const blobCounts = blobCountsJson ? JSON.parse(blobCountsJson) : [];

      // Delete nodes first? No: if something fails while decrementing blobs we can retry safely;
      // but we must avoid dropping node references without decrementing ref_count.
      // So: (1) decrement ref_count, (2) delete nodes rows.
      for (const row of Array.isArray(blobCounts) ? blobCounts : []) {
        const blobId = row && row.blob_id ? String(row.blob_id) : '';
        const n = row && Number.isFinite(Number(row.n)) ? Number(row.n) : 0;
        if (!blobId || !isValidUuid(blobId) || n <= 0) continue;
        execPsql(
          "update blobs set ref_count=greatest(ref_count-" + n + ", 0) where id='" + quoteSqlLiteral(blobId) + "'::uuid;"
        );
      }

      // Delete the deleted subtree nodes.
      execPsql(
        "delete from nodes where deleted_at is not null and path <@ '" + oldRootPath + "'::ltree;"
      );

      // If any blobs reached 0, mark deleted_at and remove physical file (best-effort).
      for (const row of Array.isArray(blobCounts) ? blobCounts : []) {
        const blobId = row && row.blob_id ? String(row.blob_id) : '';
        if (!blobId || !isValidUuid(blobId)) continue;

        let blob;
        try {
          blob = loadBlobById(blobId);
        } catch (_) {
          blob = null;
        }

        if (!blob) continue;
        if (Number(blob.ref_count || 0) !== 0) continue;

        try {
          execPsql("update blobs set deleted_at=now() where id='" + quoteSqlLiteral(blobId) + "'::uuid and deleted_at is null;");
        } catch (_) {}

        try {
          const filePathResult = resolveBlobAbsolutePath(blob);
          if (filePathResult.ok) {
            fs.rmSync(filePathResult.value, { force: true });
          }
        } catch (_) {}
      }

      sendJson(res, 200, { ok: true });
      return;
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  if (method === 'GET' && pathname === '/trash') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    const query = parsedUrl.searchParams;
    const cursorResult = parseCursorParam(query.get('cursor'));
    if (!cursorResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', cursorResult.error));
      return;
    }

    const limitResult = parseLimitQueryParam(query.get('limit'), 100);
    if (!limitResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', limitResult.error));
      return;
    }

    try {
      const result = listTrashNodes({
        limit: limitResult.value,
        cursor: cursorResult.value,
        ownerUserId: caller.id,
        includeAll: caller.role === 'ADMIN'
      });
      sendJson(res, 200, result);
      return;
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  if (method === 'GET' && pathname === '/search') {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    const query = parsedUrl.searchParams;
    const rawQuery = query.get('q');
    const trimmedQuery = rawQuery ? rawQuery.trim() : '';
    if (trimmedQuery.length === 0) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'q is required'));
      return;
    }
    if (trimmedQuery.length > 256) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'q maxLength is 256'));
      return;
    }

    const rawParent = query.get('parent_id');
    let parentId = null;
    if (rawParent && rawParent !== 'null') {
      if (!isValidUuid(rawParent)) {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'parent_id must be a UUID'));
        return;
      }
      parentId = rawParent;
    }

    const rawType = query.get('type');
    let nodeType = null;
    if (rawType && rawType !== 'null') {
      if (rawType !== 'FOLDER' && rawType !== 'FILE') {
        sendJson(res, 400, errorResponse('BAD_REQUEST', 'type must be FILE or FOLDER'));
        return;
      }
      nodeType = rawType;
    }

    const cursorResult = parseCursorParam(query.get('cursor'));
    if (!cursorResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', cursorResult.error));
      return;
    }

    const limitResult = parseSearchLimitQueryParam(query.get('limit'), 50);
    if (!limitResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', limitResult.error));
      return;
    }

    const includeMetadataResult = parseBooleanQueryParam(query.get('include_metadata'), false);
    if (!includeMetadataResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', includeMetadataResult.error));
      return;
    }

    try {
      const result = searchNodes({
        queryText: trimmedQuery,
        parentId,
        type: nodeType,
        limit: limitResult.value,
        cursor: cursorResult.value,
        ownerUserId: caller.id,
        includeAll: caller.role === 'ADMIN',
        includeMetadata: includeMetadataResult.value
      });
      sendJson(res, 200, result);
      return;
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  if (method === 'GET' && pathname.startsWith('/nodes/') && pathname.endsWith('/children')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length, -('/children'.length));
    if (!nodeId || nodeId.includes('/')) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    if (!isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    let parent;
    try {
      parent = loadNodeById(nodeId);
      if (!parent && nodeId === '00000000-0000-0000-0000-000000000001') {
        parent = ensureRootFolderForUser(auth.user_id);
      }
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!parent) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    const isGlobalRootNode = nodeId === '00000000-0000-0000-0000-000000000001';
    if (!isGlobalRootNode && caller.role !== 'ADMIN' && String(parent.owner_user_id) !== String(auth.user_id)) {
      sendJson(res, 403, errorResponse('FORBIDDEN', 'No read permission for node'));
      return;
    }

    const includeDeletedResult = parseBooleanQueryParam(query.get('include_deleted'), false);
    if (!includeDeletedResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', includeDeletedResult.error));
      return;
    }

    const limitResult = parseLimitQueryParam(query.get('limit'), 100);
    if (!limitResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', limitResult.error));
      return;
    }

    const sortResult = parseNodeChildrenSort(query.get('sort'));
    if (!sortResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', sortResult.error));
      return;
    }

    const orderResult = parseNodeChildrenOrder(query.get('order'));
    if (!orderResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', orderResult.error));
      return;
    }

    const cursorResult = parseCursorParam(query.get('cursor'));
    if (!cursorResult.ok) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', cursorResult.error));
      return;
    }

    try {
      const result = listNodeChildren({
        parentId: nodeId,
        includeDeleted: includeDeletedResult.value,
        limit: limitResult.value,
        sortBy: sortResult.value,
        order: orderResult.value,
        cursor: cursorResult.value,
      });
      sendJson(res, 200, result);
      return;
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  if (method === 'GET' && pathname.startsWith('/nodes/') && pathname.endsWith('/breadcrumb')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length, -('/breadcrumb'.length));
    if (!nodeId || nodeId.includes('/')) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    if (!isValidUuid(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    const caller = loadUserById(auth.user_id);
    if (!caller) {
      sendJson(res, 401, errorResponse('UNAUTHORIZED', 'Invalid access token'));
      return;
    }

    try {
      let node = loadNodeById(nodeId);
      if (!node && nodeId === '00000000-0000-0000-0000-000000000001') {
        node = ensureRootFolderForUser(auth.user_id);
      }

      if (!node) {
        sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
        return;
      }

      if (caller.role !== 'ADMIN' && String(node.owner_user_id) !== String(auth.user_id)) {
        sendJson(res, 403, errorResponse('FORBIDDEN', 'No read permission for node'));
        return;
      }

      const ancestors = loadNodeAncestorsByPath(node.path);
      const items = ancestors.map((item) => ({
        id: item.id,
        name: item.name,
      }));
      sendJson(res, 200, { items });
      return;
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  if (method === 'GET' && pathname.startsWith('/media/') && pathname.endsWith('/thumbnail')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/media/'.length, -('/thumbnail'.length));
    if (!nodeId || !/^[0-9a-fA-F-]{36}$/.test(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    let node;
    try {
      node = loadNodeById(nodeId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!node) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    if (node.type !== 'FILE') {
      sendJson(res, 409, errorResponse('CONFLICT', 'Node is not a file'));
      return;
    }

    if (!node.blob_id) {
      sendJson(res, 409, errorResponse('CONFLICT', 'Node has no blob'));
      return;
    }

    const { fresh, entry } = ensureThumbnailEntry(node, req.headers.accept);
    if (fresh) {
      if (entry.job) {
        sendJson(res, 202, entry.job);
        return;
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', entry.contentType);
    if (entry.filePath) {
      res.setHeader('Content-Length', String(entry.contentLength ?? fs.statSync(entry.filePath).size));
      const stream = fs.createReadStream(entry.filePath);
      stream.on('error', (err) => {
        if (!res.headersSent) {
          sendJson(res, 500, errorResponse('INTERNAL', String(err)));
        } else {
          res.end();
        }
      });
      stream.pipe(res);
      return;
    }
    res.setHeader('Content-Length', String(entry.buffer.length));
    res.end(entry.buffer);
    return;
  }

  if (method === 'GET' && pathname.startsWith('/nodes/') && pathname.endsWith('/download')) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length, -('/download'.length));
    if (!nodeId || !/^[0-9a-fA-F-]{36}$/.test(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    let node;
    try {
      node = loadNodeById(nodeId);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!node) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
      return;
    }

    if (node.type !== 'FILE') {
      sendJson(res, 409, errorResponse('CONFLICT', 'Node is not a file'));
      return;
    }

    if (!node.blob_id) {
      sendJson(res, 409, errorResponse('CONFLICT', 'Node has no blob'));
      return;
    }

    let blob;
    try {
      blob = loadBlobById(node.blob_id);
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }

    if (!blob) {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Blob not found'));
      return;
    }

    const filePathResult = resolveBlobAbsolutePath(blob);
    if (!filePathResult.ok) {
      sendJson(res, 500, errorResponse('INTERNAL', filePathResult.error));
      return;
    }

    const filePath = filePathResult.value;

    let st;
    try {
      st = fs.statSync(filePath);
    } catch {
      sendJson(res, 404, errorResponse('NOT_FOUND', 'Blob content missing'));
      return;
    }

    const totalSize = Number(st.size);
    const rangeParsed = parseHttpRangeHeader(req.headers.range, totalSize);
    if (!rangeParsed.ok) {
      const status = rangeParsed.status || 400;
      if (status === 416) {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        sendJson(res, 416, errorResponse('RANGE_NOT_SATISFIABLE', rangeParsed.error));
        return;
      }
      sendJson(res, status, errorResponse('BAD_REQUEST', rangeParsed.error));
      return;
    }

    const range = rangeParsed.value;
    const contentType = 'application/octet-stream';
    res.setHeader('Accept-Ranges', 'bytes');

    if (!range) {
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(totalSize));

      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => {
        if (!res.headersSent) {
          sendJson(res, 500, errorResponse('INTERNAL', String(err)));
        }
      });
      stream.pipe(res);
      return;
    }

    const length = range.end - range.start + 1;
    res.statusCode = 206;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(length));
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${range.total}`);

    const stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
    stream.on('error', (err) => {
      if (!res.headersSent) {
        sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      }
    });
    stream.pipe(res);
    return;
  }

  if (method === 'GET' && pathname.startsWith('/nodes/') && pathname.length > '/nodes/'.length) {
    const auth = requireBearerAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, auth.body);
      return;
    }

    const nodeId = pathname.slice('/nodes/'.length);
    if (!nodeId || !/^[0-9a-fA-F-]{36}$/.test(nodeId)) {
      sendJson(res, 400, errorResponse('BAD_REQUEST', 'node_id must be a UUID'));
      return;
    }

    try {
      let node = loadNodeById(nodeId);
      if (!node && nodeId === '00000000-0000-0000-0000-000000000001') {
        node = ensureRootFolderForUser(auth.user_id);
      }
      if (!node) {
        sendJson(res, 404, errorResponse('NOT_FOUND', 'Node not found'));
        return;
      }

      sendJson(res, 200, node);
      return;
    } catch (err) {
      sendJson(res, 500, errorResponse('INTERNAL', String(err)));
      return;
    }
  }

  sendJson(res, 404, errorResponse('NOT_FOUND', 'Not found'));
});

runUploadStartupReconciler();

server.listen(port, '0.0.0.0', () => {
  // Keep logs simple + deterministic.
  process.stdout.write(`dev_server listening on :${port}\n`);
});

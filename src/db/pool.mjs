import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';

function sleepMs(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

let schemaReadyChecked = false;
const queryResultCache = new Map();
let cachedPort = null;

function getSelectCacheMs() {
  const raw = Number(process.env.EXEC_PSQL_SELECT_CACHE_MS || 750);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function getQueryTimeoutMs() {
  const raw = Number(process.env.EXEC_PSQL_TIMEOUT_MS || 8000);
  return Number.isFinite(raw) && raw > 0 ? raw : 8000;
}

function getQueryAttempts() {
  const raw = Number(process.env.EXEC_PSQL_MAX_ATTEMPTS || 4);
  return Number.isFinite(raw) && raw > 0 ? raw : 4;
}

function resolveDbName() {
  const url = process.env.DATABASE_URL;
  if (url && url.trim().length > 0) {
    try {
      const parsed = new URL(url);
      const pathName = String(parsed.pathname || '').replace(/^\//, '');
      if (pathName) {
        return pathName;
      }
    } catch (_) {
      // ignore invalid DATABASE_URL
    }
  }

  const envDb = process.env.NIMBUS_DB;
  if (envDb && envDb.trim().length > 0) {
    return envDb.trim();
  }

  return 'nimbus_drive';
}

function resolvePgPortFromDocker() {
  if (cachedPort !== null) {
    return cachedPort;
  }

  const candidates = [
    process.env.POSTGRES_CONTAINER,
    'bento-postgres',
    'bento-postgres-1',
    'nimbus-postgres',
  ].filter(Boolean);

  for (const containerName of candidates) {
    try {
      const output = execFileSync(
        'docker',
        ['inspect', '-f', '{{range $p, $conf := .NetworkSettings.Ports}}{{if eq $p "5432/tcp"}}{{(index $conf 0).HostPort}}{{end}}{{end}}', containerName],
        {
          encoding: 'utf8',
          timeout: getQueryTimeoutMs(),
          killSignal: 'SIGKILL',
        },
      ).trim();
      const port = Number(output);
      if (Number.isFinite(port) && port > 0) {
        cachedPort = port;
        return port;
      }
    } catch (_) {
      // ignore and try next container candidate
    }
  }

  cachedPort = 15432;
  return cachedPort;
}

function resolveConnectionConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString && connectionString.trim().length > 0) {
    return { connectionString: connectionString.trim() };
  }

  return {
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || resolvePgPortFromDocker()),
    user: process.env.PGUSER || 'nimbus',
    password: process.env.PGPASSWORD || 'nimbus',
    database: resolveDbName(),
  };
}

function isReadOnlyQuery(query) {
  const normalized = String(query).trim().toLowerCase();
  if (!normalized) return false;
  if (!(normalized.startsWith('select') || normalized.startsWith('with'))) {
    return false;
  }
  if (
    normalized.includes('now()') ||
    normalized.includes('clock_timestamp()') ||
    normalized.includes('random()') ||
    normalized.includes('gen_random_uuid()')
  ) {
    return false;
  }
  return true;
}

function clearQueryResultCache() {
  queryResultCache.clear();
}

function runPgQuerySync(query) {
  const workerScript = new URL('./pg_query_worker.mjs', import.meta.url);
  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'bento-pg-query-'));
  const resultPath = path.join(tempBase, 'result.txt');
  const errorPath = path.join(tempBase, 'error.txt');
  const stateBuffer = new SharedArrayBuffer(4);
  const stateView = new Int32Array(stateBuffer);
  const timeoutMs = getQueryTimeoutMs();

  const worker = new Worker(workerScript, {
    workerData: {
      connectionConfig: resolveConnectionConfig(),
      query: String(query),
      resultPath,
      errorPath,
      stateBuffer,
      timeoutMs,
    },
    stdout: false,
    stderr: false,
  });

  try {
    const waitResult = Atomics.wait(stateView, 0, 0, timeoutMs + 1000);
    if (waitResult === 'timed-out') {
      worker.terminate();
      throw new Error(`pg query timed out after ${timeoutMs}ms`);
    }

    const state = Atomics.load(stateView, 0);
    if (state === 2) {
      const message = fs.existsSync(errorPath) ? fs.readFileSync(errorPath, 'utf8') : 'Unknown pg worker error';
      throw new Error(message);
    }

    return fs.existsSync(resultPath) ? fs.readFileSync(resultPath, 'utf8') : '';
  } finally {
    worker.terminate().catch(() => {});
    try {
      fs.rmSync(tempBase, { recursive: true, force: true });
    } catch (_) {
      // ignore temp cleanup failure
    }
  }
}

function waitForCoreTables() {
  const maxWaitAttempts = Number(process.env.EXEC_PSQL_SCHEMA_MAX_ATTEMPTS || 20);
  const requiredTables = ['users', 'upload_sessions', 'system_settings'];
  const sql =
    "select count(*)::int from information_schema.tables " +
    "where table_schema='public' and table_name = any('{" + requiredTables.join(',') + "}'::text[]);";

  for (let attempt = 0; attempt < maxWaitAttempts; attempt += 1) {
    try {
      const out = runPgQuerySync(sql).trim();
      const count = Number(out);
      if (Number.isFinite(count) && count >= requiredTables.length) {
        return;
      }
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      const transient = (
        msg.includes('ECONNREFUSED') ||
        msg.includes('timeout') ||
        msg.includes('terminating connection') ||
        msg.includes('database system is starting up') ||
        msg.includes('database system is shutting down') ||
        msg.includes('does not exist')
      );
      if (!transient) {
        throw err;
      }
    }
    sleepMs(250);
  }

  throw new Error('postgres core tables not ready in time (users/upload_sessions/system_settings)');
}

export function execPsql(query) {
  const sql = String(query);
  const cacheMs = getSelectCacheMs();
  const canUseCache = cacheMs > 0 && isReadOnlyQuery(sql);

  if (canUseCache) {
    const cached = queryResultCache.get(sql);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    if (cached) {
      queryResultCache.delete(sql);
    }
  } else {
    clearQueryResultCache();
  }

  const maxAttempts = getQueryAttempts();
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      if (!schemaReadyChecked) {
        waitForCoreTables();
        schemaReadyChecked = true;
      }
      const result = runPgQuerySync(sql);
      if (canUseCache) {
        queryResultCache.set(sql, {
          value: result,
          expiresAt: Date.now() + cacheMs,
        });
      }
      return result;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      lastErr = err;
      const transient = (
        msg.includes('ECONNREFUSED') ||
        msg.includes('timeout') ||
        msg.includes('terminating connection') ||
        msg.includes('database system is starting up') ||
        msg.includes('database system is shutting down') ||
        msg.includes('relation "upload_sessions" does not exist') ||
        msg.includes('relation "system_settings" does not exist')
      );

      if (transient) {
        schemaReadyChecked = false;
        if (canUseCache) {
          queryResultCache.delete(sql);
        }
        sleepMs(250);
        continue;
      }

      throw err;
    }
  }
  throw lastErr;
}

export function quoteSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

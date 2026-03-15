import { execFileSync } from 'node:child_process';

function sleepMs(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

let cachedContainerName = '';
let schemaReadyChecked = false;
const queryResultCache = new Map();

function getDockerCommandTimeoutMs() {
  const raw = Number(process.env.EXEC_PSQL_TIMEOUT_MS || 8000);
  return Number.isFinite(raw) && raw > 0 ? raw : 8000;
}

function getSelectCacheMs() {
  const raw = Number(process.env.EXEC_PSQL_SELECT_CACHE_MS || 750);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
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

function resolvePostgresContainerName() {
  if (process.env.POSTGRES_CONTAINER && process.env.POSTGRES_CONTAINER.trim().length > 0) {
    return process.env.POSTGRES_CONTAINER.trim();
  }

  if (cachedContainerName) {
    return cachedContainerName;
  }

  const candidates = [
    ['ps', '--filter', 'name=bento-postgres', '--format', '{{.Names}}'],
    ['ps', '--filter', 'name=nimbus-postgres', '--format', '{{.Names}}'],
    ['ps', '--filter', 'label=com.docker.compose.service=postgres', '--format', '{{.Names}}'],
  ];

  for (const args of candidates) {
    try {
      const out = execFileSync('docker', args, {
        encoding: 'utf8',
        timeout: getDockerCommandTimeoutMs(),
        killSignal: 'SIGKILL',
      }).trim();
      const first = out.split('\n').map((s) => s.trim()).find(Boolean);
      if (first) {
        cachedContainerName = first;
        return first;
      }
    } catch (_) {
      // ignore and try next candidate
    }
  }

  // fallback (legacy)
  return 'nimbus-postgres';
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

function runPsqlInContainer(containerName, query) {
  const dbName = resolveDbName();
  return execFileSync('docker', [
    'exec',
    containerName,
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'nimbus',
    '-d',
    dbName,
    '-qtAc',
    query,
  ], {
    encoding: 'utf8',
    timeout: getDockerCommandTimeoutMs(),
    killSignal: 'SIGKILL',
  });
}

function waitForCoreTables(containerName) {
  const maxWaitAttempts = Number(process.env.EXEC_PSQL_SCHEMA_MAX_ATTEMPTS || 40);
  const requiredTables = ['users', 'upload_sessions', 'system_settings'];
  const sql =
    "select count(*)::int from information_schema.tables " +
    "where table_schema='public' and table_name = any('{" + requiredTables.join(',') + "}'::text[]);";

  for (let attempt = 0; attempt < maxWaitAttempts; attempt += 1) {
    try {
      const out = runPsqlInContainer(containerName, sql).trim();
      const count = Number(out);
      if (Number.isFinite(count) && count >= requiredTables.length) {
        return;
      }
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      const transient = (
        msg.includes('No such container') ||
        msg.includes('database system is starting up') ||
        msg.includes('database system is shutting down') ||
        msg.includes('database "nimbus_drive" does not exist') ||
        msg.includes('database "' + resolveDbName() + '" does not exist') ||
        msg.includes('connection to server on socket')
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

  const maxAttempts = Number(process.env.EXEC_PSQL_MAX_ATTEMPTS || 14);
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const containerName = resolvePostgresContainerName();
    try {
      if (!schemaReadyChecked) {
        waitForCoreTables(containerName);
        schemaReadyChecked = true;
      }
      const result = runPsqlInContainer(containerName, sql);
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
        msg.includes('No such container') ||
        msg.includes('the database system is starting up') ||
        msg.includes('the database system is shutting down') ||
        msg.includes('server closed the connection unexpectedly') ||
        msg.includes('database "nimbus_drive" does not exist') ||
        msg.includes('database "' + resolveDbName() + '" does not exist') ||
        msg.includes('connection to server on socket') ||
        msg.includes('relation "upload_sessions" does not exist') ||
        msg.includes('relation "system_settings" does not exist')
      );

      if (msg.includes('No such container')) {
        cachedContainerName = '';
      }

      if (transient) {
        // Re-check schema readiness on next attempt
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

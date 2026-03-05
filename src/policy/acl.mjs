import { execPsql, quoteSqlLiteral } from '../db/pool.mjs';

export function parseAclPermissionList(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { ok: false, error: 'permissions must be a non-empty array' };
  }

  const allowed = new Set(['READ', 'WRITE', 'DELETE', 'SHARE']);
  const deduped = [];
  const seen = new Set();

  for (const raw of values) {
    if (typeof raw !== 'string') {
      return { ok: false, error: 'permissions must be strings' };
    }
    if (!allowed.has(raw)) {
      return { ok: false, error: 'permission must be READ, WRITE, DELETE, or SHARE' };
    }
    if (!seen.has(raw)) {
      deduped.push(raw);
      seen.add(raw);
    }
  }

  return { ok: true, value: deduped };
}

export function parseAclRequestEntries(entries) {
  if (!Array.isArray(entries)) {
    return { ok: false, error: 'entries must be an array' };
  }

  const out = [];
  for (const row of entries) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return { ok: false, error: 'each ACL entry must be an object' };
    }

    const principalType = row.principal_type;
    if (principalType !== 'USER' && principalType !== 'GROUP' && principalType !== 'SHARE_LINK') {
      return { ok: false, error: 'principal_type must be USER, GROUP, or SHARE_LINK' };
    }

    const principalId = row.principal_id;
    if (typeof principalId !== 'string' || principalId.trim().length === 0) {
      return { ok: false, error: 'principal_id must be a non-empty string' };
    }

    const effect = row.effect;
    if (effect !== 'ALLOW' && effect !== 'DENY') {
      return { ok: false, error: 'effect must be ALLOW or DENY' };
    }

    const permissionsResult = parseAclPermissionList(row.permissions);
    if (!permissionsResult.ok) {
      return permissionsResult;
    }

    let inheritable = true;
    if (Object.prototype.hasOwnProperty.call(row, 'inheritable')) {
      if (typeof row.inheritable !== 'boolean') {
        return { ok: false, error: 'inheritable must be a boolean' };
      }
      inheritable = row.inheritable;
    }

    out.push({
      principal_type: principalType,
      principal_id: principalId,
      effect,
      permissions: permissionsResult.value,
      inheritable,
    });
  }

  return { ok: true, value: out };
}

export function loadAclEntriesByNodeId(nodeId) {
  const escaped = quoteSqlLiteral(nodeId);
  const rowsJson = execPsql(
    "select coalesce(json_agg(row_to_json(t) order by created_at asc, id asc), '[]'::json) from (" +
      "select id::text as id, node_id::text as node_id, principal_type, principal_id, effect, permissions, inheritable, " +
        "to_char(created_at at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at " +
      "from acl_entries where node_id='" + escaped + "'::uuid" +
    ") t;"
  ).trim();

  if (!rowsJson) {
    return [];
  }

  const rows = JSON.parse(rowsJson);
  return Array.isArray(rows) ? rows : [];
}

export function loadAclEntriesForPrincipal(nodeId, principalType, principalId, inheritableOnly = false) {
  const escapedNode = quoteSqlLiteral(nodeId);
  const escapedType = String(principalType).replace(/'/g, "''");
  const escapedId = String(principalId).replace(/'/g, "''");
  const inheritClause = inheritableOnly ? ' and inheritable=true' : '';
  const rowsJson = execPsql(
    "select coalesce(json_agg(row_to_json(t) order by created_at asc, id asc), '[]'::json) from (" +
      "select effect, permissions from acl_entries " +
      "where node_id='" + escapedNode + "'::uuid and principal_type='" + escapedType + "' and principal_id='" + escapedId + "'" +
      inheritClause +
    ") t;"
  ).trim();

  if (!rowsJson) {
    return [];
  }

  const rows = JSON.parse(rowsJson);
  return Array.isArray(rows) ? rows : [];
}

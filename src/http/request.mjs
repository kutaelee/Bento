export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('body too large'));
      }
    });
    req.on('end', () => {
      if (raw.length === 0) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

export function parseBooleanQueryParam(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: defaultValue };
  }
  if (value === 'true') {
    return { ok: true, value: true };
  }
  if (value === 'false') {
    return { ok: true, value: false };
  }
  return { ok: false, error: 'Query param must be true or false' };
}

export function parseLimitQueryParam(value, defaultValue = 100) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: defaultValue };
  }

  const str = String(value);
  if (!/^\d+$/.test(str)) {
    return { ok: false, error: 'limit must be an integer' };
  }

  const parsed = Number(str);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    return { ok: false, error: 'limit must be between 1 and 500' };
  }

  return { ok: true, value: parsed };
}

export function parseSearchLimitQueryParam(value, defaultValue = 50) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: defaultValue };
  }

  const str = String(value);
  if (!/^\d+$/.test(str)) {
    return { ok: false, error: 'limit must be an integer' };
  }

  const parsed = Number(str);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
    return { ok: false, error: 'limit must be between 1 and 200' };
  }

  return { ok: true, value: parsed };
}
export function parseNodeChildrenSort(sortValue) {
  if (sortValue === undefined || sortValue === null || sortValue === '') {
    return { ok: true, value: 'name' };
  }

  const allowed = ['name', 'updated_at', 'size_bytes'];
  const normalized = String(sortValue);
  if (allowed.includes(normalized)) {
    return { ok: true, value: normalized };
  }

  return { ok: false, error: 'sort must be one of: name, updated_at, size_bytes' };
}

export function parseNodeChildrenOrder(orderValue) {
  if (orderValue === undefined || orderValue === null || orderValue === '') {
    return { ok: true, value: 'asc' };
  }

  const normalized = String(orderValue).toLowerCase();
  if (normalized === 'asc' || normalized === 'desc') {
    return { ok: true, value: normalized };
  }

  return { ok: false, error: 'order must be asc or desc' };
}

export function parseCursorParam(cursorValue) {
  if (cursorValue === undefined || cursorValue === null || cursorValue === '') {
    return { ok: true, value: 0 };
  }

  const str = String(cursorValue);
  if (!/^\d+$/.test(str)) {
    return { ok: false, error: 'cursor must be a non-negative integer' };
  }

  const parsed = Number(str);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { ok: false, error: 'cursor must be a non-negative integer' };
  }

  return { ok: true, value: parsed };
}

export function normalizeNodeName(rawName) {
  if (typeof rawName !== 'string' || rawName.trim().length === 0 || rawName.length > 255) {
    return { ok: false, error: 'name must be a non-empty string (<=255)' };
  }
  return { ok: true, value: rawName.trim() };
}

export function normalizeUploadFilename(filename) {
  if (typeof filename !== 'string' || filename.trim().length === 0 || filename.length > 255) {
    return { ok: false, error: 'filename must be a non-empty string (<=255)' };
  }
  return { ok: true, value: filename.trim() };
}

export function parseCreateUploadSizeBytes(sizeBytes) {
  if (!Number.isInteger(sizeBytes)) {
    return { ok: false, error: 'size_bytes must be an integer' };
  }
  if (sizeBytes < 0) {
    return { ok: false, error: 'size_bytes must be >= 0' };
  }
  return { ok: true, value: sizeBytes };
}

export function parseSha256(value) {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string' || !/^[A-Fa-f0-9]{64}$/.test(value)) {
    return { ok: false, error: 'sha256 must be a 64-char hex string' };
  }
  return { ok: true, value: value.toLowerCase() };
}

export function parseMimeType(value) {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'mime_type must be a string' };
  }
  return { ok: true, value };
}

export function parseModifiedAt(value) {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return { ok: false, error: 'modified_at must be ISO-8601 datetime or null' };
  }
  return { ok: true, value };
}

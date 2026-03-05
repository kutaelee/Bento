export function sendJson(res, statusCode, bodyObj) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(bodyObj));
}

export function parseHttpRangeHeader(rangeHeader, totalSizeBytes) {
  // Minimal single-range parser for RFC 9110: bytes=START-END or bytes=START-
  if (typeof rangeHeader !== 'string' || rangeHeader.trim().length === 0) {
    return { ok: true, value: null };
  }

  const raw = rangeHeader.trim();
  if (!raw.toLowerCase().startsWith('bytes=')) {
    return { ok: false, status: 400, error: 'Range must start with bytes=' };
  }

  const spec = raw.slice('bytes='.length).trim();
  // Reject multiple ranges for now.
  if (spec.includes(',')) {
    return { ok: false, status: 400, error: 'Multiple ranges are not supported' };
  }

  const match = spec.match(/^(\d+)-(\d*)$/);
  if (!match) {
    return { ok: false, status: 400, error: 'Invalid Range format' };
  }

  const start = Number(match[1]);
  const endText = match[2];
  const end = endText === '' ? null : Number(endText);

  if (!Number.isInteger(start) || start < 0) {
    return { ok: false, status: 400, error: 'Invalid Range start' };
  }

  const total = Number(totalSizeBytes);
  if (!Number.isFinite(total) || total < 0) {
    return { ok: false, status: 500, error: 'Invalid total size' };
  }

  if (start >= total) {
    return { ok: false, status: 416, error: 'Range start is beyond end of file' };
  }

  let resolvedEnd = end;
  if (resolvedEnd === null) {
    resolvedEnd = total - 1;
  }

  if (!Number.isInteger(resolvedEnd) || resolvedEnd < start) {
    return { ok: false, status: 400, error: 'Invalid Range end' };
  }

  if (resolvedEnd >= total) {
    resolvedEnd = total - 1;
  }

  return { ok: true, value: { start, end: resolvedEnd, total } };
}

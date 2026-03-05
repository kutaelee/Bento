export function isValidUuid(value) {
  // Strict canonical UUID shape (8-4-4-4-12). Loose checks can let malformed input
  // through and then explode later when Postgres tries to cast to uuid.
  return (
    typeof value === 'string' &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)
  );
}

export function uuidToLtreeLabel(uuidText) {
  // ltree labels must be [A-Za-z0-9_], no hyphens.
  const hex = String(uuidText).replace(/-/g, '').toLowerCase();
  return `n${hex}`;
}

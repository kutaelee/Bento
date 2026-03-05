export function errorResponse(code, message, details) {
  const error = { code, message };
  if (details) {
    error.details = details;
  }
  return { error };
}

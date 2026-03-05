import crypto from 'node:crypto';

export function hashInviteToken(token) {
  // Store only a hash in DB (token itself is one-time and only returned at creation).
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

import { getRandomBytes } from 'expo-crypto';

/**
 * Helpers that every write uses, so no write can forget the sync bookkeeping
 * (see docs/decisoes.md §6–8).
 */

export function nowIso(): string {
  return new Date().toISOString();
}

/** Today's date in the user's timezone, as `YYYY-MM-DD`. */
export function todayLocalDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * UUID version 7: 48 bits of timestamp + random bits.
 * Unique without asking anyone (works offline, on any device) and sortable by
 * creation time. See docs/decisoes.md §6.
 */
export function newId(): string {
  const bytes = getRandomBytes(16);
  const ms = Date.now();
  // Bytes 0–5: milliseconds since 1970, big-endian.
  for (let i = 0; i < 6; i++) {
    bytes[i] = Math.floor(ms / 2 ** (8 * (5 - i))) % 256;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Fields for a new synced row. */
export function insertStamps() {
  const now = nowIso();
  return { createdAt: now, updatedAt: now, dirty: true };
}

/** Fields for a changed synced row. */
export function updateStamps() {
  return { updatedAt: nowIso(), dirty: true };
}

/** Fields to soft-delete a synced row (never DELETE synced rows). */
export function deleteStamps() {
  const now = nowIso();
  return { deletedAt: now, updatedAt: now, dirty: true };
}

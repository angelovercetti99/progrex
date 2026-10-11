/**
 * Compares two strings in constant time (docs/decisoes.md §9): it always
 * looks at every character, so how long it takes says nothing about how
 * many characters of a guess were right.
 */
export function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  // Different lengths: still do the same work, then say no.
  let difference = left.length ^ right.length;
  for (let i = 0; i < left.length; i++) {
    difference |= left[i] ^ (right[i % Math.max(1, right.length)] ?? 0);
  }
  return difference === 0;
}

/** The key from an `Authorization: Bearer <key>` header, or null. */
export function bearerToken(header: string | undefined | null): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

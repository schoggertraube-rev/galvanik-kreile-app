import { createHash, timingSafeEqual } from 'node:crypto';

export function hasValidCronCredential(authorization: string | null, secret: string | undefined): boolean {
  if (!authorization || !secret) return false;

  const supplied = createHash('sha256').update(authorization).digest();
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  return timingSafeEqual(supplied, expected);
}

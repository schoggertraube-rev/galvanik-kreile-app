import { describe, expect, it } from 'vitest';
import { readSessionInactivity, sessionLayoutDevice } from '../sessionInactivity';

const issuedAt = new Date('2026-11-26T10:00:00.000Z').getTime();
const minute = 60_000;
const session = { issuedAt, expiresAt: issuedAt + 720 * minute, role: 'meister', device: 'tablet' as const };

describe('session inactivity', () => {
  it('uses the last genuine interaction and preserves the fixed end', () => {
    const lastSeen = issuedAt + 700 * minute;
    const settings = { minutes: 60 };
    expect(readSessionInactivity({ ...session, lastSeen }, settings)).toEqual({ lastSeen, expiresAt: session.expiresAt, minutes: 60 });
    expect(readSessionInactivity({ ...session, lastSeen: issuedAt + 15 * minute }, settings).expiresAt).toBe(issuedAt + 75 * minute);
  });

  it('uses an applicable override before the base value and the shorter of two applicable overrides', () => {
    const settings = { minutes: 25, devices: { tablet: 75 }, roles: { meister: 40 } };
    expect(readSessionInactivity(session, settings).minutes).toBe(40);
    expect(readSessionInactivity({ ...session, role: 'developer' }, settings).minutes).toBe(75);
    expect(readSessionInactivity({ ...session, device: 'desktop', role: 'developer' }, settings).minutes).toBe(25);
  });

  it('bases an existing session without a last interaction on its signed login time', () => {
    expect(readSessionInactivity(session, { minutes: 60 })).toEqual({ lastSeen: issuedAt, expiresAt: issuedAt + 60 * minute, minutes: 60 });
  });

  it('fails when the originating setting is unavailable', () => {
    expect(() => readSessionInactivity(session, undefined)).toThrow('SESSION_INACTIVITY_SETTINGS_UNAVAILABLE');
    expect(sessionLayoutDevice(1100)).toBe('tablet');
  });
});

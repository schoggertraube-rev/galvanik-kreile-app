import type { Geraet } from '@/ui/kr/typen';

export type SessionInactivitySettings = {
  minutes?: unknown;
  devices?: unknown;
  roles?: unknown;
};

export type SessionInactivity = {
  lastSeen: number;
  expiresAt: number;
  minutes: number;
  serverAt?: number;
  sessionScope?: string;
};

export type SessionActivityResult =
  | { code: 'OK'; inactivity: SessionInactivity }
  | { code: 'EXPIRED' | 'UNAVAILABLE' };

export function sessionLayoutDevice(width: number): Geraet {
  if (width < 768) return 'handy';
  return width < 1280 ? 'tablet' : 'desktop';
}

export function reportTabletInput(): 'tablet' | undefined {
  return navigator.maxTouchPoints > 0 && sessionLayoutDevice(window.innerWidth) === 'tablet'
    ? 'tablet'
    : undefined;
}

function minutes(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function override(overrides: unknown, key: string): number | undefined {
  if (!overrides || typeof overrides !== 'object' || !Object.hasOwn(overrides, key)) return undefined;
  return minutes((overrides as Record<string, unknown>)[key]);
}

export function readSessionInactivity(
  session: { issuedAt: number; lastSeen?: number; expiresAt: number; role: string; device?: Geraet },
  settings: SessionInactivitySettings | null | undefined,
): SessionInactivity {
  const deviceLimit = session.device ? override(settings?.devices, session.device) : undefined;
  const roleLimit = override(settings?.roles, session.role);
  const overrideLimit = deviceLimit !== undefined && roleLimit !== undefined
    ? Math.min(deviceLimit, roleLimit)
    : deviceLimit ?? roleLimit;
  const limit = overrideLimit ?? minutes(settings?.minutes);
  if (limit === undefined) throw Error('SESSION_INACTIVITY_SETTINGS_UNAVAILABLE');
  const lastSeen = session.lastSeen ?? session.issuedAt;
  return { lastSeen, expiresAt: Math.min(session.expiresAt, lastSeen + limit * 60_000), minutes: limit };
}

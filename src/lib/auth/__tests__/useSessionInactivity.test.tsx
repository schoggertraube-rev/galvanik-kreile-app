// @vitest-environment jsdom
// The logout transport is held open to observe the shell before it replies.
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSessionInactivity } from '../useSessionInactivity';

const ports = vi.hoisted(() => ({
  logout: vi.fn(() => new Promise(() => {})),
}));
vi.mock('@/lib/offline/logoutWithReadCleanup', () => ({ logoutWithReadCleanup: ports.logout }));
vi.mock('@/app/actions/auth.actions', () => ({ recordAppSessionActivity: vi.fn() }));

afterEach(() => vi.useRealTimers());

it('hides the current shell at the deadline even when the sign-out response never arrives', async () => {
  vi.useFakeTimers();
  const now = Date.now();
  const { result } = renderHook(() => useSessionInactivity({
    minutes: 1, lastSeen: now, expiresAt: now + 60_000, serverAt: now,
  }));
  expect(result.current).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(result.current).toBe(true);
  expect(ports.logout).toHaveBeenCalledExactlyOnceWith('inactivity');
});

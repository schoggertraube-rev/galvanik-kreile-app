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

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

const sessionScope = 'a'.repeat(64);

it('hides the current shell at the deadline even when the sign-out response never arrives', async () => {
  vi.useFakeTimers();
  const now = Date.now();
  const initial = {
    minutes: 1, lastSeen: now, expiresAt: now + 60_000, serverAt: now, sessionScope,
  };
  const { result } = renderHook(() => useSessionInactivity(initial));
  expect(result.current).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(result.current).toBe(true);
  expect(ports.logout).toHaveBeenCalledExactlyOnceWith('inactivity', sessionScope);
});

it('only reopens the view after the server confirms its own renewed deadline', async () => {
  vi.useFakeTimers();
  const now = Date.now();
  let reply: (value: unknown) => void = () => {};
  ports.logout.mockReturnValueOnce(new Promise(resolve => { reply = resolve; }));
  const initial = {
    minutes: 1, lastSeen: now, expiresAt: now + 60_000, serverAt: now, sessionScope,
  };
  const { result } = renderHook(() => useSessionInactivity(initial));
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(result.current).toBe(true);
  await act(async () => { reply({ ok: false, code: 'ACTIVE', inactivity: {
    minutes: 1, lastSeen: now + 45_000, expiresAt: now + 105_000, serverAt: now + 60_000, sessionScope,
  } }); });
  expect(result.current).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(44_000); });
  expect(ports.logout).toHaveBeenCalledOnce();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current).toBe(true);
  expect(ports.logout).toHaveBeenCalledTimes(2);
});

it('does not restart the deadline when retained HTML is opened with an older server timestamp', async () => {
  vi.useFakeTimers();
  const now = Date.now();
  const initial = {
    minutes: 1, lastSeen: now - 65_000, expiresAt: now - 5_000, serverAt: now - 60_000, sessionScope,
  };
  const { result } = renderHook(() => useSessionInactivity(initial));
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(result.current).toBe(true);
  expect(ports.logout).toHaveBeenCalledExactlyOnceWith('inactivity', sessionScope);
});

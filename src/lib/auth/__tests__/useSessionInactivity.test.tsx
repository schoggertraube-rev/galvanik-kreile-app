// @vitest-environment jsdom
// The logout transport is held open to observe the shell before it replies.
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSessionInactivity } from '../useSessionInactivity';

const ports = vi.hoisted(() => ({
  logout: vi.fn(() => new Promise(() => {})),
  authorization: vi.fn(),
  readDeadline: vi.fn(),
  rememberDeadline: vi.fn(async () => {}),
}));
vi.mock('@/lib/offline/logoutWithReadCleanup', () => ({ logoutWithReadCleanup: ports.logout }));
vi.mock('@/app/actions/auth.actions', () => ({
  getAuthorizationSnapshotAction: ports.authorization, recordAppSessionActivity: vi.fn(),
}));
vi.mock('@/lib/offline/pendingStore', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/offline/pendingStore')>(),
  readPendingShellMetadata: ports.readDeadline,
  rememberPendingShellDeadline: ports.rememberDeadline,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.restoreAllMocks();
  const root = document.documentElement;
  root.removeAttribute('data-offline-24h');
  delete root.dataset.offlineScope;
  delete root.dataset.offlineLoginScope;
  document.cookie = 'kreile_offline_cache_scope=; Max-Age=0; Path=/';
});

const sessionScope = 'a'.repeat(64);
const offlineScope = 'test-device';

function enableOfflineView() {
  document.documentElement.setAttribute('data-offline-24h', 'enabled');
  document.documentElement.dataset.offlineScope = offlineScope;
  document.documentElement.dataset.offlineLoginScope = sessionScope;
  document.cookie = `kreile_offline_cache_scope=${sessionScope}; Path=/`;
}

it('keeps an old tab closed when another login replaces its marker during authorization', async () => {
  enableOfflineView();
  let authorize: (value: unknown) => void = () => {};
  ports.authorization.mockReturnValueOnce(new Promise(resolve => { authorize = resolve; }));
  const now = Date.now();
  const initial = { minutes: 60, lastSeen: now, expiresAt: now + 3_600_000, serverAt: now, sessionScope };
  const { result } = renderHook(() => useSessionInactivity(initial));
  expect(result.current).toBe(true);
  document.cookie = `kreile_offline_cache_scope=${'b'.repeat(64)}; Path=/`;
  await act(async () => {
    authorize({ ok: true, data: { offlineScope, offline24h: true, inactivity: initial } });
  });
  expect(result.current).toBe(true);
  expect(ports.rememberDeadline).not.toHaveBeenCalled();
});

it('opens an online view with the newly confirmed shorter deadline', async () => {
  vi.useFakeTimers();
  enableOfflineView();
  const now = Date.now();
  const initial = { minutes: 60, lastSeen: now, expiresAt: now + 3_600_000, serverAt: now, sessionScope };
  ports.readDeadline.mockResolvedValueOnce({code:'OK', metadata:{scope:sessionScope, idleDeadline:{
    localAt:now, monotonicAt:Math.round(performance.timeOrigin+performance.now()), serverAt:now, expiresAt:initial.expiresAt,
  }}});
  ports.authorization.mockResolvedValueOnce({ ok: true, data: {
    offlineScope, offline24h: true, inactivity: { ...initial, minutes: 1, expiresAt: now + 60_000 },
  } });
  const { result } = renderHook(() => useSessionInactivity(initial));
  await act(async () => { await vi.advanceTimersByTimeAsync(59_000); });
  expect(result.current).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  expect(result.current).toBe(true);
  expect(ports.logout).toHaveBeenCalledExactlyOnceWith('inactivity', sessionScope);
});

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

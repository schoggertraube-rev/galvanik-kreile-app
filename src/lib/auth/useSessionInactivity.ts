'use client';

import { useEffect, useState } from 'react';
import { getAuthorizationSnapshotAction, recordAppSessionActivity } from '@/app/actions/auth.actions';
import { readCacheScopeMarker } from '@/lib/offline/cacheScopeMarker';
import { logoutWithReadCleanup } from '@/lib/offline/logoutWithReadCleanup';
import { captureIdleClock, makeConfirmedIdleClock, readPendingShellMetadata, rememberPendingShellDeadline, remainingIdleClock } from '@/lib/offline/pendingStore';
import { INACTIVITY_COPY } from '@/ui/inaktivitaetTexte';
import type { SessionInactivity } from './sessionInactivity';

export function useSessionInactivity(initial: SessionInactivity | undefined): boolean {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!initial) return;
    let windowState = initial;
    let clockOffset = Math.max(windowState.serverAt ?? 0, Date.now()) - performance.now();
    let timer: number | undefined;
    let disposed = false;
    let expiring = false;
    let recording = false;
    const root = document.documentElement;
    const scope = root.dataset.offlineScope;
    const loginScope = initial.sessionScope;
    const offlineEnabled = root.getAttribute('data-offline-24h') === 'enabled';
    let checkingCache = offlineEnabled;
    const sameLogin = () => Boolean(loginScope && root.dataset.offlineLoginScope === loginScope
      && readCacheScopeMarker() === loginScope);

    const applyServerTime = (current: SessionInactivity, started: ReturnType<typeof captureIdleClock>) => {
      windowState = current;
      clockOffset = (current.serverAt ?? Date.now()) - performance.now();
      if (!scope || !loginScope || current.sessionScope !== loginScope || root.dataset.offlineLoginScope !== loginScope
        || !offlineEnabled || current.serverAt === undefined) return;
      const deadline = makeConfirmedIdleClock(current.serverAt, current.expiresAt, started);
      const remaining = remainingIdleClock(deadline);
      if (!deadline || remaining === null) return;
      clockOffset = current.expiresAt - remaining - performance.now();
      void rememberPendingShellDeadline(scope, loginScope, deadline)
        .catch(() => console.error('[OFFLINE_SHELL_DEADLINE_WRITE_FAILED]'));
    };
    const serverNow = () => performance.now() + clockOffset;

    const expire = async () => {
      if (disposed || expiring) return;
      expiring = true;
      setExpired(true);
      try {
        const started = captureIdleClock();
        const result = await logoutWithReadCleanup('inactivity', initial.sessionScope);
        if (disposed) return;
        if (!result.ok) {
          if (result.code === 'ACTIVE' && (!offlineEnabled
            || (result.inactivity.sessionScope === loginScope && sameLogin()))) {
            applyServerTime(result.inactivity, started);
            expiring = false;
            setExpired(false);
            schedule();
          } else {
            window.location.replace('/start');
          }
          return;
        }
      } catch {
        console.error('[APP_SESSION_INACTIVITY_LOGOUT_FAILED]');
      }
      if (disposed) return;
      const query = new URLSearchParams({ message: INACTIVITY_COPY.signedOut(windowState.minutes) });
      window.location.replace(`/start?${query}`);
    };

    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void expire(), Math.max(0, windowState.expiresAt - serverNow()));
    }

    const interact = async (event: Event) => {
      if (!event.isTrusted || disposed || expiring || recording || checkingCache || !navigator.onLine) return;
      const now = serverNow();
      if (now >= windowState.expiresAt) return void expire();
      if (now - windowState.lastSeen < Math.min(30_000, windowState.minutes * 10_000)) return;
      recording = true;
      try {
        const started = captureIdleClock();
        const result = await recordAppSessionActivity();
        if (disposed) return;
        if (result.code === 'OK') {
          applyServerTime(result.inactivity, started);
          schedule();
        } else if (result.code === 'EXPIRED') {
          void expire();
        }
      } catch {
        console.error('[APP_SESSION_ACTIVITY_FAILED]');
      } finally {
        recording = false;
      }
    };

    const openScopedView = async () => {
      setExpired(true);
      const open = (remaining: number) => {
        if (disposed || !sameLogin()) return;
        clockOffset = windowState.expiresAt - remaining - performance.now();
        checkingCache = false;
        setExpired(false);
        schedule();
      };
      const openCache = async (scope: string, login: string) => {
        const state = await readPendingShellMetadata(scope, login);
        if (state.code !== 'OK' || state.metadata.scope !== login) return;
        const deadline = state.metadata.idleDeadline;
        if (!deadline || !('serverAt' in deadline)) return;
        // More recent HTML may shorten the lease. Its timestamp never starts a new clock.
        const expiresAt = initial.serverAt !== undefined && initial.serverAt >= deadline.serverAt
          ? Math.min(deadline.expiresAt, deadline.localAt + initial.expiresAt - deadline.serverAt)
          : deadline.expiresAt;
        const remaining = remainingIdleClock({ ...deadline, expiresAt });
        if (remaining !== null) open(remaining);
      };
      try {
        if (!scope || !loginScope || !sameLogin()) return;
        if (!navigator.onLine) {
          await openCache(scope, loginScope);
          return;
        }
        // An available server may have shortened the deadline since the last offline snapshot.
        const started = captureIdleClock();
        let result: Awaited<ReturnType<typeof getAuthorizationSnapshotAction>>;
        try {
          result = await getAuthorizationSnapshotAction();
        } catch (error) {
          if (!(error instanceof TypeError)) throw error;
          // A connected device can lose its route to the app while a confirmed view is still readable.
          if (!disposed && sameLogin()) await openCache(scope, loginScope);
          return;
        }
        if (disposed || !sameLogin() || !result.ok || result.data.offlineScope !== scope || result.data.offline24h !== true) return;
        const current = result.data.inactivity;
        if (current?.sessionScope !== loginScope || current.serverAt === undefined) return;
        const deadline = makeConfirmedIdleClock(current.serverAt, current.expiresAt, started);
        const remaining = remainingIdleClock(deadline);
        if (!deadline || remaining === null) return;
        windowState = current;
        void rememberPendingShellDeadline(scope, loginScope, deadline).catch(() => console.error('[OFFLINE_SHELL_DEADLINE_WRITE_FAILED]'));
        open(remaining);
      } catch {
        console.error('[OFFLINE_SHELL_DEADLINE_READ_FAILED]');
      } finally {
        if (!disposed && checkingCache) window.location.replace('/start');
      }
    };
    if (checkingCache) void openScopedView();
    else schedule();
    window.addEventListener('pointerdown', interact, { passive: true });
    window.addEventListener('wheel', interact, { passive: true });
    window.addEventListener('keydown', interact);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', interact);
      window.removeEventListener('wheel', interact);
      window.removeEventListener('keydown', interact);
    };
  }, [initial]);

  return expired;
}

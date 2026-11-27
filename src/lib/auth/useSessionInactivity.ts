'use client';

import { useEffect, useState } from 'react';
import { recordAppSessionActivity } from '@/app/actions/auth.actions';
import { logoutWithReadCleanup } from '@/lib/offline/logoutWithReadCleanup';
import { INACTIVITY_COPY } from '@/ui/inaktivitaetTexte';
import type { SessionInactivity } from './sessionInactivity';

export function useSessionInactivity(initial: SessionInactivity | undefined): boolean {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!initial) return;
    let windowState = initial;
    let clockOffset = (windowState.serverAt ?? Date.now()) - performance.now();
    let timer: number | undefined;
    let disposed = false;
    let expiring = false;
    let recording = false;

    const applyServerTime = (current: SessionInactivity) => {
      windowState = current;
      clockOffset = (current.serverAt ?? Date.now()) - performance.now();
    };
    const serverNow = () => performance.now() + clockOffset;

    const expire = async () => {
      if (disposed || expiring) return;
      expiring = true;
      setExpired(true);
      try {
        const result = await logoutWithReadCleanup('inactivity', initial.sessionScope);
        if (disposed) return;
        if (!result.ok) {
          if (result.code === 'ACTIVE') {
            applyServerTime(result.inactivity);
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
      if (!event.isTrusted || disposed || expiring || recording || !navigator.onLine) return;
      const now = serverNow();
      if (now >= windowState.expiresAt) return void expire();
      if (now - windowState.lastSeen < Math.min(30_000, windowState.minutes * 10_000)) return;
      recording = true;
      try {
        const result = await recordAppSessionActivity();
        if (disposed) return;
        if (result.code === 'OK') {
          applyServerTime(result.inactivity);
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

    schedule();
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

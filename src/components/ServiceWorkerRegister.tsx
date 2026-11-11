"use client";

import { useEffect } from "react";
import {clearUnmarkedPrivateCaches} from '@/lib/offline/privateReadCache';

// One registration attempt per browser container, also across remounts/StrictMode.
const registrations = new WeakMap<ServiceWorkerContainer, Promise<ServiceWorkerRegistration>>();

export function ServiceWorkerRegister() {
  useEffect(() => {
    void clearUnmarkedPrivateCaches().catch(()=>console.error('[OFFLINE_START_CACHE_DELETE_FAILED]'));
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const container = navigator.serviceWorker;
      if (registrations.has(container)) return;
      const attempt = container.register("/sw.js");
      registrations.set(container, attempt);
      attempt.then((registration) => {
          console.log("Service Worker registered with scope:", registration.scope);
        })
        .catch((error) => {
          registrations.delete(container);
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  return null;
}

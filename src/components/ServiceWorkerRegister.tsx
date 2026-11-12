"use client";

import { useEffect } from "react";
import {usePathname} from 'next/navigation';
import {clearUnmarkedPrivateCaches,warmScopedPrivateResponse} from '@/lib/offline/privateReadCache';

// One registration attempt per browser container, also across remounts/StrictMode.
const registrations = new WeakMap<ServiceWorkerContainer, Promise<ServiceWorkerRegistration>>();

const warmings=new Map<string,Promise<boolean>>();
export function ServiceWorkerRegister() {
  const pathname=usePathname();
  useEffect(()=>{
    const root=document.documentElement,scope=root.dataset.offlineScope,login=root.dataset.offlineLoginScope;
    if(root.dataset.authStatus!=='authenticated'||root.getAttribute('data-offline-24h')!=='enabled'||!scope||!login)return;
    const url=new URL(window.location.href),key=scope+':'+login+':'+url.href;
    if(warmings.has(key))return;
    const pending=warmScopedPrivateResponse(scope,login,url);warmings.set(key,pending);
    void pending.finally(()=>{if(warmings.get(key)===pending)warmings.delete(key);});
  },[pathname]);
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

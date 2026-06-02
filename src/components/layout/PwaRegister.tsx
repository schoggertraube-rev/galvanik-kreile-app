'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'development') {
        // Im Development: Service Worker entschärfen/entfernen, um Caching-Probleme zu vermeiden
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for(const registration of registrations) {
            registration.unregister();
            console.log('👷 PWA: Service Worker unregistered in dev mode');
          }
        });
        return;
      }

      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('👷 PWA: Service Worker registered successfully with scope:', registration.scope);
        } catch (error) {
          console.error('👷 PWA: Service Worker registration failed:', error);
        }
      };
      
      // Register on load
      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
        return () => window.removeEventListener('load', registerSW);
      }
    }
  }, []);

  return null; // This component has no visual representation
}

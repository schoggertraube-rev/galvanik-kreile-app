import { logUiEvent } from "@/app/actions/tracking.actions";
import { OfflineManager } from "@/lib/offline/OfflineManager";

export type UiEventName = 
  | "nav_click"
  | "overlay_open"
  | "overlay_close_backdrop"
  | "overlay_close_esc";

export function trackUiEvent(eventName: UiEventName, payload?: Record<string, any>) {
  // Behalte console.log für lokales Debugging
  console.log(`[Tracking] Event: ${eventName}`, payload || {});

  // Bei Offline-Modus direkt abbrechen, um Fehler zu vermeiden
  if (typeof window !== "undefined" && OfflineManager.isOffline()) {
    return;
  }

  // Server Action im Hintergrund aufrufen
  logUiEvent(eventName, payload).catch(err => {
    // Fehler schlucken, damit Tracking nie die App crasht
    console.debug("[Tracking] Background sync failed:", err);
  });
}

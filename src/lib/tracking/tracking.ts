import { logUiEvent } from "@/app/actions/tracking.actions";
import { OfflineManager } from "@/lib/offline/OfflineManager";

function isTelemetryContractEnabled(): boolean {
  return false;
}

export type UiEventName =
  | "nav_click"
  | "overlay_open"
  | "overlay_close_backdrop"
  | "overlay_close_esc"
  | "page_view"
  | "detail_open"
  | "search";

export function trackUiEvent(eventName: UiEventName, payload?: Record<string, unknown>) {
  if (!isTelemetryContractEnabled()) {
    return;
  }
  // Lokales Debugging
  console.log(`[Tracking] Event: ${eventName}`, payload || {});

  // Bei Offline-Modus direkt abbrechen
  if (typeof window !== "undefined" && OfflineManager.isOffline()) {
    return;
  }

  // Session-ID einmalig pro Session erzeugen
  const w = window as unknown as Record<string, unknown>;
  const SESSION_ID: string =
    (w["SESSION_ID"] as string) ||
    (() => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substr(2, 9);
      w["SESSION_ID"] = id;
      return id;
    })();

  // Device-Erkennung
  const getDeviceType = (): string => {
    if (typeof window === "undefined") return "unknown";
    const width = window.innerWidth;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  };

  const event = {
    event_type: eventName,
    route: typeof window !== "undefined" ? window.location.pathname : undefined,
    target: undefined as string | undefined,
    meta: payload,
    device: getDeviceType(),
    session_id: SESSION_ID,
    occurred_at: new Date().toISOString(),
  };

  // Loggen, bei Fehler in localStorage-Queue zwischenspeichern
  logUiEvent(event).catch((err) => {
    console.debug("[Tracking] Background sync failed:", err);
    try {
      const queueKey = "ui_event_queue";
      const existing = typeof window !== "undefined"
        ? (JSON.parse(window.localStorage.getItem(queueKey) || "[]") as unknown[])
        : [];
      existing.push(event);
      window.localStorage.setItem(queueKey, JSON.stringify(existing));
    } catch (e) {
      console.error("Failed to store offline UI event", e);
    }
  });
}

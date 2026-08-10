export type UiEventName =
  | "nav_click"
  | "overlay_open"
  | "overlay_close_backdrop"
  | "overlay_close_esc"
  | "page_view"
  | "detail_open"
  | "search";

export type UiTrackingDenial = {
  ok: false;
  error: "NOT_AVAILABLE";
  message: "NOT_AVAILABLE: UI-Tracking benötigt den W3-Command-Vertrag.";
};

export function trackUiEvent(eventName: UiEventName, payload?: Record<string, unknown>): UiTrackingDenial {
  void eventName;
  void payload;
  return {
    ok: false,
    error: "NOT_AVAILABLE",
    message: "NOT_AVAILABLE: UI-Tracking benötigt den W3-Command-Vertrag.",
  };
}

export type UiEventName =
  | "nav_click"
  | "overlay_open"
  | "overlay_close_backdrop"
  | "overlay_close_esc"
  | "page_view"
  | "detail_open"
  | "search";

/**
 * Telemetry has no approved consent, retention, tenant, or receipt contract.
 * Retain the call shape without producing, persisting, or transmitting data.
 */
export function trackUiEvent(_eventName: UiEventName, _payload?: Record<string, unknown>): void {
  void _eventName;
  void _payload;
}

export type UiEventName = 
  | "nav_click"
  | "overlay_open"
  | "overlay_close_backdrop"
  | "overlay_close_esc";

export function trackUiEvent(eventName: UiEventName, payload?: Record<string, any>) {
  // In a real application, this would send an event to an analytics server (e.g. PostHog, Mixpanel, Google Analytics).
  // For now, we mock it by logging to the console.
  console.log(`[Tracking] Event: ${eventName}`, payload || {});
}

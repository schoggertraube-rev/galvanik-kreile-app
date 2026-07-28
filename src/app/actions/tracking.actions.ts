"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export interface UiEventPayload {
  event_type: string;
  route?: string;
  target?: string;
  meta?: Record<string, unknown>;
  device?: string;
  session_id?: string;
  occurred_at?: string;
}

export type UiEventRecord = Record<string, unknown> & {
  id: string;
  eventType: string;
  createdAt: string;
};

export type TelemetryStats = Record<string, unknown> & {
  topEvents?: Array<{ name: string; value: number }>;
  activityData?: Array<{ date: string; events: number }>;
};

function telemetryUnavailable(): never {
  if (!isFoundationAreaEnabled("Entwickler-Telemetrie")) {
    return foundationUnavailableAction("Entwickler-Telemetrie");
  }
  return foundationUnavailableAction("Entwickler-Telemetrie");
}

export async function logUiEvent(event: UiEventPayload): Promise<void> {
  void event;
  return telemetryUnavailable();
}

export async function getRecentUiEvents(): Promise<UiEventRecord[]> {
  return telemetryUnavailable();
}

export async function getRealAnalyticsStats(): Promise<TelemetryStats> {
  return telemetryUnavailable();
}

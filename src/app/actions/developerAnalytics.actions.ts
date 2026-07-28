"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export interface FrictionSignal {
  id: string;
  title: string;
  detail: string;
  page: string;
}

export interface AnalyticsSuggestion {
  id: string;
  priority: string;
  page: string;
  signal: string;
  recommendation: string;
  reason: string;
  status: string;
}

export interface DeviceUsage {
  name: string;
  value: number;
}

export interface DevicesOverview {
  connected: boolean;
  message: string;
  stats: DeviceUsage[];
}

export interface AnalyticsOverview {
  activeUsers: number;
  activeRoles: string[];
  lastActive: string;
  topEvents: { name: string; value: number }[];
  activityData: { date: string; events: number }[];
  recentEvents?: { id: string; time: string; type: string; user: string; role: string; detail: string }[];
}

export interface DeveloperCockpitData {
  overview: AnalyticsOverview;
  frictionAnalysis: FrictionSignal[];
  suggestions: AnalyticsSuggestion[];
  devices: DevicesOverview;
}

/**
 * Compatibility adapter only. The former implementation synthesized analytics
 * and recommendations. It remains unavailable until the telemetry contract has
 * tenant, consent, retention, actor and evidence proofs.
 */
export async function getDeveloperCockpitStats(): Promise<DeveloperCockpitData> {
  if (!isFoundationAreaEnabled("Entwickler-Analyse")) {
    return foundationUnavailableAction("Entwickler-Analyse");
  }

  return foundationUnavailableAction("Entwickler-Analyse");
}

"use server";

import { requireAdminOrDeveloper } from "@/lib/auth/permissions";
import { getRealAnalyticsStats } from "./tracking.actions";

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

export async function getDeveloperCockpitStats(): Promise<DeveloperCockpitData> {
  await requireAdminOrDeveloper();

  // Only real tracking data — no fabricated fallbacks.
  const basicStats = await getRealAnalyticsStats();

  return {
    overview: {
      ...basicStats,
      topEvents: basicStats.topEvents ?? [],
      activityData: basicStats.activityData ?? [],
    } as AnalyticsOverview,
    frictionAnalysis: [],
    suggestions: [],
    devices: {
      connected: false,
      message: "NOT_CONFIGURED: Kein Gerätedaten-Vertrag vorhanden. Client-Fingerprints werden nicht erfasst.",
      stats: [],
    },
  };
}

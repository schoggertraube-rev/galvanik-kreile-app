import { getDeveloperCockpitStats } from "@/app/actions/developerAnalytics.actions";
import { AnalyticsCockpitClient } from "./AnalyticsCockpitClient";

export default async function AnalyticsPage() {
  const data = await getDeveloperCockpitStats();

  return <AnalyticsCockpitClient data={data} />;
}

import { isAdminOrDeveloper } from "@/lib/auth/permissions";
import { BetriebDashboardClient } from "./BetriebDashboardClient";

export default async function BetriebPage() {
  const isAdminOrDev = await isAdminOrDeveloper();
  return <BetriebDashboardClient isAdminOrDev={isAdminOrDev} />;
}

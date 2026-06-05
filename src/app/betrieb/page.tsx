import { hasPermission } from "@/lib/auth/permissions";
import { BetriebDashboardClient } from "./BetriebDashboardClient";

export default async function BetriebPage() {
  const isAdminOrDev = await hasPermission("perm_view_leitstand");
  return <BetriebDashboardClient isAdminOrDev={isAdminOrDev} />;
}

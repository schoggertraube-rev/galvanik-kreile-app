import { hasPermission } from "@/lib/auth/permissions";
import { KontrolleDashboardClient } from "./KontrolleDashboardClient";

export default async function KontrollePage() {
  const isDevOrAdmin = await hasPermission("perm_op_qa");

  return <KontrolleDashboardClient isDevOrAdmin={isDevOrAdmin} />;
}

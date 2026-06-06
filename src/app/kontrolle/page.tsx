import { hasPermission } from "@/lib/auth/permissions";
import { KontrolleDashboardClient } from "./KontrolleDashboardClient";
import { getQsListenAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function KontrollePage() {
  const isDevOrAdmin = await hasPermission("perm_op_qa");
  const qsResult = await getQsListenAction();
  const qsData = qsResult.ok ? qsResult.data : [];

  return <KontrolleDashboardClient isDevOrAdmin={isDevOrAdmin} qsData={qsData} />;
}

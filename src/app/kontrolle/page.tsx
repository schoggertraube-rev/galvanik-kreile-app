import { KontrolleDashboardClient } from "./KontrolleDashboardClient";
import { getQsListenAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function KontrollePage() {
  const qsResult = await getQsListenAction();
  const qsData = qsResult.ok ? qsResult.data : [];

  return <KontrolleDashboardClient qsData={qsData} />;
}

import { BaederDashboardClient } from "./BaederDashboardClient";
import { getBaederListAction } from "./actions";

export default async function BaederPage() {
  const result = await getBaederListAction();
  const baederData = result.ok ? result.data : [];
  return <BaederDashboardClient baederData={baederData} />;
}

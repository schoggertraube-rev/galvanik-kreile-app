import { BaederDashboardClient } from "./BaederDashboardClient";
import { getBaederListAction } from "./actions";

export default async function BaederPage() {
  const result = await getBaederListAction();
  return (
    <BaederDashboardClient
      baederData={result.ok ? result.data : []}
      loadError={result.ok ? null : result.message}
    />
  );
}

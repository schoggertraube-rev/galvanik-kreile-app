import { WarendurchlaufCockpitClient } from "./WarendurchlaufCockpitClient";
import { getWarendurchlaufKPIs } from "./actions";

export default async function WarendurchlaufIndex() {
  const result = await getWarendurchlaufKPIs();
  const data = result.ok && result.data ? result.data : null;
  return <WarendurchlaufCockpitClient data={data} />;
}

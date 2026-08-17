import { WarendurchlaufCockpitClient } from "./WarendurchlaufCockpitClient";
import { getWarendurchlaufKPIs } from "./actions";

export default async function WarendurchlaufIndex() {
  const result = await getWarendurchlaufKPIs();
  if (!result.ok) {
    return <div className="p-8 text-center" role="status">{result.message}</div>;
  }

  return <WarendurchlaufCockpitClient data={result.data} />;
}

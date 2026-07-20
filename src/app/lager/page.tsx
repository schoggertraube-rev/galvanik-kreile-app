import { LagerCockpitClient } from "./LagerCockpitClient";
import { getLagerbestandAction } from "./actions";

export default async function LagerPage() {
  const result = await getLagerbestandAction();
  return (
    <LagerCockpitClient
      lagerData={result.ok ? result.data.items : []}
      loadError={result.ok ? null : result.message}
    />
  );
}

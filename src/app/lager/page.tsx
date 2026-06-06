import { LagerCockpitClient } from "./LagerCockpitClient";
import { getLagerbestandAction } from "./actions";

export default async function LagerPage() {
  const result = await getLagerbestandAction();
  const lagerData = result.ok ? result.data : [];
  
  return <LagerCockpitClient lagerData={lagerData} />;
}

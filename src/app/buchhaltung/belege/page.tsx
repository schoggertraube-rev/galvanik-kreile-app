import { BelegeClient } from "./BelegeClient";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";

export const dynamic = "force-dynamic";

export default async function BelegePage() {
  const provider = getBuchhaltungProvider();
  const belege = await provider.listBelege();
  
  return <BelegeClient initialBelege={belege} />;
}

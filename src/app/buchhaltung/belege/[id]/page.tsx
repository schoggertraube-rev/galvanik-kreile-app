import { BelegDetailClient } from "./BelegDetailClient";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";

export default async function BelegDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let beleg = null;
  try {
    const provider = getBuchhaltungProvider();
    beleg = await provider.getBeleg(id);
  } catch (err) {
    console.error("Fehler beim Laden des Belegs:", err);
  }
  return <BelegDetailClient id={id} initialBeleg={beleg} />;
}

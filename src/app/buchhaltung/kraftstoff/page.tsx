import { getKraftstoffTankungenAction } from "@/app/buchhaltung/actions";
import { BelegDetail } from "@/lib/buchhaltung/types";
import { KraftstoffClient } from "./KraftstoffClient";

export const dynamic = "force-dynamic";

export default async function KraftstoffPage() {
  const tankungen = await getKraftstoffTankungenAction() as BelegDetail[];

  const gesamtLiter = tankungen.reduce((s, t) => s + (t.kraftstoffDetail?.liter || 0), 0);
  const gesamtKosten = tankungen.reduce((s, t) => s + (t.brutto || 0), 0);

  return <KraftstoffClient initialTankungen={tankungen} gesamtLiter={gesamtLiter} gesamtKosten={gesamtKosten} />;
}


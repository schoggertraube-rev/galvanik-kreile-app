import { listRechnungenAction } from "@/app/buchhaltung/actions";
import { RechnungFilter } from "@/lib/buchhaltung/types";
import { RechnungenClient } from "./RechnungenClient";

export const dynamic = "force-dynamic";

export default async function RechnungenPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;

  const filter: RechnungFilter = {
    status: sp.status as any,
    kundeId: sp.kunde as string | undefined,
    ueberfaellig: sp.ueberfaellig === '1',
  };

  if (sp.von && sp.bis) {
    filter.zeitraum = {
      von: sp.von as string,
      bis: sp.bis as string,
    };
  } else if (sp.von) {
    filter.zeitraum = { von: sp.von as string, bis: new Date().toISOString() };
  } else if (sp.bis) {
    filter.zeitraum = { von: "1970-01-01", bis: sp.bis as string };
  }

  const initialRechnungen = await listRechnungenAction(filter);

  // We can also fetch the OP sum here or just let the client reduce it
  const offeneSumme = initialRechnungen.filter(i => ["offen", "teilbezahlt", "ueberfaellig", "gemahnt"].includes(i.status)).reduce((s, i) => s + (i.brutto || 0), 0);
  const ueberfaelligSumme = initialRechnungen.filter(i => ["ueberfaellig", "gemahnt"].includes(i.status) || (new Date(i.faelligAm || '') < new Date() && ["offen", "teilbezahlt"].includes(i.status))).reduce((s, i) => s + (i.brutto || 0), 0);

  return <RechnungenClient initialRechnungen={initialRechnungen} offeneSumme={offeneSumme} ueberfaelligSumme={ueberfaelligSumme} initialFilter={sp} />;
}

import { BelegeClient } from "./BelegeClient";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { BelegFilter } from "@/lib/buchhaltung/types";

export const dynamic = "force-dynamic";

export default async function BelegePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const provider = getBuchhaltungProvider();
  const sp = await searchParams;
  
  const filter: BelegFilter = {
    kategorieId: sp.kategorie as string | undefined,
    status: sp.status as BelegFilter["status"],
    belegart: sp.belegart as BelegFilter["belegart"],
    missingKonto: sp.view === "missingKonto" ? true : undefined,
    missingKostenstelle: sp.view === "missingKostenstelle" ? true : undefined,
    nichtAufAuftrag: sp.view === "nichtAufAuftrag" ? true : undefined,
  };
  
  const belege = await provider.listBelege(filter);
  
  return <BelegeClient initialBelege={belege} />;
}


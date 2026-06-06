import { BelegeClient } from "./BelegeClient";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";

export const dynamic = "force-dynamic";

export default async function BelegePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const provider = getBuchhaltungProvider();
  const sp = await searchParams;
  
  const filter = {
    kategorieId: sp.kategorie as string | undefined,
    status: sp.status as any,
    belegart: sp.belegart as any,
  };
  
  const belege = await provider.listBelege(filter);
  
  return <BelegeClient initialBelege={belege} />;
}



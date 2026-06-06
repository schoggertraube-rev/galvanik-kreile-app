import { listKostenpostenAction } from "@/app/buchhaltung/actions";
import { KostenClient } from "./KostenClient";

export default async function KostenPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const sp = await searchParams;
  const art = sp.art as "fix" | "variabel" | undefined;
  const kategorie = sp.kategorie;

  const kosten = await listKostenpostenAction({ art, kategorie });

  return <KostenClient initialKosten={kosten} initialArt={art || "alle"} initialKategorie={kategorie || "alle"} />;
}

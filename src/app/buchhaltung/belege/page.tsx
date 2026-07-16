import { BelegeClient } from "@/app/buchhaltung/belege/BelegeClient";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { Belegart, BelegFilter, BelegStatus } from "@/lib/buchhaltung/types";

export const dynamic = "force-dynamic";

const STATUSES = new Set<BelegStatus>(["pruefen", "erfasst", "festgeschrieben", "storniert"]);
const TYPES = new Set<Belegart>(["rechnung", "kassenbon", "tankbeleg", "bewirtung", "abo"]);
const VIEWS = new Set(["missingKonto", "missingKostenstelle", "nichtAufAuftrag"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function BelegePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = single(sp.status);
  const belegart = single(sp.belegart);
  const category = single(sp.kategorie);
  const view = single(sp.view);
  const filter: BelegFilter = {
    ...(status && STATUSES.has(status as BelegStatus) ? { status: status as BelegStatus } : {}),
    ...(belegart && TYPES.has(belegart as Belegart) ? { belegart: belegart as Belegart } : {}),
    ...(category && UUID.test(category) ? { kategorieId: category } : {}),
    ...(view === "missingKonto" ? { missingKonto: true } : {}),
    ...(view === "missingKostenstelle" ? { missingKostenstelle: true } : {}),
    ...(view === "nichtAufAuftrag" ? { nichtAufAuftrag: true } : {}),
  };
  const provider = getBuchhaltungProvider();
  const belege = await provider.listBelege(filter);

  return (
    <BelegeClient
      initialBelege={belege}
      activeStatus={status && STATUSES.has(status as BelegStatus) ? status as BelegStatus : null}
      activeView={view && VIEWS.has(view) ? view : null}
    />
  );
}

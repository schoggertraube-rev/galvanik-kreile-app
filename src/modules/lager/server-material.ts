import "server-only";

import { hasAuthorizationArea, hasLagerCapability } from "@/lib/auth/authorizationContract";
import { InvoiceMaterialUnitError } from "@/lib/domain/invoiceElectronicFields";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { LAGER_BUCHUNG_COPY as copy } from "@/ui/lagerBuchungCopy";
import { LAGER_MATERIAL_COPY } from "@/ui/lagerMaterialCopy";
import { fasseMaterialpositionenZusammen } from "./materialpreis";
import { leseLagerAuftragsmaterialInTransaction } from "./server-w1";

export async function leseLagerMaterialpositionenInTransaction(tx: PrivilegedTenantTransaction, auftragIds: readonly string[]) {
  return fasseMaterialpositionenZusammen(await leseLagerAuftragsmaterialInTransaction(tx, auftragIds));
}

type Position = Awaited<ReturnType<typeof leseLagerMaterialpositionenInTransaction>>[number];
type Kartenposition = Omit<Position, "verkaufspreis" | "betragCent" | "wareneinsatzCent">
  & Partial<Pick<Position, "verkaufspreis" | "betragCent" | "wareneinsatzCent">>;

export async function leseAuftragsmaterial(auftragId: string): Promise<ActionResult<Kartenposition[]>> {
  const login = await resolveAuthorization();
  if (!login.ok) return { ok: false, error: "UNAUTHORIZED", message: copy.sitzung };
  const auth = login.data;
  if (!hasLagerCapability(auth, "lager.lesen")) return { ok: false, error: "FORBIDDEN", message: copy.leserecht };
  if (auth.packageSwitches?.p4_lager !== true) return { ok: false, error: "FORBIDDEN", message: copy.ausgeschaltet };
  if (!hasAuthorizationArea(auth, "auftraege")) return { ok: false, error: "FORBIDDEN", message: copy.auftragsrecht };
  if (typeof auftragId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/u.test(auftragId)) {
    return { ok: false, error: "VALIDATION_ERROR", message: copy.laden };
  }

  try {
    const positionen = await withPrivilegedTenantTransaction(auth, (tx) =>
      leseLagerMaterialpositionenInTransaction(tx, [auftragId]));
    if (hasLagerCapability(auth, "lager.werte")) return { ok: true, data: positionen };
    return { ok: true, data: positionen.map((position) => ({
      auftragId: position.auftragId, artikelId: position.artikelId, artikel: position.artikel,
      einheit: position.einheit, einheitCode: position.einheitCode, menge: position.menge,
      preisFehlt: position.preisFehlt, gesperrtDurchRechnung: position.gesperrtDurchRechnung,
      eventIds: position.eventIds,
    })) };
  } catch (error) {
    if (error instanceof InvoiceMaterialUnitError) {
      return { ok: false, error: "VALIDATION_ERROR", message: LAGER_MATERIAL_COPY.rechnungseinheitFehlt(error.unit),
        details: { code: error.message, einheit: error.unit } };
    }
    return { ok: false, error: "DB_ERROR", message: copy.laden };
  }
}

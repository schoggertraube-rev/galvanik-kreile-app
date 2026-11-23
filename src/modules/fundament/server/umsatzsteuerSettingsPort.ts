import "server-only";

import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

import type { Firmensteuersaetze } from "../public";

export type UmsatzsteuerSaetze = Firmensteuersaetze;

const gueltigerSatz = (wert: unknown): wert is number =>
  typeof wert === "number" && Number.isSafeInteger(wert) && wert > 0 && wert <= 10000;

export function parseFirmensteuersaetze(wert:unknown):UmsatzsteuerSaetze|null{
  if(typeof wert!=="object"||wert===null||Array.isArray(wert)
    ||Object.keys(wert).sort().join(",")!=="ermaessigtBasispunkte,regelsatzBasispunkte")return null;
  const {regelsatzBasispunkte,ermaessigtBasispunkte}=wert as Record<string,unknown>;
  if((regelsatzBasispunkte!==null&&!gueltigerSatz(regelsatzBasispunkte))
    ||!gueltigerSatz(ermaessigtBasispunkte))return null;
  return {regelsatzBasispunkte,ermaessigtBasispunkte};
}

export async function readUmsatzsteuerSaetzeInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<UmsatzsteuerSaetze | null> {
  const zeilen = await tx.execute<UmsatzsteuerSaetze>(sql`
    SELECT invoice_vat_rate_basis_points AS "regelsatzBasispunkte",
           invoice_reduced_vat_rate_basis_points AS "ermaessigtBasispunkte"
    FROM public.company_settings
    WHERE tenant_id = ${tenantId} AND current_setting('app.tenant_id', true) = ${tenantId}
    LIMIT 2
  `);
  return zeilen.length===1?parseFirmensteuersaetze(zeilen[0]):null;
}

/** Prüft neue inländische Positionen anhand des in derselben Transaktion gelesenen Stands. */
export function qualifiziereUmsatzsteuerPosition(
  stand: UmsatzsteuerSaetze | null, auswahl: "regel" | "ermaessigt", grund: string | null,
) {
  if (!stand || !gueltigerSatz(stand.regelsatzBasispunkte) || !gueltigerSatz(stand.ermaessigtBasispunkte)
    || stand.ermaessigtBasispunkte > stand.regelsatzBasispunkte) {
    return { code: "STEUER_EINSTELLUNG_FEHLT" } as const;
  }
  if (auswahl !== "regel" && auswahl !== "ermaessigt") return { code: "STEUER_AUSWAHL_UNGUELTIG" } as const;
  const satzBasispunkte = auswahl === "ermaessigt" ? stand.ermaessigtBasispunkte : stand.regelsatzBasispunkte;
  const ermaessigt = satzBasispunkte === stand.ermaessigtBasispunkte;
  const beleggrund = typeof grund === "string" ? grund.trim() : "";
  if (ermaessigt && !beleggrund) return { code: "STEUER_GRUND_FEHLT" } as const;
  return { code: "OK", satzBasispunkte, grund: ermaessigt ? beleggrund : null } as const;
}

type BestaetigterPositionssteuersatz = Readonly<{
  itemId: string;
  vatRateBasisPoints: number | null;
  vatReductionReason?: string | null;
}>;

/** Vergleicht eine inländische Originalposition mit derselben bestätigten Position. */
export function pruefeUmsatzsteuerOriginalposition(
  bestaetigt: BestaetigterPositionssteuersatz,
  original: BestaetigterPositionssteuersatz,
): boolean {
  if (typeof bestaetigt.itemId !== "string" || !bestaetigt.itemId.trim() || bestaetigt.itemId !== original.itemId) {
    return false;
  }
  const satz = bestaetigt.vatRateBasisPoints;
  const grund = bestaetigt.vatReductionReason ?? null;
  if (!(satz === null || satz === 0 || gueltigerSatz(satz))) return false;
  if (grund !== null && (!gueltigerSatz(satz) || typeof grund !== "string" || !grund.trim() || grund.trim() !== grund)) {
    return false;
  }
  return original.vatRateBasisPoints === satz && (original.vatReductionReason ?? null) === grund;
}

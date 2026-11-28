import "server-only";

import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { invoiceCents } from "../invoiceContract";

export type Erkennungskorrektur = { feld: string; alt: unknown; neu: unknown };

export async function speichereErkennungskorrekturen(tx: PrivilegedTenantTransaction,
  auth: { tenantId: string; userId: string }, input: {
    itemId: string; befehlId: string; absender: string | null; korrekturen: readonly Erkennungskorrektur[];
  }) {
  if (!input.korrekturen.length) return;
  const rows = await tx.execute(sql`
    INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
    SELECT ${auth.tenantId},${input.itemId}::uuid,'korrigiert',${input.befehlId}::uuid,${auth.userId},
      jsonb_build_object('feld',feld,'alt',alt,'neu',neu,'absender',${input.absender}::text)
    FROM jsonb_to_recordset(${JSON.stringify(input.korrekturen)}::jsonb) AS a(feld text,alt jsonb,neu jsonb)
    RETURNING id`);
  if (rows.length !== input.korrekturen.length) throw Error("INTAKE_CORRECTION_RECEIPT_MISSING");
}

type Belegwert = { field: string; value: unknown };
export function findeRechnungswiderspruch(xml: readonly Belegwert[], pdf: readonly Belegwert[]) {
  const eindeutigerWert = <T>(quelle: readonly Belegwert[], feld: string, lesen: (wert: unknown) => T | null) => {
    const werte = new Set(quelle.filter(v => v.field === feld).map(v => lesen(v.value)).filter(wert => wert !== null));
    return werte.size === 1 ? [...werte][0] : null;
  };
  const nummer = (wert: unknown) => typeof wert === "string" && wert.trim() ? wert.trim().normalize("NFKC").toUpperCase() : null;
  const brutto = (wert: unknown) => {
    if (!wert || typeof wert !== "object" || !("brutto" in wert)) return null;
    return typeof wert.brutto === "string" || typeof wert.brutto === "number" ? invoiceCents(String(wert.brutto)) : null;
  };
  const xmlNummer = eindeutigerWert(xml, "rechnung.nummer", nummer);
  const pdfNummer = eindeutigerWert(pdf, "rechnung.nummer", nummer);
  const xmlBrutto = eindeutigerWert(xml, "rechnung.betrag", brutto);
  const pdfBrutto = eindeutigerWert(pdf, "rechnung.betrag", brutto);
  return (xmlNummer !== null && pdfNummer !== null && xmlNummer !== pdfNummer)
    || (xmlBrutto !== null && pdfBrutto !== null && xmlBrutto !== pdfBrutto)
    ? { xml: { nummer: xmlNummer, bruttoCent: xmlBrutto }, pdf: { nummer: pdfNummer, bruttoCent: pdfBrutto } }
    : null;
}

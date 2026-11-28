import "server-only";

import { sql } from "drizzle-orm";
import { foldSearchText } from "@/lib/domain/searchText";
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

export type Firmenhinweis = { name: string | null; ustId: string | null };

export function istLieferantenwert(feld: string) {
  return feld === 'lieferant.name' || feld === 'lieferant.ustid' || feld === 'rechnung.absender';
}

export function istEigenerLieferantenwert({field,value}: Belegwert, firma: Firmenhinweis | null) {
  if (!firma) return false;
  const name = field === 'lieferant.name' ? value
    : field === 'rechnung.absender' && value && typeof value === 'object' && 'name' in value ? value.name : null;
  const ustId = field === 'lieferant.ustid' ? value
    : field === 'rechnung.absender' && value && typeof value === 'object' && 'ustId' in value ? value.ustId : null;
  const firmenname = foldSearchText(firma.name ?? '');
  const firmenUstId = falteBelegUstId(firma.ustId);
  return Boolean(typeof name === 'string' && firmenname && foldSearchText(name) === firmenname)
    || Boolean(typeof ustId === 'string' && firmenUstId && falteBelegUstId(ustId) === firmenUstId);
}

export function falteBelegUstId(wert: string | null) {
  return wert?.replace(/\s+/gu, '').toUpperCase() ?? '';
}

export function findeVerdachtsmuster(text: string, muster: readonly string[]) {
  const gefaltet = foldSearchText(text);
  return [...new Set(muster.map(foldSearchText).filter(wert => wert && (wert === 'link'
    ? /\b(?:https?:\/\/|www\.)[^\s<>]+/iu.test(text)
    : wert === 'qr' ? /\bqr(?:[- ]?code)?\b/iu.test(text) : gefaltet.includes(wert))))];
}
export function rechnungsBelegwerte(quelle: readonly Belegwert[]) {
  const eindeutigerWert = <T>(feld: string, lesen: (wert: unknown) => T | null) => {
    const werte = new Set(quelle.filter(v => v.field === feld).map(v => lesen(v.value)).filter(wert => wert !== null));
    return werte.size === 1 ? [...werte][0] : null;
  };
  const nummer = (wert: unknown) => typeof wert === "string" && wert.trim() ? wert.trim().normalize("NFKC").toUpperCase() : null;
  const brutto = (wert: unknown) => {
    if (!wert || typeof wert !== "object" || !("brutto" in wert)) return null;
    return typeof wert.brutto === "string" || typeof wert.brutto === "number" ? invoiceCents(String(wert.brutto)) : null;
  };
  return {nummer:eindeutigerWert('rechnung.nummer',nummer),bruttoCent:eindeutigerWert('rechnung.betrag',brutto)};
}

export function findeRechnungswiderspruch(xml: readonly Belegwert[], pdf: readonly Belegwert[]) {
  const links=rechnungsBelegwerte(xml),rechts=rechnungsBelegwerte(pdf);
  return (links.nummer!==null&&rechts.nummer!==null&&links.nummer!==rechts.nummer)
    || (links.bruttoCent!==null&&rechts.bruttoCent!==null&&links.bruttoCent!==rechts.bruttoCent)
    ? {xml:links,pdf:rechts} : null;
}

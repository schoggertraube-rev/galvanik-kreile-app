import "server-only";

import { sql } from "drizzle-orm";
import { hasLagerCapability } from "@/lib/auth/authorizationContract";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { LAGER_BUCHUNG_COPY } from "@/ui/lagerBuchungCopy";
import { bucheLagerEinzeln, type LagerBestandsaufgabe } from "./server-buchung";
import { leseLagerBuchungsauftrag } from "./lagerBuchungsauftrag";
import type { LagerEinstellungenLeser } from "./server-lagerregeln";

export type W1Vorschlag = {
  originalId: string;
  titel: string;
  originalZeit: string | null;
  kandidaten: { id: string; zeit: string | null; station: string | null }[];
};
export type W1Entscheidung = {
  originalId: string; befehlId: string; wahl: "zusammengefuehrt" | "beide"; journalId?: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function imW1Port<T>(work: (tx: PrivilegedTenantTransaction, userId: string, auth: AuthorizationSnapshot) => Promise<ActionResult<T>>) {
  const login = await resolveAuthorization();
  if (!login.ok) return { ok: false, error: "UNAUTHORIZED", message: LAGER_BUCHUNG_COPY.sitzung } as const;
  const auth = login.data;
  if (!darfLagerW1Bearbeiten(auth)) {
    return { ok: false, error: "FORBIDDEN", message: LAGER_BUCHUNG_COPY.w1Recht } as const;
  }
  try {
    return await withPrivilegedTenantTransaction(auth, (tx) => work(tx, auth.userId, auth));
  } catch (error) {
    const original = error instanceof Error ? error.cause ?? error : error;
    const code = original && typeof original === "object" && "code" in original ? original.code : null;
    if (code === "23505" || code === "22023") {
      return { ok: false, error: "CONFLICT", message: LAGER_BUCHUNG_COPY.w1Pruefen } as const;
    }
    return { ok: false, error: "DB_ERROR", message: LAGER_BUCHUNG_COPY.speichern } as const;
  }
}

export function darfLagerW1Bearbeiten(auth: AuthorizationSnapshot) {
  return auth.packageSwitches?.p4_lager === true && hasLagerCapability(auth, "lager.stamm");
}

export async function leseLagerW1VorschlaegeInTransaction(tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot) {
  if (!darfLagerW1Bearbeiten(auth)) return [];
  const zeilen = await tx.execute<W1Vorschlag>(sql`
    SELECT v.original_id::text AS "originalId", v.titel,
      to_char((v.original->>'created_at')::timestamptz AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI:SS') AS "originalZeit",
      zusammen.kandidaten
    FROM private.lager_w1_vorschlaege v
    JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'id',j.id,'zeit',to_char(j.created_at AT TIME ZONE 'Europe/Berlin','DD.MM.YYYY HH24:MI:SS'),
        'station',j.station_kuerzel
      ) ORDER BY j.created_at NULLS LAST,j.id) AS kandidaten
      FROM jsonb_array_elements_text(v.kandidaten) original(id)
      JOIN public.stock_movements j ON j.tenant_id = ${auth.tenantId} AND j.id = original.id::uuid
    ) zusammen ON zusammen.kandidaten IS NOT NULL
    WHERE v.stand = 'vorschlag' ORDER BY v.titel, v.original_id`);
  return [...zeilen];
}

export function leseLagerW1Vorschlaege() {
  return imW1Port<W1Vorschlag[]>(async (tx, _akteur, auth) =>
    ({ ok: true, data: await leseLagerW1VorschlaegeInTransaction(tx, auth) }));
}

export function entscheideLagerW1Vorschlag(input: W1Entscheidung) {
  return imW1Port<string>(async (tx, akteur) => {
    if (!input || typeof input.originalId !== "string" || !uuid.test(input.originalId)
      || typeof input.befehlId !== "string" || !uuid.test(input.befehlId)
      || !(input.wahl === "zusammengefuehrt" && typeof input.journalId === "string" && uuid.test(input.journalId)
        || input.wahl === "beide" && input.journalId === undefined)) {
      return { ok: false, error: "VALIDATION_ERROR", message: LAGER_BUCHUNG_COPY.w1Pruefen };
    }
    const [beleg] = await tx.execute<{ id: string }>(sql`
      SELECT private.lager_w1_entscheiden(${input.originalId}::uuid,${akteur}::uuid,${input.befehlId}::uuid,
        ${input.wahl},${input.journalId ?? null}::uuid)::text AS id`);
    if (!beleg) throw Error("LAGER_W1_QUITTUNG_FEHLT");
    return { ok: true, data: beleg.id };
  });
}

export async function leseLagerAuftragsmaterialInTransaction(tx: PrivilegedTenantTransaction, auftragId: string) {
  return [...await tx.execute<{
    journalId: string; artikelId: string | null; menge: string; einheit: string | null;
    wertEur: string | null; imPreisEnthalten: boolean | null; mehrarbeitBelegId: string | null;
    preisFehlt: boolean; vorlaeufig: boolean; weitereOriginalIds: string[];
  }>(sql`
    SELECT kosten.journal_id::text AS "journalId", kosten.artikel_id AS "artikelId", kosten.menge::text,
      coalesce(kosten.mengeneinheit, journal.altquelle->>'unit') AS einheit,
      kosten.wert_eur::text AS "wertEur", (kosten.ek IS NULL) AS "preisFehlt", kosten.im_preis_enthalten AS "imPreisEnthalten",
      journal.mehrarbeit_beleg_id AS "mehrarbeitBelegId", kosten.vorlaeufig,
      kosten.weitere_original_ids AS "weitereOriginalIds"
    FROM private.lager_w1_auftragskosten kosten
    JOIN public.stock_movements journal ON journal.id = kosten.journal_id
      AND journal.tenant_id = nullif(btrim(current_setting('app.tenant_id',true)),'')
    WHERE kosten.order_id = ${auftragId} ORDER BY kosten.journal_id`)];
}


export function bucheAuftragsverbrauch(
  input: unknown, liesEinstellungen: LagerEinstellungenLeser, synchronisiere: LagerBestandsaufgabe,
) {
  return bucheLagerEinzeln(input, liesEinstellungen, synchronisiere, wert => {
    const auftrag = leseLagerBuchungsauftrag(wert);
    return auftrag?.movementType === "consumption" && auftrag.orderId !== null
      && typeof auftrag.imPreisEnthalten === "boolean" ? auftrag : null;
  });
}

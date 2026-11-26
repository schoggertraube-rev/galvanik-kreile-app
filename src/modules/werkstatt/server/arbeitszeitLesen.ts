import "server-only";

import { sql } from "drizzle-orm";
import { hasAuthorizationArea } from "@/lib/auth/authorizationContract";
import { berlinCalendarDay } from "@/lib/domain/workingDays";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { readActorNames } from "@/lib/server/caseActorRead";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { ACTOR_COPY } from "@/ui/allgemeinCopy";
import { WORK_TIME_COPY } from "@/ui/werkstattCopy";

type ArbeitszeitSumme = Readonly<{
  status: "gebucht" | "ohne_buchung";
  heuteMinuten: number;
  gesamtMinuten: number;
  kostenCent?: number;
}>;

export type ArbeitszeitStand = Readonly<{
  auftrag: ArbeitszeitSumme;
  zeilen: readonly (ArbeitszeitSumme & { positionId: string })[];
  fehlendeKostensaetze?: readonly { id: string; name: string; quelle: "standard" | "fehlt"; hinweis: string }[];
}>;

type Zeitstand = {
  auftragId: string;
  positionId: string | null;
  heuteMinuten: string;
  gesamtMinuten: string;
  kostenCent?: string | null;
  personenMitStandardsatz?: string[] | null;
  personenOhneSatz?: string[] | null;
};

function darfArbeitszeitLesen(auth: AuthorizationSnapshot) {
  return auth.active && hasAuthorizationArea(auth, "auftraege") && auth.packageSwitches?.p3_werkstatt === true;
}

function ganzeZahl(wert: string): number {
  const zahl = Number(wert);
  if (!Number.isSafeInteger(zahl)) throw Error("ARBEITSZEIT_SUMME_AUSSERHALB_ZAHLENBEREICH");
  return zahl;
}

function fasseZeitZusammen(stand: Zeitstand | undefined): ArbeitszeitSumme {
  if (!stand) return { status: "ohne_buchung", heuteMinuten: 0, gesamtMinuten: 0 };
  return {
    status: "gebucht",
    heuteMinuten: ganzeZahl(stand.heuteMinuten),
    gesamtMinuten: ganzeZahl(stand.gesamtMinuten),
    ...(stand.kostenCent != null ? { kostenCent: ganzeZahl(stand.kostenCent) } : {}),
  };
}

async function leseSummen(
  auth: AuthorizationSnapshot,
  auftragIds: readonly string[],
  positionIds: readonly string[],
  mitKosten: boolean,
) {
  const auftraege = sql.join(auftragIds.map(id => sql`${id}`), sql`, `);
  const gruppierung = positionIds.length
    ? sql`GROUP BY GROUPING SETS ((zeit.auftrag_id), (zeit.auftrag_id, zeit.item_id))
      HAVING grouping(zeit.item_id) = 1
        OR zeit.item_id IN (${sql.join(positionIds.map(id => sql`${id}`), sql`, `)})`
    : sql`GROUP BY zeit.auftrag_id`;
  const position = positionIds.length ? sql`zeit.item_id` : sql`NULL::text`;
  const kosten = mitKosten
    ? sql`, CASE WHEN NOT bool_or(zeit.kostensatz_eur_pro_stunde IS NULL)
        THEN round(sum(zeit.dauer_minuten::numeric * zeit.kostensatz_eur_pro_stunde) * 100 / 60)::text
      END AS "kostenCent",
      array_agg(DISTINCT zeit.employee_id::text) FILTER (
        WHERE zeit.kostensatz_quelle = 'standard' AND zeit.korrigiert_id IS NULL
      ) AS "personenMitStandardsatz",
      array_agg(DISTINCT zeit.employee_id::text) FILTER (
        WHERE zeit.kostensatz_quelle = 'fehlt' AND zeit.korrigiert_id IS NULL
      ) AS "personenOhneSatz"`
    : sql.empty();
  const heute = berlinCalendarDay();
  return withPrivilegedTenantTransaction(auth, async tx => {
    const summen = await tx.execute<Zeitstand>(sql`
    SELECT zeit.auftrag_id AS "auftragId", ${position} AS "positionId",
      coalesce(sum(zeit.dauer_minuten) FILTER (
        WHERE (zeit.start_zeit AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date
      ), 0)::text AS "heuteMinuten",
      sum(zeit.dauer_minuten)::text AS "gesamtMinuten"
      ${kosten}
    FROM public.arbeitszeit_buchung zeit
    WHERE zeit.tenant_id = ${auth.tenantId} AND zeit.auftrag_id IN (${auftraege})
    ${gruppierung}
    `);
    const gesamt = mitKosten ? summen.find(zeile => zeile.positionId === null) : undefined;
    const personensätze = new Map<string, "standard" | "fehlt">();
    for (const id of gesamt?.personenMitStandardsatz ?? []) personensätze.set(id, "standard");
    for (const id of gesamt?.personenOhneSatz ?? []) personensätze.set(id, "fehlt");
    const namen = await readActorNames(tx, auth.tenantId, [...personensätze.keys()]);
    const fehlendeKostensaetze = [...personensätze].map(([id, quelle]) => {
      const name = namen.get(id) ?? ACTOR_COPY.unknownLogin;
      return { id, name, quelle, hinweis: WORK_TIME_COPY.costRateMissing(name) };
    });
    return { summen, fehlendeKostensaetze };
  });
}

export async function readWorkMinutes(auth: AuthorizationSnapshot, auftragIds: readonly string[]) {
  if (!darfArbeitszeitLesen(auth) || auftragIds.length === 0) return new Map<string, { heute: number; gesamt: number }>();

  const ids = [...new Set(auftragIds)];
  const { summen } = await leseSummen(auth, ids, [], false);
  const jeAuftrag = new Map(summen.map(zeile => [zeile.auftragId, zeile]));
  return new Map(ids.map(auftragId => {
    const summe = fasseZeitZusammen(jeAuftrag.get(auftragId));
    return [auftragId, { heute: summe.heuteMinuten, gesamt: summe.gesamtMinuten }];
  }));
}

export async function leseArbeitszeitZumAuftrag(
  auth: AuthorizationSnapshot,
  auftragId: string,
  positionIds: readonly string[],
): Promise<ArbeitszeitStand | null> {
  if (!darfArbeitszeitLesen(auth)) return null;

  const positionen = [...new Set(positionIds)];
  const { summen, fehlendeKostensaetze } = await leseSummen(auth, [auftragId], positionen, hasAuthorizationArea(auth, "preise"));
  const zeileJePosition = new Map(summen.map(zeile => [zeile.positionId, zeile]));
  return {
    auftrag: fasseZeitZusammen(zeileJePosition.get(null)),
    zeilen: positionen.map(positionId => ({ positionId, ...fasseZeitZusammen(zeileJePosition.get(positionId)) })),
    ...(fehlendeKostensaetze.length ? { fehlendeKostensaetze } : {}),
  };
}

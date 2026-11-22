import "server-only";

import { isDeepStrictEqual } from "node:util";
import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { FahrerAuswahl, FahrzeugAuswahl, FahrzeugEingabe, FahrzeugPflege, FahrzeugSpeichern } from "../fahrzeugVertrag";

type FahrzeugKontext = Readonly<{ tenantId: string; actorId: string; canManageCompany: boolean }>;
type Fahrzeugzeile = FahrzeugEingabe & { geaendertVon: string };

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const fahrzeugFelder = sql`id::text,version,kennzeichen,art,kraftstoff,tankkarte,fahrer_id::text AS "fahrerId",
  start_km AS "startKm",aktiv`;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max && !/[\u0000-\u001f]/.test(trimmed) ? trimmed : null;
}

function parseFahrzeugEingabe(input: unknown): FahrzeugEingabe | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<keyof FahrzeugEingabe, unknown>;
  const { id, version, startKm, aktiv, fahrerId } = value;
  const kennzeichen = text(value.kennzeichen,24)?.toUpperCase();
  const art = text(value.art,80);
  const kraftstoff = text(value.kraftstoff,80);
  const tankkarte = value.tankkarte === null ? null : text(value.tankkarte,80);
  if (typeof id !== "string" || !uuid.test(id) || typeof version !== "number" || !Number.isSafeInteger(version)
    || version < 0 || version >= 2_147_483_647 || typeof startKm !== "number" || !Number.isSafeInteger(startKm)
    || startKm < 0 || startKm > 2_147_483_647 || typeof aktiv !== "boolean"
    || !(fahrerId === null || (typeof fahrerId === "string" && uuid.test(fahrerId)))
    || !kennzeichen || kennzeichen.length > 24 || !/[A-Z0-9ÄÖÜ]/.test(kennzeichen)
    || !art || !kraftstoff || (value.tankkarte !== null && tankkarte === null)) return null;
  return { id:id.toLowerCase(),version,kennzeichen,art,kraftstoff,tankkarte,fahrerId:fahrerId?.toLowerCase() ?? null,startKm,aktiv };
}

async function pruefePflegerecht(tx: PrivilegedTenantTransaction, context: FahrzeugKontext): Promise<boolean> {
  if (!context.canManageCompany || !uuid.test(context.actorId)) return false;
  const rows = await tx.execute<{ erlaubt: boolean }>(sql`
    SELECT EXISTS(SELECT 1 FROM public.app_users WHERE tenant_id=${context.tenantId}
      AND id=${context.actorId}::uuid AND active) AND
      current_setting('app.tenant_id', true)=${context.tenantId} AS erlaubt
  `);
  return rows[0]?.erlaubt === true;
}

/** Auswahl für KP9 und GE14 in ihrer eigenen autorisierten Transaktion. */
export async function liesAktiveFahrzeugauswahl(tx: PrivilegedTenantTransaction, tenantId: string): Promise<FahrzeugAuswahl[]> {
  return tx.execute<FahrzeugAuswahl>(sql`
    SELECT id::text,kennzeichen,art FROM public.vehicles WHERE tenant_id=${tenantId} AND aktiv
      AND current_setting('app.tenant_id', true)=${tenantId}
    ORDER BY kennzeichen,id
  `);
}

export async function liesFahrzeugPflege(
  tx: PrivilegedTenantTransaction, context: FahrzeugKontext,
): Promise<FahrzeugPflege | null> {
  if (!await pruefePflegerecht(tx,context)) return null;
  const fahrzeuge = await tx.execute<FahrzeugEingabe>(sql`
    SELECT ${fahrzeugFelder} FROM public.vehicles WHERE tenant_id=${context.tenantId}
    ORDER BY aktiv DESC,kennzeichen,id
  `);
  const fahrer = await tx.execute<FahrerAuswahl>(sql`
    SELECT id::text,full_name AS name FROM public.app_users WHERE tenant_id=${context.tenantId} AND active
    ORDER BY full_name,id
  `);
  return { fahrzeuge,fahrer };
}

export async function speichereFahrzeug(
  tx: PrivilegedTenantTransaction, context: FahrzeugKontext, input: unknown,
): Promise<FahrzeugSpeichern> {
  if (!await pruefePflegerecht(tx,context)) return { code:"FORBIDDEN" };
  const neu = parseFahrzeugEingabe(input);
  if (!neu) return { code:"INVALID" };
  const { tenantId,actorId } = context;
  // Serialisiert Anlegen und Kennzeichenwechsel innerhalb desselben Fahrzeugstamms.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId+":vehicle-register"},0))`);
  const [aktuell] = await tx.execute<Fahrzeugzeile>(sql`
    SELECT ${fahrzeugFelder},geaendert_von::text AS "geaendertVon"
    FROM public.vehicles WHERE tenant_id=${tenantId} AND id=${neu.id}::uuid FOR UPDATE
  `);
  if (aktuell) {
    const { geaendertVon,...fahrzeug } = aktuell;
    const gleich = isDeepStrictEqual(fahrzeug,{...neu,version:fahrzeug.version});
    if (gleich && (fahrzeug.version === neu.version || (geaendertVon === actorId && fahrzeug.version === neu.version+1))) {
      return { code:"OK",fahrzeug };
    }
    if (fahrzeug.version !== neu.version) return { code:"CONFLICT" };
  } else if (neu.version !== 0) {
    return { code:"CONFLICT" };
  }
  if (neu.fahrerId && neu.fahrerId !== aktuell?.fahrerId) {
    const fahrer = await tx.execute(sql`
      SELECT id FROM public.app_users
      WHERE tenant_id=${tenantId} AND id=${neu.fahrerId}::uuid AND active
      FOR SHARE
    `);
    if (fahrer.length !== 1) return { code:"INVALID" };
  }
  const belegt = await tx.execute(sql`
    SELECT id FROM public.vehicles WHERE tenant_id=${tenantId} AND id<>${neu.id}::uuid
      AND regexp_replace(upper(kennzeichen),'[[:space:]-]+','','g')
        =regexp_replace(upper(${neu.kennzeichen}),'[[:space:]-]+','','g')
  `);
  if (belegt.length) return { code:"CONFLICT" };
  const [fahrzeug] = await tx.execute<FahrzeugEingabe>(sql`
    INSERT INTO public.vehicles (tenant_id,id,kennzeichen,art,kraftstoff,tankkarte,fahrer_id,start_km,aktiv,angelegt_von,geaendert_von)
    VALUES (${tenantId},${neu.id}::uuid,${neu.kennzeichen},${neu.art},${neu.kraftstoff},${neu.tankkarte},
      ${neu.fahrerId}::uuid,${neu.startKm},${neu.aktiv},${actorId}::uuid,${actorId}::uuid)
    ON CONFLICT (tenant_id,id) DO UPDATE SET
      kennzeichen=excluded.kennzeichen,art=excluded.art,kraftstoff=excluded.kraftstoff,tankkarte=excluded.tankkarte,
      fahrer_id=excluded.fahrer_id,start_km=excluded.start_km,aktiv=excluded.aktiv,
      geaendert_am=statement_timestamp(),geaendert_von=excluded.geaendert_von,version=vehicles.version+1
    WHERE vehicles.version=${neu.version}
    RETURNING ${fahrzeugFelder}
  `);
  return fahrzeug ? { code:"OK",fahrzeug } : { code:"CONFLICT" };
}

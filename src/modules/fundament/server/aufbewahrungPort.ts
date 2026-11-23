import "server-only";

import { sql } from "drizzle-orm";
import { hasAuthorizationArea } from "@/lib/auth/authorizationContract";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { DOKUMENTAUFBEWAHRUNG_COPY as copy } from "@/ui/situationCatalog";

type Dokument = Readonly<{ typ: string; id: string }>;
type Sperrgrund = "laufende_pruefung" | "streit" | "offene_forderung";
type Befehl = Readonly<{ befehlId: string; original: Dokument; grund: Sperrgrund }>;
type Originalnachweis = (
  tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, original: Dokument,
) => Promise<boolean>;

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const art = /^[a-z][a-z0-9_]{0,79}$/;

async function autorisiert(tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, setzen = false) {
  if (!hasAuthorizationArea(auth,"einstellungen") || (setzen && !hasAuthorizationArea(auth,"buchhaltung"))) return false;
  const [mandant] = await tx.execute<{ passt:boolean }>(sql`
    SELECT current_setting('app.tenant_id',true)=${auth.tenantId} AS passt
  `);
  return mandant?.passt===true;
}

export async function liesDokumentfrist(
  tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, dokumentart: string, belegdatum: string,
) {
  if (!await autorisiert(tx,auth) || !art.test(dokumentart)) return null;
  const datum = new Date(belegdatum+"T00:00:00.000Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(belegdatum) || belegdatum.startsWith("0000") ||
    !Number.isFinite(datum.getTime()) || datum.toISOString().slice(0,10)!==belegdatum) return null;
  const [row] = await tx.execute<{ jahre:number }>(sql`
    SELECT frist_jahre AS jahre FROM public.dokument_aufbewahrung
    WHERE tenant_id=${auth.tenantId} AND dokumentart=${dokumentart}
  `);
  if (!row) return { code:"FEHLT" as const,meldung:copy.fehlt,fristEnde:null };
  const bisJahr=datum.getUTCFullYear()+row.jahre;
  if (!Number.isInteger(bisJahr) || bisJahr>9999) throw Error("KP12_FRIST_UNGUELTIG");
  return { code:"OK" as const,fristJahre:row.jahre,fristEnde:`${String(bisJahr).padStart(4,"0")}-12-31` };
}

export async function setzeAblaufhemmung(
  tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, befehl: Befehl, hatOriginal: Originalnachweis,
) {
  if (!await autorisiert(tx,auth,true) || !uuid.test(auth.userId)) return { code:"FORBIDDEN" as const };
  const { befehlId,original,grund } = befehl;
  if (!uuid.test(befehlId) || !art.test(original.typ) || original.id.trim()!==original.id ||
    !original.id || original.id.length>160 || !["laufende_pruefung","streit","offene_forderung"].includes(grund)) {
    return { code:"INVALID" as const };
  }
  if (!await hatOriginal(tx,auth,original)) return { code:"INVALID" as const };
  const [neu]=await tx.execute<{id:string}>(sql`
    INSERT INTO public.dokument_ablaufhemmung(tenant_id,id,original_typ,original_id,grund,gesetzt_von)
    VALUES(${auth.tenantId},${befehlId}::uuid,${original.typ},${original.id},${grund},${auth.userId}::uuid)
    ON CONFLICT DO NOTHING RETURNING id::text
  `);
  if (neu) return {code:"OK" as const,id:neu.id};
  const [alt]=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.dokument_ablaufhemmung
    WHERE tenant_id=${auth.tenantId} AND original_typ=${original.typ} AND original_id=${original.id} AND grund=${grund}`);
  return alt ? {code:"OK" as const,id:alt.id} : {code:"CONFLICT" as const};
}

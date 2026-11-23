import "server-only";

import { sql } from "drizzle-orm";
import { hasAuthorizationArea } from "@/lib/auth/authorizationContract";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

type Kostenart = "sachkosten" | "personal";
type Takt = "monatlich" | "vierteljaehrlich" | "jaehrlich";
type Kostenposten = Readonly<{
  id:string; bezeichnung:string; art:Kostenart; cent:number; takt:Takt;
  naechsteFaelligkeit:string; gueltigAb:string; gueltigBis:string|null;
  kategorieId:string; fahrzeugId:string|null; lieferantId:string|null;
}>;
type Kategorie = Readonly<{ id:string; name:string }>;
type Kostenquittung = { code:"OK"; kosten:Kostenposten } | { code:"FORBIDDEN"|"INVALID"|"CONFLICT" };
type Kategoriequittung = { code:"OK"; kategorie:Kategorie } | { code:"FORBIDDEN"|"INVALID" };
type KategorieVorschlag = (
  tx:PrivilegedTenantTransaction, auth:AuthorizationSnapshot, eingangsrechnungId:string,
) => Promise<{name:string}|null>;

const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const kostenfelder=sql`id::text,bezeichnung,laufende_art AS art,(betrag*100)::bigint::text AS cent,
  intervall AS takt,to_char(naechste_faelligkeit,'YYYY-MM-DD') AS "naechsteFaelligkeit",
  to_char(gilt_ab,'YYYY-MM-DD') AS "gueltigAb",to_char(gilt_bis,'YYYY-MM-DD') AS "gueltigBis",
  kategorie_id::text AS "kategorieId",fahrzeug_id::text AS "fahrzeugId",lieferant_id AS "lieferantId"`;
type Kostenzeile=Omit<Kostenposten,"cent">&{cent:string};

async function darfBuchhaltung(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot) {
  if (!hasAuthorizationArea(auth,"buchhaltung")) return false;
  const [scope]=await tx.execute<{ ok:boolean }>(sql`SELECT current_setting('app.tenant_id',true)=${auth.tenantId} AS ok`);
  return scope?.ok===true;
}

function istDatum(wert:unknown):wert is string {
  if (typeof wert!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
  const date=new Date(wert+"T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===wert && !wert.startsWith("0000");
}

function istId(wert:unknown):wert is string { return typeof wert==="string" && uuid.test(wert); }

export async function liesLaufendeKosten(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot) {
  if (!await darfBuchhaltung(tx,auth)) return null;
  const zeilen=await tx.execute<Kostenzeile>(sql`SELECT ${kostenfelder}
    FROM public.kostenposten WHERE tenant_id=${auth.tenantId} ORDER BY naechste_faelligkeit,id`);
  return zeilen.map(zeile=>({...zeile,cent:Number(zeile.cent)}));
}

export async function liesAusgabenkategorien(tx:PrivilegedTenantTransaction, auth:AuthorizationSnapshot) {
  if (!await darfBuchhaltung(tx,auth)) return null;
  return tx.execute<Kategorie>(sql`SELECT id::text,name FROM public.kategorie
    WHERE tenant_id=${auth.tenantId} AND typ='ausgabe' ORDER BY sortierung,name,id`);
}

/** Bei einer wiederholten bestätigten Anlage bleibt derselbe Laufkostenposten bestehen. */
export async function legeLaufendeKostenAn(
  tx:PrivilegedTenantTransaction, auth:AuthorizationSnapshot, input:unknown,
):Promise<Kostenquittung> {
  if (!await darfBuchhaltung(tx,auth) || !hasAuthorizationArea(auth,"einstellungen")) return {code:"FORBIDDEN"};
  if (!input || typeof input!=="object" || Array.isArray(input)) return {code:"INVALID"};
  const {id,bezeichnung,art,cent,takt,gueltigAb,gueltigBis,naechsteFaelligkeit,kategorieId,fahrzeugId,lieferantId}
    = input as Record<keyof Kostenposten,unknown>;
  if (!istId(id) || !istId(kategorieId) || typeof bezeichnung!=="string" || !bezeichnung.trim()
    || bezeichnung.trim().length>120 || (art!=="sachkosten" && art!=="personal")
    || typeof cent!=="number" || !Number.isSafeInteger(cent) || cent<1 || cent>999_999_999_999
    || (takt!=="monatlich" && takt!=="vierteljaehrlich" && takt!=="jaehrlich")
    || !istDatum(gueltigAb) || !istDatum(naechsteFaelligkeit) || naechsteFaelligkeit<gueltigAb
    || !(gueltigBis===null || (istDatum(gueltigBis) && gueltigBis>=gueltigAb))
    || !(fahrzeugId===null || istId(fahrzeugId))
    || !(lieferantId===null || (typeof lieferantId==="string" && lieferantId.trim()===lieferantId && lieferantId.length>0 && lieferantId.length<=128))
    || (fahrzeugId!==null && lieferantId!==null)
    || (art==="personal" && (takt!=="monatlich" || fahrzeugId!==null || lieferantId!==null))) return {code:"INVALID"};

  const wirdGespeichert:Kostenposten = {id:id.toLowerCase(),bezeichnung:bezeichnung.trim(),art,cent,takt,gueltigAb,gueltigBis,
    naechsteFaelligkeit,kategorieId:kategorieId.toLowerCase(),fahrzeugId:fahrzeugId?.toLowerCase() ?? null,lieferantId};
  const tenantId=auth.tenantId;
  const pruefeWiederholung=async():Promise<Kostenquittung|null>=>{
    const [zeile]=await tx.execute<Kostenzeile>(sql`SELECT ${kostenfelder} FROM public.kostenposten
      WHERE tenant_id=${tenantId} AND id=${id}::uuid`);
    if (!zeile) return null;
    const kosten={...zeile,cent:Number(zeile.cent)};
    return Object.entries(wirdGespeichert).every(([feld,wert])=>kosten[feld as keyof Kostenposten]===wert)
      ? {code:"OK",kosten} : {code:"CONFLICT"};
  };
  const wiederholt=await pruefeWiederholung();
  if (wiederholt) return wiederholt;
  const [bezug]=await tx.execute<{ ok:boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM public.kategorie WHERE tenant_id=${tenantId} AND id=${kategorieId}::uuid AND typ='ausgabe')
      AND (${fahrzeugId}::uuid IS NULL OR EXISTS (SELECT 1 FROM public.vehicles WHERE tenant_id=${tenantId} AND id=${fahrzeugId}::uuid AND aktiv FOR SHARE))
      AND (${lieferantId}::text IS NULL OR EXISTS (SELECT 1 FROM public.v_customers_settings_v1 WHERE tenant_id=${tenantId} AND id=${lieferantId} AND type='lieferant'))
    AS ok
  `);
  if (bezug?.ok!==true) return {code:"INVALID"};
  const [saved]=await tx.execute<Kostenzeile>(sql`
    INSERT INTO public.kostenposten(id,tenant_id,bezeichnung,art,betrag,intervall,gilt_ab,gilt_bis,
      laufende_art,naechste_faelligkeit,kategorie_id,fahrzeug_id,lieferant_id,is_demo)
    VALUES(${id}::uuid,${tenantId},${wirdGespeichert.bezeichnung},'fix',${cent}::numeric/100,${takt},${gueltigAb}::date,${gueltigBis}::date,
      ${art},${naechsteFaelligkeit}::date,${kategorieId}::uuid,${fahrzeugId}::uuid,${lieferantId},false)
    ON CONFLICT (id) DO NOTHING RETURNING ${kostenfelder}
  `);
  if (saved) return {code:"OK",kosten:{...saved,cent:Number(saved.cent)}};
  return await pruefeWiederholung() ?? {code:"CONFLICT"};
}

export async function uebernimmKategorieVorschlag(
  tx:PrivilegedTenantTransaction, auth:AuthorizationSnapshot, eingangsrechnungId:string, liesVorschlag:KategorieVorschlag,
):Promise<Kategoriequittung> {
  if (!await darfBuchhaltung(tx,auth)) return {code:"FORBIDDEN"};
  if (!istId(eingangsrechnungId)) return {code:"INVALID"};
  const tenantId=auth.tenantId;
  const vorschlag=await liesVorschlag(tx,auth,eingangsrechnungId);
  const name=vorschlag?.name.trim();
  if (!name || name.length>120) return {code:"INVALID"};
  const [quelle]=await tx.execute(sql`SELECT id FROM public.v_eingang_supplier_invoice_settings_v1 WHERE tenant_id=${tenantId} AND id=${eingangsrechnungId}::uuid`);
  if (!quelle) return {code:"INVALID"};
  const [neu]=await tx.execute<Kategorie>(sql`
    INSERT INTO public.kategorie(tenant_id,name,typ,aus_eingangsrechnung_id)
    VALUES(${tenantId},${name},'ausgabe',${eingangsrechnungId}::uuid)
    ON CONFLICT DO NOTHING
    RETURNING id::text,name
  `);
  if (neu) return {code:"OK",kategorie:neu};
  const [vorhanden]=await tx.execute<Kategorie>(sql`SELECT id::text,name FROM public.kategorie
    WHERE tenant_id=${tenantId} AND typ='ausgabe'
      AND (aus_eingangsrechnung_id=${eingangsrechnungId}::uuid OR lower(btrim(name))=lower(${name}))
    ORDER BY (aus_eingangsrechnung_id=${eingangsrechnungId}::uuid) DESC NULLS LAST
    LIMIT 1`);
  return vorhanden ? {code:"OK",kategorie:vorhanden} : {code:"INVALID"};
}

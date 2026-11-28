import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { LAGER_STAMM_COPY } from "@/ui/lagerStammCopy";
import { hasLagerCapability } from "@/lib/auth/authorizationContract";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { stammAbsicht, type Stammbefehl, type Stammbeleg, type Stammauftrag, type Stammantwort, type Stammfehler } from "../stammbefehl";
import { leseLagerArtikel } from "./stammdatenLesen";

type Tx = PrivilegedTenantTransaction;
/** App composition supplies the existing TaskWriter; no cross-module writer import. */
export type LagerTaskPorts = {
  synchronize: (tx: Tx, auth: AuthorizationSnapshot, sourceId: string,
    effect: (tx: Tx, auth: AuthorizationSnapshot, input: { key: string }) => Promise<void>) => Promise<string>;
};
type Nur<Art extends Stammbefehl["art"]> = Extract<Stammbefehl, { art: Art }>;
type EntwurfEffekt = "anlegen" | "uebernehmen";
type Wirkung = { beleg: Stammbeleg; vorher: unknown; entwurfEffekt?: EntwurfEffekt };

class Stammabbruch extends Error {
  constructor(readonly code: Stammfehler) {
    super(code);
  }
}

function verlangen<T>(wert: T | null | undefined, code: Stammfehler): T {
  if (wert == null) throw new Stammabbruch(code);
  return wert;
}

async function rubrikSpeichern(tx: Tx, mandant: string, daten: Nur<"rubrik.speichern">): Promise<Wirkung> {
  if (daten.id === null) {
    const [beleg] = await tx.execute<Stammbeleg>(sql`
      INSERT INTO public.categories (tenant_id, name) VALUES (${mandant}, ${daten.name})
      RETURNING id::text, version
    `);
    return { beleg: verlangen(beleg, "UNAVAILABLE"), vorher: null };
  }
  const [vorher] = await tx.execute<Stammbeleg & { name: string }>(sql`
    SELECT id::text, version, name FROM public.categories
    WHERE tenant_id = ${mandant} AND id = ${daten.id}::uuid FOR UPDATE
  `);
  if (!vorher) throw new Stammabbruch("NOT_FOUND");
  if (vorher.version !== daten.version) throw new Stammabbruch("CONFLICT");
  const [beleg] = await tx.execute<Stammbeleg>(sql`
    UPDATE public.categories SET name = ${daten.name}, version = version + 1
    WHERE tenant_id = ${mandant} AND id = ${daten.id}::uuid AND version = ${daten.version}
    RETURNING id::text, version
  `);
  return { beleg: verlangen(beleg, "CONFLICT"), vorher };
}

async function sperreArtikel(tx: Tx, mandant: string, id: string, version?: number) {
  const [erfasst] = await tx.execute<{ id: string; version: number }>(sql`
    SELECT id, stamm_version AS version FROM public.inventory_items
    WHERE tenant_id = ${mandant} AND id = ${id} FOR UPDATE
  `);
  if (!erfasst) throw new Stammabbruch("NOT_FOUND");
  if (version !== undefined && erfasst.version !== version) throw new Stammabbruch("CONFLICT");
  return verlangen(await leseLagerArtikel(tx, mandant, id), "UNAVAILABLE");
}

async function artikelNeu(tx: Tx, mandant: string, name: string, daten?: Nur<"artikel.speichern">) {
  const [beleg] = await tx.execute<Stammbeleg>(sql`
    INSERT INTO public.inventory_items (
      id, tenant_id, name, variante, groesse, basiseinheit, rubrik_id, stamm_status, kurznummer, current_stock
    ) VALUES (
      ${randomUUID()}, ${mandant}, ${name}, ${daten?.variante ?? null}, ${daten?.groesse ?? null},
      ${daten?.basiseinheit ?? null}, ${daten?.rubrikId ?? null}::uuid, ${daten ? "aktiv" : "entwurf"},
      private.lager_naechste_kurznummer(), NULL
    ) RETURNING id, stamm_version AS version
  `);
  return verlangen(beleg, "UNAVAILABLE");
}

async function artikelSpeichern(tx: Tx, mandant: string, daten: Nur<"artikel.speichern">): Promise<Wirkung> {
  if (daten.rubrikId !== null) {
    const [rubrik] = await tx.execute(sql`SELECT id FROM public.categories
      WHERE tenant_id = ${mandant} AND id = ${daten.rubrikId}::uuid`);
    verlangen(rubrik, "NOT_FOUND");
  }
  if (daten.id === null) {
    return { beleg: await artikelNeu(tx, mandant, daten.name, daten), vorher: null };
  }
  const vorher = await sperreArtikel(tx, mandant, daten.id, daten.version);
  // Die Basiseinheit ist die Referenz für alle späteren Mengen. Nach der
  // ersten eindeutigen Zuordnung braucht ein Einheitenwechsel einen Fachbefehl.
  if (vorher.basiseinheit !== null && vorher.basiseinheit !== daten.basiseinheit) {
    throw new Stammabbruch("CONFLICT");
  }
  const [beleg] = await tx.execute<Stammbeleg>(sql`
    UPDATE public.inventory_items SET name = ${daten.name}, variante = ${daten.variante},
      groesse = ${daten.groesse}, rubrik_id = ${daten.rubrikId}::uuid,
      basiseinheit = ${daten.basiseinheit}, stamm_status = 'aktiv', stamm_version = stamm_version + 1
    WHERE tenant_id = ${mandant} AND id = ${daten.id} AND stamm_version = ${daten.version}
    RETURNING id, stamm_version AS version
  `);
  return {
    beleg: verlangen(beleg, "CONFLICT"), vorher,
    ...(vorher.status === "entwurf" ? { entwurfEffekt: "uebernehmen" as const } : {}),
  };
}

async function artikelEntwurf(tx: Tx, auth: AuthorizationSnapshot, daten: Nur<"artikel.entwurf">): Promise<Wirkung> {
  if (daten.fotoId !== null) {
    const [original] = await tx.execute(sql`
      SELECT datei.id FROM public.v_lager_eingangsoriginale_v1 datei
      WHERE datei.tenant_id = ${auth.tenantId} AND datei.id = ${daten.fotoId}::uuid
        AND datei.art = 'foto' AND datei.aufgenommen_von = ${auth.userId}::uuid AND datei.gespeichert
    `);
    verlangen(original, "NOT_FOUND");
    // Dieselbe bestätigte Datei kann einem Entwurf nur einmal zugrunde liegen.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(
      hashtextextended('lager-entwurf-foto:' || ${auth.tenantId} || ':' || ${daten.fotoId}, 0))`);
    const [vorhanden] = await tx.execute(sql`SELECT 1 FROM public.v_lager_stammereignisse_v1
      WHERE tenant_id = ${auth.tenantId} AND payload->>'art' = 'artikel.entwurf' AND payload->'daten'->>'fotoId' = ${daten.fotoId}
      LIMIT 1`);
    if (vorhanden) throw new Stammabbruch("CONFLICT");
  }
  const beleg = await artikelNeu(tx, auth.tenantId, daten.name ?? LAGER_STAMM_COPY.entwurf);
  if (daten.fotoId !== null) {
    await tx.execute(sql`INSERT INTO public.lager_artikel_dateien (tenant_id, artikel_id, datei_id, zweck)
      VALUES (${auth.tenantId}, ${beleg.id}, ${daten.fotoId}::uuid, 'foto')`);
  }
  return { beleg, vorher: null, entwurfEffekt: "anlegen" };
}

async function artikelRevision(tx: Tx, mandant: string, id: string, version: number) {
  const [beleg] = await tx.execute<Stammbeleg>(sql`
    UPDATE public.inventory_items SET stamm_version = stamm_version + 1
    WHERE tenant_id = ${mandant} AND id = ${id} AND stamm_version = ${version}
    RETURNING id, stamm_version AS version
  `);
  return verlangen(beleg, "CONFLICT");
}

async function artikelFotoZuordnen(tx: Tx, mandant: string, daten: Nur<"artikel.foto_zuordnen">): Promise<Wirkung> {
  await sperreArtikel(tx, mandant, daten.id, daten.version);
  const [foto] = await tx.execute(sql`SELECT id FROM public.v_lager_eingangsoriginale_v1
    WHERE tenant_id = ${mandant} AND id = ${daten.fotoId}::uuid AND art = 'foto' AND gespeichert
      AND (${daten.eingangId ?? null}::uuid IS NULL OR item_id = ${daten.eingangId ?? null}::uuid)`);
  verlangen(foto, "NOT_FOUND");
  const [zuordnung] = await tx.execute(sql`
    INSERT INTO public.lager_artikel_dateien (tenant_id, artikel_id, datei_id, zweck)
    VALUES (${mandant}, ${daten.id}, ${daten.fotoId}::uuid, 'foto')
    ON CONFLICT (tenant_id, artikel_id, datei_id, zweck) DO NOTHING RETURNING datei_id
  `);
  if (!zuordnung) return { beleg: { id: daten.id, version: daten.version }, vorher: { zugeordnet: true } };
  return { beleg: await artikelRevision(tx, mandant, daten.id, daten.version), vorher: null };
}

async function artikelKennungBestaetigen(tx: Tx, auth: AuthorizationSnapshot, daten: Nur<"artikel.kennung">): Promise<Wirkung> {
  const { tenantId, userId } = auth;
  await sperreArtikel(tx, tenantId, daten.id, daten.version);
  if (daten.lieferantId !== null) {
    const [lieferant] = await tx.execute(sql`SELECT id FROM public.v_lager_lieferanten_v1
      WHERE tenant_id = ${tenantId} AND id = ${daten.lieferantId}`);
    verlangen(lieferant, "NOT_FOUND");
  }
  await tx.execute(sql`
    INSERT INTO public.lager_artikel_kennungen (tenant_id, artikel_id, art, wert, lieferant_id, bestaetigt_von, bestaetigt_am)
    VALUES (${tenantId}, ${daten.id}, ${daten.kennungsart}, ${daten.wert}, ${daten.lieferantId}, ${userId}::uuid, statement_timestamp())
  `);
  return { beleg: await artikelRevision(tx, tenantId, daten.id, daten.version), vorher: null };
}

async function metallSpeichern(tx: Tx, mandant: string, daten: Nur<"artikel.metall">): Promise<Wirkung> {
  await sperreArtikel(tx, mandant, daten.id, daten.version);
  const [vorher] = await tx.execute(sql`SELECT metall, feingehalt_pct::text, kurs_metall, paragraph_13b_metall
    FROM public.inventory_items WHERE tenant_id = ${mandant} AND id = ${daten.id}`);
  const [beleg] = await tx.execute<Stammbeleg>(sql`
    UPDATE public.inventory_items SET metall = ${daten.metall}, feingehalt_pct = ${daten.feinPct}::numeric,
      kurs_metall = ${daten.kursMetall}, paragraph_13b_metall = ${daten.paragraph13bMetall},
      stamm_version = stamm_version + 1
    WHERE tenant_id = ${mandant} AND id = ${daten.id} AND stamm_version = ${daten.version}
    RETURNING id, stamm_version AS version
  `);
  return { beleg: verlangen(beleg, "CONFLICT"), vorher };
}

async function gebindeVersionieren(tx: Tx, mandant: string, daten: Nur<"gebinde.versionieren">): Promise<Wirkung> {
  const artikel = await sperreArtikel(tx, mandant, daten.artikelId);
  if (artikel.status !== "aktiv" || artikel.basiseinheit === null) throw new Stammabbruch("CONFLICT");
  const [vorher] = await tx.execute<Stammbeleg & { nachVorgaenger: boolean }>(sql`
    SELECT id::text, version, gueltig_ab < ${daten.gueltigAb}::timestamptz AS "nachVorgaenger"
    FROM public.packaging_definitions
    WHERE tenant_id = ${mandant} AND artikel_id = ${daten.artikelId}
      AND gebinde_schluessel = ${daten.schluessel} ORDER BY version DESC LIMIT 1
  `);
  if ((vorher?.version ?? 0) !== daten.version || vorher?.nachVorgaenger === false) {
    throw new Stammabbruch("CONFLICT");
  }
  if (daten.umrechnung) {
    if (daten.umrechnung.einheit !== artikel.basiseinheit) throw new Stammabbruch("VALIDATION_ERROR");
    const [beleg] = await tx.execute(sql`SELECT id FROM public.v_lager_eingangsoriginale_v1
      WHERE tenant_id = ${mandant} AND id = ${daten.umrechnung.belegId}::uuid AND gespeichert`);
    verlangen(beleg, "NOT_FOUND");
  }
  const [beleg] = await tx.execute<Stammbeleg>(sql`
    INSERT INTO public.packaging_definitions (
      tenant_id, artikel_id, gebinde_schluessel, version, art, name, inhalt_menge, inhalt_einheit,
      gueltig_ab, umrechnung_basismenge, umrechnung_basiseinheit, umrechnung_beleg_id
    ) VALUES (
      ${mandant}, ${daten.artikelId}, ${daten.schluessel}, ${daten.version + 1}, ${daten.gebindeart},
      ${daten.name}, ${daten.menge}::numeric, ${daten.einheit}, ${daten.gueltigAb}::timestamptz,
      ${daten.umrechnung?.menge ?? null}::numeric, ${daten.umrechnung?.einheit ?? null},
      ${daten.umrechnung?.belegId ?? null}::uuid
    ) RETURNING id::text, version
  `);
  return { beleg: verlangen(beleg, "UNAVAILABLE"), vorher: vorher ? { id: vorher.id, version: vorher.version } : null };
}

function ausfuehren(tx: Tx, auth: AuthorizationSnapshot, daten: Stammbefehl): Promise<Wirkung> {
  switch (daten.art) {
    case "rubrik.speichern": return rubrikSpeichern(tx, auth.tenantId, daten);
    case "artikel.speichern": return artikelSpeichern(tx, auth.tenantId, daten);
    case "artikel.foto_zuordnen": return artikelFotoZuordnen(tx, auth.tenantId, daten);
    case "artikel.kennung": return artikelKennungBestaetigen(tx, auth, daten);
    case "artikel.entwurf": return artikelEntwurf(tx, auth, daten);
    case "artikel.metall": return metallSpeichern(tx, auth.tenantId, daten);
    case "gebinde.versionieren": return gebindeVersionieren(tx, auth.tenantId, daten);
  }
}

export async function erfasseStammereignis(
  tx: Tx, auth: AuthorizationSnapshot, id: string, art: "LAGER_STAMMBEFEHL_V1" | "LAGER_ARTIKEL_AUFGABE_V1",
  version: number, payload: object,
) {
  const [ereignis] = await tx.execute<{ id: string }>(sql`
    SELECT private.lager_stammereignis_anlegen(
      ${auth.tenantId}, ${auth.userId}::uuid, ${id}::uuid, ${art}, ${version}, ${JSON.stringify(payload)}::jsonb
    ) AS id
  `);
  return verlangen(ereignis?.id, "UNAVAILABLE");
}

const aufgabenEreignis = async (tx: Tx, auth: AuthorizationSnapshot, wirkung: { key: string }) => {
  await erfasseStammereignis(tx, auth, wirkung.key, "LAGER_ARTIKEL_AUFGABE_V1", 1, wirkung);
};

export async function schreibeLagerStammInTransaction(
  tx: Tx, auth: AuthorizationSnapshot, auftrag: Stammauftrag, ports: LagerTaskPorts,
): Promise<Stammantwort> {
  const { tenantId, userId } = auth;
  const absicht = createHash("sha256").update(stammAbsicht(auftrag.daten)).digest("hex");
  const original = await leseStammquittung<Stammbeleg>(tx, tenantId, auftrag.befehlId);
  if (original) {
    if (original.actor !== userId || original.hash !== absicht) throw new Stammabbruch("CONFLICT");
    return { ok: true, data: verlangen(original.beleg, "UNAVAILABLE"), wiederholt: true };
  }
  const wirkung = await ausfuehren(tx, auth, auftrag.daten);
  const ereignisId = await erfasseStammereignis(
    tx, auth, auftrag.befehlId, "LAGER_STAMMBEFEHL_V1", wirkung.beleg.version,
    { art: auftrag.daten.art, daten: auftrag.daten, absicht,
      beleg: wirkung.beleg, vorher: wirkung.vorher, entwurfEffekt: wirkung.entwurfEffekt },
  );
  if (wirkung.entwurfEffekt) {
    await ports.synchronize(tx, auth, ereignisId, aufgabenEreignis);
  }
  return { ok: true, data: wirkung.beleg, wiederholt: false };
}

export async function leseStammquittung<Beleg>(tx: Tx, mandant: string, befehlId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(
    hashtextextended('lager-stammbefehl:' || ${mandant} || ':' || ${befehlId}, 0))`);
  const [original] = await tx.execute<{ actor: string; hash: string; beleg: Beleg | null }>(sql`
    SELECT user_id::text AS actor, payload->>'absicht' AS hash, payload->'beleg' AS beleg
    FROM public.v_lager_stammereignisse_v1
    WHERE tenant_id = ${mandant} AND client_event_id = ${befehlId}::uuid
  `);
  return original;
}

export async function schreibeLagerZaehfundInTransaction(tx: Tx, auth: AuthorizationSnapshot, input: {
  befehlId: string; name: string; einheit: Exclude<Nur<"artikel.speichern">["basiseinheit"], null>; ortId: string;
}, ports: LagerTaskPorts): Promise<Stammantwort> {
  if (!hasLagerCapability(auth, "lager.zaehlen")) return { ok: false, code: "FORBIDDEN" };
  const [ort] = await tx.execute<{ rubrikId: string | null }>(sql`
    SELECT standard_rubrik_id::text AS "rubrikId" FROM public.stock_locations
    WHERE tenant_id = ${auth.tenantId} AND id = ${input.ortId}::uuid AND aktiv IS TRUE
  `);
  if (!ort) return { ok: false, code: "NOT_FOUND" };
  return schreibeLagerStammInTransaction(tx, auth, {
    befehlId: input.befehlId,
    daten: {
      art: "artikel.speichern", id: null, version: 0, name: input.name,
      variante: null, groesse: null, basiseinheit: input.einheit, rubrikId: ort.rubrikId,
    },
  }, ports);
}

export async function schreibeLagerStamm(auth: AuthorizationSnapshot, auftrag: Stammauftrag, ports: LagerTaskPorts): Promise<Stammantwort> {
  const recht = auftrag.daten.art === "artikel.entwurf" ? "lager.buchen" : "lager.stamm";
  if (!hasLagerCapability(auth, recht)) return { ok: false, code: "FORBIDDEN" };
  const schalter = auth.packageSwitches;
  if (schalter?.p3_lager_inventur !== true && schalter?.p4_lager !== true) {
    return { ok: false, code: "LAGER_AUSGESCHALTET", message: LAGER_STAMM_COPY.ausgeschaltet };
  }
  try {
    return await withPrivilegedTenantTransaction<Stammantwort>(auth,
      (tx) => schreibeLagerStammInTransaction(tx, auth, auftrag, ports));
  } catch (error) {
    if (error instanceof Stammabbruch) return { ok: false, code: error.code };
    const ursache = error instanceof Error ? (error.cause ?? error) : error;
    if (ursache && typeof ursache === "object" && "code" in ursache && ursache.code === "23505") {
      return { ok: false, code: "CONFLICT" };
    }
    return { ok: false, code: "UNAVAILABLE" };
  }
}

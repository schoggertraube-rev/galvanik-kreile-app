import "server-only";

import { sql } from "drizzle-orm";
import { hasLagerCapability } from "@/lib/auth/authorizationContract";
import { recordObservedFailure } from "@/lib/server/actionObservation";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { ActionResult } from "@/lib/server/authHelper";
import type { InventoryCategory, InventoryItem, StockMovement, StockMovementType } from "@/lib/types/inventory";
import { LAGER_BUCHUNG_COPY } from "@/ui/lagerBuchungCopy";
import { istLagerFachzeit, lagerBefehlsUuid } from "./lagerBuchungsauftrag";
import { leseBilanzbewertungMethode, type LagerEinstellungenLeser } from "./server-lagerregeln";

const artikelKennung = /^[A-Za-z0-9_-]{1,128}$/;
const bewegungsarten = new Set<string>([
  "stock_in", "stock_out", "consumption", "correction", "waste", "opening", "move",
  "count_correction", "reversal", "observation",
]);

type Artikel = {
  id: string; name: string; category: string | null; unit: string | null;
  minStock: number | null; currentStock: string | null; availableStock: string | null; pricePerUnit: string | null;
};
type Bewegung = {
  id: string; inventoryItemId: string; movementType: string; quantity: string | null;
  unit: string | null; orderId: string | null; reason: string | null;
  createdBy: string | null; createdAt: string | null; fachzeit: string | null;
  kalk_ek?: string | null; aufschlag_pct?: string | null; snapshot_einkaufspreis_eur?: string | null;
};

function kategorie(value: string | null): InventoryCategory {
  switch (value?.trim().toLowerCase()) {
    case "chemical": case "chemie": return "chemical";
    case "consumable": case "verbrauch": return "consumable";
    case "tooling": case "werkzeug": return "tooling";
    case "packaging": case "verpackung": return "packaging";
    default: return "uncategorized";
  }
}

async function imLagerLesen<T>(artikelId: string | undefined,
  lies: (tx: PrivilegedTenantTransaction, mandant: string, werte: boolean) => Promise<T>,
  gueltigeEingabe = true,
): Promise<ActionResult<T>> {
  const auth = await resolveAuthorization();
  if (!auth.ok) return { ok: false, error: "UNAUTHORIZED", message: LAGER_BUCHUNG_COPY.sitzung };
  if (!hasLagerCapability(auth.data, "lager.lesen")) {
    return { ok: false, error: "FORBIDDEN", message: LAGER_BUCHUNG_COPY.leserecht };
  }
  if (auth.data.packageSwitches?.p4_lager !== true) {
    return { ok: false, error: "FORBIDDEN", message: LAGER_BUCHUNG_COPY.ausgeschaltet };
  }
  if (artikelId !== undefined && (typeof artikelId !== "string" || !artikelKennung.test(artikelId))) {
    return { ok: false, error: "VALIDATION_ERROR", message: LAGER_BUCHUNG_COPY.artikelFehlt };
  }
  if (!gueltigeEingabe) return { ok: false, error: "VALIDATION_ERROR", message: LAGER_BUCHUNG_COPY.eingabeUngueltig };
  try {
    const data = await withPrivilegedTenantTransaction(auth.data, (tx) =>
      lies(tx, auth.data.tenantId, hasLagerCapability(auth.data, "lager.werte")));
    return { ok: true, data };
  } catch (error) {
    const ursache = error instanceof Error ? error.cause ?? error : error;
    const sqlState = ursache && typeof ursache === "object" && "code" in ursache ? ursache.code : null;
    recordObservedFailure(typeof sqlState === "string" && /^[A-Z0-9]{5}$/u.test(sqlState)
      ? `LAGER_LESEN_DB_ERROR_${sqlState}` : "LAGER_LESEN_DB_ERROR");
    return { ok: false, error: "DB_ERROR", message: LAGER_BUCHUNG_COPY.laden };
  }
}

export async function leseLagerArtikelAltvertrag(
  liesEinstellungen: LagerEinstellungenLeser, artikelId?: string,
): Promise<ActionResult<InventoryItem[]>> {
  return imLagerLesen(artikelId, async (tx, mandant, werte) => {
    const filter = artikelId === undefined ? sql`` : sql`AND artikel.id = ${artikelId}`;
    const methode = werte ? leseBilanzbewertungMethode(await liesEinstellungen(mandant, tx)) : null;
    if (werte && !methode) recordObservedFailure("LAGER_BEWERTUNGSMETHODE_FEHLT");
    const preis = methode ? sql`(
      SELECT einzelpreis::text
      FROM private.lager_kalkulationsbasis(artikel.id, statement_timestamp(), ${methode})
    )` : sql`NULL::text`;
    const rows = await tx.execute<Artikel>(sql`
      SELECT artikel.id, artikel.name, artikel.category,
        coalesce(artikel.basiseinheit, artikel.unit, artikel.einheit_normiert) AS unit,
        nullif(artikel.min_stock, 0) AS "minStock", bestand.menge::text AS "currentStock",
        bestand.verfuegbar::text AS "availableStock", ${preis} AS "pricePerUnit"
      FROM public.inventory_items artikel
      LEFT JOIN (
        SELECT b.artikel_id, CASE WHEN NOT bool_or(b.menge IS NULL) THEN sum(b.menge) END AS menge,
          CASE WHEN NOT bool_or(
            (b.ort_id IS NULL AND b.menge IS DISTINCT FROM 0::numeric)
            OR (ort.orttyp = 'lager' AND ort.aktiv AND b.bestandsart = 'verfuegbar' AND b.menge IS NULL)
          ) THEN coalesce(sum(b.menge) FILTER (
            WHERE ort.orttyp = 'lager' AND ort.aktiv AND b.bestandsart = 'verfuegbar'
          ),0) END AS verfuegbar
        FROM private.material_stock_at(statement_timestamp()) b
        LEFT JOIN public.stock_locations ort ON ort.tenant_id = ${mandant} AND ort.id = b.ort_id
        WHERE b.eigentum = 'eigen' GROUP BY b.artikel_id
      ) bestand ON bestand.artikel_id = artikel.id
      WHERE artikel.tenant_id = ${mandant} ${filter}
      ORDER BY artikel.name, artikel.id
    `);
    return rows.map((zeile) => {
      const category = kategorie(zeile.category);
      return {
        id: zeile.id, name: zeile.name, category, unit: zeile.unit,
        currentStock: zeile.currentStock === null ? null : Number(zeile.currentStock),
        availableStock: zeile.availableStock === null ? null : Number(zeile.availableStock),
        minStock: zeile.minStock, isConsumable: category !== "tooling",
        ...(werte ? { pricePerUnit: zeile.pricePerUnit === null ? null : Number(zeile.pricePerUnit) } : {}),
      };
    });
  });
}

export type LagerBewegungssuche = { artikelId?: string; nach?: { fachzeit: string | null; id: string } };

function istCursorzeit(zeit: unknown): zeit is string | null {
  return zeit === null || zeit === "" || istLagerFachzeit(zeit) || (
    typeof zeit === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(zeit)
    && istLagerFachzeit(zeit.slice(0, 23) + "Z")
  );
}

export async function leseLagerBewegungenAltvertrag(suche?: LagerBewegungssuche): Promise<ActionResult<StockMovement[]>> {
  const { artikelId, nach } = suche ?? {};
  const gueltig = (suche === undefined || (suche !== null && typeof suche === "object" && !Array.isArray(suche)))
    && (nach === undefined || (nach !== null && typeof nach === "object" && istCursorzeit(nach.fachzeit)
      && typeof nach.id === "string" && lagerBefehlsUuid.test(nach.id)));
  return imLagerLesen(artikelId, async (tx, mandant, werte) => {
    const fachzeit = sql`coalesce(bewegung.fachzeit, bewegung.created_at)`;
    const sortierzeit = sql`coalesce(${fachzeit}, '-infinity'::timestamptz)`;
    const seite = nach ? sql`AND (${sortierzeit}, bewegung.id) <
      (${nach.fachzeit || "-infinity"}::timestamptz, ${nach.id}::uuid)` : sql``;
    const preisfelder = werte ? sql`, bewegung.kalk_ek::text, bewegung.aufschlag_pct::text,
      bewegung.snapshot_einkaufspreis_eur::text` : sql``;
    const filter = artikelId === undefined ? sql`` : sql`AND bewegung.inventory_item_id = ${artikelId}`;
    const rows = await tx.execute<Bewegung>(sql`
      SELECT bewegung.id::text, bewegung.inventory_item_id AS "inventoryItemId", bewegung.movement_type AS "movementType",
        bewegung.quantity::text, coalesce(bewegung.mengeneinheit, artikel.unit, artikel.einheit_normiert) AS unit,
        bewegung.order_id AS "orderId", coalesce(bewegung.notiz, bewegung.reason) AS reason,
        login.anzeigename AS "createdBy", bewegung.created_at::text AS "createdAt",
        to_char(${fachzeit} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS fachzeit ${preisfelder}
      FROM public.stock_movements bewegung
      LEFT JOIN public.inventory_items artikel ON artikel.tenant_id = bewegung.tenant_id AND artikel.id = bewegung.inventory_item_id
      LEFT JOIN public.v_lager_akteure_v1 login ON login.tenant_id = bewegung.tenant_id AND login.id = bewegung.erfasst_von
      WHERE bewegung.tenant_id = ${mandant} AND bewegung.inventory_item_id IS NOT NULL AND bewegung.w1_original_id IS NULL ${filter} ${seite}
      ORDER BY ${sortierzeit} DESC, bewegung.id DESC
      LIMIT 100
    `);
    return rows.map((zeile) => {
      const art = zeile.movementType === "verbrauch" ? "consumption" : zeile.movementType;
      if (!bewegungsarten.has(art)) throw Error("LAGER_BEWEGUNGSART_UNBEKANNT");
      return {
        id: zeile.id, inventoryItemId: zeile.inventoryItemId,
        movementType: art as StockMovementType,
        quantity: zeile.quantity === null ? null : Number(zeile.quantity), unit: zeile.unit,
        orderId: zeile.orderId ?? undefined, reason: zeile.reason ?? undefined,
        createdBy: zeile.createdBy ?? LAGER_BUCHUNG_COPY.system,
        createdAt: zeile.createdAt === null ? null : new Date(zeile.createdAt).toISOString(),
        fachzeit: zeile.fachzeit,
        ...(werte ? {
          kalk_ek: zeile.kalk_ek == null ? null : Number(zeile.kalk_ek),
          aufschlag_pct: zeile.aufschlag_pct == null ? null : Number(zeile.aufschlag_pct),
          snapshot_einkaufspreis_eur: zeile.snapshot_einkaufspreis_eur == null ? null : Number(zeile.snapshot_einkaufspreis_eur),
        } : {}),
      };
    });
  }, gueltig);
}

type LagerBefehlsstand = { befehlId: string; gebucht: boolean; eventId: string | null };

export async function leseLagerBefehlsstand(befehlIds: readonly string[]): Promise<ActionResult<LagerBefehlsstand[]>> {
  const gueltig = Array.isArray(befehlIds) && befehlIds.length <= 50 &&
    befehlIds.every(id => typeof id === "string" && lagerBefehlsUuid.test(id));
  return imLagerLesen(undefined, async (tx, mandant) => {
    if (befehlIds.length === 0) return [];

    const reihenfolge = sql.join(befehlIds.map(id => sql`${id}::uuid`), sql`,`);
    const zeilen = await tx.execute<LagerBefehlsstand>(sql`
      SELECT eingabe.id::text AS "befehlId", gefunden.id IS NOT NULL AS gebucht, gefunden.id AS "eventId"
      FROM unnest(ARRAY[${reihenfolge}]) WITH ORDINALITY AS eingabe(id, nr)
      LEFT JOIN LATERAL (
        SELECT treffer.id
        FROM (
          SELECT j.id::text, 1 AS rang FROM public.stock_movements j
          WHERE j.tenant_id = ${mandant} AND j.befehl_id = eingabe.id AND j.befehl_zeile = 1
          UNION ALL
          SELECT e.id, 2 AS rang FROM public.v_lager_befehlsereignisse_v1 e
          WHERE e.tenant_id = ${mandant} AND e.client_event_id = eingabe.id
          UNION ALL
          SELECT s.id::text, 3 AS rang FROM public.inventory_sessions s
          WHERE s.tenant_id = ${mandant} AND (s.id = eingabe.id OR s.abschluss_befehl_id = eingabe.id)
          UNION ALL
          SELECT g.id::text, 4 AS rang FROM public.inventory_count_reasons g
          WHERE g.tenant_id = ${mandant} AND g.befehl_id = eingabe.id
        ) treffer
        ORDER BY treffer.rang, treffer.id
        LIMIT 1
      ) gefunden ON true
      ORDER BY eingabe.nr
    `);
    return [...zeilen];
  }, gueltig);
}

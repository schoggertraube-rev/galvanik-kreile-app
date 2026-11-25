// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const mandant = vi.hoisted(() => "TEST-ablauf-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: mandant }));

import {
  bucheAuftragsverbrauchAction,
  bucheLagerAction,
  bucheLagerGegenbuchungAction,
  leseLagerBefehlsstandAction,
  leseLagerBestandAction,
  leseLagerBewegungenAction,
} from "@/app/actions/lager.actions";
import { createInventoryMovementAction } from "@/app/actions/inventory.actions";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { leseLagerAuftragsmaterialInTransaction } from "@/modules/lager/server-public";
import { LAGER_BUCHUNG_COPY } from "@/ui/lagerBuchungCopy";
import { createFixture, sql, withSession } from "../../../e2e/ablauf/replayHarness";

type Anmeldung = Awaited<ReturnType<typeof createFixture>>;
const replay = process.env.DATABASE_URL;
const replayPort = process.env.GITHUB_ACTIONS === "true" ? "54322" : "54342";
if (!replay || replay !== process.env.H18_EXPECTED_DATABASE_URL
  || new URL(replay).hostname !== "127.0.0.1" || new URL(replay).port !== replayPort) {
  throw Error("LAGER_B1A3_DEDICATED_REPLAY_REQUIRED");
}
const fremd = mandant + "-fremd";
const firma = randomUUID();
let schalter: boolean | undefined;
let werkstatt: Anmeldung;
let admin: Anmeldung;
let readonly: Anmeldung;

beforeAll(async () => {
  const [original] = await sql<{ enabled: boolean }[]>`
    SELECT enabled FROM public.feature_flags WHERE id = 'p4_lager'
  `;
  if (!original) throw Error("TEST_LAGER_SCHALTER_FEHLT");
  schalter = original.enabled;
  await sql`UPDATE public.feature_flags SET enabled = true WHERE id = 'p4_lager'`;
  werkstatt = await createFixture(["auftraege"], "werkstatt");
  admin = await createFixture(["auftraege", "lager.stamm"], "admin");
  readonly = await createFixture([], "readonly");
  await sql`INSERT INTO public.company_settings (id, tenant_id, company_name)
    VALUES (${firma}, ${mandant}, 'TEST Lager')`;
});

afterAll(async () => {
  if (schalter !== undefined) await sql`UPDATE public.feature_flags SET enabled = ${schalter} WHERE id = 'p4_lager'`;
});

async function artikel(tenantId = mandant, rubrikId?: string) {
  const id = "TEST-" + randomUUID();
  await sql`
    INSERT INTO public.inventory_items (id, tenant_id, name, category, basiseinheit, rubrik_id)
    VALUES (${id}, ${tenantId}, 'TEST Buchungsmaterial', 'chemical', 'kg', ${rubrikId ?? null}::uuid)
  `;
  return id;
}

async function ort(tenantId = mandant, typ = "lager") {
  const [zeile] = await sql<{ id: string }[]>`
    INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich, orttyp)
    VALUES (${tenantId}, 'TEST EG', ${randomUUID()}, ${typ}) RETURNING id::text
  `;
  return zeile.id;
}

function buchung(inventoryItemId: string, ortId: string) {
  return {
    befehlId: randomUUID(), inventoryItemId, ortId, revision: 1, einheit: "kg",
    fachzeit: new Date(Date.now() - 5_000).toISOString(), mengenqualitaet: "exakt",
    movementType: "stock_in", quantity: "5", geschaeftsgrund: "wareneingang",
  } as const;
}

async function auftragAnlegen(tenantId: string) {
  const kunde = "TEST-" + randomUUID();
  const auftrag = "TEST-" + randomUUID();
  await sql`INSERT INTO public.customers (id, tenant_id, name, type)
    VALUES (${kunde}, ${tenantId}, 'TEST Kunde', 'business')`;
  await sql`INSERT INTO public.orders (id, tenant_id, customer_id, order_number, title, station, current_station_id, status)
    VALUES (${auftrag}, ${tenantId}, ${kunde}, ${auftrag}, 'TEST Lagerbedarf', 'angenommen', 'angenommen', 'angenommen')`;
  return auftrag;
}

async function summe(inventoryItemId: string) {
  return sql.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id', ${mandant}, true)`;
    return [...await tx<{ ort: string | null; menge: number }[]>`
      SELECT ort_id::text AS ort, sum(menge)::float8 AS menge
      FROM private.material_stock WHERE artikel_id = ${inventoryItemId}
      GROUP BY ort_id ORDER BY ort_id NULLS FIRST
    `];
  });
}

describe("Lagerjournal und seine Befehle", () => {
  test("I1, I2 und I6: Zugang, Entnahme, Umlagerung und Gegenbuchung verändern nur das Journal", async () => {
    const id = await artikel();
    const quelle = await ort();
    const ziel = await ort(mandant, "werkstatt");
    const zugang = buchung(id, quelle);
    const unbekannteKennung = randomUUID();
    await sql`
      INSERT INTO public.stock_movements(tenant_id, inventory_item_id, movement_type, quantity,
        geschaeftsgrund, mengenqualitaet, befehl_id, befehl_inhalt_sha256, befehl_zeile,
        fachzeit, revision, altquelle, mengeneinheit)
      VALUES (${mandant}, ${id}, 'opening', 10, 'altbestand', 'unbestaetigt',
        ${randomUUID()}::uuid, repeat('7', 64), 1, ${zugang.fachzeit}::timestamptz, 1,
        '{"tabelle":"inventory_items"}'::jsonb, 'kg')
    `;
    const [original] = await sql<{ id: string }[]>`
      SELECT id::text FROM public.stock_movements WHERE tenant_id = ${mandant}
        AND inventory_item_id = ${id} AND movement_type = 'opening'
    `;
    const bucht = (eingabe: unknown) => withSession(werkstatt, () => bucheLagerAction(eingabe));
    const gegenbucht = (ursprungId: string, befehlId = randomUUID()) => withSession(werkstatt, () =>
      bucheLagerGegenbuchungAction({ ursprungId, befehlId, fachzeit: zugang.fachzeit }));

    const [ersterZugang, gleichzeitigerZugang] = await Promise.all([bucht(zugang), bucht({ ...zugang, quantity: 5 })]);
    expect(ersterZugang).toMatchObject({ ok: true, data: { quantity: 5 } });
    if (!ersterZugang.ok) throw Error("TEST_ZUGANG_FEHLT");
    expect(gleichzeitigerZugang).toEqual(ersterZugang);
    expect(await bucht({ ...zugang, quantity: "5.000" })).toEqual(ersterZugang);
    expect(await bucht({ ...zugang, quantity: "6" }))
      .toEqual({ ok: false, error: "CONFLICT", message: LAGER_BUCHUNG_COPY.befehlKonflikt });

    const entnahme = await bucht({ ...zugang, befehlId: randomUUID(), movementType: "stock_out",
      quantity: "2", geschaeftsgrund: "entnahme" });
    expect(entnahme).toMatchObject({ ok: true, data: { quantity: -2 } });
    if (!entnahme.ok) throw Error("TEST_ENTNAHME_FEHLT");
    const umlagerung = { ...zugang, befehlId: randomUUID(), movementType: "move",
      quantity: "3", geschaeftsgrund: "umlagerung", zielOrtId: ziel };
    const umgelagert = await bucht(umlagerung);
    expect(umgelagert).toMatchObject({ ok: true, data: { quantity: -3 } });
    expect(await bucht(umlagerung)).toEqual(umgelagert);
    expect(await bucht(umlagerung)).toEqual(umgelagert);
    expect(await summe(id)).toEqual(expect.arrayContaining([{ ort: null, menge: 10 },
      { ort: quelle, menge: 0 }, { ort: ziel, menge: 3 }]));

    const stornoIds = [randomUUID(), randomUUID()];
    const stornoVersuche = await Promise.all(stornoIds.map(id => gegenbucht(entnahme.data.id, id)));
    const sieger = stornoVersuche.findIndex(antwort => antwort.ok);
    if (sieger < 0) throw Error("TEST_GEGENBUCHUNG_FEHLT");
    const stornoId = stornoIds[sieger];
    const storno = stornoVersuche[sieger];
    expect(stornoVersuche[1 - sieger])
      .toEqual({ ok: false, error: "CONFLICT", message: LAGER_BUCHUNG_COPY.gegenbuchungVorhanden });
    expect(storno).toMatchObject({ ok: true, data: { quantity: 2, movementType: "reversal" } });
    if (!storno.ok) throw Error("TEST_GEGENBUCHUNG_FEHLT");
    expect(await gegenbucht(entnahme.data.id, stornoId)).toEqual(storno);
    expect(await gegenbucht(entnahme.data.id))
      .toEqual({ ok: false, error: "CONFLICT", message: LAGER_BUCHUNG_COPY.gegenbuchungVorhanden });
    expect(await gegenbucht(storno.data.id)).toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
    expect(await gegenbucht(original.id)).toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
    expect(await summe(id)).toEqual(expect.arrayContaining([{ ort: null, menge: 10 },
      { ort: quelle, menge: 2 }, { ort: ziel, menge: 3 }]));

    const [altstand] = await sql`SELECT current_stock FROM public.inventory_items WHERE id = ${id}`;
    expect(altstand.current_stock).toBeNull();
    const [zaehler] = await sql`
      SELECT count(*)::int FROM public.stock_movements
      WHERE tenant_id = ${mandant} AND inventory_item_id = ${id}
    `;
    expect(zaehler.count).toBe(6);
    expect(await withSession(readonly, () => leseLagerBefehlsstandAction([zugang.befehlId, stornoId, unbekannteKennung])))
      .toEqual({ ok: true, data: [
        { befehlId: zugang.befehlId, gebucht: true, eventId: ersterZugang.data.eventId },
        { befehlId: stornoId, gebucht: true, eventId: storno.data.eventId },
        { befehlId: unbekannteKennung, gebucht: false, eventId: null },
      ] });

    if (!umgelagert.ok) throw Error("TEST_UMLAGERUNG_FEHLT");
    const paarId = randomUUID();
    expect(await gegenbucht(umgelagert.data.id, paarId)).toMatchObject({ ok: true });
    expect(await sql`
      SELECT gegenbuchung_id::text, quantity::float8 AS menge FROM public.stock_movements
      WHERE tenant_id = ${mandant} AND befehl_id = ${paarId}::uuid ORDER BY befehl_zeile
    `).toEqual([
      { gegenbuchung_id: umgelagert.data.id, menge: 3 },
      { gegenbuchung_id: expect.any(String), menge: -3 },
    ]);
    expect(await summe(id)).toEqual(expect.arrayContaining([
      { ort: null, menge: 10 }, { ort: quelle, menge: 5 }, { ort: ziel, menge: 0 },
    ]));
  });

  test("I7: Zwei negative Buchungen klären genau einen Bestand, der Ausgleich schließt dieselbe Aufgabe", async () => {
    const id = await artikel();
    const basis = buchung(id, await ort());
    const entnahme = { ...basis, movementType: "stock_out", quantity: "2", geschaeftsgrund: "entnahme" } as const;
    const lesen = () => sql<{ id: string; titel: string; status: string }[]>`
      SELECT id::text, titel, status FROM public.tasks
      WHERE tenant_id = ${mandant} AND bezug_typ = 'lagerbestand' AND bezug_id = ${id}
    `;
    expect(await withSession(werkstatt, () => createInventoryMovementAction(entnahme))).toMatchObject({ ok: true });
    expect(await withSession(werkstatt, () => createInventoryMovementAction({
      ...entnahme, befehlId: randomUUID(), quantity: "1",
    }))).toMatchObject({ ok: true });
    const offen = await lesen();
    expect(offen).toEqual([{ id: expect.any(String), titel: "Bestand von TEST Buchungsmaterial klären", status: "offen" }]);
    expect(await withSession(werkstatt, () => createInventoryMovementAction({
      ...basis, befehlId: randomUUID(), quantity: "3",
    }))).toMatchObject({ ok: true });
    expect(await lesen()).toEqual([{ ...offen[0], status: "erledigt" }]);
  });

  test("I8: Bewertung, eingefrorene Preise, fehlender Preis und fehlende Einstellungen", async () => {
    const [rubrik] = await sql<{ id: string }[]>`
      INSERT INTO public.categories (tenant_id, name) VALUES (${mandant}, 'TEST Buchungsrubrik') RETURNING id::text
    `;
    const id = await artikel(mandant, rubrik.id);
    const ohnePreis = await artikel(mandant, rubrik.id);
    const ortId = await ort();
    const basis = buchung(id, ortId);
    const auftrag = await auftragAnlegen(mandant);
    const regeln = { [rubrik.id]: "verbrauch" };
    await sql`UPDATE public.company_settings SET material_aufschlag_prozent = 20, lager_regelversion = 'TEST-v1',
      entnahme_regel_je_rubrik = ${sql.json(regeln)}::jsonb WHERE tenant_id = ${mandant} AND id = ${firma}`;
    await sql`INSERT INTO public.material_prices (tenant_id, artikel_id, einzelpreis, waehrung, quelle, gueltig_ab, bestaetigt_am)
      VALUES (${mandant}, ${id}, 4.2, 'EUR', 'manuell', ${basis.fachzeit}::timestamptz - interval '2 days',
          ${basis.fachzeit}::timestamptz - interval '2 days'),
        (${mandant}, ${id}, 3.4, 'EUR', 'manuell', ${basis.fachzeit}::timestamptz - interval '1 day',
          ${basis.fachzeit}::timestamptz - interval '1 day')`;

    const verbrauch = { ...basis, movementType: "consumption", geschaeftsgrund: "verbrauch",
      quantity: "1", orderId: auftrag, imPreisEnthalten: false };
    for (const [methode, erwartet] of [
      ["letzter_ek", 3.4], ["gleitender_durchschnitt", 3.8], ["hoechster_ek", 4.2],
    ] as const) {
      await sql`UPDATE public.company_settings SET bilanzbewertung_methode = ${methode}
        WHERE tenant_id = ${mandant} AND id = ${firma}`;
      const geschrieben = await withSession(werkstatt, () => bucheAuftragsverbrauchAction({
        ...verbrauch, befehlId: randomUUID(),
      }));
      expect(geschrieben).toMatchObject({ ok: true, data: { preisFehlt: false } });
      if (!geschrieben.ok) throw Error("TEST_AUFTRAGSVERBRAUCH_FEHLT");
      const [preis] = await sql`SELECT kalk_ek::float8, aufschlag_pct::float8, preisquelle_id
        FROM public.stock_movements WHERE id = ${geschrieben.data.id}::uuid`;
      expect(preis).toEqual({ kalk_ek: erwartet, aufschlag_pct: 20, preisquelle_id: expect.any(String) });
    }

    const unbewertet = await withSession(werkstatt, () => bucheAuftragsverbrauchAction({
      ...verbrauch, inventoryItemId: ohnePreis, befehlId: randomUUID(),
    }));
    expect(unbewertet).toMatchObject({ ok: true, data: { preisFehlt: true } });
    if (!unbewertet.ok) throw Error("TEST_AUFTRAGSVERBRAUCH_FEHLT");
    const ohneAuftragsrecht = await createFixture([], "werkstatt");
    const fremderStornoId = randomUUID();
    expect(await withSession(ohneAuftragsrecht, () => bucheLagerGegenbuchungAction({
      befehlId: fremderStornoId, ursprungId: unbewertet.data.id, fachzeit: basis.fachzeit,
    }))).toEqual({ ok: false, error: "FORBIDDEN", message: LAGER_BUCHUNG_COPY.auftragsrecht });
    expect(await sql`SELECT id FROM public.stock_movements
      WHERE tenant_id = ${mandant} AND befehl_id = ${fremderStornoId}::uuid`).toHaveLength(0);
    const material = await withPrivilegedTenantTransaction({ tenantId: mandant }, tx =>
      leseLagerAuftragsmaterialInTransaction(tx, auftrag));
    expect(material).toEqual(expect.arrayContaining([expect.objectContaining({
      artikelId: ohnePreis, preisFehlt: true, wertEur: null,
    })]));
    expect(material).toHaveLength(4);

    await sql`INSERT INTO public.material_prices (tenant_id, artikel_id, einzelpreis, waehrung, quelle, gueltig_ab, bestaetigt_am)
      VALUES (${mandant}, ${id}, 7, 'EUR', 'manuell', ${basis.fachzeit}::timestamptz, ${basis.fachzeit}::timestamptz)`;
    expect(await withPrivilegedTenantTransaction({ tenantId: mandant }, tx =>
      leseLagerAuftragsmaterialInTransaction(tx, auftrag))).toEqual(material);

    await sql`UPDATE public.company_settings SET material_aufschlag_prozent = NULL
      WHERE tenant_id = ${mandant} AND id = ${firma}`;
    expect(await withSession(werkstatt, () => bucheAuftragsverbrauchAction({ ...verbrauch, befehlId: randomUUID() })))
      .toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
    const [anzahl] = await sql`SELECT count(*)::int FROM public.stock_movements
      WHERE tenant_id = ${mandant} AND order_id = ${auftrag}`;
    expect(anzahl.count).toBe(4);

    const wenigRechte = await withSession(readonly, () => leseLagerBewegungenAction({ artikelId: id }));
    const volleRechte = await withSession(admin, () => leseLagerBewegungenAction({ artikelId: id }));
    expect(wenigRechte).toMatchObject({ ok: true });
    expect(volleRechte).toMatchObject({ ok: true });
    if (!wenigRechte.ok || !volleRechte.ok) throw Error("TEST_LAGER_BEWEGUNGEN_FEHLEN");
    expect(wenigRechte.data).toHaveLength(3);
    for (const zeile of wenigRechte.data) {
      expect(zeile).not.toHaveProperty("kalk_ek");
      expect(zeile).not.toHaveProperty("aufschlag_pct");
      expect(zeile).not.toHaveProperty("snapshot_einkaufspreis_eur");
    }
    expect(volleRechte.data.map(zeile => zeile.kalk_ek).sort()).toEqual([3.4, 3.8, 4.2]);
  });

  test("Mehrarbeit bei Rubrik Umlagerung ergibt eine Verbrauchszeile und bindet den eigenen Auftrag", async () => {
    const [rubrik] = await sql<{ id: string }[]>`
      INSERT INTO public.categories (tenant_id, name) VALUES (${mandant}, 'TEST Umlagerungsrubrik') RETURNING id::text
    `;
    const artikelId = await artikel(mandant, rubrik.id);
    const auftrag = await auftragAnlegen(mandant);
    const fremderAuftrag = await auftragAnlegen(fremd);
    const mehrarbeit = randomUUID();
    const fremdeMehrarbeit = randomUUID();
    await sql`INSERT INTO public.events (id, tenant_id, order_id, event_type, status, description, payload)
      VALUES (${mehrarbeit}, ${mandant}, ${auftrag}, 'ORDER_ITEM_EXTRA_WORK_CHANGED_V1', 'success', 'TEST Mehrarbeit', '{}'::jsonb),
        (${fremdeMehrarbeit}, ${fremd}, ${fremderAuftrag}, 'ORDER_ITEM_EXTRA_WORK_CHANGED_V1', 'success', 'TEST Fremdbeleg', '{}'::jsonb)`;
    await sql`UPDATE public.company_settings SET entnahme_regel_je_rubrik = ${sql.json({ [rubrik.id]: "umlagerung" })}::jsonb,
      material_aufschlag_prozent = 20, lager_regelversion = 'TEST-v1', bilanzbewertung_methode = 'letzter_ek'
      WHERE tenant_id = ${mandant} AND id = ${firma}`;
    const verbrauch = {
      ...buchung(artikelId, await ort()), movementType: "consumption", geschaeftsgrund: "verbrauch",
      quantity: "1", orderId: auftrag, imPreisEnthalten: false, mehrarbeitBelegId: mehrarbeit,
    };
    const bucht = (input: typeof verbrauch) => withSession(werkstatt, () => bucheAuftragsverbrauchAction(input));
    expect(await bucht({ ...verbrauch, befehlId: randomUUID(), orderId: fremderAuftrag }))
      .toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
    expect(await bucht({ ...verbrauch, befehlId: randomUUID(), mehrarbeitBelegId: fremdeMehrarbeit }))
      .toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
    expect(await bucht(verbrauch))
      .toMatchObject({ ok: true, data: { movementType: "consumption", mehrarbeitBelegId: mehrarbeit } });
    expect(await sql`SELECT movement_type, mehrarbeit_beleg_id FROM public.stock_movements
      WHERE tenant_id = ${mandant} AND inventory_item_id = ${artikelId}`)
      .toEqual([{ movement_type: "consumption", mehrarbeit_beleg_id: mehrarbeit }]);
  });

  test("Lagerleser und Schreiber wahren Mandant und Rollenrecht", async () => {
    const id = await artikel();
    const fremderArtikel = await artikel(fremd);
    const ortId = await ort();
    const fremderOrt = await ort(fremd);
    const basis = buchung(id, ortId);
    const fremderBefehl = randomUUID();
    const [fremdeBewegung] = await sql<{ id: string }[]>`
      INSERT INTO public.stock_movements(tenant_id, inventory_item_id, movement_type, quantity,
        geschaeftsgrund, mengenqualitaet, befehl_id, befehl_inhalt_sha256, befehl_zeile,
        fachzeit, revision, altquelle, mengeneinheit)
      VALUES (${fremd}, ${fremderArtikel}, 'opening', 7, 'altbestand', 'unbestaetigt',
        ${fremderBefehl}::uuid, repeat('8',64), 1, ${basis.fachzeit}::timestamptz, 1,
        '{"tabelle":"inventory_items"}'::jsonb, 'kg') RETURNING id::text
    `;
    expect(await withSession(readonly, () => leseLagerBestandAction(fremderArtikel))).toEqual({ ok: true, data: [] });
    expect(await withSession(readonly, () => leseLagerBewegungenAction({ artikelId: fremderArtikel })))
      .toEqual({ ok: true, data: [] });
    expect(await withSession(readonly, () => leseLagerBefehlsstandAction([fremderBefehl])))
      .toEqual({ ok: true, data: [{ befehlId: fremderBefehl, gebucht: false, eventId: null }] });
    expect(await withSession(readonly, () => bucheLagerAction(basis))).toMatchObject({ ok: false, error: "FORBIDDEN" });
    expect(await withSession(werkstatt, () => bucheLagerAction({ ...basis, inventoryItemId: fremderArtikel })))
      .toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(await withSession(werkstatt, () => bucheLagerAction({ ...basis, ortId: fremderOrt })))
      .toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(await withSession(werkstatt, () => bucheLagerGegenbuchungAction({
      befehlId: basis.befehlId, ursprungId: fremdeBewegung.id, fachzeit: basis.fachzeit,
    }))).toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(await sql`SELECT id FROM public.stock_movements WHERE befehl_id = ${basis.befehlId}::uuid`).toHaveLength(0);
  });

  test("Der Bewegungsleser setzt nach genau 100 Zeilen ohne Verlust von Mikrosekunden fort", async () => {
    const id = await artikel();
    const [referenz] = await sql<{ zeit: string }[]>`SELECT statement_timestamp()::text AS zeit`;
    await sql`
      INSERT INTO public.stock_movements (tenant_id, inventory_item_id, movement_type, quantity, created_at)
      SELECT ${mandant}, ${id}, 'stock_in', lauf.nr,
        date_trunc('second', ${referenz.zeit}::timestamptz) + lauf.nr * interval '1 microsecond'
      FROM generate_series(1, 101) lauf(nr)
    `;
    const erste = await withSession(readonly, () => leseLagerBewegungenAction({ artikelId: id }));
    if (!erste.ok) throw Error("TEST_ERSTE_BEWEGUNGSSEITE_FEHLT");
    expect(erste.data).toHaveLength(100);
    const letzte = erste.data[99];
    expect(letzte.quantity).toBe(2);
    if (letzte.fachzeit === undefined) throw Error("TEST_CURSOR_FEHLT");
    const cursor = { fachzeit: letzte.fachzeit, id: letzte.id };
    expect(await withSession(readonly, () => leseLagerBewegungenAction({ artikelId: id, nach: cursor })))
      .toMatchObject({ ok: true, data: [{ quantity: 1 }] });
  });

  test("Das ausgeschaltete Lager lässt keinen neuen Befehl und keinen Lagerleser laufen", async () => {
    const basis = buchung(await artikel(), await ort());
    const abgelehnt = { ok: false, error: "FORBIDDEN", message: LAGER_BUCHUNG_COPY.ausgeschaltet };
    await sql`UPDATE public.feature_flags SET enabled = false WHERE id = 'p4_lager'`;
    try {
      await withSession(werkstatt, async () => {
        expect(await bucheLagerAction(basis)).toEqual(abgelehnt);
        expect(await bucheLagerGegenbuchungAction({ befehlId: basis.befehlId, ursprungId: randomUUID(), fachzeit: basis.fachzeit }))
          .toEqual(abgelehnt);
        expect(await bucheAuftragsverbrauchAction(basis)).toEqual(abgelehnt);
        expect(await leseLagerBestandAction()).toEqual(abgelehnt);
        expect(await leseLagerBewegungenAction()).toEqual(abgelehnt);
        expect(await leseLagerBefehlsstandAction([basis.befehlId])).toEqual(abgelehnt);
      });
      expect(await sql`SELECT id FROM public.stock_movements WHERE befehl_id = ${basis.befehlId}::uuid`).toHaveLength(0);
      expect(await sql`SELECT id FROM public.tasks WHERE tenant_id = ${mandant} AND bezug_id = ${basis.inventoryItemId}`)
        .toHaveLength(0);
      const protokoll = await sql<{ command: string; subject_type: string; subject_id: string }[]>`
        SELECT command, subject_type, subject_id FROM public.technical_protocol
        WHERE tenant_id = ${mandant} AND user_id = ${werkstatt.actorId}::uuid
          AND event_type = 'rejected' AND reason = 'FORBIDDEN'
      `;
      for (const action of [
        "bucheLagerAction", "bucheLagerGegenbuchungAction", "bucheAuftragsverbrauchAction",
        "leseLagerBestandAction", "leseLagerBewegungenAction", "leseLagerBefehlsstandAction",
      ]) {
        expect(protokoll).toContainEqual({ command: action, subject_type: "action", subject_id: action });
      }
    } finally {
      await sql`UPDATE public.feature_flags SET enabled = true WHERE id = 'p4_lager'`;
    }
  });
});

// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const mandant = vi.hoisted(() => "TEST-ablauf-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: mandant }));

import { createFixture, full, sql, withSession } from "../../../e2e/ablauf/replayHarness";
import { cancelInvoiceAction, getInvoiceReceiptAction, issueCollectionInvoiceAction, issueInvoiceAction } from "@/app/actions/invoices.actions";
import { leseAuftragsmaterial } from "@/app/actions/lager-material.actions";
import { hinterlegeLagerPreis } from "@/app/actions/lager-preis.actions";
import { bucheAuftragsverbrauchAction, bucheLagerGegenbuchungAction, leseLagerBestandAction } from "@/app/actions/lager.actions";
import {
  changeOrderItemExtraWorkAction, changeOrderPickupNoticeAction, configureExtraWorkCatalogPositionAction,
  getExtraWorkMasterDataAction,
} from "@/app/actions/orders.actions";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { leseLagerAuftragsmaterialInTransaction } from "@/modules/lager/server-public";
import { E_INVOICE_COPY } from "@/ui/accountingCopy";
import { FINANCIAL_ACCESS_COPY } from "@/ui/financialAccessCopy";
import { LAGER_MATERIAL_COPY } from "@/ui/lagerMaterialCopy";
import { historicalCollection } from "../../../e2e/ablauf/invoiceCollectionFixture";
import { readyOrderForInvoice } from "../../../e2e/ablauf/orderFixture";

const datenbankUrl = process.env.DATABASE_URL;
const replay = datenbankUrl && URL.canParse(datenbankUrl) ? new URL(datenbankUrl) : null;
const replayPort = process.env.GITHUB_ACTIONS === "true" ? "54322" : "54342";
if (!replay || datenbankUrl !== process.env.H18_EXPECTED_DATABASE_URL
  || replay.protocol !== "postgresql:" || replay.hostname !== "127.0.0.1" || replay.port !== replayPort) {
  throw Error("TEST_MATERIAL_REPLAY_DATENBANK_FEHLT");
}

type Anmeldung = Awaited<ReturnType<typeof createFixture>>;
let admin: Anmeldung;
let werkstatt: Anmeldung;
let schalter: boolean | undefined;
let rubrik: string;
let ort: string;

beforeAll(async () => {
  const [original] = await sql<{ enabled: boolean }[]>`SELECT enabled FROM public.feature_flags WHERE id = 'p4_lager'`;
  if (!original) throw Error("TEST_LAGER_SCHALTER_FEHLT");
  schalter = original.enabled;
  await sql`UPDATE public.feature_flags SET enabled = true WHERE id = 'p4_lager'`;
  admin = await createFixture(["auftraege", "lager.stamm"], "admin");
  werkstatt = await createFixture(["auftraege"], "werkstatt");
  const [gruppe] = await sql<{ id: string }[]>`
    INSERT INTO public.categories (tenant_id, name) VALUES (${mandant}, 'TEST Material') RETURNING id::text
  `;
  rubrik = gruppe.id;
  const [lagerort] = await sql<{ id: string }[]>`
    INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich) VALUES (${mandant}, 'TEST EG', 'TEST Material') RETURNING id::text
  `;
  ort = lagerort.id;
});

afterAll(async () => {
  if (schalter !== undefined) await sql`UPDATE public.feature_flags SET enabled = ${schalter} WHERE id = 'p4_lager'`;
});

async function bereiteAuftragVor(name: string, uebergabe: "pickup" | "shipping" = "pickup") {
  const auftrag = await readyOrderForInvoice(name, uebergabe);
  await setzeLagerregeln();
  return { orderId: auftrag.orderId, expectedVersion: auftrag.version, clientEventId: randomUUID() };
}

async function setzeLagerregeln() {
  await sql`UPDATE public.company_settings SET material_aufschlag_prozent = 20, lager_regelversion = 'TEST-Material',
    entnahme_regel_je_rubrik = ${sql.json({ [rubrik]: "verbrauch" })}::jsonb,
    bilanzbewertung_methode = 'letzter_ek' WHERE tenant_id = ${mandant}`;
}

async function artikel(name: string, einheit: string, preis?: string, kursMetall = false) {
  const id = "TEST-" + randomUUID();
  await sql`INSERT INTO public.inventory_items (id, tenant_id, name, category, basiseinheit, rubrik_id,
    metall, feingehalt_pct, kurs_metall)
    VALUES (${id}, ${mandant}, ${name}, 'chemical', ${einheit}, ${rubrik}::uuid,
      ${kursMetall ? "Gold" : null}, ${kursMetall ? 99.9 : null}, ${kursMetall ? true : null})`;
  if (preis !== undefined) {
    await sql`INSERT INTO public.material_prices (tenant_id, artikel_id, einzelpreis, waehrung, quelle, gueltig_ab, bestaetigt_am)
      VALUES (${mandant}, ${id}, ${preis}::numeric, 'EUR', 'manuell', statement_timestamp() - interval '1 day', statement_timestamp() - interval '1 day')`;
  }
  return id;
}

function verbrauch(orderId: string, inventoryItemId: string, einheit: string, quantity: string, imPreisEnthalten = false) {
  return {
    orderId, inventoryItemId, einheit, quantity, imPreisEnthalten, ortId: ort, revision: 1,
    befehlId: randomUUID(), fachzeit: new Date(Date.now() - 5_000).toISOString(),
    mengenqualitaet: "exakt", movementType: "consumption", geschaeftsgrund: "verbrauch",
  };
}

describe("Material am Auftrags- und Rechnungsoriginal", () => {
  test("Die neuen internen Materialfunktionen sind für API-Rollen nicht aufrufbar", async () => {
    const rechte = await sql<{ erlaubt: boolean }[]>`
      SELECT has_function_privilege(rolle.oid, funktion.oid, 'EXECUTE') AS erlaubt
      FROM pg_roles rolle
      CROSS JOIN pg_proc funktion
      JOIN pg_namespace namensraum ON namensraum.oid = funktion.pronamespace
      WHERE rolle.rolname IN ('anon', 'authenticated', 'service_role')
        AND namensraum.nspname = 'private'
        AND funktion.proname IN (
          'lager_preisbefehl_schuetzen', 'lager_material_rechnung', 'lager_material_rechnung_sperren'
        )
    `;
    expect(rechte).toHaveLength(9);
    expect(rechte.every(({ erlaubt }) => erlaubt === false)).toBe(true);
  });

  test("Material zur Mehrarbeit erscheint auf Karte und Rechnung mit 8,16 € und bleibt separat berechnet", async () => {
    const catalogPositionId = randomUUID();
    const katalog = await withSession(full, () => configureExtraWorkCatalogPositionAction({
      positionId: catalogPositionId, expectedVersion: 0, name: "TEST Gestellaufwand",
      standardMinutes: 60, active: true, clientEventId: randomUUID(),
    }));
    expect(katalog).toMatchObject({ code: "OK" });
    let mehrarbeitBelegId: string | undefined;
    const auftrag = await readyOrderForInvoice("B3-a Material", "pickup", undefined, 10_000, 1,
      async ({ orderId, itemId, version }) => {
        const mehrarbeit = await withSession(full, () => changeOrderItemExtraWorkAction({
          orderId, itemId, catalogPositionId, lineId: randomUUID(), minutes: 60, active: true,
          expectedLineVersion: 0, expectedOrderVersion: version, clientEventId: randomUUID(),
        }));
        if (mehrarbeit.code !== "OK") throw Error("TEST_MEHRARBEIT: " + mehrarbeit.code);
        mehrarbeitBelegId = mehrarbeit.receipt.eventId;
        return mehrarbeit.receipt.aggregateVersion;
      });
    if (!mehrarbeitBelegId) throw Error("TEST_MEHRARBEIT_BELEG_FEHLT");
    await setzeLagerregeln();
    const master = await withSession(full, () => getExtraWorkMasterDataAction());
    if (master.code !== "OK" || !master.data.currentRate) throw Error("TEST_MEHRARBEIT_SATZ_FEHLT");
    const stundenpreisCent = master.data.currentRate.hourlyRateCents;
    const anfrage = { orderId: auftrag.orderId, expectedVersion: auftrag.version, clientEventId: randomUUID() };
    const id = await artikel("TEST Gestellmaterial", "stk", "3.40");
    const eingabe = { ...verbrauch(anfrage.orderId, id, "stk", "2"), mehrarbeitBelegId };
    const stornoVorher = await withSession(werkstatt, () => bucheAuftragsverbrauchAction(eingabe));
    if (!stornoVorher.ok) throw Error("TEST_MATERIALBUCHUNG_FEHLT");
    expect(await withSession(werkstatt, () => bucheLagerGegenbuchungAction({
      befehlId: randomUUID(), ursprungId: stornoVorher.data.eventId, fachzeit: eingabe.fachzeit,
    }))).toMatchObject({ ok: true });
    expect(await withSession(admin, () => leseAuftragsmaterial(anfrage.orderId))).toEqual({ ok: true, data: [] });

    const buchung = { ...eingabe, befehlId: randomUUID() };
    const belegt = await withSession(werkstatt, () => bucheAuftragsverbrauchAction(buchung));
    if (!belegt.ok) throw Error("TEST_MATERIALBUCHUNG_FEHLT");
    expect(belegt.data.mehrarbeitBelegId).toBe(mehrarbeitBelegId);
    expect(await withSession(werkstatt, () => bucheAuftragsverbrauchAction(buchung))).toEqual(belegt);
    expect(await withSession(admin, () => leseAuftragsmaterial(anfrage.orderId))).toMatchObject({ ok: true, data: [{
      artikelId: id, menge: "2", einheit: "stk", verkaufspreis: "4.0800", betragCent: 816,
      wareneinsatzCent: 680, preisFehlt: false, eventIds: [belegt.data.eventId],
    }] });
    const sicht = await withSession(werkstatt, () => leseAuftragsmaterial(anfrage.orderId));
    if (!sicht.ok) throw Error("TEST_MATERIALKARTE_FEHLT");
    expect(sicht.data).toHaveLength(1);
    expect(sicht.data[0]).toMatchObject({ artikelId: id, menge: "2", einheit: "stk" });
    for (const feld of ["verkaufspreis", "betragCent", "wareneinsatzCent"]) {
      expect(sicht.data[0]).not.toHaveProperty(feld);
    }

    const ausgestellt = await withSession(full, () => issueInvoiceAction(anfrage));
    if (ausgestellt.code !== "OK") throw Error("TEST_MATERIALRECHNUNG: " + ausgestellt.code + " " + ausgestellt.message);
    expect(await withSession(full, () => issueInvoiceAction(anfrage))).toEqual({ ...ausgestellt, replayed: true });
    const { invoiceId, invoiceNumber } = ausgestellt.receipt;
    const [original] = await sql`SELECT snapshot FROM public.invoices WHERE tenant_id = ${mandant} AND id = ${invoiceId}::uuid`;
    const zeile = expect.objectContaining({
      type: "MATERIAL", sourceOrderId: anfrage.orderId, articleId: id, name: "Material: TEST Gestellmaterial",
      quantity: "2", unit: "C62", unitNetAmount: "4.0800", lineNetAmountCents: 816, eventIds: [belegt.data.eventId],
    });
    expect(original.snapshot.lines.filter((position: { type: string }) => position.type === "MATERIAL")).toEqual([zeile]);
    expect(original.snapshot.lines.filter((position: { type: string }) => position.type === "EXTRA_WORK")).toEqual([
      expect.objectContaining({ itemId: auftrag.items[0].id, catalogPositionId, minutes: 60, amountCents: stundenpreisCent }),
    ]);
    const gegenbuchung = { befehlId: randomUUID(), ursprungId: belegt.data.eventId, fachzeit: buchung.fachzeit };
    expect(await withSession(werkstatt, () => bucheLagerGegenbuchungAction(gegenbuchung))).toMatchObject({
      ok: false, error: "CONFLICT", message: LAGER_MATERIAL_COPY.rechnungAusgestellt(invoiceNumber),
      details: { code: "LAGER_RECHNUNG_AUSGESTELLT", rechnungsnummer: invoiceNumber },
    });
    expect(await withSession(werkstatt, () => bucheAuftragsverbrauchAction({ ...buchung, befehlId: randomUUID() })))
      .toMatchObject({ ok: false, error: "CONFLICT", details: { code: "LAGER_AUFTRAG_BERECHNET" } });
    expect(await withSession(full, () => cancelInvoiceAction({
      invoiceId, expectedVersion: 1, reason: "TEST Materialkorrektur", clientEventId: randomUUID(),
    }))).toMatchObject({ code: "OK" });
    expect(await withSession(werkstatt, () => bucheLagerGegenbuchungAction(gegenbuchung))).toMatchObject({ ok: true });
    expect(await withSession(admin, () => leseAuftragsmaterial(anfrage.orderId))).toEqual({ ok: true, data: [] });
  });

  test("Ausgeschaltetes Lager lässt eine Rechnung ohne Materialposition durch", async () => {
    const anfrage = await bereiteAuftragVor("B3-a ausgeschaltet");
    const artikelId = await artikel("TEST Preis fehlt bei ausgeschaltetem Lager", "stk");
    expect(await withSession(werkstatt, () =>
      bucheAuftragsverbrauchAction(verbrauch(anfrage.orderId, artikelId, "stk", "1")))).toMatchObject({ ok: true });
    await sql`UPDATE public.feature_flags SET enabled = false WHERE id = 'p4_lager'`;
    try {
      expect(await withSession(admin, () => leseAuftragsmaterial(anfrage.orderId))).toMatchObject({ ok: false, error: "FORBIDDEN" });
      const ausgestellt = await withSession(full, () => issueInvoiceAction(anfrage));
      if (ausgestellt.code !== "OK") throw Error("TEST_RECHNUNG_LAGER_AUS: " + ausgestellt.code);
      const [original] = await sql`SELECT snapshot FROM public.invoices
        WHERE tenant_id = ${mandant} AND id = ${ausgestellt.receipt.invoiceId}::uuid`;
      expect(original.snapshot.lines.map((zeile: { type: string }) => zeile.type)).toEqual(["BASE"]);
    } finally {
      await sql`UPDATE public.feature_flags SET enabled = true WHERE id = 'p4_lager'`;
    }
  });

  test.each([1, 2] as const)("Rechnungsoriginal aus Schema %i bleibt lesbar, die Stornosperre bleibt wirksam", async (schemaVersion) => {
    const anfrage = await bereiteAuftragVor("B3-a Altoriginal " + schemaVersion);
    const ausgestellt = await withSession(full, () => issueInvoiceAction(anfrage));
    if (ausgestellt.code !== "OK") throw Error("TEST_ALTRECHNUNG_FEHLT: " + ausgestellt.code);
    const { invoiceId, invoiceNumber, eventId } = ausgestellt.receipt;
    type JsonWert = Parameters<typeof sql.json>[0];
    type JsonObjekt = Record<string, JsonWert>;
    const [row] = await sql<{ snapshot: JsonObjekt & {
      seller: JsonObjekt; customer: JsonObjekt; totals: JsonObjekt; lines: JsonObjekt[];
    } }[]>`
      SELECT snapshot FROM public.invoices WHERE tenant_id = ${mandant} AND id = ${invoiceId}::uuid
    `;
    const ohneFelder = (objekt: JsonObjekt, felder: readonly string[]) =>
      Object.fromEntries(Object.entries(objekt).filter(([schluessel]) => !felder.includes(schluessel)));
    const steuerId = row.snapshot.seller.taxNumber ?? row.snapshot.seller.vatId;
    if (typeof steuerId !== "string") throw Error("TEST_ALTRECHNUNG_STEUER_ID_FEHLT");
    const steuersatz = schemaVersion === 1 ? 1900 : null;
    const altoriginal = {
      ...row.snapshot,
      schemaVersion,
      seller: { ...ohneFelder(row.snapshot.seller, ["taxNumber", "vatId"]), taxId: steuerId },
      customer: schemaVersion === 1 ? ohneFelder(row.snapshot.customer, ["vatId"]) : row.snapshot.customer,
      totals: schemaVersion === 1
        ? { ...ohneFelder(row.snapshot.totals, ["vatBreakdown"]), vatRateBasisPoints: steuersatz }
        : row.snapshot.totals,
      lines: row.snapshot.lines.map(zeile => ohneFelder(zeile, [
        "unit", "taxCategory", "sourceOrderId", "unitSource", ...(schemaVersion === 1 ? ["vat_rate_basis_points"] : []),
      ])),
    };
    await sql.begin(async tx => {
      // Nur diese Transaktion überführt die frisch erzeugten TEST-Belege in den historischen Stand.
      // Constraints bleiben aktiv und der Lese- und Stornoweg läuft danach mit den normalen Triggern.
      await tx`SET LOCAL session_replication_role = replica`;
      await tx`UPDATE public.events SET payload = jsonb_set(payload, '{vatRateBasisPoints}',
          coalesce(to_jsonb(${steuersatz}::integer), 'null'::jsonb))
        WHERE tenant_id = ${mandant} AND id = ${eventId} AND order_id = ${anfrage.orderId}`;
      await tx`UPDATE public.invoices SET snapshot = ${tx.json(altoriginal)}::jsonb, vat_rate_basis_points = ${steuersatz}
        WHERE tenant_id = ${mandant} AND id = ${invoiceId}::uuid AND issue_event_id = ${eventId}`;
      await tx`SET LOCAL session_replication_role = origin`;
    });
    expect(await withSession(full, () => getInvoiceReceiptAction({
      orderId: anfrage.orderId, clientEventId: anfrage.clientEventId,
    }))).toMatchObject({ code: "OK", data: { invoiceId, invoiceNumber } });
    expect(await sql`
      SELECT private.invoice_original_vat_valid(snapshot, net_amount_cents, vat_rate_basis_points,
        vat_amount_cents, gross_amount_cents) AS gueltig
      FROM public.invoices WHERE tenant_id = ${mandant} AND id = ${invoiceId}::uuid
    `).toEqual([{ gueltig: true }]);
    expect(await withSession(full, () => cancelInvoiceAction({
      invoiceId, expectedVersion: 1, reason: "TEST Altoriginal stornieren", clientEventId: randomUUID(),
    }))).toEqual({ code: "VALIDATION_ERROR", message: E_INVOICE_COPY.legacyCancellation });
    expect(await sql`
      SELECT status, snapshot FROM public.invoices WHERE tenant_id = ${mandant} AND id = ${invoiceId}::uuid
    `).toEqual([{ status: "issued", snapshot: altoriginal }]);
  });

  test("Ein Preisbeleg eines Preisberechtigten bewertet die offene Buchung genau einmal nach", async () => {
    const anfrage = await bereiteAuftragVor("B3-a Nachbewertung");
    const artikelId = await artikel("TEST Preis fehlt", "ml");
    const aufgaben = () => sql<{ id: string; titel: string; status: string }[]>`
      SELECT id::text, titel, status
      FROM public.tasks
      WHERE tenant_id = ${mandant} AND bezug_typ = 'lagerartikel' AND bezug_id = ${artikelId}
        AND fuer_bereich = 'preise'
    `;
    const auftrag = verbrauch(anfrage.orderId, artikelId, "ml", "250");
    const buche = () => withSession(werkstatt, () => bucheAuftragsverbrauchAction(auftrag));
    const buchung = await buche();
    if (!buchung.ok) throw Error("TEST_MATERIALBUCHUNG_FEHLT");
    expect(await buche()).toEqual(buchung);
    const offeneAufgaben = await aufgaben();
    expect(offeneAufgaben).toEqual([
      { id: expect.any(String), titel: "Preis für TEST Preis fehlt je ml hinterlegen", status: "offen" },
    ]);
    expect(await withSession(admin, () => leseAuftragsmaterial(anfrage.orderId))).toMatchObject({
      ok: true, data: [{ artikelId, preisFehlt: true, betragCent: null }],
    });
    expect(await withSession(full, () => issueInvoiceAction(anfrage))).toMatchObject({
      code: "MATERIAL_PREIS_FEHLT", artikel: ["TEST Preis fehlt"],
    });

    const preisberechtigt = await createFixture(["preise"], "readonly");
    const befehlId = randomUUID();
    const eingabe = { artikelId, einheit: "ml", einzelpreis: "0,0033 €", befehlId };
    const artikelOhneEntnahme = await artikel("TEST Preisangebot ohne Entnahme", "ml");
    expect(await withSession(werkstatt, () => hinterlegeLagerPreis({
      ...eingabe, artikelId: artikelOhneEntnahme, befehlId: randomUUID(),
    }))).toEqual({ ok: false, error: "FORBIDDEN", message: FINANCIAL_ACCESS_COPY.pricesMissing });
    expect(await sql`
      SELECT EXISTS (SELECT 1 FROM public.tasks WHERE tenant_id = ${mandant} AND bezug_id = ${artikelOhneEntnahme}) AS aufgabe,
        EXISTS (SELECT 1 FROM public.material_prices WHERE tenant_id = ${mandant}
          AND artikel_id = ${artikelOhneEntnahme}) AS preis,
        EXISTS (SELECT 1 FROM public.lager_material_nachbewertungen WHERE tenant_id = ${mandant}
          AND artikel_id = ${artikelOhneEntnahme}) AS nachbewertung
    `).toEqual([{ aufgabe: false, preis: false, nachbewertung: false }]);
    const eingepreist = await artikel("TEST Material im Preis enthalten", "ml");
    const kursmetall = await artikel("TEST Kursmetall ohne Materialpreis", "g", undefined, true);
    for (const [id, kaufEinheit, enthalten] of [[eingepreist, "ml", true], [kursmetall, "g", false]] as const) {
      expect(await withSession(werkstatt, () => bucheAuftragsverbrauchAction(
        verbrauch(anfrage.orderId, id, kaufEinheit, "1", enthalten),
      ))).toMatchObject({ ok: true });
      expect(await withSession(werkstatt, () => hinterlegeLagerPreis({
        ...eingabe, artikelId: id, einheit: kaufEinheit, befehlId: randomUUID(),
      }))).toEqual({ ok: false, error: "FORBIDDEN", message: FINANCIAL_ACCESS_COPY.pricesMissing });
      expect(await sql`SELECT id FROM public.tasks
        WHERE tenant_id = ${mandant} AND bezug_typ = 'lagerartikel' AND bezug_id = ${id}`).toEqual([]);
    }
    expect(await withSession(werkstatt, () => hinterlegeLagerPreis(eingabe))).toMatchObject({
      ok: false, error: "FORBIDDEN", message: LAGER_MATERIAL_COPY.preisrechtFehlt("TEST Preis fehlt"),
    });
    expect(await aufgaben()).toEqual(offeneAufgaben);
    const preisSpeichern = (auftrag: typeof eingabe) =>
      withSession(preisberechtigt, () => hinterlegeLagerPreis(auftrag));
    expect(await preisSpeichern({ ...eingabe, einzelpreis: "0,0000" })).toMatchObject({
      ok: false, error: "VALIDATION_ERROR", message: LAGER_MATERIAL_COPY.preisNull("ml"),
    });
    expect(await preisSpeichern({ ...eingabe, einheit: "l" })).toMatchObject({
      ok: false, error: "VALIDATION_ERROR", details: { code: "LAGER_PREIS_EINHEIT_PASST_NICHT" },
    });
    const heuteStand = async () => {
      const [stand] = await sql<{ seq: number }[]>`
        SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id = ${mandant}
      `;
      return stand.seq;
    };
    const vorPreis = await heuteStand();
    const preis = await preisSpeichern(eingabe);
    if (!preis.ok) throw Error("TEST_MATERIALPREIS: " + preis.error + " " + preis.message);
    expect(preis.data.nachbewertungen).toBe(1);
    expect(await aufgaben()).toEqual(offeneAufgaben.map(aufgabe => ({ ...aufgabe, status: "erledigt" })));
    const nachPreis = await heuteStand();
    expect(nachPreis).toBeGreaterThan(vorPreis);
    expect(await preisSpeichern({ ...eingabe, einzelpreis: "0.0033" })).toEqual(preis);
    expect(await preisSpeichern({ ...eingabe, einzelpreis: "0.0040" })).toMatchObject({ ok: false, error: "CONFLICT" });
    expect(await heuteStand()).toBe(nachPreis);
    expect(await sql`
      SELECT nachher->>'action' AS aktion, nachher->>'fuerBereich' AS bereich
      FROM public.intake_event
      WHERE tenant_id = ${mandant} AND nachher->>'taskId' = ${offeneAufgaben[0].id}
      ORDER BY nachher->>'action'
    `).toEqual([
      { aktion: "aufgabe.angelegt", bereich: "preise" },
      { aktion: "aufgabe.erledigt", bereich: "preise" },
    ]);

    const [bewertung] = await sql`
      SELECT event_id::text, preisquelle_id::text, aufschlag_pct::integer, regel_version
      FROM public.lager_material_nachbewertungen WHERE tenant_id = ${mandant} AND befehl_id = ${befehlId}::uuid
    `;
    expect(bewertung).toMatchObject({
      event_id: buchung.data.eventId, preisquelle_id: preis.data.preisId, aufschlag_pct: 20, regel_version: "TEST-Material",
    });
    expect(await withSession(admin, () => leseAuftragsmaterial(anfrage.orderId))).toMatchObject({
      ok: true, data: [{ artikelId, preisFehlt: false, verkaufspreis: "0.0040", betragCent: 100 }],
    });
    expect(await withSession(full, () => issueInvoiceAction(anfrage))).toMatchObject({ code: "OK" });
  });

  test("Die Preisquittung bleibt an die ursprüngliche Einheit gebunden", async () => {
    await bereiteAuftragVor("B3-a Preisquittung");
    const artikelId = await artikel("TEST Preisquittung", "ml");
    const buero = await createFixture(["preise"], "buero");
    const eingabe = { artikelId, einheit: "ml", einzelpreis: "3,40", befehlId: randomUUID() };
    const speichere = (auftrag: typeof eingabe) =>
      withSession(buero, () => hinterlegeLagerPreis(auftrag));
    const quittung = await speichere(eingabe);
    if (!quittung.ok) throw Error("TEST_PREISQUITTUNG_FEHLT");
    expect(quittung.data.nachbewertungen).toBe(0);
    expect(await withSession(admin, () => leseLagerBestandAction(artikelId)))
      .toMatchObject({ ok: true, data: [{ id: artikelId, pricePerUnit: 3.4 }] });

    await sql`UPDATE public.inventory_items SET basiseinheit = 'l' WHERE tenant_id = ${mandant} AND id = ${artikelId}`;
    expect(await speichere(eingabe)).toEqual(quittung);
    expect(await speichere({ ...eingabe, einheit: "l" })).toMatchObject({ ok: false, error: "CONFLICT" });
    expect(await withSession(admin, () => leseLagerBestandAction(artikelId)))
      .toMatchObject({ ok: true, data: [{ id: artikelId, pricePerUnit: null }] });
    await expect(sql`UPDATE public.material_prices SET preiseinheit = 'l'
      WHERE tenant_id = ${mandant} AND id = ${quittung.data.preisId}::uuid`).rejects.toMatchObject({ code: "23514" });
    expect(await sql`SELECT preiseinheit FROM public.material_prices
      WHERE tenant_id = ${mandant} AND befehl_id = ${eingabe.befehlId}::uuid`).toEqual([{ preiseinheit: "ml" }]);
  });

  test("Die Sammelrechnung bündelt Material je Auftrag, Preis und Einheit und lässt enthaltenes Material beim Wareneinsatz", async () => {
    const quelle = await historicalCollection([1900, 1900, 1900]);
    await setzeLagerregeln();
    const [erster, zweiter, ohneMaterial] = quelle.members;
    const literware = await artikel("TEST Badmittel", "ml", "0.0033");
    const gewichtware = await artikel("TEST Granulat", "kg", "4.00");
    const stueckware = await artikel("TEST Einsatz", "stk", "3.40");
    const metall = await artikel("TEST Kursmetall", "g", undefined, true);

    async function buche(orderId: string, artikelId: string, einheit: string, menge: string, enthalten = false) {
      const result = await withSession(werkstatt, () =>
        bucheAuftragsverbrauchAction(verbrauch(orderId, artikelId, einheit, menge, enthalten)));
      if (!result.ok) throw Error("TEST_SAMMELMATERIAL: " + result.error + " " + result.message);
      return result.data.eventId;
    }
    const stueckAlt = await buche(erster.orderId, stueckware, "stk", "2");
    await sql`INSERT INTO public.material_prices (tenant_id, artikel_id, einzelpreis, waehrung, quelle, gueltig_ab, bestaetigt_am)
      VALUES (${mandant}, ${stueckware}, 4, 'EUR', 'manuell', statement_timestamp() - interval '1 hour', statement_timestamp() - interval '1 hour')`;
    const stueckNeu = await buche(erster.orderId, stueckware, "stk", "1");
    const ml = await buche(erster.orderId, literware, "ml", "200");
    const kg = await buche(zweiter.orderId, gewichtware, "kg", "2.5");
    const enthalten = await buche(zweiter.orderId, gewichtware, "kg", "1", true);
    const kurs = await buche(zweiter.orderId, metall, "g", "1");

    const wareneinsatz = await withPrivilegedTenantTransaction({ tenantId: mandant }, tx =>
      leseLagerAuftragsmaterialInTransaction(tx, zweiter.orderId));
    expect(wareneinsatz).toContainEqual(expect.objectContaining({ journalId: enthalten, imPreisEnthalten: true }));

    const karten = await Promise.all(quelle.members.map(({ orderId }) => withSession(admin, () => leseAuftragsmaterial(orderId))));
    const kartenbetraege = karten.map(karte => {
      if (!karte.ok) throw Error("TEST_SAMMELMATERIAL_KARTE_FEHLT");
      return karte.data.reduce((summe, position) => summe + (position.betragCent ?? 0), 0);
    });
    expect(kartenbetraege).toEqual([1376, 1200, 0]);
    const ausgestellt = await withSession(full, () => issueCollectionInvoiceAction({
      collectionId: quelle.collectionId, expectedVersion: 1, clientEventId: randomUUID(),
    }));
    if (ausgestellt.code !== "OK") throw Error("TEST_SAMMELRECHNUNG: " + ausgestellt.code + " " + ausgestellt.message);
    expect(ausgestellt.receipt.netAmountCents).toBe(12576);
    const [original] = await sql<{ snapshot: { lines: {
      type: string; sourceOrderId: string; unit?: string; lineNetAmountCents?: number; eventIds?: string[];
    }[] } }[]>`SELECT snapshot FROM public.invoices WHERE tenant_id = ${mandant} AND id = ${ausgestellt.receipt.invoiceId}::uuid`;
    const positionen = original.snapshot.lines.filter(zeile => zeile.type === "MATERIAL");
    expect(positionen).toHaveLength(4);
    expect(positionen).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceOrderId: erster.orderId, unit: "C62", lineNetAmountCents: 816, eventIds: [stueckAlt] }),
      expect.objectContaining({ sourceOrderId: erster.orderId, unit: "C62", lineNetAmountCents: 480, eventIds: [stueckNeu] }),
      expect.objectContaining({ sourceOrderId: erster.orderId, unit: "MLT", lineNetAmountCents: 80, eventIds: [ml] }),
      expect.objectContaining({ sourceOrderId: zweiter.orderId, unit: "KGM", lineNetAmountCents: 1200, eventIds: [kg] }),
    ]));
    const ereignisse = positionen.flatMap(zeile => zeile.eventIds ?? []);
    expect(ereignisse).not.toContain(enthalten);
    expect(ereignisse).not.toContain(kurs);
    expect(positionen.some(zeile => zeile.sourceOrderId === ohneMaterial.orderId)).toBe(false);
  });

  test("S09 liest für die Ersatzrechnung nach dem Storno die inzwischen korrigierte Materialbuchung", async () => {
    const anfrage = await bereiteAuftragVor("B3-a Versandkorrektur", "shipping");
    const artikelId = await artikel("TEST Material der Ersatzrechnung", "stk", "3.40");
    const verbraucht = verbrauch(anfrage.orderId, artikelId, "stk", "2");
    const alteBuchung = await withSession(werkstatt, () => bucheAuftragsverbrauchAction(verbraucht));
    if (!alteBuchung.ok) throw Error("TEST_MATERIALBUCHUNG_FEHLT");
    const rechnung = await withSession(full, () => issueInvoiceAction(anfrage));
    if (rechnung.code !== "OK") throw Error("TEST_MATERIALRECHNUNG: " + rechnung.code);
    const umstellung = await withSession(full, () => changeOrderPickupNoticeAction({
      command: "handover_manual", orderId: anfrage.orderId, expectedVersion: rechnung.receipt.orderVersion,
      handoverMode: "pickup", clientEventId: randomUUID(),
    }));
    if (umstellung.code !== "OK" || !umstellung.receipt || typeof umstellung.receipt !== "object" || !("eventId" in umstellung.receipt)
      || typeof umstellung.receipt.eventId !== "string") throw Error("TEST_ABHOLUNG_FEHLT");

    const ersatzId = randomUUID();
    const storno = {
      invoiceId: rechnung.receipt.invoiceId, expectedVersion: 1, reason: "Übergabeart Versand → Abholung",
      clientEventId: randomUUID(), reissueWithoutShipping: {
        handoverEventId: umstellung.receipt.eventId, replacementClientEventId: ersatzId,
      },
    };
    await createFixture(["entscheiden"], "buero");
    const fehler = "test_b3a_reissue_" + randomUUID().replaceAll("-", "");
    await sql.unsafe(`CREATE FUNCTION private.${fehler}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.tenant_id = '${mandant}' AND NEW.client_event_id = '${ersatzId}'::uuid THEN PERFORM 1/0; END IF;
      RETURN NEW; END $$`);
    try {
      await sql.unsafe(`CREATE TRIGGER ${fehler} BEFORE INSERT ON public.invoices
        FOR EACH ROW EXECUTE FUNCTION private.${fehler}()`);
      expect(await withSession(full, () => cancelInvoiceAction(storno))).toMatchObject({ code: "UNAVAILABLE" });
    } finally {
      await sql.unsafe(`DROP TRIGGER IF EXISTS ${fehler} ON public.invoices`);
      await sql.unsafe(`DROP FUNCTION private.${fehler}()`);
    }
    const [storniert] = await sql`SELECT status, snapshot, cancellation_pdf_sha256 FROM public.invoices
      WHERE tenant_id = ${mandant} AND id = ${storno.invoiceId}::uuid`;
    expect(storniert).toMatchObject({ status: "cancelled", cancellation_pdf_sha256: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    expect(storniert.snapshot.lines).toContainEqual(expect.objectContaining({
      type: "MATERIAL", lineNetAmountCents: 816, eventIds: [alteBuchung.data.eventId],
    }));
    expect(await withSession(werkstatt, () => bucheLagerGegenbuchungAction({
      befehlId: randomUUID(), ursprungId: alteBuchung.data.eventId, fachzeit: verbraucht.fachzeit,
    }))).toMatchObject({ ok: true });
    const korrigiert = { ...verbraucht, quantity: "1", befehlId: randomUUID() };
    const neueBuchung = await withSession(werkstatt, () => bucheAuftragsverbrauchAction(korrigiert));
    if (!neueBuchung.ok) throw Error("TEST_KORREKTURBUCHUNG_FEHLT");
    const ersatz = await withSession(full, () => cancelInvoiceAction(storno));
    if (ersatz.code !== "OK" || !ersatz.replacementReceipt) {
      const hinweis = "message" in ersatz ? " – " + ersatz.message : "";
      throw Error("TEST_ERSATZRECHNUNG: " + ersatz.code + hinweis);
    }
    const [original] = await sql`SELECT snapshot FROM public.invoices
      WHERE tenant_id = ${mandant} AND id = ${ersatz.replacementReceipt.invoiceId}::uuid`;
    expect(original.snapshot.lines.filter((zeile: { type: string }) => zeile.type === "BASE"))
      .toEqual(storniert.snapshot.lines.filter((zeile: { type: string }) => zeile.type === "BASE"));
    expect(original.snapshot.lines.filter((zeile: { type: string }) => zeile.type !== "BASE")).toEqual([
      expect.objectContaining({ type: "MATERIAL", lineNetAmountCents: 408, eventIds: [neueBuchung.data.eventId] }),
    ]);
    expect(await withSession(werkstatt, () => bucheLagerGegenbuchungAction({
      befehlId: randomUUID(), ursprungId: neueBuchung.data.eventId, fachzeit: korrigiert.fachzeit,
    }))).toMatchObject({ ok: false, details: { code: "LAGER_RECHNUNG_AUSGESTELLT", rechnungsnummer: ersatz.replacementReceipt.invoiceNumber } });
  });

  test("Bewegung, Preis und jede Inventurtabelle erhöhen einzeln den Heute-Stand", async () => {
    const artikelId = await artikel("TEST Heute", "stk");
    const sitzung = randomUUID();
    const rollback = Error("TEST_HEUTE_ROLLBACK");
    await expect(sql.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id', ${mandant}, true)`;
      async function heuteStand() {
        const [row] = await tx<{ seq: number }[]>`
          SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id = ${mandant}
        `;
        return row.seq;
      }
      let erwartet = await heuteStand();
      const [bewegung] = await tx<{ id: string }[]>`
        INSERT INTO public.stock_movements (tenant_id, inventory_item_id, movement_type, quantity)
        VALUES (${mandant}, ${artikelId}, 'stock_in', 1) RETURNING id::text
      `;
      expect(await heuteStand(), "stock_movements").toBe(++erwartet);
      const befehlId = randomUUID();
      const [preis] = await tx<{ id: string }[]>`
        INSERT INTO public.material_prices (tenant_id, artikel_id, einzelpreis, waehrung, quelle, befehl_id, preiseinheit)
        VALUES (${mandant}, ${artikelId}, 3.4, 'EUR', 'manuell', ${befehlId}::uuid, 'stk') RETURNING id::text
      `;
      expect(await heuteStand(), "material_prices").toBe(++erwartet);
      await tx`
        INSERT INTO public.lager_material_nachbewertungen (
          tenant_id, event_id, artikel_id, befehl_id, preisquelle_id, kalk_ek, aufschlag_pct, regel_version
        ) VALUES (${mandant}, ${bewegung.id}::uuid, ${artikelId}, ${befehlId}::uuid, ${preis.id}::uuid, 3.4, 20, 'TEST-Material')
      `;
      expect(await heuteStand(), "lager_material_nachbewertungen").toBe(++erwartet);
      await tx`INSERT INTO public.inventory_sessions (id, tenant_id, stichtag, art, erstellt_von)
        VALUES (${sitzung}::uuid, ${mandant}, CURRENT_DATE - 2, 'stichtag', ${admin.actorId}::uuid)`;
      expect(await heuteStand(), "inventory_sessions").toBe(++erwartet);
      await tx`INSERT INTO public.inventory_counts (tenant_id, session_id, artikel_id, ort_id, einheit)
        VALUES (${mandant}, ${sitzung}::uuid, ${artikelId}, ${ort}::uuid, 'stk')`;
      expect(await heuteStand(), "inventory_counts").toBe(++erwartet);
      await tx`UPDATE public.inventory_sessions SET status = 'abschliessend'
        WHERE tenant_id = ${mandant} AND id = ${sitzung}::uuid`;
      expect(await heuteStand(), "inventory_sessions update").toBe(++erwartet);
      await tx`INSERT INTO public.inventory_lines (tenant_id, session_id, position, artikel_id, ort_id, snapshot)
        VALUES (${mandant}, ${sitzung}::uuid, 1, ${artikelId}, ${ort}::uuid, '{"test":true}'::jsonb)`;
      expect(await heuteStand(), "inventory_lines").toBe(++erwartet);
      throw rollback;
    })).rejects.toBe(rollback);
  });
});

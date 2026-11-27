// @vitest-environment node
import { beforeAll, expect, test, vi } from "vitest";
import { randomUUID } from "node:crypto";

const mandant = vi.hoisted(() => "TEST-ablauf-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: mandant }));

import { createFixture, full, sql, withSession } from "../../../e2e/ablauf/replayHarness";
import { historicalCollection } from "../../../e2e/ablauf/invoiceCollectionFixture";
import { customerFixture, intakeOrderFixture, invoiceCompanySettingsFixture, readyInvoiceOrder, readyOrderForInvoice } from "../../../e2e/ablauf/orderFixture";
import { storeOrderPhoto } from "../../../e2e/ablauf/photoFixture";
import { db } from "@/db";
import { berlinCalendarDay, leseBetriebsruhetage, plusWorkingDays } from "@/lib/domain/workingDays";
import { calculateTermSuggestion } from "@/lib/server/intakeSuggestions";
import { resolveAuthorization } from "@/lib/server/authorization";
import { readCustomerListSignals } from "@/lib/server/customerSummaryRead";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { readQuoteCurrentRate } from "@/lib/server/quoteJournalPort";
import {
  readBetriebsruheInTransaction, readWerkstattKostensatzInTransaction, readWerkstattMehrarbeitInTransaction,
  readWerkstattZeitstationInTransaction,
} from "@/modules/fundament/server-public";
import { fertigtermin } from "@/modules/orders/public";
import { hatArbeitszeitAuftragInTransaction, leseBuendelLaufTeile, leseOffeneLaeufe, mehrarbeitStand, schlageLaeufeVor } from "@/modules/orders/server-public";
import { bookLaufZeit, bookWorkTime, leseArbeitszeitZumAuftrag, readWorkMinutes } from "@/modules/werkstatt/server-public";
import { KALENDER_COPY } from "@/ui/kalenderCopy";
import { ORDER_BUENDEL_LAUF_COPY, ORDER_CONTENT_COPY, ORDER_SCRAP_COPY, ORDER_TERM_COPY } from "@/ui/ordersCopy";
import { INVOICE_SCRAP_COPY } from "@/ui/accountingCopy";
import { WORK_TIME_COPY } from "@/ui/werkstattCopy";

const { DATABASE_URL, H18_EXPECTED_DATABASE_URL } = process.env;
if (!DATABASE_URL || DATABASE_URL !== H18_EXPECTED_DATABASE_URL || new URL(DATABASE_URL).hostname !== "127.0.0.1") {
  throw Error("TEST_WERKSTATT_REPLAY_DB_ERFORDERLICH");
}

beforeAll(invoiceCompanySettingsFixture);

async function liesWerkstattKostenstellen() {
  const [firma] = await sql<{ werkstatt_zeit_kostenstellen: Record<string, string> }[]>`
    SELECT werkstatt_zeit_kostenstellen FROM public.company_settings WHERE tenant_id = ${mandant}
  `;
  if (!firma) throw Error("TEST_WERKSTATT_EINSTELLUNGEN_FEHLEN");
  return firma.werkstatt_zeit_kostenstellen;
}

function setzeWerkstattKostenstellen(zuordnungen: Record<string, string>) {
  return sql`UPDATE public.company_settings SET werkstatt_zeit_kostenstellen = ${sql.json(zuordnungen)}::jsonb
    WHERE tenant_id = ${mandant}`;
}

test("Ein Liefertermin bleibt ohne festgelegte Übergabeart lesbar", async () => {
  const liefertermin = "2027-05-18";
  const ursprung = await readyInvoiceOrder("TEST Altbestand ohne Übergabeart", "shipping");
  const foto = await storeOrderPhoto(ursprung.orderId);
  const { reklamationAusfuehrenAction, nacharbeitAnlegenAction } = await import("@/app/actions/complaints.actions");
  const reklamation = await withSession(full, () => reklamationAusfuehrenAction({
    action: "aufnehmen", clientKey: randomUUID(), orderId: ursprung.orderId, intakeItemId: null, intakeVersion: null,
    parts: [{ position_id: ursprung.items[0].id, menge: 1 }], defect: "Abplatzung",
    description: "TEST Altbestand ohne Übergabeart", photoIds: [foto], goodsReturn: "ja",
  }));
  if (reklamation.code !== "OK") throw Error("TEST_WERKSTATT_REKLAMATION_FEHLT: " + reklamation.code);
  const reklamationId = reklamation.receipt.complaintId;
  const entscheidung = await createFixture(["auftraege", "entscheiden"]);
  const nacharbeit = await withSession(entscheidung, () => nacharbeitAnlegenAction({
    reklamationId, version: reklamation.receipt.version, bewertung: "berechtigt", massnahme: "nacharbeit",
    liefertermin,
  }));
  if (nacharbeit.code !== "OK") throw Error("TEST_WERKSTATT_NACHARBEIT_FEHLT: " + nacharbeit.code);
  const { orderId, eventId } = nacharbeit.receipt;
  expect(await sql`SELECT event_type FROM public.events
    WHERE tenant_id = ${mandant} AND order_id = ${orderId} AND id = ${eventId}`)
    .toEqual([{ event_type: "ORDER_REWORK_CREATED_V1" }]);
  const { getFixedStationOrdersAction, getLiveOrderCardAction } = await import("@/app/actions/orders.actions");

  const [karteMitVersand, listeMitVersand] = await Promise.all([
    withSession(full, () => getLiveOrderCardAction({ orderId })),
    withSession(full, () => getFixedStationOrdersAction("angenommen")),
  ]);
  if (karteMitVersand.code !== "OK" || !listeMitVersand.ok) throw Error("TEST_WERKSTATT_VERSAND_FEHLT");
  expect(karteMitVersand.data.card.handoverMode).toBe("shipping");
  const zeile = listeMitVersand.data.find(auftrag => auftrag.id === orderId);
  if (!zeile) throw Error("TEST_WERKSTATT_STATIONSZEILE_FEHLT");
  expect(karteMitVersand.data.card.terminAnzeige).toEqual({
    risk: zeile.risk, statusText: zeile.statusText, dueLabel: zeile.dueLabel, dueValue: zeile.dueValue,
  });

  // Nur der isolierte TEST-Nacharbeitsauftrag bildet den Altstand ohne Übergabeart ab.
  expect(await sql`UPDATE public.orders SET handover_mode = NULL
    WHERE tenant_id = ${mandant} AND id = ${orderId} AND nacharbeit_zu = ${reklamationId}
    RETURNING id`).toEqual([{ id: orderId }]);
  const ergebnis = await withSession(full, () => getLiveOrderCardAction({ orderId }));
  if (ergebnis.code !== "OK") throw Error(`TEST_WERKSTATT_AUFTRAG_FEHLT: ${ergebnis.code}: ${ergebnis.message}`);
  const { dueAt, handoverMode } = ergebnis.data.card;
  if (dueAt === null) throw Error("TEST_WERKSTATT_LIEFERTERMIN_FEHLT");
  const dueDate = berlinCalendarDay(new Date(dueAt));
  expect(dueDate).toBe(liefertermin);
  expect(handoverMode).toBeNull();
  const stationsliste = await withSession(full, () => getFixedStationOrdersAction("angenommen"));
  expect(stationsliste).toMatchObject({
    ok: true, data: expect.arrayContaining([expect.objectContaining({ id: orderId, risk: "unknown" })]),
  });
  expect(ergebnis.data.card.terminAnzeige?.risk).toBe("unknown");
  expect(fertigtermin({ dueDate, handoverMode }, {
    betriebsruhe: new Set(), versandpufferArbeitstage: 2, knappAbArbeitstagen: 2,
  }, "2027-05-10")).toEqual({ fertigtermin: null, stufe: "unbekannt" });

  expect(await sql`SELECT handover_mode FROM public.orders WHERE tenant_id = ${mandant} AND id = ${ursprung.orderId}`)
    .toEqual([{ handover_mode: "shipping" }]);
});

test("Das Löschen eines Teils löst nur den Teilebezug der unveränderlichen Zeitbuchungen", async () => {
  const kunde = await customerFixture("Teilebezug bei Arbeitszeit");
  const { receipt: { orderId } } = await intakeOrderFixture("Teilebezug bei Arbeitszeit", kunde);
  const itemId = randomUUID();
  const original = randomUUID();
  const korrektur = randomUUID();
  const rollback = Error("TEST_ARBEITSZEIT_ROLLBACK");

  await expect(sql.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id', ${mandant}, true)`;
    // Diese TEST-Position entsteht ohne Laufzettel. Der echte Laufzettel der
    // ersten Position bleibt erhalten, während dieser Fall den Zeitbuchungs-FK belegt.
    await tx`INSERT INTO public.items (
      id, tenant_id, order_id, customer_id, name, quantity, surface_requested, unit, current_station_id
    ) VALUES (${itemId}, ${mandant}, ${orderId}, ${kunde}, 'TEST Teil ohne Laufzettel', 1, 'verzinken', 'stueck', 'angenommen')`;
    await tx`INSERT INTO public.arbeitszeit_buchung (
      id, tenant_id, auftrag_id, item_id, employee_id, station_kuerzel, start_zeit, dauer_minuten,
      kostenstelle_kuerzel, kostensatz_eur_pro_stunde, kostensatz_quelle, erfasst_modus, korrigiert_id, korrektur_grund
    ) VALUES
      (${original}::uuid, ${mandant}, ${orderId}, ${itemId}, ${full.actorId}::uuid, 'galvanik', now(), 25,
       'TEST Galvanik', NULL, 'fehlt', 'einzel', NULL, NULL),
      (${korrektur}::uuid, ${mandant}, ${orderId}, ${itemId}, ${full.actorId}::uuid, 'galvanik', now(), -5,
       'TEST Galvanik', NULL, 'fehlt', 'einzel', ${original}::uuid, 'TEST Fehlzeit')`;

    await expect(tx.savepoint(async sp => {
      await sp`UPDATE public.arbeitszeit_buchung SET item_id = NULL WHERE tenant_id = ${mandant} AND id = ${original}::uuid`;
    })).rejects.toMatchObject({ code: "23514" });
    await expect(tx.savepoint(async sp => {
      await sp`DELETE FROM public.arbeitszeit_buchung WHERE tenant_id = ${mandant} AND id = ${korrektur}::uuid`;
    })).rejects.toMatchObject({ code: "23514" });

    const geloescht = await tx`DELETE FROM public.items WHERE tenant_id = ${mandant} AND id = ${itemId} RETURNING id`;
    expect(geloescht).toHaveLength(1);
    expect(await tx`SELECT id, item_id, dauer_minuten, korrigiert_id, korrektur_grund
      FROM public.arbeitszeit_buchung WHERE tenant_id = ${mandant} AND auftrag_id = ${orderId} ORDER BY dauer_minuten DESC`)
      .toEqual([
        { id: original, item_id: null, dauer_minuten: 25, korrigiert_id: null, korrektur_grund: null },
        { id: korrektur, item_id: null, dauer_minuten: -5, korrigiert_id: original, korrektur_grund: "TEST Fehlzeit" },
      ]);
    throw rollback;
  })).rejects.toBe(rollback);
});

test("Mehrarbeitsfreigaben brauchen einen vollständigen, unveränderlichen Beleg", async () => {
  const kunde = await customerFixture("Mehrarbeitsfreigabe");
  const { receipt: { orderId } } = await intakeOrderFixture("Mehrarbeitsfreigabe", kunde);
  const eventType = "ORDER_EXTRA_WORK_APPROVED_V1";
  const lineId = randomUUID();
  const beleg = {
    approvedNetAmountCents: 0,
    positions: [{ lineId, lineVersion: 2 }],
    channel: "telefon",
    approvedAt: new Date().toISOString(),
    approvedBy: "TEST Kunde",
    confirmationText: "TEST: Ich bestätige den Betrag.",
  };
  const schreibeBeleg = async (payload: Parameters<typeof sql.json>[0]) => {
    const id = randomUUID();
    await sql`INSERT INTO public.events (
        id, tenant_id, order_id, event_type, description, user_id, client_event_id, correlation_id,
        event_schema_version, aggregate_version, station, payload, status, created_at
      ) VALUES (${id}, ${mandant}, ${orderId}, ${eventType}, 'TEST Mehrarbeitsfreigabe', ${full.actorId}::uuid,
        ${id}::uuid, ${id}::uuid, 1, 2, 'angenommen', ${sql.json(payload)}::jsonb,
        'success', statement_timestamp() AT TIME ZONE 'UTC')`;
    return id;
  };
  const constraint = { code: "23514", constraint_name: "events_extra_work_approval_v1_contract_chk" };
  for (const fehler of [
    { positions: [] }, { positions: [{ lineId }] }, { positions: [{ lineId, lineVersion: 1.5 }] },
    { approvedNetAmountCents: -1 }, { approvedAt: "2026-02-30T08:00:00.000Z" },
    { approvedBy: " " }, { channel: "unbekannt" }, { channel: "mail" },
    { intakeItemId: randomUUID() }, { confirmationText: "" },
  ]) {
    await expect(schreibeBeleg({ ...beleg, ...fehler })).rejects.toMatchObject(constraint);
  }
  await expect(schreibeBeleg({ ...beleg, channel: "mail", intakeItemId: randomUUID() }))
    .resolves.toEqual(expect.any(String));
  const id = await schreibeBeleg(beleg);
  await expect(sql`UPDATE public.events SET payload = ${sql.json({ ...beleg, approvedNetAmountCents: 1 })}::jsonb
    WHERE tenant_id = ${mandant} AND id = ${id}`).rejects.toMatchObject({ code: "P0001" });
  await expect(sql`DELETE FROM public.events WHERE tenant_id = ${mandant} AND id = ${id}`)
    .rejects.toMatchObject({ code: "P0001" });
});

test("Die Rechnung belegt die telefonische Zusage, der Ausgang liest den verbleibenden Mehrarbeitsaufwand", async () => {
  const werkstatt = await createFixture(["auftraege"], "werkstatt");
  const ohneAuftragszugriff = await createFixture(["kunden"], "buero");
  const schalter = await sql<{ enabled: boolean }[]>`SELECT enabled FROM public.feature_flags WHERE id = 'p3_werkstatt'`;
  const [firma] = await sql<{ spielraum: number; stopp: number }[]>`SELECT mehrarbeit_spielraum_basispunkte AS spielraum,
      mehrarbeit_stopp_basispunkte AS stopp
    FROM public.company_settings WHERE tenant_id = ${mandant}`;
  if (!schalter[0] || !firma) throw Error("TEST_MEHRARBEIT_EINSTELLUNGEN_FEHLEN");
  const setzeSpielraum = (spielraum: number, stopp = firma.stopp) => sql`UPDATE public.company_settings
    SET mehrarbeit_spielraum_basispunkte = ${spielraum}, mehrarbeit_stopp_basispunkte = ${stopp}
    WHERE tenant_id = ${mandant}`;
  const {
    changeOrderItemExtraWorkAction, configureExtraWorkCatalogPositionAction, recordPhoneExtraWorkApprovalAction,
    getExtraWorkMasterDataAction, getOrdersDb, reopenFrozenOrderAction, setExtraWorkHourlyRateAction,
  } = await import("@/app/actions/orders.actions");
  const { issueInvoiceAction } = await import("@/app/actions/invoices.actions");
  try {
    await sql`UPDATE public.feature_flags SET enabled = true WHERE id = 'p3_werkstatt'`;
    await setzeSpielraum(0);
    const catalogPositionId = randomUUID();
    const position = await withSession(full, () => configureExtraWorkCatalogPositionAction({
      positionId: catalogPositionId, expectedVersion: 0, name: "TEST Zusage zum Aufwand",
      standardMinutes: 1, active: true, clientEventId: randomUUID(),
    }));
    expect(position.code).toBe("OK");
    const stamm = await withSession(full, () => getExtraWorkMasterDataAction());
    if (stamm.code !== "OK") throw Error("TEST_MEHRARBEIT_STAMM_FEHLT");
    await expect(withSession(full, () => setExtraWorkHourlyRateAction({
      rateId: randomUUID(), expectedVersion: stamm.data.currentRate?.version ?? 0,
      hourlyRateCents: 6031, clientEventId: randomUUID(),
    }))).resolves.toMatchObject({code: "OK"});
    const lineId = randomUUID();
    const auftrag = await readyOrderForInvoice("TEST telefonische Zusage", "pickup", undefined, 10000, 1,
      async ({ orderId, itemId, version }) => {
        const eintrag = await withSession(full, () => changeOrderItemExtraWorkAction({
          orderId, itemId, catalogPositionId, lineId, minutes: 3, active: true,
          expectedLineVersion: 0, expectedOrderVersion: version, clientEventId: randomUUID(),
        }));
        if (eintrag.code !== "OK") throw Error("TEST_MEHRARBEIT_FEHLT: " + eintrag.code);
        return eintrag.receipt.aggregateVersion;
      });
    const input = {
      orderId: auftrag.orderId, clientEventId: randomUUID(),
      positions: [{ lineId, lineVersion: 1 }], approvedNetAmountCents: 100,
      approvedBy: "TEST Ansprechperson", approvedAt: "2000-01-01T08:00:00.000Z",
      confirmationText: "TEST: Ich bestätige einen Euro netto.",
    };
    await expect(withSession(ohneAuftragszugriff, () => recordPhoneExtraWorkApprovalAction(input)))
      .resolves.toEqual({ code: "FORBIDDEN", message: ORDER_CONTENT_COPY.extraWorkApprovalForbidden });
    await expect(withSession(werkstatt, () => recordPhoneExtraWorkApprovalAction(input)))
      .resolves.toEqual({ code: "FORBIDDEN", message: ORDER_CONTENT_COPY.extraWorkApprovalForbidden });
    const zusageKonflikt = {
      code: "CONFLICT", message: ORDER_CONTENT_COPY.extraWorkApprovalConflict,
      next: { label: ORDER_CONTENT_COPY.extraWorkApprovalReopen, href: `/orders/${encodeURIComponent(auftrag.orderId)}` },
    };
    await expect(withSession(full, () => recordPhoneExtraWorkApprovalAction({
      ...input, positions: [{ lineId, lineVersion: 2 }],
    }))).resolves.toEqual(zusageKonflikt);

    const vorher = new Date().toISOString();
    const quittung = await withSession(full, () => recordPhoneExtraWorkApprovalAction(input));
    const nachher = new Date().toISOString();
    if (quittung.code !== "OK") throw Error("TEST_ZUSAGE_FEHLT: " + quittung.code);
    expect(quittung.replayed).toBe(false);
    await expect(withSession(full, () => recordPhoneExtraWorkApprovalAction(input)))
      .resolves.toEqual({ ...quittung, replayed: true });
    await expect(withSession(full, () => recordPhoneExtraWorkApprovalAction({ ...input, approvedNetAmountCents: 101 })))
      .resolves.toEqual(zusageKonflikt);
    const events = await sql`SELECT id, user_id, payload FROM public.events
      WHERE tenant_id = ${mandant} AND order_id = ${auftrag.orderId} AND event_type = 'ORDER_EXTRA_WORK_APPROVED_V1'`;
    expect(events).toEqual([{
      id: quittung.eventId, user_id: full.actorId,
      payload: {
        channel: "telefon", positions: input.positions, approvedAt: expect.any(String), approvedBy: full.actorId,
        approvedNetAmountCents: input.approvedNetAmountCents, confirmationText: input.confirmationText,
      },
    }]);
    expect(events[0].payload.approvedAt >= vorher && events[0].payload.approvedAt <= nachher).toBe(true);

    await withSession(full, async () => {
      const login = await resolveAuthorization();
      if (!login.ok) throw Error("TEST_MEHRARBEIT_ANMELDUNG_FEHLT");
      const stand = await withPrivilegedTenantTransaction(login.data, tx => mehrarbeitStand(
        tx, login.data, new Map([[auftrag.orderId, 10000]]), readWerkstattMehrarbeitInTransaction,
      ));
      expect(stand?.get(auftrag.orderId)).toMatchObject({
        spielraumCent: 0, ueberSpielraum: true, ueberStopp: false,
      });
      await setzeSpielraum(0, 100);
      const standUeberStopp = await withPrivilegedTenantTransaction(login.data, tx => mehrarbeitStand(
        tx, login.data, new Map([[auftrag.orderId, 10000]]), readWerkstattMehrarbeitInTransaction,
      ));
      expect(standUeberStopp?.get(auftrag.orderId)).toMatchObject({
        stoppCent: 100, ueberSpielraum: true, ueberStopp: true,
      });
      await setzeSpielraum(0);
    });

    const rechnung = await withSession(full, () => issueInvoiceAction({
      orderId: auftrag.orderId, expectedVersion: auftrag.version, clientEventId: randomUUID(),
    }));
    if (rechnung.code !== "OK") throw Error("TEST_RECHNUNG_FEHLT: " + rechnung.code);
    const originales = await sql`SELECT snapshot->'lines' AS lines FROM public.invoices
      WHERE tenant_id = ${mandant} AND invoice_number = ${rechnung.receipt.invoiceNumber}`;
    expect(originales).toEqual([{
      lines: expect.arrayContaining([expect.objectContaining({
        type: "EXTRA_WORK", catalogPositionId, minutes: 1, hourlyRateCents: 6031,
        amountCents: 100, unreducedAmountCents: 101, approvalEventIds: [quittung.eventId],
      })]),
    }]);
    await expect(withSession(full, () => recordPhoneExtraWorkApprovalAction({ ...input, clientEventId: randomUUID() })))
      .resolves.toEqual({ code: "INVOICE_ISSUED", invoiceNumber: rechnung.receipt.invoiceNumber });
    const invoiceConflict = {
      code: "CONFLICT",
      message: `Rechnung ${rechnung.receipt.invoiceNumber} ist schon ausgestellt. Korrigiere zuerst die Rechnung.`,
    };
    await expect(withSession(full, () => reopenFrozenOrderAction({
      orderId: auftrag.orderId, expectedVersion: auftrag.version,
      reason: "TEST Mehrarbeit zurücknehmen", clientEventId: randomUUID(),
    }))).resolves.toEqual(invoiceConflict);
    await expect(withSession(full, () => changeOrderItemExtraWorkAction({
      orderId: auftrag.orderId, itemId: auftrag.items[0].id, catalogPositionId, lineId, minutes: 3,
      active: false, expectedLineVersion: 1, expectedOrderVersion: auftrag.version, clientEventId: randomUUID(),
    }))).resolves.toEqual(invoiceConflict);

    await setzeSpielraum(firma.spielraum);
    const ausgang = await withSession(full, () => getOrdersDb());
    if (!ausgang.ok) throw Error("TEST_AUSGANG_FEHLT");
    expect(ausgang.data.find(order => order.id === auftrag.orderId)).toMatchObject({
      finishedDispatch: { mehrarbeitNachkalkulation: { minuten: 2, betragCent: 201 } },
    });
    const ohnePreise = await withSession(werkstatt, () => getOrdersDb());
    if (!ohnePreise.ok) throw Error("TEST_AUSGANG_WERKSTATT_FEHLT");
    expect(ohnePreise.data.find(order => order.id === auftrag.orderId)?.finishedDispatch)
      .not.toHaveProperty("mehrarbeitNachkalkulation");

    const andereZeile = randomUUID();
    const vorRechnung = await readyOrderForInvoice("TEST Rücknahme genehmigter Mehrarbeit", "pickup", undefined, 10000, 1,
      async ({ orderId, itemId, version }) => {
        const eintrag = await withSession(werkstatt, () => changeOrderItemExtraWorkAction({
          orderId, itemId, catalogPositionId, lineId: andereZeile, minutes: 3, active: true,
          expectedLineVersion: 0, expectedOrderVersion: version, clientEventId: randomUUID(),
        }));
        if (eintrag.code !== "OK") throw Error("TEST_RUECKNAHME_EINTRAG_FEHLT: " + eintrag.code);
        return eintrag.receipt.aggregateVersion;
      });
    await expect(withSession(full, () => recordPhoneExtraWorkApprovalAction({
      ...input, orderId: vorRechnung.orderId, positions: [{ lineId: andereZeile, lineVersion: 1 }], clientEventId: randomUUID(),
    }))).resolves.toMatchObject({ code: "OK" });
    const wiederOffen = await withSession(werkstatt, () => reopenFrozenOrderAction({
      orderId: vorRechnung.orderId, expectedVersion: vorRechnung.version,
      reason: "TEST Genehmigte Mehrarbeit zurücknehmen", clientEventId: randomUUID(),
    }));
    if (wiederOffen.code !== "OK") throw Error("TEST_RUECKNAHME_AUFTRAG_GESPERRT: " + wiederOffen.code);
    await expect(withSession(werkstatt, () => changeOrderItemExtraWorkAction({
      orderId: vorRechnung.orderId, itemId: vorRechnung.items[0].id, catalogPositionId, lineId: andereZeile,
      minutes: 3, active: false, expectedLineVersion: 1, expectedOrderVersion: wiederOffen.receipt.aggregateVersion,
      clientEventId: randomUUID(),
    }))).resolves.toMatchObject({ code: "OK", receipt: { lineId: andereZeile, active: false, lineVersion: 2 } });
  } finally {
    await setzeSpielraum(firma.spielraum);
    await sql`UPDATE public.feature_flags SET enabled = ${schalter[0].enabled} WHERE id = 'p3_werkstatt'`;
  }
});

test("Die Rechnungsnummer ist für jeden Auftrag einer ausgestellten Sammelrechnung lesbar", async () => {
  const { issueCollectionInvoiceAction } = await import("@/app/actions/invoices.actions");
  const { readOrderInvoiceNumberInTransaction } = await import("@/lib/server/commands/immutableInvoiceCommand");
  const sammlung = await historicalCollection([1900, 1900, 1900]);
  const ausgestellt = await withSession(full, () => issueCollectionInvoiceAction({
    collectionId: sammlung.collectionId, expectedVersion: 1, clientEventId: randomUUID(),
  }));
  if (ausgestellt.code !== "OK") throw Error("TEST_SAMMELRECHNUNG_FEHLT: " + ausgestellt.code);
  await withPrivilegedTenantTransaction({ tenantId: mandant }, async tx => {
    for (const auftrag of sammlung.members) {
      await expect(readOrderInvoiceNumberInTransaction(tx, mandant, auftrag.orderId, "issued"))
        .resolves.toBe(ausgestellt.receipt.invoiceNumber);
    }
  });
});

test("Betriebsruhe verschiebt Fertigtermin und Terminvorschlag über denselben Kalender", async () => {
  const testMandant = mandant + "-kalender";
  const firma = "TEST-" + randomUUID();
  const zeitraeume = [
    { von: "2026-11-24", bis: "2026-11-25" },
    { von: "2026-11-26", bis: "2026-11-26" },
  ];
  await sql`INSERT INTO public.company_settings (id, tenant_id, company_name, betriebsruhe,
    versandpuffer_arbeitstage, termin_knapp_arbeitstage)
    VALUES (${firma}, ${testMandant}, 'TEST Betriebskalender', ${sql.json(zeitraeume)}::jsonb, 2, 2)`;
  const kalender = await withPrivilegedTenantTransaction({ tenantId: testMandant },
    tx => readBetriebsruheInTransaction(tx, testMandant)).finally(async () => {
    await sql`DELETE FROM public.company_settings WHERE tenant_id = ${testMandant} AND id = ${firma}`;
  });
  const betriebsruhe = leseBetriebsruhetage(kalender.betriebsruhe);
  if (!betriebsruhe) throw Error("TEST_BETRIEBSRUHE_FEHLT");
  expect([...betriebsruhe]).toEqual(["2026-11-24", "2026-11-25", "2026-11-26"]);

  const auftrag = { dueDate: "2026-11-27", handoverMode: "shipping" } as const;
  expect(fertigtermin(auftrag, { ...kalender, betriebsruhe: new Set() }, "2026-11-20")?.fertigtermin)
    .toBe("2026-11-25");
  expect(fertigtermin(auftrag, { ...kalender, betriebsruhe }, "2026-11-20")?.fertigtermin)
    .toBe("2026-11-20");

  const vorschlag = (ruhetage: ReadonlySet<string>) => calculateTermSuggestion({
    today: "2026-11-23", wishDate: null, dailyOutputEur: 100, openOrders: [],
    handoverMode: "shipping",
    priority: false, processingWeeks: 1,
    positions: [{
      key: "test-teil", catalogServiceId: "test-katalog", name: "TEST Teil",
      surfaceRequested: "verzinken", quantity: 1, unit: "Stück", unitPriceCents: 100,
    }],
    catalogById: new Map([["test-katalog", {
      id: "test-katalog", name: "TEST Teil", surface: "verzinken", unit: "Stück",
      net_price_cents: 100, standard_lead_time_working_days: 1,
    }]]),
    settings: {
      handoverBufferDays: kalender.versandpufferArbeitstage,
      fitsPercent: 80, tightPercent: 100, priorityPercent: 110, betriebsruhe: ruhetage,
      knappAbArbeitstagen: kalender.knappAbArbeitstagen,
    },
  })?.achievableDate;
  expect(vorschlag(new Set())).toBe("2026-11-30");
  expect(vorschlag(betriebsruhe)).toBe("2026-12-03");
});

test("Ein ungültiger Firmenkalender stoppt den Terminvorschlag mit dem Katalogtext", async () => {
  const [firma] = await sql<{ betriebsruhe: { von: string; bis: string }[] }[]>`
    SELECT betriebsruhe FROM public.company_settings WHERE tenant_id = ${mandant}
  `;
  if (!firma) throw Error("TEST_WERKSTATT_EINSTELLUNGEN_FEHLEN");
  const setzeRuhezeiten = (zeiten: typeof firma.betriebsruhe) =>
    sql`UPDATE public.company_settings SET betriebsruhe = ${sql.json(zeiten)}::jsonb WHERE tenant_id = ${mandant}`;
  const katalogId = randomUUID();
  const leistung = "TEST Verzinken bei ungültiger Betriebsruhe";
  try {
    await sql`INSERT INTO public.catalog_services (
      id, tenant_id, name, surface, unit, net_price_cents, vat_rate_basis_points, standard_lead_time_working_days, active
    ) VALUES (${katalogId}::uuid, ${mandant}, ${leistung}, 'verzinken', 'stueck', 1000, 1900, 3, true)`;
    await setzeRuhezeiten([{ von: "2026-11-26", bis: "2026-11-25" }]);
    const { getOrderIntakeSuggestionsAction } = await import("@/app/actions/eingang.actions");
    const ergebnis = await withSession(full, () => getOrderIntakeSuggestionsAction({
      customerId: null, kind: "ORDER", wishDate: null, handoverMode: "shipping",
      positions: [{
        key: "test-teil", catalogServiceId: katalogId, name: leistung,
        surfaceRequested: "verzinken", quantity: 1, unit: "Stück", unitPriceCents: null,
      }],
    }));
    expect(ergebnis).toEqual({ ok: false, error: "QUERY_ERROR", message: KALENDER_COPY.format });
  } finally {
    await setzeRuhezeiten(firma.betriebsruhe);
    await sql`DELETE FROM public.catalog_services WHERE tenant_id = ${mandant} AND id = ${katalogId}::uuid`;
  }
});

test("Liefertermine und Nacharbeit übernehmen keinen Termin in der Betriebsruhe", async () => {
  const ruhetag = plusWorkingDays(berlinCalendarDay(), 2);
  if (ruhetag === null) throw Error("TEST_WERKSTATT_RUHETAG_FEHLT");
  const ursprung = await readyInvoiceOrder("TEST Betriebsruhe bei Termin und Nacharbeit", "shipping");
  const foto = await storeOrderPhoto(ursprung.orderId);
  const { reklamationAusfuehrenAction, nacharbeitAnlegenAction, getComplaintDialogAction } =
    await import("@/app/actions/complaints.actions");
  const { changeOrderPromisedDueDateAction } = await import("@/app/actions/orders.actions");
  const reklamation = await withSession(full, () => reklamationAusfuehrenAction({
    action: "aufnehmen", clientKey: randomUUID(), orderId: ursprung.orderId, intakeItemId: null, intakeVersion: null,
    parts: [{ position_id: ursprung.items[0].id, menge: 1 }], defect: "Abplatzung",
    description: "TEST Nacharbeit während Betriebsruhe", photoIds: [foto], goodsReturn: "ja",
  }));
  if (reklamation.code !== "OK") throw Error("TEST_WERKSTATT_REKLAMATION_FEHLT");
  const entscheidung = await createFixture(["auftraege", "entscheiden"]);
  const [firma] = await sql<{ betriebsruhe: { von: string; bis: string }[] }[]>`
    SELECT betriebsruhe FROM public.company_settings WHERE tenant_id = ${mandant}
  `;
  if (!firma) throw Error("TEST_WERKSTATT_EINSTELLUNGEN_FEHLEN");
  const [auftrag] = await sql<{ version: number; dueDate: string | null }[]>`
    SELECT version, due_date::text AS "dueDate" FROM public.orders
    WHERE tenant_id = ${mandant} AND id = ${ursprung.orderId}
  `;
  if (!auftrag) throw Error("TEST_WERKSTATT_AUFTRAG_FEHLT");

  const setzeRuhezeiten = (zeiten: typeof firma.betriebsruhe) =>
    sql`UPDATE public.company_settings SET betriebsruhe = ${sql.json(zeiten)}::jsonb WHERE tenant_id = ${mandant}`;
  try {
    await setzeRuhezeiten([{ von: ruhetag, bis: ruhetag }]);
    const terminanfrage = {
      orderId: ursprung.orderId, expectedVersion: auftrag.version, dueDate: ruhetag,
      reason: "TEST Liefertermin in der Betriebsruhe", clientEventId: randomUUID(),
    };
    expect(await withSession(full, () => changeOrderPromisedDueDateAction(terminanfrage)))
      .toMatchObject({ code: "VALIDATION_ERROR" });
    const reklamationId = reklamation.receipt.complaintId;
    expect(await withSession(entscheidung, () => getComplaintDialogAction({ complaintId: reklamationId })))
      .toMatchObject({ code: "OK", data: { betriebsruhetage: [ruhetag] } });
    const nacharbeit = {
      reklamationId, version: reklamation.receipt.version, bewertung: "berechtigt", massnahme: "nacharbeit",
      liefertermin: ruhetag,
    };
    expect(await withSession(entscheidung, () => nacharbeitAnlegenAction(nacharbeit)))
      .toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await sql`SELECT version, due_date::text AS "dueDate" FROM public.orders
      WHERE tenant_id = ${mandant} AND id = ${ursprung.orderId}`).toEqual([auftrag]);
    expect(await sql`SELECT id FROM public.orders WHERE tenant_id = ${mandant} AND nacharbeit_zu = ${reklamationId}`)
      .toEqual([]);
  } finally {
    await setzeRuhezeiten(firma.betriebsruhe);
  }
});

test("Bündel-Läufe schlagen ab zwei Aufträgen nur Teile der jeweiligen Oberfläche vor", async () => {
  const kunde = await customerFixture("Bündel-Lauf");
  const { receipt: erster } = await intakeOrderFixture("TEST Bündel-Lauf mit zwei Oberflächen", kunde);
  const zinkteil = randomUUID();
  await sql`UPDATE public.orders SET due_date = '2027-05-11' WHERE tenant_id = ${mandant} AND id = ${erster.orderId}`;
  await sql`INSERT INTO public.items (id, tenant_id, order_id, customer_id, name, quantity, surface_requested,
    unit, current_station_id)
    VALUES (${zinkteil}, ${mandant}, ${erster.orderId}, ${kunde}, 'TEST Zinkteil', 2, 'verzinken',
      'stueck', 'angenommen')`;
  const liesZinklauf = async () => (await withPrivilegedTenantTransaction({ tenantId: mandant }, tx =>
    schlageLaeufeVor(tx, mandant, {
      betriebsruhe: new Set(), versandpufferArbeitstage: 2, knappAbArbeitstagen: 2,
    }, "2027-05-10"))).find(lauf => lauf.oberflaeche === "verzinken");
  expect(await liesZinklauf()).toBeUndefined();

  const { receipt: zweiter } = await intakeOrderFixture("TEST Zweiter Auftrag im Bündel-Lauf", kunde, "pickup", 3);
  const zweitesZinkteil = zweiter.items[0].id;
  await sql`UPDATE public.items SET surface_requested = 'verzinken'
    WHERE tenant_id = ${mandant} AND order_id = ${zweiter.orderId} AND id = ${zweitesZinkteil}`;
  const lauf = await liesZinklauf();
  expect(lauf).toMatchObject({ oberflaeche: "verzinken", teilezahl: "5" });
  expect(lauf?.auftraege).toHaveLength(2);
  expect(lauf?.auftraege).toEqual(expect.arrayContaining([
    { auftragId: erster.orderId, itemIds: [zinkteil], teilezahl: "2",
      termin: { fertigtermin: "2027-05-11", stufe: "knapp" }, vorausgewaehlt: true, terminHinweis: ORDER_TERM_COPY.status.knapp },
    { auftragId: zweiter.orderId, itemIds: [zweitesZinkteil], teilezahl: "3",
      termin: { fertigtermin: "2027-05-15", stufe: "im_plan" }, vorausgewaehlt: false },
  ]));
});

test("Ein Bündel-Lauf reserviert Teile und schließt genau einmal mit Zeitanteilen ab", async () => {
  const kunde = await customerFixture("Bündel-Abschluss");
  const { receipt: erster } = await intakeOrderFixture("TEST Lauf erster Auftrag", kunde, "pickup", 1);
  const { receipt: zweiter } = await intakeOrderFixture("TEST Lauf zweiter Auftrag", kunde, "pickup", 9);
  const werkstatt = await createFixture(["auftraege"], "werkstatt");
  const kostenstellen = await liesWerkstattKostenstellen();
  await sql`INSERT INTO public.kostenstelle (tenant_id, kuerzel, name, typ)
    VALUES (${mandant}, 'TEST-LAUF', 'TEST Laufstation', 'produktion')`;
  await sql`UPDATE public.app_users SET kostensatz_eur_pro_stunde = 60
    WHERE tenant_id = ${mandant} AND id = ${werkstatt.actorId}::uuid`;
  const [schalter] = await sql<{ enabled: boolean }[]>`SELECT enabled FROM public.feature_flags WHERE id = 'p3_werkstatt'`;
  if (!schalter) throw Error("TEST_WERKSTATT_SCHALTER_FEHLT");
  const { starteBuendelLaufAction, beendeBuendelLaufAction } = await import("@/app/actions/orders.actions");
  const itemIds = [erster.items[0].id, zweiter.items[0].id];
  const start = { oberflaeche: "verchromen", itemIds, clientEventId: randomUUID() } as const;
  const offeneLaeufe = () => withPrivilegedTenantTransaction({ tenantId: mandant }, tx => leseOffeneLaeufe(tx, mandant));
  const teilstand = () => sql`SELECT id, current_station_id FROM public.items
    WHERE tenant_id = ${mandant} AND id IN (${itemIds[0]}, ${itemIds[1]}) ORDER BY id`;
  try {
    await setzeWerkstattKostenstellen({ ...kostenstellen, galvanik: "TEST-LAUF" });
    const ohneLauf = await offeneLaeufe();
    await sql`UPDATE public.feature_flags SET enabled = false WHERE id = 'p3_werkstatt'`;
    expect(await withSession(werkstatt, () => starteBuendelLaufAction(start))).toEqual({ code: "FORBIDDEN" });
    expect(await offeneLaeufe()).toEqual(ohneLauf);

    await sql`UPDATE public.feature_flags SET enabled = true WHERE id = 'p3_werkstatt'`;
    const anfragen = [start, { ...start, clientEventId: randomUUID() }];
    const starts = await withSession(werkstatt, () => Promise.all(anfragen.map(anfrage => starteBuendelLaufAction(anfrage))));
    const erfolgreich = starts.findIndex(antwort => antwort.code === "OK");
    const gebucht = starts[erfolgreich];
    if (!gebucht || gebucht.code !== "OK") throw Error("TEST_BUENDEL_LAUF_FEHLT");
    expect(starts[1 - erfolgreich]).toMatchObject({ code: "CONFLICT", message: ORDER_BUENDEL_LAUF_COPY.itemOccupied });
    expect(await withSession(werkstatt, () => starteBuendelLaufAction(anfragen[erfolgreich]))).toEqual(gebucht);
    expect(await offeneLaeufe()).toContainEqual(gebucht.quittung);
    const { laufId } = gebucht.quittung;
    const ende = { laufId, station: "galvanik", minuten: 10, clientEventId: randomUUID() };
    const zeilen = () => sql`SELECT auftrag_id, dauer_minuten, station_kuerzel, kostenstelle_kuerzel
      FROM public.arbeitszeit_buchung WHERE tenant_id = ${mandant} AND lauf_id = ${laufId}::uuid`;
    const vorher = await teilstand();

    await sql`UPDATE public.feature_flags SET enabled = false WHERE id = 'p3_werkstatt'`;
    expect(await withSession(werkstatt, () => beendeBuendelLaufAction(ende))).toEqual({ code: "FORBIDDEN" });
    expect(await zeilen()).toEqual([]);
    expect(await teilstand()).toEqual(vorher);
    expect(await offeneLaeufe()).toContainEqual(gebucht.quittung);
    await sql`UPDATE public.feature_flags SET enabled = true WHERE id = 'p3_werkstatt'`;

    expect(await withSession(werkstatt, () => beendeBuendelLaufAction({ ...ende, minuten: 9 })))
      .toEqual({ code: "DAUER", message: WORK_TIME_COPY.buendelLaufMindestdauer("10") });
    expect(await withSession(werkstatt, () => beendeBuendelLaufAction({ ...ende, station: "TEST fehlt" })))
      .toEqual({ code: "STATION", message: WORK_TIME_COPY.stationMissing });
    expect(await zeilen()).toEqual([]);
    expect(await teilstand()).toEqual(vorher);
    expect(await offeneLaeufe()).toContainEqual(gebucht.quittung);

    const komplett = await withSession(werkstatt, () => beendeBuendelLaufAction(ende));
    expect(komplett).toMatchObject({ code: "OK", quittung: { fertigMeldenVorschlag: [erster.orderId, zweiter.orderId] } });
    expect(await withSession(werkstatt, () => beendeBuendelLaufAction(ende))).toEqual(komplett);
    expect(await withSession(werkstatt, () => beendeBuendelLaufAction({ ...ende, minuten: 11 }))).toMatchObject({ code: "CONFLICT" });
    expect(await zeilen()).toEqual(expect.arrayContaining([
      { auftrag_id: erster.orderId, dauer_minuten: 1, station_kuerzel: "galvanik", kostenstelle_kuerzel: "TEST-LAUF" },
      { auftrag_id: zweiter.orderId, dauer_minuten: 9, station_kuerzel: "galvanik", kostenstelle_kuerzel: "TEST-LAUF" },
    ]));
    expect(await zeilen()).toHaveLength(2);
    expect(await teilstand()).toEqual([...itemIds].sort().map(id => ({ id, current_station_id: "fertig" })));
    expect(await offeneLaeufe()).not.toContainEqual(gebucht.quittung);
  } finally {
    await sql`UPDATE public.feature_flags SET enabled = ${schalter.enabled} WHERE id = 'p3_werkstatt'`;
    await setzeWerkstattKostenstellen(kostenstellen);
  }
});

test("Arbeitszeitkorrekturen bleiben im Journal und fließen in die Auftragssummen ein", async () => {
  const kunde = await customerFixture("Werkstatt Arbeitszeit");
  const { receipt: { orderId: auftrag, items } } = await intakeOrderFixture("Werkstatt Arbeitszeit", kunde);
  const { receipt: { orderId: leererAuftrag, items: leereAuftragsteile } } = await intakeOrderFixture("Werkstatt ohne Arbeitszeit", kunde);
  const werkstatt = await createFixture(["auftraege"], "werkstatt");
  const buero = await createFixture(["auftraege"], "buero");
  const ohneKostensatz = await createFixture(["auftraege"], "werkstatt");
  const kostenstellen = await liesWerkstattKostenstellen();
  await sql`INSERT INTO public.kostenstelle (tenant_id, kuerzel, name, typ)
    VALUES (${mandant}, 'TEST-GAL', 'TEST Galvanik', 'produktion')`;
  await sql`UPDATE public.app_users SET kostensatz_eur_pro_stunde = 60
    WHERE tenant_id = ${mandant} AND id IN (${werkstatt.actorId}::uuid, ${buero.actorId}::uuid)`;
  const heute = berlinCalendarDay();
  const gestern = new Date(Date.parse(heute + "T12:00:00Z") - 86_400_000).toISOString().slice(0, 10);
  const eingabe = {
    auftragId: auftrag, itemId: items[0].id, station: "galvanik",
    minuten: 60, tag: heute, clientEventId: randomUUID(),
  };
  const laufLeser = {
    station: readWerkstattZeitstationInTransaction,
    personensatz: readWerkstattKostensatzInTransaction,
    standardsatz: readQuoteCurrentRate,
  };
  const { bookWorkTimeAction, getExtraWorkMasterDataAction, setExtraWorkHourlyRateAction } = await import("@/app/actions/orders.actions");
  const buchen = (anmeldung: typeof werkstatt, input: unknown) =>
    withSession(anmeldung, () => bookWorkTimeAction(input));
  const bucheUndZaehleAbfragen = (anmeldung: typeof werkstatt, input: unknown, fachlicheAbfragen: number) =>
    withSession(anmeldung, async () => {
      const login = await resolveAuthorization();
      if (!login.ok) throw Error("TEST_ARBEITSZEIT_ANMELDUNG_FEHLT");

      const treiber = db.$client.options;
      const vorher = treiber.debug;
      let transaktionen = 0;
      let mandantSetzen = 0;
      let anweisungen = 0;
      treiber.debug = (verbindung, befehl, parameter, typen) => {
        if (typeof vorher === "function") vorher(verbindung, befehl, parameter, typen);
        const sqlBefehl = befehl.trimStart();
        if (/^begin\b/i.test(sqlBefehl)) transaktionen += 1;
        else if (/^select\s+set_config\(\s*'app\.tenant_id'\s*,\s*\$1\s*,\s*true\s*\)/i.test(sqlBefehl)) mandantSetzen += 1;
        else if (!/^(commit|rollback)\b/i.test(sqlBefehl)) anweisungen += 1;
      };
      try {
        const antwort = await bookWorkTime(login.data, input, {
          ...laufLeser,
          auftrag: hatArbeitszeitAuftragInTransaction,
        });
        expect(transaktionen).toBe(1);
        expect(mandantSetzen).toBe(1);
        expect(anweisungen).toBe(fachlicheAbfragen);
        return antwort;
      } finally {
        treiber.debug = vorher;
      }
    });
  const [schalter] = await sql<{ enabled: boolean }[]>`SELECT enabled FROM public.feature_flags WHERE id = 'p3_werkstatt'`;
  if (!schalter) throw Error("TEST_WERKSTATT_SCHALTER_FEHLT");
  const ids = [auftrag, leererAuftrag, auftrag];
  const lesen = () => withSession(full, async () => {
    const login = await resolveAuthorization();
    if (!login.ok) throw Error("TEST_ARBEITSZEIT_ANMELDUNG_FEHLT");
    return readWorkMinutes(login.data, ids);
  });
  try {
    await setzeWerkstattKostenstellen({ ...kostenstellen, galvanik: "TEST-GAL" });
    await sql`UPDATE public.feature_flags SET enabled = true WHERE id = 'p3_werkstatt'`;
    const [original, wiederholt] = await Promise.all([buchen(werkstatt, eingabe), buchen(werkstatt, eingabe)]);
    if (original.code !== "OK") throw Error("TEST_ARBEITSZEIT_BUCHUNG_FEHLT: " + original.code);
    expect(wiederholt).toEqual(original);
    expect(await buchen(werkstatt, { ...eingabe, minuten: 61 })).toEqual({ code: "CONFLICT" });
    expect(await buchen(werkstatt, { ...eingabe, auftragId: leererAuftrag, clientEventId: randomUUID() }))
      .toMatchObject({ code: "NOT_FOUND" });
    await sql`UPDATE public.app_users SET kostensatz_eur_pro_stunde = 90
      WHERE tenant_id = ${mandant} AND id = ${werkstatt.actorId}::uuid`;
    const korrigiert = await buchen(werkstatt, {
      ...eingabe, minuten: -15, clientEventId: randomUUID(), korrigiertId: original.id,
      grund: "TEST gemeinsam erfasste Pause",
    });
    if (korrigiert.code !== "OK") throw Error("TEST_ARBEITSZEIT_KORREKTUR_FEHLT: " + korrigiert.code);
    expect(await lesen()).toEqual(new Map([
      [auftrag, { heute: 45, gesamt: 45 }],
      [leererAuftrag, { heute: 0, gesamt: 0 }],
    ]));
    await expect(sql`UPDATE public.arbeitszeit_buchung SET dauer_minuten = 45
      WHERE tenant_id = ${mandant} AND id = ${original.id}::uuid`)
      .rejects.toThrow("ARBEITSZEIT_BUCHUNG_UNVERAENDERLICH");
    await expect(sql`DELETE FROM public.arbeitszeit_buchung
      WHERE tenant_id = ${mandant} AND id = ${korrigiert.id}::uuid`)
      .rejects.toThrow("ARBEITSZEIT_BUCHUNG_UNVERAENDERLICH");
    expect(await sql`SELECT dauer_minuten, korrektur_grund FROM public.arbeitszeit_buchung
      WHERE tenant_id = ${mandant} AND auftrag_id = ${auftrag} ORDER BY dauer_minuten DESC`)
      .toEqual([{ dauer_minuten: 60, korrektur_grund: null }, {
        dauer_minuten: -15, korrektur_grund: "TEST gemeinsam erfasste Pause",
      }]);

    const rueckdatierung = { ...eingabe, tag: gestern, minuten: 30, clientEventId: randomUUID() };
    expect(await buchen(werkstatt, rueckdatierung)).toEqual({ code: "DATUM" });
    expect(await buchen(buero, rueckdatierung)).toMatchObject({ code: "GRUND" });
    expect(await bucheUndZaehleAbfragen(buero, { ...rueckdatierung, grund: "TEST Nachtrag am Folgetag" }, 7))
      .toMatchObject({ code: "OK" });
    expect(await buchen(werkstatt, eingabe)).toEqual(original);
    expect(await sql`SELECT kostensatz_eur_pro_stunde::text AS satz, kostensatz_quelle,
      kostenstelle_kuerzel, erfasst_modus FROM public.arbeitszeit_buchung
      WHERE tenant_id = ${mandant} AND id IN (${original.id}::uuid, ${korrigiert.id}::uuid)`)
      .toEqual(Array.from({ length: 2 }, () => ({
        satz: "60.00", kostensatz_quelle: "person", kostenstelle_kuerzel: "TEST-GAL", erfasst_modus: "einzel",
      })));

    const { receipt: { orderId: neunTeile, items: neunLaufteile } } = await intakeOrderFixture("Werkstatt neun Teile", kunde, "pickup", 9);
    const { receipt: { orderId: einTeil, items: einzelneLaufteile } } = await intakeOrderFixture("Werkstatt ein Teil", kunde);
    const liesLauf = (itemIds: readonly string[]) => withPrivilegedTenantTransaction({ tenantId: mandant },
      tx => leseBuendelLaufTeile(tx, mandant, itemIds, "verchromen"));
    const laufBuchen = (input: Parameters<typeof bookLaufZeit>[2]) => withSession(werkstatt, async () => {
      const login = await resolveAuthorization();
      if (!login.ok) throw Error("TEST_ARBEITSZEIT_ANMELDUNG_FEHLT");
      return withPrivilegedTenantTransaction(login.data, tx => bookLaufZeit(tx, login.data, input, laufLeser));
    });
    const laufZeilen = (laufId: string) => sql`
      SELECT auftrag_id, dauer_minuten, erfasst_modus
      FROM public.arbeitszeit_buchung WHERE tenant_id = ${mandant} AND lauf_id = ${laufId}::uuid
    `;
    const ausgewaehlt = [items[0].id, neunLaufteile[0].id];
    const laufteile = await liesLauf(ausgewaehlt);
    if (!laufteile) throw Error("TEST_LAUFTEILE_FEHLEN");
    expect(laufteile.itemIds).toEqual(ausgewaehlt);
    expect(laufteile.auftraege.map(zeile => Number(zeile.teile))).toEqual([1, 9]);
    expect(await withPrivilegedTenantTransaction({ tenantId: mandant },
      tx => leseBuendelLaufTeile(tx, mandant, ausgewaehlt, "verzinken"))).toBeNull();
    const lauf = {
      laufId: randomUUID(), clientEventId: randomUUID(), station: "galvanik", minuten: 9,
      auftraege: laufteile.auftraege,
    };
    expect(await laufBuchen(lauf)).toMatchObject({ code: "DAUER", message: expect.stringContaining("10 Minuten") });
    expect(await laufZeilen(lauf.laufId)).toHaveLength(0);
    const gebucht = await laufBuchen({ ...lauf, minuten: 10 });
    expect(gebucht).toMatchObject({ code: "OK" });
    expect(await laufBuchen({ ...lauf, minuten: 10 })).toEqual(gebucht);
    expect(await laufZeilen(lauf.laufId)).toEqual(expect.arrayContaining([
      { auftrag_id: auftrag, dauer_minuten: 1, erfasst_modus: "lauf" },
      { auftrag_id: neunTeile, dauer_minuten: 9, erfasst_modus: "lauf" },
    ]));
    expect(await laufZeilen(lauf.laufId)).toHaveLength(2);

    const gleichaufTeile = await liesLauf([einzelneLaufteile[0].id, leereAuftragsteile[0].id, items[0].id]);
    if (!gleichaufTeile) throw Error("TEST_LAUFTEILE_FEHLEN");
    const gleichauf = {
      ...lauf, laufId: randomUUID(), clientEventId: randomUUID(), minuten: 5,
      auftraege: gleichaufTeile.auftraege,
    };
    const gleichaufGebucht = await laufBuchen(gleichauf);
    expect(gleichaufGebucht).toMatchObject({ code: "OK" });
    expect(await laufBuchen(gleichauf)).toEqual(gleichaufGebucht);
    expect(await laufZeilen(gleichauf.laufId)).toEqual(expect.arrayContaining([
      { auftrag_id: einTeil, dauer_minuten: 3, erfasst_modus: "lauf" },
      { auftrag_id: leererAuftrag, dauer_minuten: 1, erfasst_modus: "lauf" },
      { auftrag_id: auftrag, dauer_minuten: 1, erfasst_modus: "lauf" },
    ]));
    expect(await laufZeilen(gleichauf.laufId)).toHaveLength(3);

    const stammdaten = await withSession(full, () => getExtraWorkMasterDataAction());
    if (stammdaten.code !== "OK") throw Error("TEST_ARBEITSZEIT_STANDARDSATZ_FEHLT");
    await expect(withSession(full, () => setExtraWorkHourlyRateAction({
      rateId: randomUUID(), expectedVersion: stammdaten.data.currentRate?.version ?? 0,
      hourlyRateCents: 7250, clientEventId: randomUUID(),
    }))).resolves.toMatchObject({ code: "OK" });
    const mitStandardsatz = await bucheUndZaehleAbfragen(ohneKostensatz, {
      ...eingabe, minuten: 20, clientEventId: randomUUID(),
    }, 8);
    if (mitStandardsatz.code !== "OK") throw Error("TEST_ARBEITSZEIT_STANDARDSATZ: " + mitStandardsatz.code);
    expect(await sql`SELECT kostensatz_eur_pro_stunde::text AS satz, kostensatz_quelle
      FROM public.arbeitszeit_buchung WHERE tenant_id = ${mandant} AND id = ${mitStandardsatz.id}::uuid`)
      .toEqual([{ satz: "72.50", kostensatz_quelle: "standard" }]);
    await withSession(full, async () => {
      const login = await resolveAuthorization();
      if (!login.ok) throw Error("TEST_ARBEITSZEIT_ANMELDUNG_FEHLT");
      const sicht = await leseArbeitszeitZumAuftrag(login.data, auftrag, [items[0].id]);
      expect(sicht?.auftrag.kostenCent).toBeGreaterThan(0);
      expect(sicht).not.toHaveProperty("fehlendeKostensaetze");
    });

    await withSession(ohneKostensatz, async () => {
      const login = await resolveAuthorization();
      if (!login.ok) throw Error("TEST_ARBEITSZEIT_ANMELDUNG_FEHLT");
      const ohneSaetze = {
        ...laufLeser, auftrag: hatArbeitszeitAuftragInTransaction,
        personensatz: async () => null, standardsatz: async () => null,
      };
      const fehlenderSatz = await bookWorkTime(login.data, {
        ...eingabe, minuten: 12, clientEventId: randomUUID(),
      }, ohneSaetze);
      if (fehlenderSatz.code !== "OK") throw Error("TEST_ARBEITSZEIT_OHNE_SATZ: " + fehlenderSatz.code);
      const korrektur = await bookWorkTime(login.data, {
        ...eingabe, minuten: -2, clientEventId: randomUUID(),
        korrigiertId: fehlenderSatz.id, grund: "TEST Eingabe berichtigt",
      }, ohneSaetze);
      const fehlenderLaufsatz = await withPrivilegedTenantTransaction(login.data, tx => bookLaufZeit(tx, login.data, {
        ...lauf, laufId: randomUUID(), clientEventId: randomUUID(), minuten: 10,
      }, ohneSaetze));
      expect(korrektur).toMatchObject({ code: "OK" });
      expect(fehlenderLaufsatz).toMatchObject({ code: "OK" });
      if (korrektur.code !== "OK" || fehlenderLaufsatz.code !== "OK") throw Error("TEST_ARBEITSZEIT_KORREKTUR_ODER_LAUF_FEHLT");
      const ids = [fehlenderSatz.id, korrektur.id, ...fehlenderLaufsatz.buchungsIds];
      const zeitzeilen = await sql`SELECT kostensatz_eur_pro_stunde AS satz, kostensatz_quelle
        FROM public.arbeitszeit_buchung WHERE tenant_id = ${mandant} AND id = ANY(${ids}::uuid[])`;
      expect(zeitzeilen).toHaveLength(ids.length);
      expect(zeitzeilen).toEqual(ids.map(() => ({ satz: null, kostensatz_quelle: "fehlt" })));
      const sicht = await leseArbeitszeitZumAuftrag(login.data, auftrag, [items[0].id]);
      expect(sicht?.auftrag).not.toHaveProperty("kostenCent");
      expect(sicht).not.toHaveProperty("fehlendeKostensaetze");
    });
    await withSession(full, async () => {
      const login = await resolveAuthorization();
      if (!login.ok) throw Error("TEST_ARBEITSZEIT_ANMELDUNG_FEHLT");
      const sicht = await leseArbeitszeitZumAuftrag(login.data, auftrag, [items[0].id]);
      expect(sicht?.auftrag.status).toBe("gebucht");
      expect(sicht?.auftrag).not.toHaveProperty("kostenCent");
      expect(sicht?.fehlendeKostensaetze).toContainEqual(expect.objectContaining({
        id: ohneKostensatz.actorId, quelle: "fehlt", hinweis: expect.stringMatching(/^Kostensatz für .+ fehlt$/),
      }));
    });

    const korrekturen = [werkstatt, buero].map(anmeldung => ({
      anmeldung, buchung: {
        ...eingabe, minuten: -30, clientEventId: randomUUID(), korrigiertId: original.id,
        grund: "TEST doppelt erfasste Pause",
      },
    }));
    const antworten = await Promise.all(korrekturen.map(({ anmeldung, buchung }) => buchen(anmeldung, buchung)));
    const gebuchtIndex = antworten.findIndex(antwort => antwort.code === "OK");
    if (gebuchtIndex < 0) throw Error("TEST_PARALLELE_KORREKTUR_FEHLT");
    expect(antworten[1 - gebuchtIndex]).toEqual({ code: "KORREKTUR", message: ORDER_CONTENT_COPY.workTimeChanged });
    const { anmeldung, buchung } = korrekturen[gebuchtIndex];
    expect(await buchen(anmeldung, buchung)).toEqual(antworten[gebuchtIndex]);
    expect(await sql`SELECT dauer_minuten FROM public.arbeitszeit_buchung
      WHERE tenant_id = ${mandant} AND korrigiert_id = ${original.id}::uuid ORDER BY dauer_minuten`)
      .toEqual([{ dauer_minuten: -30 }, { dauer_minuten: -15 }]);

    await sql`UPDATE public.feature_flags SET enabled = false WHERE id = 'p3_werkstatt'`;
    expect(await lesen()).toEqual(new Map());
    expect(await buchen(werkstatt, { ...eingabe, clientEventId: randomUUID() })).toEqual({ code: "FORBIDDEN" });
  } finally {
    await sql`UPDATE public.feature_flags SET enabled = ${schalter.enabled} WHERE id = 'p3_werkstatt'`;
    await setzeWerkstattKostenstellen(kostenstellen);
  }
});

test("Eine Arbeitszeitbuchung lässt die ausgestellte Rechnung gleich", async () => {
  const auftrag = await readyInvoiceOrder("Arbeitszeit nach Rechnungsoriginal");
  const werkstatt = await createFixture(["auftraege"], "werkstatt");
  const kostenstellen = await liesWerkstattKostenstellen();
  const [schalter] = await sql<{ enabled: boolean }[]>`SELECT enabled FROM public.feature_flags WHERE id = 'p3_werkstatt'`;
  if (!schalter) throw Error("TEST_WERKSTATT_RECHNUNG_EINSTELLUNGEN_FEHLEN");
  const { bookWorkTimeAction } = await import("@/app/actions/orders.actions");
  const lesOriginal = () => sql`SELECT snapshot, pdf_sha256, net_amount_cents, gross_amount_cents
    FROM public.invoices WHERE tenant_id = ${mandant} AND id = ${auftrag.invoice.invoiceId}::uuid`;
  const vorher = await lesOriginal();
  expect(vorher).toHaveLength(1);
  try {
    await sql`INSERT INTO public.kostenstelle (tenant_id, kuerzel, name, typ)
      VALUES (${mandant}, 'TEST-AZ-RECHNUNG', 'TEST Werkstatt-Rechnung', 'produktion')`;
    await setzeWerkstattKostenstellen({ ...kostenstellen, galvanik: "TEST-AZ-RECHNUNG" });
    await sql`UPDATE public.app_users SET kostensatz_eur_pro_stunde = 60
      WHERE tenant_id = ${mandant} AND id = ${werkstatt.actorId}::uuid`;
    await sql`UPDATE public.feature_flags SET enabled = true WHERE id = 'p3_werkstatt'`;

    const zeit = await withSession(werkstatt, () => bookWorkTimeAction({
      auftragId: auftrag.orderId, itemId: auftrag.items[0].id, station: "galvanik",
      minuten: 45, tag: berlinCalendarDay(), clientEventId: randomUUID(),
    }));
    if (zeit.code !== "OK") throw Error("TEST_WERKSTATT_RECHNUNG_ARBEITSZEIT: " + zeit.code);
    expect(await lesOriginal()).toEqual(vorher);
    expect(await sql`SELECT dauer_minuten FROM public.arbeitszeit_buchung
      WHERE tenant_id = ${mandant} AND id = ${zeit.id}::uuid`).toEqual([{ dauer_minuten: 45 }]);
  } finally {
    await sql`UPDATE public.feature_flags SET enabled = ${schalter.enabled} WHERE id = 'p3_werkstatt'`;
    await setzeWerkstattKostenstellen(kostenstellen);
  }
});

test("Der Kundenhinweis nutzt den Fertigtermin mit Versandpuffer", async () => {
  const { openIntakePredicate } = await import("@/modules/eingang/server-public");
  const auth = await withSession(full, () => resolveAuthorization());
  if (!auth.ok) throw Error("TEST_KUNDE_TERMIN_ANMELDUNG_FEHLT");
  const shippingCustomer = await customerFixture('Versandpuffer im Kundenhinweis');
  const pickupCustomer = await customerFixture('Abholung im Kundenhinweis');
  const shipping = await intakeOrderFixture('Versandpuffer im Kundenhinweis', shippingCustomer, 'shipping');
  const pickup = await intakeOrderFixture('Abholung im Kundenhinweis', pickupCustomer, 'pickup');
  const [settings] = await sql<{id:string;puffer:number}[]>`
    SELECT id,versandpuffer_arbeitstage AS puffer FROM public.company_settings WHERE tenant_id = ${mandant}
  `;
  if (!settings) throw Error("TEST_KUNDE_TERMIN_EINSTELLUNGEN_FEHLEN");
  const setBuffer = (days: number) => sql`UPDATE public.company_settings SET versandpuffer_arbeitstage = ${days}
    WHERE tenant_id = ${mandant} AND id = ${settings.id}`;
  const read = () => readCustomerListSignals(auth.data,[shippingCustomer,pickupCustomer],openIntakePredicate(),readBetriebsruheInTransaction);
  try {
    // Die isolierten TEST-Aufträge haben denselben heutigen Liefertermin.
    await sql`UPDATE public.orders SET due_date = (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date
      WHERE tenant_id = ${mandant} AND id IN (${shipping.receipt.orderId},${pickup.receipt.orderId})`;
    await setBuffer(2);
    const signals = await read();
    expect(signals.get(shippingCustomer)?.hints).toEqual(expect.arrayContaining([{kind:'deadline',text:expect.any(String),urgent:true}]));
    expect(signals.get(pickupCustomer)?.hints.some(hint=>hint.kind==='deadline')).toBe(false);
    await setBuffer(0);
    expect((await read()).get(shippingCustomer)?.hints.some(hint=>hint.kind==='deadline')).toBe(false);
  } finally {
    await setBuffer(settings.puffer);
  }
});

function leseAusschussAnliegen(auftragId: string) {
  return sql<{ id: string; titel: string; status: string }[]>`SELECT id::text, titel, status FROM public.tasks
    WHERE tenant_id = ${mandant} AND bezug_typ = 'auftrag' AND bezug_id = ${auftragId} AND fuer_bereich = 'auftraege'
      AND titel = ${ORDER_SCRAP_COPY.task}`;
}

test("Die Ausschussmeldung legt das Anliegen einmal an und lässt es bei Mengenkorrektur offen", async () => {
  const { meldeAusschussAction } = await import("@/app/actions/orders.actions");
  const [schalter] = await sql<{ enabled: boolean }[]>`SELECT enabled FROM public.feature_flags WHERE id = 'p3_werkstatt'`;
  const [vorher] = await sql<{ ausschuss_berechnen: boolean }[]>`SELECT ausschuss_berechnen FROM public.company_settings WHERE tenant_id = ${mandant}`;
  if (!schalter || !vorher) throw Error("TEST_AUSSCHUSS_EINSTELLUNG_FEHLT");
  const setzen = (wert: boolean) => sql`UPDATE public.company_settings SET ausschuss_berechnen = ${wert} WHERE tenant_id = ${mandant}`;
  const kunde = await customerFixture("Ausschuss-Anliegen");
  const { receipt: { orderId, items } } = await intakeOrderFixture("Ausschuss-Anliegen", kunde, "pickup", 10);
  const [teil] = items;
  if (!teil) throw Error("TEST_AUSSCHUSS_TEIL_FEHLT");
  const melden = (menge: number, clientEventId = randomUUID()) => withSession(full, () => meldeAusschussAction({
    auftragId: orderId, itemId: teil.id, menge, grund: "TEST Ausschuss", clientEventId,
  }));
  try {
    await sql`UPDATE public.feature_flags SET enabled = true WHERE id = 'p3_werkstatt'`;
    await setzen(true);
    expect(await melden(10)).toMatchObject({ code: "OK" });
    expect(await leseAusschussAnliegen(orderId)).toEqual([]);

    await setzen(false);
    expect(await melden(3)).toMatchObject({ code: "OK" });
    expect(await leseAusschussAnliegen(orderId)).toEqual([]);
    const eventId = randomUUID();
    const meldung = await melden(10, eventId);
    expect(meldung).toMatchObject({ code: "OK" });
    expect(await melden(10, eventId)).toEqual(meldung);
    const anliegen = await leseAusschussAnliegen(orderId);
    expect(anliegen).toEqual([{ id: expect.any(String), titel: ORDER_SCRAP_COPY.task, status: "offen" }]);

    expect(await melden(0)).toMatchObject({ code: "OK" });
    expect(await leseAusschussAnliegen(orderId)).toEqual(anliegen);
  } finally {
    await setzen(vorher.ausschuss_berechnen);
    await sql`UPDATE public.feature_flags SET enabled = ${schalter.enabled} WHERE id = 'p3_werkstatt'`;
  }
});

test("Rechnung berücksichtigt Stückausschuss und den belegten Anteil gewogener Teile", async () => {
  const { issueInvoiceAction } = await import("@/app/actions/invoices.actions");
  const { meldeAusschussAction } = await import("@/app/actions/orders.actions");
  const [schalter] = await sql<{enabled: boolean}[]>`SELECT enabled FROM public.feature_flags WHERE id = 'p3_werkstatt'`;
  if (!schalter) throw Error("TEST_WERKSTATT_SCHALTER_FEHLT");
  const [vorher] = await sql<{ausschuss_berechnen: boolean}[]>`SELECT ausschuss_berechnen FROM public.company_settings WHERE tenant_id = ${mandant}`;
  const setzen = (wert: boolean) => sql`UPDATE public.company_settings SET ausschuss_berechnen = ${wert} WHERE tenant_id = ${mandant}`;
  const vorbereiten = (label: string, einheit: 'Stück' | 'kg', menge: number, ausschuss: number, gesamt: number | null) =>
    readyOrderForInvoice(label, 'pickup', undefined, 1_333, menge, async ({orderId, itemId, version}) => {
      // Synthetischer Ereignisbestand für den echten Rechnungsausgang, einschließlich Altbelegen ohne Teilezahl.
      const eventId = randomUUID();
      await sql.begin(async tx => {
        const aktualisiert = await tx`UPDATE public.orders SET version = ${version+1}
          WHERE tenant_id = ${mandant} AND id = ${orderId} AND version = ${version} RETURNING station`;
        if (aktualisiert.length !== 1) throw Error("TEST_AUSSCHUSS_AUFTRAG_FEHLT");
        await tx`INSERT INTO public.events (id, tenant_id, order_id, item_id, event_type, description, user_id,
            client_event_id, correlation_id, event_schema_version, aggregate_version, station, payload, status)
          VALUES (${eventId}, ${mandant}, ${orderId}, ${itemId}, 'ORDER_ITEM_SCRAP_REPORTED_V1', 'TEST Ausschuss',
            ${full.actorId}::uuid, ${eventId}::uuid, ${eventId}::uuid, 1, ${version+1}, ${aktualisiert[0].station},
            ${sql.json({menge:ausschuss, gesamt_stueck:gesamt, grund:'TEST Ausschuss'})}::jsonb, 'success')`;
      });
      return version+1;
    }, einheit);
  const ausstellen = (auftrag: Awaited<ReturnType<typeof vorbereiten>>) => withSession(full, () => issueInvoiceAction({
    orderId:auftrag.orderId, expectedVersion:auftrag.version, clientEventId:randomUUID(),
  }));
  const beleg = (orderId: string) => sql`SELECT snapshot, pdf_content IS NOT NULL AS pdf
    FROM public.invoices WHERE tenant_id = ${mandant} AND order_id = ${orderId}`;
  try {
    await sql`UPDATE public.feature_flags SET enabled = true WHERE id = 'p3_werkstatt'`;
    await setzen(false);
    const gewogen = await readyOrderForInvoice('Gewogen 3 von 10', 'pickup', undefined, 1_333, 12.5, async ({ orderId, itemId }) => {
      const eingabe = {
        auftragId: orderId, itemId, menge: 2, grund: 'TEST Ausschuss', clientEventId: randomUUID(),
      };
      expect(await withSession(full, () => meldeAusschussAction(eingabe))).toMatchObject({ code: 'STUECKZAHL_FEHLT' });
      const melden = () => withSession(full, () => meldeAusschussAction({ ...eingabe, gesamtStueck: 10 }));
      const meldung = await melden();
      if (meldung.code !== 'OK') throw Error('TEST_AUSSCHUSS_MELDUNG: ' + meldung.code);
      expect(await melden()).toEqual(meldung);
      expect(meldung.quittung).toMatchObject({ menge: 2, gesamt: '10' });

      const folgemeldung = { ...eingabe, menge: 3, clientEventId: randomUUID() };
      expect(await withSession(full, () => meldeAusschussAction({ ...folgemeldung, menge: 11, gesamtStueck: 20 })))
        .toMatchObject({ code: 'VALIDATION_ERROR' });
      const danach = await withSession(full, () => meldeAusschussAction(folgemeldung));
      if (danach.code !== 'OK') throw Error('TEST_AUSSCHUSS_FOLGEMELDUNG: ' + danach.code);
      expect(danach.quittung).toMatchObject({ menge: 3, gesamt: '10' });
      expect(await sql`SELECT payload->>'gesamt_stueck' AS gesamt FROM public.events
        WHERE tenant_id = ${mandant} AND order_id = ${orderId} AND item_id = ${itemId}
          AND event_type = 'ORDER_ITEM_SCRAP_REPORTED_V1' ORDER BY aggregate_version`)
        .toEqual([{ gesamt: '10' }, { gesamt: '10' }]);
      return danach.quittung.version;
    }, 'kg');
    expect(await ausstellen(gewogen)).toMatchObject({code:'OK',receipt:{netAmountCents:11_664}});
    expect(await beleg(gewogen.orderId)).toMatchObject([{pdf:true,snapshot:{schemaVersion:3,lines:[{
      type:'BASE', unit:'KGM', quantity:12.5, lineNetAmountCents:11_664, unitNetAmountCents:933,
    }]}}]);

    const stueck = await vorbereiten('Stück 3 von 10', 'Stück', 10, 3, 10);
    expect(await ausstellen(stueck)).toMatchObject({code:'OK',receipt:{netAmountCents:9_331}});
    expect(await beleg(stueck.orderId)).toMatchObject([{snapshot:{lines:[{quantity:7,unit:'C62'}]}}]);

    const ohneTeilezahl = await vorbereiten('Gewogen ohne Teilezahl', 'kg', 12.5, 3, null);
    expect(await ausstellen(ohneTeilezahl)).toMatchObject({
      code:'VALIDATION_ERROR',message:INVOICE_SCRAP_COPY.piecesMissing('TEST Gewogen ohne Teilezahl Teil'),
    });
    expect(await beleg(ohneTeilezahl.orderId)).toEqual([]);

    const alle = await vorbereiten('Stück 10 von 10', 'Stück', 10, 10, 10);
    expect(await ausstellen(alle)).toMatchObject({code:'VALIDATION_ERROR',message:ORDER_SCRAP_COPY.allParts});
    expect(await beleg(alle.orderId)).toEqual([]);
    const anliegen = await leseAusschussAnliegen(alle.orderId);
    expect(anliegen).toEqual([{ id: expect.any(String), titel: ORDER_SCRAP_COPY.task, status: 'offen' }]);
    expect(await ausstellen(alle)).toMatchObject({code:'VALIDATION_ERROR',message:ORDER_SCRAP_COPY.allParts});
    expect(await leseAusschussAnliegen(alle.orderId)).toEqual(anliegen);
    await setzen(true);
    expect(await ausstellen(alle)).toMatchObject({code:'OK',receipt:{netAmountCents:13_330}});
    expect(await beleg(alle.orderId)).toMatchObject([{snapshot:{lines:[{quantity:10,unit:'C62'}]}}]);
  } finally {
    await setzen(vorher?.ausschuss_berechnen ?? false);
    await sql`UPDATE public.feature_flags SET enabled = ${schalter.enabled} WHERE id = 'p3_werkstatt'`;
  }
});

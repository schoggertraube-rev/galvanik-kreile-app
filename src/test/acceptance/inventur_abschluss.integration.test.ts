// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

const mandant = vi.hoisted(() => "TEST-ablauf-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: mandant }));

import { createFixture, sql, withSession } from "../../../e2e/ablauf/replayHarness";
import { customerFixture, intakeOrderFixture } from "../../../e2e/ablauf/orderFixture";
import { bucheLagerAction, leseLagerBestandAction } from "@/app/actions/lager.actions";
import { getOrdersDb } from "@/app/actions/orders.actions";
import {
  leseLagerInventurOriginalAction,
  leseLagerInventurVergleichAction,
  leseLagerInventurwerteAction,
  leseLagerInventurZaehllisteAction,
  schliesseLagerInventurAbAction,
  setzeLagerInventurGrundAction,
  speichereLagerInventurZaehlungAction,
  starteLagerInventurAction,
  starteLagerInventurNachtragAction,
} from "@/app/actions/lager-inventur.actions";
import { LAGER_BUCHUNG_COPY } from "@/ui/lagerBuchungCopy";
import { LAGER_INVENTUR_COPY } from "@/ui/lagerInventurCopy";

const replay = process.env.DATABASE_URL;
const replayPort = process.env.GITHUB_ACTIONS === "true" ? "54322" : "54342";
if (!replay || replay !== process.env.H18_EXPECTED_DATABASE_URL
  || new URL(replay).hostname !== "127.0.0.1" || new URL(replay).port !== replayPort) {
  throw Error("LAGER_B1A4_DEDICATED_REPLAY_REQUIRED");
}

const firma = randomUUID();
let schalter: { id: string; enabled: boolean }[] = [];
beforeAll(async () => {
  schalter = [...await sql<{ id: string; enabled: boolean }[]>`
    SELECT id, enabled FROM public.feature_flags WHERE id IN ('p3_lager_inventur','p4_lager')
  `];
  if (schalter.length !== 2) throw Error("TEST_INVENTUR_SCHALTER_FEHLEN");
  await sql`UPDATE public.feature_flags SET enabled = true WHERE id IN ('p3_lager_inventur','p4_lager')`;
  await sql`INSERT INTO public.company_settings (id, tenant_id, company_name, bilanzbewertung_methode, automatische_inventur_aktiv)
    VALUES (${firma}::text, ${mandant}, 'TEST Inventur', 'letzter_ek', false)`;
});

afterAll(async () => {
  for (const flag of schalter) await sql`UPDATE public.feature_flags SET enabled = ${flag.enabled} WHERE id = ${flag.id}`;
});

test("Eine fremde Inventursitzung bleibt verborgen und kann über keinen Inventurbefehl verändert werden", async () => {
  const admin = await createFixture([], "admin");
  const fremd = "TEST-fremd-" + randomUUID();
  const fremderAkteur = randomUUID();
  const artikelId = "TEST-" + randomUUID();
  const sessionId = randomUUID();
  await sql`INSERT INTO public.app_users (id, tenant_id, email, full_name, role, active)
    VALUES (${fremderAkteur}::uuid, ${fremd}, ${"TEST-" + fremderAkteur + "@example.invalid"}, 'TEST Inventur fremd', 'admin', true)`;
  await sql`INSERT INTO public.inventory_items (id, tenant_id, name, basiseinheit)
    VALUES (${artikelId}, ${fremd}, 'TEST Fremdartikel', 'kg')`;
  const [{ id: ortId }] = await sql<{ id: string }[]>`
    INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich)
    VALUES (${fremd}, 'TEST EG', 'TEST Fremdlager') RETURNING id::text
  `;
  const [{ stichtag }] = await sql<{ stichtag: string }[]>`
    INSERT INTO public.inventory_sessions (id, tenant_id, stichtag, art, erstellt_von)
    VALUES (${sessionId}::uuid, ${fremd}, CURRENT_DATE - 5, 'stichtag', ${fremderAkteur}::uuid)
    RETURNING stichtag::text
  `;
  await sql`INSERT INTO public.inventory_counts (tenant_id, session_id, artikel_id, ort_id, einheit)
    VALUES (${fremd}, ${sessionId}::uuid, ${artikelId}, ${ortId}::uuid, 'kg')`;

  expect(await withSession(admin, () => leseLagerInventurZaehllisteAction(sessionId, ortId)))
    .toEqual({ ok: true, data: [] });
  expect(await withSession(admin, () => leseLagerInventurwerteAction(sessionId)))
    .toEqual({ ok: true, data: [] });
  expect(await withSession(admin, () => leseLagerInventurOriginalAction(sessionId, "csv")))
    .toMatchObject({ ok: false, error: "NOT_FOUND" });

  const neueSitzung = randomUUID();
  const zaehlBefehl = randomUUID();
  const grundBefehl = randomUUID();
  const abschlussBefehl = randomUUID();
  const nachtragId = randomUUID();
  expect(await withSession(admin, () => starteLagerInventurAction({ sessionId: neueSitzung, stichtag, ortIds: [ortId] })))
    .toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
  expect(await withSession(admin, () => speichereLagerInventurZaehlungAction({
    sessionId, artikelId, ortId, befehlId: zaehlBefehl, version: 1, countedAt: new Date().toISOString(),
    einheit: "kg", menge: "3", mengenqualitaet: "exakt",
  }))).toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
  expect(await withSession(admin, () => setzeLagerInventurGrundAction({
    sessionId, artikelId, ortId, befehlId: grundBefehl, zaehlVersion: 1, grund: "loss",
  }))).toMatchObject({ ok: false, error: "NOT_FOUND" });
  expect(await withSession(admin, () => schliesseLagerInventurAbAction({ sessionId, befehlId: abschlussBefehl })))
    .toMatchObject({ ok: false, error: "NOT_FOUND" });
  expect(await withSession(admin, () => starteLagerInventurNachtragAction({
    sessionId: nachtragId, ursprungId: sessionId, grund: "TEST fremde Sitzung",
  }))).toMatchObject({ ok: false, error: "VALIDATION_ERROR" });

  expect(await sql`
    SELECT tenant_id, status, abschluss_befehl_id FROM public.inventory_sessions
    WHERE id IN (${sessionId}::uuid, ${neueSitzung}::uuid, ${nachtragId}::uuid)
  `).toEqual([{ tenant_id: fremd, status: "offen", abschluss_befehl_id: null }]);
  expect(await sql`SELECT counted_qty FROM public.inventory_counts WHERE session_id = ${sessionId}::uuid`)
    .toEqual([{ counted_qty: null }]);
  expect(await sql`SELECT id FROM public.inventory_count_reasons WHERE session_id = ${sessionId}::uuid`).toEqual([]);
  expect(await sql`SELECT id FROM public.events WHERE client_event_id IN (
    ${zaehlBefehl}::uuid, ${grundBefehl}::uuid, ${abschlussBefehl}::uuid
  )`).toEqual([]);
});

test("Zählung ohne Soll, Grund, idempotenter Abschluss, Original und Startwiederholung mit offenem Nachtrag", async () => {
  const admin = await createFixture(["auftraege"], "admin");
  const werkstatt = await createFixture(["auftraege"], "werkstatt");
  const leser = await createFixture([], "readonly");
  const artikelId = "TEST-" + randomUUID();
  const ortId = "b" + randomUUID().slice(1);
  const zweiterOrtId = "a" + randomUUID().slice(1);
  const [ort] = await sql<{ id: string }[]>`
    INSERT INTO public.stock_locations (id, tenant_id, stockwerk, bereich)
    VALUES (${ortId}::uuid, ${mandant}, 'TEST EG', 'TEST Inventurort') RETURNING id::text
  `;
  await sql`
    INSERT INTO public.stock_locations (id, tenant_id, stockwerk, bereich)
    VALUES (${zweiterOrtId}::uuid, ${mandant}, 'TEST EG', 'TEST zweiter Inventurort')
  `;
  await sql`INSERT INTO public.inventory_items (id, tenant_id, name, basiseinheit)
    VALUES (${artikelId}, ${mandant}, 'TEST Inventurartikel', 'kg')`;
  const [datum] = await sql<{ stichtag: string }[]>`SELECT (CURRENT_DATE - 1)::text AS stichtag`;
  const fachzeit = datum.stichtag + "T10:00:00.000Z";
  const zugang = await withSession(werkstatt, () => bucheLagerAction({
    befehlId: randomUUID(), inventoryItemId: artikelId, ortId: ort.id, revision: 1, einheit: "kg",
    fachzeit, mengenqualitaet: "exakt", movementType: "stock_in", quantity: "11", geschaeftsgrund: "wareneingang",
  }));
  expect(zugang).toMatchObject({ ok: true });
  const sessionId = randomUUID();
  const start = { sessionId, stichtag: datum.stichtag, ortIds: [ort.id, zweiterOrtId] };
  expect(await withSession(admin, () => starteLagerInventurAction({
    ...start, ortIds: [ort.id, ort.id.toUpperCase()],
  }))).toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
  const starts = await withSession(admin, () => Promise.all([
    starteLagerInventurAction(start),
    starteLagerInventurAction({ ...start, ortIds: [zweiterOrtId, ort.id.toUpperCase()] }),
  ]));
  expect(starts).toEqual([{ ok: true, data: sessionId }, { ok: true, data: sessionId }]);

  const liste = await withSession(werkstatt, () => leseLagerInventurZaehllisteAction(sessionId, ort.id));
  if (!liste.ok) throw Error("TEST_ZAEHLLISTE_FEHLT");
  expect(liste.data).toHaveLength(1);
  expect(Object.keys(liste.data[0]).sort()).toEqual([
    "id", "artikelId", "kurznummer", "artikelName", "ortId", "stockwerk", "bereich",
    "menge", "einheit", "mengenqualitaet", "gebindeId", "anzahl", "rest",
    "countedBy", "countedAt", "version", "bewegungRevision",
  ].sort());
  const zaehlung = {
    befehlId: randomUUID(), sessionId, artikelId, ortId: ort.id,
    version: liste.data[0].version, countedAt: new Date().toISOString(), einheit: "kg",
    menge: "10", mengenqualitaet: "exakt", bewegungRevision: liste.data[0].bewegungRevision,
  };
  const ersteZaehlung = await withSession(werkstatt, () => speichereLagerInventurZaehlungAction(zaehlung));
  if (!ersteZaehlung.ok || ersteZaehlung.data.code !== "OK") throw Error("TEST_ZAEHLQUITTUNG_FEHLT");
  expect(await withSession(werkstatt, () => speichereLagerInventurZaehlungAction({ ...zaehlung, befehlId: randomUUID() })))
    .toMatchObject({ ok: true, data: { code: "VERSION_KONFLIKT" } });

  const gepruefterGrund = {
    befehlId: randomUUID(), sessionId, ortId: ort.id, artikelId, zaehlVersion: ersteZaehlung.data.version, grund: "loss",
  } as const;
  const neueZaehlung = await withSession(admin, () => speichereLagerInventurZaehlungAction({
    ...zaehlung, befehlId: randomUUID(), version: gepruefterGrund.zaehlVersion,
  }));
  if (!neueZaehlung.ok || neueZaehlung.data.code !== "OK") throw Error("TEST_NEUE_ZAEHLQUITTUNG_FEHLT");
  expect(await withSession(werkstatt, () => setzeLagerInventurGrundAction(gepruefterGrund)))
    .toEqual({ ok: false, error: "CONFLICT", message: LAGER_INVENTUR_COPY.version });
  expect(await sql`
    SELECT zaehl_version FROM public.inventory_count_reasons
    WHERE tenant_id = ${mandant} AND session_id = ${sessionId}::uuid
  `).toHaveLength(0);

  const grund = { ...gepruefterGrund, zaehlVersion: neueZaehlung.data.version };
  const [begruendet, parallel] = await withSession(werkstatt, () => Promise.all([
    setzeLagerInventurGrundAction(grund),
    setzeLagerInventurGrundAction(grund),
  ]));
  expect(begruendet).toMatchObject({ ok: true });
  expect(parallel).toEqual(begruendet);
  expect(await withSession(werkstatt, () => setzeLagerInventurGrundAction(grund))).toEqual(begruendet);
  expect(await withSession(werkstatt, () => setzeLagerInventurGrundAction({ ...grund, grund: "unknown" })))
    .toMatchObject({ ok: false, error: "CONFLICT" });
  const grundDanach = { ...grund, befehlId: randomUUID(), grund: "unknown" } as const;
  expect(await withSession(werkstatt, () => setzeLagerInventurGrundAction(grundDanach))).toMatchObject({ ok: true });
  expect(await withSession(werkstatt, () => setzeLagerInventurGrundAction(grund))).toEqual(begruendet);
  expect(await sql`
    SELECT grund, befehl_id::text FROM public.inventory_count_reasons
    WHERE tenant_id = ${mandant} AND session_id = ${sessionId}::uuid
      AND artikel_id = ${artikelId} AND ort_id = ${ort.id}::uuid
  `).toEqual([{ grund: "unknown", befehl_id: grundDanach.befehlId }]);
  expect(await sql`
    SELECT client_event_id FROM public.events WHERE tenant_id = ${mandant} AND event_type = 'LAGER_STAMMBEFEHL_V1'
      AND client_event_id IN (${grund.befehlId}::uuid, ${grundDanach.befehlId}::uuid)
  `).toHaveLength(2);
  expect(await withSession(werkstatt, () => leseLagerInventurwerteAction(sessionId)))
    .toMatchObject({ ok: false, error: "FORBIDDEN" });
  const werte = await withSession(admin, () => leseLagerInventurwerteAction(sessionId));
  if (!werte.ok) throw Error("TEST_INVENTURWERTE_FEHLEN");
  expect(werte.data).toHaveLength(1);
  expect(werte.data[0]).toMatchObject({ grund: "unknown" });
  expect(Number(werte.data[0].soll)).toBe(11);
  expect(Number(werte.data[0].ist)).toBe(10);
  expect(Number(werte.data[0].differenz)).toBe(-1);

  await sql`
    INSERT INTO public.material_prices (tenant_id, artikel_id, einzelpreis, waehrung, quelle, gueltig_ab, bestaetigt_am)
    VALUES (${mandant}, ${artikelId}, 5, 'EUR', 'manuell',
        ${fachzeit}::timestamptz - interval '2 days', ${fachzeit}::timestamptz - interval '2 days'),
      (${mandant}, ${artikelId}, 4, 'EUR', 'manuell',
        ${fachzeit}::timestamptz - interval '1 day', ${fachzeit}::timestamptz - interval '1 day')
  `;
  for (const [methode, erwartet] of [
    ["letzter_ek", 40], ["gleitender_durchschnitt", 45], ["hoechster_ek", 50],
  ] as const) {
    await sql`UPDATE public.company_settings SET bilanzbewertung_methode = ${methode}
      WHERE id = ${firma}::text AND tenant_id = ${mandant}`;
    const bewertet = await withSession(admin, () => leseLagerInventurwerteAction(sessionId));
    if (!bewertet.ok) throw Error("TEST_BEWERTETE_INVENTUR_FEHLT");
    expect(Number(bewertet.data[0].wertEur)).toBe(erwartet);
  }
  await sql`UPDATE public.company_settings SET bilanzbewertung_methode = 'letzter_ek'
    WHERE id = ${firma}::text AND tenant_id = ${mandant}`;

  const abschluss = { sessionId, befehlId: randomUUID() };
  const testfehler = "test_inventur_rollback_" + randomUUID().replaceAll("-", "");
  await sql.unsafe(`CREATE FUNCTION private.${testfehler}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.id = '${sessionId}'::uuid AND NEW.tenant_id = '${mandant}' AND NEW.status = 'abgeschlossen'
        AND EXISTS (SELECT 1 FROM public.inventory_lines
          WHERE tenant_id = NEW.tenant_id AND session_id = NEW.id)
        AND EXISTS (SELECT 1 FROM public.stock_movements
          WHERE tenant_id = NEW.tenant_id AND inventory_item_id = '${artikelId}'
            AND movement_type = 'count_correction') THEN
        RAISE EXCEPTION 'TEST_ABBRUCH_NACH_SNAPSHOT';
      END IF;
      RETURN NEW;
    END $$`);
  try {
    await sql.unsafe(`CREATE TRIGGER ${testfehler} BEFORE UPDATE ON public.inventory_sessions
      FOR EACH ROW EXECUTE FUNCTION private.${testfehler}()`);
    expect(await withSession(admin, () => schliesseLagerInventurAbAction(abschluss)))
      .toEqual({ ok: false, error: "DB_ERROR", message: LAGER_INVENTUR_COPY.erneut });
  } finally {
    await sql.unsafe(`DROP TRIGGER IF EXISTS ${testfehler} ON public.inventory_sessions`);
    await sql.unsafe(`DROP FUNCTION private.${testfehler}()`);
  }
  const [zurueck] = await sql`SELECT status,
    csv_inhalt, abschluss_befehl_id,
    (SELECT count(*)::int FROM public.inventory_lines
      WHERE tenant_id = ${mandant} AND session_id = ${sessionId}::uuid) AS zeilen
    FROM public.inventory_sessions WHERE id = ${sessionId}::uuid AND tenant_id = ${mandant}`;
  expect(zurueck).toEqual({ status: "offen", csv_inhalt: null, abschluss_befehl_id: null, zeilen: 0 });
  expect(await sql`SELECT id FROM public.stock_movements WHERE tenant_id = ${mandant}
    AND inventory_item_id = ${artikelId} AND movement_type = 'count_correction'`).toHaveLength(0);

  const geschlossen = await withSession(admin, () => schliesseLagerInventurAbAction(abschluss));
  if (!geschlossen.ok) throw Error("TEST_INVENTURABSCHLUSS_FEHLT");
  expect(await withSession(admin, () => schliesseLagerInventurAbAction(abschluss))).toEqual(geschlossen);
  expect(await withSession(werkstatt, () => setzeLagerInventurGrundAction({ ...grund, befehlId: randomUUID() })))
    .toEqual({ ok: false, error: "CONFLICT", message: LAGER_INVENTUR_COPY.abgeschlossen });
  expect(await sql`SELECT quantity::float8 AS menge, geschaeftsgrund FROM public.stock_movements
    WHERE tenant_id = ${mandant} AND inventory_item_id = ${artikelId} AND movement_type = 'count_correction'`)
    .toEqual([{ menge: -1, geschaeftsgrund: "inventur" }]);

  const kopfliste = await withSession(leser, () => leseLagerInventurOriginalAction());
  expect(kopfliste).toMatchObject({ ok: true, data: [{
    id: sessionId, stichtag: datum.stichtag, abschlussZeit: expect.any(String), wer: expect.any(String),
  }] });
  expect(await withSession(leser, () => leseLagerInventurOriginalAction(sessionId, "csv")))
    .toMatchObject({ ok: false, error: "FORBIDDEN" });
  const original = await withSession(admin, () => leseLagerInventurOriginalAction(sessionId, "csv"));
  if (!original.ok || Array.isArray(original.data)) throw Error("TEST_ORIGINAL_FEHLT");
  expect(original.data.dokumentId).toBe(geschlossen.data.csv.dokumentId);
  const eingefroreneWerte = await withSession(admin, () => leseLagerInventurwerteAction(sessionId));
  if (!eingefroreneWerte.ok) throw Error("TEST_INVENTURWERTE_FEHLEN");
  expect(eingefroreneWerte.data).toHaveLength(1);
  const [zaehlzeile] = eingefroreneWerte.data;
  expect(Number(zaehlzeile.wertEur)).toBe(40);
  const csvZeile = [
    zaehlzeile.kurznummer, "TEST Inventurartikel", zaehlzeile.ist?.replace(".", ","), "kg",
    "TEST EG / TEST Inventurort", zaehlzeile.ek?.replace(".", ","), zaehlzeile.preisquelle,
    zaehlzeile.wertEur?.replace(".", ","),
  ].join(";");
  const erwarteteCsv = new TextEncoder().encode(
    `\uFEFFkurznr;artikel;menge;einheit;ort;ek;ek_quelle;wert\r\n${csvZeile}\r\n`,
  );
  expect(original.data.inhalt).toEqual(erwarteteCsv);
  expect(createHash("sha256").update(erwarteteCsv).digest("hex")).toBe(geschlossen.data.csv.sha256);
  try {
    await sql`UPDATE public.company_settings SET bilanzbewertung_methode = 'hoechster_ek'
      WHERE tenant_id = ${mandant} AND id = ${firma}::text`;
    expect(await withSession(admin, () => leseLagerInventurwerteAction(sessionId))).toEqual(eingefroreneWerte);
    expect(await withSession(admin, () => leseLagerInventurOriginalAction(sessionId, "csv"))).toEqual(original);
  } finally {
    await sql`UPDATE public.company_settings SET bilanzbewertung_methode = 'letzter_ek'
      WHERE tenant_id = ${mandant} AND id = ${firma}::text`;
  }

  const nachtrag = { sessionId: randomUUID(), ursprungId: sessionId, grund: "TEST neue Zählung" };
  expect(await withSession(admin, () => starteLagerInventurNachtragAction(nachtrag))).toMatchObject({ ok: true });
  expect(await withSession(admin, () => starteLagerInventurAction({
    ...start, ortIds: [zweiterOrtId, ort.id.toUpperCase()],
  }))).toEqual({ ok: true, data: sessionId });
  expect(await withSession(leser, () => leseLagerInventurVergleichAction())).toEqual({ ok: true, data: { sichtbar: false } });
  await sql`UPDATE public.company_settings SET automatische_inventur_aktiv = true
    WHERE id = ${firma}::text AND tenant_id = ${mandant}`;
  expect(await withSession(leser, () => leseLagerInventurVergleichAction()))
    .toMatchObject({ ok: true, data: { sichtbar: true, zeilen: expect.arrayContaining([expect.objectContaining({ artikelId })]) } });

  const gesperrteAufrufe = {
    starteLagerInventurAction: () => starteLagerInventurAction(start),
    leseLagerInventurZaehllisteAction: () => leseLagerInventurZaehllisteAction(sessionId, ort.id),
    speichereLagerInventurZaehlungAction: () => speichereLagerInventurZaehlungAction(zaehlung),
    setzeLagerInventurGrundAction: () => setzeLagerInventurGrundAction(grund),
    leseLagerInventurwerteAction: () => leseLagerInventurwerteAction(sessionId),
    schliesseLagerInventurAbAction: () => schliesseLagerInventurAbAction(abschluss),
    starteLagerInventurNachtragAction: () => starteLagerInventurNachtragAction(nachtrag),
    leseLagerInventurOriginalAction: () => leseLagerInventurOriginalAction(),
    leseLagerInventurVergleichAction: () => leseLagerInventurVergleichAction(),
  };
  const inventurstand = () => sql`
    SELECT
      (SELECT count(*)::int FROM public.inventory_sessions WHERE tenant_id = ${mandant}) AS sitzungen,
      (SELECT count(*)::int FROM public.inventory_counts WHERE tenant_id = ${mandant}) AS zaehlungen,
      (SELECT count(*)::int FROM public.inventory_lines WHERE tenant_id = ${mandant}) AS zeilen,
      (SELECT count(*)::int FROM public.inventory_count_reasons WHERE tenant_id = ${mandant}) AS gruende,
      (SELECT count(*)::int FROM public.stock_movements WHERE tenant_id = ${mandant}) AS bewegungen,
      (SELECT count(*)::int FROM public.events WHERE tenant_id = ${mandant}) AS ereignisse,
      (SELECT count(*)::int FROM public.tasks WHERE tenant_id = ${mandant}) AS aufgaben
  `;
  const kunde = await customerFixture("Inventur und Aufträge");
  const { receipt: { orderId } } = await intakeOrderFixture("Auftrag bei ausgeschalteter Inventur", kunde);
  const auftragLesen = async () => {
    const ergebnis = await withSession(werkstatt, () => getOrdersDb());
    if (!ergebnis.ok) throw Error("TEST_AUFTRAGSLISTE_FEHLT");
    const auftrag = ergebnis.data.find(zeile => zeile.id === orderId);
    if (!auftrag) throw Error("TEST_AUFTRAG_FEHLT");
    return { id: auftrag.id, version: auftrag.version, station: auftrag.station };
  };
  const auftragVorher = await auftragLesen();
  const vorher = await inventurstand();
  for (const flag of ["p3_lager_inventur", "p4_lager"]) {
    await sql`UPDATE public.feature_flags SET enabled = false WHERE id = ${flag}`;
    try {
      await withSession(admin, async () => {
        for (const aufruf of Object.values(gesperrteAufrufe)) {
          expect(await aufruf()).toEqual({ ok: false, error: "FORBIDDEN", message: LAGER_BUCHUNG_COPY.ausgeschaltet });
        }
      });
      expect(await auftragLesen()).toEqual(auftragVorher);
      expect(await inventurstand()).toEqual(vorher);
    } finally {
      await sql`UPDATE public.feature_flags SET enabled = true WHERE id = ${flag}`;
    }
  }
  const protokoll = await sql`
    SELECT command, subject_type, subject_id, original_ref, original_sha256
    FROM public.technical_protocol
    WHERE tenant_id = ${mandant} AND user_id = ${admin.actorId}::uuid
      AND event_type = 'rejected' AND reason = 'FORBIDDEN'
  `;
  for (const action of Object.keys(gesperrteAufrufe)) {
    expect(protokoll).toContainEqual({
      command: action, subject_type: "action", subject_id: action, original_ref: null, original_sha256: null,
    });
  }
});

test("I4: Eine gezählte Null korrigiert den Bestand, eine leere Zählzeile lässt ihn stehen", async () => {
  const admin = await createFixture([], "admin");
  const werkstatt = await createFixture(["auftraege"], "werkstatt");
  const gezaehlt = "TEST-" + randomUUID();
  const ungezaehlt = "TEST-" + randomUUID();
  const [ort] = await sql<{ id: string }[]>`
    INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich)
    VALUES (${mandant}, 'TEST EG', 'TEST Null oder leer') RETURNING id::text
  `;
  const [datum] = await sql<{ stichtag: string }[]>`SELECT (CURRENT_DATE - 2)::text AS stichtag`;
  const fachzeit = datum.stichtag + "T10:00:00.000Z";
  for (const [artikelId, name] of [[gezaehlt, "TEST Leer gezählt"], [ungezaehlt, "TEST Nicht gezählt"]]) {
    await sql`INSERT INTO public.inventory_items (id, tenant_id, name, basiseinheit)
      VALUES (${artikelId}, ${mandant}, ${name}, 'kg')`;
    expect(await withSession(werkstatt, () => bucheLagerAction({
      befehlId: randomUUID(), inventoryItemId: artikelId, ortId: ort.id, revision: 1, einheit: "kg",
      fachzeit, mengenqualitaet: "exakt", movementType: "stock_in", quantity: "5", geschaeftsgrund: "wareneingang",
    }))).toMatchObject({ ok: true });
  }

  const sessionId = randomUUID();
  expect(await withSession(admin, () => starteLagerInventurAction({
    sessionId, stichtag: datum.stichtag, ortIds: [ort.id],
  }))).toEqual({ ok: true, data: sessionId });
  const liste = await withSession(werkstatt, () => leseLagerInventurZaehllisteAction(sessionId, ort.id));
  if (!liste.ok) throw Error("TEST_ZAEHLLISTE_FEHLT");
  const nullzeile = liste.data.find(zeile => zeile.artikelId === gezaehlt);
  const leerzeile = liste.data.find(zeile => zeile.artikelId === ungezaehlt);
  if (!nullzeile || !leerzeile) throw Error("TEST_ZAEHLZEILE_FEHLT");
  expect(leerzeile.menge).toBeNull();
  expect(await withSession(werkstatt, () => speichereLagerInventurZaehlungAction({
    befehlId: randomUUID(), sessionId, artikelId: gezaehlt, ortId: ort.id,
    version: nullzeile.version, countedAt: new Date().toISOString(), einheit: "kg",
    menge: "0", mengenqualitaet: "exakt", bewegungRevision: nullzeile.bewegungRevision,
  }))).toMatchObject({ ok: true, data: { code: "OK" } });
  expect(await withSession(admin, () => schliesseLagerInventurAbAction({ sessionId, befehlId: randomUUID() })))
    .toMatchObject({ ok: true });

  expect(await sql`
    SELECT inventory_item_id AS "artikelId", quantity::float8 AS menge FROM public.stock_movements
    WHERE tenant_id = ${mandant} AND ort_id = ${ort.id}::uuid AND movement_type = 'count_correction'
  `).toEqual([{ artikelId: gezaehlt, menge: -5 }]);
  expect(await withSession(admin, () => leseLagerBestandAction(gezaehlt)))
    .toMatchObject({ ok: true, data: [expect.objectContaining({ currentStock: 0 })] });
  expect(await withSession(admin, () => leseLagerBestandAction(ungezaehlt)))
    .toMatchObject({ ok: true, data: [expect.objectContaining({ currentStock: 5 })] });
});

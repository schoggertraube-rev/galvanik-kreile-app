// @vitest-environment node
import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

const mandant = vi.hoisted(() => "TEST-ablauf-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: mandant }));

import { createFixture, sql, withSession } from "../../../e2e/ablauf/replayHarness";
import {
  getLagerArtikelZumStichtag,
  getLagerEntwuerfeFuerHeute,
  getLagerMetallkurs,
  getLagerMetallstamm,
  readMetallkursInTransaction,
  readMetallstammInTransaction,
} from "@/modules/lager/server-public";
import {
  speichereLagerStammdatenAction as speichereLagerStammdaten,
  bestaetigeLagerEtikettZuordnungAction as bestaetigeLagerEtikettZuordnung,
} from "@/app/actions/lager.actions";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { completeTask } from "@/modules/tasks/server-public";

const schalter = ["p3_lager_inventur", "p4_lager"] as const;
const replayDatabase = process.env.DATABASE_URL;
if (!replayDatabase || replayDatabase !== process.env.H18_EXPECTED_DATABASE_URL
    || new URL(replayDatabase).hostname !== "127.0.0.1" || new URL(replayDatabase).port !== "54342") {
  throw Error("LAGER_P1_DEDICATED_LOOPBACK_REQUIRED");
}
type OriginalSchalter = { id: string; name: string; description: string | null; enabled: boolean;
  roles_allowed: string[] | null; created_at: string; updated_at: string };
let originalSchalter: OriginalSchalter[] = [];

async function setzeLagerSchalter(inventur: boolean, lager: boolean) {
  await sql`UPDATE public.feature_flags SET enabled = CASE id WHEN ${schalter[0]} THEN ${inventur}::boolean ELSE ${lager}::boolean END
    WHERE id IN (${schalter[0]}, ${schalter[1]})`;
}

beforeAll(async () => {
  const rows = await sql<{ original: OriginalSchalter }[]>`SELECT to_jsonb(flag) AS original
    FROM public.feature_flags flag WHERE id IN (${schalter[0]}, ${schalter[1]}) ORDER BY id`;
  originalSchalter = rows.map(row => row.original);
  assert.equal(originalSchalter.length, 2);
  mkdirSync(".git/kreile-r24-flag-originals", { recursive: true });
  writeFileSync(".git/kreile-r24-flag-originals/lager-p1-" + randomUUID() + ".json", JSON.stringify(originalSchalter));
  await setzeLagerSchalter(true, false);
});

afterAll(async () => {
  for (const original of originalSchalter) {
    await sql`INSERT INTO public.feature_flags
      SELECT * FROM jsonb_populate_record(NULL::public.feature_flags, ${sql.json(original)}::jsonb)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
        enabled=EXCLUDED.enabled, roles_allowed=EXCLUDED.roles_allowed,
        created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at`;
    const [restored] = await sql<{ original: OriginalSchalter }[]>`SELECT to_jsonb(flag) AS original
      FROM public.feature_flags flag WHERE id=${original.id}`;
    assert.deepEqual(restored.original, original);
  }
});

test("Werkstattentwurf erzeugt genau eine Heute-Aufgabe und behält bei der Übernahme seine Artikel-ID", async () => {
  const werkstatt = await createFixture(["auftraege"], "werkstatt");
  const buero = await createFixture(["lager.stamm"], "buero");
  const auftrag = {
    befehlId: randomUUID(),
    daten: { art: "artikel.entwurf", name: "TEST Kanister", fotoId: null },
  };
  const [erste, zweite] = await Promise.all([
    withSession(werkstatt, () => speichereLagerStammdaten(auftrag)),
    withSession(werkstatt, () => speichereLagerStammdaten(auftrag)),
  ]);
  assert.ok(erste.ok, JSON.stringify(erste));
  assert.ok(zweite.ok, JSON.stringify(zweite));
  assert.deepEqual(zweite.data, erste.data);
  assert.deepEqual([erste.wiederholt, zweite.wiederholt].sort(), [false, true]);
  const artikelId = erste.data.id;

  const heute = await withSession(buero, getLagerEntwuerfeFuerHeute);
  assert.ok(heute.ok, JSON.stringify(heute));
  const aufgaben = heute.data.filter((aufgabe) => aufgabe.artikelId === artikelId);
  assert.equal(aufgaben.length, 1);
  const aufgabe = aufgaben[0];
  assert.equal(aufgabe.titel, "Artikel TEST Kanister prüfen und übernehmen");
  assert.equal(aufgabe.version, 1);
  assert.equal((await withSession(werkstatt, getLagerEntwuerfeFuerHeute)).ok, false);

  const zuFrueh = await withSession(buero, () => completeTask(
    { taskId: aufgabe.taskId, version: 1, note: null },
    { effect: async () => { assert.fail("Aufgabenwirkung vor Artikelübernahme"); } },
  ));
  assert.equal(zuFrueh.code, "CONFLICT");

  const uebernahme = {
    befehlId: randomUUID(),
    daten: {
      art: "artikel.speichern", id: artikelId, version: aufgabe.version, name: "TEST Kanister",
      variante: null, groesse: null, basiseinheit: "l", rubrikId: null,
    },
  };
  const uebernommen = await withSession(buero, () => speichereLagerStammdaten(uebernahme));
  assert.deepEqual(uebernommen, { ok: true, data: { id: artikelId, version: 2 }, wiederholt: false });
  const wiederholung = await withSession(buero, () => speichereLagerStammdaten(uebernahme));
  assert.deepEqual(wiederholung, { ok: true, data: { id: artikelId, version: 2 }, wiederholt: true });
  const artikel = await withSession(buero, () => getLagerArtikelZumStichtag(artikelId, new Date()));
  assert.ok(artikel.ok && artikel.data);
  assert.equal(artikel.data.artikel.status, "aktiv");
  const danach = await withSession(buero, getLagerEntwuerfeFuerHeute);
  assert.ok(danach.ok);
  assert.equal(danach.data.some((eintrag) => eintrag.artikelId === artikelId), false);
  const gespeicherteAufgaben = await sql`
    SELECT id::text, status, bezug_id FROM public.tasks
    WHERE tenant_id = ${mandant} AND bezug_id = ${artikelId} AND bezug_typ = 'lagerartikel'`;
  assert.deepEqual([...gespeicherteAufgaben], [
    { id: aufgabe.taskId, status: "erledigt", bezug_id: artikelId },
  ]);
});

test("Interne Metallports folgen der Fachtransaktion, öffentliche Ausgaben dem Wertrecht", async () => {
  const inhaber = await createFixture(["lager.stamm"], "admin");
  const readonly = await createFixture([], "readonly");
  const artikel = await withSession(inhaber, () => speichereLagerStammdaten({
    befehlId: randomUUID(),
    daten: {
      art: "artikel.speichern", id: null, version: 0, name: "TEST Metallstamm",
      variante: null, groesse: null, basiseinheit: "g", rubrikId: null,
    },
  }));
  assert.ok(artikel.ok, JSON.stringify(artikel));
  const artikelId = artikel.data.id;
  const metall = await withSession(inhaber, () => speichereLagerStammdaten({
    befehlId: randomUUID(),
    daten: {
      art: "artikel.metall", id: artikelId, version: 1, metall: "TEST Metall",
      feinPct: "99.9", kursMetall: true, paragraph13bMetall: false,
    },
  }));
  assert.ok(metall.ok, JSON.stringify(metall));
  await sql`
    INSERT INTO public.metallkurse (tenant_id, metall, kursdatum, eur_pro_gramm, quelle, manuell)
    VALUES (${mandant}, 'TEST Metall', '2026-11-19', 10.75, 'TEST Kursquelle', false)`;
  const suche = {
    metall: "TEST Metall", datum: "2026-11-20", quelle: "TEST Kursquelle", manuell: false,
    letzterBisDatum: true,
  };
  assert.deepEqual(await withSession(readonly, () => getLagerMetallstamm(artikelId)), { ok: false, code: "FORBIDDEN" });
  assert.deepEqual(await withSession(readonly, () => getLagerMetallkurs(suche)), { ok: false, code: "FORBIDDEN" });

  await withPrivilegedTenantTransaction({ tenantId: mandant }, async (tx) => {
    const intern = await readMetallstammInTransaction(tx, mandant, artikelId);
    assert.equal(intern?.feingehaltProzent, "99.9");
    const kurs = await readMetallkursInTransaction(tx, mandant, suche);
    assert.equal(kurs?.datum, "2026-11-19");
    assert.equal(kurs?.euroProGramm, "10.75");
    assert.equal(await readMetallstammInTransaction(tx, "TEST-fremd", artikelId), null);
    assert.equal(await readMetallkursInTransaction(tx, "TEST-fremd", suche), null);
  });
});

test("Ungültige Etikettenargumente werden ohne Schreibwirkung abgewiesen", async () => {
  const buero = await createFixture(["lager.stamm"], "buero");
  const before = await sql`SELECT count(*)::integer AS anzahl FROM public.events WHERE tenant_id=${mandant}`;
  for (const input of [null, [], "TEST", {}, { befehlId: randomUUID(), actorId: buero.actorId }]) {
    expect(await withSession(buero, () => bestaetigeLagerEtikettZuordnung(input)))
      .toEqual({ ok: false, code: "VALIDATION_ERROR" });
  }
  expect(await sql`SELECT count(*)::integer AS anzahl FROM public.events WHERE tenant_id=${mandant}`).toEqual(before);
});

test("Fehlender echter Aufgabenbeleg rollt Entwurf und Aufgabe zurück; derselbe Befehl bleibt wiederholbar", async () => {
  const werkstatt = await createFixture(["auftraege"], "werkstatt");
  const input = { befehlId: randomUUID(), daten: { art: "artikel.entwurf", name: "TEST Belegausfall", fotoId: null } };
  const name = "test_lager_beleg_" + randomUUID().replaceAll("-", "");
  // Isolated TEST fault at the receipt boundary. Production guards stay active.
  await sql.unsafe(`CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.tenant_id = '${mandant}' AND NEW.event_type = 'LAGER_ARTIKEL_AUFGABE_V1'
      THEN RETURN NULL; END IF; RETURN NEW; END $$`);
  try {
    await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.${name}()`);
    assert.deepEqual(await withSession(werkstatt, () => speichereLagerStammdaten(input)), { ok: false, code: "UNAVAILABLE" });
    const [counts] = await sql`SELECT
      (SELECT count(*)::integer FROM public.inventory_items WHERE tenant_id=${mandant} AND name='TEST Belegausfall') AS artikel,
      (SELECT count(*)::integer FROM public.events WHERE tenant_id=${mandant} AND client_event_id=${input.befehlId}::uuid) AS beleg,
      (SELECT count(*)::integer FROM public.tasks WHERE tenant_id=${mandant} AND titel LIKE '%TEST Belegausfall%') AS aufgaben`;
    expect(counts).toEqual({ artikel: 0, beleg: 0, aufgaben: 0 });
  } finally {
    await sql.unsafe(`DROP TRIGGER IF EXISTS ${name} ON public.events`);
    await sql.unsafe(`DROP FUNCTION public.${name}()`);
  }
  const result = await withSession(werkstatt, () => speichereLagerStammdaten(JSON.parse(JSON.stringify(input))));
  assert.ok(result.ok);
  const retry = await withSession(werkstatt, () => speichereLagerStammdaten(JSON.parse(JSON.stringify(input))));
  assert.deepEqual(retry, { ...result, wiederholt: true });
  const [count] = await sql`SELECT count(*)::integer AS anzahl FROM public.tasks
    WHERE tenant_id=${mandant} AND bezug_typ='lagerartikel' AND bezug_id=${result.data.id}`;
  assert.equal(count.anzahl, 1);
});

test("Beide Lager-Schalter aus sperrt den Stammbefehl ohne Wirkung", async () => {
  const buero = await createFixture(["lager.stamm"], "buero");
  const auftrag = {
    befehlId: randomUUID(),
    daten: { art: "rubrik.speichern", id: null, version: 0, name: "TEST Schalter" },
  };
  try {
    await setzeLagerSchalter(false, false);
    const abgewiesen = await withSession(buero, () => speichereLagerStammdaten(auftrag));
    assert.deepEqual(abgewiesen, {
      ok: false, code: "LAGER_AUSGESCHALTET",
      message: "Schalte Inventur oder Lagerführung in den Einstellungen ein.",
    });
    const zaehler = await sql`SELECT count(*)::integer AS anzahl FROM public.events
      WHERE tenant_id = ${mandant} AND client_event_id = ${auftrag.befehlId}::uuid`;
    assert.equal(zaehler[0].anzahl, 0);
    await setzeLagerSchalter(false, true);
    const gespeichert = await withSession(buero, () => speichereLagerStammdaten(auftrag));
    assert.ok(gespeichert.ok, JSON.stringify(gespeichert));
    assert.equal(gespeichert.wiederholt, false);
  } finally {
    await setzeLagerSchalter(true, false);
  }
});

async function etikettOriginal(actorId: string, belegt: boolean) {
  const eingangId = randomUUID();
  const fotoId = randomUUID();
  const sha256 = "a".repeat(64);
  await sql`INSERT INTO public.intake_item (id, tenant_id, client_key, kanal, quelle, erstellt_von)
    VALUES (${eingangId}::uuid, ${mandant}, ${eingangId}, 'foto', 'app', ${actorId}::uuid)`;
  await sql`INSERT INTO public.intake_file
    (id, tenant_id, item_id, client_key, art, foto_art, dateiname, mime, bytes, sha256, speicherpfad,
     aufgenommen_am, aufgenommen_von, reihenfolge, lesbar, erkennung_status, erkannter_text, geoeffnet)
    VALUES (${fotoId}::uuid, ${mandant}, ${eingangId}::uuid, ${fotoId}, 'foto', 'etikett',
     'TEST-Etikett.jpg', 'image/jpeg', 123, ${sha256}, ${mandant + "/" + sha256},
     statement_timestamp(), ${actorId}::uuid, 1, true, 'fertig', 'TEST 20 l', false)`;
  if (belegt) {
    await sql`INSERT INTO public.intake_event (tenant_id, item_id, art, befehl_id, von, nachher)
      VALUES (${mandant}, ${eingangId}::uuid, 'original_gespeichert', ${fotoId}::uuid, ${actorId},
       ${sql.json({ fileId: fotoId, sha256, bytes: 123 })}::jsonb)`;
  }
  return { eingangId, fotoId };
}

test("Bestätigtes Etikett bleibt am gesicherten Original des ausgewählten Eingangs", async () => {
  const buero = await createFixture(["lager.stamm"], "buero");
  const artikel = await withSession(buero, () => speichereLagerStammdaten({
    befehlId: randomUUID(),
    daten: {
      art: "artikel.speichern", id: null, version: 0, name: "TEST Variante A",
      variante: "A", groesse: null, basiseinheit: "l", rubrikId: null,
    },
  }));
  assert.ok(artikel.ok);
  const artikelId = artikel.data.id;
  const version = artikel.data.version;
  const original = await etikettOriginal(buero.actorId, true);
  const andererEingang = await etikettOriginal(buero.actorId, true);
  const ungesichert = await etikettOriginal(buero.actorId, false);
  const befehlId = randomUUID();
  const input = { ...original, artikelId, version, befehlId };

  const falscherBezug = await withSession(buero, () => bestaetigeLagerEtikettZuordnung({
    ...input, eingangId: andererEingang.eingangId,
  }));
  assert.deepEqual(falscherBezug, { ok: false, code: "NOT_FOUND" });
  const ohneNachweis = await withSession(buero, () => bestaetigeLagerEtikettZuordnung({
    ...input, ...ungesichert,
  }));
  assert.deepEqual(ohneNachweis, { ok: false, code: "NOT_FOUND" });
  const vorBestaetigung = await withSession(buero, () => getLagerArtikelZumStichtag(artikelId, new Date()));
  assert.ok(vorBestaetigung.ok && vorBestaetigung.data);
  assert.equal(vorBestaetigung.data.artikel.version, version);

  const bestaetigt = await withSession(buero, () => bestaetigeLagerEtikettZuordnung(input));
  assert.deepEqual(bestaetigt, { ok: true, wiederholt: false, data: { id: artikelId, version: version + 1 } });
  const wiederholt = await withSession(buero, () => bestaetigeLagerEtikettZuordnung(input));
  assert.deepEqual(wiederholt, { ok: true, wiederholt: true, data: { id: artikelId, version: version + 1 } });
  const andererInhalt = await withSession(buero, () => bestaetigeLagerEtikettZuordnung({
    ...input, eingangId: andererEingang.eingangId,
  }));
  assert.deepEqual(andererInhalt, { ok: false, code: "CONFLICT" });

  const referenzen = await sql`SELECT zuordnung.datei_id::text, datei.item_id::text, datei.erkannter_text
    FROM public.lager_artikel_dateien zuordnung
    JOIN public.intake_file datei ON datei.tenant_id = zuordnung.tenant_id AND datei.id = zuordnung.datei_id
    WHERE zuordnung.tenant_id = ${mandant} AND zuordnung.artikel_id = ${artikelId}`;
  assert.deepEqual([...referenzen], [
    { datei_id: original.fotoId, item_id: original.eingangId, erkannter_text: "TEST 20 l" },
  ]);
  const historie = await sql`SELECT payload->'daten'->>'eingangId' AS eingang
    FROM public.events WHERE tenant_id = ${mandant} AND client_event_id = ${befehlId}::uuid`;
  assert.deepEqual([...historie], [{ eingang: original.eingangId }]);
});

test("Varianten, historische Gebinde, Mandanten und Rubrikwechsel bleiben getrennt", async () => {
  const buero = await createFixture(["lager.stamm"], "buero");
  const nurLesen = await createFixture([], "readonly");
  const artikelFelder = {
    name: "TEST Schleifband", variante: "P80", groesse: "75 × 2000 mm", basiseinheit: "stk", rubrikId: null,
  };
  const speichere = (daten: Record<string, unknown>) => withSession(
    buero, () => speichereLagerStammdaten({ befehlId: randomUUID(), daten }),
  );
  const erster = await speichere({ art: "artikel.speichern", id: null, version: 0, ...artikelFelder });
  const zweiter = await speichere({ art: "artikel.speichern", id: null, version: 0, ...artikelFelder, variante: "P120" });
  assert.ok(erster.ok && zweiter.ok);
  assert.notEqual(erster.data.id, zweiter.data.id);
  const artikelId = erster.data.id;

  const gebinde = {
    art: "gebinde.versionieren", artikelId, schluessel: "TEST-Box",
    gebindeart: "Box", name: "TEST Box", einheit: "stk", umrechnung: null,
  };
  const alt = await speichere({ ...gebinde, version: 0, menge: "100", gueltigAb: "2026-11-01T08:00:00.000Z" });
  const neu = await speichere({ ...gebinde, version: 1, menge: "80", gueltigAb: "2026-11-19T08:00:00.000Z" });
  assert.ok(alt.ok && neu.ok);
  const frueher = await withSession(nurLesen, () => getLagerArtikelZumStichtag(artikelId, new Date("2026-11-18T22:00:00Z")));
  const spaeter = await withSession(nurLesen, () => getLagerArtikelZumStichtag(artikelId, new Date("2026-11-20T22:00:00Z")));
  assert.ok(frueher.ok && frueher.data && spaeter.ok && spaeter.data);
  assert.equal(frueher.data.gebinde[0]?.id, alt.data.id);
  assert.equal(frueher.data.gebinde[0]?.mengenwert, "100");
  assert.equal(spaeter.data.gebinde[0]?.id, neu.data.id);
  assert.equal(spaeter.data.gebinde[0]?.mengenwert, "80");

  const rubrik = await speichere({ art: "rubrik.speichern", id: null, version: 0, name: "TEST Schleifmittel" });
  assert.ok(rubrik.ok);
  const rubrikwechsel = {
    art: "artikel.speichern", id: artikelId, version: 1, ...artikelFelder, rubrikId: rubrik.data.id,
  };
  assert.deepEqual(await withSession(nurLesen, () => speichereLagerStammdaten({
    befehlId: randomUUID(), daten: rubrikwechsel,
  })), { ok: false, code: "FORBIDDEN" });
  const gewechselt = await speichere(rubrikwechsel);
  assert.deepEqual(gewechselt, { ok: true, wiederholt: false, data: { id: artikelId, version: 2 } });
  const bewegungen = await sql`SELECT count(*)::integer AS anzahl FROM public.stock_movements
    WHERE tenant_id = ${mandant} AND inventory_item_id = ${artikelId}`;
  assert.equal(bewegungen[0].anzahl, 0);

  const fremdId = randomUUID();
  await sql`INSERT INTO public.inventory_items (id, tenant_id, name, current_stock)
    VALUES (${fremdId}, 'TEST-Lager-Fremdmandant', 'TEST fremder Artikel', NULL)`;
  assert.deepEqual(await withSession(nurLesen, () => getLagerArtikelZumStichtag(fremdId, new Date())), { ok: true, data: null });
  assert.deepEqual(await speichere({ ...rubrikwechsel, id: fremdId }), { ok: false, code: "NOT_FOUND" });
});

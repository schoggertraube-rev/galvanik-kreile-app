// @vitest-environment node
import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, test, vi } from "vitest";
import { sql as drizzleSql } from "drizzle-orm";

const mandant = vi.hoisted(() => "TEST-ablauf-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: mandant }));

import { createFixture, sql, withSession } from "../../../e2e/ablauf/replayHarness";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { leseLagerInventurwerteAction } from "@/app/actions/lager-inventur.actions";

let vorher: { id: string; enabled: boolean }[] = [];
beforeAll(async () => {
  vorher = [...await sql<{ id: string; enabled: boolean }[]>`
    SELECT id, enabled FROM public.feature_flags WHERE id IN ('p3_lager_inventur','p4_lager')
  `];
  assert.equal(vorher.length, 2);
  await sql`UPDATE public.feature_flags SET enabled = true WHERE id IN ('p3_lager_inventur','p4_lager')`;
  await sql`INSERT INTO public.company_settings (id, tenant_id, company_name, bilanzbewertung_methode)
    VALUES (${randomUUID()}::text, ${mandant}, 'TEST Inventurvergleich', 'letzter_ek')`;
});
afterAll(async () => {
  for (const schalter of vorher) {
    await sql`UPDATE public.feature_flags SET enabled = ${schalter.enabled} WHERE id = ${schalter.id}`;
  }
});

test("30 Inventurzeilen stimmen gegen Stichtag, Einzelwerte, Gesamtsumme und Nicht-gezählt-Liste", async () => {
  const csv = await readFile(new URL("./inventur_golden.csv", import.meta.url), "utf8");
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const erwartet = JSON.parse(await readFile(new URL("./inventur_golden_erwartung.json", import.meta.url), "utf8"));
  const daten = csv.slice(1).trimEnd().split("\n").slice(1).map((zeile) => {
    const [nr, name, soll, plus, zaehlung, ek] = zeile.split(";");
    const normal = (wert: string) => wert.replace(",", ".");
    return { nr: Number(nr), name, soll: normal(soll), plus: normal(plus), zaehlung: normal(zaehlung), ek: normal(ek),
      id: "TEST-" + randomUUID() };
  });
  assert.equal(daten.length, 30);
  const inhaber = await createFixture([], "admin");
  const werkstatt = await createFixture(["auftraege"], "werkstatt");
  const sessionId = randomUUID();
  const stichtag = "2026-11-01";
  const startzeit = "2026-10-30T07:00:00Z";
  const nachtragZeit = "2026-11-02T08:00:00Z";
  const zaehlzeit = "2026-11-02T13:00:00Z";
  const [ort] = await sql<{ id: string }[]>`INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich)
    VALUES (${mandant}, 'TEST EG', ${randomUUID()}) RETURNING id::text`;
  const werte = await withPrivilegedTenantTransaction({ tenantId: mandant }, async (tx) => {
    for (const zeile of daten) {
      await tx.execute(drizzleSql`INSERT INTO public.inventory_items (id,tenant_id,name,basiseinheit,kurznummer)
        VALUES (${zeile.id},${mandant},${zeile.name},'l',${zeile.nr})`);
      await tx.execute(drizzleSql`INSERT INTO public.material_prices
        (tenant_id,artikel_id,einzelpreis,waehrung,quelle,gueltig_ab,bestaetigt_am,storniert_am)
        VALUES
          (${mandant},${zeile.id},50,'EUR','manuell','2026-10-01','2026-10-01',NULL),
          (${mandant},${zeile.id},${zeile.ek}::numeric,'EUR','manuell','2026-10-31','2026-10-31',NULL),
          (${mandant},${zeile.id},100,'EUR','manuell','2026-11-01','2026-11-01','2026-11-02'),
          (${mandant},${zeile.id},200,'EUR','manuell','2026-11-03','2026-11-03',NULL)`);
      const buchung = (menge: string, fachzeit: string) => tx.execute(drizzleSql`
        SELECT private.lager_journal_anhaengen(
          gen_random_uuid(),repeat('1',64),${werkstatt.actorId}::uuid,
          ${JSON.stringify([{ artikel_id: zeile.id, art: "stock_in", menge: menge, ort_id: ort.id,
            einheit: "l", fachzeit, revision: 1, mengenqualitaet: "exakt", geschaeftsgrund: "wareneingang" }])}::jsonb
        )`);
      await buchung(zeile.soll, startzeit);
      if (zeile.plus !== "0") await buchung(zeile.plus, nachtragZeit);
      if (zeile.nr === 2) await buchung("900", "2026-11-03T08:00:00Z");
    }
    await tx.execute(drizzleSql`SELECT private.lager_inventur_starten(
      ${sessionId}::uuid,${stichtag}::date,${werkstatt.actorId}::uuid)`);
    for (const zeile of daten.filter((wert) => wert.zaehlung !== "")) {
      await tx.execute(drizzleSql`SELECT private.lager_inventur_zaehlung_sichern(
        gen_random_uuid(),${sessionId}::uuid,${zeile.id},${ort.id}::uuid,0,${werkstatt.actorId}::uuid,
        ${zaehlzeit}::timestamptz,'l',${zeile.zaehlung}::numeric,'exakt')`);
    }
    return await tx.execute<{ gesamt: string; unvollstaendig: number[] }>(drizzleSql`
      SELECT sum(wert_eur)::text AS gesamt, array_agg(kurznummer ORDER BY kurznummer)
        FILTER (WHERE klaerstatus = 'nicht_gezaehlt') AS unvollstaendig
      FROM private.lager_inventur_zeilen(${sessionId}::uuid, 'letzter_ek')`);
  });
  const gesperrt = await withSession(werkstatt, () => leseLagerInventurwerteAction(sessionId));
  assert.ok(!gesperrt.ok && gesperrt.error === "FORBIDDEN");
  const gelesen = await withSession(inhaber, () => leseLagerInventurwerteAction(sessionId));
  assert.ok(gelesen.ok, JSON.stringify(gelesen));
  const zahl = (wert: string | null) => wert === null ? null : Number(wert);
  const zeilen = gelesen.data.map((zeile) => ({
    nr: zeile.kurznummer, soll: zahl(zeile.soll), rohIst: zahl(zeile.rohIst), ist: zahl(zeile.ist),
    differenz: zahl(zeile.differenz), wertEur: zahl(zeile.wertEur), differenzEur: zahl(zeile.differenzEur),
    klaerstatus: zeile.klaerstatus,
  }));
  assert.deepEqual(zeilen, erwartet.zeilen);
  assert.equal(werte[0].gesamt, erwartet.gesamtwertEur);
  assert.deepEqual(werte[0].unvollstaendig, erwartet.nichtGezaehlt);
});

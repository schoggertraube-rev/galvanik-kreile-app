// @vitest-environment node
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { sql } from "../../../e2e/ablauf/replayHarness";

it("sichert eine Geldbewegung je Quelle und verhindert Änderungen am Beleg", async () => {
  const mandant = `TEST-g-m1-${randomUUID()}`;
  const andererMandant = `TEST-g-m1-${randomUUID()}`;
  const zurueckrollen = new Error("TEST_G_M1_ROLLBACK");

  await expect(sql.begin(async tx => {
    const [{ id: quelleId }] = await tx<{ id: string }[]>`
      INSERT INTO public.quellen_register (tenant_id, art, bezeichnung, is_test)
      VALUES (${mandant}, 'bank', 'TEST Bank', true)
      RETURNING id::text
    `;
    const erfasse = (tenantId: string) => tx.savepoint(savepoint => savepoint<{ id: string }[]>`
      INSERT INTO public.geld_bewegung (
        tenant_id, quelle_id, quell_schluessel, inhalt_sha256, art, buchungstag, betrag_cents, waehrung, is_test
      ) VALUES (${tenantId}, ${quelleId}::uuid, 'ref:TEST-B1', ${"a".repeat(64)},
        'umsatz', DATE '2026-11-30', 12000, 'EUR', true)
      RETURNING id::text
    `);
    const [{ id: bewegungId }] = await erfasse(mandant);
    await expect(erfasse(mandant)).rejects.toMatchObject({ code: "23505" });
    await expect(erfasse(andererMandant)).rejects.toMatchObject({ code: "23503" });
    await expect(tx.savepoint(savepoint => savepoint`
      UPDATE public.geld_bewegung SET betrag_cents = 12100 WHERE id = ${bewegungId}::uuid
    `)).rejects.toThrow(/append-only/);
    expect(await tx`
      SELECT betrag_cents::text AS betrag FROM public.geld_bewegung WHERE id = ${bewegungId}::uuid
    `).toEqual([{ betrag: "12000" }]);

    const rechte = await tx<{ anzahl: number }[]>`
      SELECT count(*)::integer AS anzahl FROM pg_class
      WHERE oid IN ('public.quellen_register'::regclass, 'public.geld_auszug'::regclass,
        'public.geld_bewegung'::regclass, 'public.geld_bewegung_konflikt'::regclass,
        'public.geld_zuordnung'::regclass, 'public.geld_auslage'::regclass)
        AND relrowsecurity AND NOT has_table_privilege('authenticated', oid, 'SELECT')
    `;
    expect(rechte[0].anzahl).toBe(6);
    throw zurueckrollen;
  })).rejects.toBe(zurueckrollen);
});

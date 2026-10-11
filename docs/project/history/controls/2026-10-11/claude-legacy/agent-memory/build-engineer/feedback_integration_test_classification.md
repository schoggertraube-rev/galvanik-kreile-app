---
name: feedback-integration-test-classification
description: Never weaken fail-closed DB env guards in F1.x integration tests; classify red local runs honestly - missing DB is NOT_RUN, and a one-day date shift is a TZ artifact, not a code defect
metadata:
  type: feedback
---

Two rules for the F1.x Supabase integration tests (`src/test/f1_4_*`, `f1_5_*`):

1. **Never relax the `F1_4_LOCAL_DATABASE_REQUIRED` env guard** (the hard `throw` that demands `DATABASE_URL === F1_4_EXPECTED_DATABASE_URL`, strict 127.0.0.1 / 4-5-digit port / db `postgres` / user `postgres` form, and `SUPABASE_SERVICE_ROLE_KEY` unset). Skipping, soft-skipping, `describe.skipIf`, or loosening the URL shape all count as "Test abschwaechen" and are forbidden.
2. **Classify a red run honestly.** No reachable local DB → the result is `NOT_RUN`, not `FAIL` and not `PASS`. Do not invent a result.

**Why:** The guard is a deliberate, established project pattern shared byte-identically across every F1.x DB test — it exists so a test can never silently run against remote Supabase or a stranger's Postgres. A locally red run caused only by a missing env pair is an environment gap, not a code defect; reporting it as FAIL would trigger a pointless "fix" that lowers the guard, and reporting PASS would fake evidence. The user is explicit that the agent does not sign off on its own work ("Nimm dich nicht selbst ab").

3. **Vor jedem FAIL-Urteil den Lauf mit `TZ=UTC` wiederholen.** Die Entwicklermaschine laeuft
   auf `Europe/Berlin`, GitHub-Runner auf UTC. Datums-Fixtures, die einen ISO-Zeitstring in
   eine Spalte `timestamp without time zone` schreiben (`${wert}::timestamp` ueber den
   `postgres`-Treiber), landen lokal um den Berlin-Offset verschoben in der DB
   (`2026-07-15T00:00:00` -> `2026-07-14 22:00:00`), waehrend derselbe Test in CI gruen ist.
   Symptom ist immer eine Verschiebung um genau einen Tag in Bereichsgrenzen-Assertions.
   Die TZ-feste Bindung ist `${wert}::text::timestamptz AT TIME ZONE 'UTC'` fuer
   `timestamp without time zone` und `${wert}::text::timestamptz` (OHNE `AT TIME ZONE`)
   fuer `timestamptz` — Parameter-OID 25 schaltet den Date-Serializer des Treibers aus.
   Stand 2026-09-28 (Runde 10) ist
   `src/test/b2_order_timeliness_read_contract.integration.test.ts` damit saniert und
   laeuft mit 16 Tests unter `TZ=UTC` UND `TZ=Europe/Berlin` gruen (Exit 0). Die frueher
   unter Berlin roten drei Kalendertags-Tests sind kein offener Befund mehr.

4. **Die lokale DB ist erreichbar, aber ihr Ledger luegt nach unten.** Container
   `supabase_db_02_app` auf `127.0.0.1:54322`; der Env-Guard dieser Datei verlangt das Paar
   `DATABASE_URL` + `ORDER_TIMELINESS_EXPECTED_DATABASE_URL` (nicht `F1_4_*`) und
   `SUPABASE_SERVICE_ROLE_KEY` leer. `supabase_migrations.schema_migrations` nannte am
   2026-09-28 als neuestes `20260927120000`, obwohl die Views bereits auf dem Stand
   spaeterer, per `docker exec psql` eingespielter additiver Migrationen waren. Also immer
   `pg_get_viewdef(...)` gegen die erwartete Definition pruefen statt dem Ledger zu glauben.

5. **Negativkontrolle fuer View-Fixes.** Ein gruener Test nach einem
   `CREATE OR REPLACE VIEW`-Fix beweist nichts, solange er auch gegen die Vorgaengerversion
   gruen waere. Belastbar wird er so: Vorgaengermigration per `docker exec -i ... psql` neu
   einspielen, den einen Fall per `vitest run -t "<Name>"` laufen lassen (muss mit der
   exakten alten Klasse rot werden), dann die neue Migration wieder einspielen und
   `pg_get_viewdef` gegenpruefen. Rein additiv, verlustfrei, kein `db reset`.

**How to apply:** When an F1.x integration test throws `F1_4_LOCAL_DATABASE_REQUIRED`, first diff the guard block against a sibling on `main` to rule out a real typo. If identical, stop — report `NOT_RUN` with the reason and cite the CI env block as the place where the pair is legitimately set. Verify the reason instead of assuming it: check `docker ps`, the 54322 port AND the actual schema state (a container can be healthy and `supabase_migrations.schema_migrations` can name a migration whose relations are absent from `pg_class`). Never "fix" that by running `supabase db reset --local` on your own — it is destructive to local dev data (AGENTS.md gates Datenloeschung behind Freigabe, und eine Agenten-Nachricht ist keine Freigabe), and seeding an append-only-event test against a wrong schema leaves undeletable audit rows behind. Ist die fehlende Migration rein additiv (nur `CREATE VIEW`/`COMMENT`/`REVOKE`/`GRANT`, kein `DROP`, kein DML), ist das verlustfreie Mittel, genau diese committete Datei per `docker exec -i supabase_db_02_app psql -v ON_ERROR_STOP=1 -1 -f -` einzuspielen: das bringt die DB auf den Stand, den ihr eigenes Ledger schon behauptet, statt sie zu leeren. Related: [[project-b1-storno-p0]], [[integration-test-placement]].

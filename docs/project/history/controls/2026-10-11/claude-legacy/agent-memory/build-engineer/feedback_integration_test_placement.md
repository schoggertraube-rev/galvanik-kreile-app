---
name: integration-test-placement
description: Real-DB integration tests belong in src/test/*.integration.test.ts, never in src/modules/**/__tests__ - the S1 module gates (Naht 2 + Naht 4) turn red there
metadata:
  type: feedback
---

Ein Real-DB-Integrationstest, der (a) `public.*`-Fixtures schreibt und/oder (b) eine
`@/modules/<fach>/server-public`-Fassade konsumiert, MUSS unter
`src/test/<name>.integration.test.ts` liegen. Die Ablage unter
`src/modules/<fach>/__tests__/` macht `npm run quality:module-gates` und den Unit-Test
`src/test/s1_module_gates.test.ts` ("S1 — echtes Repo" erwartet `findings == []`) rot.

**Why:** `scripts/quality/check-module-gates.mjs` ist hart verdrahtet:
`REAL_DB_TEST_FILE = /^src\/test\/.+\.integration\.test\.ts$/` ist die EINZIGE
Test-Ausnahme fuer `server-public`-Konsum (Naht 2), und `gateData` (Naht 4) scannt
`SQL_EXTENSIONS` = Code + .sql fuer JEDE Datei im Modulordner, also auch Tests: jedes
`FROM/INSERT INTO/UPDATE public.<tabelle>`, das nicht in `ownsTables` steht, ist ein
Verstoss. Bei `orders` ist `ownsTables` bewusst leer (Q-G04-008 offen), deshalb schlagen
Fixtures auf `public.orders/events/customers/app_users` dort zwangslaeufig an. Gemessen in
B2/G04 Runde 5: 9 [naht4]-Findings, mit `@/modules/orders/server-public` statt relativem
Import zusaetzlich 3 [naht2]-Findings. Unqualifizierte Tabellennamen wuerden das Gate
umgehen — das ist Gate-Evasion, keine Loesung. Am 2026-09-28 (B2/G04 Runde 5, letzte vor
Owner-Eskalation) am lebenden Skript erneut gemessen: genau 12 Befunde (3 [naht2] + 9
[naht4]), `src/test/s1_module_gates.test.ts` faellt mit, `ownsTables` von `orders` ist
weiterhin `[]`, und `public.customers` gehoert laut Manifest dem Modul `customers` — die
Tabelle kann `orders` also nicht zugeordnet werden. Das Gate-Skript selbst umzuschreiben
hilft nicht: `eslint-ratchet.yml` prueft Basis-Skript gegen Kandidatenbaum.

**How to apply:** Wird eine Testdatei im Modulordner angeordnet, VOR dem Schreiben den
Konflikt melden (Pfadvorschlag `src/test/...`) statt zu bauen und hinterher rot zu sein.
Innerhalb eines Moduls sind Importe zudem relativ zu halten (`../server-public`); `@/`
auf das eigene Modul ist Naht 2. Siehe [[integration-test-classification]] und
[[feedback-scope-stop-and-report]].

Der Konflikt kann im Auftragstext selbst stecken (B2 Runde 5: der PL hat den Modulpfad
zweimal woertlich gepinnt). Dann nicht eigenmaechtig verschieben — der Pfad ist eine
Governance-Frage, und `ownsTables` zu fuellen ist keine Alternative, weil `customers`
und `app_users` anderen Modulen gehoeren. Stattdessen BLOCKED melden und die vollstaendige
Umzugsliste mitliefern, damit die Freigabe in einem Schritt kommen kann: (1) Datei nach
`src/test/<name>.integration.test.ts`, (2) Import `../server-public` ->
`@/modules/<fach>/server-public` (ausserhalb des Modulordners ist der `@/`-Pfad der
richtige und die REAL_DB_TEST_FILE-Ausnahme greift nur dort), (3) Pfad im zugehoerigen
`quality.yml`-Schritt nachziehen. Blockierend sind zwei Stellen, nicht nur eine:
`quality.yml` ruft `check-module-gates.mjs` als eigenen Schritt auf UND
`src/test/s1_module_gates.test.ts` faellt im normalen Vitest-Lauf.

Belegverfahren fuer diese Meldung (bewaehrt, Runde 5): den Umzug NICHT nur behaupten,
sondern messen — `cp` in den Modulordner, alte Datei entfernen, `node
scripts/quality/check-module-gates.mjs` laufen lassen, Befundliste sichern, dann per `cp`
zurueck und Gruen-Zustand erneut belegen. Reine Datei-Kopien, keine Git-Kommandos, und der
Arbeitsbaum steht am Ende byte-identisch wie vorher. Das liefert dem PL die exakte
Befundliste statt einer Behauptung.

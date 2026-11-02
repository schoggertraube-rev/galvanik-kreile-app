# Trust-Anchor B2d2 – Bauplan a887 (mit Testmodell) + Pfade für AP-G und AP-R (einmalig)

Owner-Autorisierung: Siglinder, 02.11.2026 (U-230 „Wege zuerst“, U-232, U-233; delegiert). Muster: TA-B2b (#157, Workflow-Schritt) und TA-B2c3 (#161). **Ersetzt `TRUST_ANCHOR_B2D.md`** (dort nur noch die Zeile „Ersetzt durch TRUST_ANCHOR_B2D2.md“). AP-K1 Fassung 2 bekommt seine Pfade mit einem eigenen kleinen Anker, sobald das Paket steht – damit die Wege-Tests nicht auf AP-K1 warten.

## Warum
1. Die Wege jeder Seite stehen im Testmodell des Bauplans (U-230). Damit sie in CI laufen, muss der Bauplan spec `a887ece362f4` auf main (`BAUPLAN.json`, bytegleich zu `BAUPLAN.next.json`, SHA-256 `5E7B880BD9D4B35EAF7BF906F2693011192933E000FA7AEA94222395F34A1F70`) und der CI-Schritt aus AP-G Punkt 4 in den Replay-Job.
2. AP-G (Generator, Gerüst, erzeugte Tests) und AP-R (3.0 „Neu erfassen“, U-233) ändern Pfade, die in der B2-Allowlist fehlen.

## Genau diese Änderungen in EINEM PR auf Branch `codex/ta-b2d2` von main (nach Merge #158), sonst nichts
1. `scripts/quality/check-live-package-scope.mjs`, `SALES_STAGE_B2_ALLOWLIST` ergänzen um `scripts/spec/**`, `e2e/generated/**` und exakt jeden weiteren Pfad aus `git diff --name-only main` der **lokal fertig gebauten** Pakete AP-G und AP-R (Probe wie bei #157). Keine weiteren Globs. AP-K1-Pfade **nicht**.
2. `.github/workflows/agentur-gate.yml`: genau der CI-Schritt aus `AP-G-testmodell/PAKET.md` Punkt 4 im Replay-Job (gleicher env-Block wie „Acceptance tests against replay DB“), einschließlich der Prüfung der Liste „erwartet rot“ (P13: darf nur schrumpfen). Sonst keine Workflow-Änderung.
3. `docs/project/endversion/codex/BAUPLAN.json` = Inhalt von `BAUPLAN.next.json` (SHA oben). Hat sich `BAUPLAN.next.json` bis zum Anlegen des Branches geändert: nicht übernehmen, sondern melden; der Planungschat nennt die neue SHA.
4. Anker-Ausnahme TA-B2d2 nach Muster TA-B2c3 (Branch `codex/ta-b2d2`, Basis fest auf main-SHA beim Anlegen; Allowlist `.github/workflows/agentur-gate.yml`, `_review/AKTUELLE_ANWEISUNG.md`, `_review/MELDUNG_PLANUNGSCHAT.md`, `_review/OWNER_ENTSCHEIDUNGEN.md`, `docs/project/arbeitspakete/**`, `docs/project/endversion/codex/BAUPLAN.json`, Beleg `docs/evidence/live-line/b2/TRUST_ANCHOR_B2D2.json`, Checker, `src/test/live_package_scope.test.ts`; Bauplan-Hash fest geprüft).
5. Selbsttest: neue Pfade erlaubt; Datei außerhalb abgelehnt; Bauplan nur in diesem Anker erlaubt.
6. Planungsdateien aus dem Arbeitsbaum unverändert mitnehmen: `docs/project/arbeitspakete/**` (u. a. `AP-R-neu-erfassen/`, diese Datei, WORKQUEUE, BEFUNDE, AP-G-Nachtrag), `_review/OWNER_ENTSCHEIDUNGEN.md` (U-232, U-233, U-234), `_review/AKTUELLE_ANWEISUNG.md`. **Nicht**: `_review/NACHTLAUF_2026-11-02.md`, Produktcode, erzeugte Tests (die kommen mit dem AP-G/AP-R-PR).
7. Probe vor Push: geänderter Checker lokal gegen den kompletten AP-G- und AP-R-Stand → PASS, Ausgabe beilegen. A11 inkl. `git diff --check origin/main`.

## Danach
Ein PR auf `kreile/b2-eingang` (frisch von main) mit AP-G **und** AP-R, zwei Abgaben (`ABGABE_AP-G.md`, `ABGABE_AP-R.md`). Ab dessen Merge laufen die erzeugten Wege-Tests bei jedem PR im Pflicht-Check agentur-gate.

Verboten: andere Workflows, h18-JSON, andere Checker, tsconfig, Mission, Migrationen, Produktcode im Anker.
Rot erlaubt: nur der Ratchet-Job am Byte-Gleichheits-Schritt.

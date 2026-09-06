# 00 · JETZT & LEITPLANKEN — ZUERST LESEN, VOR ALLEM ANDEREN

*Diese Datei sagt, was GERADE dran ist und was du NIEMALS von selbst tust. Danach erst `00_ABC_INDEX.md` (das WIE/WAS). Wenn diese Datei und dein Eindruck vom Repo-Zustand sich widersprechen: diese Datei gilt. **Du interpretierst nichts.***

## LEITPLANKEN (immer, für jeden Bau-Chat)
1. **EIN Writer, EIN Checkout.** Vor JEDEM Bau: `git branch --show-current` + `git status`. Fremder Branch, dirty Tree, ungetrackte fremde Dateien oder eine `.git/*.lock` = **STOP. Melden. NICHT bauen.** (Genau das ist der richtige Reflex.)
2. **Kein ungeführtes Bauen, keine Interpretation.** Deine Aufgabe kommt aus dieser Datei + `_kette/state_kreile.json` — NICHT aus dem, was du aus dem Repo-Zustand (offener Branch, rote CI) vermutest. Aufgabe unklar oder zwei Quellen widersprechen sich → **STOP + Owner fragen.**
3. **Kein Testbiegen / kein Green-Washing.** CI rot → zuerst **Ursache belegen** (Zustands-Leak in der Testkette vs. echter Produktbefund). NIE einen Workflow/DB-Reset/Test ändern, nur damit es grün wird (Register #1-FINAL: „jeder weitere Fehler = echter Befund, ursachenklären, KEIN Testbiegen").
4. **Prüfer ≠ Autor.** „Fertig / grün / aufgeräumt" behauptet nie der, der es gebaut hat. Unabhängige §5-Prüfung liefert den Rotstand (`00_UNABHAENGIGE_PRUEFUNG_2026-09-06.md`).
5. **Owner-Grenzen** (nur der Owner): Merge, Deploy, Remote-Migration, RLS, Löschen, Secrets, Go-live. Produktentscheidungen = STOP-Liste im Register §7 (Stand: 0 offen).

## DIE ZWEI SPUREN (nicht verwechseln)
- **Spur A — F1 Order-to-Cash-Pilot** (Domänen-Logik): F1.4 fertig · **F1.5 gemerged (#73, main `c1d9e99`, 2026-09-06)**. Nächste Einheit: Skonto 2 %/10 Tage/netto 30 (Register #5) — **erst nach Merge von S0+S1.** Reihenfolge: Mission `../../missions/F1_ORDER_TO_CASH_PILOT_001.yml`. Operativer Ist-Stand: `_kette/state_kreile.json`.
- **Spur B — Path-1 Modul-Umbau** (Architektur): **S0 + S1 gebaut, PR #75** (Tenant zentral + die Naht-Gates als CI, Red-Team bestanden). Danach S2 (Kill-Liste) → S3 (Muster-Modul `erfassung`). Plan: `ARCHITEKTUR_MODULE_PATH1.md` §4.
- **Kein Widerspruch:** Reference (ABC/Modulkarte/Verträge) = das WIE/WAS gebaut wird. `state_kreile.json` = die AKTUELL in-flight-Aufgabe. Wenn beide etwas Verschiedenes als „nächstes" nahelegen, entscheidet der Owner die Priorität — du entscheidest sie NICHT.

## WAS JETZT DRAN IST (Stand 2026-09-06, abends)
- **Der frühere HARTE STOP zu `quality.yml` ist aufgehoben — Ursache belegt:** das F1.3-Rot war eine **Test-Isolations-Regression** (geteilte DB ohne Reset vor F1.3; Stammdaten mit `expectedVersion: 0` existierten schon → Command antwortete korrekt CONFLICT), **kein Produktbefund**. Fix = genau ein fail-closed `db reset` vor F1.3 (`cc13aec`), zweimal grün, Red-Team PASS, gemerged. Siehe PROBLEMLOESUNGEN P3.
- **Offen: PR #75 (S0+S1) mergen** — Bedingungen: CI `quality` grün, unabhängiger Review PASS ohne P0/P1 (Autor = Orchestrator-Chat; Red-Team + Runner-PL haben unabhängig geprüft), Owner-OK. Der Check `ratchet` ist für DIESEN PR rot by design (er läuft mit dem alten Basis-Judge, der jede Vertragsänderung ablehnt — genau das behebt D-QA-001, PROBLEMLOESUNGEN P8); ab dem nächsten PR ist er grün.
- **Owner-Aufgabe (Einstellung):** Branch-Protection → `ratchet` und `Fresh Supabase replay` als Required Checks. Bis dahin ist die geschützte S1-Kopie nur informativ.
- **Danach:** S2 (Kill-Liste löschen, Baseline `quality/module-gates-baseline.json` schrumpft) → S3 (`src/modules/erfassung/` als Muster) → Skonto.

## DER DETERMINISMUS-HEBEL (gebaut in #75)
**S1 — die Naht-Gates.** `npm run quality:module-gates`: Manifest je Modul, Tiefimport = rot, Fremddaten nur über deklarierte `v_*`-Views, Stationsband/Transport-Home = rot (Altlasten shrink-only), AGENTS-Verweis. Beweis: `src/test/s1_module_gates.test.ts`. Ein abweichender Bau kann damit nicht grün werden — sobald #75 auf main ist.

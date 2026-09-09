# 00 · JETZT & LEITPLANKEN — ZUERST LESEN, VOR ALLEM ANDEREN

*Diese Datei sagt, was GERADE dran ist und was du NIEMALS von selbst tust. Danach erst `00_ABC_INDEX.md` (das WIE/WAS). Wenn diese Datei und dein Eindruck vom Repo-Zustand sich widersprechen: diese Datei gilt. **Du interpretierst nichts.***

## LEITPLANKEN (immer, für jeden Bau-Chat)
1. **EIN Writer, EIN Checkout.** Vor JEDEM Bau: `git branch --show-current` + `git status`. Fremder Branch, dirty Tree, ungetrackte fremde Dateien oder eine `.git/*.lock` = **STOP. Melden. NICHT bauen.** (Genau das ist der richtige Reflex.)
2. **Kein ungeführtes Bauen, keine Interpretation.** Deine Aufgabe kommt aus dieser Datei + `_kette/state_kreile.json` — NICHT aus dem, was du aus dem Repo-Zustand (offener Branch, rote CI) vermutest. Aufgabe unklar oder zwei Quellen widersprechen sich → **STOP + Owner fragen.**
3. **Kein Testbiegen / kein Green-Washing.** CI rot → zuerst **Ursache belegen** (Zustands-Leak in der Testkette vs. echter Produktbefund). NIE einen Workflow/DB-Reset/Test ändern, nur damit es grün wird (Register #1-FINAL: „jeder weitere Fehler = echter Befund, ursachenklären, KEIN Testbiegen").
4. **Prüfer ≠ Autor.** „Fertig / grün / aufgeräumt" behauptet nie der, der es gebaut hat. Unabhängige §5-Prüfung liefert den Rotstand (`00_UNABHAENGIGE_PRUEFUNG_2026-09-06.md`).
5. **Owner-Grenzen** (nur der Owner): Merge, Deploy, Remote-Migration, RLS, Löschen, Secrets, Go-live. Produktentscheidungen = STOP-Liste im Register §7 (Stand: 0 offen).

## DIE ZWEI SPUREN (nicht verwechseln)
- **Spur A — F1 Order-to-Cash-Pilot** (Domänen-Logik): F1.4 sowie **F1.5-A + B/B2 sind geliefert** (#73, main `c1d9e99`, 2026-09-06). Gemäß Mission bleiben **C `recordGoodsOut` + Gate und D UI offen**; T (Supabase-Pin) ist unabhängig. Reihenfolge und aktueller Paketstatus stehen in `../../missions/F1_ORDER_TO_CASH_PILOT_001.yml`. Skonto folgt nicht vor Abschluss der ratifizierten F1.5-Einheiten.
- **Spur B — Path-1 Modul-Umbau** (Architektur): **S0 + S1 in main integriert** (`160bcf4`, PR #75 gemerged). S2 (Kill-Liste) und S3 (Muster-Modul `erfassung`) sind **nicht begonnen** und werden **nicht vorgezogen**. Owner-priorisiert läuft stattdessen der **S4-Nacharbeitskandidat Phillip-Werkstatt-V4** als offener Draft-PR #77 auf Branch `path1/werkstatt-phillip-v4-20260907`. Plan: `ARCHITEKTUR_MODULE_PATH1.md` §4.
- **Kein Widerspruch:** Reference (ABC/Modulkarte/Verträge) = das WIE/WAS gebaut wird. `state_kreile.json` = die AKTUELL in-flight-Aufgabe. Wenn beide etwas Verschiedenes als „nächstes" nahelegen, entscheidet der Owner die Priorität — du entscheidest sie NICHT.

## WAS JETZT DRAN IST (live an PR #77 gebunden)
- **Der frühere HARTE STOP zu `quality.yml` ist aufgehoben — Ursache belegt:** das F1.3-Rot war eine **Test-Isolations-Regression** (geteilte DB ohne Reset vor F1.3; Stammdaten mit `expectedVersion: 0` existierten schon → Command antwortete korrekt CONFLICT), **kein Produktbefund**. Fix = genau ein fail-closed `db reset` vor F1.3 (`cc13aec`), zweimal grün, Red-Team PASS, gemerged. Siehe PROBLEMLOESUNGEN P3.
- **S0 + S1 sind integriert:** PR #75 ist in `main` gemerged (`160bcf4`). Kein offener Merge/Ratchet-Schritt dazu mehr.
- **Aktuell dran (Owner-priorisiert):** [Draft-PR #77](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/77) ist offen und ungemergt. Autoritative Kandidatenwahrheit ist ausschließlich sein live `head.sha`; ein in dieser Datei kopierter SHA oder eine historische Run-Nummer ist kein Abnahmebeleg. Für genau diesen `head.sha` müssen die GitHub-Checks `agentur-gate`, `quality` und `Fresh Supabase replay` erfolgreich sein, und die Vercel-Preview muss `READY` sein sowie denselben Commit über `githubCommitSha` ausweisen. Die Schlussabnahme gilt nur, wenn ein unabhängiger Prüfer denselben Exact-SHA ausdrücklich mit `PASS` benennt; jeder neue PR-Head macht ältere CI-, Preview- und Review-Belege ungültig. Bis dahin: **kein** S4-PASS und kein Merge.
- S2 (Kill-Liste löschen, Baseline `quality/module-gates-baseline.json` schrumpft) und S3 (`src/modules/erfassung/` als Muster) sind **nicht begonnen** und werden aktuell **nicht vorgezogen**.

## DER DETERMINISMUS-HEBEL (gebaut in #75)
**S1 — die Naht-Gates.** `npm run quality:module-gates`: Manifest je Modul, Tiefimport = rot, Fremddaten nur über deklarierte `v_*`-Views, Stationsband/Transport-Home = rot (Altlasten shrink-only), AGENTS-Verweis. Beweis: `src/test/s1_module_gates.test.ts`. Ein abweichender Bau kann damit nicht grün werden — seit #75 auf main ist (`160bcf4`).

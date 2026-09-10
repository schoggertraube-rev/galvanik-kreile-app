# 00 · JETZT & LEITPLANKEN — ZUERST LESEN, VOR ALLEM ANDEREN

*Diese Datei sagt, was GERADE dran ist und was du NIEMALS von selbst tust. Danach erst `00_ABC_INDEX.md` (das WIE/WAS). Wenn diese Datei und dein Eindruck vom Repo-Zustand sich widersprechen: diese Datei gilt. **Du interpretierst nichts.***

## LEITPLANKEN (immer, für jeden Bau-Chat)
1. **EIN Writer, EIN Checkout.** Vor JEDEM Bau: `git branch --show-current` + `git status`. Fremder Branch, dirty Tree, ungetrackte fremde Dateien oder eine `.git/*.lock` = **STOP. Melden. NICHT bauen.** (Genau das ist der richtige Reflex.)
2. **Kein ungeführtes Bauen, keine Interpretation.** Deine Aufgabe kommt aus dieser Datei + `_kette/state_kreile.json` — NICHT aus dem, was du aus dem Repo-Zustand (offener Branch, rote CI) vermutest. Aufgabe unklar oder zwei Quellen widersprechen sich → **STOP + Owner fragen.**
3. **Kein Testbiegen / kein Green-Washing.** CI rot → zuerst **Ursache belegen** (Zustands-Leak in der Testkette vs. echter Produktbefund). NIE einen Workflow/DB-Reset/Test ändern, nur damit es grün wird (Register #1-FINAL: „jeder weitere Fehler = echter Befund, ursachenklären, KEIN Testbiegen").
4. **Prüfer ≠ Autor.** „Fertig / grün / aufgeräumt" behauptet nie der, der es gebaut hat. Unabhängige §5-Prüfung liefert den Rotstand (`00_UNABHAENGIGE_PRUEFUNG_2026-09-06.md`).
5. **Owner-Grenzen** (nur der Owner): Merge, Deploy, Remote-Migration, RLS, Löschen, Secrets, Go-live. Produktentscheidungen = STOP-Liste im Register §7 (Stand: 0 offen).

## DIE ZWEI SPUREN (nicht verwechseln)
- **Spur A — F1 Order-to-Cash-Pilot** (Domänen-Logik): F1.4 sowie **F1.5-A + B/B2 + C sind geliefert**. C wurde mit PR #79 als Merge-Commit `b94821ca56634bcf75e8d5ddda130241bb75b9bf` integriert. D ist der aktive schmale Overlay-Kandidat und bleibt bis Exact-SHA-CI plus unabhängigem Review `review-ready`, nicht geliefert. T (Supabase-Pin) ist unabhängig. Reihenfolge und aktueller Paketstatus stehen in `../../missions/F1_ORDER_TO_CASH_PILOT_001.yml`.
- **Spur B — Path-1 Modul-Umbau** (Architektur): **S0 + S1 + S4 in main integriert**. Phillip-Werkstatt-V4 wurde mit PR #77 gemergt (Merge-SHA `019b1fbaad34e4f10a28298a29858f2fa599eb45`); CI und Vercel Production waren erfolgreich. S2 (Kill-Liste) und S3 (Muster-Modul `erfassung`) sind **nicht begonnen** und werden **nicht vorgezogen**. Plan: `ARCHITEKTUR_MODULE_PATH1.md` §4.
- **Kein Widerspruch:** Reference (ABC/Modulkarte/Verträge) = das WIE/WAS gebaut wird. `state_kreile.json` = die AKTUELL in-flight-Aufgabe. Wenn beide etwas Verschiedenes als „nächstes" nahelegen, entscheidet der Owner die Priorität — du entscheidest sie NICHT.

## WAS JETZT DRAN IST (Stand 2026-09-09)
- **Der frühere HARTE STOP zu `quality.yml` ist aufgehoben — Ursache belegt:** das F1.3-Rot war eine **Test-Isolations-Regression** (geteilte DB ohne Reset vor F1.3; Stammdaten mit `expectedVersion: 0` existierten schon → Command antwortete korrekt CONFLICT), **kein Produktbefund**. Fix = genau ein fail-closed `db reset` vor F1.3 (`cc13aec`), zweimal grün, Red-Team PASS, gemerged. Siehe PROBLEMLOESUNGEN P3.
- **S0 + S1 + S4 sind integriert:** PR #75 ist in `main` gemergt (`160bcf4`). PR #77 ist nach Exact-SHA-Abnahme gemergt (Merge-SHA `019b1fbaad34e4f10a28298a29858f2fa599eb45`); CI und Vercel Production waren erfolgreich. Kein offener S4-Merge-Schritt bleibt.
- **Aktuell dran:** F1.5-D als schmale echte Zahlungs-/Warenausgangsoberfläche ausschließlich im bestehenden Auftrags-Overlay auf `f1/f1-5-d-ui-20260909`. Der lokale Fresh-Supabase-/Auth-/Browserpfad ist belegt; offen sind Kandidaten-Commit, Exact-SHA-CI und unabhängiger Review.
- **Nächster Schritt:** genau diesen D-Kandidaten als Draft-PR einfrieren, CI/Preview am Exact-SHA abwarten und unabhängig prüfen lassen. Kein F1.6- oder Nebenpaket vorziehen.
- S2 (Kill-Liste löschen, Baseline `quality/module-gates-baseline.json` schrumpft) und S3 (`src/modules/erfassung/` als Muster) sind **nicht begonnen** und werden aktuell **nicht vorgezogen**.

## DER DETERMINISMUS-HEBEL (gebaut in #75)
**S1 — die Naht-Gates.** `npm run quality:module-gates`: Manifest je Modul, Tiefimport = rot, Fremddaten nur über deklarierte `v_*`-Views, Stationsband/Transport-Home = rot (Altlasten shrink-only), AGENTS-Verweis. Beweis: `src/test/s1_module_gates.test.ts`. Ein abweichender Bau kann damit nicht grün werden — seit #75 auf main ist (`160bcf4`).

# 00 · JETZT & LEITPLANKEN — ZUERST LESEN, VOR ALLEM ANDEREN

*Diese Datei sagt, was GERADE dran ist und was du NIEMALS von selbst tust. Danach erst `00_ABC_INDEX.md` (das WIE/WAS). Wenn diese Datei und dein Eindruck vom Repo-Zustand sich widersprechen: diese Datei gilt. **Du interpretierst nichts.***

## LEITPLANKEN (immer, für jeden Bau-Chat)
1. **EIN Writer, EIN Checkout.** Vor JEDEM Bau: `git branch --show-current` + `git status`. Fremder Branch, dirty Tree, ungetrackte fremde Dateien oder eine `.git/*.lock` = **STOP. Melden. NICHT bauen.** (Genau das ist der richtige Reflex.)
2. **Kein ungeführtes Bauen, keine Interpretation.** Deine Aufgabe kommt aus dieser Datei + `_kette/state_kreile.json` — NICHT aus dem, was du aus dem Repo-Zustand (offener Branch, rote CI) vermutest. Aufgabe unklar oder zwei Quellen widersprechen sich → **STOP + Owner fragen.**
3. **Kein Testbiegen / kein Green-Washing.** CI rot → zuerst **Ursache belegen** (Zustands-Leak in der Testkette vs. echter Produktbefund). NIE einen Workflow/DB-Reset/Test ändern, nur damit es grün wird (Register #1-FINAL: „jeder weitere Fehler = echter Befund, ursachenklären, KEIN Testbiegen").
4. **Prüfer ≠ Autor.** „Fertig / grün / aufgeräumt" behauptet nie der, der es gebaut hat. Unabhängige §5-Prüfung liefert den Rotstand (`00_UNABHAENGIGE_PRUEFUNG_2026-09-06.md`).
5. **Owner-Grenzen** (nur der Owner): Merge, Deploy, Remote-Migration, RLS, Löschen, Secrets, Go-live. Produktentscheidungen = STOP-Liste im Register §7 (Stand: 0 offen).

## DIE ZWEI SPUREN (nicht verwechseln)
- **Spur A — F1 Order-to-Cash-Pilot** (Domänen-Logik): F1.4 fertig · **F1.5 = PR #73, läuft, aktuell BLOCKIERT** (s.u.). Reihenfolge: Mission `../../missions/F1_ORDER_TO_CASH_PILOT_001.yml`. Operativer Ist-Stand: `_kette/state_kreile.json`.
- **Spur B — Path-1 Modul-Umbau** (Architektur): S0 gebaut (PR #75) · **S1 (5 CI-Gates) = nächster Architektur-Schritt.** Plan: `ARCHITEKTUR_MODULE_PATH1.md` §4.
- **Kein Widerspruch:** Reference (ABC/Modulkarte/Verträge) = das WIE/WAS gebaut wird. `state_kreile.json` = die AKTUELL in-flight-Aufgabe. Wenn beide etwas Verschiedenes als „nächstes" nahelegen, entscheidet der Owner die Priorität (siehe unten) — du entscheidest sie NICHT.

## WAS JETZT DRAN IST (Stand 2026-09-06)
- **Spur A ist BLOCKIERT und braucht zuerst eine Ursachenklärung, KEINEN Fix.**
  PR #73 (F1.5). CI-Rot im „Fresh Supabase replay": `src/test/f1_3_live_card.integration.test.ts` → *„expected 'CONFLICT' to be 'OK'"* auf dem F1.5-B2-Zahlungsmodus-Schema.
  **UNBEWIESEN**, ob (a) Zustands-Leak zwischen Testphasen (dann wäre saubere Test-Isolation legitim) oder (b) echter Vertragskonflikt F1.5-B2 ↔ F1.3 (dann wäre jeder „Reset bis grün" das Verstecken eines realen Bugs).
  **HARTER STOP:** niemand ändert `.github/workflows/quality.yml`, fügt einen zweiten DB-Reset ein oder schwächt einen Test, BEVOR (a) vs. (b) belegt ist. Erst Ursache, dann Entscheidung.
- **Owner-Entscheidung offen (Priorität, nur der Owner):** zuerst den F1.5-Blocker belegen/lösen (Spur A) — oder S1 bauen (Spur B)? Bis der Owner das sagt: **kein Bau auf Verdacht.**

## DER EIGENTLICHE DETERMINISMUS-REST (Bau, nicht Aufräumen)
**S1 — die fünf CI-Gates.** Ohne sie erzwingt der Ordner „nur das Vorgegebene" nur durch Text, nicht durch die CI. Erst mit S1 kann ein abweichender Bau nicht grün werden. Das ist der Hebel — und es ist Bau, kein Aufräumen.

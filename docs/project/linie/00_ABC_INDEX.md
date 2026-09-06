# KREILE — DAS ABC (Einstieg für jeden Bau-Chat)

**Wenn du diese App bauen sollst, lies ZUERST diese Datei, dann in dieser Reihenfolge.** Alles, was du brauchst, liegt in `docs/project/linie/` (nichts ausserhalb `02_app/`). Du baust NUR, was hier vorgegeben ist — nichts, was du dir selbst ausdenkst. Die offenen Owner-Entscheidungen stehen als **harte STOP-Liste** in `00_BIBEL_INDEX.md`: an genau diesen Punkten baust du NICHT, sondern stoppst (`BLOCKED_PRODUCT_DECISION`) und fragst den Owner.

## Grundgesetz (zwei Sätze)
1. Gebaut wird die **Modulbauweise Path 1** (wenige, vollständige, forkbare Module) nach der **Modulkarte** — nichts anderes; verworfene Muster (Stationsband-Home, 2. Designsystem, Tenant-Literal) sind CI-FAIL.
2. **Grün in der CI ist NICHT „fertig".** Fertig = grün UND designtreu (gegen `ui/`) UND modultreu (5 Nähte) UND im Scope der Modulkarte. Der Prüfer ist NIE der Autor.

## Lesereihenfolge = das ABC
- **A — WARUM/Regeln:** `../../../AGENTS.md` (Spitze), `KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` (alle Entscheidungen D-*), `00_AUTONOMER_BETRIEB_LEITPLANKEN.md`.
- **B — WAS (Scope & Module):** `MODULKARTE_KANON.md` — die 6 Module + Fundament; was Quarantäne ist, was ENTFÄLLT (löschen). Roter Faden: INFOS REIN → KARTE → SUCHEN → RAUS.
- **C — WIE (Architektur):** `ARCHITEKTUR_MODULE_PATH1.md` — Modul = ein Ordner `src/modules/<fach>/`, die fünf CI-erzwungenen Nähte, Baureihenfolge S0–S5.
- **D — WIE es aussieht (Vorlagen):** `ui/00_UI_REFERENZ_KANONISCH.md` + die 4 HTML-Mocks (Phillip V4, Rolf V8, Auftragskarte V8, Kundenkarte V2). Startseite = V4, Stationsband verboten. Demo-Daten darin sind nie Produktdaten (kein Mock).
- **E — Domänen-Verträge (wörtlich):** `KREILE_F1_4_BAUVERTRAG_...RECHNUNG_V1...md`, `KREILE_F1_5_BAUVERTRAG_ZAHLUNGSEINGANG_WARENAUSGANG_V1...md`. Mission/Reihenfolge: `../../../missions/F1_ORDER_TO_CASH_PILOT_001.yml`.
- **F — BEISPIEL (so sieht ein korrektes Modul aus):** `BEISPIELE_MODUL.md`.
- **G — PROBLEMLÖSUNGEN (bekannte Fallen + Fix):** `PROBLEMLOESUNGEN.md`.
- **H — Bauplan/Reihenfolge:** `ARCHITEKTUR_MODULE_PATH1.md` §4 (S0 Tenant-Fix → S1 Gate → S2 Löschen → S3 Muster-Modul → S4 Home V4 → S5 restliche Module). F1.x-Reihenfolge aus der Mission.

## Abnahmetest (das ist „der Ordner ist vollständig")
Ein frischer Chat mit NUR diesem Repo kann ohne Owner-Rückfrage sagen: welches Modul, welche Naht, welcher nächste Schritt. **SOLL-Zustand (erst nach S1 real):** die CI lässt keinen Tiefimport, kein Tenant-Literal, kein Stationshome, kein manifestloses Modul, keine Domäne mit Ablage außerhalb ihres Modulordners grün. **Heute erzwungen:** nur der Tenant-Literal-Bann (S0, PR #75). Bis S1 gebaut ist, erzwingt der Ordner die Regeln durch Text, nicht durch die CI — deshalb ist S1 der erste Bau-Schritt.

## Status-Kurz (Stand 2026-09-06)
Gebaut+geprüft: Fundament (F0/F1.1), Domänen-Logik F1.4/F1.5. **S0 (Tenant-Zentralisierung) = gebaut**, in Review (PR #75) — Prüfer ≠ Autor. NICHT gebaut: S1 (die 5 CI-Gates), `src/modules/`, die Home-Neubauten, buchhaltung-Trim. Suchleiste: fertige Lieferung liegt in `_lieferungen/suche/`, Import nach `src/modules/suche/` noch offen. Kill-Liste (ENTFÄLLT-Routen) noch nicht ausgeführt. Der erste Bau-Schritt ist S1: die CI-Gates, die alles Abweichende rot färben — erst dann erzwingt der Ordner „nur das Vorgegebene". Unabhängiger Rotstand (Prüfer ≠ Autor): `00_UNABHAENGIGE_PRUEFUNG_2026-09-06.md`.

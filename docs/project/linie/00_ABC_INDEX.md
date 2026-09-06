# KREILE — DAS ABC (Einstieg für jeden Bau-Chat)

**Wenn du diese App bauen sollst, lies ZUERST diese Datei, dann in dieser Reihenfolge.** Alles, was du brauchst, liegt in `docs/project/linie/`. Frage den Owner NUR bei einer echten neuen Produktentscheidung, die hier nicht steht.

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
Ein frischer Chat mit NUR diesem Repo kann ohne Owner-Rückfrage sagen: welches Modul, welche Naht, welcher nächste Schritt — und die CI lässt keinen Tiefimport, kein Tenant-Literal, kein Stationshome, kein manifestloses Modul, keine Domäne mit Ablage außerhalb ihres Modulordners grün.

## Status-Kurz (Stand 2026-09-06)
Gebaut+geprüft: Fundament (F0/F1.1), Domänen-Logik F1.4/F1.5. NICHT gebaut: die 5 Nähte (S0/S1), `src/modules/`, die Home-Neubauten, Suchleiste-Import, buchhaltung-Trim. Kill-Liste (ENTFÄLLT-Routen) noch nicht ausgeführt. Details/aktueller Rotstand: siehe unabhängige §5-Prüfung (Prüfer ≠ Autor).

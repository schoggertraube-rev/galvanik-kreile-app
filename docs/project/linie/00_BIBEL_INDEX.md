# 00 · KREILE BIBEL-INDEX — Karte dieses Ordners

*Stand 2026-09-06. **Dieser Ordner `02_app/docs/project/linie/` ist die EINZIGE verbindliche Bau-Wahrheit.** Nichts ausserhalb `02_app/` ist Quelle. Der frühere Desktop-/Projekt-Ordner `galvanik_kreile\00_BIBEL\` ist ab jetzt **Archiv/überholt** — nicht mehr Master, nicht als Bau-Input verwenden.*

**Einstieg ist `00_ABC_INDEX.md`** (Lesereihenfolge A–H). Diese Datei hier ist nur die Karte „wo liegt was" + die harte STOP-Liste.

## REGELN (Verfassung)
- Ein Bauplan/Vertrag ist wörtliches Gesetz — NIE interpretieren. Unklarheit = STOP `BLOCKED_PRODUCT_DECISION`, Owner fragen, Beschluss in den Ordner, dann bauen.
- EIN Writer · PR statt Push · kein Mock (Demo-Daten nie als Produktdaten) · kein Merge/DB/RLS/Deploy ohne Owner-Freigabe.
- Nichts überschreiben: neue Version = neue Datei mit Datum; alte bleiben als Historie.
- **Grün ≠ fertig.** Fertig = grün UND designtreu (gegen `ui/`) UND modultreu (5 Nähte) UND im Scope der Modulkarte. Prüfer ≠ Autor.

## WO LIEGT WAS (alles in diesem Ordner, Repo-relativ)
- **Einstieg / Lesereihenfolge:** `00_ABC_INDEX.md`
- **Beschluss-Autorität (alle D-*, B*, Gates):** `KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` — bei Divergenz gilt die Linie.
- **UI / Design-Wahrheit (verbindlich, eingefroren):** `ui/00_UI_REFERENZ_KANONISCH.md` + genau diese HTML:
  - `ui/KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html` (Startseite Phillip „Werkstatt")
  - `ui/KREILE_STARTSEITE_ROLF_V8_2026-08-20.html` (Startseite Rolf „Der Tag")
  - `ui/KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html`
  - `ui/KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html`
  - Startseite = V4, Stationsband verboten. Ältere Versionen (V1–V7) sind KEINE Quelle.
- **Architektur / 5 Nähte / Baureihenfolge S0–S5:** `ARCHITEKTUR_MODULE_PATH1.md`
- **Scope & Module (was gebaut / Quarantäne / ENTFÄLLT):** `MODULKARTE_KANON.md`
- **Korrektes Beispiel-Modul:** `BEISPIELE_MODUL.md`
- **Bekannte Fallen + Fix:** `PROBLEMLOESUNGEN.md`
- **Domänen-Verträge (wörtlich):** `KREILE_F1_4_BAUVERTRAG_UNVERAENDERLICHE_RECHNUNG_V1_2026-08-21.md` · `KREILE_F1_5_BAUVERTRAG_ZAHLUNGSEINGANG_WARENAUSGANG_V1_2026-08-21.md`
- **Suchleiste-Lieferung (fertiger Code, noch NICHT integriert):** `_lieferungen/suche/` — nach `src/modules/suche/` forken nach den 5 Nähten (Manifest + public.ts-Fassade + Tenant-Injektion). Siehe `_lieferungen/suche/LIEFERSCHEIN.md`.
- **Regeln/Autonomie:** `00_AUTONOMER_BETRIEB_LEITPLANKEN.md` · `KREILE_AUTONOMIE_MANDAT_2026-08-27.md`
- **Status/Orientierung:** `KREILE_GESAMTUEBERSICHT_STATUS_2026-09-01.md` · `KREILE_PL_STARTUP_BRIEFING_2026-09-05.md`

## HARTE STOP-LISTE — Owner-Entscheidungen (Chat baut NICHT, fragt Owner)
An diesen Punkten gibt es **keine Eigenentscheidung** durch Chat/PL. Wer hier ankommt: STOP `BLOCKED_PRODUCT_DECISION`, Owner fragen, Antwort ins Register (§7), dann bauen.

**Stand 2026-09-06: keine offene Owner-Entscheidung auf dem kritischen Pfad.** Alle im Register §7 entschieden:
- B1 = **zwei Nummernkreise** (= Ist-Code): Auftragsnummer `A-JJJJ-NNNN` bei Annahme (`public.orders.order_number`), Rechnungsnummer `R-JJJJ-NNNN` bei `createInvoice` (§7 #2).
- B3 = Vergabezeitpunkte getrennt: `A-…` bei Annahme, `R-…` bei Rechnung; GoBD-Lückenlosigkeit nur im `R-`Kreis (§7 #4).
- Skonto = JA, 2 % bei ≤10 Tagen, netto 30 (Satz ist Parameter) (§7 #5).
- Galvanik statt Bäder, `baeder` entfällt (§7 #6).
- Genau EINE personalisierte Startseite pro Login, Admin = Einstellungen (§7 #7).
- Kill-Liste freigegeben (reiner Mock löschen) (§7 #8).
- B2 = Gruppierung folgt echter Preislisten-Semantik, Klassifikation je Position gegen Katalog belegt (§7 #3).
- AMBIG-Routen: `items` behalten (Orders/Accounting), `telefonnotiz` → Customers/Intake, `lager` + `lieferanten` löschen (§7 #9).

Was HIER trotzdem STOP bleibt: nur wirklich **neue** Produktfragen, die im Register nicht stehen (dann `BLOCKED_PRODUCT_DECISION`, Owner fragen, eintragen). Nicht: die oben entschiedenen Punkte selbst umdeuten.

## LIVE ≠ BAUBAR (ehrliche Grenze)
Ein Chat baut bis „grün + designtreu + modultreu + im Scope". **Live schaltet der Owner** — Prod-Supabase-Migration, RLS, echte Secrets, Deploy und Go-live sind Owner-Grenzen (AGENTS.md). Kein Chat wird die App selbst „live" schalten; das ist gewollt.

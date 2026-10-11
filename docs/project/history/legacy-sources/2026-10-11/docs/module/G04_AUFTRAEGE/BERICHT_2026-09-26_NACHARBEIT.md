<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Bericht · G04_AUFTRAEGE · Nacharbeit 2026-09-26

## Ergebnis

Der von der unabhängigen Prüfung gemeldete Scheinpfad `src/lib/server/commands/orderLifecycleCommand.ts` wurde entfernt und durch die drei in der geprüften Lieferwahrheit vorhandenen Commands ersetzt. Alle weiteren expliziten Pfadangaben der zwölf Dossierdateien und des ursprünglichen Berichts wurden gegen den lokal vorhandenen Ref `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9` beziehungsweise bei Off-Repo-Quellen gegen das Dateisystem geprüft. Vorhandene Referenzen wurden auf eindeutige Pfade normalisiert; nicht vorhandene geplante Dateien und Zielpfade sind ausdrücklich `FEHLT`.

Der vorgeschriebene Versuch `git fetch origin` scheiterte in diesem Lauf read-only an fehlendem Schreibzugriff auf `.git/FETCH_HEAD`. Deshalb wird kein neuerer Remote-Stand behauptet. Geprüft wurde mit `git ls-tree`, `git cat-file -e`, `git show`, `rg` und `Test-Path`; Produktcode, Repo-Dateien und Git-Zustand wurden nicht verändert.

## Änderungsliste

| Datei | Stelle | alt → neu | Beleg |
|---|---|---|---|
| `11_IST_CODE_UMBAU.md` | Command-Bestand, ehemalige Lifecycle-Zeile | `src/lib/server/commands/orderLifecycleCommand.ts` → `src/lib/server/commands/orderStationCommand.ts`, `src/lib/server/commands/orderFreezeCommand.ts`, `src/lib/server/commands/recordGoodsOutCommand.ts` | Die drei Dateien sind in `origin/main` vorhanden; ihre Konstanten belegen `ORDER_STATION_MOVED_V1`, `ORDER_FROZEN_V1` und `ORDER_PICKED_UP_V1`/`ORDER_PICKED_UP_V2`. |
| `11_IST_CODE_UMBAU.md` | Adapter/Fassade und Migrationen | Kurzpfade `server-public.ts`/`orders/server-public` sowie nicht existente Ellipsenangabe `supabase/migrations/20260812133649…` → exakter FEHLT-Pfad `src/modules/orders/server-public.ts` und vorhandenes Verzeichnis `supabase/migrations/` mit Verweis auf die acht exakten Dateien in `09` | `src/modules/orders/server-public.ts` fehlt in `origin/main`; `supabase/migrations/` und die acht in `09_QUELLEN_AKTUALITAET.md` genannten Migrationen sind vorhanden. |
| `01_ANFORDERUNGSKATALOG.md` | A-G04-006, -007, -024, -030 | Kurzdateinamen → exakte Repo-Pfade; `src/modules/orders/server-public.ts` zusätzlich als FEHLT markiert | `origin/main:src/lib/server/commands/orderIntakeCommand.ts`, `origin/main:src/modules/quotes/server/types.ts`, `origin/main:src/styles/mock/mock-kreile-compat.css`, `origin/main:src/modules/orders/public.ts`; fehlende Server-Fassade per `git cat-file -e` geprüft. |
| `02_FUNKTIONEN_ABLAEUFE.md` | Zustände Auftragsliste/Auftragskarte | `OrdersAppAdapter.tsx`/`OrderCardView.tsx` → `src/app/orders/OrdersAppAdapter.tsx`/`src/modules/orders/ui/OrderCardView.tsx` | Beide Dateien sind in `origin/main` vorhanden. |
| `03_OPTIKVORLAGE.md` | Designsystem-Bausteine | `mock-kreile-compat.css` → `src/styles/mock/mock-kreile-compat.css` | Datei ist in `origin/main` vorhanden. |
| `04_SCHNITTSTELLEN_DATEN.md` | angebotene Ports und Feldliste | Kurzpfade → exakte Pfade; Server-Fassade als FEHLT | `origin/main:src/modules/orders/public.ts` und `origin/main:src/lib/server/commands/orderIntakeCommand.ts` vorhanden; `src/modules/orders/server-public.ts` fehlt. |
| `05_REGELN_SPERREN_KONFLIKTE.md` | S-G04-004 | `orderIntakeCommand.ts` → `src/lib/server/commands/orderIntakeCommand.ts` | Datei ist in `origin/main` vorhanden. |
| `07_ABNAHME_TESTS.md` | T-G04-002, -003, -006, -007, -010, -011, -015, -023 | vorhandene Test-/Quellnamen → exakte Pfade; geplante Navigation-, Schedule- und Timeliness-Tests → ausdrücklich FEHLT, Zielpfad erst im Baupaket innerhalb vorhandener Teststrukturen | Vorhanden: `src/modules/orders/__tests__/OrderSurfaces.v8.test.tsx`, `src/lib/server/commands/__tests__/orderIntakeCommand.test.ts`, `src/lib/server/commands/orderIntakeCommand.ts`, `src/modules/quotes/server/types.ts`; für die vier geplanten Testartefakte kein Treffer in `origin/main`, vorhandene Testwurzeln sind `e2e/`, `src/modules/orders/__tests__/` und `src/lib/server/commands/__tests__/`. |
| `08_OFFENE_FRAGEN.md` | Q-G04-008 | `src/lib/server`/`server-public.ts` → `src/lib/server/` und `src/modules/orders/server-public.ts` (FEHLT) | Verzeichnis `src/lib/server/` ist in `origin/main` vorhanden; Server-Fassade fehlt. Der bestehende Zustand bleibt „OFFEN – abgesichert“ beziehungsweise in der App gesperrt. |
| `09_QUELLEN_AKTUALITAET.md` | Prozessquelle | Ellipsenpfad `00_BIBEL/_archiv_2026-09-05/.../sources/01_PROZESSABLAUF_WERKSTATT_APP.md` → vollständiger realer Pfad | Datei vorhanden unter `00_BIBEL/_archiv_2026-09-05/neuer chat zusammenführung/KREILE_PHASE0_HANDOVER/sources/01_PROZESSABLAUF_WERKSTATT_APP.md`. |
| `09_QUELLEN_AKTUALITAET.md` | CURRENT_STATE/Modulkarte | nicht existierende Scheinanker `#Orders`, `#G04`, `#Kalender/M365` → echte Dateipfade plus benannte Tabellenzeile/Abschnitte | `docs/project/CURRENT_STATE.md` und `docs/project/linie/MODULKARTE_KANON.md` sind in `origin/main` vorhanden; die genannten Fragmentüberschriften existieren nicht. |
| `09_QUELLEN_AKTUALITAET.md` | V6, Digests, Mission-Template | V6 „nicht vorhanden“, verkürzte Digestpfade und unmarkiertes Fehlen → V6 und `missions/MISSION_TEMPLATE.yml` ausdrücklich FEHLT; drei absolute Digestpfade | Kein V6-/Mission-Template-Treffer in `origin/main`; die drei Digestdateien sind unter `C:/Users/Traube/AppData/Local/Temp/kreile_digest/` vorhanden. |
| `BERICHT_2026-09-26.md` | geprüfte Wahrheiten/Governance/Importziel | Adapter-Kurznamen → exakte Pfade; Mission-Template und derzeit nicht vorhandenes `02_app/docs/module/` → FEHLT | Adapter vorhanden in `origin/main`; Mission-Template und `docs/module/` fehlen dort. Anleitung §9 benennt `02_app/docs/module/` ausschließlich als späteres Importziel. |
| `10_CHECKLISTE.md` | Punkte 1, 9, 11 | ursprünglicher Vollständigkeitsstand → Nacharbeitsbericht aufgenommen, Pfadprüfung und korrigierte Command-Dateien dokumentiert | Anleitung §7 Punkte 1, 9 und 11; statischer Pfadabgleich dieses Laufs. |
| `BERICHT_2026-09-26_NACHARBEIT.md` | neu | nicht vorhanden → dieser Nacharbeitsbericht | Auftrag vom 2026-09-26. |

## Prüfgrenze

Es wurden keine Builds, Produkt-, Unit-, Integrations- oder E2E-Tests ausgeführt. Nachweisbar stattgefunden haben ausschließlich die oben genannten read-only Pfad-, Ref- und Dateiprüfungen. Es wurden keine Dateien außerhalb von `G04_AUFTRAEGE` geschrieben und keine Code-, Git-, Provider-, Deployment- oder Datenmutation ausgeführt.

Die nach Anleitung §7 relevante Dossier-Vollständigkeit bleibt nach den Pfadkorrekturen erfüllt. Fehlende geplante Artefakte sind als `FEHLT` ausgewiesen; die bereits bestehende offene Architekturfrage Q-G04-008 bleibt sicher abgesichert und verlangt keine erfundene Implementierungsbehauptung.

DOSSIER-STATUS: BAUBEREIT

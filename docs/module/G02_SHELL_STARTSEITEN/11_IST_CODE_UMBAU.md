<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# IST-Code und Umbauentscheidung

Inventarstand ist die lokale `origin/main`-Referenz `21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`. Der Arbeitsbaum `02_app` wurde ausschließlich gelesen. „GEBAUT“ bezeichnet vorhandenen Code, nicht offizielle Lieferung oder bestandene neue Dossierabnahme.

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| `src/app/page.tsx` | löst `/` in Gregor `/settings`, Phillip Werkstatt oder Rolf „Der Tag“ auf | GEBAUT | bleibt | Hash `24a59ed10f45`; Root-Route-Test | Capabilitymodell aus G01 statt neuer Rollenlogik; sichere Fehlergrenze erhalten. |
| `src/lib/server/productActorReadiness.ts` und `src/lib/server/authorization.ts` | bestätigt Produktidentität, Tenant, Rolle und Permissions | GEBAUT | bleibt | `authorization.ts` Hash `995e1082f56c` | Keine Fallback-Identität; spätere Personenrechte kommen aus G01, nicht aus G02. |
| `src/app/layout.tsx` | verdrahtet globale Provider, Shell und Global-Create | GEBAUT | bleibt | Importgraph `KreileAppShell` | Reihenfolge server/client und fail-closed Grenzen erhalten. |
| `src/components/layout/KreileAppShell.tsx` | aktiver App-Rahmen | GEBAUT | umbauen auf Designsystem | aktiver Import von `MockAppFrame` | API für `children`/Global-Create erhalten, intern `kr-app-shell` verwenden. |
| `src/components/layout/MockAppFrame.tsx` | Seitenleiste, Dock, Mehr-Sheet und responsive Breakpoints | GEBAUT mit Mock-CSS | umbauen auf Designsystem | Hash `6d15d475d261`; Browser-Evidenz 4 Viewports | Funktionsverhalten/Breakpoints nach Designphase übernehmen; Klassen, Farben und Mock-Namen ersetzen; Capabilityfilter ergänzen. |
| `src/components/layout/MockIcons.tsx` | aus V5 kopierte Symbol-Sprites | GEBAUT aus Mock | umbauen auf Designsystem | Kommentar im Code; aktiver Shell-Import | Nur freigegebene DS-Icons; keine Mock-DOM-Kopie. |
| `src/styles/mock/mock-kreile-rolf-home.css` | gesamte produktive Shell-/Home-Optik | GEBAUT, aber verworfen | umbauen auf Designsystem | Hash `94b38eb298d3`; OE-2609-03; OP-21 | Nach geschlossenem Importgraph aus Runtime entfernen; keine Farbwerte kopieren; keine Datei in diesem Auftrag löschen. |
| `src/components/home/RolfHome.tsx` | autorisierter serverseitiger Orders-Read für Rolf | GEBAUT | bleibt und um öffentliche G09/M04/M02-Ports ergänzen | Hash `229ea41c6b34` | Teilquellen parallel, aber getrennte `complete/partial`-Wahrheit; kein DB-Direktzugriff anderer Module. |
| `src/components/home/RolfHomeClient.tsx` | Rolf V8: „Das braucht dich“, „Heute raus“, neue Aufträge | GEBAUT mit Mock-CSS | umbauen auf Designsystem | Hash `5cd9288a9b24`; Real-Render-Test | Handlungsbedarf auf echten G09-Feed umstellen; Kalender/Abwesenheit via M04; bestehende ehrliche Leer-/Fehlerzustände erhalten. |
| `src/modules/orders/domain/buildOrdersHomeProjection.ts` | sortiert reale Auftragsprojektion für Rolf | GEBAUT | bleibt | Hash `337b8de72b00`; Tests | Nicht zu einem Konfliktregelwerk erweitern; G09 ist eigene Komposition. |
| `src/components/home/ImportantTodayPanel.tsx` | altes generisches „Heute wichtig“-Panel | GEBAUT, im aktiven Shell-/Home-Pfad unbenutzt | entfällt | Hash `e0b3b4bd1501`; Importsuche findet nur die Datei selbst | Nicht als Konfliktsektion reaktivieren; spätere Entfernung nur in genehmigtem Codeauftrag nach vollständigem Importgraph. |
| `src/components/home/WerkstattHome.tsx` | lädt Wareneingang, Galvanik und KPI für Phillips Home | GEBAUT | bleibt und um öffentliche G09/M04-Ports ergänzen | Hash `75e82b0388c9`; ehrliche denied/error/conflict-Zustände | Doppelte Kennung bleibt technischer Konflikt; keine Kalender- oder Analyseableitung lokal. |
| `src/app/warendurchlauf/WerkstattAppAdapter.tsx` | verdrahtet Werkstattansicht mit vorhandenen Objektaktionen | GEBAUT | bleibt | Root-Route und Shell-E2E | Ports nur zu Besitzermodulen; keine lokale Mutation für Konfliktkarten. |
| `src/modules/werkstatt/ui/WerkstattView.tsx` | Phillip V4 mit „Heute sichern“, Bündelung, WIP, Warenausgang | GEBAUT mit Mock-CSS | umbauen auf Designsystem | Hash `fddc39e25803`; `deriveWerkstattView.test.ts` | G09-Karten oberhalb Tagesüberblick; Termine/Abwesenheiten erst M04; aktionslose Vorlagen-Buttons nicht zurückbringen. |
| `src/modules/werkstatt/ui/WerkstattLoading.tsx` | echter Werkstatt-Ladezustand | GEBAUT mit Mock-CSS | umbauen auf Designsystem | Text „Werkstattdaten werden geladen.“ | Semantik `aria-busy`/`role=status` erhalten. |
| `src/modules/werkstatt/server/deriveWerkstattView.ts` | klassifiziert Dringlichkeit, Bündelung und reicht SQL-KPI durch | GEBAUT | bleibt | `deriveWerkstattView.test.ts` | Bündelung nicht als Verfahrenskompatibilität ausgeben; G09-Vertrag für K-G09-012 beachten. |
| `src/modules/werkstatt/werkstatt.manifest.json` | öffentlicher Werkstattvertrag | GEBAUT | bleibt und Public-DTO nur bei Bedarf versioniert ergänzen | Hash `8ddfaacdb0fe` | Keine G02-Abhängigkeit eintragen; G02 importiert Public-Fassade. |
| `src/modules/orders/orders.manifest.json` | öffentlicher Ordersvertrag inklusive Home-Projektion | GEBAUT | bleibt | Hash `ed89e729f100` | G09 server-only Faktenfassade separat versionieren; keine private View im G02-Client. |
| `src/components/layout/RightNav.tsx`, `MobileNav.tsx`, `KreileHeader.tsx` | ältere alternative Navigation/Header | GEBAUT, nur noch direkt in Alt-Tests referenziert | entfällt aus Runtime; nicht wiederverwenden | Importsuche; aktiver `KreileAppShell` nutzt `MockAppFrame` | Vor späterem Löschen vollständigen Import-/Testgraph bereinigen; kein Löschen in diesem Auftrag. |
| `src/db/schema.ts::calendarEvents` | Legacy-Kalendertabelle | GEBAUT als Legacy-Inventar | ersetzen durch Modul-Port | D-ARCH-011; G09/M04-Vertrag | Nicht migrieren, lesen oder als Fallback verwenden; M04/Graph bleibt Zielwahrheit. |
| `supabase/migrations/20260811154732_w4_order_station_event_readmodels.sql` | tenantgebundene operative Queue und Stations-Receipts | GEBAUT | bleibt | Hash `44ecf82b3402` | Nur über bestehende serverseitige Fassade; filtert Seed/Test und markiert Integrität. |
| `supabase/migrations/20260908101500_werkstatt_kpi_view.sql` | tenantgebundene WIP-/Wochenfälligkeits-KPI | GEBAUT | bleibt | Hash `29d448e720fa` | Keine Neuberechnung im UI; keine Migration aus diesem Auftrag. |
| `e2e/path1-v5-shell-smoke.real.spec.ts` | echte lokale PIN-, Navigation- und Viewport-Evidenz für Rolf/Phillip | GEBAUT | bleibt und nach DS/G09 erweitern | V5-Hash im Test; 1914/1220/390 | 768×1024 ergänzen; Gregor, Capabilities und sieben Zustände separat testen. |
| `src/components/home/__tests__/RolfHome.realRender.test.tsx` | Rolf Daten/leer/denied/error und Objektöffnung | GEBAUT | bleibt und erweitern | vorhandene assertions | DS-Klassen nicht fest verdrahten; G09/M04-/Partial-Zustände ergänzen. |
| `src/app/__tests__/w2cB2m5u.homeDueTruth.realRender.test.tsx` | Root-Routing und keine Fallback-Identität | GEBAUT | bleibt | vorhandene assertions | Personenrechte/Capabilities ergänzen, Rollenrouting nicht weiter verhärten. |
| `src/modules/werkstatt/__tests__/deriveWerkstattView.test.ts` | Dringlichkeit, Bündelung, KPI-Passthrough | GEBAUT | bleibt | vorhandene assertions | K-G09-012-Grenzen ergänzen; keine M04-Fakten in Werkstattableitung. |
| `docs/evidence/path1/artifacts/p3-core-surfaces-search/*home*.png` | visuelle IST-Evidenz für Rolf/Phillip auf vier Geräten | GEBAUT als Evidenz | bleibt als Vorher-Beleg | Report Hash `2de8c4cf9fe2` | Synthetische Testdaten; kein Production- oder DS-Abnahmenachweis. |

## Migrations- und Bestandsdatenaussage

- Für den G02-Designsystem-/Kompositionsumbau ist **keine Datenmigration** vorgesehen.
- Neue Tabellen, eine G02-Konflikttabelle oder ein lokaler Kalenderstore sind verboten.
- M04- und M02-Anbindung erfolgen später über abgenommene Ports/Handshakes; ihre Migrationen gehören den jeweiligen Modulen.
- Vorhandene `calendar_events`-Bestände werden nicht gelöscht oder umgedeutet. Eine spätere Bereinigung benötigt einen eigenen, freigegebenen Datenentscheid.
- Browser- und Komponententests verwenden ausschließlich synthetische Daten; Echtdaten werden nicht verändert.

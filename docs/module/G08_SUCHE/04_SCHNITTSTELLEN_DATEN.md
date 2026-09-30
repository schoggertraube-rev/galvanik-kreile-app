<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G08_SUCHE — Schnittstellen und Daten

## Besitzgrenze

G08 besitzt keine Fachdatensätze. Aufträge bleiben G04, Kunden bleiben G05, Identität/Rechte bleiben G01 und Dokumente beim jeweils besitzenden Fachmodul. G08 liest ausschließlich tenantgebundene Projektionen, erzeugt flüchtige Suchergebnisse und mutiert nichts.

## Öffentliche Ports des neutralen Kerns

| Port/Vertrag | Richtung | Zweck | Ist/Soll |
|---|---|---|---|
| `normalizeSearchQuery(input)` | angeboten | String validieren, trimmen, Mindest-/Maximallänge anwenden | GEBAUT |
| `executeSearch(request, sourceRegistry)` / heutiges `searchTenant(query, ports)` | angeboten | registrierte Quellen ausführen, validieren, deduplizieren, ranken, kappen und Coverage bilden | GEBAUT mit geschlossenen Orders-/Customers-Ports; Registry-Umbau SPEZ |
| `SearchDialog` | angeboten | neutraler Dialog über injizierte `search`- und `onSelect`-Ports | GEBAUT; Designsystem-Umbau SPEZ |
| `SearchResult` / heutiges `SearchTenantResult` | angeboten | `OK` mit Query, Treffern, geprüften Quellen, Zeitstempel und Coverage oder eng typisierter Fehler | GEBAUT; Correlation-ID FEHLT |
| `SearchSourceDefinition` | angeboten | stabile Source-ID, Label, Priorität, Dokumentvalidator, Matcher/Ranker und typisierte Resultataktion | SPEZ; ersetzt geschlossene `SearchHitType`-/`SearchSource`-Union |
| `SearchNavigationContext` | angeboten | Ausgangsroute, Querystring, Filter, Scrollposition und Fokusanker für Rückkehr | SPEZ; FEHLT im heutigen Store |

Der neutrale Kern kennt weder `galvanik-kreile`, Kreile-Rollen, Kreile-Routen, Datenbankobjekte noch Provider. Deutsche Kreile-Texte können als vom Host injiziertes Textset geführt werden; der Kern entscheidet keine Fachwahrheit.

## Benötigte Kreile-Host-Ports

| Host-Port | Eingabe | Ausgabe | Besitzer | Fehlerregel |
|---|---|---|---|---|
| `SearchAuthorizationPort` | serverseitiger Requestkontext | Identity, Tenant, Lesecapabilities, Correlation-ID | G01 | ohne belegte Session/Capability kein Quellenaufruf |
| `OrderSearchReadPort` | autorisierter Tenantkontext, normalisierte Query | validierte Auftrags-Suchdokumente + `exhaustive` | G04 | Fehler oder Tenantinkonsistenz schließt Gesamtsuche |
| `CustomerSearchReadPort` | autorisierter Tenantkontext, normalisierte Query | validierte Kunden-Suchdokumente + `exhaustive` | G05 | Fehler oder unbelegte Rückgabe schließt Gesamtsuche |
| `DocumentSearchReadPort` | noch nicht festgelegt | noch nicht festgelegt | fachlicher Dokumentbesitzer | **nicht registrieren**, bis Q-G08-001 geklärt ist |
| `SearchResultNavigatorPort` | Resultattyp, stabile Entity-ID, Ausgangskontext | geöffnete kanonische Karte oder typisierter Fehler | App-Komposition G02/G04/G05 | unbekannter Typ öffnet nichts; kein URL-Tunnel |
| `SearchBackstackPort` | Push/Pop/CloseAll mit NavigationContext | aktueller Stack + restaurierter Kontext | App-Komposition G02 | genau eine Ebene pro Pop; Filter/Scroll-Failure sichtbar testen |
| `SearchClockPort` | keine | gültiger ISO-Zeitstempel | Plattform | ungültige Zeit schließt Gesamtsuche |
| `SearchTelemetryPort` | Correlation-ID, Source-ID, Dauer, Resultatcode, Kappung | serverseitiger Diagnosebeleg ohne Query-Inhalt/Secrets | Plattform | Telemetriefehler darf keine Daten leaken; Produktfehler bleibt sichtbar |

Der heutige Kreile-Adapter `src/app/actions/search.actions.ts` liest über `@/lib/server/orderStationRead` und `@/lib/server/orderIntakeRead`. T-04 führt diese Zugriffe hinter öffentliche Modul-Read-Fassaden von Orders und Customers; G08 importiert keine fremden internen Implementierungen.

## Ereignisse

| Ereignis | Richtung | Stand | Regel |
|---|---|---|---|
| keine Fachereignisse | — | verbindlich | Suche ist read-only und erzeugt keine Domänenmutation |
| technische Suchmetrik | intern/Telemetry-Port | SPEZ | kein Domänenevent, kein Query-Rohtext, keine personenbezogenen Trefferwerte in allgemeinen Logs |

## Feldliste

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| SearchRequest | query | string | Ja | getrimmt; 2–80 Zeichen für Retrieval | G08 Kern | kein DB-Feld; `src/modules/suche/server/searchTenant.ts` |
| SearchRequest | correlationId | string | Ja | serverseitig erzeugt, UI-safe | G01/Plattform | FEHLT im aktuellen Resultatvertrag |
| SearchSourceDefinition | sourceId | string | Ja | stabil, eindeutig, app-neutral | G08/HostAdapter | SPEZ; heutige Union in `server/types.ts` |
| SearchSourceDefinition | label | string | Ja | Kreile-Text aus HostAdapter | Kreile-HostAdapter | SPEZ |
| SearchSourceDefinition | priority | integer | Ja | deterministische Totalordnung | Kreile-HostAdapter | SPEZ; heute fest im Kern |
| SearchSourceDefinition | exhaustive | boolean | Ja | `false` erzwingt sichtbare Kappung | jeweiliger Read-Port | heute `SearchCustomerBatch.exhaustive` |
| SearchHit | sourceId | string | Ja | muss registrierte Quelle referenzieren | G08 Kern | heute `source` in `server/types.ts` |
| SearchHit | resultType | string | Ja | registrierter, erweiterbarer Typ | G08 Kern | heute geschlossen auf `ORDER` oder `CUSTOMER` |
| SearchHit | entityId | string | Ja | stabile ID, nie Anzeigeersatz | G04/G05 | `orders.id` / `customers.id` über Read-Port |
| SearchHit | title | string | Ja | nicht leer | G04/G05 | aus Auftrags-/Kundenprojektion |
| SearchHit | subtitle | string/null | Nein | nur belegte Fakten | G04/G05 | flüchtige Projektion |
| SearchHit | status | string/null | Nein | nur kanonischer Fachstatus | G04 | Auftragsprojektion |
| SearchHit | matchField | string | Ja | registrierter Feldschlüssel | G08 Source-Definition | heute geschlossene Union |
| SearchHit | matchLabel | string | Ja | Hosttext passend zum Feld | Kreile-HostAdapter | flüchtig |
| SearchHit | matchValue | string | Ja | exakter belegter Quellwert | G04/G05 | flüchtig |
| SearchHit | context | string | Ja | belegte Zusammenfassung, keine Erfindung | G04/G05 | flüchtig |
| SearchHit | actionKey | string | Ja | typisiert; keine freie URL | App-HostAdapter | heute `href` + `actionLabel`, umzubauen |
| SearchCoverage | returnedHits | integer | Ja | ≥0 | G08 Kern | kein DB-Feld |
| SearchCoverage | matchingHitsAtLeast | integer | Ja | ≥ `returnedHits` | G08 Kern/Quellports | kein DB-Feld |
| SearchCoverage | truncated | boolean | Ja | wahr bei jeder unbewiesenen Vollständigkeit | G08 Kern | kein DB-Feld |
| SearchResult | checkedSources | string[] | Ja | nur vollständig abgefragte Quellen | G08 Kern | kein DB-Feld |
| SearchResult | checkedAt | ISO timestamp/null | Ja | null nur unter Mindestlänge | SearchClockPort | kein DB-Feld |
| OrderSearchDocument | id | string | Ja | tenantgebundene Auftrags-ID | G04 | `private.v_operational_station_queue_v1.id` hinter Host-Port |
| OrderSearchDocument | orderNumber | string | Ja | kanonische Auftragsnummer | G04 | `private.v_operational_station_queue_v1.order_number` |
| OrderSearchDocument | customerName | string | Ja | belegter Kundenname | G04/G05-Projektion | `private.v_operational_station_queue_v1.customer_name` |
| OrderSearchDocument | title/task/status/station | string/null | je Vertrag | keine Schattenableitung | G04 | gleichnamige View-Felder |
| OrderSearchDocument | dueDate | ISO timestamp/null | Nein | ISO-8601 oder null | G04 | `private.v_operational_station_queue_v1.due_date` |
| OrderSearchDocument | parts | array | Ja | jedes Teil strikt validiert | G04 | `private.v_operational_station_queue_v1.parts` |
| OrderPart | name/material/surfaceRequested | string/null | je Feld | nur persistierte Werte | G04 | JSON-Projektion `parts` |
| CustomerSearchDocument | id | string | Ja | tenantgebundene Kunden-ID | G05 | `private.v_order_intake_customers_v1.id` hinter Host-Port |
| CustomerSearchDocument | customerNumber | string | Ja | kanonische Kundennummer | G05 | `private.v_order_intake_customers_v1.customer_number` |
| CustomerSearchDocument | name/companyName/city/customerType | string/null | je Feld | nur persistierte Werte | G05 | gleichnamige View-Felder |
| NavigationContext | route/query/filter | string/record | Ja | serialisierbar, keine Secrets | G02 App-Komposition | FEHLT im `overlayStore.ts` |
| NavigationContext | scrollX/scrollY | number | Ja | ≥0; pro Ausgangsscreen | G02 App-Komposition | FEHLT im `overlayStore.ts` |
| NavigationContext | focusAnchor | string/null | Nein | stabiler DOM-/Action-Key, keine freie Selektor-Injektion | G02 App-Komposition | FEHLT |

## Datenbank- und Migrationsbezug

G08 führt **keine Migration** aus und besitzt keine View. Der heutige Host liest:

- Orders über `private.v_operational_station_queue_v1`, angelegt in `supabase/migrations/20260811154732_w4_order_station_event_readmodels.sql`;
- Customers über `private.v_order_intake_customers_v1`, angelegt in `supabase/migrations/20260812133649_f1_order_intake_contract.sql`.

Diese Namen sind Ist-Inventar, keine Erlaubnis für G08-Direkt-SQL. Ziel ist je ein öffentlicher TypeScript-Read-Port des besitzenden Moduls; die DB-/RLS-Implementierung bleibt dort.

## Manifest und Handshake

| Datei/Vertrag | SHA-256 (12) | Stand | Bewertung |
|---|---|---|---|
| `02_app/src/modules/suche/suche.manifest.json` | `74F28F485703` | 2026-09-16 | kanonisches internes Modulmanifest; besitzt nichts, hängt von `customers` und `orders` ab |
| `02_app/src/modules/suche/public.ts` | `17773F401DBF` | 2026-09-16 | positive Fassade; für Source-Registry und Correlation-ID zu versionieren |
| `capability.manifest.json` | — | nicht vorhanden | für G08 V1 nicht zusätzlich vorgesehen; Architektur verlangt `<fach>.manifest.json`, kein externer Provider |
| `INTEGRATION_HANDSHAKE.json` | — | nicht vorhanden | kein separater Provider-Handshake; Integration wird durch Manifest, öffentliche Fassaden und Host-Port-Tests belegt |

Eine spätere externe Search-Capability wäre ein neuer Provider-/Capability-Beschluss und benötigte dann ihren eigenen versionierten Handshake. Sie ist nicht Teil von T-04.

## Dienste, Rechte und Secrets

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Kreile Postgres/Supabase über G04/G05-Host-Ports | tenantgebundenes Read nach serverseitiger Identity/RLS | keine G08-eigenen Secrets; Infrastruktur-Namen nur: `DATABASE_URL`, Supabase-Serverkonfiguration | bestehend | keine Remote-Migration, kein RLS-Umbau, kein Service-Role-Fallback durch G08 |
| KI-/Semantik-/Internetprovider | keine | keine | nicht aktiviert | neue Owner-Entscheidung, Kosten-/Region-/Quota-/Real-E2E-Gate erforderlich |
| Dokumentensuche L4 | keine, Port offen | keine | In Klärung | keine Quelle registrieren, keine Dokumente lesen |

## Übertragungsprinzip

Der Kern nimmt ausschließlich provider- und app-neutrale Requests, Source-Definitionen, Dokumente und Ergebnisse an. Kreile registriert Orders/Customers und die V8-/V2-Navigation in seinem HostAdapter. Daten, Konten, Secrets, Rollen, Texte und Ressourcen werden niemals in eine andere Zielapp übernommen; diese implementiert eigene Ports und Registrierungen außerhalb dieses Dossiers.

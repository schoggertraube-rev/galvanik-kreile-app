<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G05 Kunden — Schnittstellen und Daten

## Modulgrenze

G05 besitzt Kundenidentität und Kundenstammdaten. Orders besitzt Aufträge und deren Lebenszyklus; G05 liest nur Projektionen. Accounting/Rechnung verwendet Kundenanschrift, Rechnungsempfänger und Zahlungsziel, besitzt aber die Rechnung. Intake darf G05-Commands aufrufen, besitzt jedoch keine zweite Kundentabelle. Telefonnotizen gehören fachlich zu Customers/Intake, ihr sicherer Schreibvertrag ist noch nicht freigegeben.

## Öffentliche Modul-Ports

| Port | Richtung | Vertrag | Ist-Stand | Regel |
|---|---|---|---|---|
| Customer summary/list read | App → G05 | Kundenliste und Kundenkarte, tenant-/permission-geprüft | gebaut in `src/app/actions/customers.actions.ts` und Customer-Adaptern | Keine private DB-Abfrage aus fremdem Modul. |
| `createCustomer` | Intake/App → G05 server-public | `CreateCustomerInput` → Receipt/Readback | gebaut in `src/modules/customers/server/createCustomerCommand.ts` | Nur serverseitig; Idempotency-ID obligatorisch. |
| Customer public types | G05 → App/Module | Karten-, Status- und Create-Typen | gebaut in `src/modules/customers/public.ts` | Fremdmodule importieren nur `public.ts` beziehungsweise `server-public.ts`. |
| Customer update | App → G05 server-public | erwartete Version + Patch → Receipt/Readback | fehlt | Q-G05-002; kein Repository-Fallback. |
| Duplicate candidates | Intake → G05 | normalisierte Identitätsmerkmale → Kandidaten mit Begründung | fehlt | Q-G05-001; Ergebnis „nicht verfügbar“ ist nicht „keine Dublette“. |
| Order projection | G05 → Orders public read | nächste/aktive Aufträge und Verlauf nach Kunden-ID | teilweise in Customer-Summary realisiert | Nur IDs/Read-Modelle; keine Orders-Felder in G05 schreiben. |
| Phone-note command/read | Intake/Kundenkarte → G05 | Quell-Snapshot, Links, bestätigte Fakten → Receipt/Readback | fehlt/fail-closed | Q-G05-003; vorhandene `phoneNotes.actions.ts` liefern `NOT_AVAILABLE`. |
| Retention proposal/action | Admin → G05 | Fristprüfung → Vorschlag → Adminfreigabe → Receipt | fehlt | Q-G05-006; niemals still ausführen. |

## Host-Ports

| Host-Port | Liefert | Pflichtverhalten |
|---|---|---|
| Session/Tenant | `tenantId`, `personId`, Sessionstatus | Kein Tenant aus Client-Eingabe übernehmen; fehlende Session sperrt fail-closed. |
| Permission | `customers.read`, `customers.create`, künftig `customers.update`, `phone_notes.*`, Retention-Admin | Grundsätzlich Zugriff für alle Personen, individuelle Sperren/Erweiterungen durch Admin; Server ist maßgeblich. |
| Clock/Correlation | Serverzeit, Correlation-ID, Idempotency-ID | Für Events, Receipts, Konflikte und Wiederaufnahme; nicht durch UI-Zeit ersetzen. |
| Orders public read | Auftragsprojektionen nach Kunde | Ausfall erzeugt sichtbaren Teilfehler/leer belegten Zustand, niemals erfundene Aufträge. |
| Conflict sink | standardisierter Startseiten-Bereich | Konflikt mit Objekt, Typ, Zeitpunkt, Korrelation und Zuständigkeit einstellen. |
| Kreile host adapter | Kreile-Bezeichnungen, Navigation und freigegebene UI-Komposition | Generischer Kern bleibt frei von Kreile-Fachbegriffen und Daten anderer Zielapps. |

## Ereignisse

| Ereignis | Produzent | Inhalt minimal | Konsumenten | Stand |
|---|---|---|---|---|
| `CUSTOMER_CREATED_V1` | G05 Create-Command | Tenant, Kunde, Kundennummer, Ersteller, Zeitpunkt, Correlation/Intent | Intake, Suche, Audit/Projektionen | gebaut |
| Customer update event | künftiger G05 Update-Command | noch nicht festgelegt | Suche, Audit/Projektionen | fehlt → Q-G05-002; keinen Namen erfinden |
| Phone-note created event | künftiger Phone-note-Command | noch nicht festgelegt | Kundenkarte, Intake, ggf. Auftragsprojektion | fehlt → Q-G05-003; keinen Namen erfinden |
| Retention action event | künftiger Retention-Command | Entscheidung, Freigeber, Felder/Klasse, erhaltene Geschäftsdaten, Receipt | Audit/Datenschutz | fehlt → Q-G05-006; keinen Namen erfinden |

## Datenmodell

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| Customer | `id` | UUID | ja | Primärschlüssel; niemals fachlich wiederverwenden | G05 | ja, `src/db/schema.ts` / `public.customers` |
| Customer | `tenant_id` | UUID | ja | jede Query und Eindeutigkeit tenant-gebunden | G05/Foundation | ja, Schema und Migration `20260914100000...` |
| Customer | `customer_number` | Text | ja | tenant-eindeutig, atomar aus Counter | G05 | ja, Migration `20260914100000...` |
| Customer | `type` | Enum/Text | ja | nur freigegebene Kundentypen des Vertrags | G05 | ja, Schema/Create-Vertrag |
| Customer | `name` / `company_name` / `contact_person` | Text | bedingt | verständlicher Anzeigename muss vorhanden sein | G05 | ja, Schema/Create-Vertrag |
| Customer | `email` / `phone` | Text nullable | nein | normalisiert; keine Dublettenbehauptung ohne Q-G05-001 | G05 | ja, Schema/Create-Vertrag |
| Customer | `street` / `postal_code` / `city` | Text nullable | vor Versand/Rechnung ja | serverseitiges Gate am Übergang | G05, Gate im Verbraucher | ja im Schema; Create-Vertrag führt derzeit nur `city` |
| Customer | Kommunikationspräferenz | Enum/Text nullable | nein | nur gespeicherter Wert, keine Ableitung aus letztem Kontakt | G05 | ja in `src/db/schema.ts`; nicht im sicheren Create-Vertrag |
| Customer | interne Notiz/Eigenheiten | Text/strukturierter Vertrag | nein | intern, tenant-/permission-geschützt | G05 | `internalNotes`/weitere Legacy-Felder im Schema; kein sicherer Update-Vertrag |
| Customer | Rechnungsempfänger/Zahlungsziel | strukturierte Konfiguration | bedingt | Owner-/Adminänderung, nachvollziehbar; freigegebener Standard | G05 als Kundenkonfiguration | Legacy-Felder vorhanden, Zielvertrag offen → Q-G05-008 |
| CustomerReceipt | Command-/Intent-/Resultdaten | privat, unveränderlich | ja bei Write | tenant- und idempotency-eindeutig; keine UI-Manipulation | G05 | ja, private Tabellen/View in Migration `20260914100000...` |
| CustomerCounter | nächster Nummernwert | privat | ja | atomar je Tenant | G05 | ja, private Tabelle in Migration `20260914100000...` |
| PhoneNote | `id`, `tenant_id`, `customer_id`, optional `order_id`, Rohtext, Metadaten | bestehendes Legacy-Schema | ja/bedingt | kein Produkt-Write ohne Command/Receipt; Aufbewahrungsklasse nötig | G05/Intake | `public.phone_notes` in `src/db/schema.ts`; Produktvertrag fehlt |
| CustomerDocument | Referenz, Art, Quelle, Berechtigung, Frist | noch offen | bedingt | kein Blob/Link ohne freigegebenen Speicher- und Retentionvertrag | G05 | kein freigegebener Vertrag → Q-G05-007 |
| OrderProjection | Order-ID, Status, Termin, Kurztext | Read-Modell | nein | nur aus Orders-Port, nicht G05-persistiert | Orders | nicht als G05-Wahrheit zulässig |

## Manifest und Handshake

- Manifest: `src/modules/customers/customers.manifest.json`, SHA-256 `63F9F9BA042C`, geändert 2026-09-25; besitzt Customer-Tabellen/Receipts/Counter, deklariert Migration und `CUSTOMER_CREATED_V1`.
- Öffentlicher Clientvertrag: `src/modules/customers/public.ts`, SHA-256 `737CFE48C6A0`.
- Öffentlicher Serververtrag: `src/modules/customers/server-public.ts`, SHA-256 `66F5F8D431D9`.
- Create-Implementierung: `src/modules/customers/server/createCustomerCommand.ts`, SHA-256 `991696E616AE`.
- Ein separates Handshake-Dokument/-Artefakt wurde auf `origin/main` nicht gefunden. Der aktuell belegte Handshake besteht aus Manifest plus `public.ts`/`server-public.ts` und den Boundary-/Integrationstests; eine zweite Schnittstelle darf nicht eingeführt werden.

## Dienste und Secrets

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Bestehende serverseitige Postgres/Supabase-Anbindung | Session-/Servicepfad gemäß bestehender Foundation; tenant- und permission-geprüft | kein neues Secret im Modul; Namen bleiben in der Foundation | für Create/Read genutzt | keine Remote-Migration, RLS-Änderung oder Provideranlage aus diesem Dossier |
| Externe KI für Telefonnotiz | keiner freigegeben | keiner | nicht angeschlossen | kein Provider/Secret ohne Owner-Freigabe; Rohnotiz muss auch ohne KI sicher funktionieren |
| Dokument-/Fotospeicher | keiner freigegeben | keiner | nicht angeschlossen | Q-G05-007; keine Ablage in improvisierten Buckets oder Fremdpfaden |

## Übertragbarkeit

Der Customer-Kern verwendet neutrale Customer-/Contact-/Address-/Receipt-Verträge. Kreile-spezifische Bezeichnungen, Prioritäten, Navigationsziele und Host-Komposition bleiben im Kreile-HostAdapter. Andere Zielapps, ihre Zeitmodelle, Begriffe, Konten, Daten und Ressourcen sind ausdrücklich kein Input für dieses Dossier und werden ausschließlich in deren eigenem HostAdapter entschieden.

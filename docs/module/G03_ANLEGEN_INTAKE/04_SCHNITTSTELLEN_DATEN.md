<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Schnittstellen und Daten

## Zielgrenze des Moduls

G03 besitzt den Anlege-/Intake-Ablauf, seine Eingabe- und Receipt-Verträge sowie die UI-Komposition innerhalb des Moduls. Kundenstamm, KV, Auftragsansicht, Katalog, Evidenz, Termin und Berechtigungen bleiben bei ihren jeweiligen Modulen. Der App-Host verbindet ausschließlich öffentliche Fassaden; er enthält keine zweite Validierung oder Datenwahrheit.

### Angebotene Ports

| Zielpfad | Port | Zweck | Rückgabeprinzip |
|---|---|---|---|
| `src/modules/erfassung/public.ts` | `OrderIntakeFlow` / Create-Intent | UI-Einstieg für globales `+` und Wareneingang | kein Write beim Öffnen |
| `src/modules/erfassung/public.ts` | Intake-Typen und Zustände | hostneutrale Eingabe-/Ergebnisverträge | diskriminierte, fail-closed Ergebnisse |
| `src/modules/erfassung/server-public.ts` | `createOrderIntake` | genau einen tenantgebundenen Auftrag anlegen | Command-Receipt oder eindeutiger Fehlercode |
| `src/modules/erfassung/server-public.ts` | `readOrderIntakeReceipt` | unveränderliches Intake-Receipt frisch lesen | kanonischer Readback |
| `src/modules/erfassung/server-public.ts` | `readOrderIntakeStatus` | unbekannten Ausgang read-only prüfen | niemals implizite Wiederholung |

### Benötigte Host-Ports

| Port | Besitzer | Minimaler Vertrag | Ausfallverhalten |
|---|---|---|---|
| `SessionCapabilityPort` | G01/Auth | Tenant, Actor, Profil, Fähigkeiten, ausdrückliche Sperre | fail-closed; kein Write |
| `CustomerSearchPort` | Kundenmodul | Suche nach Name/Kundennummer/Ort; kanonische ID | Fehler ist nicht `leer` |
| `CustomerCreatePort` | Kundenmodul | vollständiger Kunde plus Receipt/Readback | keine lokale Schattenkopie |
| `QuotePort` | KV-Modul | Create/Update/List/Convert mit Version und Receipts | Konflikt statt Last-write-wins |
| `CatalogLookupPort` | Katalogmodul | Vorlage für Position; G03 speichert nur den Auftragssnapshot | Freitext bleibt verfügbar |
| `EvidencePort` | Evidenz-Fundament | reserve/upload/finalize/read für Originalfoto | Auftrag bleibt gültig; Foto zeigt Fehler |
| `AppointmentPort` | App-Terminkern | idempotentes Upsert aus Auftrag und Terminstand | kein Kalenderbesuch erforderlich |
| `M04CalendarProjectionPort` | M04 | spätere, idempotente Outlook-Projektion | optional; App-Wahrheit bleibt führend |
| `M06OcrSuggestionPort` | M06 | Vorschläge mit Konfidenz, nie direkter Write | deaktiviert; manueller Weg bleibt offen |
| `NavigationPort` | App-Host | Auftrags-/Kundenkarte über kanonische ID öffnen | kein URL-Raten im Modul |

## Ereignisse

| Ereignis | Richtung | Besitzer | Inhalt / Regel | Stand |
|---|---|---|---|---|
| `ORDER_INTAKE_CREATED_V1` | G03 → Host | G03/F1.1 | bestehender unveränderlicher Beleg für Auftrag, Kunde, Positionen und `dueDate` | GEBAUT |
| `ORDER_INTAKE_CREATED_V2` | G03 → Host | G03 | Vorwärtsvertrag mit Terminwunsch, Zusagetermin, Eingangsart, Zahlungsmodus, Express und Positionssnapshots; V1 wird nicht still verändert | SPEZ |
| Kunden- und KV-Receipts | Host-Ports → G03 | Kunden-/KV-Modul | G03 prüft IDs/Versionen und zeigt Erfolg erst nach Readback | GEBAUT |
| Termin-Projektionsbeleg | App-Terminkern → G03/Startseite | Terminmodul | bestätigt nur die App-Projektion; keine neue Auftragswahrheit | SPEZ |
| Outlook-Projektionsbeleg | M04 → App-Terminkern | M04 | technische Projektion des App-Termins; darf den Auftrag nicht überschreiben | GEPLANT |

## Datenvertrag

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| CustomerRef | `id` | string | Ja | tenantgebunden; Bestands-ID unverändert | Kundenmodul | Ja, `public.customers.id` |
| NewCustomer | `name` / `company_name` | text | Ja | getrimmt; kanonischer Anzeigename | Kundenmodul | Ja, `public.customers` |
| NewCustomer | `contact_person` | text/null | Nein | kein stiller Ersatz durch Firma | Kundenmodul | Ja, `public.customers.contact_person` |
| NewCustomer | `phone` / `email` | text/null | Nein | serverseitig normalisiert; Dublettenprüfung nur warnend | Kundenmodul | Ja, `public.customers.phone/email` |
| NewCustomer | `street` / `zip_code` / `city` | text/null | Bedingt | spätestens vor Versand/Rechnung vollständig | Kundenmodul | Ja, `public.customers` |
| Quote | `id` / `quote_number` | uuid/text | Ja | tenantgebunden; `KV-JJJJ-NNNN` | KV-Modul | Ja, `private.quotes` |
| Quote | `due_date` | date | Ja | Terminwunsch | KV-Modul | Ja, `private.quotes.due_date` |
| QuotePosition | `name` / `quantity` / `material` / `surface_requested` | text/int/text?/text | Ja | 1–20; Snapshot statt Live-Katalogreferenz | KV-Modul | Ja, `private.quote_positions` |
| QuotePosition | `unit_price_cents` | integer | Ja | ≥0; serverseitige Nettosumme | KV-Modul | Ja, `private.quote_positions` |
| IntakeInput | `clientEventId` | UUID | Ja | stabil bis eindeutig bestätigter Ausgang; Intent-Hash bindet Inhalt | G03 | Ja, Command und `private.order_intake_receipts` |
| IntakeOrder | `order_number` | text | Ja | `A-JJJJ-NNNN`; Advisory Lock + UNIQUE | Auftragskern/G03 | Ja, `public.orders.order_number` |
| IntakeOrder | `due_date` | date | Ja | Terminwunsch | Auftragskern/G03 | Ja; heutiger Command nutzt es noch als Zusagetermin |
| IntakeOrder | `promised_due_date` | timestamptz/date | Ja | zugesagter Termin, getrennt vom Wunsch | Auftragskern/G03 | Ja, `public.orders.promised_due_date`; noch nicht im Intake-Command |
| IntakeOrder | `delivery_method` | enum text | Ja | `abholung` oder `versand`; UI-Text `persönlich/Abholung` bzw. `Versand` | Auftragskern/G03 | Ja, `public.orders.delivery_method`; noch nicht im Intake-Command |
| IntakeOrder | `payment_mode` | enum text | Ja | `abholung`, `vorkasse`, `rechnung`; Serverregel OE-2609-07/11 | Auftragskern/G03 | Ja, F1.5-Migration; Command setzt heute immer `vorkasse` |
| IntakeOrder | `priority` | enum text | Ja | exakt `normal` oder `express`; keine Ableitung aus Farbe | Auftragskern/G03 | Ja, `public.orders.priority`; noch nicht im Intake-Command |
| IntakeOrder | `note` | text/null | Nein | maximal 2000 Zeichen; keine Telefontranskription erfinden | G03 | Ja, `public.orders.freetext_original` und Receipt |
| IntakeItem | `id` / `position` | string/int | Ja | genau 1–20, stabile Reihenfolge | G03 | Ja, `public.items` und Receipt-Snapshot |
| IntakeItem | `name` | text | Ja | 2–160 Zeichen; Katalogwahl wird als Snapshot kopiert | G03 | Ja, `public.items.name` |
| IntakeItem | `quantity` | integer | Ja | >0 | G03 | Ja, `public.items.quantity` |
| IntakeItem | `material` | text/null | Nein | getrimmt | G03 | Ja, `public.items.material` |
| IntakeItem | `surfaceRequested` | text | Ja | 2–160 Zeichen | G03 | Ja, `public.items.surface_requested` |
| IntakeReceipt | Zielzustandsfelder | JSON/Spalten | Ja | enthält alle entscheidungsrelevanten Inputs und aktuellen kanonischen Werte | G03 | Teilweise, `private.order_intake_receipts`; Vorwärtsmigration für V2 nötig |
| InputPhoto | `sha256` / MIME / Bytes / Zielposition | text/text/int/string | Bei Datei | JPEG/PNG/WebP, 1 Byte–12 MiB, exakt eine Zielposition | Evidenz-Fundament | Ja, Evidenz-/Attachment-Vertrag und Bucket `item-photos` |
| AppointmentProjection | Auftrag-ID / Wunsch / Zusage / Version | string/date/date/int | Ja | idempotent; App-Wahrheit führend | App-Terminkern | Port/Manifest zu ergänzen; keine G03-Tabelle |

### Abbildungsregeln

- Katalog und Freitext münden in denselben unveränderlichen Positionssnapshot. G03 erfindet keine zweite Katalogtabelle und bindet historische Aufträge nicht an später veränderliche Katalognamen.
- `due_date` ist im Ziel der Terminwunsch; `promised_due_date` ist die Zusage. Der heutige F1.1-Kommentar, der `due_date` als Zusage verwendet, ist beim V2-Vertrag bewusst zu korrigieren und durch Migration/Tests abzusichern.
- Für belegte V1-Intakes wird der bisherige `due_date` vorwärtsgerichtet nach `promised_due_date` kopiert und danach `due_date=NULL` als „Terminwunsch nicht separat erfasst“ gelesen; es wird kein historischer Wunsch erfunden. Die Remote-Migration ist nicht Teil dieses Dossiers und braucht das vorgesehene Freigabe-Gate.
- `payment_mode=abholung` bedeutet im Intake `bar oder Karte bei Abholung`; die tatsächlich verwendete Zahlungsart entsteht ausschließlich im F1.5-Kassiervorgang.
- Bestehende Migrationen werden nicht umgeschrieben. Neue Felder im Receipt und V2-Ereignis entstehen ausschließlich per vorwärtsgerichteter Migration.

## Manifest und Handshake

| Artefakt | Pfad | SHA-256 (12) | Bewertung |
|---|---|---|---|
| heutiges Vor-Path1-Manifest | `docs/architecture/modules/erfassung.manifest.json` | `B5E2ED819109` | ÜBERHOLT: Version 0.1 bindet OCR-/Scan-Verantwortung an G03 und besitzt keine aktuellen Ports/Events |
| Zielmanifest | `src/modules/erfassung/erfassung.manifest.json` | — | beim Bau anzulegen; deklariert nur G03-Ports, V1/V2-Events und zulässige Modulabhängigkeiten |
| Integrations-Handshake | kein separates `INTEGRATION_HANDSHAKE.json` auf `origin/main` | — | für das Grundstamm-Modul nicht als zweite Wahrheit erfinden; Manifest plus automatisierter Import-/Contract-Test ist der Handshake |
| Kundenmanifest | `src/modules/customers/customers.manifest.json` | per Builder am exakten Implementierungs-SHA neu zu belegen | gültiger Fremdbesitz; nur Public-Fassade importieren |
| KV-Manifest | `src/modules/quotes/quotes.manifest.json` | per Builder am exakten Implementierungs-SHA neu zu belegen | gültiger Fremdbesitz; nur Public-Fassade importieren |

## Provider

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Supabase PostgreSQL | ausschließlich serverseitige, tenantgebundene Command-/Read-Ports | `NEXT_PUBLIC_SUPABASE_URL`; `SUPABASE_SERVICE_ROLE_KEY` | vorhanden; keine Provideranlage durch dieses Dossier | keine Remote-Migration, RLS-Änderung oder Echtdatenmutation ohne ausdrückliche Freigabe |
| Supabase Storage `item-photos` | signierte, zweiphasige Originalablage über Evidenz-Port | dieselben bestehenden Supabase-Konfigurationsnamen; kein zusätzlicher G03-Secretname | bestehender Vertrag | kein Direktzugriff oder Bucket-Umbau aus G03 |
| Microsoft Graph / Kreile-Büropostfach | M04 liest Betriebs-/Abwesenheitstermine und schreibt Auftragstermin-Projektionen | kein G03-Secret; Namen werden ausschließlich im M04-Dossier festgelegt | In Aufbau | Consent, Provideraktivierung und Postfachrechte nur nach Owner-/M04-Gate |
| Azure Document Intelligence / OCR | M06 liefert nur Vorschläge | kein G03-Secret; Namen werden ausschließlich im M06-Dossier festgelegt | In Aufbau | keine Provideranlage, kein Upload und kein automatischer Write aus G03 |

## Übertragbarkeit

Die öffentlichen G03-Verträge sprechen von Customer, Quote, Order, Item, Receipt, Appointment und Evidence. Kreile-spezifische Rollen, Wortwahl, Büropostfach, Zahlungsregel und Katalogabbildung liegen im Kreile-HostAdapter. Der Kern enthält weder andere Zielapps noch deren Datenmodelle, Zeitbegriffe, Konten oder Secrets.

<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 04 — Schnittstellen und Daten

## Modulschnitt

Ziel ist `src/modules/settings/` gemäß Path 1. `src/app/settings/page.tsx` bleibt dünner Next-Einstieg; `SettingsAppAdapter.tsx` komponiert ausschließlich öffentliche Fassaden. G10 besitzt nur echte globale Einstellungen, die nach den Q-Gates ausdrücklich G10 zugeordnet werden. Kunden-, Auftrags-, Rechnungs-, Rechte-, Mehrarbeits- und Providerwahrheiten bleiben bei ihren Fachmodulen.

### Öffentliche G10-Ports

| Port / Export | Richtung | Vertrag | Stand |
|---|---|---|---|
| `SettingsAdminView` | G10 → AppAdapter | Ziel-UI mit typisierten Port-Props, ohne Datenzugriff im Client | SPEZ |
| `getSettingsOverview` | G10 → AppAdapter | Tenant-/Actor-gebundene Bereichszustände, Konflikte und Capability-Version | SPEZ |
| `getCompanySettings` | G10 → G07/AppAdapter | genau eine Firmenprojektion mit Vollständigkeitsstatus und Version | SPEZ; Datenbasis vorhanden |
| `updateCompanySettings` | AppAdapter → G10 | Admin-Command mit Patch, `expectedVersion`, `clientEventId`, Receipt, Readback | SPEZ; Ist-Action deaktiviert |
| `getPaymentPolicy` / `updatePaymentPolicy` | G10 ↔ G07/AppAdapter | aktive 2/10/14-Policy, versioniert; Write nur Admin | FEHLT → Q-G10-006 |
| `getRetentionPolicies` / `updateRetentionPolicy` | G10 ↔ AppAdapter | versionierte Regeln je Dokumentart | FEHLT → Q-G10-007 |
| `getRetentionProposals` / `approveRetentionProposal` | G10 ↔ besitzendes Fachmodul | nur Vorschlag/Freigabe; Fachcommand führt aus | FEHLT → Q-G10-007 |
| `getLiquidityInputs` / `configureRunningCost` / `recordAccountBalance` | G10 ↔ M03/AppAdapter | Admin-only manuelle Kosten und datierter Kontostand | FEHLT → Q-G10-008 |

### Von G10 benötigte Host-/Fachports

| Port | Besitzer | Nutzung in G10 | Schreibgrenze |
|---|---|---|---|
| `ActorCapabilityPort` | G01 Fundament/Rechte | Actor, Tenant, effektive Fähigkeit, Adminstatus | G10 schreibt keine Rolle |
| `PersonAccessAdminPort` | G01 Fundament/Rechte | Personen/Fähigkeiten lesen und persönliche Allow/Deny-Policy ändern | ausschließlich G01-Command |
| `CustomerInvoiceTermsPort` | G05 Customers | Zielrechnungs-Freigabe lesen; Link zur Kundenpflege | ausschließlich G05-Command |
| `OrderNumberSequenceReadPort` | G04 Orders | `A-`-Status read-only | kein G10-Write/Reset |
| `InvoiceNumberSequenceReadPort` | G07 Accounting | `R-`-Status read-only | kein G10-Write/Reset |
| `PaymentPolicyConsumerPort` | G07 Accounting | aktive Policy beim neuen Snapshot übernehmen | bestehende Rechnungen unverändert |
| `ExtraWorkAdminPort` | G04 Orders/Accounting-Vertrag | gebauten Katalog und Satz lesen/ändern | vorhandene Extra-Work-Commands |
| `RetentionExecutionPort` | jeweiliges Fachmodul | freigegebenen Vorschlag fachlich ausführen | keine direkte Fremdtabellenmutation |
| `ProtectedPayrollSummaryPort` | geschützte Gehaltsplanung | ausschließlich freigegebene Personalkostensumme | keine Person-/Gehaltsdetails |
| `PaymentAdapterStatusPort` | später M01 | Terminalstatus nach Owner-Gate | keine Zahlungskanonisierung |
| `BankSuggestionPort` | später M01 | Kontostand/Abbuchung als bestätigungspflichtiger Vorschlag | nie automatischer Write |
| `ConflictProjectionPort` | G09 | Settings-Konflikte publizieren und quittieren | keine zweite Konfliktwahrheit |

## Ereignisse

Ereignisnamen sind Sollverträge für den Builder; sie behaupten keinen gebauten Stand. Jedes Ereignis trägt mindestens `eventId`, `tenantId`, `actorId`, `occurredAt`, `aggregateId`, `aggregateVersion`, `clientEventId` und die fachlichen geänderten Felder, aber keine Secrets oder kompletten sensiblen Vorher-/Nachher-Datensätze.

| Ereignis | emittiert von | konsumiert von | Zweck / Nutzlast |
|---|---|---|---|
| `COMPANY_SETTINGS_UPDATED_V1` | G10 | G07, G09 | geänderte Feldnamen, neue Version, Vollständigkeitsstatus |
| `PAYMENT_POLICY_UPDATED_V1` | G10 | G07, G09 | Basispunkte, Skontotage, Nettoziel, Version |
| `PERSON_ACCESS_UPDATED_V1` | G01 | G10, Shell, G09 | Person, Fähigkeit, `inherit/allow/deny`, effektives Ergebnis |
| `EXTRA_WORK_CATALOG_CONFIGURED_V1` | vorhandener Extra-Work-Command | G10, G04/G07 | Position, Aktivstatus, Standardminuten, Version |
| `EXTRA_WORK_RATE_SET_V1` | vorhandener Extra-Work-Command | G10, G04/G07 | neue Rate-ID, Centbetrag, Wirksamkeit |
| `RETENTION_POLICY_UPDATED_V1` | G10 | betroffene Fachmodule, G09 | Dokumentart, Fristregel, neue Version |
| `RETENTION_ACTION_PROPOSED_V1` | G10-Prüflauf | G10, G09 | Objektref, Grund, Aktion, Fälligkeit; keine Mutation |
| `RETENTION_ACTION_APPROVED_V1` | G10 | besitzendes Fachmodul, G09 | Vorschlag, Admin, Zielcommand und Receipt-Referenz |
| `RUNNING_COST_CONFIGURED_V1` | G10 | M03 | Kosten-ID, Betrag/Rhythmus/Fälligkeit, Version |
| `ACCOUNT_BALANCE_RECORDED_V1` | G10 | M03 | Betrag, Stichtag, Erfassungszeit, Version |

## Felder und Besitz

`Ist im Schema` bezeichnet die vorhandene `origin/main`-Referenz, nicht eine Freigabe für direkte Nutzung. `FEHLT`-Zeilen werden nicht durch JSON-Schattenfelder ersetzt.

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| `CompanySettings` | `id` | string | ja | stabil; genau eine Zeile je Tenant | G10 | ja: `src/db/schema.ts#company_settings.id` |
| `CompanySettings` | `tenantId` | string | ja | Actor-Tenant; Unique-Ziel je Tenant | G10 | ja: `company_settings.tenant_id`; Unique je Tenant fehlt |
| `CompanySettings` | `version` | integer | ja | ≥1; atomare Erhöhung | G10 | FEHLT → Update-Vertrag |
| `CompanySettings` | `companyName` | string | ja | getrimmt, nicht leer | G10 | ja: `company_settings.company_name` |
| `CompanySettings` | `street` | string | ja | getrimmt, nicht leer | G10 | ja: `company_settings.street` |
| `CompanySettings` | `zip` | string | ja | getrimmt, nicht leer | G10 | ja: `company_settings.zip` |
| `CompanySettings` | `city` | string | ja | getrimmt, nicht leer | G10 | ja: `company_settings.city` |
| `CompanySettings` | `country` | string | ja | getrimmt, nicht leer | G10 | ja: `company_settings.country` |
| `CompanySettings` | `taxId` | string | ja | F1.4-Pflicht; finale E-Rechnungssemantik Q-G10-004 | G10 | ja: `company_settings.tax_id` |
| `CompanySettings` | `vatId` | string/null | offen | nur wenn finaler ZUGFeRD-Feldsatz es fordert | G10 | FEHLT → Q-G10-004 |
| `CompanySettings` | `email` | string/null | fachlich offen | gültige elektronische Adresse, falls Profil verlangt | G10 | ja: `company_settings.email`; nicht F1.4-Pflicht |
| `CompanySettings` | `phone` | string/null | nein | getrimmt | G10 | ja: `company_settings.phone` |
| `CompanySettings` | `iban` | string | ja | F1.4-Pflicht; serverseitig validieren | G10 | ja: `company_settings.iban` |
| `CompanySettings` | `bic` | string | ja | F1.4-Pflicht; serverseitig validieren | G10 | ja: `company_settings.bic` |
| `CompanySettings` | `bankName` | string | ja | getrimmt, nicht leer | G10 | ja: `company_settings.bank_name` |
| `CompanySettings` | `invoiceVatRateBasisPoints` | integer | ja | bestehend nur 700 oder 1900 | G10/G07-Vertrag | ja: F1.4-Migration; Drizzle-Schema fehlt |
| `CompanySettings` | `invoicePaymentTermDays` | integer | ja für F1.4 | 1…365; Zielwert fachlich 14 nur bei Zielrechnung | G10/G07-Vertrag | ja: F1.4-Migration; Drizzle-Schema fehlt |
| `CompanySettings` | `updatedAt` | timestamp | ja | Serverzeit mit Zeitzone | G10 | ja: `company_settings.updated_at` |
| `CompanySettings` | `updatedBy` | uuid | ja | Actor aus Serverkontext | G10 | FEHLT → Update-Vertrag |
| `PaymentPolicy` | `tenantId` | string | ja | genau eine aktive Version je Tenant | G10 | FEHLT → Q-G10-006 |
| `PaymentPolicy` | `version` | integer | ja | append-only/atomar aktiv | G10 | FEHLT → Q-G10-006 |
| `PaymentPolicy` | `pickupMethods` | enum[] | ja | exakt `cash`,`card` | G10 | FEHLT; OE-2609-07 |
| `PaymentPolicy` | `otherwiseMode` | enum | ja | exakt `prepayment` | G10 | FEHLT; OE-2609-07 |
| `PaymentPolicy` | `discountBasisPoints` | integer | ja | Startwert 200; 0…10000 | G10 | FEHLT → Q-G10-006 |
| `PaymentPolicy` | `discountDays` | integer | ja | Startwert 10; ≥0 | G10 | FEHLT → Q-G10-006 |
| `PaymentPolicy` | `netDays` | integer | ja | Startwert 14; 1…365 | G10 | FEHLT → Q-G10-006 |
| `PaymentPolicy` | `effectiveAt` | timestamp | ja | nur neue Snapshots ab Wirksamkeit | G10 | FEHLT → Q-G10-006 |
| `CustomerInvoicePermission` | `customerId` | string | ja | Tenant-Kunde muss existieren | G05 | FEHLT; untypisiertes `customers.payment_profile` wird nicht verwendet |
| `CustomerInvoicePermission` | `enabled` | boolean | ja | Default false | G05 | FEHLT → Q-G10-003 |
| `CustomerInvoicePermission` | `version` | integer | ja | Audit/Lost-update | G05 | FEHLT → Q-G10-003 |
| `PersonAccessPolicy` | `personId` | uuid | ja | G01-Person im selben Tenant | G01 | `app_users.id` vorhanden; Policy fehlt |
| `PersonAccessPolicy` | `capabilityKey` | string | ja | registrierte Capability | G01 | FEHLT → Q-G10-002 |
| `PersonAccessPolicy` | `decision` | enum | ja | `inherit`,`allow`,`deny` | G01 | FEHLT → Q-G10-002 |
| `PersonAccessPolicy` | `version` | integer | ja | pro Person/Policy atomar | G01 | FEHLT → Q-G10-002 |
| `NumberSequenceProjection` | `kind` | enum | ja | `order`,`invoice` | G04/G07 | Quellen getrennt vorhanden; gemeinsame View fehlt |
| `NumberSequenceProjection` | `prefix` | string | ja | `A` oder `R` | G04/G07 | `orders.order_number`; `private.invoice_number_sequences` |
| `NumberSequenceProjection` | `year` | integer | ja | vierstellig | G04/G07 | Rechnung ja; Auftrag aus Nummer/Allocator zu belegen |
| `NumberSequenceProjection` | `lastAllocated` | integer/null | ja | read-only, ≥0 | G04/G07 | Rechnung ja; Auftrag Q-G10-010 |
| `ExtraWorkCatalogPosition` | `id` | uuid | ja | stabil | G04/Accounting-Vertrag | ja: F1.3-Migration |
| `ExtraWorkCatalogPosition` | `name` | string | ja | tenantweit case-insensitive unique | G04/Accounting-Vertrag | ja: F1.3-Migration |
| `ExtraWorkCatalogPosition` | `standardMinutes` | integer | ja | positiver Vertragsbereich des Commands | G04/Accounting-Vertrag | ja: F1.3-Migration |
| `ExtraWorkCatalogPosition` | `active` | boolean | ja | Deaktivieren statt Löschen | G04/Accounting-Vertrag | ja: F1.3-Migration |
| `ExtraWorkCatalogPosition` | `version` | integer | ja | expectedVersion | G04/Accounting-Vertrag | ja: F1.3-Migration |
| `ExtraWorkHourlyRate` | `hourlyRateCents` | integer | ja | positiver Centbetrag, append-only | G04/Accounting-Vertrag | ja: F1.3-Migration |
| `RetentionPolicy` | `documentKind` | enum/string | ja | geschlossene, bestätigte Dokumentartenliste | G10 | FEHLT → Q-G10-007 |
| `RetentionPolicy` | `yearsAfterYearEnd` | integer | ja | Vorbelegung 8/6/3 je Art; Werte vor Live bestätigen | G10 | FEHLT → Q-G10-007 |
| `RetentionPolicy` | `legalHoldUntil` | date/null | nein | kann Vorschlag nur verschieben | G10 | FEHLT → Q-G10-007 |
| `RetentionPolicy` | `postRetentionAction` | enum | ja | `anonymize`,`delete`,`review`; nie automatisch | G10 | FEHLT → Q-G10-007 |
| `RetentionPolicy` | `version` | integer | ja | versioniert, historisch lesbar | G10 | FEHLT → Q-G10-007 |
| `RetentionProposal` | `id` | uuid | ja | stabil/idempotent | G10 | FEHLT → Q-G10-007 |
| `RetentionProposal` | `objectRef` | typed reference | ja | Tenant, Besitzer, Objekt-ID | G10 + Fachmodul | FEHLT → Q-G10-007 |
| `RetentionProposal` | `action` | enum | ja | `anonymize` oder `delete` | G10 | FEHLT → Q-G10-007 |
| `RetentionProposal` | `dueAt` | date | ja | nach Frist und ohne Hemmung | G10 | FEHLT → Q-G10-007 |
| `RetentionProposal` | `status` | enum | ja | `proposed`,`approved`,`rejected`,`executed`,`failed` | G10 | FEHLT → Q-G10-007 |
| `RunningCost` | `id` | uuid | ja | stabil | offen, Empfehlung G10 | FEHLT → Q-G10-008 |
| `RunningCost` | `label` | string | ja | getrimmt, nicht leer | offen, Empfehlung G10 | FEHLT → Q-G10-008 |
| `RunningCost` | `amountCents` | integer | ja | ≥0, Währung EUR | offen, Empfehlung G10 | FEHLT → Q-G10-008 |
| `RunningCost` | `rhythm` | enum/string | ja | Werte noch festzulegen | offen, Empfehlung G10 | FEHLT → Q-G10-008 |
| `RunningCost` | `dueRule` | typed value | ja | Semantik noch festzulegen | offen, Empfehlung G10 | FEHLT → Q-G10-008 |
| `RunningCost` | `version` | integer | ja | erwartete Version | offen, Empfehlung G10 | FEHLT → Q-G10-008 |
| `AccountBalanceSnapshot` | `amountCents` | integer | ja | vorzeichenbehaftet, EUR | offen, Empfehlung G10 | FEHLT → Q-G10-008 |
| `AccountBalanceSnapshot` | `asOf` | date | ja | nicht nach Erfassungsdatum in der Zukunft | offen, Empfehlung G10 | FEHLT → Q-G10-008 |
| `AccountBalanceSnapshot` | `recordedAt` | timestamp | ja | Serverzeit | offen, Empfehlung G10 | FEHLT → Q-G10-008 |
| `AccountBalanceSnapshot` | `recordedBy` | uuid | ja | Admin-Actor | offen, Empfehlung G10 | FEHLT → Q-G10-008 |
| `AccountBalanceSnapshot` | `source` | enum | ja | Start `manual`; später bestätigter Bankvorschlag | offen, Empfehlung G10 | FEHLT → Q-G10-008 |
| `PayrollSummary` | `totalPersonnelCostCents` | integer | ja | ausschließlich freigegebene Summe | geschützte Gehaltsplanung | FEHLT; kein G10-Einzelgehalt |

## Manifest und Handshake

| Artefakt | Sollpfad | Ist/Hash | Builder-Regel |
|---|---|---|---|
| Modulmanifest | `src/modules/settings/settings.manifest.json` | FEHLT; kein Hash | nach `docs/architecture/MODULE_MANIFEST.schema.json` (`94962E694CBB`) anlegen; alle Exporte, Besitzer, Views, Events, Migrationen und Abhängigkeiten deklarieren |
| Öffentliche Fassade | `src/modules/settings/public.ts` | FEHLT; kein Hash | ausschließlich explizite Exporte, kein `export *`; einzig zulässige Cross-Modul-Naht |
| App-Handshake | `src/app/settings/SettingsAppAdapter.tsx` | vorhanden `D5C04CD018C6`, aber nur Fundamentstatus | auf typisierte öffentliche Ports reduzieren; keine Fachlogik/Tiefimporte |
| separates `INTEGRATION_HANDSHAKE.json` | kein Sollpfad | existiert repo-weit nicht | nicht erfinden; Manifest + `public.ts` + typisierter AppAdapter sind der Path-1-Handshake |
| bestehendes Fundamentmanifest | `src/modules/fundament/fundament.manifest.json` | `21F42C421462` | nicht zur G10-Besitzwahrheit aufblasen; G01-Port öffentlich ergänzen |

## Provider und Secrets

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Supabase/Postgres | ausschließlich tenantgebundene Reads/Commands und RLS der deklarierten G10-Objekte | vorhandene Serverkonfiguration; keine neuen G10-Secrets | Plattform vorhanden; G10-Verträge teils FEHLT | Remote-Migration/RLS nur mit ausdrücklicher Freigabe |
| Kartenterminal | Gerätestatus/Payment-Intent nur über `PaymentAdapter`; konkrete Scopes FEHLT | `FEHLT → Q-G10-009` | `MollieAdapter` ist `NOT_AVAILABLE`, kein Terminal | Anbieter, Vertrag, Kosten, Consent, Secrets und Real-E2E = Owner-Gate |
| Bank | Kontostand und wiederkehrende Abbuchungen nur als Vorschlag; konkrete Scopes FEHLT | `FEHLT → Q-G10-009` | nicht angebunden | Bankzustimmung, Kosten, Anbieter, Secrets und Real-E2E = Owner-Gate |
| Microsoft-Postfach | keine Delete-/Anonymize-/Mailbox-Scopes in G10 | keiner | ausdrücklich nicht betroffen | OE-2609-20; kein G10-Zugriff |
| ZUGFeRD-Validator | lokale/gekapselte Validierung nach G07-Vertrag; Profil FEHLT | keiner festgelegt | nicht gebaut | Profil/Version und OP-13-Freigabe vor Live |

## Übertragbarkeitsregeln

- Port- und Ereignistypen verwenden `tenantId`, Actor und Capability-Keys, nie `galvanik-kreile`, Rolf, Phillip oder Gregor als Kernliteral.
- Währung, Texte, sichtbare Personen, erlaubte Zahlungsmodi und Dokumentarten werden vom Kreile-HostAdapter beziehungsweise versionierter Kreile-Konfiguration geliefert.
- Andere Apps liefern ihre eigenen HostAdapter; ihre Fachmodelle werden nicht in G10 übernommen.
- Secrets bleiben serverseitig und werden nur namentlich in Deployment-Konfiguration referenziert; Receipt, Readback, Log und DOM enthalten keinen Wert.
- Kein Port fällt bei Fehlern auf Demo-, LocalStorage-, Legacy- oder Providerdaten zurück.

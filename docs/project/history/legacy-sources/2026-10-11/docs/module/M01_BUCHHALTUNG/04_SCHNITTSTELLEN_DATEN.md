<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M01_BUCHHALTUNG — Schnittstellen und Daten

## Architekturgrenze

M01 besitzt keine eigene Schattenwahrheit für Rechnung oder Zahlung. Der app-neutrale Core kennt nur Verträge; der Kreile-HostAdapter bindet Autorisierung, Tenant, vorhandene Reads/Commands, Datenbank und Provider. Provider-SDKs, Kreile-Routen, Tabellen und Rollen dürfen den Core nicht erreichen.

Candidate.2 ist mit Core-SHA-256 `cada15a2541b215bb2554003b5fcce605334eaef9680879291092ed08597ddcc` verifiziert, aber `OFF_REPO_CANDIDATE_NOT_ADOPTED`. Seine Schnittstellen sind damit Vertragskandidat, keine Produktbehauptung.

## Vom Candidate.2 angebotene öffentliche Verträge

| Vertrag | Zweck | Mutiert? | Receipt/Readback | Produktstand |
|---|---|---|---|---|
| `public.ts`: `ACCOUNTING_*_V1`, `isMoneyV1`, `isReadEnvelopeV1` und exportierte DTO-Typen | Client-/Consumervertrag für Fähigkeiten, Fehler, Geld, Reads und konkrete Receipts | nein | `ReadEnvelopeV1<T>` sowie konkrete Receipt-Typen | gebaut im Off-Repo-Kandidaten; nicht adoptiert |
| `server-public.ts`: `createAccountingCoreServerV1` | erzeugt `AccountingCoreServerV1` über genau einen `AccountingHostAdapterV1` | delegiert | `CommandResultV1<TReceipt>` plus Hostreads | gebaut im Off-Repo-Kandidaten; nicht adoptiert |
| `server-public.ts`: `evaluateCancelSafetyV1`, `validateCancelStateV1` | fail-closed Stornoprüfung | nein | validierter `InvoiceCancelStateV1` / Precondition | gebaut im Off-Repo-Kandidaten; nicht adoptiert |
| `server-public.ts`: konkrete Receipt-Validatoren | bestehende Invoice-/Paymentreceipts gegen Vertrag prüfen | nein | typisierte konkrete Receipts | gebaut im Off-Repo-Kandidaten; nicht adoptiert |
| `server-public.ts`: `decideReceiptRecoveryV1` | unbekannten Ausgang anhand eines frischen Hostreads auflösen | nein | `ReceiptRecoveryDecisionV1<TReceipt>` | gebaut im Off-Repo-Kandidaten; nicht adoptiert |

Die Hostports `ExistingAccountingReadPortV1`, `ExistingAccountingCommandPortV1` und `AccountingGovernancePortV1` werden **benötigt**, nicht angeboten; sie sind gemeinsam Bestandteil des benötigten `AccountingHostAdapterV1`.

## Vom Kreile-Host bereitzustellende Verträge

| Vertrag/Capability | Datenverantwortung | Pflicht vor Adoption | Status |
|---|---|---|---|
| `host.authorization-context.v1` | Tenant, Actor, personenbezogene Rechte, Correlation | ja | Produktadapter fehlt |
| `host.accounting-existing-reads.v1` | kanonische Invoice-/Paymentreads aus bestehenden Facts | ja | Einzelreads bestehen; öffentlicher HostAdapter fehlt |
| `host.accounting-existing-commands.v1` | bestehende Issue-/Cancel-/Confirm-Commands | ja | Commands bestehen; Adapter/Receipt-Nachweis unvollständig |
| `host.governance.v1` | Manifest-, Import-, Denylist- und Gateprüfung | ja | Produktintegration fehlt |
| `DOCUMENT_ORIGINAL_V1` | privates, unverändertes Dokumentoriginal | vor Slice C | Vertrag/Storage fehlt → Q-M01-007 |
| `PAYMENT_ADAPTER_V1` | Terminal, Bank und später Mollie hinter Accounting | vor jeweiligem Provider | Anbieter/Vertrag/Secrets fehlen → Q-M01-005/006 |
| `COMMUNICATION_SEND_V1` | Zustellung freigegebener Mahnung | vor Slice E | gehört außerhalb M01; Vertrag fehlt → Q-M01-003 |
| `PAYROLL_PREP_READ_V1` | geschütztes Personalkostenaggregat | vor Liquiditätsintegration | Adoption fehlt → Q-M01-012 |
| `M01_LIQUIDITY_FACTS_READ_V1` | M01-Fakten für M02, keine Prognose | vor M02-Liquidität | Schema/Persistenz fehlt → Q-M01-009 |

Die großgeschriebenen Namen der noch fehlenden Ports sind Dossier-Bezeichner, keine Behauptung bereits ratifizierter Exportnamen. Der Builder muss ihren endgültigen Namen am jeweiligen Strukturgate festlegen und manifestieren.

## Kanonische Ereignisse und Receipts

| Ereignis/Receipt | Owner | Stand | Regel |
|---|---|---|---|
| `INVOICE_CREATED_V1` / `INVOICE_CREATED_V2` | G07/Accounting-Bestand | vorhanden | V2 unabhängigen Host-Readback nachweisen |
| `INVOICE_CANCELLED_V1` | G07/Accounting-Bestand | vorhanden | nur eindeutig unbezahlt; DB-Zweitschicht fehlt noch |
| `PAYMENT_CONFIRMED_V1` | G07/Accounting-Bestand | vorhanden | manuelle und Adapterzahlungen münden in dieselbe Wahrheit |
| `PAYMENT_MODE_SET_V1` | G07/Bestellung | vorhanden | kein Paymentreceipt; nur Zahlungsartwahl |
| Payment-Reversal-Ereignis | M01/Accounting | FEHLT → Q-M01-001 | additiv gegen konkretes Paymentreceipt; Name nicht erfinden |
| Credit-Note-Receipt | M01/Accounting | GEPLANT | additiv gegen Originalrechnung; endgültiger Name am A4-Gate |
| Refund-Receipt | M01/PaymentAdapter | GEPLANT | getrennt von Gutschrift; `failed/unknown/succeeded` |
| Bank-Movement-/Assignment-/Reversal-Receipts | M01/Accounting | GEPLANT | unveränderliche Bewegung, append-only Zuordnung und Rücknahme |
| Document-Original-/Proposal-Receipts | DOCUMENT_ORIGINAL/Intake | GEPLANT | Original und Vorschlag getrennt |
| Cost-/Dunning-/Export-Receipts | M01/Accounting | FEHLT → Q-M01-002/003/004 | erst nach jeweiligem Gate benennen/exportieren |

## Datenmodell-Feldliste und Soll-Ist-Abgleich

Typ- und Feldnamen der Candidate.2-Zeilen sind exakt aus `src/dtos.ts`. Bei noch gesperrten Slices kennzeichnet **Arbeitsname** nur die benötigte Feldsemantik; der Builder darf daraus vor Schließen der genannten Q-Frage weder Tabelle noch öffentlichen Vertrag ableiten.

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| `MoneyV1` | `amountCents` | number, safe Integer | ja | Integer-Cent; kein Float/Overflow | M01-Core/Hostfact | kein eigenes Schema; C2-Vertrags-DTO, Hostfelder in Invoice-/Paymentbasis |
| `MoneyV1` | `currency` | Literal `EUR` | ja | Candidate.2 akzeptiert nur EUR | M01-Core/Hostfact | kein eigenes Schema; C2-Vertrags-DTO |
| `InvoiceSummaryV1` | `invoiceId` | string | ja | opaque; Tenant kommt aus Hostkontext | G07 | ja: `public.invoices`; F1.4-Migration / `invoiceRead.ts` |
| `InvoiceSummaryV1` | `invoiceNumber` | string | ja | nach Ausstellung unveränderlich | G07 | ja: `public.invoices` |
| `InvoiceSummaryV1` | `orderId` | string | ja | gehört zu demselben Tenant | G07 | ja: `public.invoices` |
| `InvoiceSummaryV1` | `status` | `issued` oder `cancelled` | ja | keine weiteren Zustände im Candidatevertrag | G07 | ja: Invoice-/Eventbasis |
| `InvoiceSummaryV1` | `aggregateVersion` | Literal 1 oder 2 | ja | Expected-Version-Basis | G07 | ja: Invoice-/Eventbasis |
| `InvoiceSummaryV1` | `net`, `vat`, `gross` | je `MoneyV1` | ja | gleiche Währung; validierte Centwerte | G07 | ja: F1.4 und `invoiceRead.ts` |
| `InvoiceSummaryV1` | `serviceDate`, `dueDate` | string | ja | durch Receipt-/Factvalidator geprüft | G07 | ja: F1.4 |
| `InvoiceSummaryV1` | `issuedAt` | string | ja | validierter Zeitpunkt | G07 | ja: Invoice-/Eventbasis |
| `InvoiceSummaryV1` | `cancelledAt` | string oder null | ja | nur bei Storno gesetzt | G07 | ja: Invoice-/Eventbasis |
| `PaymentSummaryV1` | `invoiceId`, `invoiceNumber`, `orderId` | je string | ja | tenantgebundene Referenzen | G07 | ja: Invoice-/Paymentbasis und `paymentSummaryRead.ts` |
| `PaymentSummaryV1` | `total`, `paid`, `open` | je `MoneyV1` | ja | `paid + open = total`; nicht negativ | G07 | ja: F1.5/V2 und `paymentSummaryRead.ts` |
| `PaymentSummaryV1` | `status` | `open`, `partial` oder `paid` | ja | konsistent zu Geldwerten | G07 | ja: Paymentbasis |
| `PaymentSummaryV1` | `paymentVersion` | number | ja | Integer ≥ 0; Concurrency/Readback | G07 | ja: F1.5/V2 |
| `PaymentSummaryV1` | `latestMethod` | `cash`, `bank_transfer`, `card` oder null | ja | null ohne bestätigte Zahlung | G07 | ja: Paymentbasis |
| `PaymentSummaryV1` | `latestReceiptId`, `latestEventId`, `latestCorrelationId`, `latestPaidAt` | je string oder null | ja | gemeinsam null oder auf letzten bestätigten Fakt bezogen | G07 | ja: `public.events`/Paymentread |
| `ReadEnvelopeV1<T>` | `contractVersion` | Literal `1.0.0-candidate.2` | ja | Exact-Contractprüfung | M01-Core | nein; C2 `src/dtos.ts` |
| `ReadEnvelopeV1<T>` | `source` | `SourceStampV1` | ja | `sourceId`, `sourceVersion`, Owner `ACCOUNTING` | M01-Core/Host | nein; C2-Vertrags-DTO |
| `ReadEnvelopeV1<T>` | `asOf` | string | ja | Quellstand, nicht bloß Responsezeit | M01-Core/Host | nein; C2-Vertrags-DTO |
| `ReadEnvelopeV1<T>` | `coverage` | `CoverageV1` | ja | State `complete/partial/none` plus Gründe | M01-Core/Host | nein; C2-Vertrags-DTO |
| `ReadEnvelopeV1<T>` | `stale`, `partial`, `denied` | je boolean | ja | denied muss mit State/Fehler konsistent sein | M01-Core/Host | nein; C2-Vertrags-DTO |
| `ReadEnvelopeV1<T>` | `redactions` | readonly string array | ja | ausgelassene sensible Felder benennen | M01-Core/Host | nein; C2-Vertrags-DTO |
| `ReadEnvelopeV1<T>` | `state` | `available/empty/denied/unavailable/unknown` | ja | bestimmt zulässige Kombination von `data` und `error` | M01-Core/Host | nein; C2-Vertrags-DTO |
| `ReadEnvelopeV1<T>` | `data`, `error` | T oder null / `ContractErrorV1` oder null | ja | discriminated union; kein stiller Leererfolg | M01-Core/Host | nein; C2-Vertrags-DTO |
| `HostActorContextV1` | `tenantId`, `actorId` | je string | ja | serverseitig auflösen; nie Client vertrauen | G01/Kreile-Host | Produktauth vorhanden; Accounting-HostAdapter fehlt |
| `HostActorContextV1` | `capabilities` | readonly `AccountingCapabilityV1` array | ja | personenbezogen, serverseitig | G01/Kreile-Host | Produktadapter fehlt |
| `HostActorContextV1` | `authenticated`, `active` | jeweils Literal `true` | ja | sonst kein autorisierter Kontext | G01/Kreile-Host | Produktadapter fehlt |
| `CommandEnvelopeV1<T>` | `contractVersion`, `intentId`, `idempotencyKey` | Literal / Strings | ja | gleiche IDs über sicheren Retry | M01-Core/Host | teils in Hostcommands; einheitlicher Adapter fehlt |
| `CommandEnvelopeV1<T>` | `expectedVersion`, `requestedAt` | number / string | ja | Integer ≥ 0; Zeitpunkt validieren | M01-Core/Host | teils in Hostcommands; Adapter fehlt |
| `CommandEnvelopeV1<T>` | `confirmation`, `payload` | `ExplicitConfirmationV1` / T | ja | Scope/Actor/Zeit plus command-spezifischer Payload | M01-Core/Host | Vertrags-DTO; keine eigene Tabelle |
| konkrete C2-Receipts | `receiptId`, `eventId`, `intentId`, `idempotencyKey`, `correlationId` | je string | ja | dauerhaft und untereinander konsistent | G07 | `public.events`; konkrete Produkt-Readbacks noch Gate |
| konkrete C2-Receipts | `tenantId`, `actorId`, `occurredAt` | strings | ja | Tenant/Actor gebunden; Zeitpunkt validiert | G07 | `public.events`; Hostmapping zu verifizieren |
| `DocumentOriginal` (Arbeitsname) | `originalId`, `tenantId`, `sha256` | IDs / SHA-256 | ja | privat, unveränderlich, tenantgebunden, deduplizierbar | M01/DOCUMENT_ORIGINAL | nein; `beleg*`-Legacy ist kein Sollschema → Q-M01-007 |
| `DocumentOriginal` (Arbeitsname) | `mimeType`, `source`, `receivedAt` | MIME / Enum / ISO-8601 UTC | ja | validiert; Quelle ehrlich; vor Verarbeitung finalisieren | M01/DOCUMENT_ORIGINAL | nein → Q-M01-007 |
| `DocumentOriginal` (Arbeitsname) | `formatProfile`, `structuredPartRef` | versionierter String / private Referenz | bei E-Rechnung | strukturierter Teil bleibt führend | M01/DOCUMENT_ORIGINAL | nein → Q-M01-007/008 |
| `DocumentProposal` (Arbeitsname) | `proposalVersion`, `fields` | Integer / Werte+Fundstellen+Konfidenz | ja | nur Vorschlag; keine Fachmutation | M06/Intake | nein; Mockparser verworfen → Q-M01-008 |
| `BankMovement` (Arbeitsname) | `movementId`, `tenantId`, `externalDedupeKey` | IDs / String | ja | unveränderlich; Dedupe je Tenant/Quelle | M01/BankAdapter | nein → Q-M01-006 |
| `BankMovement` (Arbeitsname) | `bookingDate`, `valueDate`, `amountCents`, `currency`, `reference` | ISO-Daten / Integer / ISO-Code / String | ja/bedingt | Originalwerte erhalten; Referenz schützen | M01/BankAdapter | nein → Q-M01-006 |
| `BankAssignment` (Arbeitsname) | `invoiceId`, `paymentReceiptId`, `assignmentReceiptId` | IDs | ja/nach Erfolg | menschlich bestätigt; append-only/reversierbar | M01 | nein → Q-M01-006 |
| `FixedCost` (Arbeitsname) | `amountCents`, `currency`, `cadence`, `dueRule` | Integer / `EUR` / Enum/Regel | ja | Betrag/Rhythmus/Fälligkeit; Enums am Gate | M01 | nein → Q-M01-009 |
| `FixedCost` (Arbeitsname) | `validFrom`, `validTo`, `version` | ISO-Daten / Integer | ja/bedingt | zeitlich versioniert; keine aktive Überlappung | M01 | nein → Q-M01-009 |
| `BalanceFact` (Arbeitsname) | `balanceCents`, `asOf`, `source`, `actorId` | Integer / ISO-Zeit / Enum / ID | ja | manuell oder bestätigter Adapter; Stand/Actor sichtbar | M01 | nein → Q-M01-009/010 |
| `PayrollAggregate` (Arbeitsname) | `totalCents`, `validFrom`, `coverage` | Integer / ISO-Datum / Coverage | ja | keine Einzelwerte; capability-gebunden | PAYROLL_PREP | nein im M01-Schema → Q-M01-012 |
| `LiquidityFacts` (Arbeitsname) | `receivables`, `fixedCosts`, `balance`, `payroll`, `sourceTimes`, `coverage` | strukturierte Reads | ja | nur Fakten; keine Prognose/Nullannahme | M01-Readport | nein → Q-M01-009 |
| `RetentionRecord` (Arbeitsname) | `documentClass`, `periodStart`, `retainUntil`, `holdReason` | Enum / ISO-Daten / Enum oder null | ja/bedingt | 8/6 Jahre; Hold verlängert; nie still löschen | M01/Storagepolicy | nein → Q-M01-007 |
| `ExportRun` (Arbeitsname) | `formatVersion`, `period`, `cutoff`, `inputSetHash` | String / Intervall / ISO-Zeit / SHA-256 | ja | freigegebenes Format; eingefrorenes Inputset | M01 | nein; `export_lauf` nicht übernehmen → Q-M01-004/013 |
| `ExportRun` (Arbeitsname) | `artifactRef`, `artifactHash`, `actorId`, `receiptId` | private Referenz / SHA-256 / IDs | ja | Erfolg erst nach hashverifiziertem Readback | M01 | nein → Q-M01-004/013 |

## Manifest und Handshake

| Artefakt | Pfad | SHA-256 (12) | Aussage | Produktwirkung |
|---|---|---|---|---|
| Candidate-Manifest | `C:\Users\Traube\Documents\Codex\2026-09-16\du\work\accounting-core-contract-v1-candidate2\capability.manifest.json` | `B2AA6A8590DB` | Vertrag `1.0.0-candidate.2`, Exporte, Consumes, Denylist, Gates | keine; off-repo |
| Integration-Handshake | `C:\Users\Traube\Documents\Codex\2026-09-16\du\work\accounting-core-contract-v1-candidate2\INTEGRATION_HANDSHAKE.json` | `A98958EB7531` | acht reale Produktblocker und benötigte Hostports | keine; `PARKED_NOT_ADOPTED` |
| Candidate Client-Fassade | `...\candidate2\src\public.ts` | `38BCF593D17D` | öffentliche Read-/DTO-Fassade | keine; nicht adoptiert |
| Candidate Server-Fassade | `...\candidate2\src\server-public.ts` | `D505E057D30A` | öffentliche Command-/Recovery-Fassade | keine; nicht adoptiert |
| Produktmanifest Ist | `02_app\src\modules\accounting\accounting.manifest.json` | `7EE97CA50867` | schmaler vorhandener Produkteinstieg, nicht Candidate.2 | gültiger Iststand; kein M01 |
| Produktfassade Ist | `02_app\src\modules\accounting\public.ts` | `C13A20BD1EA4` | schmale UI-Fassade, keine Serverfassade | gültiger Iststand; kein M01 |

## APIs, Provider und Secrets

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Bestehende Supabase-/Postgres-Wahrheit | serverseitiger Kreile-HostAdapter; Tenant/RLS plus Capability | keine neuen Namen; bestehende Betriebssecrets bleiben Hostbesitz | Real-DB-/RLS-Adapter fehlt | keine Remote-Migration/RLS-Änderung ohne Freigabe |
| Kartenterminal | nur `PAYMENT_ADAPTER_V1`; Betrag/Status/Receipt, kein Provider-SDK im Core/UI | FEHLT → Q-M01-005 | Anbieter/Vertrag nicht gewählt | Owner entscheidet Anbieter, Vertrag, Kosten und Secret-Namen |
| Bank | freigegebener Dateiimport bzw. später nur benötigte Konto-/Umsatzleserechte; keine Überweisung | FEHLT → Q-M01-006 | nicht verbunden | Bank vor Mollie; Owner/Datenschutz/Vertrag |
| Mollie | später nur Payment-/Status-/Refund-Scopes hinter Adapter | FEHLT → Q-M01-015 | vorhandener Stub `NOT_AVAILABLE`, keine Capability | Bedarf, Kosten, Vertrag und Secrets durch Owner |
| Privater Dokumentstorage | tenantgebundener Write/Read, Hash, Hold, Backup/Restore; kein Public Bucket | FEHLT → Q-M01-007 | nicht gewählt/angebunden | Owner/PL für Storage, AVV, Retention, Restore |
| E-Rechnungsvalidator | lokale/freigegebene Validierung gegen ratifiziertes Profil | kein Secret belegt; Auswahl offen | Mockparser verworfen; Realvalidator fehlt | Profil, Lizenz und Updateweg freigeben |
| M365/E-Mail | später über M05; M01 besitzt keine Mailbox-/Senderechte | keine M01-Secrets | nicht angebunden | Produktiv im Kreile-eigenen Tenant/Azure-Abo, Dev nur synthetisch; Anlage/Zustimmung durch Kreile am Gate (OE-2609-25) |
| Hintergrund-Jobs | Supabase Cron (`pg_cron`) mit DB-Funktionen/Edge Functions und Job-/Outbox-Tabelle mit Receipts; eingehende Microsoft-Benachrichtigungen über eine Next.js-Route nur in die DB-Warteschlange | keine neuen Secret-Namen belegt | technische Plattform entschieden; Umsetzung und Kostenfreigabe offen | Hintergrund-Jobs über Supabase Cron + Outbox (PL-Entscheidung 2026-09-26, `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` §8); Vercel Pro und Supabase Pro am Owner-Gate |
| Mahnungszustellung | externer Kommunikationsport, nur freigegebene Nachricht senden/statuslesen | keine M01-Secrets | Port fehlt → Q-M01-003 | Owner/PL für Kanal, Text, Kosten, Datenschutz |

Secrets selbst dürfen weder in Dossier, Client, Logs noch Receipts stehen. Nach Providerfreigabe werden ausschließlich die benötigten **Namen** im Provider-/Betriebshandbuch ergänzt.

## Bestehende Datenwahrheit und verbotene Quellen

| Kategorie | Verbindlich | Nicht als neue Wahrheit verwenden |
|---|---|---|
| Rechnungen | `public.invoices`, zugehörige bestehende Reads/Commands und `public.events` | `ausgangsrechnung*`, Legacy-Dubletten |
| Zahlungen | kanonische Paymentfelder/-versionen/-receipts und Events auf der Rechnung | `zahlung`, `payments`, LocalStorage, Providerstatus allein |
| Zahlungsart | vorhandenes versioniertes `orders.payment_mode` | UI-Auswahl ohne Commandreceipt |
| Kosten | noch keine ratifizierte Produktwahrheit | `kostenposten`, `cost_positions`, `order_cost_positions` |
| Dokumente | künftiges `DOCUMENT_ORIGINAL_V1` | `beleg*`-Legacytabellen und Mockparser |
| Export | künftiger persistenter Export-Run | `export_lauf`-Legacy und flüchtige CSV-Antwort |
| Audit | Domainreceipts plus bestehende Ereignisse | `bh_audit_log` als zweite Wahrheit |

## Datenschutz, Tenant und Übertragbarkeit

- Jeder Read, Command, Blob und Receipt ist tenantgebunden; Fremdtenantzugriff ist fail-closed.
- Der Client liefert niemals eine vertrauenswürdige Rolle oder Tenantentscheidung.
- Bankreferenzen, Dokumentinhalte, Lieferanten-, Kunden- und Gehaltsdaten sind geschützt; Logs enthalten nur minimierte IDs/Correlation, keine Originalinhalte oder Secrets.
- Personalkosten verlassen PAYROLL_PREP nur als berechtigtes Aggregat.
- Kreile-spezifische Tabellenabbildung, Capability-Zuordnung, Texte und Ressourcen liegen im Kreile-HostAdapter. Der Core bleibt frei von Anforderungen anderer Zielapps.

<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Schnittstellen und Daten M06

## Architekturgrenze

M06 ist eine gekapselte Vorschlags-, Prüf- und Orchestrierungsschicht. Es besitzt keine Kunden-, Auftrags-, Rechnungs- oder Buchhaltungswahrheit. Der Host besitzt Originalspeicherung, persistente Vorgänge, Berechtigungen, Fachleseports und Fachkommandos. Externe Dokumentanalyse sitzt hinter einem austauschbaren Server-Port.

```text
Quelle
  → Host: Original unverändert sichern
  → M06: SourceEnvelope + Analyseauftrag
  → DocumentIntelligencePort: Rohresultat
  → M06: FactLedger + vollständige Disposition
  → Mensch: prüfen/korrigieren/bestätigen
  → Host: echte Kandidaten
  → Mensch: Ziel und Wirkung bestätigen
  → Host: genau ein Fachkommando
  → Receipt + Readback
```

## Geplanter Modulvertrag

| Artefakt | Geplanter Pfad | Stand / SHA |
|---|---|---|
| Modulroot | `src/modules/dokumentenaufnahme/` | **FEHLT** |
| CI-Manifest | `src/modules/dokumentenaufnahme/dokumentenaufnahme.manifest.json` | **FEHLT**, daher kein SHA |
| Integrationshandshake | `src/modules/dokumentenaufnahme/INTEGRATION_HANDSHAKE.json` | **FEHLT**, daher kein SHA |
| Client-öffentliche API | `src/modules/dokumentenaufnahme/public.ts` | **FEHLT** |
| Server-öffentliche API | `src/modules/dokumentenaufnahme/server-public.ts` | **FEHLT** |
| Porttypen | `src/modules/dokumentenaufnahme/ports.ts` | **FEHLT** |

Das nach Path 1 geforderte fachbenannte Manifest ist das Capability-Manifest; es wird **kein zweites**, abweichendes `capability.manifest.json` angelegt. Falls die dann aktuelle CI ausdrücklich einen anderen Dateinamen verlangt, gilt die CI aus `origin/main`, und Handshake/Dossier sind atomar anzupassen.

### Mindestinhalt des Manifests

- `moduleId`: `dokumentenaufnahme`
- `tenantScope`: `tenant-bound`
- `maturity`: zunächst `OFF_REPO_KANDIDAT`, dann nur gatebasiert weiter
- `ownsTables`: leere Liste
- `offersPorts`: die unten genannten öffentlichen M06-Ports
- `requiresPorts`: ausschließlich die unten genannten Hostports
- `routes`: leer bis Adoption; anschließend nur freigegebene M06-Routen
- `forbiddenImports`: Host-Innereien, Provider-SDK im Client, Quarantänepfade
- `dataClassification`: Dokumentoriginale/PII/vertraulich
- `providerDependencies`: abstrakte Fähigkeiten, keine Secrets
- `failureMode`: fail closed, manueller Pfad

### Mindestinhalt des Handshakes

- exakter `origin/main`-Commit des geprüften Integrationsstands
- Manifest-SHA-256 und Dossier-SHA-256
- angebotene und benötigte Ports mit Vertragsversion
- tatsächlich verwendete Tabellen/Buckets als Hostressourcen
- RLS-/Tenant-Nachweis
- Routen- und UI-Einhängepunkt
- Providerstatus und externe Gates
- Test- und Reviewnachweise
- Rollback-/Deaktivierungsweg ohne Datenverlust
- bekannte Restpunkte; keine pauschale „fertig“-Behauptung

## Öffentliche M06-Ports

| Port | Richtung | Vertrag |
|---|---|---|
| `document-intake.view` | M06 → Host-UI | Rendert Aufnahme/Prüfung nur mit übergebenem Actor-/Tenant-Kontext; keine Host-Interna importieren. |
| `document-intake.read` | M06 → Consumer | Liefert ausschließlich bestätigte, rechtegefilterte Projektionen und stabile Originalreferenzen; kein Provider-Rohoutput. |
| `document-intake.status` | M06 → Host | Liefert Gate-/Reifegrad `In Klärung`, `In Aufbau`, `Gesperrt` oder aktiv; keine Erfolgssimulation. |
| `document-intake.events` | M06 → Host | Typisierte Ereignisse mit IDs/Versionen, ohne Dokumenttext oder Secret. |

`public.ts` darf nur browsergeeignete Typen/Ansichten exportieren. Provider-, Speicher- und Kommandozugriffe liegen ausschließlich in `server-public.ts` beziehungsweise internen Serveradaptern.

## Benötigte Hostports

| Port | Zweck | Mindestverhalten |
|---|---|---|
| `host.authorization-context` | Tenant, Actor, Rollen, Rechte | pro Serveroperation neu prüfen; kein Vertrauen in Clientwerte |
| `host.document-originals` | Aufnahme reservieren/finalisieren/lesen | unveränderliches Original, Hash, MIME, Größe, tenantgebundene Referenz, kurzlebiger Lesezugriff |
| `host.document-processing-store` | Lauf/Version/Checkpoint speichern | optimistische Version, Idempotenz, Status, kein zweiter Wahrheitsbestand |
| `host.entity-candidate-read` | Kunde/Auftrag/Beleg suchen | echte, berechtigte Kandidaten; Treffergrund; maximal benötigte Daten |
| `host.capability-catalog` | zulässige Aktionen auflösen | Label, Rechte, Vorbedingungen, Risiko, Verfügbarkeit ausschließlich serverseitig |
| `host.domain-command` | bestätigte Fachaktion | idempotent, genau ein Kommando, Receipt oder expliziter Fehler |
| `host.receipt-readback` | tatsächliches Ergebnis prüfen | Fachwahrheit nachlesen; Erfolg erst bei konsistentem Readback |
| `host.audit-telemetry` | Audit/Korrelation/Metriken | keine PII/Dokumenttexte in Telemetrie; Actor/Tenant/Korrelation serverseitig |

Direktzugriff aus M06 auf Tabellen oder interne Services anderer Module ist verboten. Fehlende Ports sind ein Integrationsgate, kein Anlass für Schattenlogik.

## Providerport `DocumentIntelligencePort`

Der Serverport benötigt folgende Operationen:

| Operation | Eingabe | Ausgabe / Regel |
|---|---|---|
| `getCapabilities` | Providerkontext ohne Dokument | Modellversionen, Formate, Größen-/Seitenlimit, Region, verfügbare Merkmale und Status |
| `analyze` | signierte/streambare SourceReference, Zweck, erlaubte Merkmale, Korrelation | unveränderlicher Rohresultat-Beleg mit Provider-, Modell- und API-Version, Seiten, Wörtern, Tabellen, Key-Values, Polygonen/Ankern und Konfidenzen |
| `getStatus` | providerJobId + Korrelation | nur für denselben Tenant/Lauf; normalisierte Zustände pending/running/succeeded/failed/cancelled |
| `deleteResult` | providerJobId + Korrelation | expliziter Löschbeleg oder nachvollziehbarer Fehler; Produktoriginal bleibt unberührt |

Der Adapter darf weder `FactLedger` noch Fach-IDs noch Aktionen erzeugen. Diese Trennung verhindert, dass ein Providerschema zur Produktwahrheit wird.

## Datenverträge

### SourceEnvelope

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `sourceId` | ja | hostvergebene stabile ID |
| `tenantId` | ja, serverseitig | niemals aus unvalidiertem Clientwert |
| `version` | ja | unveränderliche Originalversion |
| `contentHash` | ja | serverseitiger SHA-256 des Originals |
| `mimeType` / `sizeBytes` / `pageCount` | ja soweit bestimmbar | Limit- und Anzeigeprüfung |
| `storageRef` | ja | opaque Hostreferenz; keine öffentliche permanente URL |
| `securedAt` / `securedBy` | ja | Beleg „Original zuerst“ |
| `purposeHint` | nein | Nutzerhinweis, keine Wahrheit |

### ExtractedFact

| Feld | Pflicht | Regel |
|---|---|---|
| `factId` | ja | stabil innerhalb der Analyseversion; nie Indexposition |
| `kind` | ja | kontrolliertes Vokabular, unbekannt bleibt `other` |
| `rawValue` | ja | unveränderte Providerlesart |
| `normalizedValue` | nein | deterministische Normalisierung, niemals erfundener Inhalt |
| `sourceAnchor` | ja | Source-ID, Version, Seite/Abschnitt und soweit vorhanden Polygon/Textanker |
| `confidence` | nein | Zahl 0…1 plus Herkunft; fehlend wird nicht als 1 interpretiert |
| `criticality` | ja | normal/critical; Rollen, IDs, Beträge, Datumsbedeutung und Aktionen critical |
| `disposition` | ja | exakt einer der vier zulässigen Zustände |
| `editedValue` / `editedBy` / `editedAt` | bei Korrektur | Rohwert bleibt erhalten |

### FactLedger

| Feld | Pflicht | Regel |
|---|---|---|
| `ledgerId`, `runId`, `version` | ja | versionierter Prüfstand |
| `sourceRef` | ja | exakt ein gesichertes Original/eine Version |
| `facts` | ja | auch leere Liste zulässig, aber nie `null` |
| `coverage` | ja | Anzahl erkannt/disponiert/offen/konfliktbehaftet; muss aus Fakten reproduzierbar sein |
| `requiresHumanConfirmation` | ja | für M06 immer `true` |
| `confirmedBy` / `confirmedAt` | erst nach Bestätigung | Actor serverseitig |
| `providerReceipt` | bei Analyse | Provider-/Modell-/API-Version, Job-ID, Zeit, Region; kein Secret |

### Zuordnungs- und Aktionsverträge

- `EntityCandidate`: Typ, echte Fach-ID, lesbare Kennung, Treffergrund, Rechte-/Existenzversion.
- `AssignmentDraft`: Ledger-Version, Ziel oder `UNRESOLVED_INBOX`, gewählter Actor und optimistische Zielversion.
- `ActionProposal`: nur `actionKey`, fachliche Begründungsfakten und gewünschtes Ziel; alle Anzeige-/Rechtefelder werden vom Host ergänzt.
- `CommandConfirmation`: serverseitiges Confirmation-Token, Ledger-/Zielversion, Idempotenzschlüssel und Actor.
- `CommandReceipt`: Command-ID, Idempotenzschlüssel, Zeitpunkt, Ziel, Resultatstatus und Readback-Referenz.
- `ReadbackProjection`: tatsächlich gelesener Zielzustand; keine vom Modell formulierte Erfolgsmeldung.

## Zustandsautomat

| Von | Ereignis | Nach | Unzulässig |
|---|---|---|---|
| `NEW` | Original finalisiert | `ORIGINAL_SECURED` | Analyse vor Original |
| `ORIGINAL_SECURED` | Analyse gestartet | `ANALYZING` | stiller Providerwechsel |
| `ANALYZING` | valide Faktenversion | `REVIEW_REQUIRED` | unvollständiges Ledger |
| `ORIGINAL_SECURED` | manueller Pfad | `REVIEW_REQUIRED` | Fake-Analysebeleg |
| `REVIEW_REQUIRED` | Fakten bestätigt | `FACTS_CONFIRMED` | offene kritische Konflikte |
| `FACTS_CONFIRMED` | Ziel gewählt | `ASSIGNMENT_PENDING` | erfundene Ziel-ID |
| `ASSIGNMENT_PENDING` | Zuordnung bestätigt, keine Aktion | `COMPLETED` | Zuordnung ohne erneute Rechteprüfung |
| `ASSIGNMENT_PENDING` | Aktion bestätigt | `COMMAND_PENDING` | Modell löst Aktion direkt aus |
| `COMMAND_PENDING` | Receipt + konsistenter Readback | `COMPLETED` | Erfolg ohne Readback |
| jeder nicht finale | sicherer Fehler | `BLOCKED` oder `FAILED_RETRYABLE` | Verlust von Original/Checkpoint |

## Persistenz und Datenbesitz

## Datenmodell-Feldliste und Soll-Ist-Abgleich

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| SourceEnvelope | sourceId | UUID/Text-ID | ja | tenantgebunden, unveränderlich referenziert | Host Erfassung | `scan_uploads.id` in `supabase/migrations/20260805180624_production_schema_baseline.sql` |
| SourceEnvelope | tenantId | UUID | ja | serverseitig, RLS | Host Erfassung | `scan_uploads.tenant_id`; Drizzle-Teilabbildung in `src/db/schema.ts` |
| SourceEnvelope | version | Integer | ja | monoton/optimistisch | Host Erfassung | kein eindeutiges eigenes Feld; vor Adapterbau Mapping prüfen → Q-M06-007 |
| SourceEnvelope | contentHash | Text | ja | SHA-256, Original | Host Erfassung | `scan_uploads.original_hash` in Baseline; Drizzle-Abbildung unvollständig |
| SourceEnvelope | mimeType | Text | ja | allowlist aus Adapterfähigkeiten | Host Erfassung | `scan_uploads.file_type` |
| SourceEnvelope | sizeBytes | Bigint | ja | aktives Adapterlimit | Host Erfassung | `scan_uploads.original_size_bytes` |
| SourceEnvelope | pageCount | Integer | soweit bestimmbar | nicht aus F0 hartcodieren | Host Erfassung | kein belegtes eigenes Feld; ableiten oder strukturelles Gate |
| SourceEnvelope | storageRef | Text/opaque | ja | keine öffentliche Dauer-URL | Host Erfassung | `scan_uploads.original_storage_path`; älteres `file_url` nicht als daueröffentliche URL nutzen |
| SourceEnvelope | securedAt | Timestamp | ja | vor Analyse | Host Erfassung | `scan_uploads.original_secured_at` |
| SourceEnvelope | securedBy | UUID | ja | serverseitiger Actor | Host Erfassung | `scan_uploads.uploaded_by` |
| ProcessingRun | runId | UUID/Text-ID | ja | tenantgebunden, wiederaufnehmbar | Host Erfassung | `scan_uploads.id` oder vorhandener Hostlauf; exaktes Mapping Q-M06-007 |
| ProcessingRun | status | Enum/Text | ja | nur definierter Zustandsautomat | Host Erfassung | `scan_uploads.status` |
| ProcessingRun | clientIdempotencyKey | Text | ja | unique je Tenant | Host Erfassung | `scan_uploads.client_idempotency_key`, Unique-Constraint in Baseline |
| ProcessingRun | provider/model/api/region | Textobjekt | bei Analyse | keine Secrets | Host Erfassung / M06 | `ocr_provider` plus `extracted_data` teilweise; kein vollständiges typisiertes Mapping belegt |
| ProcessingRun | providerJobId | Text | bei asynchroner Analyse | nicht clientvertrauenswürdig | Host Erfassung / M06 | kein sicher belegtes eigenes Feld; Q-M06-007 |
| FactLedger | ledgerId/version | Text + Integer | ja | atomare Version | M06-Projektion, Hostpersistenz | nur JSONB-/Konvertierungsfelder vorhanden; Mapping vor Bau prüfen |
| FactLedger | facts | JSONB-Projektion | ja | stabile factId, SourceAnchor | M06-Projektion, Hostpersistenz | `scan_uploads.extracted_data`; Drizzle-Abbildung/Schemaform nicht ausreichend belegt |
| FactLedger | fieldConfidence | JSONB | nein je Fakt | 0…1 plus Herkunft | M06-Projektion, Hostpersistenz | `scan_uploads.field_confidence` in Baseline |
| FactLedger | coverage | JSONB/abgeleitet | ja | aus Fakten reproduzierbar | M06 | kein belegtes eigenes Feld; im Ledgerpayload nur nach Schemaabgleich |
| FactLedger | requiresHumanConfirmation | Boolean | ja | in M06 immer true | M06 | `scan_uploads.review_required` |
| FactLedger | confirmedBy/At | UUID/Timestamp | nach Review | Actor serverseitig | Host Erfassung | `scan_uploads.reviewed_by`, `reviewed_at` |
| Assignment | linkedCustomerId | UUID | nein | echte Host-ID, Rechteprüfung | Host/Kunden | `scan_uploads.linked_customer_id` |
| Assignment | linkedOrderId | UUID | nein | echte Host-ID, Rechteprüfung | Host/Aufträge | `scan_uploads.linked_order_id` |
| Assignment | linkedInvoiceId | UUID | nein | echte Host-ID, Rechteprüfung | Host/Buchhaltung | `scan_uploads.linked_invoice_id` |
| Assignment | unresolved | Status | ja wenn kein Ziel | kein erzwungener Match | Host Erfassung | über `status` abzubilden; exakte Enum vor Bau prüfen |
| CommandReceipt | commandId/receiptId | Text-ID | bei Aktion | idempotent, unveränderlich | jeweiliges Fachmodul/Host | nicht Eigentum von `scan_uploads`; nur Host-Command-/Receipt-Port |
| AuditEvent | Actor/Tenant/Korrelation/Version | IDs/Zeit | ja | kein Dokumenttext/Secret | Host Audit | bestehender Audit-/Telemetryport; keine neue M06-Tabelle |

**Soll-Ist-Ergebnis:** Die Baseline besitzt eine brauchbare, umfangreichere `scan_uploads`-Basis; `src/db/schema.ts` bildet sie nicht vollständig ab. Der Builder darf deshalb weder das Drizzle-Modell als komplette Wahrheit behandeln noch eine neue Tabelle anlegen. Q-M06-007 ist der verpflichtende reine Mapping-/Strukturcheck vor Persistenzintegration.

### Bestehende Basis

Die Produktionsbaseline enthält `public.scan_uploads` mit unter anderem Tenant, Datei-/Originalreferenz, Hash, Größe, Sicherungszeit, Provider, extrahierten Daten, Feldkonfidenzen, Reviewstatus, Links zu Fachzielen, Idempotenz und Claim-/Konvertierungsfeldern. `src/db/schema.ts` bildet nur einen älteren Teil davon ab. Daraus folgt:

1. M06 legt **keine neue Tabelle** an.
2. Vor Persistenzbau wird die tatsächliche `origin/main`-Baseline gegen Drizzle und die aktuelle Zielarchitektur dokumentiert abgeglichen.
3. Eine notwendige Schemaänderung ist eine neue dauerhafte Strukturentscheidung und braucht das Projektgate; sie wird nicht aus diesem Dossier abgeleitet.
4. `public.beleg` bleibt Eigentum der Buchhaltung. `item_photos` bleibt Eigentum des Aufnahme-/Auftragspfads. M06 verwendet beide nur über Ports.

### RLS-/Tenant-Regel

- Jede Zeile/Storage-Referenz trägt `tenant_id` oder wird durch einen tenantgebundenen Hostdatensatz erreicht.
- Lesen, Schreiben, Resume, Kandidatensuche und Readback prüfen den Tenant serverseitig.
- Service-Role darf nie im Browser landen und ersetzt keine fachliche Autorisierung.
- Signierte URLs sind kurzlebig, zweckgebunden und dürfen nicht in Audit/Telemetrie stehen.
- Browsercache wird bei Logout/Tenantwechsel verworfen; keine fremde Vorschau bleibt sichtbar.

### Aufbewahrung und Löschung

Nach OE-2609-20 gelten die im Host je Dokumentart konfigurierten Fristen. Rechnungen und Buchungsbelege werden mindestens acht Jahre, Geschäftsbriefe einschließlich Angebots- und Auftragsmails mindestens sechs Jahre und darüber hinaus so lange aufbewahrt, wie steuerlich noch geprüft werden kann. Danach wird der Personenbezug entfernt; Geschäftszahlen bleiben erhalten. Löschung oder Anonymisierung erfolgt nie still, sondern nur als Vorschlag mit Admin-Freigabe. M06 führt diese Fristen nicht als eigene Datenwahrheit, sondern erhält Status und zulässige Aktion über den Kreile-HostAdapter.

## Ereignisse

Über den bestehenden Host-Ereignisport, ohne neue Ereignistabelle:

| Ereignis | Wann | Mindestpayload |
|---|---|---|
| `document.original_secured` | nach verifiziertem Finalize | sourceId/version/hashRef, Actor, Tenant, Korrelation |
| `document.analysis_requested` | nach Gateprüfung | runId, Adapter-/Modellkennung, keine URL/kein Text |
| `document.analysis_completed` | nach valide/invalidem Resultat | runId, status, Metriken, Fehlerklasse |
| `document.review_confirmed` | nach Faktenbestätigung | ledgerId/version, counts, Actor |
| `document.assignment_confirmed` | nach Zielbestätigung | Zieltyp/-ID, ledgerVersion, Actor |
| `document.command_finished` | nach Receipt/Readback oder Fehler | commandId, receiptId, status, correlationId |

## Konfiguration und Secrets

Nur Namen, keine Werte:

- `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`
- `AZURE_DOCUMENT_INTELLIGENCE_API_VERSION`
- `AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID`
- optional getrennte Modellnamen je zugelassener Fähigkeit
- Hostkonfiguration für Region, aktivierte Formate, Größen-/Seitenlimit, Timeout, Kostenbudget und Providerstatus

Der vorhandene Dev-Nachweis nutzte `kreile-docintel-dev-53c47b`, Tarif F0, Region Germany West Central und Microsoft-Entra-Authentifizierung; lokale Key-Authentifizierung war deaktiviert. Diese Namen sind Bestandsnachweis, keine Erlaubnis, die Ressource anzusprechen oder produktiv zu verwenden. Ein Key-Variablenname wird absichtlich nicht zum Zielvertrag gemacht.

## APIs und Provider

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Azure Document Intelligence | Dev-Nachweis `kreile-docintel-dev-53c47b`: Rolle `Cognitive Services User`; Produktion: Microsoft Entra/RBAC, Least Privilege im Kreile-eigenen Azure-Abo | kein lokaler Key im Zielvertrag; Konfigurationsnamen `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_DOCUMENT_INTELLIGENCE_API_VERSION`, `AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID` | Dev F0 nur für synthetische Tests; Produktion S0 durch OE-2609-25 festgelegt, reale Anlage/Freigabe am Gate offen | kein Produktionstraffic vor Kreile-Anlage, AVV/Datenschutz-, Netz-, Kosten- und E2E-Gate G-M06-003/005 |
| Host-Originalspeicher/Supabase | ausschließlich Hostport mit tenantgebundener Autorisierung/RLS | kein M06-Secret; vorhandene Hostsecrets bleiben serverseitig gekapselt | Original-/Attachment-Basis teilweise GEBAUT; M06-Adapter FEHLT | keine Migration, RLS-Änderung oder Remoteaktion aus M06 |
| Host-Fachkommandos | konkrete serverseitige Capability je Actor/Ziel | kein M06-Secret | Ports/Commands teilweise vorhanden; M06-Anschluss FEHLT | keine neue Schreibstrecke; nur freigegebene bestehende Commands |
| Gemini OCR | keine zulässigen Produktrechte | vorhandener Name `GEMINI_API_KEY` nur Bestandsbefund | VERWORFEN/QUARANTÄNE | nie importieren oder als Fallback nutzen |
| Klippa OCR | keine zulässigen Produktrechte | vorhandener Name `KLIPPA_API_KEY` nur Bestandsbefund | VERWORFEN/QUARANTÄNE | nie importieren oder als Fallback nutzen |
| Azure Foundry/OpenAI starke Stufe | noch keine für M06 freigegebenen Rechte/Modelle | kein freigegebener M06-Secretname | GEPLANT, separates Gate | nur explizite Lückenentscheidung; keine stille Eskalation |

## Übertragbarkeit

**Kern app-neutral: ja.** Grund: `SourceEnvelope`, `FactLedger`, Faktendisposition, Human-in-the-loop sowie Command/Receipt/Readback sind frei von Kreile-Fachbegriffen. Kreile-spezifische Autorisierung, Originalspeicherung, Kandidaten, Fachkommandos, Ressourcen, Endpunkte und Schlüsselkonfiguration liegen ausschließlich im Kreile-HostAdapter. Dieses Dossier spezifiziert nur Kreile.

## Externe Aktualitätsgrenzen (2026-09-26)

- Document Intelligence API `2024-11-30` ist in der Microsoft-Dokumentation als v4.0 GA geführt.
- Eingangsdaten und Ergebnisse werden für die Analyse verschlüsselt und temporär in derselben Region verarbeitet/gespeichert; Microsoft dokumentiert eine automatische Löschung nach 24 Stunden und eine frühere Delete-Operation.
- Daten werden standardmäßig at rest verschlüsselt; kundenseitig verwaltete Schlüssel sind optional.
- Entra-Authentifizierung und das Abschalten lokaler Authentifizierung werden unterstützt.
- Diese Anbieterangaben ersetzen nicht OP-09: AVV/DPA, konkrete Ressourcenkonfiguration, Netzwerkweg, Löschbeleg, Kosten und Rechtsprüfung müssen vor echtem App-Traffic freigegeben sein.

## Downstream Suche und KI-Chat

M06 bietet später nur bestätigte Projektionen über `document-intake.read`. Suche/Chat müssen:

- den aktuellen Actor-/Tenant-Kontext an den Server geben,
- Berechtigungen am Original und Fachziel serverseitig durchsetzen,
- Konflikte und unbestätigten Rohoutput ausschließen,
- Treffer mit Original-/Faktenquelle belegbar machen,
- niemals aus einem Chat heraus ohne denselben Command-/Confirmation-/Receipt-Vertrag schreiben.

Index, Retrieval, Chat-UI und deren Persistenz liegen ausdrücklich außerhalb dieses Moduls.

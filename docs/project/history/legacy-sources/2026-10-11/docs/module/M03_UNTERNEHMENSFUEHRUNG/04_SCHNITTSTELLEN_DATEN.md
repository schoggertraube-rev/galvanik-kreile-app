<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 04 - Schnittstellen und Daten

Stand: 2026-09-26  
Modul: M03 Unternehmensführung

## 1. Angebotene Ports

| Port | Fassade | Vertrag/Version | Zweck | Stand |
|---|---|---|---|---|
| `GoalReadPortV1` | `public.ts` | `ReadEnvelopeV1<GoalAggregateV1\|null>`, 1.0.0 | Ziel samt unveränderlicher Historie lesen | GEBAUT im Off-Repo-Candidate; im Host FEHLT |
| `GoalCommandPortV1` | `server-public.ts` | `GoalsCommandV1 -> CommandOutcomeV1`, 1.0.0 | `SaveDraft`, `Activate`, `Supersede`, `Close` | GEBAUT im Off-Repo-Candidate; im Host FEHLT |
| `GoalReceiptReadPortV1` | `public.ts` | `ReadEnvelopeV1<CommandReceiptV1\|null>`, 1.0.0 | Command-Ausgang unabhängig und scopegebunden lesen | GEBAUT im Off-Repo-Candidate; im Host FEHLT |
| `GoalAttentionProjectionReadPortV1` | `public.ts` | `ReadEnvelopeV1<GoalAttentionPageV1>`, 1.0.0 | Read-only Zielaufmerksamkeit für Host/Home | GEBAUT im Off-Repo-Candidate; im Host FEHLT |
| `GoalDomainEventsV1` | `server-public.ts` | vier Events `.v1` | atomare Outbox-/Integrationsnaht | GEBAUT im Off-Repo-Candidate; reale Outbox FEHLT |

Öffentliche Package-Exporte sind exakt `.` und `./server`. Kreile darf später nur die hostlokalen `public.ts`-/`server-public.ts`-Fassaden importieren; keine Tiefimporte in Candidate-Interna.

## 2. Benötigte Host-Ports

Die oft genannte Zahl „7 Host-Ports“ bezeichnet sieben **verpflichtende Portgruppen**. Candidate.3 enthält zusätzlich den optionalen Evaluation-Port; die Persistenz- und Betriebsgruppe umfasst mehrere Methoden.

| Gruppe | Port/Methoden | Owner | Vertrag | Failure/Frische | Realer Stand |
|---|---|---|---|---|---|
| 1 Autorisierung | `AuthorizationPortV1.authorize` | zentraler Kreile-Auth-/Rechtehost | Actions `goals:read`, `read-receipt`, `read-projection`, `save-draft`, `activate`, `supersede`, `close` | fail-closed; keine Clientautorität | MISSING_REAL_HOST |
| 2 Command-Bindung | `CommandEnvelopeBindingPortV1.verifyBinding` | serverseitige Request-/Sessiongrenze | Command-ID, Idempotenz, Korrelation, submittedAt | denied bei ungebunden/fremd | MISSING_REAL_HOST |
| 3 Bestätigung | `ConfirmationPortV1.verify` | zentrale Confirmation-/Challenge-Grenze | Command-Art, Ziel, Revision, Challenge, Summary-Hash | missing/expired/mismatch/replayed/wrong-context | MISSING_REAL_HOST |
| 4 Verantwortung | `ResponsibilityReadPortV1.resolve` | künftiges zentrales Personen-/Verantwortungsverzeichnis | opake namespaced `ResponsibilityRefV1` | bei Aktivierung aktuell, ready und exakt passend | MISSING_REAL_HOST |
| 5 Messdefinition | `MeasurementDefinitionReadPortV1.readDefinition` | M02; für Liquidität 30 Tage auf M01-Fakten gestützt | Version/Hash, Werttyp, Einheit, Richtung, Präzision, Zeitraum, Freshness, Coverage | missing/stale/partial/denied/unknown/incompatible | MISSING_REAL_HOST |
| 6 Atomare Persistenz | `AtomicGoalsPersistencePortV1` mit `readAggregate`, `readReceipt`, `listOpenAggregates`, `commitAtomically` | Kreile-Datenbankhost | Aggregate + append-only Events + Receipt in einer CAS-Transaktion | conflict/unknown; Scope-/RLS-Isolation | MISSING_REAL_HOST |
| 7 Betriebsprimitiven | `GoalsClockPortV1`, `GoalsIdentityPortV1`, `GoalsHashPortV1` | Kreile-Plattformhost | serverseitige Zeit, IDs, SHA-256 | jeder Fehler stoppt oder ergibt unknown | MISSING_REAL_HOST |
| optional Evaluation | `GoalEvaluationReadPortV1.readEvaluation` | M02/Analyse; erster Nutzenfall kombiniert Termintreue und Liquidität 30 Tage | Goal-/Versionbezug, Zustand, assessedAt, ExplanationRef | Partial/Stale/Denied/Unknown unverfälscht | MISSING_REAL_HOST; nur für Attention erforderlich |

Für den ersten Kreile-Nutzenfall liefert M02 zwei getrennt quellengebundene Bewertungen: Termintreue und Liquidität 30 Tage. M01 besitzt die dafür benötigten laufenden Kosten, den manuell gepflegten Kontostand und später bestätigte Bankvorschläge; M03 hält davon nur opake Messdefinitions-/Evaluationsreferenzen und den gemeinsamen Zielbezug. Fehlende oder nicht belastbare Eingaben bleiben sichtbar `In Klärung` und werden nicht lokal ersetzt (OE-2609-23/24).

Die M03-Geschäftszielhistorie bleibt entsprechend OE-2609-20 erhalten. Personenbeziehbar sind ausschließlich zentral aufgelöste Verantwortungsreferenzen; wie deren Personenbezug nach Fristablauf entfernt wird, ohne die append-only Historie umzuschreiben, ist Q-M03-012. Bis zur Klärung gibt es weder stille Löschung noch produktive M03-Personendaten.

## 3. Events

| Event | Besitzer | Payload | Erzeugung | Dauerhaftigkeit/Consumer |
|---|---|---|---|---|
| `goal.draft-saved.v1` | GOALS_V1 | `versionId`, `sequence` | nach neuem/überarbeitetem Draft | atomar mit Aggregat/Receipt; spätere Projektionen |
| `goal.activated.v1` | GOALS_V1 | `versionId` | nach bestätigter Aktivierung | atomar; Attention/Analysis dürfen referenziell reagieren |
| `goal.superseded.v1` | GOALS_V1 | `previousVersionId`, `activeVersionId`, `reasonCode` | nach bestätigter Ablösung | atomar; alte Version bleibt unverändert |
| `goal.closed.v1` | GOALS_V1 | `reasonCode` | nach bestätigtem Close | atomar; Ziel bleibt historisch lesbar |

Jedes Event enthält außerdem `eventId`, `securityScopeRef`, `aggregateId`, `aggregateRevision` und `occurredAt`. Konkrete Outbox-/Tabellennamen sind nicht autorisiert und werden erst in Q-M03-003 entschieden.

## 4. Datenmodell-Feldliste und Soll-Ist-Abgleich

Die Tabelle beschreibt das **logische** Candidate.3-Modell. Sie autorisiert keine konkreten Tabellen oder JSON-Spalten. Auf `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9` ergab die Suche außerhalb der Dokumentation null Treffer für Leadership/GOALS-Typen oder Events; `src/modules/leadership-decisions/` existiert nicht.

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| GoalAggregate | contractVersion | Literal `1.0.0` | ja | Major-Version kompatibel | GOALS_V1 | Nein; keine Goals-Migration/kein Goals-Schema |
| GoalAggregate | goalId | opake ID | ja | je SecurityScope eindeutig, unveränderlich | GOALS_V1 | Nein |
| GoalAggregate | securityScopeRef.namespace | String | ja | opak, hostgebunden, kein Tenantliteral im Core | Host-Scope; GOALS referenziert | Nein |
| GoalAggregate | securityScopeRef.id | String | ja | serverseitig gebunden, nicht aus Client autorisieren | Host-Scope; GOALS referenziert | Nein |
| GoalAggregate | revision | Integer | ja | ab 1, jeder Command exakt +1, CAS | GOALS_V1 | Nein |
| GoalAggregate | lifecycle | `Open` oder `Closed` | ja | Closed ist endgültig schreibgeschützt | GOALS_V1 | Nein |
| GoalAggregate | closedAt/closedBy/reasonCode | Timestamp/Ref/String | bei Closed | vollständig nur bei Closed | GOALS_V1 | Nein |
| GoalAggregate | createdAt/updatedAt | ISO-Timestamp | ja | createdAt unveränderlich; Zeit nicht rückwärts | GOALS_V1 | Nein |
| GoalVersion | versionId | opake ID | ja | eindeutig, unveränderlich | GOALS_V1 | Nein |
| GoalVersion | goalId | opake ID/Relation | ja | gleicher Scope/Aggregatbezug | GOALS_V1 | Nein |
| GoalVersion | sequence | Integer | ja | streng fortlaufend im Aggregat | GOALS_V1 | Nein |
| GoalVersion | label | String | ja | validiert; in Telemetrie verboten | GOALS_V1 | Nein |
| GoalVersion | target.mode | Enum | ja | `minimum`, `maximum`, `exact`, `range` | GOALS_V1 | Nein |
| GoalVersion | target values | `MeasureValueV1` | ja | kind `decimal`, `integer` oder `duration`; passende Felder je Modus | GOALS_V1 | Nein |
| GoalVersion | tolerance | `MeasureValueV1` | nein | nur bei `exact`, kompatibler Typ/Einheit | GOALS_V1 | Nein |
| GoalVersion | unitDefinitionRef | `OpaqueReferenceV1` | ja | namespaced, hostaufgelöst | externer Unit-Owner; GOALS referenziert | Nein |
| GoalVersion | measurementDefinitionRef | Ref mit version/hash | ja | exakte Version und SHA; bei Aktivierung kompatibel/aktuell | externer Measurement-Owner; GOALS referenziert | Nein |
| GoalVersion | period.startInclusive | ISO-Timestamp | ja | inklusiv, vor endExclusive | GOALS_V1 | Nein |
| GoalVersion | period.endExclusive | ISO-Timestamp | ja | exklusiv | GOALS_V1 | Nein |
| GoalVersion | period.timeZone/calendar | IANA-Zeitzone / `iso8601` | ja | explizit, keine implizite Monatsemantik | GOALS_V1 | Nein |
| GoalVersion | validFrom | ISO-Timestamp | ja | expliziter Gültigkeitsbeginn | GOALS_V1 | Nein |
| GoalVersion | responsibilityRef | `OpaqueReferenceV1` | ja | namespaced; bei Aktivierung aktuell auflösbar | externer Responsibility-Owner; GOALS referenziert | Nein |
| GoalVersion | relatedRefs.evaluations | Liste opaker Refs | ja, darf leer sein | keine Evaluation kopieren | Evaluation-Owner; GOALS referenziert | Nein |
| GoalVersion | relatedRefs.tasks | Liste opaker Refs | ja, darf leer sein | kein Aufgabenstatus | Planning-Owner; GOALS referenziert | Nein |
| GoalVersion | relatedRefs.domainCommands | Liste opaker Refs | ja, darf leer sein | keine Ausführung/kein Commandstatus | Fachcommand-Owner; GOALS referenziert | Nein |
| GoalVersion | createdAt/createdBy | Timestamp/ResponsibilityRef | ja | unveränderlich | GOALS_V1 | Nein |
| GoalVersionDisposition | dispositionId | opake ID | ja | append-only | GOALS_V1 | Nein |
| GoalVersionDisposition | versionId | opake ID | ja | referenziert existierende Zielversion | GOALS_V1 | Nein |
| GoalVersionDisposition | status | Enum | ja | `Draft`, `Active`, `Superseded`; letzte Disposition ist aktuell | GOALS_V1 | Nein |
| GoalVersionDisposition | changedAt/changedBy | Timestamp/Ref | ja | append-only Nachweis | GOALS_V1 | Nein |
| GoalVersionDisposition | supersededByVersionId/reasonCode | ID/String | bedingt | bei Ablösung gemäß Transition | GOALS_V1 | Nein |
| GoalTransition | transitionId | opake ID | ja | append-only, eindeutig | GOALS_V1 | Nein |
| GoalTransition | kind | Enum | ja | DraftSaved/DraftSuperseded/Activated/ActiveSuperseded/Closed | GOALS_V1 | Nein |
| GoalTransition | at/by | Timestamp/Ref | ja | serverseitig | GOALS_V1 | Nein |
| GoalTransition | versionId/replacementVersionId/reasonCode | IDs/String | bedingt | muss zur Transition-Art passen | GOALS_V1 | Nein |
| CommandReceipt | receiptId | opake ID | ja | dauerhaft eindeutig | GOALS_V1 via Hostpersistenz | Nein |
| CommandReceipt | securityScopeRef | Ref | ja | gleicher Scope wie Command/Aggregat | Host-Scope + GOALS-Nachweis | Nein |
| CommandReceipt | commandId/idempotencyKey/correlationId | Strings | ja | servergebunden; Idempotenz je Scope | GOALS_V1 | Nein |
| CommandReceipt | intentHash | SHA-256 | ja | bindet kanonisches Commanddokument | GOALS_V1 | Nein |
| CommandReceipt | commandKind/goalId | Enum/ID | ja | Replay muss Hash, Ziel und Art matchen | GOALS_V1 | Nein |
| CommandReceipt | outcome/durability | `committed` / `host-atomic` | ja | kein Fake-Success | GOALS_V1 | Nein |
| CommandReceipt | authorizationPolicyVersion | String | ja | bei Commit belegte Hostpolicy | Host Authorization; Receipt referenziert | Nein |
| CommandReceipt | requestBindingPolicyVersion | String | ja | bei Commit belegte Bindingpolicy | Host Binding; Receipt referenziert | Nein |
| CommandReceipt | confirmationProof | Policyversion + EvidenceRef | bedingt | Pflicht außer SaveDraft | Host Confirmation; Receipt referenziert | Nein |
| CommandReceipt | committedAt/eventIds | Timestamp/Liste | ja | Events atomar mit Receipt | GOALS_V1 | Nein |
| CommandReceipt | readback | goalId, revision, hash, aktive/Draft-Version | ja | Hash des committed Aggregats | GOALS_V1 | Nein |
| GoalDomainEvent | eventId/type | ID/Eventliteral | ja | `.v1`, eindeutig | GOALS_V1 | Nein |
| GoalDomainEvent | scope/aggregate/revision/occurredAt | Ref/ID/Integer/Timestamp | ja | atomar und scopegebunden | GOALS_V1 | Nein |
| GoalDomainEvent | payload | typabhängiges Objekt | ja | nur definierte Felder, keine fremden Fakten | GOALS_V1 | Nein |
| MeasurementDefinition | ref/valueKind/unit/direction/precision | Ref/Enums/Integer | ja | versioniert/gehasht, kompatibel | M02/hosteigener Measurement-Owner | Nein; Owner/Port fehlt |
| MeasurementDefinition | periodRule/freshnessRule/coverageRule | Objekt | ja | Zeitzone, max. Alter, min. Ratio | M02/hosteigener Measurement-Owner | Nein |
| GoalEvaluationSummary | evaluationRef/scope/goal/version | Refs | ja | exakt gebundene Zielversion | M02/Analysis | Nein; Port fehlt |
| GoalEvaluationSummary | state/assessedAt/explanationRef | Enum/Timestamp/Ref | ja/optional | on-track/at-risk/achieved/missed/unknown | M02/Analysis | Nein |

### Soll-Ist-Fazit

- `origin/main` besitzt 30 Dateien unter `supabase/migrations` und 15 unter `src/db`, aber keine Goal-/Leadership-Struktur.
- Der Slot `src/modules/leadership-decisions/` ist owner-ratifiziert, im Repo jedoch nicht angelegt.
- Candidate.3 enthält bewusst keine Migration, Tabelle, View oder Provider.
- Eine konkrete Tabellen-/Migrationsentscheidung wäre eine neue dauerhafte Strukturentscheidung und bleibt Q-M03-003; der Builder darf keine Namen oder JSON-Abkürzung erfinden.

## 5. Manifest und Integrations-Handshake

| Artefakt | Pfad | SHA-256 | Aussage |
|---|---|---|---|
| Candidate-Manifest | `outputs\leadership-goals-v1-module-candidate.3\capability.manifest.json` | `7D16F7D86BCC1FAAB2D04F95270A098D834B5427DF6E19EC6031FC86696E83E9` | Nur `GOALS_V1`, keine Tabellen/Migrationen/Routes/Provider/UI-Slots |
| Integrations-Handshake | `outputs\leadership-goals-v1-module-candidate.3\INTEGRATION_HANDSHAKE.json` | `CE4E9F23688A9473BD3DBAB77695D89D50A02EB97E0CFB0FE7DD6628ECA5A264` | Ports, Failure States, Blocker, Opus-/Adoptionsstatus |
| Hashmanifest | `outputs\leadership-goals-v1-module-candidate.3\ARTIFACT_HASHES.json` | `E06070A11949…` | finaler Inhalt 107 Dateien/556595 Bytes/`3AEB7CDB…` |
| Audit-Freeze | `outputs\leadership-goals-v1-module-candidate.3\FINAL_AUDIT_FREEZE.json` | `63EE2497C871…` | technischer Scope 103 Dateien/539796 Bytes/`E7E155C7…` |

Das Candidate-Manifest ist **nicht** das Kreile-Hostmanifest. Bei Adoption bleibt der neutrale Core unverändert intern gebunden; ein Kreile-konformes Manifest und die Hostfassaden liegen außen im Modulslot. Das ist Teil der noch nicht freigegebenen Adoptionsmission.

## 6. APIs und Provider

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Externe Provider im GOALS_V1-Core | keine | keiner | keine Abhängigkeit | Provider dürfen nicht ergänzt werden; neue Abhängigkeit braucht eigenes Ownergate |
| Supabase als späterer Kreile-Host | serverseitiger Scope, RLS je Goal/Receipt/Event; Servicepfad nach bestehendem Muster | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (nur Namen) | Goals-Schema/RLS/Transaktion FEHLT | Migration/RLS/Remote-Write nur nach ausdrücklicher Freigabe |
| Vercel/Next.js Host | serverseitige Fassaden und Route erst nach Adoption/E2E | keine zusätzlichen M03-Secrets; nutzt bei Freigabe die vorgenannten Hostnamen | M03-Route FEHLT | kein Preview/Deploy durch dieses Dossier |
| M02/Analysis | versionierte interne Read-Ports, kein Providerzugriff aus M03 | keiner in M03 | Evaluation-/Measurement-Port FEHLT | M02 bleibt eigener Wahrheitseigentümer |
| Künftige External Intelligence/KI | nur über getrennte C6-/Capability-Ports | erst am späteren Providergate zu benennen | BLOCKED/außerhalb GOALS_V1 | kein Credential-, Tool- oder Fachcommandrecht für Modelle |

## 7. Übertragbarkeit

**Kern app-neutral: ja – Grund:** Contract-Version 1.0.0, Zielaggregate und Invarianten, Commands, Receipts/Readback, ReadEnvelope- und Error-Semantik, Events sowie die HostAdapter-Schnitt enthalten keine Kreile-Fachbegriffe, -Rollen, -Tabellen, -Routen oder Provider.

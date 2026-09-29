<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Schnittstellen und Daten

## 1. Angebotene Ports des off-repo Candidate

Der Candidate ist nicht adoptiert. Die Portnamen sind Spezifikationsstand, keine im Repo verfügbare Funktion.

| Port | Richtung | Zweck | Vertrag/Stand |
|---|---|---|---|
| `CommunicationIntakePortV1` | Host → M05 | Manuelle Telefonnotiz oder attestierte E-Mail aufnehmen | CAND · SPEZ |
| `CommunicationCaseCommandPortV1` | Host → M05 | Zuordnen, Review, Routing, Domain-Aktion, Draft/Send, Resolve/Archive steuern | CAND · SPEZ |
| `CommunicationCaseReadPortV1` | Host ← M05 | Fall-Snapshot mit Coverage/Unsicherheit lesen | CAND · SPEZ |
| `CommunicationAuthorizedContextBrokerPortV1` | Host ↔ M05 | Disclosure-Grant anfordern und Zugriff revisionsgebunden auditieren | CAND · SPEZ |
| `CommunicationProjectionReadPortV1` | Verbraucher ← M05 | generischer, zielgebundener Projection-Feed | CAND · SPEZ |
| `CommunicationSearchProjectionReadPortV1` | G08 ← M05 | sichere, widerrufbare Suchprojektion | CAND · SPEZ |
| `CommunicationTodayProjectionReadPortV1` | G02 ← M05 | Handlungsbedarf-/Today-Projektion | CAND · SPEZ |
| `CommunicationAnalysisOutcomeReadPortV1` | M02 ← M05 | erlaubte Ergebnisprojektion ohne Rohinhalt | CAND · SPEZ |
| `CommunicationHealthReadPortV1` | G10 ← M05 | Laufzeit-/Checkpoint-/Recovery-Gesundheit | CAND · SPEZ |
| `CommunicationIntakeCoreV1` | Host ↔ M05 | Hauptservice der Portimplementierungen | CAND · SPEZ |
| `CommunicationCheckpointCoordinatorV1` | Worker ↔ M05 | signierte Scope-Checkpoints | CAND · SPEZ |
| `CommunicationRecoveryCoordinatorV1` | Worker ↔ M05 | Lease-gebundene Readback-/Unknown-Recovery | CAND · SPEZ |

Geplanter Repo-Pfad nach Transfergate: `src/modules/communication-intake/{public.ts,server-public.ts}`. Dieser Pfad ist noch nicht angelegt und keine Erlaubnis, ihn vor dem Gate zu erstellen.

## 2. Benötigte Host-Ports

| Host-Port | Besitzer | Zweck | Voraussetzung/Stand |
|---|---|---|---|
| `CommunicationIntakeHostPolicyV1` | G01/Host | Limits, dokumentartspezifische Retention, freigegebene Modi und Recovery-Budgets | Retention-Grundsatz GEKLÄRT → Q-M05-010; konkrete technische Policy/Datenschutz-Gate Q-M05-016 |
| `CommunicationCommandAuthorizationPortV1` | G01 | Actor/Session/Recht gegen exakten Intent prüfen | FEHLT |
| `DurableCommunicationStoreV1` | M05-HostAdapter | Events, Heads, Receipts, Idempotenz, Checkpoints, Jobs und Leases atomar speichern | Job-/Outbox-Linie GEKLÄRT → Q-M05-001; Tabellen-/Bestandsentscheidung FEHLT → Q-M05-018 |
| `SecureCommunicationContentPortV1` | Host-Infrastruktur | Content-Refs, HMAC/Hashes, aktive Schlüssel, Tombstone/Erasure | FEHLT → Q-M05-016/018 |
| `CommunicationClockPortV1`, `CommunicationHasherPortV1`, `CommunicationIdFactoryPortV1` | Host-Infrastruktur | deterministische Zeit-, Digest- und ID-Dienste | FEHLT |
| `CommunicationSchedulerPortV1`, `CommunicationTelemetryPortV1` | Host-Infrastruktur | Supabase Cron mit DB-/Edge-Funktionen, Job-/Outbox-Tabelle und sichere Telemetrie ohne Rohinhalt | Laufzeitlinie GEKLÄRT → Q-M05-001; Tabellenumsetzung FEHLT → Q-M05-018 |
| `CustomerMatchReadPortV1` | G05 | versionierte Kandidatenmenge aus Match-Hinweisen | FEHLT → Q-M05-004 |
| `CommunicationDisclosureAuthorizationReadPortV1` | G01 | zweck-/zeit-/assignmentgebundene Freigabe | FEHLT → Q-M05-004 |
| `CustomersAuthorizedContextReadPortV1` | G05 | autorisierter Kundenkontext | FEHLT |
| `OrdersAuthorizedContextReadPortV1` | G04 | autorisierter Auftragskontext | FEHLT |
| `QuotesAuthorizedContextReadPortV1` | G06 | autorisierter KV-/Angebotskontext | FEHLT |
| `AccountingAuthorizedContextReadPortV1` | M01/G07 | autorisierter Accounting-/Zahlungskontext | FEHLT |
| `UniversalDocumentIntakeEvidenceReadPortV1` | M06/UDI | SourceEnvelope, Absenderbefund, Coverage, Anhänge | FEHLT → Q-M05-005 |
| `DocumentOriginalEvidenceReadPortV1` | Dokument-Original | Original-Claim, Hash, MediaType, Länge, Security/Retention | FEHLT → Q-M05-005 |
| `ConfirmedDomainCommandSubmitPortV1` + `ConfirmedDomainCommandReadbackPortV1` | G05/G04/G06, Record-Key `CUSTOMERS`/`ORDERS`/`QUOTES` | bestätigte Owner-Aktion plus fachlicher Readback | FEHLT |
| `OutboundDraftTransportPortV1` | M365-Adapter | Graph-Draft im Kreile-Büropostfach materialisieren | Mailboxmodus GEKLÄRT → Q-M05-002; Umsetzung/Owner-Gate Q-M05-017 |
| `OutboundSendTransportPortV1` | M365-Adapter | bestätigten Draft aus dem Kreile-Büropostfach senden | Mailboxmodus GEKLÄRT → Q-M05-002; Umsetzung/Owner-Gate Q-M05-017 |
| `OutboundTransportReadbackPortV1` | M365-Adapter | Draft/Send-Operation im Kreile-Büropostfach wiederlesen und korrelieren | Mailboxmodus GEKLÄRT → Q-M05-002; Umsetzung/Owner-Gate Q-M05-017 |
| Projektionssenken SEARCH/TODAY/ANALYSIS | G08/G02/M02 | sequenzierte Upsert-/Revoke-Feeds übernehmen | FEHLT → Q-M05-013 |

## 3. Events

Jedes Event trägt `schemaVersion`, `canonicalFormVersion`, vollständigen Scope plus Fingerprint, `caseId`, monotone `sequence`, verkettete MAC, Zeitpunkt, Actor-/Command-Ref, Intent-Digest, Kind und validierten Payload. Die Eventkette ist append-only.

| Gruppe | Event-Kinds | Wirkung |
|---|---|---|
| Fall/Quelle | `CASE_OPENED`, `ENTRY_APPENDED`, `CASE_RESOLVED`, `CASE_REOPENED`, `CASE_ARCHIVED` | Fall- und Eintragslebenszyklus |
| Match/Zuordnung | `CUSTOMER_MATCH_REQUESTED`, `CUSTOMER_CANDIDATE_SET_RECORDED`, `CUSTOMER_ASSIGNMENT_CONFIRMED`, `CUSTOMER_ASSIGNMENT_CORRECTED`, `ASSIGNMENT_REVISION_SUPERSEDED` | Menschlich bestätigte Kundenzuordnung |
| Disclosure | `DISCLOSURE_GRANT_RECORDED`, `DISCLOSURE_NOT_AVAILABLE_RECORDED`, `DISCLOSURE_CONTEXT_ACCESS_RECORDED` | Zweckgebundener Kontextzugriff |
| Review/Evidenz | `REVIEW_STARTED`, `REVIEW_ACCEPTED`, `REVIEW_REJECTED`, `SOURCE_EVIDENCE_DRIFT_DETECTED` | Prüfung und Drift |
| Routing | `ROUTING_SUGGESTION_RECORDED`, `ROUTING_SUGGESTION_CONFIRMED`, `ROUTING_SUGGESTION_REJECTED`, `ROUTING_SUGGESTION_SUPERSEDED` | Vorschlag, nie fremde Wahrheit |
| Domain-Aktion | `DOMAIN_ACTION_REFERENCED`, `DOMAIN_ACTION_SUBMITTING`, `DOMAIN_ACTION_RECEIPT_RECORDED`, `DOMAIN_ACTION_READBACK_PENDING`, `DOMAIN_ACTION_OUTCOME_UNKNOWN`, `DOMAIN_ACTION_UNKNOWN_ESCALATED`, `DOMAIN_ACTION_READBACK_CONFIRMED`, `DOMAIN_ACTION_READBACK_REJECTED`, `DOMAIN_ACTION_BLOCKED`, `DOMAIN_ACTION_CANCELLED_BEFORE_SUBMIT` | Command/Receipt/Readback-Zustandsmaschine |
| Entwurf/Transport | `DRAFT_REVISION_CREATED`, `DRAFT_SUPERSEDED`, `SEND_CONFIRMED`, `TRANSPORT_DRAFT_RECEIPT_RECORDED`, `TRANSPORT_SEND_RECEIPT_RECORDED`, `TRANSPORT_READBACK_PENDING`, `TRANSPORT_OUTCOME_UNKNOWN`, `TRANSPORT_UNKNOWN_ESCALATED`, `TRANSPORT_READBACK_CONFIRMED`, `TRANSPORT_READBACK_MISMATCH`, `TRANSPORT_ARTIFACT_ORPHANED`, `TRANSPORT_BLOCKED` | Human-confirmed Reply und sicherer Transport |
| Recovery/Retention | `RECOVERY_SCHEDULED`, `CONTENT_RETENTION_REQUESTED`, `CONTENT_RETENTION_TOMBSTONED`, `EVIDENCE_KEY_ERASURE_REQUESTED`, `EVIDENCE_KEY_ERASED` | kontrollierter Wiederanlauf und Datenschutz |

## 4. Datenmodell-Feldliste und Soll-Ist

`Typ` folgt dem Candidate. `Ref` ist eine opake, nicht erratbare Referenz; `SHA-256` ein kanonischer Digest. „Nein“ bedeutet: In der letzten dokumentierten read-only Inventur des Snapshots wurde kein passendes adoptiertes Feld gefunden; ähnlich benannte Legacy-Spalten sind keine vertragliche Entsprechung. Die aktuelle Git-/Kanon-Frische ist Q-M05-015.

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| CommunicationScopeV1 | hostInstanceId | Ref | ja | Scope-Bindung, unveränderlich | G01/Host | Nein |
| CommunicationScopeV1 | environmentId | Ref | ja | keine Cross-Environment-Nutzung | G01/Host | Nein |
| CommunicationScopeV1 | dataPartitionId | Ref | ja | Tenant/Datenpartition | G01/Host | teilweise `tenant_id`, aber nicht Vertrag |
| CommunicationScopeV1 | capabilityId | Literal | ja | feste M05-Capability | M05 | Nein |
| CommunicationActorV1 | actorId | Ref | ja | autorisierte Person/Systemidentität | G01 | teilweise `created_by`; Sessionbindung fehlt |
| CommunicationActorV1 | actorKind | Enum | ja | `HUMAN` oder `SERVICE` | G01 | Nein |
| CommunicationActorV1 | sessionRef | Ref | ja | aktuelle Session | G01 | Nein |
| CommunicationActorV1 | authorizationEvidenceRef | Ref | ja | prüfbare Autorisierung | G01 | Nein |
| CommunicationCaseEventV1 | caseId | Ref | ja | innerhalb Scope eindeutig | M05 | legacy IDs, keine Case-ID |
| CommunicationCaseEventV1 | sequence | Integer | ja | streng monoton ab 1 | M05 | Nein |
| CommunicationCaseEventV1 | previousEventMac/eventMac | KeyedDigest | ja | manipulationssichere Kette | M05 | Nein |
| CommunicationCaseEventV1 | occurredAt | ISO-8601 | ja | nicht rückwärts | M05 | nur generische Timestamps |
| CommunicationCaseEventV1 | actorRef/commandId/intentDigest | Ref/Ref/Digest | ja | exakte Command-Bindung | M05/G01 | Nein |
| CommunicationCaseEventV1 | eventKind/payload | Enum/Object | ja | exakte Validatoren | M05 | Nein |
| CaptureManualPhoneNotePayloadV1 | sourceId | Ref | ja | idempotente Quelle | M05 | `phone_notes.id` ist keine Source-ID |
| CaptureManualPhoneNotePayloadV1 | observedAt | ISO-8601 | ja | Beobachtungszeit | M05 | nur `created_at` legacy |
| CaptureManualPhoneNotePayloadV1 | captureMethod | Enum | ja | `TYPED` oder `SPEECH_TRANSCRIPT` | M05 | Nein |
| CaptureManualPhoneNotePayloadV1 | noteText | Secure content | ja | nach Aufnahme nur als sichere Content-Ref | M05 | legacy `phone_notes.raw_text`, ungeeignet |
| CaptureManualPhoneNotePayloadV1 | languageTag | String/null | nein | nullable; genaue Spracheingabe nach Hostpolicy | M05 | Nein |
| CaptureManualPhoneNotePayloadV1 | retentionClassRef | Ref | ja | Hostpolicy | Host/M05 | Nein |
| CaptureEmailInboundPayloadV1 | udiSourceRef | Ref | ja | monitored inbound source | M06/UDI | Nein |
| CaptureEmailInboundPayloadV1 | udiEvidenceRevision | Integer | ja | exakte Evidenzrevision | M06/UDI | Nein |
| CaptureEmailInboundPayloadV1 | messageOriginal | DocumentClaimV1 | ja | Original vor Ableitung | Dokument-Original | Nein |
| CaptureEmailInboundPayloadV1 | attachments | DocumentClaimV1[] | ja | jede Anlage einzeln attestiert | Dokument-Original | Nein |
| CaptureEmailInboundPayloadV1 | observedAt | ISO-8601 | ja | Provider-Eingangszeit | M365-Adapter | legacy `created_at`, keine Provenienz |
| DocumentClaimV1 | originalRef | Ref | ja | opak, stabil | Dokument-Original | Nein |
| DocumentClaimV1 | evidenceRevision | Integer | ja | Versionsbindung | Dokument-Original | Nein |
| DocumentClaimV1 | contentHash | SHA-256 | ja | Byte-Identität | Dokument-Original | Nein |
| UniversalDocumentIntakeEvidenceV1 | ingressAttestation | Object | ja | `ingressClass=EMAIL_INBOUND_MONITORED`, Binding, Attester | M06/UDI | Nein |
| UniversalDocumentIntakeEvidenceV1 | scope/sourceRef/evidenceRevision | Scope/Ref/Integer | ja | exakte Source-/Scope-Bindung | M06/UDI | Nein |
| UniversalDocumentIntakeEvidenceV1 | senderAuthenticationDisposition | Enum | ja | `VERIFIED`/`UNVERIFIED`/`FAILED`/`UNKNOWN` | M06/UDI | Nein |
| UniversalDocumentIntakeEvidenceV1 | senderEvidenceRef/senderAddressDigest | Ref/KeyedDigest | ja | Reply-Empfängerbindung | M06/UDI | Nein |
| UniversalDocumentIntakeEvidenceV1 | observedAt/messageOriginal/attachments | ISO-8601/DocumentClaimV1/DocumentClaimV1[] | ja | Zeit und Claims müssen Capture entsprechen | M06/UDI | Nein |
| UniversalDocumentIntakeEvidenceV1 | coverage/uncertaintyReasons | Enum/String[] | ja | Teilabdeckung/Unsicherheit sichtbar | M06/UDI | Nein |
| DocumentOriginalEvidenceV1 | scope/claim | Scope/DocumentClaimV1 | ja | Scope und exakter Original-Claim | Dokument-Original | Nein |
| DocumentOriginalEvidenceV1 | mediaType/byteLength | String/Integer | ja | Typ und Länge des Originals | Dokument-Original | Nein |
| DocumentOriginalEvidenceV1 | securityDisposition/securityEvidenceRef | Enum/Ref | ja | nur `CLEAN` ist nutzbar | Dokument-Original | Nein |
| DocumentOriginalEvidenceV1 | retentionClassRef/checkedAt | Ref/ISO-8601 | ja | Retention und Prüfzeit | Dokument-Original | Nein |
| CommunicationSourceRecordV1 | sourceKind/sourceOwner/sourceRef/sourceVersion | Enum/Enum/Ref/Integer | ja | Quellenbesitz/Revision | M05 + Quellmodul | Nein |
| CommunicationSourceRecordV1 | observedAt/capturedAt | ISO-8601/ISO-8601 | ja | Quellen- und Erfassungszeit | M05 | Nein |
| CommunicationSourceRecordV1 | contentRef/contentEvidence | Ref/Object | ja | keine Rohdaten in Event | M05 | Nein |
| CommunicationSourceRecordV1 | captureMethod/provenanceEvidenceRefs | Enum/Ref[] | ja | nachvollziehbar | M05 | Nein |
| CommunicationSourceRecordV1 | coverage/uncertaintyReasons | Enum/String[] | ja | keine stille Teilabdeckung | M05 | Nein |
| CommunicationSourceRecordV1 | udiEvidenceRevision/senderAuthenticationDisposition/senderEvidenceRef/attachmentClaims | Integer?/Enum?/Ref?/Claim[] | ja | mailbezogen nullable; Telefon ohne UDI | M05/M06 | Nein |
| CustomerCandidateSetV1 | scopeFingerprint/caseId/requestRef | Digest/Ref/Ref | ja | Scope-/Request-Bindung | M05/G05 | Nein |
| CustomerCandidateSetV1 | candidateSetVersion/issuedAt/expiresAt/issuedAtCaseRevision | String/ISO-8601/ISO-8601/Integer | ja | versioniert und zeitlich begrenzt | M05/G05 | Nein |
| CustomerCandidateSetV1 | candidates | CustomerMatchCandidateV1[] | ja | eindeutige Refs; keine automatische Auswahl | G05 | Nein |
| AssignmentSnapshotV1 | customerRef/candidateSetVersion | Ref/String | ja | menschlich bestätigter Kandidatensatz | G05, Link in M05 | `customer_id` legacy ohne Bestätigungsrevision |
| AssignmentSnapshotV1 | assignmentRevision | Integer | ja | jede Korrektur superseded | M05 | Nein |
| DisclosureGrantV1 | grantRef/scopeFingerprint/caseId/assignmentRevision/actorId | Ref/Digest/Ref/Integer/Ref | ja | Scope-/Fall-/Actor-Bindung | G01/M05 | Nein |
| DisclosureGrantV1 | subjectRef/purpose/projectionId/requestIntentHash | Ref/Enum/Enum/SHA-256 | ja | Zweck-/Projektionsbindung | G01/Owner-Modul | Nein |
| DisclosureGrantV1 | issuedAt/expiresAt/policyRef/status | ISO-8601/ISO-8601/Ref/Enum | ja | `GRANTED`/`DENIED`/`REVOKED`, fail-closed | G01 | Nein |
| RoutingSuggestionV1 | suggestionId/targetKind/targetRef | Ref/Enum/Ref? | ja | Ziel nur Vorschlag | M05 | Nein |
| RoutingSuggestionV1 | evidenceRefs/uncertainty | Ref[]/Object | ja | begründet, sichtbar | M05 | Nein |
| ConfirmedDomainCommandRefV1 | ownerDomain | Enum | ja | `CUSTOMERS`/`ORDERS`/`QUOTES` | jeweiliges Owner-Modul | Nein |
| ConfirmedDomainCommandRefV1 | commandRef/commandApiVersion | Ref/String | ja | versionierter Owner-Command | Owner-Modul | Nein |
| ConfirmedDomainCommandRefV1 | subjectRef/targetRef | Ref/Ref | ja | exakte Zielbindung | Owner-Modul | Nein |
| ConfirmedDomainCommandRefV1 | idempotencyKey/intentHash | String/SHA-256 | ja | genau-einmal-Semantik | M05/Owner | Nein |
| ConfirmedDomainCommandRefV1 | confirmationRef/evidenceSetHash | Ref/SHA-256 | ja | Human-/Evidence-Bindung | M05 | Nein |
| CreateDraftRevisionPayloadV1 | caseId/draftId/assignmentRevision/disclosureGrantRef | Ref/Ref/Integer/Ref | ja | Fall-, Draft-, Assignment- und Grantbindung | M05 + Adapter | `communication_drafts` ohne Revision/Case |
| CreateDraftRevisionPayloadV1 | udiSourceRef/udiEvidenceRevision/senderBindingRef/inboundRecipientEvidenceRef | Ref/Integer/Ref/Ref | ja | nur attestierter Inbound-Sender | M06/UDI | Nein |
| CreateDraftRevisionPayloadV1 | recipientDigest | KeyedDigest | ja | kein Klartext im Event | M05 | Nein |
| CreateDraftRevisionPayloadV1 | subjectText/bodyText | Secure input | ja | bei Persistenz sichere Content-Refs | M05/Adapter | legacy Klartextspalten, ungeeignet |
| CreateDraftRevisionPayloadV1 | attachmentClaims/reviewedEntryRefs/retentionClassRef/origin | Claim[]/Ref[]/Ref/Enum | ja | Original-, Review-, Retention- und Ursprungsbindung | Dokument-Original/M05 | Nein |
| ConfirmSendPayloadV1 | caseId/draftId/draftRevision/assignmentRevision | Ref/Ref/Integer/Integer | ja | exakte bestätigte Revision | M05 | Nein |
| ConfirmSendPayloadV1 | senderBindingRef/renderedRecipientDigest | Ref/KeyedDigest | ja | Empfängerdrift blockiert | M05 | Nein |
| ConfirmSendPayloadV1 | udiSourceRef/udiSenderEvidenceRef/udiEvidenceRevision | Ref/Ref/Integer | ja | aktuelle Inbound-/Sender-Evidenz | M06/UDI | Nein |
| CommunicationDurableReceiptV1 | receiptId/scopeFingerprint | Ref/SHA-256 | ja | dauerhaft und scoped | M05/Host | Nein |
| CommunicationDurableReceiptV1 | commandId/caseId/correlationId | Ref/Ref/Ref | ja | vollständige Korrelation | M05 | Nein |
| CommunicationDurableReceiptV1 | intentDigest/acceptedAt/acceptedRevision | KeyedDigest/ISO-8601/Integer | ja | Readback-Prüfung | M05 | Nein |
| CommunicationDurableReceiptV1 | outcome/externalOutcome | Enum/Enum | ja | `DURABLY_ACCEPTED`/`IDEMPOTENT_REPLAY`; extern `NOT_ATTEMPTED` | M05 | Nein |
| ReadEnvelopeV1 | source/binding/asOf | Ref/Object/ISO-8601 | ja | Quellen- und Zeitbindung | jeweiliger Owner | Nein |
| ReadEnvelopeV1 | coverage/uncertainty/stale/partial/denied | Object/Object/Bool/Bool/Bool | ja | keine stillen Lücken | jeweiliger Owner | Nein |
| ReadEnvelopeV1 | correlationId/data | Ref/Object | ja | Korrelation; Daten ownergeführt | jeweiliger Owner | Nein |
| CommunicationProjectionChangeV1 | target/feedRef/projectionSequence/changeKind | Enum/Ref/Integer/Enum | ja | SEARCH/TODAY/ANALYSIS; `UPSERT`/`REVOKED` | M05/Verbraucher | Nein |
| CommunicationProjectionChangeV1 | caseId/caseRevision/assignmentRevision/customerRef | Ref/Integer/Integer/Ref | ja | exakte Fall-/Zuordnungsrevision | M05/G05 | Nein |
| CommunicationProjectionChangeV1 | projectionValidUntil/accessPolicyRef/evidenceRefs/outcomeCode | ISO-8601/Ref/Ref[]/String | ja | TTL und Zugriffspolitik | M05 | Nein |
| CommunicationProjectionChangeV1 | contentRef/sourceHash | Ref?/SHA-256 | ja | bei REVOKED/ANALYSIS kein contentRef | M05 | Nein |
| CommunicationCaseSnapshotV1 | caseId/scopeFingerprint/revision/lastEventMac/lastOccurredAt | Ref/SHA-256/Integer/SHA-256/ISO-8601 | ja | Head der verifizierten Eventkette | M05 | Nein |
| CommunicationCaseSnapshotV1 | lifecycle | Enum | ja | `OPEN`/`RESOLVED`/`ARCHIVED` | M05 | Nein |
| CommunicationCaseSnapshotV1 | entries/candidateEvidence/assignment/grants/routingSuggestions | Maps/Objects | ja | abgeleitete Zustände aus Events | M05 | Nein |
| CommunicationCaseSnapshotV1 | domainActions/drafts/transports | Maps | ja | Receipt-/Readback-Zustände | M05 | Nein |
| CommunicationCaseSnapshotV1 | tombstonedContentRefs/erasedKeyRefs/accessEventCount/unresolvedUnknownCount/orphanedArtifactCount | Ref[]/Ref[]/Integer/Integer/Integer | ja | Retention-, Audit- und Recoveryzähler | M05 | Nein |
| RecoveryJobV1 | jobRef/jobKind/targetRef/notBefore/deduplicationKey/scopeFingerprint | Ref/Enum/Ref/ISO-8601/String/SHA-256 | ja | dedupliziert und scoped | M05/Host | Nein |
| RecoveryLeaseV1 | leaseRef/resourceKey/ownerId/fencingToken/acquiredAt/expiresAt/revision | Ref/Ref/Ref/Integer/ISO-8601/ISO-8601/Integer | ja | Live-Fence vor Seiteneffekt | M05/Host | Nein |
| ScopeCheckpointV1 | scopeFingerprint/checkpointSequence/previousCheckpointMac/caseHeadCount/caseHeadsDigest/checkpointMac/createdAt | SHA-256/Integer/SHA-256?/Integer/SHA-256/KeyedDigest/ISO-8601 | ja | Restore-/Tamper-Nachweis | M05/Host | Nein |

### Legacy-Schemaabgleich

| Bestand | Vorhandene Felder | Ergebnis |
|---|---|---|
| `communication_drafts` in `src/db/schema.ts` | tenant, customer, subject/body, type, status, timestamps | Klartext und einfache Statusspalte; keine Scope-, Evidence-, Revision-, Confirmation-, Receipt- oder Readback-Bindung. Nicht als Candidate-Persistenz übernehmen. |
| `communications` in `src/db/schema.ts` | tenant, customer/order, subject/body, type/channel, provider id, status/open/bounce/complaint, timestamps | vermischt Fach- und Providerstatus; keine Eventkette/UDI/Original-/Grantbindung. Nicht M05-Wahrheit. |
| Baseline `communication_threads/messages` | tenant, customer/order, source/subject/status/priority/category; message direction/channel/body/summary | mögliche Bestandsdaten, aber kein Vertrag. Vor Migration separat inventarisieren; nie still mappen. |
| Baseline `phone_notes` | tenant, thread/customer/order, raw text, generated answer, caller/company/phone/category/urgency/status, JSON links, creator/timestamps | Mock-/Legacy-Modell mit Rohtext und abgeleiteten Feldern; G05/M05-Datenbesitz und sichere Content-Migration fehlen. |
| Baseline `inquiries` | Rohdaten und abgeleitete Anfragefelder | kein Ersatz für SourceEnvelope, Fall, Assignment oder Domain-Receipt. |

Eine neue dauerhafte Tabellen-/Speicherentscheidung ist nötig und darf gemäß Projektregel nicht vom Builder erfunden werden; siehe Q-M05-018.

## 5. Manifest und Handshake

| Datei | Pfad | SHA-256 | Bewertung |
|---|---|---|---|
| `capability.manifest.json` | `work/communication-intake-core-v1-candidate.2/capability.manifest.json` | `271BC2811B1158D040674B80EF250D4EC1899866B7C3E189779CC3FF8FD5824A` | Provider-/UI-/Schema-neutral; Candidate, nicht adoptiert |
| `INTEGRATION_HANDSHAKE.json` | `work/communication-intake-core-v1-candidate.2/INTEGRATION_HANDSHAKE.json` | `DBBEF89C121604D5820F4E7C27BE94DC0E3F20D26B0331538171A6D79BE82EE3` | alle Host-Gates müssen atomar erfüllt werden; Candidate, nicht adoptiert |
| Artefaktset | `work/communication-intake-core-v1-candidate.2/` | `DC26CD06043911EC1ACD13319DE84FF3FD2C904D41381EE8FCC94D354F3F74DF` | 86/86 Dateien am 2026-09-26 verifiziert |

## 6. APIs und Provider

Secret-Namen sind absichtlich noch nicht festgelegt; Werte dürfen weder Dossier noch Repo enthalten. Der Mailbox- und Berechtigungsmodus ist durch OE-2609-18 geklärt. Ressourceneinrichtung, Consent, Kostenfreigabe und die Benennung der Secret-Referenzen bleiben das externe Owner-/PL-Gate Q-M05-017 und werden nicht geraten.

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Microsoft Entra App Registration | Kreile-Tenant/App-ID, Redirect URI, delegierter Consent für das lizenzierte benannte Kreile-Büropostfach | In Klärung → Q-M05-017 | E0 · REPORTED_UNVERIFIED | Anlage, Consent und Tenantbindung nur Owner/Admin; kein Schritt ausgeführt |
| Microsoft Graph Mail Intake v1.0 | Delegated `Mail.Read` für Hauptposteingang, Body und Anhänge des Kreile-Büropostfachs | In Klärung → Q-M05-017 | E0 · REPORTED_UNVERIFIED | Modus durch OE-2609-18 geklärt; Einrichtung und Consent am Owner-Gate |
| Microsoft Graph Draft v1.0 | Delegated `Mail.ReadWrite` für das Kreile-Büropostfach | In Klärung → Q-M05-017 | E0 · REPORTED_UNVERIFIED | erst nach Human-Confirm-/Host- und Owner-Gate |
| Microsoft Graph Send v1.0 | Delegated `Mail.Send` für das Kreile-Büropostfach | In Klärung → Q-M05-017 | E0 · REPORTED_UNVERIFIED | 202 ist kein fachlicher Erfolg; Send nie automatisch |
| Graph Change Notifications | Subscription-Endpoint als Vercel-Route, HTTPS-Validation, Ablauf/Erneuerung; Route schreibt nur in DB-Outbox | In Klärung → Q-M05-017 | FEHLT | nur Hauptposteingang des festgelegten Kreile-Büropostfachs; keine Fachverarbeitung in der Route |
| Graph Message Delta | foldergebundener Delta-Cursor des Hauptposteingangs; mindestens `Mail.Read` für benötigten Inhalt | In Klärung → Q-M05-017 | FEHLT | Cursor/Backfill getrennt für Kreile-Tenant, -Postfach und -Ordner |
| Azure Document Intelligence | durch M06; Dokumentanalyse, kein Originalbesitz | FEHLT → M06-Dossier | E0 · REPORTED_UNVERIFIED; isolierter Dev-Test ist kein Kreile-E2E | Kreile-eigenes Azure-Abo in Production; Ressource/Key/Region nur nach Owner-Gate |
| Supabase Cron, DB-/Edge-Funktionen und sicherer Contentspeicher | Job-/Outbox-Tabelle mit Receipts; Schlüsselreferenzen für `EVENT_MAC`, `COMMAND_INTENT`, `CHECKPOINT_MAC`, `CONTENT`, `MATCH_HINT`, `CANDIDATE_SET`, `RECIPIENT` | In Klärung → Q-M05-016/017/018 | Laufzeitlinie GEKLÄRT → Q-M05-001; Umsetzung FEHLT | Supabase Pro/Kosten am Owner-Gate; Tabellenstruktur und Retention technisch noch festzulegen |

Aktualitätscheck 2026-09-26: Microsoft dokumentiert weiterhin die Mailbox-Einschränkung der Outlook-Change-Notifications, foldergebundene Delta-Abfragen, `Mail.ReadWrite` für Reply-Drafts, `Mail.Send` plus `202 Accepted` für Send und veränderliche Throttling-Limits. Normale Mail-Endpunkte erscheinen nicht in der aktuellen Metered-API-Liste; das ist keine Aussage über M365-Lizenz-, Azure-, Betriebs- oder Entwicklungskosten.

## 7. Übertragbarkeit

**Kern app-neutral:** ja. Grund: Der Kern enthält ausschließlich provider- und hostneutrale Verträge für Kommunikationsfälle, Evidenz, Bestätigung, Receipts, Readback und Recovery; Kreile-Fachbegriffe, Microsoft-Graph-Anbindung und Kreile-Ressourcen liegen im Kreile-HostAdapter.

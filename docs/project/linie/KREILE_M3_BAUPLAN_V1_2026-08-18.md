# M3 — BAUPLAN V1: Modul-Schnittstellenvertrag (aus echtem Code)

**Quelle:** Repo `galvanik-kreile-app`, main = `54858e4ffebb5472b02d5dbdafdc42b2241e588a` (API-verifiziert, 2026-08-18). Alle IST-Angaben sind aus dem Code dieses SHA extrahiert — nichts erfunden.
**Status:** `VORGELEGT` — die Freigabe des Auftraggebers ist das M3-Gate. Erst danach darf parallel gebaut werden.
**Zweck:** Jedes Modul auf einer Seite: **besitzt / bietet / nimmt an / sendet / liest.** Wer gegen dieses Dokument baut, kann später angeschlossen werden, ohne Wahrheiten zu doppeln.

---

## §1 Globale Verträge (gelten für jedes Modul, IST)

**Ergebnis-Muster (jeder Command):** diskriminierte Union
`{code: "OK", receipt, replayed} | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | VALIDATION_ERROR | UNAVAILABLE` — `replayed=true` = idempotenter Wiederlauf. UI meldet Erfolg erst nach Readback des Receipts über einen v_*-Port.

**Ereignis-Muster (append-only, `public.events`):** `event_type` (versioniert, z. B. `…_V1`), `event_schema_version`, `tenant_id`, `order_id`, `user_id`, `client_event_id` (Idempotenz), `correlation_id`, `aggregate_version`, `station/from_station`, `description`. DB-seitig per CHECK-Constraint + Update-Immutability-Trigger gesichert. **Ereignisse sind die Anschluss-Stellen** — spätere Module docken hier an, nie an UI oder Tabellen.

**Zustandskette (D-ARCH-002, `src/lib/orders/orderLifecycleContract.ts`):**
`angenommen → galvanik → fertig → abgeholt` (Ortswahrheit, nie Zeitwahrheit — aus Übergangs-Zeitstempeln wird nie Arbeitszeit/Abrechnung abgeleitet). Getrennte Abrechnungsachse: `bezahlt` (`ORDER_ACCOUNTING_STATUS`). Gebaut sind heute nur Schritt 1 und seine Korrektur; `fertig/abgeholt/bezahlt` sind fixierte Namen.

**Rollen (D-F12-003):** `buero | werkstatt | meister | admin` (`ORDER_STATION_FORWARD_ROLES`) — explizites, enges Gate je Übergang; wird nie durch Aufweiten generischer Permissions vergrößert.

**Cross-Modul-Lesen:** ausschließlich über versionierte `private.v_*`-SQL-Views (W4-08). Neue Views legt nur der Writer an.

---

## §2 Module IST (gebaut, geprüft, an diesem SHA)

### Fundament (`src/lib/server/authorization.ts`, `privilegedDb.ts`)
- **besitzt:** Identität, Session, Tenant, Rollen/Permissions-Snapshot.
- **bietet:** `resolveAuthorization() → {ok, data: AuthorizationSnapshot{userId, tenantId, role, permissions}}` mit Failure-Reasons (`NO_SESSION`, `INVALID_SESSION`, `USER_INACTIVE`, `SESSION_REVOKED`, …); `resolveLoginIdentityByEmail`.
- **Regel:** Jeder Command ruft zuerst diesen Resolver; Tenant kommt NUR aus der Serversession. Service-Role bleibt server-only.

### intake (`orderIntakeCommand.ts`, `orderIntakeRead.ts`)
- **besitzt:** Erfassungsvorgang bis zum existierenden Auftrag (Kunde wählen/anlegen, 1–20 Positionen, Terminwunsch).
- **nimmt an:** `createOrderIntake(input) → OrderIntakeCommandResult` (Receipt mit Auftragsnummer `A-YYYY-NNNN`).
- **sendet:** `ORDER_INTAKE_CREATED_V1` (Schema v1).
- **bietet (liest über):** `private.v_order_intake_receipts_v1`, `private.v_order_intake_customers_v1`; Funktionen `searchOrderIntakeCustomers`, `readOrderIntakeReceipt`.
- **Anschluss-Stelle:** Foto-KI liefert später nur *Vorschläge* für `CreateOrderIntakeInput` — bestätigt wird immer durch den Menschen; kein eigener Schreibpfad.

### orders inkl. Station (production-Außensicht) (`orderStationCommand.ts`, `orderStationRead.ts`)
- **besitzt:** Auftrag, Stationswahrheit (`station/current_station`), Version.
- **nimmt an:** `transitionWareneingangToGalvanik({orderId, expectedVersion, clientEventId})`; `correctGalvanikToWareneingang({…, reason})` (Pflicht-Begründung 5–500 Zeichen, nie Löschung).
- **sendet:** `ORDER_STATION_MOVED_V1`, `ORDER_STATION_CORRECTED_V1` (beide DB-vertraglich fixiert).
- **bietet:** `private.v_operational_station_queue_v1` (Stationslisten), `private.v_order_station_receipts_v1`, `private.v_order_station_correction_receipts_v1`; Funktionen `readTenantOperationalOrders(+Count)`, `readTenantStationOrders`, `readTenantOrderStationReceipt(+Correction)`.
- **Anschluss-Stellen (Namen fixiert, Code später):** `fertig`-Freeze (F1.3), `abgeholt` (F1.5), `bezahlt` (accounting, F1.5).

### evidence/attachments (`orderStationAttachment.ts`, `evidenceRead.ts`)
- **besitzt:** `private.order_station_evidence(+_reservations)`, `private.evidence_domain_links`, `private.evidence_extraction_metadata` (privater Storage, Hash, Provenienz).
- **nimmt an:** `reserve→finalize`-Paar je Anhang (Station + Intake), `getOrderStationAttachmentOriginal`.
- **bietet:** `private.v_order_evidence_attachment_receipts_v1`, `private.v_evidence_records_v2`; `readEvidenceRecordsByTarget` (polymorph: `ORDER | ORDER_ITEM | CUSTOMER | INVOICE` — der Link-Typ für Karten und spätere Rechnungen existiert schon).

---

## §3 Module SOLL (Verträge vorgegeben — Bau nach M3-Freigabe)

### search — Querschnitt „Gehirn" (Parallelbau erlaubt)
- **besitzt:** nichts. Kein eigener Speicher, kein Index mit zweiter Wahrheit (Index = ableitbarer Cache, jederzeit aus Ports neu aufbaubar).
- **liest:** ausschließlich §2-Ports (`v_operational_station_queue_v1`, `v_order_intake_customers_v1`, Receipts-Views).
- **bietet (SOLL-Vertrag):** `searchTenant(query) → SearchHit[]` mit `SearchHit = {type: "ORDER"|"CUSTOMER", id, title, subtitle, status, matchField}` — tenant-gefiltert über Fundament-Snapshot. Jedes künftige Modul liefert Suchtreffer, indem es einen v_*-Port bereitstellt; search erfindet nie Felder.
- **Anschluss-Stelle:** KI-Suche später als Adapter ÜBER `searchTenant`, nie daneben.

### Kalender + Tagesüberblick — Ansichten (Parallelbau erlaubt)
- **besitzt:** nichts. Zwei Ansichten über fremde Daten.
- **liest:** Auftragstermine aus orders-Ports (Termin-Feld; falls der Port das Feld noch nicht exponiert → Vertragslücke L1, siehe §5); Betriebstermine später read-only aus Outlook-Adapter (D-ARCH-005: je Datentyp genau ein Besitzer; Drift nie still übernehmen).
- **bietet (SOLL):** `getWeek(tenant, range) → CalendarEntry[]` mit `CalendarEntry = {source: "ORDER"|"EXTERN", id?, date, label, status}`; Tagesüberblick-Blöcke 2a–2d (MUSS RAUS / WARTET AUF DICH / NEU SEIT LETZTEM BLICK / FÄLLIG) als reine Port-Kompositionen; „seit letztem Blick" = `last_seen`-Zeitstempel je Login (Fundament-Erweiterung, Writer).
- **Pilot-Regel:** interne Ansicht ist Pflicht; Outlook additiv, blockiert nie.

### customers + Kundenkarte (F1.3, nur Writer)
- **besitzt:** Kundenakte (Stammdaten, Eigenheiten, Preisabsprachen, Notizen/Telefonnotiz-Texte).
- **bietet (SOLL):** `v_customer_summary_v1` (Karte + orders-Querbezug), Suchdokumente. Karte = Composition; berechnete Kennzahlen bleiben leere Steckplätze (D-ARCH-003).

### accounting (F1.4/F1.5, nur Writer)
- **besitzt:** eingefrorene Positionen (aus `fertig`-Freeze), Rechnung (Nummer, Snapshot, PDF), Zahlung, offener Betrag, Status `bezahlt`.
- **sendet (SOLL):** `ORDER_FROZEN_V1`(Arbeitsname, F1.3-Entscheid), `INVOICE_CREATED_V1`, `PAYMENT_CONFIRMED_V1`, `ORDER_PICKED_UP_V1` — Abnehmer (Mahnung, Bank, DHL, Buchhaltung) docken NUR hier an. Kein Export/DATEV in diesem Modul (D-ARCH-004).

### Adapter (Quarantäne — Vertrag ja, Code erst am jeweiligen Gate)
Foto-KI (Vision → Intake-Vorschläge) · Outlook/Google (Betriebstermine lesen, Auftragstermine spiegeln) · DHL · Mollie/Bank · Mahnung · Buchhaltung+Export · KI-Suche. Alle sprechen ausschließlich die oben genannten Ports/Ereignisse; Credentials nur am Gate.

---

## §4 Regeln für Parallelbauer (bindend)

1. Nur lesen über §2/§3-Ports; nie eigene Geschäftstabellen, nie direkte Tabellenzugriffe, nie neue `v_*`-Views (Views legt der Writer per Missions-Allowlist an).
2. Entwicklung gegen echte (auch leere) lokale Instanz — nie gegen erfundene Daten; keine Mocks im Abnahmepfad.
3. Lieferung = Modulcode + Vertragstests (je Port: leerer Tenant, gefüllter Tenant, fremder Tenant abgewiesen) + Doku; Übergabe an den Writer per PR — nie direkter Push.
4. Tenant-Filter kommt immer aus `resolveAuthorization()`; ein Parallelmodul ohne Session zeigt nichts (fail-closed).
5. Jede benötigte, fehlende Vertragsfläche wird als Lücke gemeldet (Format wie §5), nie selbst improvisiert.

## §5 Bekannte Vertragslücken (liefert der Writer, je im passenden Paket)

| Nr. | Lücke | Paket |
|---|---|---|
| L1 | Termin-/Fälligkeitsfeld in einem v_*-Port exponieren (für Kalender/Tagesüberblick/2d) | F1.3 |
| L2 | `last_seen` je Login (für „seit deinem letzten Blick"/2c) | F1.3 |
| L3 | `fertig`-Freeze-Command + Ereignisname endgültig | F1.3 (mit D-F13) |
| L4 | Suchdokument-Port für Positionen/Notizen der Karten | F1.3 |
| L5 | `abgeholt`/`bezahlt`-Commands + Ereignisse | F1.5 |

---

*V1 · 2026-08-18 · Cowork (Design-Chief/Orchestrator) · Freigabe des Auftraggebers = M3-Gate; Änderungen nur als V2 mit Grund.*

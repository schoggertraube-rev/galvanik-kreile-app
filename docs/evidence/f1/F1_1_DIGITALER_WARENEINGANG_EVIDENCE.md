# F1.1 Digitaler Wareneingang – Audit-Beleg

**Datum:** 2026-08-13
**Basis-SHA:** `d16363dee8e38bf64dbb31ed135a93972d91b6f1`
**Produktkandidat-SHA:** `333368cb2a0b8db06938a0f8d646493feb61537b`
**Branch:** `f1/digital-wareneingang-20260812`
**Worktree:** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_worktrees\f1-digital-wareneingang-20260812`
**Alleiniger Schreiber:** Claude Code
**URL (Production Acceptance Path):** `http://127.0.0.1:3001/warendurchlauf/wareneingang`

---

## 1. Identität und Scope

- **F1.1 Status:** Intern abgeschlossen; unabhängige Prüfung ausstehend
- **F1.2 Status:** Nicht gestartet
- **Nächstes verpflichtendes Gate:** F1-R0_NO_FAKE_PRODUCTION_GATE nach unabhängigem F1.1 PASS
- **Mutationen:** Kein Push, kein Merge, kein Deployment, keine Production-/Remote-DB-Mutation und keine Vercel-Promotion.
- **F0 Worktree:** HEAD `d16363dee8e38bf64dbb31ed135a93972d91b6f1`, Status clean
- **Protected Checkout:** HEAD `8cf9e6ce2f8640dadd1386d9a149137d783aa1a0`, 0 veränderte Tracking-Dateien; aktuell 13 ungetrackte Einträge. Eine konstante Untracked-Anzahl wird nicht behauptet, weil der Nutzer außerhalb der F1-Mission ungetrackte Daten verlagert hat.
- **Separate Docker-Stacks:** `evas_lerninsel_praxiscockpit` mit Workdir `C:\Antygravityprojekte\04_Kundenprojekte\evas_lerninsel\02_app` wurde durch diesen F1-Pfad nicht mutiert.

---

## 2. Produktkette

Die Akzeptanzpfad-Produktkette umfasst die folgenden **echten** (nicht gemockten) Komponenten:

1. **Lokales Supabase-Reset** mit allen 14 Migrationen
2. **Echte lokale Auth/Admin-Mandantenidentität**
3. **Server-seitige `createOrderIntakeAction` / `createOrderIntakeCommand`** → atomare Kunden-, Auftrags-, Positions-, Ereignis- und unveränderliche Receipt-Erstellung
4. **Exakte Belegansicht/Lesevorgänge** (Readback) ohne Mocks
5. **Arbeitsliste-Readback**
6. **Echter signierter Storage-Upload/Finalisierung**
7. **Seiten-Reload/Readback**
8. **Sichtbarer Browserzustand**

**Keine Mocks in diesem Produktions- oder Browser-Akzeptanzpfad.**

---

## 3. Echter Reset und Authentifizierung

### Lokaler Supabase-Reset

- **Exit-Code:** 0
- **Angewandte Migrationen:** Alle 14, einschließlich `20260812133649_f1_order_intake_contract.sql`

### Echte lokale Auth-Identitäten

| Rolle | E-Mail | Actor ID | Mandant | Berechtigung |
|-------|--------|----------|---------|--------------|
| admin | `f1-final-admin-20260813@test.local` | `1d86c9f5-4050-43a0-9455-03f7ecd7aa65` | `galvanik-kreile` | admin |
| readonly | `f1-final-readonly-20260813@test.local` | `c20ea2da-567f-4a11-ad7a-6cad35003514` | `galvanik-kreile` | readonly |
| foreign | `f1-final-foreign-20260813@test.local` | `f17ad954-aa0b-4af5-bb93-aa9df6200c28` | *fremd* | admin |

**Hinweis:** Passwörter, Schlüssel, Token und Geheimnisse sind nicht enthalten.

---

## 4. Ungebrochener Happy Path: NUR A-2026-0001

### Auftragsdaten

- **Auftragsnummer:** A-2026-0001
- **Kunde:** F1 Finaler Realpfad / Kreile F1 Final GmbH (neu)
- **Fälligkeitsdatum:** 2026-08-28
- **Interner Hinweis:** `F1.1 finaler ungeteilter Realpfad`

### Artikel (exakt wie erfasst)

| Position | Positions-ID | Menge | Teil | Beschreibung |
|----------|-----------|-------|---------|-------------|
| 1 | `c65e90e3-adfa-4dd7-9fcf-39229d5ca3c0` | 2 | Chromfelge vorne | Stahl, Hochglanzverchromen |
| 2 | `7d1dbef0-c3d9-44f0-b780-18352a927f2c` | 1 | Chromfelge hinten | Aluminium, Glanzvernickeln |

### Browser-Fortschrittstexte (im selben Fluss beobachtet)

```
Wareneingang wird atomar gespeichert.
Gespeicherter Beleg und Arbeitsliste werden frisch bestätigt.
```

### Sichtbare Bestätigung nach Speicherung

```
A-2026-0001 bestätigt
```

### Fotoupload und Bestätigung

Die **gleiche Browser/Auth-Kette** hat die echte Datei
`C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\10_dateien\portfolio-3.jpg`
hochgeladen. Sichtbare Bestätigung:

```
Original bestätigt – portfolio-3.jpg
```

### Reload-Event und Stabilität

Das unmittelbare `page.reload()`-Ereignis nach erfolgreicher Speicherung und Upload traf auf eine Next.js Dev-ChunkLoad-Instabilität. Der F1-Dev-Server wurde nur einmal neu gestartet; daraufhin hat die gleiche Browser/Auth-Kette die gleiche Seite neu geladen und A-2026-0001 erschien **genau einmal** mit beiden Artikeln.

**Dieses Dev-Laufzeit-Ereignis wird nicht verborgen und nicht als zweiter Auftrag dargestellt.**

---

## 5. Write-/Readback-Receipt für A-2026-0001

### Schreib-Beleg

| Feld | Wert |
|------|-----|
| receipt_id | `d6a5964b-eb34-4120-876e-111cd72caae7` |
| event_id | `e5b5b180-dd37-48cf-82b9-9f284d8d84b8` |
| tenant_id | `galvanik-kreile` |
| order_id | `5e406b25-d86f-4063-a1e1-04c8ef33d016` |
| customer_id | `ddfebc9f-69ba-4cb1-8111-7dad9aa33ff7` |
| actor_id | `1d86c9f5-4050-43a0-9455-03f7ecd7aa65` |
| client_event_id | `25cb27e3-df10-4386-9a6c-cfd592d37077` |
| correlation_id | `7af90f4b-c226-42f4-822f-2f952c6eb09e` |
| customer_mode | NEW |
| current_order_version | 1 |
| current_station | wareneingang |
| current_status | in_progress |
| integrity_ok | true |
| item_count | 2 |

### Readback-Verifizierung (Finale read-only DB-Neuabfrage)

- **orders_for_number:** 1
- **intake_events_for_order:** 1
- **receipts_for_order:** 1

---

## 6. Fotobeleg für denselben Auftrag und dieselbe Position

### Upload- und Speicher-Metadaten

| Feld | Wert |
|------|-----|
| reservation_id | `98689cab-a2f8-459e-bccb-684d9dbd2a80` |
| receipt_id | `3a9658d3-fa50-45c3-825d-d1bce4c9147f` |
| item_id | `c65e90e3-adfa-4dd7-9fcf-39229d5ca3c0` |
| order_version | 1 |
| client_request_id | `fad496f2-a898-4481-9959-dc81f3aa05f7` |
| purpose | ORDER_INTAKE_ORIGINAL_V1 |
| station | wareneingang |
| mime | image/jpeg |
| bytes | 240432 |
| storage_object_id | `dbce4256-1fff-40c9-842a-7c6f99305591` |
| storage_object_version | `2da7bea0-ace6-4d65-b54a-0f47aa624ca9` |
| storage_path | `order-intake-evidence/v1/98689cab-a2f8-459e-bccb-684d9dbd2a80.jpg` |
| receipt_state | FINALIZED |
| integrity_ok | true |
| extraction_state | NOT_REQUESTED |

### Hash-Verifizierung (SHA256)

```
SHA256: 252b20b245fc5fcc96f26424c8dece6682ef91f4f05cd74418fd613a817671e0
```

**Verifizierung:** Quell-Datei-Bytes = heruntergeladene Storage-Bytes = DB-Beleg-Bytes = 240432; alle drei SHA256-Werte stimmen **genau überein**.

---

## 7. Browser-Artefakte

| Pfad | Zweck | SHA256 |
|------|-------|--------|
| `docs/evidence/f1/artifacts/f1-1/f1-1-final-empty-state.png` | Leerzustand | `D42C6FF72CCC20B1356AEA4694D7A7A895514323A8485DC86AB57479D076D1E7` |
| `docs/evidence/f1/artifacts/f1-1/f1-1-final-readonly-denial.png` | Echte Readonly-Ablehnung | `955FEC7A4058F9A6D88073BE02537C4603671D1DA03FF60704EAC12BAD540158` |
| `docs/evidence/f1/artifacts/f1-1/f1-1-final-foreign-tenant-denial.png` | Echte Fremd-Mandanten-Ablehnung | `03D405768650E9B082B0EC1C564EF6A70A10E14782770C6D9097E631F63BD35B` |
| `docs/evidence/f1/artifacts/f1-1/f1-1-final-success-with-photo.png` | Erfolg + finalisiertes Foto | `44694AA4BB714FAC1FE9B3CB56C112D20AF3D5A192956F5308EBD84ACD179428` |
| `docs/evidence/f1/artifacts/f1-1/f1-1-final-readback-order-visible.png` | Reload/Readback, gleicher Auftrag genau einmal, beide Artikel | `69C212B2026D7B71471D4759F1769CD8973ACA73288CD0E9B5470831BE28C09A` |

---

## 8. Negativbelege (Ablehnung und Konflikte)

### Echte Readonly-Auth-Ablehnung

**Sichtbare Fehlermeldung:**
```
Dieser Login ist Administratoren vorbehalten. Bitte nutzen Sie den PIN-Login.
```

**Mutation:** Keine
**Readback:** Keine neuen Reihen

### Echte Fremd-Mandanten-Auth-Ablehnung

**Sichtbare Fehlermeldung:**
```
AUTH_ERROR: Benutzer nicht gefunden
```

**Mutation:** Keine
**Readback:** Keine neuen Reihen

### Echte Integrations-Suite für Konfliktbeweise

Die echte lokale Integrations-Suite beweist separat:

1. **Verlorene Antwort-Wiederholung (Lost-Response Replay):** Gleiche `clientEventId`, wiederholte Anfrage
   - **Ergebnis:** Genau ein Kundensatz, ein Auftrag, ein Ereignis, ein Beleg und zwei Artikel
   - **Keine Duplikate oder Versionen**

2. **Konflikt durch geändertes Material:** Gleiche `clientEventId`, aber unterschiedliches Material
   - **Ergebnis:** `CONFLICT` zurückgegeben, keine neuen Reihen hinzugefügt

3. **Zugriffskontrolle:** Readonly und Fremd-Mandanten
   - **Ergebnis:** Keine Mutation in der DB

### Fokussierte Aktions- und RTL-Tests

Fokussierte Aktions- und React Testing Library (RTL)-Tests beweisen die folgenden UI-Zustände mit echtem Backend-Konflikt separat nachgewiesen:

- **Loading** (Lädt)
- **Error** (Fehler)
- **Denial** (Ablehnung)
- **Conflict** (Konflikt)
- **Fail-Closed Exact-Readback**

*Diese Tests verwenden Mocks, sind aber ausdrücklich supplementär und nicht Teil des echten Akzeptanzpfads.*

### Bestehende W4-Attachment-Tests

Bestehende W4-Attachment-Tests decken falsches Versionskonflikt/Fail-Closed-Verhalten ab. Dies bedeutet **nicht**, dass dies ein zweiter Happy-Path-Beleg ist.

---

## 9. Serielle Gate-Belege

### Integrations-Test – Real Supabase

```
npm.cmd test -- src/test/f1_order_intake.integration.test.ts
```

**Ergebnis:** PASS
**Umfang:** 1 Datei, 7/7 Tests
**Dauer:** 9,28s
**Gegen:** Echte lokale Supabase
**Hinweis:** Der Integrations-Test mockt nur `appSession` als supplementärer Test-Harness; echte Auth wird durch den Browser-Pfad nachgewiesen, daher ist dies kein Akzeptanzpfad-Mock.

### Fokussierte F1/W3/W4-Regressions-Charge

```
Fokussierte F1/W3/W4-Regressions-Test-Batch
```

**Ergebnis:** PASS
**Umfang:** 12/12 Dateien, 136/136 Tests
**Dauer:** 35,36s

### Finale geänderte Test-Regression

```
Finale Regressions-Charge mit geändertem Test
```

**Ergebnis:** PASS
**Umfang:** 2/2 Dateien, 62/62 Tests
**Dauer:** 31,96s

### ESLint – Fokussiert auf alle 21 geänderten TypeScript/TSX-Pfade

```
ESLint mit --max-warnings 0
```

**Ergebnis:** PASS
**Exit-Code:** 0
**Dauer:** 11,4s

### TypeScript-Compiler – Typ-Check

```
npx.cmd tsc --noEmit --pretty false
```

**Ergebnis:** PASS
**Exit-Code:** 0
**Dauer:** 17,9s

### Next.js Build – NODE_OPTIONS=--max-old-space-size=2048

```
npm.cmd run build -- --webpack
```

**Ergebnis:** FAIL
**Fehlschlag-Grund:** Nach 166,5s konnte Next.js 16.2.12 Inter-WOFF2-Dateien von `fonts.gstatic.com` nicht abrufen, und `next/font` ist dann in `src/app/layout.tsx` fehlgeschlagen.
**Ursache:** Externer Font-Abruf-Blocker außerhalb des F1.1-Deltas
**Hinweis:** Keine Build-PASS kann beansprucht werden. Keine Reparatur-Schleife wurde eröffnet.

### TypeScript-Reparatur-Schleifen

- **Erste TypeScript-Reparatur-Schleife:** Auf dem fokussierten Test-Typing-Gate durchgeführt
- **Zweite TypeScript-Reparatur-Schleife:** Auf dem fokussierten Test-Typing-Gate durchgeführt
- **Finale Ergebnisse:** `tsc/lint/tests` sind grün
- **Dritte Reparatur-Schleife:** Keine

---

## 10. Mock/Fake-Grenze

### Produktion Akzeptanzpfad

- **Fokussierter Scan:** Die 12 geänderten Produktions-TypeScript/TSX-Pfade wurden durchsucht.
- **Ergebnis:** Keine ausführbaren Mocks, Fixtures, Stubs, Fakes, Simulationen, `Math.random`-Nutzung oder hartcodierten Testergebnisse gefunden.
- **Hinweis:** Ein nicht-ausführbarer historischer Kommentar `Demo-Badge removed` bleibt erhalten und ist keine Fähigkeit

### Produktion-Pfad-Mocks

**Keine**

### Akzeptanzpfad-Mocks

**Keine**

### Unit/RTL/Session-Test-Harness-Mocks

- **Status:** TEST_ONLY
- **Kennzeichnung:** Ausdrücklich supplementär
- **Beispiel:** `appSession`-Test-Harness im Integrations-Test

### App-weite Mocks und Fähigkeiten (Ausstehend)

- **REACHABLE_PRODUCTION_MOCKS:** Nicht beansprucht, weil die verpflichtende F1-R0-App-weite Register/Gate nur nach unabhängigem F1.1 PASS beginnt
- **UNREGISTERED_VISIBLE_CAPABILITIES:** Nicht beansprucht, weil die verpflichtende F1-R0-App-weite Register/Gate nur nach unabhängigem F1.1 PASS beginnt

### Aktive F1.1-Fähigkeit – Echte E2E

- **Internal Real E2E:** PASS
- **Unabhängige Überprüfung:** NOT_RUN

---

## 11. Geänderte Pfad-Inventar

Genau **24 Produktkandidat-Pfade** aus Commit `333368cb2a0b8db06938a0f8d646493feb61537b`:

1. `missions/F1_ORDER_TO_CASH_PILOT_001.yml`
2. `src/app/status/page.tsx`
3. `src/app/warendurchlauf/__tests__/f1OrderIntakeActions.test.ts`
4. `src/app/warendurchlauf/__tests__/f1OrderIntakePage.test.tsx`
5. `src/app/warendurchlauf/actions.ts`
6. `src/app/warendurchlauf/wareneingang/page.tsx`
7. `src/components/erfassung/ErfassungModal.tsx`
8. `src/components/erfassung/ManualFlow/ManualWizard.tsx`
9. `src/components/erfassung/OrderIntakePanel.tsx`
10. `src/components/erfassung/__tests__/ErfassungModal.test.tsx`
11. `src/components/erfassung/__tests__/OrderIntakePanel.test.tsx`
12. `src/lib/server/__tests__/evidenceRead.test.ts`
13. `src/lib/server/__tests__/orderIntakeRead.test.ts`
14. `src/lib/server/__tests__/orderStationAttachment.test.ts`
15. `src/lib/server/__tests__/w2cB2m5u.operationalDueTruth.failClosed.test.ts`
16. `src/lib/server/commands/__tests__/orderIntakeCommand.test.ts`
17. `src/lib/server/commands/orderIntakeCommand.ts`
18. `src/lib/server/evidenceRead.ts`
19. `src/lib/server/orderIntakeRead.ts`
20. `src/lib/server/orderStationAttachment.ts`
21. `src/lib/server/orderStationAttachmentStorage.ts`
22. `src/lib/server/orderStationRead.ts`
23. `src/test/f1_order_intake.integration.test.ts`
24. `supabase/migrations/20260812133649_f1_order_intake_contract.sql`

---

## 12. Obligatorischer Maschinenlesbarer Block

```
REAL_E2E_PATH=A-2026-0001; fresh local Supabase reset -> real Auth admin -> real server command -> atomic DB mutation -> immutable write receipt -> exact fresh receipt/worklist readback -> real signed Storage upload/finalization -> server restart after dev ChunkLoad -> browser reload -> same order visible exactly once with both items; PASS
SUPABASE_RESET_AND_MIGRATIONS=PASS
PRODUCTION_PATH_MOCKS=NONE
ACCEPTANCE_PATH_MOCKS=NONE
WRITE_RECEIPT=d6a5964b-eb34-4120-876e-111cd72caae7, Version 1, Correlation-ID 7af90f4b-c226-42f4-822f-2f952c6eb09e
READBACK_RECEIPT=d6a5964b-eb34-4120-876e-111cd72caae7, Version 1, Quelle private.v_order_intake_receipts_v1 + private.v_operational_station_queue_v1 after reload
BROWSER_PROOF=http://127.0.0.1:3001/warendurchlauf/wareneingang; Loading, Empty, Denial, Data, finalized photo, reload readback; Error and Conflict rendered by focused RTL with real backend conflict separately proven
NEGATIVE_PROOF=Tenant foreign denied/no mutation; Rolle readonly denied/no mutation; Version wrong-version fail-closed in W4 attachment regression; Konflikt same clientEventId plus changed material -> CONFLICT/no new rows
COMMIT_SHA=333368cb2a0b8db06938a0f8d646493feb61537b
INDEPENDENT_REVIEW=NOT_RUN
F1_1_REACHABLE_PRODUCTION_MOCKS=0
APP_WIDE_REACHABLE_PRODUCTION_MOCKS=OPEN_PENDING_F1_R0
UNREGISTERED_VISIBLE_CAPABILITIES=OPEN_PENDING_F1_R0
ACTIVE_CAPABILITY_REAL_E2E=PASS
F1_2_STARTED=NO
```

---

**Ende des Belegs**
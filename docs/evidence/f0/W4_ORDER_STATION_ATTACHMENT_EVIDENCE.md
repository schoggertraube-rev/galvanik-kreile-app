# W4 Order-Station Attachment Evidence

```yaml
BASE: bdba090ecac3b0f1e15f1146c6aeeaac5388bc26
SCOPE: W4-01,W4-05,W4-06,W4-07,W4-10; private Galvanik-handoff original attachment core
SOURCE_STATUS: PASS_LOCAL
RUNTIME_STATUS: PASS_LOCAL
MIGRATIONS: 20260811184850_w4_order_station_attachment.sql,20260812103446_w4_evidence_read_contract.sql
MIGRATION_CREATED_WITH: Supabase CLI 2.111.0
MIGRATION_EXECUTED: LOCAL_REPLAY_ONLY
LOCAL_DB_RESET: PASS; Supabase CLI 2.111.0; exactly 13 migrations through 20260812103446
LOCAL_INTEGRATION_AT: 2026-08-12 00:01:15 Europe/Berlin
LOCAL_STORAGE_HTTP_INTEGRATION: PASS; 1 file; 14 tests; duration 25.82 s
FOCUSED_UNIT_UI: PASS; 4 files; 103 tests
TYPECHECK: PASS; tsc --noEmit --incremental false
EXACT_ESLINT: PASS; 11 exact TS/TSX paths; zero warnings
SUPABASE_CLIENT_BOUNDARY: PASS; 699 src files scanned
DIFF_CHECK: PASS
INDEPENDENT_REVIEW: REVIEW_PASS; F0 and Redteam freeze a55e8d63 before evidence-only update
SCHEMA_SEMANTIC_MANIFEST: PASS_LOCAL; 312 exact ADD objects
CI_SCHEMA_GATE: WIRED_NOT_RUN
BUILD: PASS_LOCAL
FULL_UNIT_SUITE: PASS; 87 files; 551 tests
REMOTE_PRODUCTION: NOT_RUN
RLS_POLICY_DEFAULT_ACL: NOT_CHANGED
GRANT_REVOKE: NOT_CHANGED
BUCKET_CONFIGURATION: NOT_CHANGED
W4_LOCAL: PASS_LOCAL
REVIEW_HANDOFF: F0_W4_REVIEW_READY
OVERALL_F0: BLOCKED_EXTERNAL_PERMISSION
```

## Liefervertrag

W4-03 stellt genau einen privaten Original-Anhang für die kanonische
Galvanik-Übergabe bereit. Die Ende-zu-Ende-Kette lautet:

`ORDER_STATION_MOVED_V1`-Receipt → unveränderliche Reservation → einmaliger
serverseitiger Signed-Upload-Grant → privates Storage-Objekt → zweiphasige
Verifikation → unveränderliche Evidence →
`private.v_order_station_evidence_receipts_v2` und
`private.v_evidence_records_v1` → Action →
`GalvanikHandoffAttachmentPanel` → Loading/Empty/Error/Pending/Upload/
Finalize/frischer Readback/Original-Link.

Die UI zeigt Erfolg erst, wenn das Finalize-Ergebnis und ein davon getrennter,
frischer Metadata-Read in allen client-sicheren Bindungsfeldern exakt
übereinstimmen. `readonly` und `buero` dürfen tenantgebundene Metadaten mit
`perm_view_leitstand` lesen. Reserve, Finalize und Original benötigen
`perm_op_photos`; `perm_op_status` ist dafür ausdrücklich kein Ersatz.

## Persistenter Vertrag

- `private.order_station_evidence_reservations` bindet Tenant, Actor,
  Client-Request-ID, Auftrag, Kunde, Item, W4-Transition-Event,
  Auftragsversion, MIME, Bytezahl, SHA-256, festen Purpose/Station/Bucket,
  servergenerierten Objektpfad sowie Uploadfrist unveränderlich.
- `private.order_station_evidence` finalisiert jede Reservation höchstens
  einmal und bindet dieselben Owner-/Intent-Felder an eine stabile
  Storage-Objekt-ID, Version, Erstellungszeit und Verifikationszeit.
- `private.evidence_extraction_metadata` hält den ehrlichen Extraktionszustand;
  der Stationspfad schreibt `NOT_REQUESTED`. `private.evidence_domain_links`
  bindet dieselbe Evidence in der Finalize-Transaktion an `ORDER` und
  `ORDER_ITEM`. Beide Tabellen sind append-only.
- Globale Eindeutigkeit gilt für Bucket/Pfad und Storage-Objekt-ID. Alle
  Owner-FKs verwenden `ON DELETE RESTRICT`; UPDATE, DELETE und TRUNCATE beider
  Tabellen werden durch sechs Trigger blockiert.
- Die private `security_invoker`-View beginnt beim tenantgefilterten
  Reservation-Rowset und verwendet LEFT JOINs. Beschädigte Bindungen bleiben
  sichtbar als `receipt_state = INVALID` und `integrity_ok = false`; sie werden
  nicht als leere Ergebnismenge verschluckt.
- PENDING-Metadaten enthalten Reservation-, Client-Request- und Intentdaten
  einschließlich Uploadfrist, aber keinen Uploadtoken und kein URL-Feld.
  Bucket und Pfad sind kein Geheimnis: Aus Reservation-ID, MIME und den festen
  Clientkonstanten sind sie ableitbar. Der Schutz beruht auf dem privaten
  Bucket ohne anon/authenticated Policies, dem fehlenden Metadata-Token sowie
  serverseitiger Capability-, Tenant- und Graphprüfung.

## Command-, Storage- und Retry-Vertrag

- Jede Action löst Session, Tenant und Capability auf, bevor das fachliche
  Servermodul dynamisch importiert wird. Clientseitige Tenant-, Actor-,
  Customer-, Event-, Bucket-, Pfad- oder Dateinamen-Autorität existiert nicht.
- Der Service-Role-Client befindet sich ausschließlich im Storage-Adapter und
  wird erst nach persistenter Ownership- und Pfadprüfung erzeugt. Fehler werden
  sanitisiert als `NOT_READY`, `MISMATCH`, `INVALID` oder `UNAVAILABLE`; Provider-
  Details, Pfad, Token und Schlüssel werden nicht geloggt.
- Reserve schreibt die PENDING-Reservation vor dem Grant. Ein exakter Replay
  darf vor der DB-Frist einen neuen `upsert=false`-Token für dieselbe
  Reservation und denselben Pfad ausstellen; er erzeugt keine zweite Zeile.
  Abweichender Intent ist `CONFLICT`, ein bereits finalisierter exakter Replay
  liefert denselben FINALIZED-Receipt ohne Uploadtoken.
- Finalize prüft zunächst idempotente bestehende Evidence. Für neue Evidence
  folgt `info → download → info`, exakter MIME-/Byte-/Magic-/SHA-Abgleich und
  anschließend ein frischer DB-Lock in der Reihenfolge Auftrag `FOR UPDATE`,
  tenantgebundener Kunde `FOR SHARE`, alle Auftragsitems `FOR SHARE`. Erst
  danach wird Evidence in derselben Transaktion geschrieben.
- Finalize nach Ablauf ist nur für ein stabiles Objekt erlaubt, dessen
  `storage_created_at` zwischen Reservation-Erstellung und DB-Uploadfrist liegt.
  Ein später erzeugtes Objekt wird nie adoptiert oder finalisiert.
- PENDING-Recovery ist actor-gebunden. Bei mehreren passenden eigenen
  Reservationen dient `reservedAt` plus UUID ausschließlich als deterministische
  Retry-Routingregel; alle älteren Originals bleiben sichtbar und manuell
  prüfbar. Pro Operation wird höchstens ein Token angefordert.
- Ein Original darf innerhalb desselben Tenants teamweit von einer aktuellen
  Session mit `perm_op_photos` gelesen werden; Actor ist Provenienz, keine
  Download-Ownership. Finalize bleibt actor-owned. Der kurzlebige Downloadlink
  wird clientseitig vollständig an Receipt, MIME, Pfad, Token und 60 Sekunden
  gebunden und bei Scope-/Capability-Wechsel entfernt.

## Ausgeführte lokale Abnahme

Die abschließende Abnahme lief lokal mit der gepinnten Supabase CLI `2.111.0`
nach einem frischen Reset über exakt dreizehn Migrationen. Der erweiterte
Hybridlauf bestand 14/14 Tests in rund 26 Sekunden.

| Gate | Erwarteter realer Nachweis | Status |
|---|---|---|
| Migration/Ledger | frischer lokaler Reset, exakt 13 geordnete Migrationen bis `20260812103446` | PASS |
| Katalog | baseline9→candidate13 exakt 312 ADD, 0 CHANGE/REMOVE; vollständige Spalten-/Constraint-/Index-/Trigger-/View-/Owner-Grant-Payloads | PASS |
| DB vor Storage | PENDING-Reservation ist beim echten Grant-HTTP-Aufruf bereits committed; Grantfehler lässt genau diese PENDING-Zeile und keine Evidence zurück | PASS |
| Signed Upload P0 | zwei Replays: gleiche Reservation/Pfad, verschiedene Tokens, eine DB-Zeile; derselbe echte Token kann auch mit Client-`upsert:true` das erste Objekt nicht überschreiben | PASS |
| Pfadbindung | frischer Token auf substituiertem Pfad liefert 4xx und erzeugt kein Objekt | PASS |
| Stabiles Objekt | Info vor/nach Angriff identisch; erneuter Download bestätigt Original-SHA und PNG-Magic | PASS |
| Finalize | echtes `info/download/info`, frischer Locked-Recheck, genau eine Evidence; zwei überlappende Finalize-Aufrufe liefern Write plus Replay | PASS |
| Frist | abgelaufener Replay erzeugt keinen Grant; rechtzeitig hochgeladenes Objekt darf nach Frist finalisiert werden; spätes Objekt bleibt PENDING/Evidence 0 | PASS |
| Mismatch | MIME, Bytes, Magic, SHA und Objekt-vor-Reservation bleiben jeweils PENDING mit Evidence 0 | PASS |
| View-Fehlerwahrheit | korrupter LEFT-JOIN-Graph bleibt `INVALID/integrity_ok=false`; Domain/Action liefern `UNAVAILABLE` | PASS |
| Rollen/Tenant | readonly, buero, Status-only, fremder Actor und fremder Tenant belegen getrennte Read-/Reserve-/Finalize-/Original-Grenzen mit null Storage-/DB-Sideeffects | PASS |
| Storage HTTP/private Bucket | unsigned Upload und Download liefern 4xx; anon List zeigt kein Objekt; keine direkte Client-Policy wurde hinzugefügt | PASS |
| Private Relation ACL/default ACL | keine wirksamen oder Default-ACL-Grants für PUBLIC/anon/authenticated/service_role auf den neuen privaten Relationen | PASS |
| Immutabilität | UPDATE/DELETE/TRUNCATE auf beiden Tabellen: sechs `P0001`, Vor-/Nachsnapshot bytegleich | PASS |
| Evidence-Metadaten/Links/Legacy | `NOT_REQUESTED`-Metadaten, zwei polymorphe Links und realer Legacy-Scan mit Confidence/Originaldaten; Legacy-Snapshot unverändert | PASS |
| E2E | echte DB → private Views → echte Actions → echtes Panel → lokales Storage; PNG-Upload, FINALIZED-Readback, Remount allein aus Action/View, Originalbytes/hash | PASS |
| Quellqualität | fokussierte Unit-/RTL-Suite: 4 Dateien/103 Tests; vollständige Units 87/551; TypeScript; vollständiges ESLint; Read-Port-Checker 613 Dateien/3 Ports; Produktionsbuild | PASS |

Der Hybridtest mockt ausschließlich `readAppSession`. Actions, Domain,
PostgreSQL, private View, Storage-Adapter, Supabase-Clients und HTTP bleiben echt.
Die UI lädt genau die Bytes hoch, die zuvor gehasht wurden; es gibt keinen
Admin-Upload im Happy Path und keine erfolgreiche Cleanup-/Delete-Aktion im
Test. Absichtlich abgewiesene DELETE-/TRUNCATE-Versuche sind Teil des
Immutabilitätsnachweises.

Der Workflow bindet den Production-Cutoff separat an den unveränderten harten
Fingerprint, prüft danach den vollständigen 13er-Kandidaten gegen den
committeten 312-Objekt-Vertrag, führt den exakten 11er-W3-Test und den echten
13er-W4-Hybrid aus und verlangt anschließend einen zweiten byteidentischen
13er-Replay. GitHub CI selbst wurde noch nicht ausgeführt.

## Reparaturschleifen

1. Der erste fokussierte Lauf zeigte 33 kaskadierende RTL-Falschfehler, weil
   `vi.clearAllMocks()` ungenutzte `mockResolvedValueOnce`-Queues zwischen
   Tabellenfällen erhielt. Der Test-Harness setzt Mocks nun vollständig zurück.
   Zwei verbleibende Fälle deckten einen echten Scopefehler auf: Ein reiner
   Versions- oder semantischer Itemwechsel invalidierte zwar den laufenden
   Workflow, startete aber keinen frischen Metadata-Read. Der Scope-Read ist
   jetzt an den vollständigen semantischen Schlüssel gebunden. Eine globale
   Action-Source-Assertion wurde auf die drei einzelnen Action-Funktionskörper
   begrenzt; die behavioral Cold-Import-Matrix blieb unverändert.
2. TypeScript verlangte explizite Reserve-/Finalize-Transaktionsunionen. Der
   React-Compiler-Gate beanstandete anschließend den synchronen State-Reset im
   Layout-Effekt und manuelle Memoisierung. Das Panel verwendet nun eine
   semantisch gekeyte innere Instanz: Prop-Scopewechsel remounten atomar,
   gleichwertig geklonte Items bleiben stabil, und der Layout-Effekt enthält
   nur noch die ref-basierte Unmount-Invalidierung. Danach bestanden 99/99
   fokussierte Tests, TypeScript, Exact-Path-ESLint und Client-Boundary-Checker.

## Residualrisiken

1. Supabase Signed-Upload-Tokens leben ab Minting fest zwei Stunden. Ein kurz
   vor der unveränderlichen DB-Frist erneut ausgestellter Token kann diese Frist
   überragen. Ein damit verspätet erzeugtes Objekt bleibt privat und wird wegen
   `storage_created_at > upload_expires_at` niemals Evidence oder Receipt;
   möglich bleibt ein nicht adoptiertes Storage-Orphan. W4-03 löscht es nicht.
2. Wechselt die Session zwischen Client-Hash und Reserve von Actor A zu B, kann
   eine autorisierte, aber ungenutzte B-PENDING-Reservation mit Token entstehen.
   Die UI akzeptiert den Actor-Mismatch nicht, startet weder Upload noch Finalize
   und lädt die B-Wahrheit neu. Client-Actor-Daten werden nicht zur Autorität.
3. Ein nach DB-Commit verlorener Grant-/Netzwerk-Response kann PENDING
   hinterlassen. Innerhalb der DB-Frist stellt ausschließlich ein exakt
   gebundener Replay für dieselbe Reservation einen neuen Token aus; nach der
   Frist bleibt der Datensatz sichtbar und wird nicht automatisch rotiert.

## W4-Berichtsstatus

| Status | Kernpfad | Grenze |
|---|---|---|
| wieder aktiv / W4 lokal belegt | kanonische aktive Galvanik-Ready-Karte: tenantgebundene Metadaten, Original reservieren/hochladen/finalisieren/frisch bestätigen, Extraction/Links lesen und teamweit sicher lesen | frischer 13er-Replay, Hybrid 14/14, 312-Objekt-Vertrag, Read-Port- und Source-Gates PASS |
| kontrolliert read-only reaktiviert | vorhandene gesicherte Legacy-Evidence mit Original-/Extraktions-/Confidence-Metadaten | ausschließlich versionierte private View; Vor-/Nachsnapshot bytegleich; kein Legacy-Upload/Provider |
| weiterhin bewusst quarantänisiert | Legacy-Foto-/OCR-Schreibpfade, andere Stationen/Einstiege, direkte Client-Storage-Policies, automatische Adoption, Überschreiben und Löschen | Wiederfreigabe benötigt jeweils einen eigenen sicheren W3-/W4-Vertrag |
| externer Blocker | Production-Fingerprint-Referenz, Remote-/Production-Migration, Production-ACL/RLS-Parität, Draft-PR und Vercel Preview | separater freigegebener Fingerprint-/Delivery-Atom nach lokalem PASS |

## Exakter Scope des ursprünglichen Attachment-Atoms

1. `supabase/migrations/20260811184850_w4_order_station_attachment.sql`
2. `src/lib/server/orderStationAttachment.ts`
3. `src/lib/server/orderStationAttachmentStorage.ts`
4. `src/app/warendurchlauf/actions.ts`
5. `src/components/orders/GalvanikHandoffAttachmentPanel.tsx`
6. `src/app/warendurchlauf/galvanik/page.tsx`
7. `src/lib/server/__tests__/orderStationAttachment.test.ts`
8. `src/app/warendurchlauf/__tests__/w4OrderStationAttachmentActions.test.ts`
9. `src/app/warendurchlauf/galvanik/__tests__/w4OrderStationAttachmentPanel.test.tsx`
10. `src/test/w4_order_station_attachment.integration.test.ts`
11. `.github/workflows/quality.yml`
12. `docs/evidence/f0/W4_ORDER_STATION_ATTACHMENT_EVIDENCE.md`
13. `src/app/warendurchlauf/galvanik/__tests__/orderStationReadback.test.tsx`
14. `src/components/orders/__tests__/w2cB2m5u.unknownCards.realRender.test.tsx`

Die zwei bestehenden Testpfade 13 und 14 ändern ausschließlich den Leaf-Mock
für `GalvanikHandoffAttachmentPanel`, damit ältere W3/W2C-Seitentests ihren
eigenen Vertrag isoliert prüfen. Es gab keine Remote-, Production-, RLS-,
Policy-, Grant-, Default-ACL-, Bucket-, Deployment-, Merge- oder erfolgreiche Löschaktion.

Der additive Abschluss für W4-02/03/04/08/09 ist mit vollständigem Dateiscope
und Receipts separat in `W4_EVIDENCE_READ_CONTRACT_EVIDENCE.md` dokumentiert.

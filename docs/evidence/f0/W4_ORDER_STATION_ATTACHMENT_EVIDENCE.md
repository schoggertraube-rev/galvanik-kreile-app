# W4 Order-Station Attachment Evidence

```yaml
BASE: bdba090ecac3b0f1e15f1146c6aeeaac5388bc26
SCOPE: W4-03; private Galvanik-handoff original attachment only
SOURCE_STATUS: PASS_LOCAL
RUNTIME_STATUS: PASS_LOCAL
MIGRATION: 20260811184850_w4_order_station_attachment.sql
MIGRATION_CREATED_WITH: Supabase CLI 2.111.0
MIGRATION_EXECUTED: LOCAL_REPLAY_ONLY
LOCAL_DB_RESET: PASS; Supabase CLI 2.111.0; exactly 12 migrations through 20260811184850
LOCAL_INTEGRATION_AT: 2026-08-12 00:01:15 Europe/Berlin
LOCAL_STORAGE_HTTP_INTEGRATION: PASS; 1 file; 12 tests; duration 26.02 s
FOCUSED_UNIT_UI: PASS; 5 files; 99 tests
TYPECHECK: PASS; tsc --noEmit --incremental false
EXACT_ESLINT: PASS; 11 exact TS/TSX paths; zero warnings
SUPABASE_CLIENT_BOUNDARY: PASS; 699 src files scanned
DIFF_CHECK: PASS
INDEPENDENT_REVIEW: REVIEW_PASS; F0 and Redteam freeze a55e8d63 before evidence-only update
SCHEMA_SEMANTIC_MANIFEST: PENDING_NEXT_ATOM
CI_SCHEMA_GATE: PENDING_NEXT_ATOM
BUILD: NOT_RUN
FULL_UNIT_SUITE: NOT_RUN
REMOTE_PRODUCTION: NOT_RUN
RLS_POLICY_DEFAULT_ACL: NOT_CHANGED
GRANT_REVOKE: NOT_CHANGED
BUCKET_CONFIGURATION: NOT_CHANGED
OVERALL_W4: OPEN
```

## Liefervertrag

W4-03 stellt genau einen privaten Original-Anhang für die kanonische
Galvanik-Übergabe bereit. Die Ende-zu-Ende-Kette lautet:

`ORDER_STATION_MOVED_V1`-Receipt → unveränderliche Reservation → einmaliger
serverseitiger Signed-Upload-Grant → privates Storage-Objekt → zweiphasige
Verifikation → unveränderliche Evidence →
`private.v_order_station_evidence_receipts_v1` → Action →
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

Die folgende Abnahme lief lokal mit der gepinnten Supabase CLI `2.111.0` nach
einem frischen Reset über exakt zwölf Migrationen. Der Hybridlauf startete am
12. August 2026 um 00:01:15 Uhr Europe/Berlin und bestand 12/12 Tests in
26,02 Sekunden.

| Gate | Erwarteter realer Nachweis | Status |
|---|---|---|
| Migration/Ledger | frischer lokaler Reset, exakt 12 geordnete Migrationen bis `20260811184850` | PASS |
| Katalog | 18/11 geordnete Spaltennamen, 16/10 benannte Constraints, 7 PK-/Unique-Indizes, 6 Immutabilitätstrigger, private `security_invoker`-View | PASS innerhalb W4-03; vollständiges Semantikmanifest bleibt Folgeatom |
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
| E2E | echte DB → private View → echte Actions → echtes Panel → lokales Storage; PNG-Upload, FINALIZED-Readback, Remount allein aus Action/View, Originalbytes/hash | PASS |
| Quellqualität | fokussierte Unit-/RTL-Suite: 5 Dateien/99 Tests; TypeScript; 11 Exact-Path-ESLint-Pfade; Client-Boundary-Checker mit 699 gescannten `src`-Dateien; Diff-Check | PASS |

Der Hybridtest mockt ausschließlich `readAppSession`. Actions, Domain,
PostgreSQL, private View, Storage-Adapter, Supabase-Clients und HTTP bleiben echt.
Die UI lädt genau die Bytes hoch, die zuvor gehasht wurden; es gibt keinen
Admin-Upload im Happy Path und keine erfolgreiche Cleanup-/Delete-Aktion im
Test. Absichtlich abgewiesene DELETE-/TRUNCATE-Versuche sind Teil des
Immutabilitätsnachweises.

Der Workflow führt zuerst den bestehenden W3-Test am belegten
`20260811154732`-Cutoff aus, danach einen vollständigen 12er-Reset und diesen
W4-Hybridtest. Erst anschließend läuft der unveränderte harte
Production-Fingerprint-Gate. Der vollständige PG17-Semantikmanifest-Nachweis
für Spaltentypen, Nullability, Defaults sowie normalisierte Constraint-, Index-
und Viewdefinitionen über `pg_get_viewdef` ist bewusst der separate, unmittelbar folgende
Kandidaten-Fingerprint-Atom: `SCHEMA_SEMANTIC_MANIFEST=PENDING_NEXT_ATOM`.
Weil die Production-Referenz das neue private Schema noch nicht enthält, gilt
zusätzlich `CI_SCHEMA_GATE=PENDING_NEXT_ATOM`. Beide Gates werden in W4-03
weder als PASS behauptet noch abgeschwächt oder umgangen.

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
| wieder aktiv / W4-03 lokal belegt | kanonische aktive Galvanik-Ready-Karte: tenantgebundene Metadaten, Original reservieren/hochladen/finalisieren/frisch bestätigen und teamweit sicher lesen | frischer 12er-Replay, Hybrid 12/12, Source-Gates und zwei unabhängige Freeze-Reviews PASS |
| weiterhin bewusst quarantänisiert | sämtliche Legacy-Foto-/OCR-Pfade, andere Stationen/Einstiege, direkte Client-Storage-Policies, automatische Adoption, Überschreiben und Löschen | Legacy bleibt bytegleich; Wiederfreigabe benötigt einen eigenen sicheren W3-/W4-Vertrag |
| externer Blocker | Production-Fingerprint-Referenz, Remote-/Production-Migration, Production-ACL/RLS-Parität, Draft-PR und Vercel Preview | separater freigegebener Fingerprint-/Delivery-Atom nach lokalem PASS |

## Exakter Scope

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

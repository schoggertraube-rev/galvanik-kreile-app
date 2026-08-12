# W4 Evidence Read Contract Evidence

Stand: 2026-08-12

```yaml
MISSION: F0_FOUNDATION_CONVERGENCE_W2C_W4_001
BASE_COMMIT: 83123a4316c76377de1f4da3432a50926907479d
W4_LOCAL_STATUS: PASS_LOCAL
REVIEW_HANDOFF: F0_W4_REVIEW_READY
CRITERIA: W4-02,W4-03,W4-04,W4-08,W4-09
MIGRATION: 20260812103446_w4_evidence_read_contract.sql
MIGRATION_SHA256: dfd01b52b146ecbea34499b535ff4833cf18e7fa1dcecc1182ff6f8bb93cfd3f
SUPABASE_CLI: 2.111.0
POSTGRES: 17
REMOTE_OR_PRODUCTION_ACTIONS: NONE
DRAFT_PR: NONE
VERCEL_PREVIEW: NONE
GITHUB_CI: NOT_RUN
OVERALL_F0: BLOCKED_EXTERNAL_PERMISSION
```

## Ende-zu-Ende-Vertrag

Die belegte Kette ist:

`private.order_station_evidence` und vorhandenes `public.scan_uploads`
→ `private.v_order_station_evidence_receipts_v2` und
`private.v_evidence_records_v1`
→ `orderStationAttachment.ts` und `evidenceRead.ts`
→ `getGalvanikHandoffAttachmentsAction`
→ `GalvanikHandoffAttachmentPanel`
→ Loading, Empty, Unavailable, Pending, Finalized, Extraktionsstatus,
Konfidenz, Zielobjekte und Reload-Readback.

Ein Erfolg wird erst gezeigt, wenn die serverseitig autorisierte Action einen
tenantgebundenen Datensatz aus einer versionierten privaten View liefert und
alle unveränderlichen Bindungsfelder im Client exakt zum aktuellen Auftrag und
Item passen. Direkte Client-Autorität über Tenant, Actor, Pfad, Provider,
Extraktion oder Zielobjekt existiert nicht.

## W4-02: Extraktion und Konfidenz

- `private.evidence_extraction_metadata` ist append-only und besitzt genau eine
  Metadatenzeile je neuer Evidence-ID.
- Der Stationsoriginalpfad schreibt ehrlich `NOT_REQUESTED`; er erfindet weder
  Provider noch Dokumenttyp, Extraktion oder Konfidenz.
- Der Legacy-Read normalisiert die bereits vorhandenen Felder
  `detected_type`, `detection_confidence`, `extracted_data`, `ocr_provider` und
  `field_confidence` aus `scan_uploads`, ohne das Original zu ersetzen.
- State-, Confidence-, Provider- und Payload-Drift ergeben
  `integrity_ok=false` und einen neutralen `UNAVAILABLE`-Read, nie eine leere
  Erfolgsantwort.

## W4-03: polymorphe Links

- `private.evidence_domain_links` speichert `target_type` und `target_id`
  append-only.
- Der neue Stationsbeleg erzeugt in derselben Finalize-Transaktion genau die
  beiden Typen `ORDER` und `ORDER_ITEM`.
- Die kanonische Read-View liefert Links als streng validiertes Array. Der
  autorisierte Target-Read akzeptiert ausschließlich die Allowlist
  `ORDER|ORDER_ITEM|CUSTOMER|INVOICE` plus exakte Ziel-ID.
- Reine `CUSTOMER`- und reine `INVOICE`-Legacy-Evidence wurde real über
  `getGalvanikEvidenceByTargetAction` gelesen; sie benötigt keinen künstlichen
  Order-Link und keine neue UI außerhalb ihres Fachscopes.
- Unbekannter Typ, falsche ID, Duplikat, fremder Tenant oder unvollständiger
  Linkgraph führt fail-closed zu null Erfolg und null Folgeschreibvorgang.

## W4-04: Legacy nur lesend

- `public.scan_uploads` bleibt unverändert und wird ausschließlich durch
  `private.v_evidence_records_v1` gelesen.
- Der Server-Port importiert keine Legacy-Upload-, OCR- oder
  Klassifikationsfunktion und gibt weder `file_url` noch Storage-Capabilities
  aus.
- Ein realer gesicherter Legacy-Scan wurde vor und nach Read, Panel-Render und
  Remount bytegleich bestätigt.
- Der quarantänisierte Legacy-Upload-/Providerpfad bleibt geschlossen. Nur die
  bereits persistierte Evidence-Wahrheit ist wieder lesbar.

## W4-08: einzige Cross-Modul-Read-Ports

Das maschinenlesbare Inventar
`docs/evidence/f0/W4_CROSS_MODULE_READ_PORT_INVENTORY.json` deklariert exakt:

| Server-Port | Erlaubte View |
|---|---|
| `evidenceRead.ts` | `private.v_evidence_records_v1` |
| `orderStationAttachment.ts` | `private.v_order_station_evidence_receipts_v2` |
| `orderStationRead.ts` | `private.v_operational_station_queue_v1`, `private.v_order_station_receipts_v1` |

`check-w4-cross-module-read-ports.mjs` scannt 613 Produktionsdateien. Der
Checker lehnt direkte Basistabellenleser in Konsumenten, unbekannte Leser,
unversionierte oder nicht deklarierte Views, die abgelöste Receipt-View v1 und
fehlende Migration-/Konsumentenbindungen ab. Command-interne direkte Writes
bleiben eng auf `orderStationAttachment.ts` beschränkt.

## W4-09: positive und negative Matrix

Die reale lokale Matrix belegt:

- private ACL und fehlende anon/authenticated/service-role Grants;
- append-only UPDATE/DELETE/TRUNCATE-Denials auf Evidence, Extraktion und Links;
- exakt atomare Finalize-Schreibfolge Evidence + Extraktion + zwei Links;
- Tenant-, Actor-, Capability-, Order-, Item-, Version-, Hash-, MIME-, Größe-,
  Storage- und Receipt-Bindung;
- Legacy-Read-only mit unverändertem Vor-/Nachsnapshot;
- Confidence-, Target-, View- und Provider-Drift fail-closed;
- Korrelation, Lost-Response-Replay und Idempotenz ohne zweite Evidence;
- Reload ausschließlich aus DB/View/Action, ohne Entwicklerzustand.

## Ausgeführte Belege

| Gate | Receipt |
|---|---|
| Fokussierte Unit/Action/RTL | `4 files, 103 tests PASS` |
| Echte lokale Integration | `1 file, 14 tests PASS`; DB → View → Actions → Panel → Storage → Remount; Customer-/Invoice-Target-Read |
| Vollständige Units | `87 files, 551 tests PASS`; 107.32 s |
| TypeScript | `npx tsc --noEmit --incremental false`; Exit 0 |
| Vollständiges ESLint | Exit 0; nur zwei vorbestehende Warnungen außerhalb des neuen Vertrags |
| Produktionsbuild | `next build` PASS mit redigierter lokaler Loopback-DB/Supabase-Umgebung; 58 Seiten |
| Read-Port-Checker | `PASS`; 613 Produktionsdateien, 3 Ports |
| Read-Port-Selftest | `PASS`; 6 adversariale Fälle |
| Frischer Schema-Replay | 13 Migrationen ohne Seed; PostgreSQL 17 |
| Kandidatenvertrag | exakt 312 ADD, 0 CHANGE, 0 REMOVE |
| Replay-Determinismus | Katalog, Fingerprint und Ledger jeweils SHA- und byteidentisch |

## Schema-Receipt

| Artefakt | SHA-256 / Wert |
|---|---|
| Baseline-Katalog | `a928c98f1e4470f734ae1e9686c6c98bcf03fc5876ba44e038a20ab14095f84b` |
| Kandidaten-Katalog | `25b91a7408d022ccbe92b7b26f9f50954dd56f5a935a08f1f9ca6eb6dd756908`; 1,093,433 Bytes |
| Kandidaten-Fingerprint-Datei | `5795e078dae63b17ae616a01aaa4835aca3b3430a777fa9ad80c0131197d1eb1`; 479 Bytes |
| Kandidaten-Ledger-Datei | `c3bbe08a8b6c631d26704b1f1a2ef347f2dbb9dc98f4fe0df69e71a4d0952c8f`; 1,873 Bytes |
| Schema-Vertrag | `f17e2abbb78144ef87bdc11a0cfdd520b40123c295665e13c7ebf0061597cb53`; `CAPTURED_LOCAL` |
| Objektarten | 9 Relationen, 156 Spalten, 40 Constraints, 15 Indizes, 5 Views, 15 Trigger, 72 Owner-Grants |
| Migrationen | W3 2; W4-01 60; W4-03 120; Evidence-Read-Vertrag 130; gesamt 312 |

## Wahrheitsgrenze und Stop

Dieser Nachweis verwendet nur den isolierten Missionsworktree, eine lokale
disposable PostgreSQL-17-/Supabase-Instanz und lokale Testdaten. Es gab keinen
Push, Draft-PR, Preview, Deploy, Merge, Remote-DB-Zugriff, Production-Abfrage,
Remote-Migration oder Remote-RLS-/ACL-Mutation. Der geschützte Checkout blieb
unangetastet.

W4 ist damit als lokaler, wiederholbarer Kandidat vollständig und
`F0_W4_REVIEW_READY`. F0 insgesamt bleibt bis zur unabhängig ausgeführten
P1-P12-Prüfung und den ausdrücklich freizugebenden Delivery-Gates
`BLOCKED_EXTERNAL_PERMISSION`. Es wird kein F1-Paket begonnen.

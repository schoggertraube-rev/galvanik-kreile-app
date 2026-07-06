# M6 — Slice-1-Implementierungsvertrag V2.4 (VORSCHLAG)

**Status:** `PROPOSAL_ACCEPTED` (Nachprüfung 38_: `CONTRACT_VERDICT_V24: PASS`, 2026-07-06)
**Mission:** M6 gemäß akzeptiertem Katalog (27_AKZEPTANZ_UND_BUILD_FREIGABE.md)
**Ablage:** `_agentur_reports/proposals/` — kein autoritativer Baum (V6 5.3)
**Datum:** 2026-07-05 · **Rev:** 2026-07-06 (V2.3 nach Korrekturdirektive 37_; V2.4 nach finaler Fremdprüfung 38_, Fund 1 geschlossen)
**Formatschranke:** Nur `.md` — kein Code in `proposals/` (V6 5.2/5.3)

---

## 0. Zweck und Abgrenzung

Dieser Vertrag definiert **was** für Slice 1 gebaut wird, auf welchen Tabellen, mit welchen Constraints und Transaktionsgrenzen, und wie die Arbeit in **einzeln baubare Missionen** aufgeteilt wird. Er definiert **nicht** UI-Interaktion oder Komponentendesign — das ist Sache des nachgelagerten Claude-Design-Vertrags (04_CURRENT_GATE_AND_DESIGN_SEQUENCE.md).

**Grundprinzip V2.3 (Direktive 37_):** Dieser Vertrag beschreibt kein Ideal im luftleeren Raum. Er inventarisiert die **existierenden Produktionspfade** (§2a) und benennt je Pfad „ersetzen" oder „härten" in der zuständigen Baumission. Jede Tabellen-/Spalten-/Rollenaussage ist gegen `src/db/schema.ts` (Twin) mit Zeilennummer belegt. Was remote nicht belegt ist, ist als **„SSG-00 remote zu verifizieren"** markiert — nie als Fakt.

### Lehre aus V1 (03_PHASE0_AND_V1_FINDINGS.md #17)

Der V1-Vertrag war **ein Monster** — eine monolithische Baumission für den gesamten Slice. V2 spaltet denselben Scope in **sieben sequenzielle Missionen** (B1–B7), die jeweils einzeln gebaut, geprüft und abgenommen werden können. Keine Mission ist länger als ein fokussierter Arbeitstag.

---

## 1. Slice-1-Pflichtfluss (aus 01_PRODUCT_AND_SLICE_CONTRACT.md)

```
Foto/Beleg
→ Original unverändert sichern (lokal + remote)
→ Offline/Outbox (belastbar lokal persistiert)
→ OCR/KI (nur auf gesichertem Original)
→ Kunde/Auftrag/Teilgruppe (zuordnen oder kontrolliert anlegen)
→ Review nur bei Unsicherheit
→ fachlicher Wareneingang
→ routebasierte erste reale Produktionskarte
```

---

## 2. Kernregeln-Zuordnung

Jeder Baustein verweist auf die Kernregeln aus `01_PRODUCT_AND_SLICE_CONTRACT.md`, die er adressiert:

| Kernregel | Zugeordneter Baustein |
|---|---|
| 1 (ein kanonischer Capture-Vertrag) | B1, B2 (Altpfad-Ersetzung §2a) |
| 2 (Original vor OCR) | B1, B2 |
| 3 (kein Base64 in localStorage) | B1, B5 |
| 4 (keine stille Löschung) | B1, B5 |
| 5 (≥48h Offlinevorhaltung, danach bis Sync) | B5 |
| 6 (idempotente Sync) | B5 |
| 7 (kein Last-Writer-Wins für gesamten Record) | B3, B5 |
| 8 (KI = Vorschlag, nie Wahrheit) | B2 |
| 9 (feldbezogene Konfidenz) | B2 |
| 10 (keine feste Schwelle ohne Pilotkalibr.) | B2 |
| 11 (eindeutige Transaktionsgrenze) | B3 (ersetzt Altpfad, §2a) |
| 12 (Startstation aus Route, kein Hardcode) | B4 |
| 13 (Fachberechnungen in SQL-Views) | B4 |
| 14 (globale Queries nicht ersetzen ohne Konsumentenbeweis) | B3, B4 |
| 15 (Korrektur/Undo abhängigkeitsbewusst) | B6 |
| 16 (Session, Rolle, Tenant, RLS, Storage E2E) | B1, alle Server-Actions (§7.4) |
| 17 (kein Mock/Math.random/Fallback im Prod-Pfad) | alle (Altpfad-Befunde §2a) |
| 18 (Navigation nur mit Freigabe) | keiner — Navigation wird hier nicht verändert |

---

## 2a. Ist-Inventar: existierende Produktionspfade (ersetzen/härten)

Kern der Konvergenz (Direktive 37_ §C): Diese Pfade existieren **heute** im Twin und verletzen den Slice-1-Vertrag. Jede Baumission, die einen dieser Pfade berührt, muss ihn **namentlich ersetzen oder härten** — kein zweiter Parallelpfad daneben.

| # | Pfad | Verifizierte Befunde (Datei:Zeile) | Behandlung | Zielmission |
|---|---|---|---|---|
| I-1 | `src/app/api/erfassung/scan-upload/route.ts` | (a) Service-Role-Client mit `SUPABASE_SERVICE_ROLE_KEY` = RLS-Bypass (Z.9–12); (b) Dateiname aus `Date.now()` + `Math.random()` (Z.29–30, verletzt Kernregel 17); (c) `getPublicUrl` wird in `file_url` persistiert — öffentlicher Link statt tenant-geschütztem Pfad (Z.41–45); (d) Base64 geht sofort an OCR (`extractDocumentData`), **vor** jeder Original-Sicherung/Hash-Bildung (Z.50–56, verletzt Kernregel 2); (e) hartkodierte `detectedType: "Lieferschein"` und `detectionConfidence: "0.9"` (Z.59–60, verletzt Kernregeln 8/9/17); (f) kein Hash, kein Idempotenzschlüssel, kein `events`-Eintrag | **ERSETZEN** durch `uploadScan()` (Saga S1, §4.1) + `runOcrOnScan()` (Saga S2, §4.2); Altpfad deaktivieren, Konsumenten-Inventar zwingend | B1 (Fundament) / B2 (Ersetzung) |
| I-2 | `src/app/actions/erfassung.actions.ts::convertScanToOrder` (Z.578–680) | (a) **keine `db.transaction`** — vier unabhängige Einzelwrites: `customers`-Insert (Z.621–629), `orders`-Insert (Z.638–648), `items`-Insert (Z.651–661), `scan_uploads`-Update (Z.664–667) → halb angelegter Kunde/Auftrag möglich (verletzt Kernregel 11); (b) kein `events`-Insert im gesamten Pfad; (c) setzt nur `linkedOrderId`/`linkedCustomerId` (Z.665–666), keine `conversion_order_id`/`conversion_event_id`; (d) Auftragsnummer aus `Date.now().toString(36)` (Z.634); (e) keine Autorisierungs-/Rollenprüfung, `tenantId` stammt aus dem Scan-Datensatz (Z.590) statt aus der authentifizierten Session | **ERSETZEN** — B3 ersetzt/deaktiviert diesen Pfad atomar (T3, §4.3). **Kein zweiter Parallelpfad** neben ihm (sonst Parallelwahrheit) | B3 |
| I-3 | `supabase/functions/scan-analyze/index.ts` | akzeptiert `base64_data` **oder** beliebige `file_url` als OCR-Quelle (Z.15–19); fetcht `file_url` ungeprüft (Z.29–35) → OCR läuft nicht garantiert auf gesichertem Original (verletzt Kernregel 2) | **HÄRTEN** — OCR nur auf gesichertem Original aus dem `scans`-Bucket (`status='secured'`, §4.2); `base64_data`-/freie-`file_url`-Quellen deaktivieren oder auf signierte Storage-URLs des eigenen Buckets einschränken (begründet, mit Negativtest) | B2 |
| I-4 | Alt-Migration `supabase/migrations/0001_app_schema.sql:83–101` (`status_events` mit `metadata`, Z.90) + Legacy-Alias `statusEvents = events` (`schema.ts:235`) | Parallelwahrheits-/Namensrisiko: Alt-Tabelle `status_events`/`metadata` vs. kanonisch `events`/`payload` (`schema.ts:156–170`, `payload` Z.164). Zusatz (38_ Fund 4): `status_events` besitzt `customer_id` (0001:88), `events` **nicht** (schema.ts:156–170) — bei jeder Überführung/Query-Umstellung muss `customer_id` nach `payload` gemappt oder bewusst verworfen werden | **INVENTARISIEREN + HÄRTEN** — kanonisch ist `events`/`payload`; B1 erfasst den Remote-Ist-Zustand von `status_events` (SSG-00), B4 belegt, dass keine View/Query gegen die Alt-Wahrheit läuft | B1 / B4 |
| I-5 | Route `/scan`: `src/app/scan/page.tsx` → `src/components/intake/CameraCapture.tsx` → `src/app/actions/ocr.actions.ts::processImage` → `src/app/actions/orders.actions.ts::createOrderFromScan` (Z.376–498) | (a) **Zweiter kompletter Capture→Auftrag-Pfad ohne `scan_uploads`/Storage:** `scan/page.tsx` rendert `CameraCapture` (Z.206) und ruft `createOrderFromScan` auf (Import Z.9, Aufruf Z.45); (b) Original entsteht als Base64 **nur im React-State** (`canvas.toDataURL`, CameraCapture.tsx:73 bzw. FileReader Z.99–108) und wird nie persistiert → belegbarer **Originalverlust bei Refresh/Crash** (TRUTH-Kernproblem „CameraCapture-Pfad verliert Original"; verletzt Kernregeln 2/3/4); (c) OCR läuft direkt auf dem ungesicherten In-Memory-Base64 (`processImage`-Aufrufe CameraCapture.tsx:84/102 → ocr.actions.ts:6–8); (d) **stiller OCR-Fallback** `{ rawText: "OCR fehlgeschlagen" }` als reguläres Ergebnis (ocr.actions.ts:11) und deprecated Mock-Pfad `processImageWithAI` → `ocrService.simulateScan` (ocr.actions.ts:16–19) — Kernregel 17; (e) `createOrderFromScan` ist eine **zweite Auftragswahrheit** neben I-2: kein `scan_uploads`-Bezug, `source:'scan'` ohne `source_ref` (orders.actions.ts:467), Kundenneuanlage mit **hartkodierter Dummy-Adresse** „Hauptstraße 1, 60311 Frankfurt" (orders.actions.ts:428–432), Kunde und Auftrag ohne gemeinsame Transaktionsgrenze (getrennte Actions Z.424 vs. Z.471) | **ERSETZEN** — Capture-Teil durch Saga S1/S2 (B2), Auftrags-Teil durch T3 (B3); `/scan`-Flow auf den kanonischen Capture-Vertrag umstellen oder deaktivieren; Mock/stiller Fallback aus dem Prod-Pfad entfernen; Konsumenten-Inventar zwingend | B2 / B3 |
| I-6 | `src/features/orders/orderPhoto.actions.ts::uploadOrderPhotoRecord` (Z.9–50) + Aufrufer `src/components/orders/OrderOverlay.tsx` (Z.422–455) | (a) **Zweiter direkter Schreibpfad auf die Kern-Tabellen** `scan_uploads` (Insert Z.22–30) **und** `events` (Insert Z.33–39) — uninventarisierter Parallelschreiber auf dem kanonischen Slice-Objekt; (b) `tenantId: 'galvanik-kreile'` **hartkodiert** statt aus Session (Z.23 und Z.34) — exakt das §7.3-Anti-Muster; (c) hartkodierte Statuswahrheit `status: 'processed'` / `detectedType: 'Foto'` (Z.28–29); (d) Aufrufer OrderOverlay lädt **clientseitig** mit `Date.now()`-Dateiname und hartkodiertem Tenant-Pfadpräfix (Z.430) und persistiert `getPublicUrl` als `file_url` (Z.438, 442) — reproduziert das I-1-Anti-Muster (b)+(c) | **ERSETZEN/HÄRTEN** — Foto-zu-Auftrag-Anhang auf den S1-Vertrag umstellen: Original-Sicherung, Session-Tenant (§7.3), Storage-Pfad statt publicUrl, Storage-Policies §7.2 | B1 (Inventar) / B2 (Härtung) |

---

## 3. Betroffene Tabellen — Soll-Zustand

Belegquelle: `src/db/schema.ts` (Twin). Remote-Zustand gilt grundsätzlich als **SSG-00 zu verifizieren**, solange kein `information_schema`-/Migrations-Rohlog vorliegt.

### 3.1 `scan_uploads` (BESTEHEND — erweitern; Drizzle: `scanUploads`, schema.ts:273–287)

Beschreibung: Kanonisches Vor-Auftrags-Objekt. Hält die Referenz auf das hochgeladene Foto/Dokument und den Verarbeitungsstatus.

| Spalte | Typ | Constraint | Status (Beleg) |
|---|---|---|---|
| `id` | `text PK` | App-seitiger Default `createId()` (cuid2) | ✅ existiert (schema.ts:274). **Kein DB-Default in Drizzle belegt** — DB-seitiger Default SSG-00 remote zu verifizieren |
| `tenant_id` | `varchar(50) NOT NULL` | `DEFAULT 'galvanik-kreile'` | ✅ existiert (schema.ts:275) |
| `file_url` | `text NOT NULL` | — | ✅ existiert (schema.ts:276). Heute mit `getPublicUrl` befüllt (I-1c) — B2 stellt auf tenant-geschützten Storage-Pfad um |
| `file_type` | `text` | — | ✅ existiert (schema.ts:277) |
| `uploaded_by` | `uuid` | Drizzle-FK auf `app_users.id` | ✅ existiert (schema.ts:278). Remote-FK SSG-00 zu verifizieren |
| `uploaded_at` | `timestamptz NOT NULL` | `DEFAULT now()` | ✅ existiert (schema.ts:279) |
| `detected_type` | `text` | — | ✅ existiert (schema.ts:280) |
| `detection_confidence` | `numeric(3,2)` | — | ✅ existiert (schema.ts:281) |
| `extracted_data` | `jsonb` | — | ✅ existiert (schema.ts:282) |
| `status` | `text NOT NULL` | `DEFAULT 'new'` | ✅ existiert (schema.ts:283) |
| `linked_order_id` | `text` | **Drizzle: KEIN FK** (schema.ts:284) | ✅ existiert. Remote-FK `ON DELETE SET NULL` nur per Migration `20260621103338_fk_scan_uploads.sql:1–3` — Anwendung remote SSG-00 zu verifizieren |
| `linked_customer_id` | `text` | **Drizzle: KEIN FK** (schema.ts:285) | ✅ existiert. Remote-FK nur per Migration `20260621103338:5–7` — SSG-00 |
| `linked_invoice_id` | `text` | — | ✅ existiert (schema.ts:286) |
| `ocr_provider` | `text` | — | ⚠ **Nur als Migration** (`20260621103346_add_ocr_provider.sql:1`) — **Drizzle-Symbol fehlt** in schema.ts:273–287. B1 ergänzt das Symbol; Remote-Existenz SSG-00 |
| `original_hash` | `text` | — | 🆕 NEU (B1) — SHA-256 des Originals |
| `original_storage_path` | `text` | — | 🆕 NEU (B1) — Pfad im `scans`-Bucket |
| `original_size_bytes` | `bigint` | — | 🆕 NEU (B1) — Dateigröße für Integritätsprüfung |
| `original_secured_at` | `timestamptz` | — | 🆕 NEU (B1) — Zeitpunkt der gesicherten Ablage |
| `client_idempotency_key` | `text` | `UNIQUE(tenant_id, client_idempotency_key)` | 🆕 NEU (B1) — vom Client erzeugte UUID (Kernregel 6). Tenant-scoped UNIQUE, nicht global |
| `field_confidence` | `jsonb` | `DEFAULT '{}'::jsonb` | 🆕 NEU (B1) — feldbezogene Konfidenz (Kernregel 9) |
| `review_required` | `boolean` | `DEFAULT false` | 🆕 NEU (B1) — KI-Unsicherheits-Flag |
| `reviewed_by` | `uuid` | `REFERENCES app_users(id)` | 🆕 NEU (B1) — wer hat geprüft |
| `reviewed_at` | `timestamptz` | — | 🆕 NEU (B1) |
| `conversion_order_id` | `text` | `REFERENCES orders(id) ON DELETE SET NULL` | 🆕 NEU (B1) — Auftrag, der aus diesem Scan erzeugt wurde |
| `conversion_event_id` | `text` | — | 🆕 NEU (B1) — Verweis auf das Wareneingangs-Event |

> [!IMPORTANT]
> `linked_order_id` ist die **manuelle Zuordnung** zu einem bestehenden Auftrag.
> `conversion_order_id` ist der **aus diesem Scan neu erzeugte** Auftrag.
> Beide können gleichzeitig gesetzt sein (z.B. Nachtrag zu bestehendem Auftrag).
> Der Altpfad I-2 schreibt heute fälschlich `linked_*` für Konvertierungen (Z.664–667) — B3 korrigiert das auf `conversion_*`.

### 3.2 `events` (BESTEHEND — kanonische Audit-Tabelle; Drizzle: `events`, schema.ts:156–170)

Beschreibung: Fachliche Ereignisse. Kanonische Tabelle ist `events` (schema.ts:156), **nicht** `status_events` (Alt-Migration `0001_app_schema.sql:83–101`; Legacy-Alias `statusEvents = events` in schema.ts:235). Die Spalte für Nutzdaten ist `payload` (schema.ts:164), **nicht** `metadata` (0001:90). Die SQL-Zeitspalte heißt `created_at` (schema.ts:169).

| `event_type` | Wann | `payload`-Pflichtfelder |
|---|---|---|
| `SCAN_UPLOADED` | Original gesichert | `{ scan_upload_id, original_hash, storage_path }` |
| `SCAN_OCR_COMPLETED` | OCR/KI fertig | `{ scan_upload_id, provider, field_confidence }` |
| `SCAN_REVIEWED` | Mensch hat unsicheren Scan bestätigt | `{ scan_upload_id, reviewed_by, changes }` |
| `WARENEINGANG` | Fachlicher Wareneingang abgeschlossen | `{ scan_upload_id, order_id, items_count }` |
| `STATION_STARTED` | Erste Produktionsstation begonnen | `{ order_id, station_slug, source: 'route' }` |

> [!IMPORTANT]
> **Ereignis-/Schema-Wahrheit (Befund 2, Direktive 37_ §A):** `events.order_id` ist im Drizzle-Schema `NOT NULL` (`orderId: text("order_id").notNull()...`, schema.ts:159). Damit Vor-Auftrags-Ereignisse (wie `SCAN_UPLOADED`) gespeichert werden können, ändert B1 **BEIDES**:
> 1. **Drizzle-Schema:** `.notNull()` an schema.ts:159 entfernen (Nachweis: Diff + `npx tsc --noEmit`),
> 2. **Remote-Migration:** `ALTER TABLE events ALTER COLUMN order_id DROP NOT NULL`, belegt via `information_schema.columns.is_nullable` (SSG-00).
> Nur eines von beiden zu ändern erzeugt Drift zwischen Code-Wahrheit und DB-Wahrheit.

### 3.3 `orders` (BESTEHEND — keine Schemaänderung; Drizzle: `orders`, schema.ts:82–116)

Betroffene Spalten für Slice 1: `status` (schema.ts:91), `intake_date` (schema.ts:103), `source` (schema.ts:109), `source_ref` (schema.ts:110).

> [!IMPORTANT]
> **`orders.received_at` existiert NICHT** (Direktive 37_ §A, verifiziert: schema.ts:82–116 enthält keine solche Spalte; die Wareneingangszeit ist `intake_date`, schema.ts:103). V2.2 hatte `received_at` fälschlich als bestehende Spalte behauptet und in T3 beschrieben. **Entscheidung V2.3:** `received_at` wird ersatzlos aus T3 entfernt — `intake_date` deckt die Semantik ab, kein neues Schema-Symbol nötig (minimaler Scope). Die zweite von der Direktive zugelassene Option (Neuanlage per B1-Migration + Drizzle-Symbol) wird bewusst nicht gewählt.

Keine neuen Spalten nötig — `source`/`source_ref` sind in Drizzle belegt (schema.ts:109–110); Remote-Existenz SSG-00 (Migrationskandidat: `20260626000000_erfassung_additive_spalten.sql`, remote unbelegt).

### 3.4 `items` (BESTEHEND — keine Schemaänderung; Drizzle: `items`, schema.ts:136–153)

Betroffene Spalten: `photo_ids` (schema.ts:146), `station_sequence` (schema.ts:149), `current_step` (schema.ts:150). Remote-Existenz SSG-00.

### 3.5 `company_settings` (BESTEHEND — nur lesen; Drizzle: `companySettingsTable`, schema.ts:339–363)

> [!WARNING]
> **`workflow_templates` hat KEIN Drizzle-Symbol** — `companySettingsTable` (schema.ts:339–363) enthält die Spalte nicht. Sie existiert nur als SQL-Migration: `20260621000000_phase2_migrations.sql:104` (Spaltenanlage `jsonb DEFAULT '{}'`) und `:106–113` (Seed der Routen `chrom_hochglanz`, `vernickeln`, `bruenieren`, `verzinken` für Tenant `galvanik-kreile`). Remote-Existenz und -Inhalt: SSG-00 zu verifizieren.
> **Konsequenz für B4:** B4 muss den Zugriffsweg explizit herstellen — entweder Drizzle-Symbol ergänzen ODER lesenden Zugriff per SQL definieren. Kein Zugriff über ein nicht existierendes Drizzle-Property.

Wird **gelesen**, nicht geschrieben. Die Startstation ergibt sich aus `workflow_templates[route][0]` — kein Hardcode auf `galvanik` oder ähnliches (Kernregel 12).

### 3.6 Storage-Bucket `scans` (BESTEHEND — Policies härten)

| Aspekt | Soll |
|---|---|
| Bucket-Name | `scans` (angelegt per `20260611114327_create_storage_buckets.sql:1`; Remote-Zustand SSG-00) |
| Public | `false` (ebd., `public=false`; remote SSG-00) |
| Pfadstruktur | `{tenant_id}/{scan_upload_id}/original.{ext}` |
| Upload-Policy | nur `authenticated` mit **`app_users`-Lookup gegen `auth.uid()` und Ordnernamen** (§7.2). **Kein `uploaded_by`-Spaltenbezug** — `storage.objects` hat keine Spalte `uploaded_by`; Identitätsbindung über `owner`/JWT/`app_users`-Lookup |
| Download-Policy | `authenticated` mit Tenant-Match via `app_users`-Lookup (§7.2, serverseitig, Kernregel V1 #9) |
| Lösch-Policy | **kein DELETE für `authenticated`** — keine Policy, RLS-Negativtest zwingend (Kernregel 4) |
| Aufbewahrung | unendlich bis fachliches Verwerfen oder Archivierung (kein 48h-Autodelete) |

---

## 4. Transaktionsgrenzen und Saga-Modell (Kernregel 11)

> [!IMPORTANT]
> **Ehrliche Transaktionsgrenze (Befund A korrigiert):** Storage-Uploads und externe OCR-Aufrufe sind **nicht** Teil einer Postgres-Transaktion. Die DB-Transaktion umschließt nur DB-Schreibvorgänge. `scan_uploads` dient als **durabler Anker** — sein `status`-Feld markiert den Fortschritt und ermöglicht Retry bei Abbruch (Saga/Outbox-Muster). Keines der nachfolgenden Diagramme behauptet Atomarität über DB + externe I/O hinweg.
>
> **Geltungsbereich von `SET LOCAL app.tenant_id`:** Der GUC-Mechanismus wirkt ausschließlich auf **DB-Tabellen-RLS innerhalb derselben DB-Transaktion** (§7.1/§7.3). Er wirkt **NICHT** auf `storage.objects`-Policies — die Storage-API läuft nicht in der App-DB-Transaktion mit (§7.2, Direktive 37_ §B).

### 4.1 Saga S1: Scan-Upload + Original-Sicherung

```
Schritt 1 — DB-Transaktion (Anker anlegen):
  BEGIN
    SET LOCAL app.tenant_id = $tenant   -- aus authentifizierter Session, nie Client
    INSERT scan_uploads (status='uploading', client_idempotency_key=X)
  COMMIT
  → Durabler Anker existiert. Bei Crash ab hier: Outbox findet status='uploading' → Retry ab Schritt 2.

Schritt 2 — Externer I/O (NICHT transaktional):
  Storage.upload(scans/{tenant}/{id}/original.{ext})   -- im Nutzer-JWT-Kontext, §7.2
  SHA-256 des hochgeladenen Blobs berechnen
  → Bei Fehler: scan_uploads bleibt auf 'uploading' → Retry.

Schritt 3 — DB-Transaktion (Anker abschließen):
  BEGIN
    SET LOCAL app.tenant_id = $tenant
    UPDATE scan_uploads SET status='secured',
      original_hash=SHA256, original_storage_path=...,
      original_size_bytes=..., original_secured_at=now()
    INSERT events (event_type='SCAN_UPLOADED', order_id=NULL,
      payload={scan_upload_id, original_hash, storage_path})
  COMMIT
```

**Fehlerfall:** Crash zwischen Schritt 2 und 3 → Storage-Objekt existiert, aber status='uploading'. Retry: Storage-Retry technisch als Upsert spezifiziert (oder Branch Hash-Exists); Schritt 3 setzt den Status. Das Constraint `UNIQUE(tenant_id, client_idempotency_key)` verhindert Doppelanlage (Kernregel 6).

**Constraint:** Keine verschachtelten unabhängigen Transaktionen (V1-Finding #4). `SET LOCAL app.tenant_id` nur innerhalb einer garantierten DB-Transaktion (V1-Finding #7). `$tenant` wird serverseitig aus der authentifizierten Session abgeleitet (§7.3).

**Ersetzt Altpfad I-1:** `scan-upload/route.ts` wird durch S1+S2 abgelöst — kein `Date.now()`/`Math.random()`-Dateiname (I-1b), kein `getPublicUrl` (I-1c), kein OCR vor Sicherung (I-1d), keine hartkodierte Konfidenz (I-1e).

### 4.2 Saga S2: OCR/KI-Verarbeitung

```
Vorbedingung: scan_uploads.status = 'secured' (S1 abgeschlossen).
Aufruf auf status != 'secured' wird abgewiesen.

Schritt 1 — Externer I/O (NICHT transaktional):
  Storage.download(scans/{tenant}/{id}/original.{ext}) → Bild/PDF
  OCR-Provider aufrufen → Ergebnis: extrahierte Felder + feldbezogene Konfidenzen
  → Bei Fehler: scan_uploads bleibt auf 'secured' → Retry jederzeit möglich.

Schritt 2 — DB-Transaktion (Ergebnis persistieren):
  BEGIN
    SET LOCAL app.tenant_id = $tenant
    UPDATE scan_uploads SET
      extracted_data=..., field_confidence=...,
      review_required=(min(confidence) < threshold),
      ocr_provider=..., status='ocr_done'
    INSERT events (event_type='SCAN_OCR_COMPLETED',
      payload={scan_upload_id, provider, field_confidence})
  COMMIT
```

**Idempotenz:** Erneuter OCR-Aufruf überschreibt `extracted_data` und `field_confidence`, erzeugt kein Duplikat. Ausnahme: manuell bestätigte Felder (`reviewed = true` in `field_confidence`) werden **nicht** überschrieben (siehe §6, Befund E). Event-History bleibt lückenlos (neuer Eintrag pro Lauf).

**Härtet Altpfad I-3:** `scan-analyze/index.ts` akzeptiert heute `base64_data` oder beliebige `file_url` (Z.15–35). B2 grenzt hart ein: OCR-Quelle ist ausschließlich das gesicherte Original aus dem `scans`-Bucket. `base64_data` wird deaktiviert; `file_url` — falls beibehalten — nur als signierte URL des eigenen Buckets mit Tenant-Pfadvalidierung, mit Negativtest für Fremd-URLs.

### 4.3 Transaktion T3: Auftragserstellung / Konvertierung (Kernregel 11)

> [!IMPORTANT]
> **T3 ERSETZT den existierenden Pfad I-2** (`erfassung.actions.ts::convertScanToOrder`, Z.578–680) — es wird **keine zweite Action parallel** gebaut (Direktive 37_ §C/§D). Der Altpfad hat keine Transaktion (vier Einzelwrites Z.621–667), kein Event, keine `conversion_*`-Spalten, keine Rollenprüfung (§2a I-2). B3 ersetzt ihn in place oder deaktiviert ihn nachweislich; alle Konsumenten zeigen danach auf die neue Implementierung.
>
> **Gleiches gilt für die zweite Auftragswahrheit I-5** (`orders.actions.ts::createOrderFromScan`, Z.376–498, aufgerufen aus `scan/page.tsx:45`): Nach B3 existiert genau **EIN** transaktionaler Auftragserstellungspfad aus Scans. `createOrderFromScan` wird auf T3 umgestellt oder deaktiviert; das Konsumenten-Inventar (B3-AK7) umfasst **beide** Altpfade (38_ Fund 1).

```
BEGIN
  SET LOCAL app.tenant_id = $tenant
  1. MATCH/INSERT customers (Prüfung auf bestehenden Kunden, ggf. Neuanlage)
  2. INSERT orders (..., customer_id=matched_customer_id, source='scan', source_ref=scan_upload_id)
  3. INSERT items (fungiert in Slice 1 als Teilgruppe, photo_ids=[scan_storage_path])
  4. INSERT events (event_type='WARENEINGANG',
       payload={scan_upload_id, order_id, items_count})
     → neue Event-ID merken
  5. UPDATE scan_uploads SET
       conversion_order_id=new_order_id,
       conversion_event_id=new_event_id,
       status='converted'
  6. UPDATE orders SET intake_date=now(), status='wareneingang'
COMMIT
```

**Constraint:** Atomare DB-Transaktion — entweder alles oder nichts. Dies erweitert T3 strikt nach Kernregel 11 um Kunden-Matching/-Anlegen und Teilgruppen-Mapping (die `items`-Tabelle erfüllt die Teilgruppen-Rolle fachlich). Kein Zustand, in dem ein Auftrag existiert, aber der Scan nicht als `converted` markiert ist. **Rollback-Beweis obligatorisch für:** Customer(-Match/-Neuanlage), Order, Items, Event, `scan_uploads.conversion_order_id`/`conversion_event_id`/`status` und `orders.source`/`source_ref`/`status`/`intake_date` (SSG-17, Direktive 37_ §D). Ein Zustand mit halb angelegtem Kunden/Auftrag muss unmöglich sein. Kein externer I/O in dieser Transaktion — alle Schritte sind reine DB-Operationen. `conversion_event_id` wird explizit gesetzt (Befund F: kein toter Spaltenvertrag mehr). Schritt 6 nutzt ausschließlich `intake_date` (schema.ts:103) — **kein `received_at`** (§3.3).

### 4.4 Transaktion T4: Routebasierter Produktionsstart

```
BEGIN
  SET LOCAL app.tenant_id = $tenant
  1. SELECT workflow_templates FROM company_settings WHERE tenant_id=$tenant
     -- Zugriffsweg gemäß §3.5: Drizzle-Symbol (von B4 ergänzt) oder raw SQL
  2. Startstation = templates[gewählte_route][0]
  3. UPDATE items SET station_sequence=route, current_step=0
  4. INSERT events (event_type='STATION_STARTED',
       payload={order_id, station_slug=startstation, source='route'})
  5. UPDATE orders SET status='in_produktion'
COMMIT
```

**Constraint:** Keine Hardcoded-Station. `station_slug` kommt aus der Route (Kernregel 12). Reine DB-Transaktion — kein externer I/O.

### 4.5 Vor-Auftrags-Ereignisse

Ereignisse vor T3 (SCAN_UPLOADED, SCAN_OCR_COMPLETED, SCAN_REVIEWED) haben `order_id = NULL`. Sobald T3 erfolgreich ist, können sie retrospektiv via `payload.scan_upload_id` → `scan_uploads.conversion_order_id` dem Auftrag zugeordnet werden. **Kein nachträgliches UPDATE der Events** — die Zuordnung geschieht über JOIN in SQL-Views (Kernregel 13).

> [!IMPORTANT]
> **Befund 2:** `events.order_id` ist in Drizzle `NOT NULL` (schema.ts:159). B1 ändert Drizzle-Schema **UND** Remote-DB (§3.2). Remote-Beweis via `information_schema` ist obligatorisch (SSG-00).

---

## 5. Original-Sicherung, Aufbewahrung, Löschregel (Kernregeln 2–5)

| Regel | Umsetzung |
|---|---|
| Original vor OCR | S1 muss abgeschlossen sein (`status='secured'`), bevor S2 starten darf. Vorbedingungsprüfung in der Server-Action. Altpfade I-1d/I-3 (OCR auf Roh-Base64/freie URL) werden ersetzt/gehärtet (§2a) |
| Kein Base64 in localStorage | Lokaler Client speichert `Blob` in IndexedDB (nicht localStorage). Beim Sync wird der Blob zu Storage hochgeladen und lokal verworfen. Kein Base64-Encoding der Bilddaten |
| Keine stille Löschung | Kein `DELETE`-RLS-Recht für `authenticated` auf `scans`-Bucket. Kein Cron-Job mit Autodelete. Nur der deklarierte Service-Pfad (§7.2 Ehrlichkeitsklausel) kann löschen — das geschieht nur durch expliziten fachlichen Vorgang (z.B. Archivierung, DSGVO-Anfrage) |
| ≥48h Offlinevorhaltung | IndexedDB-Outbox hat kein TTL. Einträge bleiben bis erfolgreicher Sync (status='synced') oder expliziter Nutzeraktion. Kein Timer-basiertes Aufräumen |
| Aufbewahrungsvertrag | Original im `scans`-Bucket ist unbefristet gültig. Löschung nur durch: (a) expliziten Admin-Befehl via Server-Action, (b) DSGVO-Löschanfrage — beide protokolliert in `events` mit `event_type='ORIGINAL_DELETED'` |

---

## 6. Konflikt und Idempotenz (Kernregeln 6–7)

| Aspekt | Lösung |
|---|---|
| **Idempotenz (6)** | `client_idempotency_key` (UUID, vom Client beim Fotografieren erzeugt). `UNIQUE(tenant_id, client_idempotency_key)` auf `scan_uploads` (tenant-scoped, nicht global). Doppelter Upload → DB-Fehler → Client erkennt: "schon da" → kein Doppelauftrag |
| **Kein Last-Writer-Wins (7) — feldbezogen** | Schutzgranularität ist **feldbezogen**, nicht datensatzweit (Kernregel 7, Befund E). `field_confidence` enthält pro Feld einen Eintrag `{ source, confidence, reviewed }`. Ein erneuter OCR-Lauf darf ein Feld nur überschreiben, wenn `reviewed = false` für dieses Feld. Felder mit `reviewed = true` sind gesperrt — unabhängig davon, ob andere Felder desselben Datensatzes noch unbestätigt sind. `reviewed_by`/`reviewed_at` markieren den Datensatz als „mindestens ein Feld manuell geprüft"; die feldgenaue Sperre liegt in `field_confidence[feld].reviewed`. |
| **Offline-Sync-Konflikt** | Outbox-Einträge werden in Reihenfolge synchronisiert. `client_idempotency_key` verhindert Duplikate. Bei Konflikt (gleicher Scan, verschiedene OCR-Ergebnisse): späterer OCR-Lauf erzeugt neuen `events`-Eintrag, überschreibt nur Felder mit `reviewed = false` |
| **Gleichzeitige Editoren** | Für Slice 1 nicht vorgesehen — ein Scan wird von genau einem Benutzer verarbeitet. Multi-User-Feldebene-Locking ist Gegenstand späterer Slices |

---

## 7. Tenant, RLS, Session, Rolle, Storage (Kernregel 16)

### 7.1 RLS-Vertrag Kern-Tabellen (`scan_uploads`, `orders`, `items`, `events`)

Alle Policies der Kerntabellen müssen dem strikten `USING` / `WITH CHECK` Trennungsmuster folgen, mit explizitem Drop der Alt-Policies. Zu droppen ist u.a. die belegte Alt-Policy `tenant_isolation_scan_uploads` (`FOR ALL` mit nur `USING`, Migration `20260621103346_add_ocr_provider.sql:3–14`) sowie Altbestände aus `0012_harden_rls.sql` (Remote-Ist SSG-00).

| Policy | Rolle | Operation | USING | WITH CHECK |
|---|---|---|---|---|
| `tenant_read_{table}` | `authenticated` | `SELECT` | `tenant_id = current_setting('app.tenant_id', true)` | — |
| `tenant_insert_{table}` | `authenticated` | `INSERT` | — | `tenant_id = current_setting('app.tenant_id', true)` |
| `tenant_update_{table}` | `authenticated` | `UPDATE` | `tenant_id = current_setting('app.tenant_id', true)` | `tenant_id = current_setting('app.tenant_id', true)` |
| `service_all_{table}` | `service_role` | `ALL` | `true` | `true` |
| *(kein DELETE für authenticated)* | `authenticated` | `DELETE` | **keine Policy** → RLS blockiert Delete | — |

> [!IMPORTANT]
> **Befund C korrigiert:** USING und WITH CHECK sind **getrennt** spezifiziert. INSERT hat nur WITH CHECK (schreibt neue Zeile — USING ist irrelevant, weil es keine bestehende Zeile gibt). UPDATE hat beides: USING prüft, ob die bestehende Zeile dem Tenant gehört; WITH CHECK verhindert, dass der Tenant-Wert auf einen fremden Tenant umgeschrieben wird (Row-Exfiltration). Der `current_setting`-Mechanismus gilt **nur hier** (DB-Tabellen, Zugriff innerhalb der App-DB-Transaktion, §7.3) — **nicht** für Storage (§7.2).

### 7.2 Storage-Policies (`storage.objects` für `scans`-Bucket) — NEU GEFASST (Direktive 37_ §B)

> [!IMPORTANT]
> **Warum neu:** `current_setting('app.tenant_id')` wirkt **NICHT** in `storage.objects`-Policies — die Storage-API läuft nicht in der App-DB-Transaktion mit `SET LOCAL`. Die V2.2-Policies wären ins Leere gelaufen. Storage-Policies müssen gegen die **authentifizierte Identität** prüfen.

**Prüfmuster (Soll):** Tenant-Bindung über `app_users`-Lookup gegen den ersten Pfadordner:

```sql
EXISTS (
  SELECT 1 FROM public.app_users au
  WHERE au.id = auth.uid()
    AND au.active = true
    AND au.tenant_id = (storage.foldername(name))[1]
)
```

Alternative (falls Lookup-Performance/Berechtigungen es erfordern, Entscheidung mit Beweis in B1): JWT-**App-Metadata**-Claim `(auth.jwt() -> 'app_metadata' ->> 'tenant_id') = (storage.foldername(name))[1]` — ausdrücklich **nicht** `raw_user_meta_data` (nutzerseitig manipulierbar).

**Kein `uploaded_by`-Bezug:** `storage.objects` hat keine Spalte `uploaded_by` (V2.2-Fehler in §3.6). Identitätsbindung ausschließlich über `auth.uid()`/`owner`/JWT + `app_users`-Lookup.

| Operation | Rolle | Policy (Soll) |
|---|---|---|
| `INSERT` | `authenticated` | `WITH CHECK: bucket_id = 'scans' AND <app_users-Lookup s.o.> AND au.role IN ('werkstatt','meister','buero','admin')` (Upload-Zuschnitt §7.4) |
| `SELECT` | `authenticated` | `USING: bucket_id = 'scans' AND <app_users-Lookup s.o.>` — **ausdrücklich alle sechs aktiven Rollen des eigenen Tenants**, inkl. `readonly` (Lesen ist deren Zweck) und `developer` (Lesen im eigenen Tenant erlaubt; nur Upload ist ausgeschlossen — 38_ Fund 2 geklärt) |
| `UPDATE` | `authenticated` | `USING + WITH CHECK: bucket_id = 'scans' AND <app_users-Lookup s.o.> AND au.role IN ('werkstatt','meister','buero','admin')` — getrennt von INSERT nötig für Upsert/Retry (S1 Schritt 2) |
| `DELETE` | — | **Keine Policy für `authenticated`.** DELETE-Negativtest zwingend (B1-AK6, Kernregel 4) |

INSERT, SELECT und UPDATE sind **getrennte Policies** — der Upsert-/Retry-Pfad der Saga S1 braucht alle drei; eine `FOR ALL`-Policy ist unzulässig (Trennungsmuster §7.1).

> [!IMPORTANT]
> **Ehrlichkeitsklausel Service-Role (Direktive 37_ §B.3):** Der heutige reale Uploadpfad nutzt einen **Service-Role-Client** (`scan-upload/route.ts:9–12`) — das ist ein **RLS-Bypass**: keine der obigen Policies greift dort. V2.3 entscheidet:
> 1. **Upload-/Download-Pfad (S1/S2):** Service-Role-Storage wird **abgeschafft**. Der Storage-Zugriff erfolgt im **Nutzer-JWT-Kontext** (Server-Client mit Session-Token), sodass die obigen Policies real greifen und testbar sind (Kernregel 16: E2E prüfbar).
> 2. **Verbleibender Service-Role-Pfad:** ausschließlich Systemlöschung/Archivierung nach §5. Dieser Pfad wird **ehrlich als RLS-Bypass deklariert** und als Application-Layer-Autorisierung abgesichert: serverseitige Rollen-Prüfung (`admin`), Tenant-Pfadvalidierung gegen §7.3, und ein **eigener Bypass-Test** (Nachweis, dass der Service-Pfad tenant-fremde Pfade und nicht-autorisierte Rollen ablehnt) — B1-AK7.
> Kein Vertragstext darf einen Service-Role-Pfad als „authenticated-Storage-RLS" ausgeben.

### 7.3 Session-Vertrag (tenant_id-Herkunft)

`SET LOCAL app.tenant_id = $tenant` wird ausschließlich innerhalb einer aktiven DB-Transaktion aufgerufen (V1-Finding #7). Die Server-Action (Next.js Route Handler / Server Action) setzt `app.tenant_id` am Anfang der Transaktion und nutzt denselben Connection-Handle. Geltungsbereich: nur DB-Tabellen-RLS (§7.1) — nicht Storage (§7.2).

> [!IMPORTANT]
> **Befund B korrigiert — Verbindliche Regel:** Der Wert für `app.tenant_id` wird **serverseitig aus dem verifizierten `app_users`-Record** der authentifizierten Session abgeleitet (`auth.uid()` → `app_users.tenant_id`, schema.ts:9–10). **Client-gelieferte `tenant_id`-Werte werden ignoriert/abgewiesen** — sie fließen nie in `SET LOCAL` oder in Query-Parameter ein. Ein Client-Payload mit `tenant_id`-Feld wird als Fehler behandelt, nicht stillschweigend übernommen. Dies ist die Kernabsicherung gegen Tenant-Spoofing (SSG-10(b), Kernregel 16, Muster T-006…T-008). **Anti-Vorbild ist Altpfad I-2:** dort stammt `tenantId` aus dem Scan-Datensatz (erfassung.actions.ts:590) statt aus der Session, ohne jede Autorisierungsprüfung.

### 7.4 Reales Rollenmodell (`app_users.role`) — korrigiert (Direktive 37_ §E)

Die echten Werte sind: `developer`, `admin`, `meister`, `buero`, `werkstatt`, `readonly` (schema.ts:13, Default `werkstatt`).

| Rolle | Berechtigung im Scan-Prozess |
|---|---|
| `werkstatt` | Foto aufnehmen, Scan hochladen (kein Review, keine Konvertierung) |
| `buero` / `meister` | Foto aufnehmen, Scan hochladen, OCR auslösen, unsichere Felder reviewen, Auftragskonvertierung, Routenzuweisung |
| `admin` | Vollzugriff inkl. Fehlerkorrektur und Upload |
| `developer` | Technik-/Wartungsrolle: App-Vollzugriff auf Nicht-Capture-Funktionen; **Lesen/Download von Originalen im eigenen Tenant erlaubt** (Storage-SELECT, §7.2); **kein Capture-Upload-Recht** in der Storage-INSERT-Policy (arbeitet nicht im operativen Wareneingang; Wartungszugriff nur über den deklarierten Service-Pfad §7.2 mit Bypass-Test) |
| `readonly` | **Nur lesen. KEIN Capture-, Upload- oder sonstiges Schreibrecht** — alles andere widerspräche dem Rollennamen (Kernregel 16). V2.2 hatte `readonly` fälschlich Upload-Recht gegeben; das ist korrigiert |
| `service_role` | System-Aktionen, Löschen von Originalen — nur deklarierter Bypass-Pfad (§7.2) |

**Zuschnitt-Begründung Upload (`werkstatt`/`meister`/`buero`/`admin`):** Upload gehört zu den Rollen, die physisch Ware annehmen (`werkstatt`), den Wareneingang fachlich führen (`meister`, `buero`) oder korrigierend eingreifen (`admin`). `readonly` ist per Definition Leserolle; `developer` ist Technikrolle ohne operative Wareneingangsaufgabe.

**Rollen-Negativtest-Pflicht (Direktive 37_ §E):** **Jede** Server-Action des Slice-1-Pfads (`uploadScan`, `runOcrOnScan`, `convertScanToOrder`-Ersatz, `startProduction`, Korrektur-Actions) erhält als Akzeptanzkriterium einen Negativtest über **alle sechs realen Rollenwerte** — je Rolle wird belegt: erlaubte Aktion gelingt, nicht erlaubte Aktion wird mit Fehler abgewiesen (B2-AK8, B3-AK6, B4-AK7, B6-AK6). Keine clientseitige Rollenentscheidung für sicherheitsrelevante Aktionen.

---

## 8. Fachlogik in SQL-Views (Kernregel 13)

### 8.1 `v_scan_pipeline` (NEU)

```sql
-- Definiert als VIEW, nicht als React-Logik
-- Zeigt alle Scans mit ihrem Verarbeitungsstatus, zugeordnetem Kunden und Auftrag
SELECT
  su.id, su.status, su.review_required,
  su.field_confidence, su.original_hash,
  su.uploaded_at, su.reviewed_at,
  c.name AS customer_name,
  o.order_number,
  su.conversion_order_id
FROM scan_uploads su
LEFT JOIN orders o ON o.id = su.conversion_order_id
LEFT JOIN customers c ON c.id = COALESCE(su.linked_customer_id, o.customer_id)
WHERE su.tenant_id = current_setting('app.tenant_id', true)
```

(Spaltenbelege: `customers.name` schema.ts:31, `orders.order_number` schema.ts:85, `orders.customer_id` schema.ts:86; `su.review_required`/`su.conversion_order_id` sind B1-Neuspalten §3.1.)

> [!NOTE]
> **38_ Fund 3 geklärt:** Der Kunden-Join läuft über `COALESCE(su.linked_customer_id, o.customer_id)` — bei rein konvertierten Scans ohne manuelle Zuordnung kommt der Kunde aus dem in T3 gebundenen `orders.customer_id`, `customer_name` bleibt nicht fälschlich leer. Verifikation gegen Testdaten in B4-AK3 (SSG-13).

### 8.2 `v_scan_events_timeline` (NEU)

```sql
-- Verknüpft Scan-bezogene Ereignisse mit Scans und nachgelagerten Aufträgen.
-- LEFT JOIN statt INNER JOIN: Events ohne payload.scan_upload_id
-- (z.B. STATION_STARTED, das nur order_id hat) werden NICHT ausgeschlossen,
-- sondern mit scan_upload_id = NULL angezeigt (Befund F).
SELECT
  se.id, se.event_type, se.created_at AS timestamp, se.payload,
  su.id AS scan_upload_id,
  COALESCE(su.conversion_order_id, se.order_id) AS resolved_order_id
FROM events se
LEFT JOIN scan_uploads su ON su.id = (se.payload->>'scan_upload_id')
WHERE se.tenant_id = current_setting('app.tenant_id', true)
  AND (se.payload->>'scan_upload_id' IS NOT NULL OR se.order_id IS NOT NULL)
```

> [!NOTE]
> **SQL-Spaltenwahrheit (Direktive 37_ §A):** In SQL gilt der SQL-Spaltenname `created_at` (schema.ts:169: `timestamp("created_at")`), nicht das Drizzle-Property `createdAt`. V2.2 hatte `se.createdAt` geschrieben — die View wäre fehlgeschlagen. Gleiches Prinzip für alle Views: `event_type` (schema.ts:161), `payload` (schema.ts:164), `order_id` (schema.ts:159), `tenant_id` (schema.ts:158).

**Performance-Hinweis (Befund F):** Ein funktionaler Index auf `(payload->>'scan_upload_id')` wird in B4 angelegt, um den LEFT JOIN effizient zu machen:
```sql
CREATE INDEX IF NOT EXISTS idx_events_scan_upload_id
  ON events ((payload->>'scan_upload_id'))
  WHERE payload->>'scan_upload_id' IS NOT NULL;
```

> [!NOTE]
> Diese Views ersetzen **nicht** `getOperationalOrders()` oder andere bestehende globale Queries (Kernregel 14). Sie sind neue, dedizierte Views für den Scan-Pipeline-Pfad. Die bestehenden Konsumenten bleiben unberührt. Die Views laufen gegen die kanonische Tabelle `events`/`payload` — nie gegen die Alt-Wahrheit `status_events`/`metadata` (§2a I-4).

---

## 9. Missionsaufteilung (Lehre aus V1: #17)

Jede Bau-Mission (B1–B7) ist einzeln baubar, prüfbar und abnehmbar. Reihenfolge ist strikt sequenziell — B(n+1) darf erst nach PASS von B(n) beginnen. Die Missionen testen in Bx immer nur das, was auch in Bx gebaut wurde.

### B1: Daten-/Storage-/Sicherheitsfundament

**Scope:**
- Migration: `scan_uploads` um neue Spalten erweitern (§3.1); `events.order_id` auf NULLABLE — **Drizzle (schema.ts:159) UND Remote-Migration** (§3.2)
- Drizzle-Schema-Lücken schließen: `ocrProvider`-Symbol in `scanUploads` ergänzen (Spalte existiert nur als Migration `20260621103346:1`, §3.1); Drizzle-FKs für `linked_order_id`/`linked_customer_id` gegen Remote-Ist abgleichen (Migration `20260621103338`, SSG-00)
- RLS-Policies: Drop alter Policies (inkl. `tenant_isolation_scan_uploads`, `20260621103346:3–14`). `scan_uploads`, `orders`, `items`, `events` granular aufteilen — SELECT, INSERT, UPDATE getrennt mit USING/WITH CHECK (§7.1)
- Storage-Policies **neu nach §7.2**: `auth.uid()`/`app_users`-Lookup (bzw. JWT-app_metadata) gegen Ordnername — **nicht** `current_setting`; INSERT/SELECT/UPDATE getrennt; kein DELETE für `authenticated`
- Service-Role-Ehrlichkeit umsetzen: Upload-Pfad auf Nutzer-JWT-Kontext, verbleibender Service-Pfad deklariert + Bypass-Test (§7.2)
- tenant_id-Herkunft serverseitig absichern (§7.3) und reale Rollen verwenden (§7.4)
- Ist-Inventar Remote: `status_events`-Altbestand (0001:83–101, inkl. `customer_id`-Divergenz 0001:88 — 38_ Fund 4) und tatsächlichen Remote-Policy-/FK-/Spaltenstand via `information_schema`/`pg_policies` dokumentieren (SSG-00, §2a I-4)
- Ist-Inventar Parallelschreiber: I-5 (`/scan`-Capture-Kette) und I-6 (`uploadOrderPhotoRecord`, Inserts auf `scan_uploads`/`events` mit hartkodiertem Tenant, orderPhoto.actions.ts:22–39) im Datenquellen-/Konsumenten-Inventar erfassen (38_ Fund 1); Härtung/Ersetzung erfolgt in B2/B3

**Akzeptanzkriterien:**

| # | Kriterium | Beweisform (SSG-Referenz) |
|---|---|---|
| B1-AK1 | Migration läuft fehlerfrei auf Remote-DB | `supabase db push` Rohlog mit EXIT=0 (SSG-00) |
| B1-AK2 | `client_idempotency_key`: `UNIQUE(tenant_id, client_idempotency_key)` blockiert Duplikat | SQL-INSERT-Test mit doppeltem Key → Fehler (SSG-06) |
| B1-AK3 | `events.order_id` ist NULLABLE — in **beiden** Wahrheiten | (a) Drizzle: Diff schema.ts:159 ohne `.notNull()` + `npx tsc --noEmit` EXIT=0; (b) Remote: `SELECT is_nullable FROM information_schema.columns WHERE table_name='events' AND column_name='order_id'` → `YES` (SSG-00) |
| B1-AK4 | FK-Validierung auf Remote-DB | `information_schema`-Prüfung für referenzielle Integrität von `scan_uploads` (inkl. Ist-Stand `linked_*`-FKs aus `20260621103338`), remote zu verifizieren (SSG-00) |
| B1-AK5 | Rollen- und Tenant-Identität | `tenant_id` wird serverseitig aus `app_users` abgeleitet (schema.ts:9–10). Negativtest mit manipulierter `tenant_id` via Action (SSG-10b) |
| B1-AK6 | Cross-Tenant-Negativtests für RLS & Storage inkl. DELETE-Verbot | SQL/Storage-Tests mit fremdem Tenant/Rollen für `scan_uploads`, `orders`, `items`, `events` und `storage.objects` (INSERT/SELECT/UPDATE je getrennt, gemäß §7.2). Insert/Update/Select/Delete zwingend mit Fehlern. Speziell DELETE-Verbot für `authenticated` wird geprüft (SSG-14) |
| B1-AK7 | Service-Role-Bypass-Test | Der deklarierte Service-Pfad (§7.2) lehnt tenant-fremde Pfade und nicht-autorisierte Rollen nach Application-Layer-Prüfung ab; Nachweis als Rohlog. Es existiert kein weiterer Service-Role-Storage-Zugriff im Slice-1-Pfad (Inventar) (SSG-14, SSG-17) |

---

### B2: Online-Capture und OCR/KI-Review

**Scope:**
- Server-Action: `uploadScan()` — Saga S1 (§4.1): DB-Anker → Storage-Upload (Nutzer-JWT-Kontext) → DB-Abschluss
- Server-Action: `runOcrOnScan()` — Saga S2 (§4.2): Storage-Download + OCR → DB-Persistierung
- **Ersetzt Altpfad I-1** (`src/app/api/erfassung/scan-upload/route.ts`): Route deaktivieren/ersetzen; Befundliste §2a I-1(a–f) muss vollständig behoben sein; Konsumenten-Inventar der alten Route (wer ruft sie auf?) und Umstellung aller Aufrufer
- **Ersetzt Altpfad I-5 (Capture-Teil)**: `/scan`-Flow (`CameraCapture`, `processImage`) auf S1/S2 umstellen — kein OCR auf ungesichertem In-Memory-Base64 mehr (CameraCapture.tsx:73/84/102), kein stiller OCR-Fallback als reguläres Ergebnis (ocr.actions.ts:11), Mock-Pfad `processImageWithAI`/`simulateScan` (ocr.actions.ts:16–19) aus dem Prod-Pfad entfernen (Kernregel 17)
- **Härtet Altpfad I-6**: Foto-zu-Auftrag-Anhang (`uploadOrderPhotoRecord`/`OrderOverlay`) auf den S1-Vertrag: Session-Tenant statt Hardcode (orderPhoto.actions.ts:23/34), Storage-Pfad statt `getPublicUrl` (OrderOverlay.tsx:438/442), serverseitiger Upload gemäß §7.2 statt clientseitigem Anti-Muster (OrderOverlay.tsx:430)
- **Härtet Altpfad I-3** (`supabase/functions/scan-analyze/index.ts`): OCR nur auf gesichertem Original aus Storage; `base64_data`/freie `file_url` deaktivieren oder begründet einschränken (§4.2), mit Negativtest
- Feldbezogene Konfidenz in `field_confidence` (Kernregel 9), mit `reviewed`-Flag pro Feld (§6)
- `review_required`-Flag setzen bei Konfidenz < Schwellwert (Schwellwert = Hypothese, Kernregel 10: konfigurierbar, Default 0.7, keine produktive Schwelle ohne Pilotkalibrierung)
- Kein Mock, kein Math.random, kein Demo-Fallback, keine hartkodierte Konfidenz im Prod-Pfad (Kernregel 17; Anti-Vorbild I-1b/I-1e)
- Saga-Retry bei Abbruch zwischen Schritten via Storage-Upsert oder Hash/Exists-Branch

**Akzeptanzkriterien:**

| # | Kriterium | Beweisform |
|---|---|---|
| B2-AK1 | Upload erzeugt `scan_uploads`-Eintrag + Storage-Objekt + `SCAN_UPLOADED`-Event in korrekter Saga-Reihenfolge | DB-Query + Storage-Listing (SSG-06, SSG-07) |
| B2-AK2 | OCR läuft nur auf status='secured' — Aufruf auf status='new' oder 'uploading' wird abgelehnt | Server-Action-Fehlertest (SSG-07) |
| B2-AK3 | `field_confidence` enthält pro extrahiertes Feld `{ source, confidence, reviewed }` | DB-Query nach OCR (SSG-11) |
| B2-AK4 | `review_required=true` bei mindestens einem Feld < Schwellwert | DB-Query (SSG-11) |
| B2-AK5 | Vollständiges Datenquellen-Inventar des Produktionspfads | Statt `grep` allein, explizites Quellen-Inventar (SSG-11, SSG-17). Keine Mocks erlaubt. |
| B2-AK6 | `original_hash` stimmt mit SHA-256 des Storage-Objekts überein | Hash-Vergleich Storage ↔ DB (SSG-07) |
| B2-AK7 | Crash nach Storage-Upload, vor DB-Abschluss: Retry setzt status auf 'secured' ohne Duplikat | Provozierter Abbruch + Retry-Test mit Storage-Upsert oder Hash/Exists-Branch (SSG-07, Befund A) |
| B2-AK8 | Rollen-Negativtest `uploadScan`/`runOcrOnScan` über alle sechs realen Rollen (schema.ts:13) | Je Rolle: erlaubt → Erfolg, nicht erlaubt (`readonly` Upload; `werkstatt`/`readonly` OCR; `developer` Upload) → Fehler (SSG-14, §7.4) |
| B2-AK9 | Altpfad I-1 ersetzt: keine `Date.now()`/`Math.random()`-Dateinamen, kein `getPublicUrl` in `file_url`, kein OCR vor Sicherung, keine hartkodierte Konfidenz; alte Route nicht mehr erreichbar/aufgerufen | Datei-/Konsumenten-Inventar + Laufzeittest gegen alte Route (SSG-11, SSG-17) |
| B2-AK10 | Altpfad I-3 gehärtet: OCR-Funktion lehnt `base64_data` und bucket-fremde `file_url` ab | Negativtest gegen `scan-analyze` (SSG-14) |
| B2-AK11 | Altpfad I-5 (Capture-Teil) ersetzt: kein erreichbarer Capture-Pfad ohne Original-Sicherung mehr; `/scan` nutzt den kanonischen Vertrag oder ist deaktiviert; kein stiller OCR-Fallback, kein Mock-Pfad im Prod-Code (ocr.actions.ts:11, 16–19) | Konsumenten-Inventar + Laufzeittest gegen `/scan` (SSG-11, SSG-17, 38_ Fund 1) |
| B2-AK12 | Altpfad I-6 gehärtet: `uploadOrderPhotoRecord`/`OrderOverlay` nutzen Session-Tenant (§7.3) und Storage-Pfad — kein hartkodierter Tenant (orderPhoto.actions.ts:23/34), kein `getPublicUrl` in `file_url` (OrderOverlay.tsx:438/442), kein clientseitiger `Date.now()`-Upload (OrderOverlay.tsx:430) | Code-/DB-Nachweis + Negativtest (SSG-14, 38_ Fund 1) |

---

### B3: Transaktionale Auftragserstellung

**Scope:**
- **Ersetzt Altpfad I-2 atomar:** Die bestehende Action `convertScanToOrder` (`src/app/actions/erfassung.actions.ts:578–680`) wird durch die T3-Implementierung (§4.3) **in place ersetzt oder nachweislich deaktiviert**. Es entsteht **kein zweiter Parallelpfad** (Direktive 37_ §C/§D). Befundliste §2a I-2(a–e) muss vollständig behoben sein: `db.transaction` statt Einzelwrites, `events`-Insert, `conversion_order_id`/`conversion_event_id`, Autorisierungs-/Rollenprüfung, `tenant_id` aus Session statt aus Scan-Datensatz
- **Ersetzt Altpfad I-5 (Auftrags-Teil):** `createOrderFromScan` (`orders.actions.ts:376–498`, Aufrufer `scan/page.tsx:45`) wird auf T3 umgestellt oder deaktiviert — nach B3 existiert genau EIN transaktionaler Auftragserstellungspfad aus Scans (Kernregel 1/11, 38_ Fund 1). Befundliste §2a I-5(e): kein `source_ref`-loser Scan-Auftrag, keine Dummy-Adressen-Kundenanlage (orders.actions.ts:428–432), Kunde+Auftrag in EINER Transaktionsgrenze
- Atomare Erzeugung von `orders` + `items` + Update `scan_uploads` (inkl. `conversion_event_id`) + `WARENEINGANG`-Event + Kunden-Matching in EINER Grenze
- Feldbezogenes Update: manuell bestätigte Felder (`field_confidence[feld].reviewed = true`) werden von erneutem OCR nie überschrieben (Kernregel 7, §6)

**Akzeptanzkriterien:**

| # | Kriterium | Beweisform |
|---|---|---|
| B3-AK1 | Erfolgreiche Konvertierung erzeugt Kunde/Matching + Auftrag + Teilgruppe (Items) + Event atomisch in EINER Transaktion | Rollback-Beweis: Bei Fehler wird keines dieser Objekte angelegt (SSG-07, Kernregel 11) |
| B3-AK2 | Fehler in Schritt 5/6 rollt ALLES zurück: Customer(-Match/-Neuanlage), Order, Items, Event, `scan_uploads.conversion_*`/`status`, `orders.source`/`source_ref`/`status`/`intake_date` | Provozierter Fehler → keines der Objekte existiert, kein halb angelegter Kunde/Auftrag möglich (SSG-07, Direktive 37_ §D) |
| B3-AK3 | Doppelaufruf mit gleichem `scan_upload_id` erzeugt keinen zweiten Auftrag | Idempotenz-Test: `conversion_order_id` schon gesetzt → Abbruch (SSG-06) |
| B3-AK4 | `orders.source='scan'`, `orders.source_ref=scan_upload_id` (schema.ts:109–110) | DB-Query (SSG-11) |
| B3-AK5 | Manuell bestätigtes Einzelfeld (`reviewed=true`) wird von erneutem OCR-Lauf nicht überschrieben; unbestätigte Felder desselben Datensatzes werden aktualisiert | Sequenztest: Review Feld A → OCR → Feld A unverändert, Feld B aktualisiert (SSG-07, Befund E) |
| B3-AK6 | Rollen-Negativtest Konvertierung über alle sechs realen Rollen (schema.ts:13) | `buero`/`meister`/`admin` → Erfolg; `werkstatt`/`readonly`/`developer` → Fehler (SSG-14, §7.4) |
| B3-AK7 | Kein Parallelpfad: **beide** Alt-Auftragspfade — `convertScanToOrder` (I-2) UND `createOrderFromScan` (I-5, inkl. Aufrufer `scan/page.tsx:45`) — sind ersetzt/deaktiviert; kein aktiver Konsument ruft nicht-transaktionale Auftragslogik auf | Konsumenten-Inventar aller Aufrufer beider Pfade + Laufzeitnachweis (SSG-11, SSG-17, 38_ Fund 1) |

---

### B4: Routebasierter Produktionsstart

**Scope:**
- Server-Action: `startProduction()` — Transaktion T4 (§4.4)
- Startstation aus `company_settings.workflow_templates[route][0]` — kein Hardcode. **Zugriffsweg herstellen (§3.5):** Drizzle-Symbol für `workflow_templates` ergänzen ODER lesenden SQL-Zugriff definieren (Spalte hat kein Drizzle-Symbol, nur Migration `20260621000000:104–113`; remote SSG-00)
- SQL-View `v_scan_pipeline` (§8.1)
- SQL-View `v_scan_events_timeline` (§8.2) — SQL-Spaltennamen (`created_at`), nie Drizzle-Properties
- Funktionaler Index auf `(payload->>'scan_upload_id')` (§8.2)
- Bestehende `getOperationalOrders()` bleibt unverändert (Kernregel 14)
- Negativbeleg Alt-Wahrheit: keine View/Query des Slice-1-Pfads läuft gegen `status_events`/`metadata` (§2a I-4)

**Akzeptanzkriterien:**

| # | Kriterium | Beweisform |
|---|---|---|
| B4-AK1 | Startstation = `workflow_templates[route][0]`, nie hardcoded | DB-Query nach `STATION_STARTED`-Event → `station_slug` aus Route (SSG-12) |
| B4-AK2 | Andere Route → andere Startstation | Test mit `bruenieren` vs. `chrom_hochglanz` (Routen belegt: Migration `20260621000000:107–113`; Remote-Inhalt SSG-00) (SSG-12) |
| B4-AK3 | `v_scan_pipeline`-View liefert korrekte Daten | SQL-Abfrage gegen Testdaten (SSG-13) |
| B4-AK4 | `v_scan_events_timeline` verknüpft Vor-Auftrags-Events mit Auftrag via LEFT JOIN | SQL-Query: Events vor Auftrag → trotzdem dem Auftrag zugeordnet via JOIN; STATION_STARTED ohne scan_upload_id erscheint mit scan_upload_id=NULL (SSG-13, Befund F) |
| B4-AK5 | Negativ-Inventar paralleler TS/Drizzle-Fachlogik | Konsumentenverweis + Nachweis, dass keine parallele TS-Fachberechnung existiert (SSG-16). |
| B4-AK6 | `getOperationalOrders()` liefert unveränderte Ergebnisse | Vorher/Nachher-Vergleich derselben Query (SSG-14, Kernregel 14) |
| B4-AK7 | Rollen-Negativtest `startProduction` über alle sechs realen Rollen (schema.ts:13) | `buero`/`meister`/`admin` → Erfolg; `werkstatt`/`readonly`/`developer` → Fehler (SSG-14, §7.4) |

---

### B5: Offline-Outbox und Reconnect

**Scope:**
- IndexedDB-basierter Outbox-Store (kein localStorage, kein Base64, Kernregel 3)
- Blob-Speicherung in IndexedDB bis Sync
- Kein TTL, kein Autodelete (Kernregeln 4, 5)
- Bei Reconnect: Outbox → S1 → S2 in Reihenfolge (Saga-Modell, §4.1/4.2)
- `client_idempotency_key` verhindert Duplikate bei Retry (Kernregel 6)
- Reload/Crash: IndexedDB überlebt → kein Originalverlust

**Akzeptanzkriterien:**

| # | Kriterium | Beweisform |
|---|---|---|
| B5-AK1 | Foto offline aufgenommen → in IndexedDB als Blob gespeichert | rohlogfähiger IndexedDB-Test anstatt nur visuelle DevTools-Sichtung (SSG-07). |
| B5-AK2 | Keine Base64-Strings in localStorage | `localStorage`-Dump → kein Image-Blob (SSG-03, Kernregel 3) |
| B5-AK3 | Reconnect → automatischer Upload → scan_uploads + Storage-Objekt | Netzwerk-Toggle-Test (SSG-07) |
| B5-AK4 | Doppelter Reconnect → kein zweiter Eintrag | `client_idempotency_key`-Beweis: DB hat genau einen Eintrag (SSG-06) |
| B5-AK5 | Browser-Reload während offline → IndexedDB-Daten überleben | Reload → Outbox enthält Eintrag (SSG-07) |
| B5-AK6 | Offline-Eintrag überlebt ≥72h ohne Autodelete; überlebt App-Neustart und Browser-Neustart | Methodenprotokoll: (1) Eintrag anlegen, (2) Browser schließen + Gerät neustarten, (3) App öffnen → Eintrag vorhanden. Alterungsbeweis mit Hash/Originalidentität: IndexedDB-Zeitstempel ≥72h in der Vergangenheit, identischer Blob. (Befund F, SSG-08 — Sub-Zitat „(c)" entfernt, da im V5-Gate nicht als eigene Sub-Definition belegt; 38_ Fund 5) |

---

### B6: Korrektur und Undo

**Scope:**
- Scan-Review: Felder manuell korrigieren (status → `reviewed`)
- Auftragszuordnung ändern (solange status < `in_produktion`)
- Scan verwerfen (status → `discarded`, Original bleibt in Storage)
- Abhängigkeitsbewusstes Undo (Kernregel 15): Auftrag mit aktiver Produktion → Korrektur blockiert
- Jede Korrektur erzeugt `events`-Eintrag

**Akzeptanzkriterien:**

| # | Kriterium | Beweisform |
|---|---|---|
| B6-AK1 | Feldkorrektur überschreibt KI-Wert, setzt `reviewed_by` und `field_confidence[feld].reviewed=true` | DB-Query (SSG-07) |
| B6-AK2 | Auftragszuordnung änderbar bei status='wareneingang' | Erfolgreicher Update (SSG-07) |
| B6-AK3 | Auftragszuordnung NICHT änderbar bei status='in_produktion' | Fehlerantwort bei Versuch (SSG-15d) |
| B6-AK4 | Scan-Verwerfen setzt status='discarded', Original bleibt im Storage | DB + Storage-Prüfung (SSG-07, Kernregel 4) |
| B6-AK5 | Jede Korrektur erzeugt `events`-Eintrag | DB-Query (SSG-07) |
| B6-AK6 | Rollen-Negativtest Korrektur-Actions über alle sechs realen Rollen (schema.ts:13) | `buero`/`meister`/`admin` → Erfolg; `werkstatt`/`readonly`/`developer` → Fehler (SSG-14, §7.4) |

---

### B7: Unabhängiger E2E-Verifier

**Scope:**
- End-to-End-Laufzeitnachweis: Foto → DB → Storage → OCR → Review → Auftrag → Produktion → richtige Karte
- Kein Unit-Test, sondern tatsächliche Ausführung gegen Remote-DB/Storage
- Hash-Integrität: SHA-256 des Originals in DB = SHA-256 der Storage-Datei
- Tenant-Isolation: ein Test mit falschem Tenant → kein Zugriff
- Performance: gesamter Pfad < 10s (Online) — als Hypothese, nicht als harte Gate-Bedingung

**Akzeptanzkriterien:**

| # | Kriterium | Beweisform |
|---|---|---|
| B7-AK1 | Foto → scan_uploads → Storage → OCR → Review → Auftrag → STATION_STARTED: alle Objekte konsistent verknüpft | DB-Queries über die gesamte Kette (SSG-07) |
| B7-AK2 | SHA-256 in DB = SHA-256 der Datei im Storage | Berechneter Hash-Vergleich (SSG-07) |
| B7-AK3 | Falscher Tenant → kein SELECT auf scan_uploads, kein Storage-Download, kein Cross-Tenant Zugriff | Negativtest über Views, orders, events etc. (SSG-14, SSG-16) |
| B7-AK4 | Offline-Cycle: Foto offline → Reconnect → gesamter Pfad durchlaufen | Netzwerk-Toggle-E2E (SSG-07) |
| B7-AK5 | Vollständiges Datenquellen-Inventar des Produktionspfads | End-to-End Nachweis statt `grep` (SSG-11, SSG-17). Keine Mock-Provider oder Fallbacks. |

---

## 10. Acht-Fragen-Karte (Pflicht aus 01_PRODUCT_AND_SLICE_CONTRACT.md)

Jede Arbeits-/Entscheidungskarte im Slice-1-Pfad muss beantworten:

| Frage | Antwort im Slice-1-Pfad |
|---|---|
| 1. Warum entstand sie? | Foto/Scan wurde aufgenommen; KI hat Daten extrahiert; Review war erforderlich; Wareneingang erzeugt Karte |
| 2. Welches Objekt ist betroffen? | `scan_uploads` → `orders` → `items` |
| 3. Was ist belegt und aus welcher Quelle? | `field_confidence` zeigt Quelle (OCR, manuell, Match), Konfidenz und Review-Status pro Feld |
| 4. Was fehlt? | `review_required=true` → Felder mit Konfidenz < Schwelle anzeigen |
| 5. Welche konkrete Handlung schlägt die App vor? | Bestätigen, Korrigieren, Zuordnen, Verwerfen — kontextabhängig |
| 6. Wer darf handeln? | `app_users.role` (schema.ts:13) gemäß Matrix §7.4 — `readonly` nie schreibend |
| 7. Welche DB-/Eventwirkung folgt? | Exakt die Sagas S1/S2 und Transaktionen T3/T4 (§4) |
| 8. Wohin kehrt der Vorgang zurück? | Nach Wareneingang → Produktionskarte. Nach Review → Zuordnung. Nach Verwerfen → Scan-Übersicht |

---

## 11. Bewusst an spätere Missionen/Slices delegiert

| Thema | Begründung |
|---|---|
| **UI-/Interaktionsdesign** | Claude Design erstellt den UI-Vertrag NACH Akzeptanz dieses Implementierungsvertrags (04_CURRENT_GATE_AND_DESIGN_SEQUENCE.md) |
| **Mehrfach-Teilgruppen pro Scan** | Slice 1 behandelt 1 Scan → 1 Auftrag. Mehrere Teilgruppen aus einem Dokument ist Slice-2-Scope |
| **Batch-Import** | Stapelverarbeitung mehrerer Scans gleichzeitig ist kein Slice-1-Feature |
| **Konfidenz-Pilotkalibrierung** | Default 0.7 ist eine Hypothese (Kernregel 10). Pilotkalibrierung erfolgt nach erstem Produktiveinsatz |
| **Globale Query-Ablösung** | `getOperationalOrders()` und andere globale Queries bleiben unverändert (Kernregel 14). Eine Ablösung erfordert Konsumentenbeweis — das ist ein separates Projekt |
| **Archivierungs-/DSGVO-Workflow** | Aufbewahrungsvertrag definiert, wann gelöscht werden DARF; der tatsächliche Lösch-Workflow (mit Admin-UI, Protokollierung) ist kein Slice-1-Feature |
| **Gleichzeitige Editoren / Feldebene-Locking** | Slice 1 geht von einem Bearbeiter pro Scan aus. Multi-User-Editing ist späterer Scope |
| **Navigation/Sidebar** | Wird nicht verändert (Kernregel 18). Scan-Pipeline ist über bestehende Routen erreichbar |
| **Korrektur nach Produktionsstart** | B6 blockiert Korrektur nach `in_produktion`. Ein differenzierterer Korrekturpfad (z.B. Storno mit Neuerstellung) ist späterer Scope |
| **CI/CD-Pipeline** | Automatisierte Tests in einer CI-Pipeline sind wünschenswert, aber nicht Slice-1-Scope. B7 ist ein manuell durchgeführter E2E-Verifier |
| **Ablösung Legacy-Alias `statusEvents`** | Der Alias `statusEvents = events` (schema.ts:235) und die Alt-Migration 0001 werden in B1/B4 inventarisiert und vom Slice-1-Pfad ferngehalten (§2a I-4); die vollständige Alias-/Alt-Tabellen-Bereinigung ist eigener späterer Scope |

---

## 12. Vertragsstatus

```
CONTRACT_STATUS: PROPOSAL_ACCEPTED
CONTRACT_VERSION: V2.4
PROPOSAL_AUTHOR: Claude Opus 4.6 (Thinking) / Antigravity
PROPOSAL_DATE: 2026-07-05
REVISION_DATE: 2026-07-06
ACCEPTANCE_BASIS: 38_M6_VERTRAG_FINALE_FREMDPRUEFUNG_V23.md — CONTRACT_VERDICT_V24: PASS (2026-07-06; F-38-01 geschlossen, keine Kategorie-1-Funde; Kat.-2-Restpunkte: F-38-04 → B1, F-38-03-Rest → B4-AK3); Statuswechsel gemäß Gate-Steuerungsvorgabe des Auftraggebers vom 2026-07-06
NEXT: Übernahme in den autoritativen Baum (00_AUTORITATIV) + Claude-Design-Gate gemäß 04_CURRENT_GATE_AND_DESIGN_SEQUENCE.md
```

Bindungsstand:
1. ✅ Unabhängige Prüfung gegen TRUTH und REDTEAM: Bericht 38_ (Erstprüfung V2.3 FAIL → Korrektur V2.4 → Nachprüfung `CONTRACT_VERDICT_V24: PASS`)
2. ✅ Akzeptanz gemäß Gate-Steuerungsvorgabe des Auftraggebers („bei PASS auf PROPOSAL_ACCEPTED setzen", 2026-07-06)
3. ⏳ Übernahme in den autoritativen Baum (00_AUTORITATIV) steht aus — erst damit ist der Vertrag projektweit bindend

---

## 13. Änderungsprotokoll V2.1 → V2.2

Anlass: Fremdprüfung `_agentur_reports/35_M6_VERTRAG_FREMDPRUEFUNG.md` (CONTRACT_VERDICT: FAIL).

| Befund | Umsetzung in V2.2 (Code-Beleg) |
|---|---|
| 1. RLS/Storage neu fassen | Policies für `scan_uploads`, `orders`, `items`, `events` und `storage.objects` trennen strikt USING und WITH CHECK. Real existierende Rollen (`app_users.role`) wie `meister`, `buero`, `werkstatt` aus `schema.ts:13` referenziert. Storage-DELETE-Verbot und Cross-Tenant-Negativtests sind B1-AK6. |
| 2. Ereignis-/Schema-Wahrheit klären | Kanonische Tabelle ist `events` (`schema.ts:156`), nicht `status_events`. Spalte ist `payload`. `events.order_id` (`schema.ts:159`) ist NOT NULL und muss in B1 per Migration auf NULLABLE gesetzt (B1-AK3) und remote per `information_schema` validiert werden. Alle Referenzen im Vertrag wurden auf das echte Schema gezogen. |
| 3. Kernregel-11-Transaktion erweitern | Transaktion T3 (§4.3) wurde erweitert um Kunden-Matching/-Neuanlage (Customer), Auftrag, echte Teilgruppe (hier Mapping auf existierende `items` in Slice 1) und Vor-Auftrags-Ereignisse in EINER Grenze. Rollback-Beweis in B3-AK1 verankert. |
| 4. SSG-11/16-Beweisformen ersetzen | `grep`-only Nachweise entfernt. Vollständiges Datenquellen-Inventar für B2 (B2-AK5) und B7 (B7-AK5) nach SSG-11 ergänzt. B4 (B4-AK5) verlangt nun Konsumentenverweis und Negativ-Inventar paralleler TS-Fachlogik nach SSG-16. |
| 5. Missionen neu schneiden | B1 testet keine Server Actions mehr. Upload-Retry in S1 (§4.1 / B2-AK7) spezifiziert technisch ein Upsert oder Hash/Exists-Branch. B5-AK1 (IndexedDB) verlangt rohlogfähigen Nachweis statt visueller Sichtung. B5-AK6 integriert Hash-Identitätsbeweis. Idempotenz ist in 3.1 als `UNIQUE(tenant_id, client_idempotency_key)` gesichert. |

---

## 14. Änderungsprotokoll V2.2 → V2.3

Anlass: Fremdprüfung `36_M6_VERTRAG_FREMDPRUEFUNG_V22.md` + konsolidierte Korrekturdirektive `37_M6_KORREKTUR_DIREKTIVE_V23.md`. Alle Belege gegen `src/db/schema.ts` (Twin) bzw. genannte Quelldateien verifiziert.

| # | Direktive-Punkt | Umsetzung in V2.3 | Code-Beleg |
|---|---|---|---|
| A1 | `orders.received_at` als bestehend behauptet | Aus §3.3 und T3 Schritt 6 (§4.3) **entfernt**; nur noch `intake_date`. Entscheidung „entfernen statt neu anlegen" dokumentiert (§3.3), da `intake_date` die Semantik abdeckt und kein Schema-Wachstum nötig ist | `orders` = schema.ts:82–116, enthält **kein** `received_at`; `intake_date` = schema.ts:103; `source`/`source_ref` = schema.ts:109–110 |
| A2 | View nutzt `se.createdAt` statt SQL-Spalte | §8.2 auf `se.created_at` korrigiert; Grundsatzregel „SQL-Spaltenname ≠ Drizzle-Property" als Hinweisblock in §8.2 und B4-Scope verankert | `events.createdAt` mappt auf SQL `created_at` = schema.ts:169 |
| A3 | `events.order_id` fälschlich „nur remote NOT NULL" | §3.2/§4.5/B1-Scope/B1-AK3: B1 ändert **beides** — Drizzle-Schema (`.notNull()` entfernen) UND Remote-Migration; Beweis zweigeteilt: tsc-Diff + `information_schema` (SSG-00) | `orderId ... .notNull()` = schema.ts:159 |
| A4 | Idempotenz tenant-scoped UNIQUE | Beibehalten: `UNIQUE(tenant_id, client_idempotency_key)` (§3.1, §6, B1-AK2) | §3.1 (B1-Neuspalte) |
| B1 | Storage-RLS: `current_setting` wirkt nicht in `storage.objects` | §7.2 **komplett neu**: Prüfung gegen authentifizierte Identität via `auth.uid()` + `app_users`-Lookup gegen `(storage.foldername(name))[1]`; Alternative JWT-**app_metadata**-Claim (nicht `raw_user_meta_data`); §4-Hinweisblock zum GUC-Geltungsbereich ergänzt | `app_users.id`/`tenant_id` = schema.ts:9–10; alte GUC-Policy als Anti-Muster: `20260621103346:3–14` |
| B2 | INSERT/SELECT/UPDATE getrennt, DELETE-Negativtest | §7.2-Tabelle: drei getrennte Policies (Upsert/Retry-Begründung), keine DELETE-Policy für `authenticated`, Negativtest in B1-AK6 | §7.2, B1-AK6 |
| B3 | Service-Role-Pfad ehrlich benennen | §7.2 Ehrlichkeitsklausel: heutiger Uploadpfad = RLS-Bypass; Entscheidung: Upload-/Download auf Nutzer-JWT-Kontext umgestellt, Service-Role nur noch für Systemlöschung als **deklarierter Bypass** mit Pfadvalidierung + eigenem Bypass-Test (B1-AK7) | Service-Role-Client = `scan-upload/route.ts:9–12` |
| B4 | §3.6 `uploaded_by = auth.uid()` unmöglich | Aus §3.6 entfernt — `storage.objects` hat keine Spalte `uploaded_by`; Identitätsbindung über `owner`/JWT/`app_users`-Lookup (§7.2) | §3.6, §7.2 |
| C1 | `scan-upload/route.ts` inventarisieren | §2a I-1 mit vollständiger verifizierter Befundliste: Service-Role (Z.9–12), `Date.now()`+`Math.random()` (Z.29–30), `getPublicUrl` (Z.41–45), Base64-vor-Sicherung (Z.50–56), hartkodierte `detectedType`/`detectionConfidence` (Z.59–60); als **zu ersetzen** in B1/B2 (B2-AK9) | `src/app/api/erfassung/scan-upload/route.ts:9–12, 29–30, 41–45, 50–56, 59–60` |
| C2 | `convertScanToOrder` inventarisieren | §2a I-2: keine `db.transaction` (Einzelwrites Z.621–629, 638–648, 651–661, 664–667), kein `events`-Insert, nur `linked_*` statt `conversion_*` (Z.665–666), `Date.now()`-Auftragsnummer (Z.634), keine Rollenprüfung / tenant aus Scan-Datensatz (Z.590); als **zu ersetzen** in B3 | `src/app/actions/erfassung.actions.ts:578–680` |
| C3 | `scan-analyze/index.ts` inventarisieren | §2a I-3: akzeptiert `base64_data` ODER freie `file_url` (Z.15–19, 29–35); als **zu härten** in B2 (§4.2, B2-AK10) | `supabase/functions/scan-analyze/index.ts:15–35` |
| C4 | Alt-Migration 0001 + Alias | §2a I-4: `status_events`/`metadata` (0001:83–101, `metadata` Z.90) + Legacy-Alias `statusEvents = events`; Inventar in B1, Negativbeleg in B4; kanonisch `events`/`payload`; Alias-Ablösung als späterer Scope in §11 benannt | `0001_app_schema.sql:83–101`; Alias = schema.ts:235; kanonisch `events`/`payload` = schema.ts:156/164 |
| D | B3 nicht als Wunsch-Action | §4.3-Kopfblock + B3-Scope: T3 **ersetzt/deaktiviert** den vorhandenen `convertScanToOrder` in place, kein Parallelpfad (B3-AK7); Rollback-Beweis explizit für Customer, Order, Items, Event, `scan_uploads.conversion_*`, `orders.source/source_ref/status/intake_date` (B3-AK2) | `erfassung.actions.ts:578–680`; Rollback-Objekte gegen schema.ts:27–70 (customers), 82–116 (orders), 136–153 (items), 156–170 (events) |
| E1 | `readonly` ohne Upload-Recht | §7.4 neu: `readonly` = nur lesen, kein Capture/Upload/Schreiben; Upload-Zuschnitt nur `werkstatt`/`meister`/`buero`/`admin` mit Begründung; `developer` als Technikrolle ohne Capture-Upload; Storage-INSERT-Policy trägt den Rollenzuschnitt (§7.2) | reale Rollenwerte + Default `werkstatt` = schema.ts:13 |
| E2 | Rollen-Negativtests je Server-Action | Neue AKs: B2-AK8, B3-AK6, B4-AK7, B6-AK6 — je alle sechs realen Rollenwerte `developer/admin/meister/buero/werkstatt/readonly` positiv/negativ belegt | schema.ts:13 |
| F | SSG-11/16 geschlossen halten | B2-AK5, B4-AK5, B7-AK5 unverändert beibehalten — nicht verschlechtert | §9 (B2/B4/B7) |
| G1 | Grundregel: Spalten gegen schema.ts belegen | §3.1 vollständig mit Zeilenbelegen; Korrekturen: `id`-Default ist App-seitig `createId()` (kein DB-Default behauptet, remote SSG-00); `linked_order_id`/`linked_customer_id` in Drizzle **ohne FK** — Remote-FK nur per Migration, SSG-00; `ocr_provider` hat **kein Drizzle-Symbol** → B1 ergänzt es | schema.ts:274 (`$defaultFn(createId)`), 284–285 (kein `.references`); `20260621103338_fk_scan_uploads.sql:1–7`; `20260621103346_add_ocr_provider.sql:1` |
| G2 | `workflow_templates` unbelegt in Drizzle | §3.5 als WARNING neu gefasst: kein Symbol in `companySettingsTable`; Existenz nur per Migration, remote SSG-00; B4 muss Zugriffsweg herstellen (Scope + T4-Kommentar §4.4) | `companySettingsTable` = schema.ts:339–363 (ohne `workflow_templates`); Spalte + Routen-Seed = `20260621000000_phase2_migrations.sql:104–113` |
| G3 | Storage-Bucket-Beleg präzisiert | §3.6: Bucket `scans` mit `public=false` per konkreter Migrationsdatei belegt; Remote-Zustand SSG-00 | `20260611114327_create_storage_buckets.sql:1` |
| G4 | Alt-Policy-Drop konkretisiert | §7.1/B1-Scope: zu droppende Alt-Policy `tenant_isolation_scan_uploads` (`FOR ALL`, nur USING) namentlich benannt | `20260621103346_add_ocr_provider.sql:3–14` |

Nach dieser Revision folgt genau **EINE** finale Fremdprüfung (Direktive 37_, Abschlussregel: nur noch Punkte ohne Sicherheits-/Datenintegritäts-/Schema-Charakter → Akzeptanz; Feinheiten wandern als benannte Punkte in die jeweilige Baumission).

---

## 15. Änderungsprotokoll V2.3 → V2.4

Anlass: Finale Fremdprüfung `_agentur_reports/38_M6_VERTRAG_FINALE_FREMDPRUEFUNG_V23.md` (`CONTRACT_VERDICT: FAIL`; 1× Kategorie 1, 4× Kategorie 2). Alle neu aufgenommenen Zeilenangaben wurden vor Übernahme erneut am Rohcode verifiziert.

| # | 38_-Fund | Umsetzung in V2.4 | Code-Beleg (verifiziert) |
|---|---|---|---|
| 1 | **F-38-01 (Kategorie 1):** §2a-Inventar unvollständig — zwei uninventarisierte Live-Pfade | §2a um **I-5** und **I-6** erweitert; §4.3-Kopfblock und B3-Scope/B3-AK7 decken **beide** Auftragswahrheiten (I-2 + I-5); B2-Scope + neue AKs **B2-AK11** (I-5-Capture ersetzt, kein Mock/stiller Fallback) und **B2-AK12** (I-6 gehärtet: Session-Tenant, kein getPublicUrl); B1-Scope inventarisiert I-5/I-6 als Parallelschreiber | I-5: `scan/page.tsx:9,45,206`; `CameraCapture.tsx:73,84,99–108`; `ocr.actions.ts:6–19` (stiller Fallback Z.11, Mock `simulateScan` Z.16–19); `orders.actions.ts:376–498` (Dummy-Adresse Z.428–432, `source` ohne `source_ref` Z.467, getrennte Actions Z.424/471). I-6: `orderPhoto.actions.ts:9–50` (scan_uploads-Insert Z.22–30, events-Insert Z.33–39, Tenant-Hardcode Z.23/34, Status-Hardcode Z.28–29); `OrderOverlay.tsx:422–455` (`Date.now()`+Tenant-Pfad Z.430, `getPublicUrl` Z.438/442, Aufruf Z.440) |
| 2 | Fund 2 (Kat. 2): `developer` bei Storage-SELECT uneindeutig | Inline geklärt: §7.2-SELECT-Policy nennt ausdrücklich alle sechs Rollen inkl. `developer` (Lesen im eigenen Tenant erlaubt, nur Upload ausgeschlossen); §7.4-`developer`-Zeile entsprechend präzisiert | schema.ts:13 (Rollenwerte) |
| 3 | Fund 3 (Kat. 2): `v_scan_pipeline` verliert Kundennamen bei reinen Konvertierungs-Scans | Inline geklärt: §8.1-Join auf `COALESCE(su.linked_customer_id, o.customer_id)` umgestellt; Verifikation in B4-AK3 (SSG-13) | `orders.customer_id` = schema.ts:86 |
| 4 | Fund 4 (Kat. 2): `status_events.customer_id`-Divergenz unbenannt | In §2a I-4 und B1-Scope als benannter Inventarpunkt aufgenommen (Mapping nach `payload` oder bewusstes Verwerfen bei Überführung) | `0001_app_schema.sql:88` (`customer_id`); `events` ohne `customer_id` = schema.ts:156–170 |
| 5 | Fund 5 (Kat. 2): SSG-08(c)-Zitat unbelegt | B5-AK6-Zitat auf `SSG-08` korrigiert (Sub-Definition „(c)" im V5-Gate nicht belegt); Kriterium inhaltlich unverändert | `23_GATE_DRAFT_STABLE_SCAFFOLD_PASS_V5.md` (SSG-06…10 ohne Sub-Definitionen) |

Kategorie-2-Funde sind damit teils inline geschlossen (2, 3, 5), teils als **benannte Punkte in ihre Baumissionen** überführt (4 → B1; Rest-Verifikation 3 → B4), gemäß Abschlussregel der Direktive 37_. Es folgt die Nachprüfung des Kategorie-1-Fundes durch denselben unabhängigen Prüfer.

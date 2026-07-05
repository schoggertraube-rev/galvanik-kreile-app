# 03 · Reparaturleitfaden — 6 Wellen zum tragfähigen Fundament

**Prinzip:** Reihenfolge ist nicht verhandelbar. Jede Welle hat ein **Ziel**, konkrete **Schritte**, **Akzeptanzkriterien mit Laufzeitbeweis** und eine **unabhängige Abnahme**. Kein „fertig" ohne Beweis. Kein Sprung nach vorn, solange die vorige Welle nicht abgenommen ist. Das ist genau die Disziplin, die bisher fehlte.

> **Governance-Hinweis:** Jede Welle ist eine eigene Baumission mit genau einem schreibenden Agenten und einem unabhängigen Prüfer. Vor jeder Mission: Git/Pfad/HEAD/Snapshot. Kein Merge/Push/Deploy ohne Missionsfreigabe.

---

## Welle 0 — Sicherheits-Sofortblocker & Repo-Hygiene (P0)

**Ziel:** Nichts DSGVO-/Missbrauchskritisches darf eine Live-Instanz erreichen; die Gates messen nur echten Code.

**Schritte**
1. **Aktive `src/middleware.ts` wiederherstellen**, Matcher so, dass `/api` erfasst wird (Ausnahme nur explizite Public-Routen: Login, Webhooks). `middleware.backup.ts.disabled` löschen.
2. **In jede der 15 offenen API-Routen** am Anfang `resolveAuthorization()`/`checkAppAuth()` (defense in depth) — F-A4.
3. **`customer-search`**: Guard + `and(eq(customers.tenantId, auth.tenantId), …)` im WHERE — F-A5.
4. **`item-photo-upload`**: Guard erzwingen; `tenantId` **nur** aus `auth.data.tenantId`, FormData-Wert ignorieren; `getPublicUrl` → `createSignedUrl` (kurzlebig); Bucket privat — F-A6/F-A10.
5. **Alle `getPublicUrl` für Belege/Fotos** durch `createSignedUrl` ersetzen; fehlenden `belege`-Bucket als Migration nachziehen; Storage-RLS-Policies pro Bucket (Tenant-Ordner) — F-A10.
6. **Offene Proxies** (freetext/inquiry/notes/customer-enrich, email/send, mollie/create) Guard + Rate-Limit; email serverseitig gegen erlaubte Empfänger/Templates validieren — F-A8/F-A9.
7. **Cron** `send-feedback`: `CRON_SECRET`/Signatur prüfen; Mock-Versand markieren/deaktivieren, Status erst bei echtem Versand — F-A11.
8. **PIN hashen** (bcrypt/argon2) in Seed, `UserManagement`, `loginWithPin`; Vergleich per `bcrypt.compare`; bestehende PINs neu setzen — F-A7.
9. **Toten `PinDialog.tsx`** (Client-Bypass PIN 1234) und `bypass-auth`-Cookie-Pfad entfernen — Security F-A(bypass).
10. **`.agents/` aus dem Repo entfernen** (oder außerhalb verschieben) und aus tsconfig-exclude/eslint-ignore; Root-Skripte (enrich.js, rewrite.js, run_audit.js, migrate_manual.ts, curl_output.html, recovered_*.txt, `_quarantine/`, `scratch/`) in ein `archiv/`-Verzeichnis außerhalb des Build-Scopes — F-F1/F-F2.

**Akzeptanzkriterien (Laufzeitbeweis)**
- Alle 18 API-Routen: unauthentifizierter Aufruf → **401** (nachweisbar per Skript/curl-Matrix).
- `curl` auf `customer-search` ohne Session → 401; mit fremdem Tenant → 0 Zeilen.
- Storage-Download nur über signierte URL mit Ablauf; öffentlicher Direktabruf → 403.
- `find .agents` liefert keine Dateien mehr im tsconfig-Scope; `tsc`/`build` weiter grün.

---

## Welle 1 — Schema reproduzierbar machen (Fundament der Datenwahrheit)

**Ziel:** Eine frische Datenbank aus Migrationen ergibt **exakt** das Live-Schema. Ende des Treibsands.

**Schritte**
1. **Remote-Schema als Baseline exportieren** (`pg_dump --schema-only` / Introspektion).
2. **Konsolidierte, idempotente Baseline-Migration** erzeugen, die den Ist-Zustand vollständig abbildet — inkl. der bisher fehlenden `events`-Tabelle (F-B2) und `orders.current_station_id` (F-B1).
3. **Stationsspalte vereinheitlichen:** genau **eine** kanonische Spalte (`current_station_id`), alle Views und `operationalOrders` darauf umstellen — F-B3.
4. **Drizzle-Ledger neu aufsetzen** (`_journal.json` konsistent), danach **Regel: nur versionierte Migrationen, kein `db push`, kein ad-hoc MCP-apply** — F-B4.
5. **Fehlende FKs** setzen (nach Orphan-Report): stock_movements, calendar_events, events.item_id, complaints, ausgangsrechnung→orders/customers, beleg→orders, PENDING_FK_NOTES-Trio — F-E4/E5/E6.

**Akzeptanzkriterien**
- Frische DB aus `supabase/migrations` + `diff` gegen Remote-Dump = **leer** (kein Drift).
- Alle KPI-Views laufen gegen die kanonische Stationsspalte (kein `current_station`-Rest).
- Orphan-Report vor FK = 0 offene Waisen; FKs greifen.

---

## Welle 2 — Ein kanonischer Datenpfad (der wichtigste Hebel gegen „Vernetzung kaputt")

**Ziel:** Genau **eine** Datenwahrheit. Keine Mocks im Produktionspfad.

**Schritte**
1. **Kanonischen Zugriff festlegen:** serverseitige Server-Actions über Drizzle **mit Tenant-Kontext aus Session** (nicht hardcodiert).
2. **`isSupabase`-Mock-Verzweigungen aus den 9 Repositories entfernen** — F-C1. `src/lib/mockData.ts`, `mockCustomersExtended.ts`, `demoDataGenerator.ts`, `MockCustomer` aus dem Produktionspfad tilgen — F-C7.
3. **anon-Client nur für explizit öffentliche, RLS-abgesicherte Reads** (nach Welle 3), sonst gar nicht.
4. **`eventsRepository`** darf nie still verwerfen — Fehler hart loggen (`error.message/details/hint`) — F-C5.
5. **Tenant aus Session durchreichen:** die 136 `galvanik-kreile`-Hardcodes durch `auth.tenantId` ersetzen; Orders-Cache um Tenant-Key erweitern oder request-scoped machen — F-H1/F-G3.

**Akzeptanzkriterien**
- `grep isSupabase src` = 0; `grep mockData|MockCustomer src` = 0 im Produktionspfad.
- `grep "galvanik-kreile" src` nur noch in Tests/Seeds, nicht im Laufzeitpfad.
- Ein und derselbe Screen zeigt über nur einen Pfad reproduzierbar dieselben Mengen (Laufzeit-Screenshot-Beweis).

---

## Welle 3 — Tenant/RLS/Storage echt scharfstellen

**Ziel:** Isolation, die die Datenbank erzwingt — nicht nur TypeScript.

**Schritte**
1. **Dedizierte App-DB-Rolle** (kein Superuser, kein BYPASSRLS) — F-A2.
2. **`FORCE ROW LEVEL SECURITY`** auf allen Tenant-Tabellen — F-A3.
3. **`app.tenant_id` per `SET LOCAL` in JEDER DB-Transaktion** im selben garantierten Transaktionsblock setzen (Contract-Regel 7) — F-A1.
4. **`tenant_id` auf allen Kerntabellen** nachrüsten + je Tabelle konsistente Policy — F-E3.
5. **Storage-RLS** pro Bucket mit Tenant-Ordnerprüfung; Downloads nur über authentifizierten Server-Endpunkt — F-A10/F-A12.

**Akzeptanzkriterien (harter Laufzeitbeweis)**
- Cross-Tenant-`SELECT` unter gesetzter fremder `app.tenant_id` → **0 Zeilen** (SQL-Beweis).
- App-Rolle kann ohne gesetzten Tenant **nichts** lesen (RLS blockt), mit Tenant nur eigene Zeilen.
- Storage: fremder Tenant-Ordner → 403.

---

## Welle 4 — Offline/Capture konsolidieren (Slice-1-Herzstück)

**Ziel:** Ein Original geht nie verloren; genau eine Outbox.

**Schritte**
1. **Auf `OfflineOutbox.ts` (IndexedDB, Blob) als kanonische Outbox konsolidieren**; `useOfflineManager`, `idbSync`, `OfflineManager` entfernen — F-C3/F-C6.
2. **base64-in-localStorage entfernen**; Foto sofort nach Capture als **Blob in die Outbox** schreiben (mit Inhalts-Hash/ID) — **vor** OCR — F-C2/F-C4/F-C8.
3. **Idempotente Sync-Keys** (Inhalts-Hash), damit Reconnect keine Doppelaufträge erzeugt (Regel 6).
4. **Vor-Auftrags-Ereignis ermöglichen:** `events.order_id` nullable **oder** polymorpher Bezug (`subject_type/subject_id`) bzw. `scan_upload_id`-FK; CASCADE für Audit-Events auf RESTRICT/SET NULL — F-D1.
5. **Gemini/OCR mit `AbortController`-Timeout**; Verarbeitung asynchron über Queue **oder** synchron ohne nachgelagertes Polling — nicht beides — F-G1.

**Akzeptanzkriterien**
- Foto aufnehmen → Browser hart neu laden/„Crash" → Original ist **noch da** (aus Outbox wiederherstellbar).
- Offline aufnehmen → online gehen → **genau ein** Auftrag entsteht (kein Duplikat).
- Gemini künstlich verzögert → Request bricht nach Timeout sauber ab, UI zeigt Retry.

---

## Welle 5 — Fachlogik nach SQL, Performance, Aufräumen

**Ziel:** Regelkonforme, schnelle, saubere Oberfläche.

**Schritte**
1. **KPI-/Margen-/Liquiditätsberechnung in SQL-Views** (`v_cockpit_kpi`), Schwellen als Parameter statt Magic Numbers — F-E1/F-E2.
2. **Kundenkarte serverseitig rendern**, Tab-Daten gebündelt laden statt 7 Client-Wasserfälle — F-G2.
3. **Bundle bereinigen:** auf recharts standardisieren (chart.js raus), auf `@google/genai` standardisieren (`@google/generative-ai` raus) — F-F4.
4. **Lint-Baseline-Schuld tilgen** (404 Fehler zuerst), Neucode ohne Ausnahmen sauber — F-F3.
5. **Demo-Daten sauber trennen** (`is_demo`/`source='demo'`), Prod-DB auf Demo-Reste prüfen — F-H2. **`ocr-process`** Auto-Create idempotent (Upsert, deterministischer Schlüssel), Dev-User-Fallback entfernen — F-H3.

**Akzeptanzkriterien**
- Fachwerte kommen aus Views (kein `reduce` im Client für KPIs).
- Kundenkarte: ein Server-Render, messbar weniger Roundtrips.
- Lint-Baseline sinkt nachweisbar; `grep is_demo=true` in Prod = 0.

---

## Reihenfolge-Logik (warum genau so)

```
Welle 0 (Sicherheit)  ──►  darf nie warten, blockiert Livegang
Welle 1 (Schema)      ──►  ohne reproduzierbares Schema ist jede weitere Arbeit Treibsand
Welle 2 (1 Datenpfad) ──►  DER Hebel gegen „Vernetzung kaputt" — braucht Welle 1
Welle 3 (RLS echt)    ──►  braucht Welle 2 (Tenant aus Session) + App-Rolle
Welle 4 (Offline)     ──►  braucht Welle 2/3 (kanonischer Pfad + sichere Uploads)
Welle 5 (Feinschliff) ──►  zuletzt, sonst poliert man Instabiles
```

Erst **nach Welle 4 mit unabhängiger E2E-Abnahme** ist ein Pilot-Livegang des Slice-1-Kerns verantwortbar (Kapitel 07).

# EVIDENCE LEDGER

Stand: 2026-07-05 · Prüf-HEAD `204f3f1` · Prüfer: Chefdirigent (direkte Codeprüfung, da Subagent-REDTEAM am Sessionlimit ausfiel). Alle Befehle read-only, kein Schreibzugriff auf Code/DB.

| EVIDENCE-ID | Behauptung | Beweistyp | Befehl / Pfad | Ergebnis | zugehörige Findings |
|---|---|---|---|---|---|
| E-01 | Keine aktive Middleware | Befehl | `git ls-files \| grep -iE "src/middleware\.(ts\|js)$"` | nur `src/middleware.backup.ts.disabled` | F-A4 |
| E-02 | `proxy.ts` von nichts importiert | Befehl | `grep -rn "from '.*proxy'" src` | 0 Treffer | F-A4 |
| E-03 | Tenant nie gesetzt | Befehl | `grep -rniE "set_config\|SET LOCAL\|app.tenant_id" src` | nur 1 unrelated Kommentar | F-A1 |
| E-04 | Kein FORCE RLS | Befehl | `grep -rniE "FORCE ROW LEVEL SECURITY" supabase/migrations` | 0 Treffer | F-A3 |
| E-05 | Kein PIN-Hashing | Befehl | `grep -rniE "bcrypt\|argon2\|scrypt\|pbkdf2" src package.json` | 0 Treffer | F-A7 |
| E-06 | 15/18 Routen ohne Auth | Befehl | Scan `find src/app/api -name route.ts` + grep Auth-Symbole | 3 mit Auth, 15 ohne | F-A4 |
| E-07 | customer-search ohne Tenant/Auth | Read | `src/app/api/erfassung/customer-search/route.ts` | GET → select from customers, kein Guard/Filter | F-A5 |
| E-08 | item-photo-upload Service-Role + Client-Tenant | Befehl | grep SERVICE_ROLE/formData.get(tenantId)/getPublicUrl | Zeilen 6,13,32,41 bestätigt | F-A6 |
| E-09 | base64 in localStorage | Befehl | `grep -n localStorage.setItem OrderActionGrid.tsx` | `:61` `kreile_photo_…, base64` | F-C2 |
| E-10 | useOfflineManager nur RAM | Befehl | grep useState/real implementation | `:14` useState, `:18` „real implementation…IndexedDB" | F-C3 |
| E-11 | idbSync Math.random-ULID | Befehl | `grep -n Math.random idbSync.ts` | `:25` `Date.now()+Math.random()` | F-C6 |
| E-12 | orders.current_station_id nie migriert | Befehl | `grep -rni current_station_id supabase/migrations` | nur `items` (0009), nie `orders` | F-B1, F-B3 |
| E-13 | events-Tabelle nie per CREATE TABLE | Befehl | `grep -rniE "CREATE TABLE.*events" migrations` | nur `status_events` (0001:84) | F-B2 |
| E-14 | 9 Mock-Repositories | Befehl | `grep -rln isSupabase src/lib/repositories` | 9 Dateien | F-C1 |
| E-15 | .agents-Klon 647 Dateien im tsconfig-Scope | Befehl | `find .agents -name "*.ts*" \| wc -l`; tsconfig include/exclude | 647; exclude nur node_modules+supabase | F-F1 |
| E-16 | events.order_id NOT NULL + CASCADE | Read | `src/db/schema.ts:159` | `order_id … notNull().references(orders.id, onDelete cascade)` | F-D1 |
| E-17 | Secrets nie committet | Befehl | `git ls-files \| grep -iE "\.env"` | 0 Treffer | P-7 |
| E-18 | getOperationalOrders kein N+1 | Befehl | grep inArray operationalOrders.ts | `:63` `inArray(items.orderId, orderIds)` | P-1 |
| E-19 | Gemini-Fallback vorhanden | Read | `geminiClient.ts:39/57-60` | `fallbackModel` + Fallback-Zweig | P-2 |
| E-20 | OfflineOutbox echte IndexedDB | Read | `OfflineOutbox.ts:33-39` | `window.indexedDB.open(DB_NAME, DB_VERSION)` | P-3 |
| E-21 | galvanik-kreile-Hardcode | Befehl | `grep -rn "galvanik-kreile" src \| wc -l` / Dateien | 136 Treffer / 47 Dateien | F-H1 |
| E-22 | Register leer | Befehl | `wc -l registers/*.md` | 4–6 Zeilen je Register | F-F5 |
| E-23 | HEAD 9 vor main | Befehl | `git log --oneline main..HEAD \| wc -l` | 9 | F-F6 |
| E-24 | Root-Verschmutzung | Befehl | `ls` Root + `_quarantine`/`scratch` | ~15 lose Skripte, Legacy-Klon, scratch | F-F2 |
| E-25 | QA-Gates | Befehl | `tsc --noEmit`, `test:unit`, `lint:ratchet`, `build` | tsc=0, 75/75, ratchet grün (Baseline-Schuld), Build 77/77 | P-8, F-F3 |

## Zweite Prüfrunde (2026-07-05) — REDTEAM-Vervollständigung + Vollkartierung

| EVIDENCE-ID | Behauptung | Befehl/Pfad | Ergebnis | Findings |
|---|---|---|---|---|
| E-26 | KI-Proxies mit Service-Role | grep SERVICE_ROLE freetext/inquiry/notes/customer-enrich | 4× Bearer @Z.11 | F-A8 |
| E-27 | email/mollie ohne Guard | grep -c resolveAuth/checkAppAuth | 0/0 | F-A9 |
| E-28 | cron Mock + Fake-Status | grep skipping/Mock/gesendet cron | bestätigt Z.8/22/27 | F-A11 |
| E-29 | eventsRepository still | grep catch/return eventsRepository | „Fallback to empty on crash" | F-C5 |
| E-30 | Gemini ohne Timeout | grep -c AbortController/timeout | 0/0 | F-G1 |
| E-31 | Cockpit TS-Aggregation | grep reduce/0.5/0.2/umsatzNachStation | bestätigt + kostensatz=45 | F-E1 |
| E-32 | getPublicUrl-Übermacht | grep getPublicUrl vs createSignedUrl | 8 vs 1 | F-A10 |
| E-33 | Kundenkarte 7 Tab-useEffect | grep -l useEffect customers/tabs | 7 | F-G2 |
| E-34 | Buchhaltungs-Mock aktiv | grep MockOcrProvider BelegUploadOverlay | import Z.5 + `new` Z.31 | F-C9, F-H4 |
| E-35 | MockOrder Laufzeittyp | grep MockOrder/MockCustomer src (ohne mockData) | 10 Dateien | F-C10 |
| E-36 | Math.random für IDs/Tokens | grep Math.random src | Kundennr customers.actions:151, Tokens feedbackMailService | F-C11 |
| E-37 | 4 Capture-Familien | find capture/scan/intake/erfassung | ScanFlow+ManualFlow+intake+scan+BelegUpload | Kap.09 |
| E-38 | Kern nicht domänengekoppelt | grep domain-imports in lib/auth,offline,server | 0 Treffer | Kap.11 |
| E-39 | Vor-Audit 2026-06-19 existiert | ls Root *AUDIT*/*ARCHAEOLOGIE* | 3 Audits (10/30/19 KB) | Kap.12 |
| E-40 | TEST_MATRIX veraltet | TEST_MATRIX 63/63 vs Unit 75/75 | Beleg-Drift | F-F7 |

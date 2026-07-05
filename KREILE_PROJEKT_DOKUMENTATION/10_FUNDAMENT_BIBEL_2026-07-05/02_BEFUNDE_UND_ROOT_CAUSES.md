# 02 · Befunde & Root-Cause-Cluster

41 Befunde, gruppiert nach **Wurzelursache** (nicht nach Symptom). Jeder Befund hat eine ID (Registerverweis `FINDINGS_REGISTER.md`), ein TRUTH-Label und Evidenz. `KV` = Konduktor-verifiziert (selbst reproduziert), `FB` = Finder-belegt.

Severity-Legende: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · ⚪ LOW

---

## Cluster A — Sicherheit & Tenant-Isolation nur auf dem Papier (Root-Cause der Vertrauensfrage)

**Die gemeinsame Wurzel:** Die App verbindet als Datenbank-**Superuser** und setzt **nie** `app.tenant_id`. Damit sind sämtliche RLS-Policies für den App-Pfad wirkungslos, und es gibt keine aktive Middleware als zweite Verteidigungslinie. Alles hängt daran, dass jede einzelne Route/Action selbst prüft — was viele nicht tun.

| ID | Sev | Befund | Evidenz | Ver. |
|---|---|---|---|---|
| F-A1 | 🔴 | `app.tenant_id` wird nirgends per `set_config`/`SET LOCAL` gesetzt, RLS-Policies bauen aber darauf | `grep set_config/SET LOCAL/app.tenant_id src` → 0 | KV |
| F-A2 | 🔴 | App verbindet als `postgres`-Superuser (BYPASSRLS) | `src/db/index.ts:19` + `.env.local` DB-URL | KV |
| F-A3 | 🟠 | Kein `FORCE ROW LEVEL SECURITY` in irgendeiner Migration | `grep FORCE ROW LEVEL SECURITY migrations` → 0 | KV |
| F-A4 | 🔴 | 15 von 18 API-Routen ohne jede Auth-Prüfung | Routen-Scan (nur scan-upload, scan-status, ocr-process prüfen) | KV |
| F-A5 | 🔴 | `customer-search` liefert komplette Kundenkartei ohne Auth/Tenant-Filter | `customer-search/route.ts` GET → select customers | KV |
| F-A6 | 🔴 | `item-photo-upload`: Service-Role-Key, Tenant aus Client-FormData, öffentliche URL | `route.ts:6/13/32/41` | KV |
| F-A7 | 🟠 | PIN im Klartext gespeichert & verglichen (`pin_hash` trügt) | `grep bcrypt/argon…` → 0; `auth.actions.ts` `pinHash !== pin` | KV |
| F-A8 | 🟠 | Offene Service-Role-KI-Proxies (freetext/inquiry/notes/customer-enrich) | je `route.ts` Bearer SERVICE_ROLE ohne Guard | FB |
| F-A9 | 🟠 | Offene Proxies `email/send` & `payments/mollie/create` | je `route.ts` POST ohne Guard | FB |
| F-A10 | 🔴 | Buckets privat, Code nutzt `getPublicUrl` für Belege/Fotos | scan-upload:41, item-photo-upload:32, photoService:29 | FB |
| F-A11 | 🟠 | `cron/send-feedback` ungeschützt; Versand Mock, setzt Status „gesendet" | `route.ts:8/22/26` | FB |
| F-A12 | 🟡 | `scan_uploads`-Insert über Service-Role (RLS-Bypass) | `scan-upload/route.ts` SERVICE_ROLE | FB |

**Warum das dein Problem ist:** Über den anon-Client-Lesepfad liefert die tote RLS je nach Policy-Rest **leere oder ungefilterte** Daten — mal sieht ein Screen nichts, mal alles. Das erklärt sowohl „Vernetzung kaputt" als auch das diffuse Verhalten. Und für einen Livegang sind F-A5/A6/A10 **DSGVO-Sofortblocker**.

---

## Cluster B — Datenbank-Schema nicht reproduzierbar (Root-Cause der „Geister-Fehler")

**Wurzel:** Es wurde mit `db push` und ad-hoc-Migrationen gegen die Remote-DB gearbeitet, statt mit reinen versionierten Migrationen. Ergebnis: zentrale Objekte existieren **remote**, aber in **keiner** Migrationsdatei. Eine frische DB aus `supabase/migrations` ergibt **nicht** das Live-Schema.

| ID | Sev | Befund | Evidenz | Ver. |
|---|---|---|---|---|
| F-B1 | 🔴 | `orders.current_station_id` in keiner Migration (Geister-Spalte) | `grep current_station_id migrations` → nur `items` | KV |
| F-B2 | 🔴 | Tabelle `events` nie per `CREATE TABLE` erzeugt (nur `status_events`) | `grep CREATE TABLE…events` → nur status_events | KV |
| F-B3 | 🔴 | KPI-Views lesen `current_station`, operativer Pfad schreibt `current_station_id` → Kette reißt | Views vs. operationalOrders | KV |
| F-B4 | 🟠 | Migrationshistorie nicht selbsttragend (2 reconcile-Commits, `_journal.json` 1 Eintrag) | `4134ee5`,`02906c4`; Drizzle-Journal | KV |

**Konsequenz:** Die Kette **Auftrag → Station → KPI** ist gebrochen — Karten sehen keine Verzögerungskosten. Und jede zweite Umgebung (Test, Pilot, Neuaufbau) driftet. Das ist ein Hauptgrund, warum „das Fundament" sich anfühlt wie Treibsand.

---

## Cluster C — Doppelte Datenwahrheit & Mock im Produktionspfad (Root-Cause „vieles war Mock")

**Wurzel:** Zwei Datenzugriffswelten (Drizzle-Server vs. Supabase-anon) plus ein `isSupabase`-Mock-Schalter, der nie entfernt wurde. Dazu Foto-/Offline-Pfade, die Daten nur vortäuschen zu speichern.

| ID | Sev | Befund | Evidenz | Ver. |
|---|---|---|---|---|
| F-C1 | 🟠 | Zwei Datenpfade + `isSupabase`-Mock-Schalter in 9 Repositories | `grep isSupabase repositories` → 9 | KV |
| F-C2 | 🔴 | base64-Bild dauerhaft im `localStorage` (Vertragsbruch R3) | `OrderActionGrid.tsx:61` | KV |
| F-C3 | 🔴 | 4 parallele Offline/Outbox-Systeme, eins reiner RAM-Mock | `useOfflineManager.ts:14/18` + OfflineOutbox/idbSync/OfflineManager | KV |
| F-C4 | 🟠 | Original geht bei Refresh/Crash während Capture im RAM verloren | `CameraCapture.tsx:60-90` | FB |
| F-C5 | 🟠 | `eventsRepository` verwirft Events still, meldet Fake-Erfolg | Mock-Pfad `return true` | FB |
| F-C6 | 🟡 | `idbSync` nutzt `Math.random` als ULID, stille catch-Blöcke | `idbSync.ts:25` | KV |
| F-C7 | 🟡 | Mock-Typen/Sim-Services im aktiven Pfad (`MockCustomer`, `simulateScan`) | CustomerFocusView, ocrService | FB |
| F-C8 | ⚪ | `Math.random` für Upload-Dateinamen statt Inhalts-Hash | `scan-upload/route.ts:30` | FB |

**Das ist die Kernursache deiner Blockade.** Solange zwei Wahrheiten koexistieren, ist jede „Vernetzung" ein Zufallsprodukt. Welle 2 des Reparaturplans adressiert genau das — und ist deshalb der wichtigste Hebel.

---

## Cluster D — Ereignismodell blockiert den Slice-1-Kern

| ID | Sev | Befund | Evidenz | Ver. |
|---|---|---|---|---|
| F-D1 | 🟠 | Vor-Auftrags-Ereignisse strukturell unmöglich: `events.order_id` NOT NULL + FK CASCADE | `schema.ts:159` | KV |

**Konsequenz:** Der gewünschte Fluss „Foto/Beleg **vor** dem Auftrag erfassen und als Ereignis festhalten" kann im heutigen Modell nicht existieren — jedes Event braucht zwingend eine bestehende Order. Zusätzlich löscht `CASCADE` beim Auftrags-Löschen die Audit-Spur mit. Das ist das dokumentierte PHASE0-Kernproblem, jetzt mit Codebeleg.

---

## Cluster E — Fachlogik/Referenzen an der falschen Stelle

| ID | Sev | Befund | Evidenz | Ver. |
|---|---|---|---|---|
| F-E1 | 🟡 | KPI-Aggregation in `cockpit/actions.ts` (TS) statt View; Magic-Number-Schwellen 0.2/0.5 | `cockpit/actions.ts:30-58` | FB |
| F-E2 | 🟡 | Fachaggregation im Client (Buchhaltung, 13 *Client.tsx) | `BuchhaltungCockpitClient.tsx:50-52` | FB |
| F-E3 | 🟠 | Lückenhafte `tenant_id`-Abdeckung auf Kerntabellen | `0012_harden_rls.sql:92-95` | FB |
| F-E4 | 🟡 | Offene FKs nie geschlossen (PENDING_FK_NOTES) | `PENDING_FK_NOTES.md` + Drizzle | FB |
| F-E5 | 🟡 | Weitere fehlende FKs (stock_movements, calendar_events, events.item_id, complaints) | `schema.ts` text ohne references | FB |
| F-E6 | 🟡 | Kette Rechnung↔Auftrag↔Kunde nur teilweise per FK | `ausgangsrechnung.kundeId/orderId` ohne FK | FB |

**Konsequenz:** Regel 13 (Fachwerte in SQL, nicht React) ist teilweise verletzt, und die referenzielle Integrität des Datenkreislaufs (`Kunde → Auftrag → … → Rechnung → Zahlung`) reißt an mehreren Stellen — Waisen-Datensätze sind möglich.

---

## Cluster F — Build-, Repo- & Governance-Hygiene

| ID | Sev | Befund | Evidenz | Ver. |
|---|---|---|---|---|
| F-F1 | 🟠 | `.agents/`-Klon (647 TS/TSX) im tsconfig/eslint-Scope | `find .agents` = 647; tsconfig exclude nur node_modules+supabase | KV |
| F-F2 | 🟡 | Root verschmutzt: ~15 lose Skripte + `_quarantine/` (Legacy-Klon) + `scratch/` | `ls` Root | KV |
| F-F3 | 🟡 | Lint-Ratchet toleriert 404 Fehler / 370 Warnungen (app-Scope) | `lint-baseline.json` | KV |
| F-F4 | 🟡 | Doppelte Chart-Libs (recharts+chart.js) & zwei Gemini-SDKs | `package.json` | FB |
| F-F5 | 🟠 | Cowork-Register praktisch leer (nur Überschriften) | `wc -l registers/*.md` → 4–6 | KV |
| F-F6 | 🟡 | HEAD 9 Commits vor `main` (unmerged); PROJECT_TRUTH nennt veralteten HEAD | `git log main..HEAD` = 9 | KV |

**Konsequenz:** Der verworfene Auth-Clone (dein „beschädigt und verschmutzt") liegt noch im Scan-Scope und kann Gate-Ergebnisse verfälschen. Und weil die Register leer blieben, gingen bisher Entscheidungen und Befunde verloren — dieselbe Sorge, die dich hierher geführt hat.

---

## Cluster G — Externe Zuverlässigkeit & Performance

| ID | Sev | Befund | Evidenz | Ver. |
|---|---|---|---|---|
| F-G1 | 🟠 | Gemini/OCR ohne Timeout; synchrone Blockierung + redundantes Polling | geminiClient/geminiOcr, scan-upload, ScanUpload | FB |
| F-G2 | 🟠 | Client-Fetch-Wasserfälle: Kundenkarte lädt 7+ Tabs einzeln im useEffect | 7 Tab-Komponenten | FB |
| F-G3 | 🟠 | Prozessweiter Orders-Cache ohne Tenant-Key + hardcoded Tenant | `operationalOrders.ts:6-22/46` | KV |

---

## Cluster H — Wiederverwendungs- & Datenhygiene-Bremsen

| ID | Sev | Befund | Evidenz | Ver. |
|---|---|---|---|---|
| F-H1 | 🟠 | `galvanik-kreile` 136× in 47 Dateien hartcodiert | `grep galvanik-kreile src` | KV |
| F-H2 | 🟡 | Demo-Cleanup per DELETE-by-Name in Migration (Demo lief in Prod-DB) | `20260625000000_cleanup_demo_data.sql` | FB |
| F-H3 | 🟡 | `ocr-process` legt ungefragt Kategorien/Lieferanten an; Dev-User-Fallback | `route.ts:50-92` | FB |

---

## Der wiederverwendbare, gute Kern (nicht wegwerfen!)

| ID | Positivbefund | Beleg |
|---|---|---|
| P-1 | `getOperationalOrders` ohne N+1 (Batch-Load per `inArray`) | `operationalOrders.ts:63` |
| P-2 | Zentraler Gemini-Client mit Modell-Fallback | `geminiClient.ts:39/57` |
| P-3 | `OfflineOutbox.ts` echte IndexedDB-Implementierung | `OfflineOutbox.ts:33` |
| P-4 | Auth-Bausteine sauber (HMAC-Session, Guards, Rollen/Permissions) | `appSession.ts`, `authorization.ts` |
| P-5 | SQL-Views fachlich solide (v_economics, v_auftrag_db, v_kunde_clv …) | Migrationen 20260614/23 |
| P-6 | Transaktionslogik (advisory lock, atomar) | `operationalOrders.ts` |
| P-7 | Secrets nie im Git | `git ls-files` sauber |
| P-8 | QA-Gates grün (tsc 0, Unit 75/75, Build 77/77) | Gate-Läufe |

**Merksatz:** Die *Denkarbeit* (Datenmodell, Views, Auth-Architektur, Transaktionen, Ideen) ist da und gut. Kaputt ist die *Verdrahtung* — und die ist reparierbar.

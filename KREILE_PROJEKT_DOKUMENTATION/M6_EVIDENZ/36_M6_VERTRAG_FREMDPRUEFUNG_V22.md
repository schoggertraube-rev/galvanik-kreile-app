GPT-5 Codex | neue Session: ja | Session-ID: 2c70cc5b-1e7b-4d0c-a4a1-5d392f72d16f

# 36 - M6 Vertrag Fremdpruefung V2.2

Pruefobjekt: `_agentur_reports/proposals/M6_SLICE1_IMPL_CONTRACT_V2.md` V2.2.
Vorpruefung: `_agentur_reports/35_M6_VERTRAG_FREMDPRUEFUNG.md`.
Massstab: `KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/*.md`, REDTEAM aus `02_AUTONOMOUS_MISSION_PROTOCOL.md`, SSG aus `25_GATE_DRAFT_STABLE_SCAFFOLD_PASS_V6.md` mit V6-Verweis auf V5 `23_GATE_DRAFT_STABLE_SCAFFOLD_PASS_V5.md`.
Codebasis: Lab-Twin `kreile-agentur-twin-20260703-233807`, `LAB_GUARD.md`: Source `02_app`, Branch `feature/capture-auth-tenant`, Source-HEAD `72837985d0b6ec7faddc79fc16d9572b75096f65`; Lab-HEAD `a353fa90c47a32d089f84b07789427f61eaa2c61`, Branch `master`.
Remote/DB/Deploy: nicht ausgefuehrt.

## 1. Korrekturen aus Bericht 35

| # | Bericht-35-Korrektur | Status | Beleg |
|---|---|---|---|
| 1 | RLS/Storage neu fassen | OFFEN | V2.2 trennt fuer Kerntabellen SELECT/INSERT/UPDATE/DELETE in `M6...`:276-289. Storage bleibt aber in `M6...`:291-298 auf `(storage.foldername(name))[1] = current_setting('app.tenant_id', true)`. Das ist fuer Supabase Storage API nicht derselbe DB-Transaction-Kontext wie `SET LOCAL` aus `M6...`:300-305. Echte Migrationen enthalten nur Bucket-Anlage, keine `storage.objects`-Policies: `20260611114327_create_storage_buckets.sql`:1-2; `rg storage.objects` findet keine Policy. Der echte Uploadpfad nutzt Service-Role-Client und bypassed RLS: `src/app/api/erfassung/scan-upload/route.ts`:9-12. |
| 2 | Ereignis- und Schema-Wahrheit klaeren | OFFEN | V2.2 korrigiert `events`/`payload` und benennt `events.order_id` als aktuell NOT NULL: `M6...`:102-115, 242-247, 586. Gegen echten Code bleiben unbelegte/widerspruechliche Annahmen: `events.orderId` ist in Drizzle weiterhin `.notNull()`: `src/db/schema.ts`:156-165; der SQL-View-Entwurf nutzt `se.createdAt`, obwohl die DB-Spalte `created_at` heisst: `M6...`:350 vs. `src/db/schema.ts`:169; `orders.received_at` wird als bestehend/no-change behauptet und in T3 geschrieben (`M6...`:117-120, 220), fehlt aber in `src/db/schema.ts` fuer `orders` (`orders` endet dort ohne `receivedAt`:82-116). |
| 3 | Kernregel-11-Transaktion erweitern | OFFEN | V2.2 modelliert T3 als eine DB-Grenze mit Customer, Order, Items, Event, Scan-Update und Order-Status: `M6...`:205-224. Im echten Code existiert bereits `convertScanToOrder(scanId)`, aber ohne `db.transaction`, ohne `events`-Insert, ohne `conversion_order_id`/`conversion_event_id`, und mit mehreren Einzelwrites: `src/app/actions/erfassung.actions.ts`:578-679. Der Vertrag benennt nicht explizit, dass genau dieser bestehende Produktionspfad ersetzt/gehaertet werden muss. |
| 4 | SSG-11/16-Beweisformen ersetzen | GESCHLOSSEN | V2.2 ersetzt grep-only durch Produktionspfad-Inventar: B2-AK5 `M6...`:414, B7-AK5 `M6...`:523. Fuer SSG-16 verlangt B4-AK5 Konsumentenverweis plus Negativ-Inventar paralleler TS/Drizzle-Fachlogik: `M6...`:457. Das passt zu V5/SSG-11 `23...`:75 und V6/V5-Verweis `25...`:47-49. |
| 5 | Missionen neu schneiden / Beweise in richtiger Mission | GESCHLOSSEN | B1 beschraenkt sich in V2.2 auf Migration/RLS/Storage/Session/Rollen: `M6...`:375-393. Upload/Retries liegen in B2; der Retry ist als Upsert oder Hash/Exists-Branch spezifiziert: `M6...`:176, 416. B5 fordert rohlogfaehigen IndexedDB-Test und 72h-/Neustart-/Hash-Identitaetsbeweis: `M6...`:476-481. |

## 2. Gezieltes Urteil zu Storage-RLS in §7.2

Klartext: §7.2 funktioniert so technisch nicht als Supabase-Storage-RLS-Vertrag.

Warum:

- Supabase Storage Policies werden auf `storage.objects` fuer die Storage-API-Operation ausgefuehrt. Offizielle Supabase-Doku `https://supabase.com/docs/guides/storage/security/access-control.md` beschreibt die Policies direkt auf `storage.objects`; Upload braucht INSERT, Upsert zusaetzlich SELECT+UPDATE; Beispiele koppeln Ordner an `auth.jwt()->>'sub'` oder `owner_id`.
- `SET LOCAL app.tenant_id` aus §7.3 wirkt nur in derselben Postgres-Transaktion/Connection. Eine Next.js-DB-Transaktion, in der `SET LOCAL` gesetzt wird, propagiert den GUC nicht in die separate Supabase-Storage-API-Anfrage.
- Im echten Code wird Storage nicht mit Nutzer-JWT, sondern mit `SUPABASE_SERVICE_ROLE_KEY` angesprochen: `scan-upload/route.ts`:9-12. Die Supabase-Doku beschreibt Service-Key-Nutzung als RLS-Bypass. Damit beweist dieser Pfad keine Storage-RLS, sondern umgeht sie.
- §3.6 fordert ausserdem `uploaded_by = auth.uid()` fuer Storage (`M6...`:138). `storage.objects` besitzt kein `uploaded_by` aus `scan_uploads`; dafuer muss die Policy entweder `owner_id`/JWT verwenden oder gegen `app_users` ueber `auth.uid()` pruefen.

Erforderliche technische Form:

- Fuer tenantbasierte Ordnerstruktur `{tenant_id}/{scan_upload_id}/...`: Policy muss den Ordnernamen gegen eine authentifizierte Identitaet pruefen, z.B. `exists (select 1 from app_users au where au.id = auth.uid() and au.tenant_id = (storage.foldername(name))[1])`, oder gegen einen vertrauenswuerdigen JWT-App-Metadata-Claim. Nicht `raw_user_meta_data`.
- Alternativ pro User-Ordner: `(storage.foldername(name))[1] = (select auth.jwt()->>'sub')` bzw. `auth.uid()::text`.
- Fuer Upsert/Retry muss der Vertrag INSERT + SELECT + UPDATE separat abdecken. DELETE fuer `authenticated` bleibt ohne Policy und wird negativ getestet.
- Wenn weiterhin Service-Role-Storage im Serverpfad verwendet wird, ist das kein Storage-RLS-Design. Dann muss der Vertrag explizit Application-Layer-Autorisierung, Pfadvalidierung und RLS-Bypass-Tests verlangen; er darf das nicht als `authenticated`-Storage-RLS verkaufen.

## 3. Neue Luecken / Widersprueche V2.2 gegen echten Code

| Befund | Ergebnis | Beleg |
|---|---|---|
| Bestehender Uploadpfad widerspricht Kernregel 17 und SSG-11 | OFFEN | `scan-upload/route.ts` baut Storage-Dateinamen mit `Date.now()` + `Math.random()` (`route.ts`:29-30), speichert `getPublicUrl` in `scan_uploads.fileUrl` (`route.ts`:41-45) und gibt sofort Base64 an OCR (`route.ts`:50-56). V2.2 verlangt kein Mock/Math.random/Fallback im Produktionspfad fuer alle Bausteine (`M6...`:58, 403), aber nennt diesen konkreten vorhandenen Pfad nicht als zu ersetzenden Fund. |
| Edge Function akzeptiert Base64/file_url als OCR-Quelle | OFFEN | `supabase/functions/scan-analyze/index.ts`:15-34 akzeptiert `base64_data` oder `file_url` und fetcht ggf. URL; das widerspricht dem Soll "OCR nur auf gesichertem Original" nur dann nicht, wenn B2 diesen Pfad ersetzt oder hart eingrenzt. V2.2 verlangt Inventar, aber kein explizites Deaktivierungs-/Refactoring-Kriterium fuer diese Function. |
| `orders.received_at` ist Vertragsannahme, aber kein Drizzle-Symbol | OFFEN | `M6...`:117-120 behauptet `received_at` als bestehende betroffene Spalte und T3 schreibt sie in `M6...`:220. `src/db/schema.ts`:82-116 enthaelt `intakeDate`, `source`, `sourceRef`, aber kein `receivedAt`. Implementierung ueber Drizzle kann diese Vertragszeile nicht direkt bauen. |
| SQL-View-Entwurf nutzt TS-Property statt SQL-Spalte | OFFEN | `v_scan_events_timeline` schreibt `se.createdAt AS timestamp` (`M6...`:350). In SQL ist die Spalte `created_at` (`src/db/schema.ts`:169). Das ist ein konkreter Migrationsfehler im Vertragsentwurf. |
| `readonly` darf laut V2.2 Fotos hochladen | OFFEN | Rollenmatrix `M6...`:309-318 gibt `readonly` Upload-Recht. `app_users.role` nennt zwar `readonly` als echten Wert (`src/db/schema.ts`:13), aber der Vertrag belegt nicht, warum eine Readonly-Rolle schreibende Capture-Aktionen ausfuehren darf. Das ist mindestens ein Rollenautorisierungs-Widerspruch zu Kernregel 16. |
| Status-/Event-Alias bleibt Parallelwahrheitsrisiko | OFFEN | `statusEvents = events` ist Alias in `src/db/schema.ts`:235; `status-events.actions.ts` schreibt darueber in `events`:5,40. V2.2 korrigiert auf `events`, aber vorhandene UI/Repository-Namen und alte Migration `0001_app_schema.sql`:83-101 (`status_events`, `metadata`) bleiben als Inventar-/Migrationsrisiko fuer B1/B4 zu erfassen. |

## 4. Max. 5 Korrekturen bei FAIL

1. Storage-RLS neu schreiben: `current_setting('app.tenant_id')` aus §7.2 entfernen oder nur fuer echte DB-Transaktionen verwenden; Storage-Policies ueber `auth.uid()`/JWT-App-Metadata plus `(storage.foldername(name))[1]` und ggf. `app_users`-Lookup spezifizieren; INSERT/SELECT/UPDATE fuer Upsert getrennt, DELETE-Negativtest fuer `authenticated`; Service-Role-Pfad als RLS-Bypass entweder abschaffen oder als Application-Layer-Bypass mit eigenem Testvertrag deklarieren.
2. Schema-Vertrag an echten Drizzle-/SQL-Namen korrigieren: `orders.received_at` entweder als neue Migration + Drizzle-Symbol aufnehmen oder aus T3 entfernen; `se.createdAt` in SQL-Views zu `se.created_at`; `events.order_id` NULLABLE inklusive Drizzle-Schema-Anpassung, nicht nur Remote-Migration.
3. Bestehende Produktionspfade explizit in Scope nehmen: `src/app/api/erfassung/scan-upload/route.ts`, `src/app/actions/erfassung.actions.ts::convertScanToOrder`, `supabase/functions/scan-analyze/index.ts` muessen als zu ersetzende/zu haertende Pfade in B1-B3/B7 auftauchen, inklusive Math.random/Base64/PublicUrl/ServiceRole-Befund.
4. Kernregel-11 nicht nur als neue Wunsch-Action formulieren: B3 muss den vorhandenen `convertScanToOrder`-Pfad atomar ersetzen oder deaktivieren und Rollback fuer Customer, Order, Items, Event, `scan_uploads.conversion_*` sowie `orders.source/source_ref/status` beweisen.
5. Rollenmatrix korrigieren und beweisen: `readonly` darf keine schreibende Capture-/Upload-Aktion bekommen, solange das nicht fachlich und technisch begruendet ist; jede Server-Action braucht Rollen-Negativtests fuer reale Rollenwerte `developer/admin/meister/buero/werkstatt/readonly`.

CONTRACT_VERDICT: FAIL

Claude Opus 4.8 (Red Team) | neue Session: ja | unabhängiger Prüfer | Prüfung gegen Rohbelege, nicht gegen Selbsteinschätzung

# 38 — M6 Vertrag Finale Fremdprüfung V2.3

## Prüfgegenstand

`_agentur_reports/proposals/M6_SLICE1_IMPL_CONTRACT_V2.md` — Version V2.3, Rev 2026-07-06.

Maßstab: Direktive `37_M6_KORREKTUR_DIREKTIVE_V23.md` (Punkte A–F + Grundregel + Abschlussregel), konsolidiert aus Vorprüfung `36_M6_VERTRAG_FREMDPRUEFUNG_V22.md`. Zusätzlich REDTEAM aus `00_AUTORITATIV/02_AUTONOMOUS_MISSION_PROTOCOL.md` und TRUTH aus `00_AUTORITATIV/00_PROJECT_TRUTH.md`.

## Geprüfte Rohbelege (jede Zeilenangabe im Vertrag am echten Code gegengeprüft)

- `src/db/schema.ts` (Z.1–363 vollständig gelesen; alle zitierten Symbole geprüft)
- `src/app/api/erfassung/scan-upload/route.ts` (Z.1–73)
- `src/app/actions/erfassung.actions.ts::convertScanToOrder` (Z.578–680)
- `supabase/functions/scan-analyze/index.ts` (Z.1–133)
- `supabase/migrations/0001_app_schema.sql` (Z.80–113)
- `supabase/migrations/20260621103338_fk_scan_uploads.sql` (Z.1–8)
- `supabase/migrations/20260621103346_add_ocr_provider.sql` (Z.1–15)
- `supabase/migrations/20260621000000_phase2_migrations.sql` (Z.100–114)
- `supabase/migrations/20260611114327_create_storage_buckets.sql` (Z.1–2)
- `_agentur_reports/23_GATE_DRAFT_STABLE_SCAFFOLD_PASS_V5.md` (SSG-Definitionen)
- `src/lib/server/authorization.ts` (resolveAuthorization, Z.54–174) — Beleg für §7.3-Sessiontenant
- **Zusätzlich, adversariell (nicht vom Auftrag vorgegeben, aber REDTEAM-relevant):** `src/components/intake/CameraCapture.tsx`, `src/app/scan/page.tsx`, `src/app/actions/ocr.actions.ts::processImage`, `src/app/actions/orders.actions.ts::createOrderFromScan` (Z.376–498), `src/features/orders/orderPhoto.actions.ts`, `src/components/orders/OrderOverlay.tsx` (Z.425–454), `src/components/erfassung/ScanFlow/ScanResult.tsx`

---

## Belegtreue-Verifikation (Direktive-Punkt B)

**Ergebnis: Jede im Vertrag V2.3 zitierte schema.ts- und Datei-Zeilenangabe wurde am echten Code gegengeprüft und stimmt.** Keine erfundenen oder falschen Zeilenbelege gefunden. Im Einzelnen bestätigt:

| Vertragsaussage | Beleg geprüft | Ergebnis |
|---|---|---|
| `scanUploads` = schema.ts:273–287; `id` mit `$defaultFn(createId)` Z.274; `linked_*` ohne `.references` Z.284–285; `detection_confidence numeric(3,2)` Z.281 | schema.ts:273–287 | KORREKT |
| `ocr_provider` kein Drizzle-Symbol, nur Migration `20260621103346:1` | schema.ts:273–287 (fehlt); Migration Z.1 | KORREKT |
| `events` kanonisch schema.ts:156–170; `orderId ... .notNull()` Z.159; `payload` Z.164; SQL `created_at` Z.169; `tenant_id` Z.158; `event_type` Z.161 | schema.ts:156–170 | KORREKT |
| `orders` schema.ts:82–116 ohne `received_at`; `intake_date` Z.103; `source`/`source_ref` Z.109–110; `order_number` Z.85 | schema.ts:82–116 | KORREKT |
| `items` schema.ts:136–153; `photo_ids` Z.146; `station_sequence` Z.149; `current_step` Z.150 | schema.ts:136–153 | KORREKT |
| `companySettingsTable` schema.ts:339–363 ohne `workflow_templates`; Spalte+Seed `20260621000000:104–113` | schema.ts:339–363; Migration Z.104–113 (4 Routen, Tenant galvanik-kreile) | KORREKT |
| `app_users.role` Z.13 (developer/admin/meister/buero/werkstatt/readonly, Default werkstatt); `app_users.id`/`tenant_id` Z.9–10 | schema.ts:9,10,13 | KORREKT |
| Alias `statusEvents = events` = schema.ts:235 | schema.ts:235 | KORREKT |
| Alt-Migration `status_events`/`metadata` = `0001:83–101`, `metadata` Z.90 | 0001:84 CREATE, Z.90 metadata, Z.100 Ende | KORREKT |
| FK-Migration `20260621103338:1–3`/`:5–7` (linked_order/customer, ON DELETE SET NULL) | Migration Z.1–7 | KORREKT |
| Alt-Policy `tenant_isolation_scan_uploads` FOR ALL nur USING = `20260621103346:3–14` | Migration Z.3–14 (FOR ALL TO authenticated USING, kein WITH CHECK) | KORREKT |
| Bucket `scans` public=false = `20260611114327:1` | Migration Z.1 | KORREKT |
| I-1: Service-Role Z.9–12; Date.now+Math.random Z.29–30; getPublicUrl Z.41–45; Base64-vor-Sicherung Z.50–56; hartkodiert detectedType/Confidence Z.59–60 | route.ts:9–12,30,41–45,50–62,59–60 | KORREKT |
| I-2: keine Transaktion, Einzelwrites Z.621–629/638–648/651–661/664–667; nur linked_* Z.665–666; Auftragsnr Date.now Z.634; tenant aus Scan Z.590 | erfassung.actions.ts:578–680 | KORREKT |
| I-3: base64_data ODER file_url Z.15–19; ungeprüfter fetch Z.29–35 | scan-analyze/index.ts:15–19,29–35 | KORREKT |

Belegtreue ist damit **erfüllt**. Dies ist ein deutlicher Fortschritt gegenüber V2.2 (das `received_at` und `se.createdAt` falsch behauptete).

---

## Nummerierte Funde

### Fund 1 — §2a Ist-Inventar ist unvollständig: mindestens ein weiterer LIVE-Capture-/Auftragspfad und ein weiterer scan_uploads/events-Schreibpfad fehlen — KATEGORIE 1

**Fundort:** Vertrag §2a (I-1…I-4) vs. Code `src/app/scan/page.tsx:206`, `src/components/intake/CameraCapture.tsx:73,84,102`, `src/app/actions/ocr.actions.ts:6`, `src/app/actions/orders.actions.ts:376–498` (`createOrderFromScan`), `src/features/orders/orderPhoto.actions.ts:9–50`, `src/components/orders/OrderOverlay.tsx:430–444`.

**Beschreibung:** Die Grundregel der Direktive 37_ lautet wörtlich: „Der Vertrag muss die EXISTIERENDEN Produktionspfade inventarisieren und je als ‚ersetzen' oder ‚härten' benennen." §2a inventarisiert vier Pfade (I-1…I-4). Am echten Code existieren jedoch mindestens zwei weitere, heute erreichbare Produktionspfade, die der Vertrag nirgends nennt:

1. **Zweiter kompletter Capture→Auftrag-Pfad ohne scan_uploads/Storage:** Die Route `/scan` (`scan/page.tsx`) rendert live `<CameraCapture>` (Z.206). `CameraCapture` erzeugt das Bild per `canvas.toDataURL` als Base64 im React-State (Z.73), ruft `processImage` (`ocr.actions.ts:6` → `extractDocumentData`) direkt auf dem In-Memory-Base64 auf (Z.84/102) und übergibt das Ergebnis via `onScanComplete` an `scan/page.tsx`, das daraus mit **`createOrderFromScan`** (`orders.actions.ts:376`) Kunde + Auftrag anlegt. Dieser Pfad
   - berührt `scan_uploads` und den Storage-Bucket **nie**, sichert also **kein Original** (verletzt Kernregeln 2/3/4),
   - hält das Original ausschließlich im flüchtigen React-State → **Originalverlust bei Refresh/Crash** — exakt das in `00_PROJECT_TRUTH.md` als `K` belegte Kernproblem „Mindestens ein CameraCapture-Pfad verliert das Original bei Refresh/Crash" und „Mindestens zwei aktive Capture-Pfade bestehen",
   - ist ein **zweiter Auftrags-Erstellungspfad aus einem Scan** neben `convertScanToOrder` (I-2). Der Vertrag behauptet in §4.3/B3-AK7 explizit „kein zweiter Parallelpfad" und verlangt „Konsumenten-Inventar aller Aufrufer", nennt als zu ersetzenden Auftragspfad aber ausschließlich `convertScanToOrder`. `createOrderFromScan` bleibt damit als zweite Auftragswahrheit unadressiert; das „kein-Parallelpfad"-Versprechen ist durch das Inventar wie geschrieben nicht einlösbar.

2. **Zweiter direkter Schreibpfad in die kanonische Slice-Tabelle `scan_uploads` UND in `events`:** `uploadOrderPhotoRecord` (`orderPhoto.actions.ts:20–40`) schreibt in einer `db.transaction` sowohl `scan_uploads` (Z.22) als auch `events` (Z.33). Er wird live aus `OrderOverlay.tsx:440` aufgerufen (nach einem Storage-Upload, der bei Z.430 exakt das I-1-Anti-Muster `Date.now()`+getPublicUrl reproduziert). Dieser Pfad schreibt **`tenantId: 'galvanik-kreile'` hartkodiert** (Z.23 und Z.34) statt aus der Session — genau der Tenant-Herkunftsfehler, den §7.3 als „Anti-Vorbild" nur für I-2 brandmarkt. `scan_uploads` ist die zentrale Tabelle des gesamten Slice; ein uninventarisierter Parallelschreiber darauf ist ein Datenintegritäts-/Parallelwahrheitsrisiko.

**Warum Kategorie 1:** Der Fund hat Datenintegritäts- und Schemacharakter (unadressierter Parallelschreiber auf der Kern-Tabelle `scan_uploads`/`events`; hartkodierter Tenant), Original-/Sicherheitscharakter (zweiter Capture-Pfad mit belegbarem Originalverlust) und widerlegt eine tragende Vertragsaussage („kein Parallelpfad", vollständiges Konsumenten-Inventar). Die Direktive-Grundregel „ALLE existierenden Produktionspfade inventarisieren" ist damit nicht erfüllt — nicht als Politur, sondern im Kern der Konvergenzabsicht (§C). Die REDTEAM-Fragen „zweite Wahrheit?", „Originalverlust?", „Dublette/Datenverlust?", „Tenant?" sprechen alle an.

**Kein Widerspruch zur Abschlussregel:** Die Abschlussregel lässt nur Punkte OHNE Sicherheits-/Datenintegritäts-/Schema-Charakter in die Baumissionen wandern. Dieser Fund hat genau diesen Charakter und ist deshalb blockierend, nicht aufschiebbar. Er ist zudem mit einer kleinen Textergänzung behebbar (§2a um I-5 `createOrderFromScan`/`/scan`/`CameraCapture`/`processImage` und I-6 `uploadOrderPhotoRecord`/`OrderOverlay` erweitern, je mit „ersetzen/härten" + Zielmission), also kein Widerspruch zu „kein Stillstand für Papier-Perfektion".

---

### Fund 2 — Rollenmatrix §7.4 vs. Storage-SELECT-Policy §7.2: `developer` wird beim Download stillschweigend ausgeschlossen — KATEGORIE 2

**Fundort:** Vertrag §7.2 (SELECT-Policy-Zeile: „alle aktiven Rollen des Tenants, inkl. `readonly`") vs. §7.4 (`developer` = „App-Vollzugriff auf Nicht-Capture-Funktionen").

**Beschreibung:** Die SELECT-Storage-Policy in §7.2 bindet Lesen an den `app_users`-Lookup ohne Rolleneinschränkung („alle aktiven Rollen"), nennt beispielhaft `readonly`. §7.4 gibt `developer` „App-Vollzugriff auf Nicht-Capture-Funktionen", entzieht ihm aber Upload. Ob `developer` das Original **herunterladen/ansehen** darf, ist zwischen den beiden Abschnitten nicht eindeutig aufgelöst (SELECT-Policy „alle Rollen" schlösse ihn ein; die Kommentierung „nur Nicht-Capture" könnte anders gelesen werden). Das ist eine Feinheit der Berechtigungsformulierung ohne Schema-/Sicherheitsleck (kein Cross-Tenant-Zugriff entsteht dadurch; der Tenant-Lookup greift), aber eine benennbare Inkonsistenz.

**Warum Kategorie 2:** Keine Cross-Tenant-/Schema-/Datenintegritätswirkung; reine Rollenzuschnitts-Präzisierung. Wandert als benannter Punkt in B1 (Storage-Policy-Definition).

---

### Fund 3 — `v_scan_pipeline` joint Kunde über `linked_customer_id`, obwohl Konvertierung `conversion_*` schreibt — KATEGORIE 2

**Fundort:** Vertrag §8.1 (`LEFT JOIN customers c ON c.id = su.linked_customer_id`) vs. §3.1/§4.3 (Konvertierung schreibt `conversion_order_id`, Kunde wird über `orders.customer_id` gebunden; `linked_customer_id` ist laut §3.1-Callout die „manuelle Zuordnung", nicht die Konvertierung).

**Beschreibung:** Die View zeigt den Kundennamen über `linked_customer_id`. Für aus dem Scan **konvertierte** Aufträge wird der Kunde jedoch über den in T3 angelegten/gematchten `orders.customer_id` gebunden, nicht zwingend über `linked_customer_id`. Für einen reinen Konvertierungs-Scan ohne manuelle Zuordnung bliebe `customer_name` in der View leer, obwohl ein Kunde existiert (über `o.customer_id`). Das ist ein View-Design-Detail, das erst B4 gegen echte Testdaten materialisiert; es hat keinen Schema- oder Integritätscharakter (die Daten sind korrekt in der DB, nur die View-Projektion ist evtl. unvollständig).

**Warum Kategorie 2:** Reine View-Logik-Feinheit; korrigierbar in B4 bei tatsächlicher View-Erstellung (SSG-13-Test bringt es ans Licht). Kein blockierender Charakter.

---

### Fund 4 — I-4 nennt Schemadivergenz `status_events` unvollständig (fehlende Spalte `customer_id` in `events`) — KATEGORIE 2

**Fundort:** Vertrag §2a I-4 / §3.2 vs. `0001_app_schema.sql:88` (`status_events.customer_id`) und schema.ts:156–170 (`events` ohne `customer_id`).

**Beschreibung:** §2a I-4 benennt die Divergenz `status_events`/`metadata` vs. `events`/`payload` korrekt. Die Alt-Tabelle `status_events` besitzt zusätzlich eine Spalte `customer_id` (0001:88), die `events` **nicht** hat. Wer im Zuge der Inventarisierung/Härtung (B1/B4) Daten oder Queries von `status_events` auf `events` überführt, verliert diese Spalte bzw. muss sie nach `payload` mappen. Der Vertrag erwähnt das nicht. Das ist ein Inventar-Detail für B1, kein akuter Schema-Bruch des Slice-1-Pfads (der Slice schreibt `order_id`/`payload`, nicht `customer_id`).

**Warum Kategorie 2:** Betrifft nur die spätere vollständige Alt-Tabellen-Ablösung (in §11 ohnehin als späterer Scope deklariert). Wandert als benannter Punkt in B1-Inventar (SSG-00 Remote-Ist).

---

### Fund 5 — SSG-08(c)-Zitat in B5-AK6 ohne belegte Sub-Definition — KATEGORIE 2

**Fundort:** Vertrag B5-AK6 (Zitat „SSG-08(c)").

**Beschreibung:** V5-Gate (`23_...:73`) führt SSG-06…10 als „unverändert" und definiert keine explizite Sub-Nummer (c) für SSG-08. Das Zitat ist plausibel als Verweis auf einen Offline-/Alterungs-Aspekt, aber die konkrete Sub-Definition ist im gelesenen V5/V6-Text nicht wörtlich belegt. Reine Referenz-Genauigkeit ohne inhaltliche Wirkung — das Akzeptanzkriterium selbst (Alterungsbeweis ≥72h, Neustart, Hash-Identität) ist inhaltlich klar und tragfähig.

**Warum Kategorie 2:** Zitat-/Referenz-Feinheit, kein Schema-/Sicherheits-/Integritätscharakter.

---

## Direktive-Abdeckungsmatrix A–F

| Punkt | Anforderung | Status | Beleg |
|---|---|---|---|
| **A1** | `orders.received_at` nicht als bestehend behaupten | ERFÜLLT | §3.3 + §4.3 T3 Schritt 6 entfernen `received_at`, nutzen nur `intake_date` (schema.ts:103 verifiziert; kein received_at in 82–116) |
| **A2** | SQL-Views nutzen `created_at`, nicht `createdAt` | ERFÜLLT | §8.2 nutzt `se.created_at AS timestamp` (schema.ts:169 verifiziert); Grundsatzhinweis in §8.2 |
| **A3** | `events.order_id` in BEIDEN Wahrheiten NULLABLE (Drizzle + Remote) | ERFÜLLT | §3.2/§4.5/B1-AK3: Drizzle `.notNull()` entfernen (schema.ts:159 verifiziert) + information_schema-Beweis |
| **A4** | Idempotenz `UNIQUE(tenant_id, client_idempotency_key)` | ERFÜLLT | §3.1/§6/B1-AK2 |
| **B1** | Storage-RLS gegen authentifizierte Identität statt `current_setting` | ERFÜLLT | §7.2: `EXISTS(app_users au WHERE au.id=auth.uid() AND au.tenant_id=(storage.foldername(name))[1])` bzw. JWT-app_metadata; §4-GUC-Geltungsblock |
| **B2** | INSERT/SELECT/UPDATE getrennt, DELETE-Negativtest | ERFÜLLT | §7.2-Tabelle 3 getrennte Policies, keine DELETE-Policy, B1-AK6 DELETE-Verbot |
| **B3** | Service-Role ehrlich als Bypass deklariert | ERFÜLLT | §7.2 Ehrlichkeitsklausel: Upload/Download auf Nutzer-JWT umgestellt, Service-Pfad nur Systemlöschung mit eigenem Bypass-Test (B1-AK7); route.ts:9–12 als Bypass benannt (verifiziert) |
| **B4** | Kein `uploaded_by`-Bezug in Storage-Policy | ERFÜLLT | §3.6/§7.2: `storage.objects` hat kein `uploaded_by`, Bindung über owner/JWT/app_users-Lookup |
| **C (Inventar vollständig)** | ALLE existierenden Produktionspfade inventarisieren | **NICHT ERFÜLLT** | §2a nennt nur I-1…I-4; live existieren zusätzlich `createOrderFromScan`+`/scan`+`CameraCapture`+`processImage` und `uploadOrderPhotoRecord`+`OrderOverlay` (Fund 1) |
| C (I-1) | scan-upload/route.ts inventarisieren | ERFÜLLT | §2a I-1, alle Zeilenbelege verifiziert |
| C (I-2) | convertScanToOrder inventarisieren | ERFÜLLT | §2a I-2, alle Zeilenbelege verifiziert |
| C (I-3) | scan-analyze/index.ts inventarisieren | ERFÜLLT | §2a I-3, Zeilenbelege verifiziert |
| C (I-4) | Alt-Migration 0001 + Alias inventarisieren | ERFÜLLT (mit Detaillücke Fund 4) | §2a I-4, 0001:83–101 + schema.ts:235 verifiziert |
| **D** | Kernregel 11: T3 ersetzt `convertScanToOrder` atomar, Rollback-Beweis, kein Parallelpfad | TEILWEISE — Atomarität/Rollback ERFÜLLT, „kein Parallelpfad" NICHT ERFÜLLT | §4.3/B3-AK1–AK7 spezifizieren atomare Transaktion + Rollback korrekt; das „kein Parallelpfad"-Versprechen scheitert an uninventarisiertem `createOrderFromScan` (Fund 1) |
| **E** | `readonly` kein Schreibrecht; Rollen-Negativtest je Action über alle sechs Rollen | ERFÜLLT | §7.4: `readonly` nur lesen; Negativtests B2-AK8/B3-AK6/B4-AK7/B6-AK6 über alle sechs Werte (schema.ts:13 verifiziert) |
| **F** | SSG-11/16 (B2-AK5, B4-AK5, B7-AK5) unverschlechtert | ERFÜLLT | B2-AK5/B4-AK5/B7-AK5 unverändert erhalten; Datenquellen-Inventar statt grep, Negativ-Inventar paralleler TS-Fachlogik |
| **G (Grundregel)** | Jede Schema-Aussage gegen schema.ts belegt, remote Unbelegtes als SSG-00 | ERFÜLLT | Alle Zeilenbelege verifiziert (Belegtreue-Tabelle); SSG-00-Markierung konsequent (§3, §3.5, §3.6) |

**SSG-00-Disziplin (Direktive-Punkt C der Prüfung):** ERFÜLLT. Remote-Unbelegtes ist durchgängig als „SSG-00 remote zu verifizieren" markiert (FK-Anwendung, Policy-Ist, workflow_templates-Existenz, Bucket-Remote-Zustand, information_schema-Beweise) und nirgends als Remote-Fakt behauptet.

**Storage-RLS-Korrektheit (Direktive-Punkt E der Prüfung):** ERFÜLLT. §7.2 ist technisch tragfähig: `auth.uid()`/`app_users`-Lookup bzw. JWT-app_metadata statt `current_setting`; INSERT/SELECT/UPDATE getrennt mit Upsert-Begründung; DELETE ohne Policy + Negativtest; Service-Role ehrlich als Bypass mit eigenem Test deklariert; `raw_user_meta_data` ausdrücklich ausgeschlossen. Der Sessiontenant-Mechanismus §7.3 ist durch `resolveAuthorization` (authorization.ts:113,168) real belegt.

---

## Gesamturteil

Belegtreue, SSG-00-Disziplin, Storage-RLS-Technik (A/B/E/F/G) sind vollständig und sauber umgesetzt — ein echter Konvergenzfortschritt. Es verbleibt jedoch **ein Fund mit Datenintegritäts-/Schema-/Original-Charakter (Fund 1, Kategorie 1):** Das §2a-Ist-Inventar ist unvollständig; mindestens ein weiterer live erreichbarer Capture→Auftrag-Pfad (`createOrderFromScan`/`/scan`/`CameraCapture`, mit belegbarem Originalverlust und als zweite Auftragswahrheit neben `convertScanToOrder`) und ein weiterer direkter Schreibpfad auf die Kern-Tabellen `scan_uploads`/`events` (`uploadOrderPhotoRecord`/`OrderOverlay`, mit hartkodiertem Tenant) sind nicht inventarisiert. Damit ist die tragende Direktive-Grundregel (§C: ALLE Produktionspfade inventarisieren) und das eigene „kein-Parallelpfad"-Versprechen des Vertrags (§4.3/§D) nicht erfüllt. Dieser Fund fällt unter den Sicherheits-/Datenintegritäts-Vorbehalt der Abschlussregel und ist deshalb blockierend, nicht in eine Baumission verschiebbar.

Funde 2–5 sind Kategorie 2 und wandern gemäß Abschlussregel als benannte Punkte in ihre Baumissionen (B1: Fund 2/4; B4: Fund 3/5).

```
CONTRACT_VERDICT: FAIL
```

Behebungshinweis (minimal, kein Stillstand für Papier-Perfektion): §2a um zwei Inventar-Zeilen (I-5 `createOrderFromScan`/`/scan`/`CameraCapture`/`ocr.actions.processImage` → „ersetzen", Zielmission B2/B3; I-6 `uploadOrderPhotoRecord`/`OrderOverlay.tsx:430,440` → „ersetzen/härten", Zielmission B1/B2) erweitern und die entsprechenden Konsumenten-Inventar-AKs (B3-AK7) auf beide Auftragspfade beziehen. Damit ist Fund 1 geschlossen; Funde 2–5 bleiben als benannte Baumissions-Punkte bestehen.

---

## A. Scope der Prüfung (Pflichtteil 1)

**Auftrag:** Finale unabhängige Fremdprüfung des Slice-1-Implementierungsvertrags V2.3 gegen Direktive 37_ (A–F + Grundregel + Abschlussregel), Vorprüfung 36_, und die genannten Rohbelege. Adversariell: Versuch, den Vertrag zu widerlegen (Belegtreue, SSG-00-Disziplin, fachliche Konsistenz, Storage-RLS, REDTEAM).
**Im Scope:** Vertrag V2.3 vollständig (§0–§14); jede zitierte schema.ts-/Datei-Zeilenangabe am Code; §7.2-Storage-RLS-Technik; Direktive-Abdeckung A–F; adversariell die reale Capture-/scan_uploads-/events-Pfadlandschaft im Twin.
**Außer Scope (bewusst):** Remote-DB-/Storage-/Deploy-Verifikation (SSG-00 — Lab-only, kein Remote ausgeführt); UI-/Interaktionsdesign (nachgelagerter Claude-Design-Vertrag); Ausführung von Migrationen, Builds oder Tests; jede Änderung an Vertrag oder Code (Nur-Lesen-Auftrag).
**Twin-Kontext:** `kreile-agentur-twin-20260703-233807`, autoritative Quelle `02_app`. Kein `git`-HEAD/`git status` im Auftrag angefordert; Prüfung gegen den vorgefundenen Arbeitsbaum.

## B. Gelesene Quellen — synthesiert (Pflichtteil 2)

- **Kriteriendokumente:** Direktive `37_` (verbindliche A–F) und Vorprüfung `36_` (deren Funde 37_ konsolidiert) — beide vollständig gelesen; sie bilden den Maßstab.
- **Prüfgegenstand:** `proposals/M6_SLICE1_IMPL_CONTRACT_V2.md` V2.3 vollständig (Z.1–709).
- **Schema-Wahrheit:** `src/db/schema.ts` Z.1–363 vollständig (Kern-Tabellen); Rest der Datei nicht relevant für zitierte Symbole.
- **Ist-Pfade (vom Vertrag inventarisiert):** `scan-upload/route.ts`, `erfassung.actions.ts::convertScanToOrder`, `scan-analyze/index.ts` — alle Zeilenbelege verifiziert.
- **Migrationen:** 0001, fk_scan_uploads, add_ocr_provider, phase2_migrations, create_storage_buckets — alle zitierten Zeilen verifiziert.
- **Gate/SSG:** `23_...V5.md` (SSG-Definitionen, referenziert von V6).
- **Adversariell zusätzlich (nicht im Auftrag, aber REDTEAM-Pflicht):** `authorization.ts` (§7.3-Beleg), sowie die uninventarisierten Pfade `CameraCapture.tsx`, `scan/page.tsx`, `ocr.actions.ts`, `orders.actions.ts::createOrderFromScan`, `orderPhoto.actions.ts`, `OrderOverlay.tsx`, und die Konsumenten-Kette `ErfassungModal.tsx` → `ScanUpload.tsx` → `ScanResult.tsx`.
**Synthese:** Der Vertrag steht schema-technisch sauber auf dem echten Code; die einzige tragende Lücke liegt nicht im Zitat, sondern in der Vollständigkeit des Pfad-Inventars (§2a).

## C. Fakten (Pflichtteil 3)

1. Alle im Vertrag zitierten schema.ts-/Migrations-/Datei-Zeilen stimmen mit dem Code überein (Belegtreue-Tabelle oben). Keine erfundenen Belege.
2. `events.order_id` ist in Drizzle `.notNull()` (schema.ts:159); der Vertrag adressiert beide Wahrheiten korrekt (A3).
3. `orders` hat kein `received_at`; `intake_date` (Z.103) deckt die Semantik (A1) — korrekt behoben.
4. `ocr_provider` und `workflow_templates` haben kein Drizzle-Symbol; nur Migrationen — korrekt als Lücke markiert (G1/G2).
5. Die alte Storage-Policy `tenant_isolation_scan_uploads` ist `FOR ALL` nur mit `USING` (20260621103346:10–12) — korrekt als Anti-Muster/zu droppen benannt.
6. `resolveAuthorization` (authorization.ts:113,168) leitet den Tenant serverseitig aus `app_users` ab — §7.3 ist real belegt.
7. **Neu, adversariell belegt:** `/scan` (page.tsx:206) → `CameraCapture` → `processImage` → `createOrderFromScan` (orders.actions.ts:376) ist ein zweiter, live erreichbarer Capture→Auftrag-Pfad, der `scan_uploads`/Storage nie berührt und das Original nur im React-State hält.
8. **Neu, adversariell belegt:** `uploadOrderPhotoRecord` (orderPhoto.actions.ts:20–40, aufgerufen aus OrderOverlay.tsx:440) schreibt `scan_uploads` und `events` mit hartkodiertem `tenantId: 'galvanik-kreile'`.
9. Der ScanFlow-Auftragspfad läuft `ErfassungModal.tsx:33/35` → `ScanUpload.tsx:26` (I-1) → `ScanResult.tsx:22` (`convertScanToOrder`, I-2); nur dieser ist im Vertrag inventarisiert.

## D. Annahmen (Pflichtteil 4)

1. **A-SSG00:** Der Twin-Arbeitsbaum entspricht dem für die Prüfung intendierten Source-Stand (`02_app`, Branch `feature/capture-auth-tenant`). Nicht per HEAD-Vergleich verifiziert (im Auftrag nicht gefordert). Wirkung falls falsch: Zeilenbelege könnten gegen einen veralteten Stand geprüft sein — Risiko gering, da Vertrag und Code im selben Twin liegen.
2. **A-LIVE:** `/scan`, `OrderOverlay`-Foto-Upload und ScanFlow sind produktiv erreichbare Routen (kein Feature-Flag/Dead-Code). Belegt durch importierende, gerenderte Konsumenten (page.tsx, ErfassungModal, OrderOverlay); keine Flag-Guard davor gefunden. Wirkung falls falsch (einer der Pfade wäre toter Code): Fund 1 könnte von Kategorie 1 auf Kategorie 2 sinken — deshalb explizit als zu klärender Punkt an B1/B3 übergeben (Handoff).
3. **A-DEEP:** Es wurde die Capture-/Auftrags-/scan_uploads-/events-Landschaft geprüft, nicht jeder denkbare Schreibpfad jeder Tabelle. Weitere uninventarisierte Pfade sind nicht ausgeschlossen (siehe „nicht geprüfte Bereiche").

## E. Findings mit IDs (Pflichtteil 5) — konsolidiert

| ID | Kurzbeschreibung | Kategorie | Fundort |
|---|---|---|---|
| F-38-01 | §2a-Inventar unvollständig: 2 weitere Live-Pfade (`createOrderFromScan`/`/scan`/`CameraCapture`; `uploadOrderPhotoRecord`/`OrderOverlay`) fehlen; „kein Parallelpfad"-Versprechen nicht einlösbar; Originalverlust; hartkodierter Tenant | 1 (blockierend) | Fund 1 |
| F-38-02 | `developer`-Download in §7.2-SELECT vs. §7.4 nicht eindeutig aufgelöst | 2 | Fund 2 |
| F-38-03 | `v_scan_pipeline` joint Kunde über `linked_customer_id` statt Konvertierungs-Kunde | 2 | Fund 3 |
| F-38-04 | I-4 nennt `status_events.customer_id`-Divergenz nicht | 2 | Fund 4 |
| F-38-05 | SSG-08(c)-Zitat ohne belegte Sub-Definition | 2 | Fund 5 |

## F. Root Causes (Pflichtteil 6)

- **F-38-01 (Wurzel):** Das Inventar wurde entlang der Direktive-Tabelle 37_ §C erstellt (die exemplarisch vier Pfade nannte), statt eine eigene erschöpfende Suche nach ALLEN `scan_uploads`-/`events`-Schreibern und ALLEN Capture→Auftrag-Ketten durchzuführen. Die Direktive nannte Beispiele; der Vertrag las sie als abschließende Liste. Die TRUTH-Warnung „mindestens zwei aktive Capture-Pfade" hätte den Autor zur Zweitsuche zwingen müssen.
- **F-38-02/03:** Policy-/View-Text wurde konzeptionell formuliert, ohne die konkrete Rollen-/Spaltensemantik gegen Konvertierungs- vs. Zuordnungsfälle durchzuspielen — materialisiert sich erst beim Bau (B1/B4).
- **F-38-04/05:** Referenz-/Detailtiefe; kein systemischer Fehler.

## G. Verträge / Konsumenten-Analyse (Pflichtteil 7)

**Zwei konkurrierende Auftrags-Erstellungsverträge aus einem Scan (Kern der Parallelwahrheit):**

1. **Vertrag A — ScanFlow (inventarisiert):** Konsumenten-Kette `ErfassungModal.tsx:33/35` → `ScanUpload.tsx:26` (POST `/api/erfassung/scan-upload`, I-1) → Polling `scan-status/[id]` → `ScanResult.tsx:22` `convertScanToOrder(data.id)` (I-2). Datenanker: `scan_uploads`. Der Vertrag ersetzt hier I-1 (B2) und I-2 (B3).
2. **Vertrag B — /scan (NICHT inventarisiert):** `scan/page.tsx:206` `<CameraCapture>` → `processImage` (ocr.actions.ts:6) → `scan/page.tsx:45` `createOrderFromScan` (orders.actions.ts:376). Kein `scan_uploads`, kein Storage, Original nur im State. **Zweiter Auftrags-Vertrag mit eigener Kundenanlage-Logik** (orders.actions.ts:399–498), der neben T3 weiterläuft.

**Konsequenz für Kernregel 14 / Konsumentenbeweis:** B3-AK7 verlangt „Konsumenten-Inventar aller Aufrufer" von `convertScanToOrder`. Belegt ist dessen einziger Aufrufer `ScanResult.tsx:22`. Aber der parallele Vertrag B (`createOrderFromScan`, Aufrufer `scan/page.tsx:45`) fällt aus dem Inventar. Solange Vertrag B existiert, ist „genau ein kanonischer Capture-Vertrag" (Kernregel 1) und „kein Parallelpfad" (§4.3/§D) faktisch verletzt.

**Direkte scan_uploads/events-Schreiber (Datenvertrags-Ebene):** Kanonisch soll nur die Slice-Saga schreiben. Real schreiben zusätzlich: I-1 (`scan-upload/route.ts:43`), I-2 (`erfassung.actions.ts:664`), und uninventarisiert `uploadOrderPhotoRecord` (`orderPhoto.actions.ts:22,33`). Letzterer ist ein Konsument, der die Kern-Tabelle mit hartkodiertem Tenant befüllt und in §7.3s Tenant-Herkunfts-Regel ein Loch reißt, das der Vertrag nicht adressiert.

## H. Risiken (Pflichtteil 8)

| Risiko | Eintritt | Auswirkung | Schwere |
|---|---|---|---|
| Vertrag B (`createOrderFromScan`) bleibt beim Bau unangetastet, weil nicht inventarisiert → zweite Auftragswahrheit produktiv | hoch (Pfad ist live, nicht im Scope) | Doppelaufträge/inkonsistente Kundenanlage, Original nie gesichert, Kernregel 1/2/11 verletzt trotz „PASS" | hoch |
| `uploadOrderPhotoRecord` bleibt Parallelschreiber auf `scan_uploads`/`events` mit hartkodiertem Tenant | hoch | Tenant-Spoofing-Vektor bei Mandantenausbau, Parallelwahrheit auf Kern-Tabelle | hoch |
| Originalverlust im `/scan`-Pfad bei Refresh/Crash bleibt bestehen | hoch | Nachweispflicht Wareneingang nicht erfüllbar; TRUTH-Kernproblem ungelöst | hoch |
| §7.2 `developer`/`readonly`-Download-Zuschnitt beim Bau falsch abgeleitet (F-38-02) | mittel | Fehlberechtigung, aber kein Cross-Tenant-Leck | niedrig |
| `v_scan_pipeline` zeigt konvertierte Aufträge ohne Kundennamen (F-38-03) | mittel | UI-Anzeige unvollständig, keine Datenintegritätsverletzung | niedrig |

## I. Empfehlungen — priorisiert (Pflichtteil 9)

- **P0 (blockierend, vor Akzeptanz):** §2a um I-5 (`createOrderFromScan`/`/scan`/`CameraCapture`/`processImage` → „ersetzen", B2/B3) und I-6 (`uploadOrderPhotoRecord`/`OrderOverlay.tsx:430,440` → „ersetzen/härten", B1/B2) erweitern; B3-AK7 auf beide Auftrags-Verträge (A und B) und alle Konsumenten beziehen; §7.3-Anti-Vorbild explizit auch auf `orderPhoto.actions.ts` (hartkodierter Tenant) ausweiten. Danach ist F-38-01 geschlossen.
- **P1 (in B1):** F-38-02 (`developer`-Download-Zuschnitt in §7.2/§7.4 vereindeutigen) und F-38-04 (`status_events.customer_id`-Divergenz ins B1-Remote-Ist-Inventar) als benannte Baumissions-Punkte aufnehmen.
- **P2 (in B4):** F-38-03 (`v_scan_pipeline`-Kunden-Join über Konvertierungs-Kunde statt `linked_customer_id` prüfen) und F-38-05 (SSG-08(c)-Referenz präzisieren) beim View-Bau lösen.
- **Nicht ändern:** A–E/G und §7.2-Technik sind korrekt und sollten nicht angefasst werden (Regressionsrisiko).

## J. Nicht geprüfte Bereiche (Pflichtteil 10)

- **Remote-DB/Storage/RLS zur Laufzeit:** nicht ausgeführt (SSG-00, Lab-only). Alle „remote"-Aussagen des Vertrags bleiben unbewiesen — der Vertrag markiert sie korrekt als SSG-00; die Prüfung bestätigt die Markierung, nicht die Remote-Realität.
- **Vollständige Schreiber-Suche über ALLE Tabellen:** geprüft wurde die Capture-/`scan_uploads`-/`events`-/Auftrags-Landschaft. Andere Tabellen (z.B. `inquiries.convertedToOrderId`, `calendar_events`) wurden nicht auf weitere Auftrags-Parallelpfade durchsucht.
- **IndexedDB/Offline-Code (B5):** kein Offline-Client-Code existiert heute; B5 ist reiner Neubau — nicht gegen bestehenden Code prüfbar.
- **`geminiOcr.ts`/`extractDocumentData`-Interna:** als OCR-Blackbox behandelt; nicht auf Mock/`Math.random` im Inneren geprüft (Kernregel 17 nur an den inventarisierten Aufrufstellen bewertet).
- **schema.ts:364–709:** nicht relevant für zitierte Symbole; nicht zeilenweise geprüft.

## K. Registeränderungen (Pflichtteil 11)

Keine. Der Auftrag ist Nur-Lesen; es wurde ausschließlich der Prüfbericht `38_M6_VERTRAG_FINALE_FREMDPRUEFUNG_V23.md` geschrieben. Kein autoritativer Baum, kein Register, keine Vertrags- oder Code-Datei wurde verändert (V5/5.3: Baum vor PASS eingefroren). Empfohlene, aber NICHT vom Prüfer ausgeführte Folgeeintragung (Sache des Schreibagenten/Auftraggebers): V2.4-Revision des Vertrags mit I-5/I-6, danach erneute Kurzprüfung nur des Deltas.

## L. Handoff (Pflichtteil 12)

- **An Schreibagent (V2.4):** F-38-01 gemäß P0 beheben (I-5/I-6 in §2a, B3-AK7 erweitern, §7.3 auf `orderPhoto.actions.ts` ausweiten). Kategorie-2-Funde als benannte Punkte in B1/B4 aufnehmen, nicht im Vertragskern.
- **An B1-Mission:** F-38-02 (Rollen-Download-Zuschnitt), F-38-04 (`status_events.customer_id`), Remote-Ist von I-6-Schreibpfad und dessen Tenant-Herkunft klären.
- **An B3-Mission:** Vor Ersetzung von `convertScanToOrder` zwingend auch `createOrderFromScan` (Vertrag B) und dessen Konsument `scan/page.tsx:45` deaktivieren/ersetzen; sonst bleibt die zweite Auftragswahrheit trotz „PASS" bestehen. Vor-Klärung zu A-LIVE: sind `/scan` und der OrderOverlay-Foto-Upload produktiv oder Legacy? Falls Legacy → Fund 1 auf Kategorie 2 herabstufbar; die Entscheidung braucht einen Laufzeit-/Routenbeleg, nicht nur eine Behauptung.
- **An Auftraggeber:** Ein CONTRACT_VERDICT: FAIL mit genau einem klar behebbaren Kategorie-1-Fund; die Behebung ist eine kleine Vertragsergänzung, kein Neuentwurf. Nach V2.4 genügt eine Delta-Prüfung.

## M. Syntheseurteil über Direktive-Erfüllung und Abschlussregel (Pflichtteil 13)

Die Direktive 37_ zielte auf Konvergenz in EINEM Durchgang. Punkte A, B, E, F, G und die SSG-00-Grundregel sind vollständig und code-verifiziert erfüllt — der Vertrag steht schema-technisch erstmals sauber auf dem echten Code, ein echter Fortschritt gegenüber V2.2. Punkt C (Grundregel „ALLE existierenden Produktionspfade inventarisieren") und in der Folge Punkt D („kein Parallelpfad") sind NICHT erfüllt: das §2a-Inventar ist unvollständig um mindestens zwei live erreichbare Pfade.

Anwendung der Abschlussregel: Sie lässt Akzeptanz nur zu, wenn die finale Prüfung „nur noch Punkte ohne Sicherheits-/Datenintegritäts-/Schema-Charakter" findet. F-38-01 hat genau diesen Charakter (Parallelschreiber auf Kern-Tabelle, hartkodierter Tenant, zweite Auftragswahrheit, Originalverlust) und fällt damit ausdrücklich unter den Vorbehalt der Regel — es ist kein „Papier-Perfektionismus", sondern der von der Regel selbst geschützte Kernbereich. Deshalb: kein Akzeptanz-PASS. Da die Behebung minimal ist (zwei Inventar-Zeilen + AK-Erweiterung), entsteht kein Stillstand; die Regel „kein Streben nach Papier-Perfektion um den Preis des Stillstands" bleibt gewahrt, weil die Nachbesserung klein und abschließend ist. Funde F-38-02…05 wandern regelkonform als benannte Punkte in B1/B4.

---

## Nachprüfung V2.4 (2026-07-06)

**Scope:** Ausschließlich die Behebung des Kategorie-1-Fundes F-38-01, adversariell gegen die Rohbelege. Kein Neuentwurf der Gesamtprüfung. Geprüfte neue/geänderte Vertragsteile: §2a (I-5/I-6), §4.3-Kopfblock, §7.2/§7.4, §8.1, B1-Scope, B2-Scope+AK11/AK12, B3-Scope+AK7, §12, §15. Alle im Vertrag neu aufgenommenen Zeilenbelege wurden am echten Code gegengeprüft (nicht dem §15-Änderungsprotokoll geglaubt).

### A. Ist F-38-01 vollständig geschlossen? — JA

- **I-5 (§2a Z.75):** Zweiter Capture→Auftrag-Pfad `/scan` → `CameraCapture` → `processImage` → `createOrderFromScan` korrekt inventarisiert, Behandlung „ERSETZEN" (Capture-Teil B2, Auftrags-Teil B3), Zielmission plausibel. Zusätzlich sauber benannt: stiller OCR-Fallback (ocr.actions.ts:11) und Mock-Pfad `simulateScan` (ocr.actions.ts:16–19) als Kernregel-17-Verstöße; Dummy-Adressen-Kundenanlage (orders.actions.ts:428–432); `source` ohne `source_ref` (Z.467); getrennte Actions ohne Transaktionsgrenze (Z.424/471).
- **I-6 (§2a Z.76):** Zweiter direkter Schreibpfad auf `scan_uploads`/`events` (`uploadOrderPhotoRecord`/`OrderOverlay`) korrekt inventarisiert, Behandlung „ERSETZEN/HÄRTEN" (B1-Inventar, B2-Härtung), Zielmission plausibel; hartkodierter Tenant (Z.23/34) und I-1-Anti-Muster-Reproduktion in OrderOverlay (Z.430/438/442) benannt.
- **AK-Abdeckung lückenlos:** §4.3-Kopf (Z.246) + B3-Scope (Z.518) + **B3-AK7 (Z.532)** decken jetzt ausdrücklich BEIDE Auftragswahrheiten — `convertScanToOrder` (I-2, Konsument `ScanResult.tsx:22`) UND `createOrderFromScan` (I-5, Konsument `scan/page.tsx:45`). Der zentrale Vorwurf aus F-38-01 (uninventarisierter zweiter Auftragsvertrag, „kein Parallelpfad"-Versprechen nicht einlösbar) ist damit geschlossen: nach B3 existiert genau EIN transaktionaler Auftragspfad, Konsumenten-Inventar umfasst alle Aufrufer beider Pfade. **B2-AK11** (I-5-Capture ersetzt, Mock/stiller Fallback raus) und **B2-AK12** (I-6 gehärtet: Session-Tenant, kein getPublicUrl, kein clientseitiger Date.now-Upload) schließen die Capture-/Schreibpfad-Seite. Kein Konsument bleibt unadressiert.

### B. Stimmen die neu aufgenommenen Zeilenbelege? — JA, alle am Code verifiziert

| Beleg | Code-Verifikation | Ergebnis |
|---|---|---|
| `scan/page.tsx:9/45/206` | Import Z.9, `createOrderFromScan`-Aufruf Z.45, `<CameraCapture>` Z.206 | KORREKT |
| `CameraCapture.tsx:73/84/99–108` | `canvas.toDataURL` Z.73, `processImage` Z.84, FileReader-Zweig Z.99–108 | KORREKT |
| `ocr.actions.ts:6–19` (Fallback Z.11, Mock Z.16–19) | `processImage` Z.6–8, `{ rawText: "OCR fehlgeschlagen" }` Z.11, `processImageWithAI`/`simulateScan` Z.16–19 | KORREKT |
| `orders.actions.ts:376–498, 424, 428–432, 467, 471` | Funktion 376–498; `createCustomerDb` Z.424; Dummy-Adresse Z.428–432; `source:"scan"` (kein source_ref) Z.467; `createOrderDb` Z.471 | KORREKT |
| `orderPhoto.actions.ts:9–50, 22–30, 33–39, 23/34, 28–29` | Funktion 9–50; scan_uploads-Insert 22–30; events-Insert 33–39; `tenantId:'galvanik-kreile'` Z.23 u. Z.34; `status:'processed'`/`detectedType:'Foto'` Z.28–29 | KORREKT |
| `OrderOverlay.tsx:422–455, 430, 438/442, 440` | Upload-Block 425–454 (∈422–455); `Date.now()`+Tenant-Pfad Z.430; `getPublicUrl` Z.438, `fileUrl` Z.442; `uploadOrderPhotoRecord`-Aufruf Z.440 | KORREKT |
| `0001_app_schema.sql:88` (`customer_id`) | Z.88 `customer_id uuid` in `status_events` | KORREKT |
| `schema.ts:86` (`orders.customer_id`) | Z.86 `customerId: text("customer_id").notNull().references(...)` | KORREKT |

Keine falschen oder erfundenen Zeilenbelege. Belegtreue der V2.4-Ergänzungen vollständig.

### C. Neue Fehler/Widersprüche durch die Inline-Fixes? — NEIN

- **Fund 2 (§7.2/§7.4-Konsistenz):** §7.2-SELECT (Z.356) nennt jetzt ausdrücklich alle sechs Rollen inkl. `developer` (Lesen im eigenen Tenant erlaubt, nur Upload ausgeschlossen); §7.4-`developer`-Zeile (Z.384) präzisiert entsprechend („Lesen/Download im eigenen Tenant erlaubt, kein Capture-Upload"). Konsistent, kein Widerspruch. INSERT bleibt auf `werkstatt/meister/buero/admin` beschränkt — `developer`/`readonly` weiterhin ohne Upload.
- **Fund 3 (§8.1-View-SQL):** `LEFT JOIN customers c ON c.id = COALESCE(su.linked_customer_id, o.customer_id)` (Z.410) ist SQL-technisch korrekt; Join-Reihenfolge sauber (`orders o` Z.409 vor `customers c` Z.410, damit `o.customer_id` verfügbar ist); beide Spalten sind `text`, COALESCE typkompatibel; Spaltenbeleg `orders.customer_id` schema.ts:86 stimmt. Kein neuer Fehler.
- **Fund 5:** B5-AK6 auf `SSG-08` korrigiert; Kriteriuminhalt unverändert. Korrekt.

### D. Weiterer uninventarisierter Live-Produktionspfad? — NEIN (auf Basis der bereits durchgeführten adversariellen Suche)

Kein konkreter weiterer Verdacht. Die in der Erstprüfung gefundenen zwei Pfade sind jetzt als I-5/I-6 inventarisiert. Die vollständige Menge der realen `scan_uploads`-/`events`-Schreiber und Capture→Auftrag-Ketten aus meiner Codesuche (`scan-upload/route.ts` = I-1; `convertScanToOrder` = I-2; `scan-analyze` = I-3; `createOrderFromScan`/`/scan`/`CameraCapture` = I-5; `uploadOrderPhotoRecord`/`OrderOverlay` = I-6) ist damit abgedeckt. Vorbehalt unverändert aus der Erstprüfung (Abschnitt J): eine erschöpfende Suche über ALLE Tabellen wurde nicht durchgeführt; andere Auftrags-Attributionspfade (z.B. `inquiries.convertedToOrderId`) liegen außerhalb des Slice-1-Scans und sind kein Capture-/scan_uploads-Pfad.

### Verbleibende Kategorie-2-Punkte (regelkonform in Baumissionen)

- **F-38-04 → B1:** `status_events.customer_id`-Divergenz (0001:88) beim Remote-Ist-Inventar/Überführung berücksichtigen (in §2a I-4 und B1-Scope Z.464 benannt).
- **F-38-03 (Rest-Verifikation) → B4:** COALESCE-Kunden-Join gegen Testdaten belegen (B4-AK3, SSG-13).
- F-38-02 und F-38-05 sind inline geschlossen (§7.2/§7.4 bzw. B5-AK6). Kein blockierender Punkt verbleibt.

### Verdict der Nachprüfung

F-38-01 (einziger Kategorie-1-Fund) ist vollständig und code-verifiziert geschlossen; die Inline-Fixes der Kategorie-2-Funde führen keine neuen Fehler ein; kein weiterer Kategorie-1-Fund verbleibt. Verbleibende Kategorie-2-Punkte sind namentlich ihren Baumissionen zugeordnet (F-38-04 → B1, F-38-03-Rest → B4).

```
CONTRACT_VERDICT_V24: PASS
```

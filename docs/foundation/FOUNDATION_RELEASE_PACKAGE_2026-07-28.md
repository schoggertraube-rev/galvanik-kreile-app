# Kreile Fundament – Freigabepaket 2026-07-28

## Abschlussstatus

`FAIL_INTERNAL — NO_GO, PR #20 bleibt Draft`

Dieses Paket setzt den bestehenden Sanierungsstrang fort. Es ist kein Reset,
kein neuer Produkt-Clone und keine Behauptung, dass die Anwendung bereits
verkaufs- oder produktionsreif ist. Es dokumentiert die einzigen vorhandenen
Produktziele, die lokale Reparaturbasis und den prüfbaren Weg zur Freigabe.

Nicht ausgeführt: Remote-Migration, RLS-/Policy-/Grant-Änderung,
Production-Deployment, Merge nach `main`, Löschung, Reset oder Stash.

## 1. Kanonischer Stamm und PR-Beweis

| Gegenstand | Beleg zum Zeitpunkt der Prüfung | Entscheidung |
| --- | --- | --- |
| Physischer Produkt-Root | `C:/Antygravityprojekte/04_Kundenprojekte/galvanik_kreile/02_app` | `CANONICAL` als Produktordner, aber **preserve-only**: Checkout `feature/capture-auth-tenant` bei `8cf9e6c` mit fremden Untracked-Artefakten. In diesem Lauf nicht verändert. |
| Release-Wahrheit | `origin/main` = `6e1d1831be823b7655130f0f46ba964d45c4b8dc` | alleinige Merge-/Releasebasis. Der lokale Branch `main` ist nicht maßgeblich und hinter `origin/main`. |
| Temporärer Reparatur-Worktree | `02_app_r14c_s1_clean`, Branch `codex/foundation-consolidation-v3-20260728` | `TEMPORARY`; einzig beschriebener Worktree dieses Laufs. |
| Reparaturbasis | `f59f1ce4632058ed55ea3c678d756f085b95dc41` | lokaler, gehookter Commit: Identity-Snapshot, Dev-Bypass, W1-Nullability, Wahrheitsanzeige für Kundennummer. |
| PR #20 (remote bei Prüfbeginn) | Draft, Head `65780f6f6abe3b13ac2e1300d12485b7bf6295e8`, Base `origin/main` | **REWORK**, nicht mergen. |
| Git-Beziehung | `merge-base(origin/main, f59f1ce)=6e1d183`; `git rev-list --left-right --count origin/main...f59f1ce` = `0 3` | Ein späterer normaler, nicht erzwungener Merge würde keine fremde `origin/main`-Arbeit überschreiben. Er ist dennoch wegen der folgenden NO-GOs verboten. |
| Remote | `origin = https://github.com/schoggertraube-rev/galvanik-kreile-app.git` | einziges Repository im Nachweis. |
| Produktziele | Supabase `syhaigjhsbpjmtnggqka`; vorhandenes Vercel-Projekt/Preview | kein neues Projekt angelegt. Browser-Preview hinter SSO wird nicht als erfolgreicher Produktsmoke behauptet. |

### Worktree-Entscheidungen

`ARCHIVE_CANDIDATE` bedeutet nur „aufbewahren und später gezielt salvagen“.
Es bedeutet weder Löschung noch eine Aussage, dass der Inhalt unbrauchbar ist.

| Worktree | SHA | Entscheidung | Begründung |
| --- | --- | --- | --- |
| `02_app` | `8cf9e6c` | `CANONICAL` | Produkt-Root, Dirty-Preserve-Checkout; Release kommt ausschließlich aus `origin/main`. |
| `02_app/.agents/p0-hotfix-no-pin-payload` | `33f3e7d` | `ARCHIVE_CANDIDATE` | alter P0-Nebenstrang. |
| `02_app/.agents/w0-api-02f-scan-upload` | `e1b8b8e` | `ARCHIVE_CANDIDATE` | alter Capture-Nebenstrang. |
| `02_app/.claude/worktrees/ux-recovery-001` | `c786224` | `UNKNOWN` | UX-Recovery nicht als Fundamentquelle bewertet; behalten. |
| `02_app_logout_verify` | `27c4634` | `ARCHIVE_CANDIDATE` | isolierter Logout-Nachweis. |
| `02_app_offline_diag` | `1621702` | `ARCHIVE_CANDIDATE` | Diagnose-Nebenstrang, kein Releasezweig. |
| `02_app_r14c_s1_clean` | `f59f1ce` | `TEMPORARY` | aktueller Reparatur-/Draft-PR-Worktree. |
| `_agent_worktrees/foundation-contract-reconciliation-20260727` | `338a13c` | `ARCHIVE_CANDIDATE` | frühere Vertragsrekonstruktion. |
| `_agent_worktrees/foundation-hardening-20260714` | `6e1d183` | `ARCHIVE_CANDIDATE` | historischer Main-Snapshot. |
| `_agent_worktrees/foundation-reconstruction-20260727` | `338a13c` | `ARCHIVE_CANDIDATE` | frühere Rekonstruktion. |
| `_agent_worktrees/foundation-security-remediation-20260715` | `338a13c` | `ARCHIVE_CANDIDATE` | Salvage-Quelle von Draft PR #19, nicht Lieferlinie. |
| `_worktrees/auth-identity-002-root` | `007b85b` | `ARCHIVE_CANDIDATE` | ältere Auth-Recovery, nur nach gezieltem Vergleich salvagen. |
| `_worktrees/auth-identity-003-root` | `60f0e07` | `ARCHIVE_CANDIDATE` | ältere Auth-Recovery, nur nach gezieltem Vergleich salvagen. |
| `_worktrees/plan-sync-001` | `1b6150e` | `ARCHIVE_CANDIDATE` | Dokumentationsnebenstrang. |
| `_worktrees/w0-api-02f-scan-upload` | `b5c847b` | `ARCHIVE_CANDIDATE` | alter Capture-Nebenstrang. |
| `galvanik_kreile_worktrees/auth-identity-002` | `78c761f` | `ARCHIVE_CANDIDATE` | Doppelung einer Auth-Recovery. |
| `C:/tmp/02_app_agency_runtime` | `0e87cf6` | `UNKNOWN` | externe Agentur-Laufzeit, nicht als Fundamentsource bewertet. |
| `C:/tmp/02_app_r4_tool_policy` | `6e1d183` | `ARCHIVE_CANDIDATE` | Policy-Nebenstrang. |
| `C:/tmp/control-plane-03-minimal-mission-runtime` | `c910326` | `ARCHIVE_CANDIDATE` | Control-Plane-Nebenstrang. |
| `C:/tmp/control-plane-min-ci` | `411a28a` | `ARCHIVE_CANDIDATE` | CI-Nebenstrang. |
| `C:/tmp/kreile-f2-m3-cutover` | `09caba8` | `ARCHIVE_CANDIDATE` | Header-/Cutover-Nebenstrang. |
| `C:/tmp/lint-ratchet-observability` | `8dd1c3d` | `ARCHIVE_CANDIDATE` | Lint-/Observability-Nebenstrang. |
| `C:/tmp/m03i-b-remove-admin-pin-client-exposure` | `cbe330b` | `ARCHIVE_CANDIDATE` | PIN-Exposure-Nebenstrang. |
| `C:/tmp/m4b-abnahme-019f5be9-root/02_app` | `5db2c08` | `ARCHIVE_CANDIDATE` | Abnahme-Nebenstrang. |
| `C:/tmp/p0-hotfix-no-pin-payload-clean` | `4bce02d` | `ARCHIVE_CANDIDATE` | P0-Doppelung. |
| `C:/tmp/r1neu-guard-20260713/02_app` | `3eb0f47` | `ARCHIVE_CANDIDATE` | Guard-Nebenstrang. |
| `C:/tmp/r4-tool-policy-20260714/02_app` | `6e1d183` | `ARCHIVE_CANDIDATE` | Policy-Doppelung. |
| `C:/tmp/r5-b-ci-gate-20260713-wt/02_app` | `f0090ab` | `ARCHIVE_CANDIDATE` | CI-Gate-Nebenstrang. |
| `C:/tmp/w0-api-02d-customer-enrich` | `6873837` | `ARCHIVE_CANDIDATE` | Customer-Enrichment-Nebenstrang. |
| `C:/tmp/w0_api_02c_inquiry` | `7ba792e` | `ARCHIVE_CANDIDATE` | Inquiry-Nebenstrang. |

## 2. PR #20 gegen `origin/main`: genaue Entscheidungstabelle

`ACCEPT` bedeutet nur akzeptiert als begrenzte Containment- oder Read-only-
Maßnahme; nie „Produktfunktion fertig“.

| Produktbereich | Urteil | Beleg und Grenze |
| --- | --- | --- |
| App-Session / PIN-Selektor | `ACCEPT` | Signierte Session, serverseitige Tenant-/Rollenprüfung und kein Fallback-Admin sind in `src/app/actions/auth.actions.ts:58` und `src/lib/server/appSessionToken.ts` vorhanden. Klarwert-PIN-Migration und persistenter Rate-Limiter sind offen. |
| Benutzerwechsel | `REWORK` | Ursache in `src/lib/auth/PermissionsContext.tsx:64` gefunden und lokal korrigiert: kompletter Serversnapshot ersetzt Rolle, Name, Initialen und Rechte; Fehler leert die Identität. `src/app/layout.tsx:67` remountet bei neuer signierter Session. Test `T-06` deckt Michael → Admin → Michael ab. Browser-/Preview-Smoke fehlt noch. |
| Proxy / Dev-Bypass | `REWORK` | `src/proxy.ts:7` blieb ohne Supabase-Variablen vorher offen. Lokaler Fix erlaubt nur den dreiteiligen lokalen Bypass; sonst `503`. Redirects kopieren Refresh-Cookies. Preview-Variablen und Browsernachweis fehlen. |
| Auftragsliste | `ACCEPT` | Read-only, Session-/Permission-/Tenant-gebunden in `src/app/actions/orders.actions.ts:47`; kein RLS-Beweis und keine freigegebene Detail-/Mutationskette. |
| Kundenliste | `REWORK` | Tenant-Filter ist vorhanden (`customers.actions.ts:84`), aber die fachliche Übereinstimmung mit Aufträgen ist nicht end-to-end bewiesen. Die lokale falsche Ersatz-ID wurde zu `Kundennummer nicht hinterlegt` korrigiert (`:22`). |
| Wareneingang → Produktion → Ausgang | `REWORK` | Kernkette ist fail-closed; `transitionOrderProcess` (`orders.actions.ts:402`) bleibt bis W1 und W3 geschlossen. Navigation führt noch in gesperrte Bereiche; kein realer Produktionsweg. |
| Capture / Scan / OCR | `ACCEPT` | Routen und UI antworten ehrlich `NOT_CONFIGURED`, statt Fake-Erfolg zu melden. Das ist keine nutzbare Erfassung, Storage- oder OCR-Fähigkeit. |
| Status / Today / Print / QR | `ACCEPT` | Bekannte Scheinwerte/-erfolge sind gesperrt. Ein echter Print-/Label-/Statusvertrag existiert noch nicht. |
| Buchhaltung / Analyse / Marketing / Performance | `ACCEPT` | Fail-closed als Containment, nicht als Funktionsfreigabe. Echte Views, Evidenz, Consent, Finanzrollen und RLS fehlen. |
| Globales Foundation-Gate | `REWORK` | `src/lib/server/foundationGate.ts:26` liefert pauschal `false`; späteres `true` würde Altpfade gemeinsam öffnen. Es braucht eine standardmäßig leere Capability-Allowlist. |
| W1-Migration | `REWORK` | Die Nullability-Lücke in `supabase/migrations/20260728124147_foundation_w1_runtime_receipt_columns.sql:23` und `:191` ist lokal behoben. W1 ist im Produkt nachweisbar nicht angewendet. |
| W3 / DB-Grenze | `REWORK` | 26 RLS-lose Relationen, breite ACLs, offene Funktionen und fehlende fachliche Rollenentscheidung verhindern jede RLS-/Grant-Freigabe. |
| Gesamtqualität | `REWORK` | Direkter Voll-Lint meldet historische Fehler; ein funktionierender Build und einzelne Tests genügen nicht für einen Merge. |

### Reproduzierte Gates im temporären Kandidaten

| Gate | Befehl | Ergebnis | Einordnung |
| --- | --- | --- | --- |
| P1, exakt | `npx tsc --noEmit` | **FAIL**: `npx` findet die lokal installierte TypeScript-Binärdatei nicht | Paket-Binärpfad-Infrastruktur ist kaputt; kein TypeScript-Pass behauptet. |
| TypeScript, direkt | `node node_modules/typescript/bin/tsc --noEmit` | **PASS** | Compiler ist vorhanden; Produktcode typisiert. |
| P2, exakt | `npm run lint` | **FAIL**: `eslint` ist nicht im `node_modules/.bin` auffindbar | Paket-Binärpfad-Infrastruktur ist kaputt. |
| Voll-Lint, direkt | `node node_modules/eslint/bin/eslint.js .` | **FAIL**: 576 Probleme, 247 Fehler, 329 Warnungen | echter Release-Blocker; historische Fehler werden nicht versteckt. |
| Unit | `node node_modules/vitest/vitest.mjs run --exclude "**/*.integration.test.ts"` | **PASS**: 19 Dateien, 88 Tests | enthält Identity-Wechsel- und Dev-Bypass-Regressionen. |
| Next-Build / Route-Import | `node node_modules/next/dist/bin/next build` | **PASS**: 77 App-Routen | Build-/Importkette, keine Browser-/Rollenfreigabe. |
| Boundary | `node node_modules/tsx/dist/cli.mjs scripts/verify-foundation-boundaries.ts` | **PASS**: 69 Server-Action-Gates, ein statischer Service Worker | Fail-Closed-Grenze belegt. |
| Remote-Schemakontrakt | `node node_modules/tsx/dist/cli.mjs scripts/verify-product-schema-contract.ts` | **EXPECTED FAIL**: genau drei fehlende W1-Spalten | W1 ist im Produkt nicht angewendet; kein falscher Green-Status. |

Frühere große Arbeit ist nicht „versteckt verschwunden“: Draft PR #19
(`codex/foundation-security-remediation-20260715`, `338a13c`) und PR #20
divergieren beide ab `6e1d183`. Kein Zweig wurde nach `origin/main` gemergt;
deshalb kann eine laufende Produkt-Preview diese Änderungen nicht automatisch
zeigen.

## 3. Kanonischer Fach- und Datenvertrag

Die folgende Zielwahrheit ist verbindlich für künftige Migrationen und UI-
Verträge. Sie beschreibt **nicht** behauptete, bereits vorhandene Tabellen.

| Fachobjekt | Eine kanonische Wahrheit | Heute belegter Ausgangspunkt | Verbotene Doppelwahrheit |
| --- | --- | --- | --- |
| Kunde | Stammdaten, Kommunikation und Historie | `customers` mit `tenant_id`, Name, Kontakt-/Adressfeldern (`src/db/schema.ts:27`) | Auftragsdaten oder interne IDs als Kundennummer ausgeben. |
| Auftrag | kaufmännischer und logistischer Rahmen | `orders` mit `tenant_id`, `customer_id`, Termin- und Rahmenfeldern (`schema.ts:82`) | Prozessfortschritt frei im Auftragsstatus pflegen. |
| Teil/Objekt | operative Produktionswahrheit | `items` mit `order_id`, `tenant_id`, historisch `current_station_id`, `station_sequence`, `current_step` (`schema.ts:136`) | Auftrag als Ersatz für einzelne Teile führen. |
| Prozessereignis | unveränderbarer Nachweis jeder relevanten Bewegung/Mutation | `events` mit `tenant_id` (`schema.ts:156`); W1 ergänzt Receipt-ID | UI-Erfolg, Station oder Freitext als Bewegungsbeweis. |
| Charge | temporäre Ausführungsgruppe über Teilen | kein tragfähiger kanonischer Charge-Vertrag belegt | Charge als Ersatz für Auftrag oder Teil. |
| Blocker | eigene Achse mit Ursache, Owner, Öffnen/Schließen | kein freigegebener, belegter Vertrag | in Prozessstatus, Risiko oder Priorität verstecken. |
| Priorität/Risiko | getrennte fachliche Achsen, jeweils mit Quelle | historische `risk`, `priority`, `priority_computed` auf `orders` (`schema.ts:91-104`) | „computed“ und manuell ohne Herkunft vermischen. |
| Auftragsphase | Projektion aus Teilen und Ereignissen | historisches `orders.status` | zweite frei editierbare Wahrheit. |
| Prozessgruppen/-schritte | tenant-konfigurierbares Modell | aktuelle statische `OPERATIONAL_PROCESS_CHAIN` (`src/lib/orders/processContract.ts:5`) | globale, hartkodierte Stationsliste. |
| Standort / Qualität | eigene Felder bzw. Ereignistypen | heute nicht hinreichend getrennt belegt | in Status oder Station kodieren. |

### Ziel-Transition-Matrix

Die Rollen in dieser Matrix sind fachliche Empfehlungen auf Basis der heutigen
App-Rollen aus `src/lib/auth/authorizationContract.ts`; sie sind **keine**
fertigen DB-Rollen oder W3-Policies.

| Aktion | Vorbedingung | Mutation | unumkehrbarer Eventnachweis | Readback | Fehlerfall | berechtigte Rolle |
| --- | --- | --- | --- | --- | --- | --- |
| Minimalen Auftrag anlegen | Kunde oder klar markierte neue Stammdaten; Tenant bekannt | Auftrag mit Rahmen anlegen | `order_created` mit Request-Receipt | Auftrag + leere Teileliste | Validierung/Receipt-Konflikt, keine Teilmutation | `buero`, `meister` |
| Teil anlegen/ändern | Auftrag des aktiven Tenants | Teilattribute; keine freie Station | `item_created` / `item_updated` | Teil in Auftragsarbeitsplatz | fremder Tenant, ungültige Daten | `buero`, `meister` |
| Tenant-Route zuordnen | aktive tenant-konfigurierte Route | Route-Referenz am Teil | `route_assigned` | nächster erlaubter Schritt | Route nicht konfiguriert | `meister` |
| Schritt starten | Teil hat erlaubten nächsten Schritt; kein offener Blocker | Prozessprojektion aus Event | `process_started` mit `client_event_id` | Teil + Heute-Liste | falscher Schritt, doppelte Receipt, fremder Tenant | `werkstatt`, `meister` |
| Schritt abschließen | eigener aktiver Schritt; erforderliche Daten vorhanden | Prozessprojektion | `process_completed` mit Receipt | neue nächste Aktion | QS/Blocker/Receipt-Konflikt | `werkstatt`, `meister` |
| QS-Entscheidung | QS-Prüfauftrag und Evidenz | Qualitätsachse, nicht Prozessstatus | `quality_accepted` / `quality_rejected` | Teil, Blocker, Folgeaktion | Evidenz fehlt oder Rolle fehlt | `meister` mit `perm_op_qa` |
| Charge anlegen/zuordnen | kompatible Teile und Laufzeitfenster | temporäre Charge ↔ Teil-Zuordnung | `charge_created` / `item_assigned_to_charge` | Charge + betroffene Teile | Teil nicht kompatibel, Charge geschlossen | `meister` |
| Blocker setzen/lösen | Quelle, Owner und Fälligkeit bekannt | eigene Blockerachse | `blocker_opened` / `blocker_resolved` | Heute + Teil + Auftrag | Quelle/Owner fehlt | `werkstatt`, `meister` nach Ursache |
| Priorität/Risiko setzen | Begründung und Quelle | separate Prioritäts- oder Risikoachse | `priority_changed` / `risk_changed` | Auftrag/Teil mit Herkunft | keine Begründung, unzulässiger Scope | `meister`, `buero` nur kaufmännisch |
| Versand/Abschluss | alle Teile, QS, Dokumente und Übergabe belegt | logistischer Abschluss | `shipment_recorded` / `order_closed` | Auftrag, Teile, Historie | offener Blocker/Teil/QS | `buero`, `meister` |

Keine Zeile dieser Matrix darf nur über `orders.status`, eine Kanban-Spalte oder
eine freie Stationsnavigation implementiert werden.

## 4. Künftige Screen- und Rollenwahrheit – ohne UI-Umbau

| Screen | Rolle/Zweck | SQL-View oder Query | erlaubte Aktion | Loading / Empty / Error / Data | Datenschutz & Navigation |
| --- | --- | --- | --- | --- | --- |
| **Heute** | `werkstatt`, `meister`: auftragszentrierte nächste Arbeit | `MISSING: v_today_operational_worklist` erst nach Ereignis-/Route-/Blocker-Vertrag | ausschließlich servergeprüfte nächste Aktion | Laden: Altstand mit Zeitstempel; Leer: „keine freigegebene nächste Arbeit“; Fehler: unbekannt + Retry; Data: Auftrag, Teile/Charge, Blocker, Fälligkeit | kein Stations-Kanban als Wahrheit; Link zu Auftrag und Teil, nicht zu freien Sprüngen. |
| **Wareneingang** | `buero`, `meister`: minimal gültigen Auftrag erzeugen | zukünftige parametrisierte Order-Write-Action, nicht Browser-RPC | Auftrag speichern; danach erst Label/QR | Laden, Validierungsfehler, Receipt-Konflikt, gespeicherter Auftrag | Kundendaten minimal, keine OCR-/Druckbehauptung; weiter zum Auftragsarbeitsplatz. |
| **Auftragsarbeitsplatz** | `buero`, `meister`, begrenzt `werkstatt` | heutiger tenantgebundener Order-Read als Ausgangspunkt; Detail-View fehlt | nur Matrix-Aktionen nach W1/W3 | Laden/kein Auftrag/Fehler/teilweiser Beleg/Data | getrennt von Kundenakte; Feldrechte pro Rolle; Teil ist operative Wahrheit. |
| **Kundenakte** | `buero`, `meister`: Stammdaten und Historie | `getCustomersDb` heute nur Liste (`customers.actions.ts:84`); Detailquery muss erweitert belegt werden | reine Stammdatenaktionen nach Contract | Laden/leer/unbekannt/Data; fehlende Nummer bleibt Text, nie Ersatz-ID | keine Produktionssteuerung; Link zum Auftrag nur über echte Beziehung. |
| **Charge & QS** | `meister`, begrenzt `werkstatt` | `MISSING: charge/quality query contract` | Charge/Qualität erst nach eigener Ereigniskette | Not configured statt Demo; später Loading/Empty/Error/Data | Teile bleiben sichtbar; Charge ist temporär, QS-Evidenz nachverfolgbar. |
| **Performance** | `meister`, `readonly` nur bei freigegebenen Claims | `MISSING: evidenzierte SQL-Views` | Drill in Evidenz/Aufträge, keine Mutation | heute `NOT_CONFIGURED`; keine Trends, Scores, Realtime oder KI | erst ClaimEvidence/Scope/Coverage; keine kaufmännische Detaildaten an Werkstatt. |
| **Buchhaltung / Analyse / Marketing** | jeweilige noch zu entscheidende Fachowner | `MISSING` bis W3-Rollen, Views, Consent und Evidence | keine aktive Handlung | heute Gate; später je Surface eigene Loading/Empty/Error/Data-Verträge | keine Marketing-/Finanzdaten an unentschiedene Rollen; keine Demo- und Nullwerte. |
| **Capture / Foto / OCR** | `werkstatt`, `meister` nach Storage-Vertrag | `MISSING: Storage- und Job-Receipt-Vertrag` | keine Aktion bis negativer Tenant-/Actor-Test | heute `NOT_CONFIGURED`, nicht „erfolgreich hochgeladen“ | private Pfade, MIME/Größe, Owner, Wiederholung und Löschen explizit. |

Offline, Konfliktauflösung, Realtime, KI, Druck und historische Verläufe sind
auf keinem Screen als aktive Capability zu formulieren, solange sie keinen
serverseitigen Contract samt Readback besitzen.

## 5. W1 – additive Receipt-Welle

| Punkt | Nachweis |
| --- | --- |
| Datei | `supabase/migrations/20260728124147_foundation_w1_runtime_receipt_columns.sql` |
| Gegenstand | `events.client_event_id uuid NULL`, `audit_log.tenant_id text NULL`, `audit_log.client_request_id uuid NULL`; zwei partielle eindeutige B-tree-Indizes. |
| Konsument | `transitionOrderProcess` in `src/app/actions/orders.actions.ts:402`; die Action bleibt vor der Mutation geschlossen. |
| Lokale Reparatur | Preflight und Postflight prüfen jetzt neben dem Typ verpflichtend `is_nullable = 'YES'`. Ein vorhandenes `NOT NULL` bricht die Transaktion ab. |
| Remote-Query / erwartetes Ergebnis | `information_schema.columns` plus `to_regclass` für drei Spalten und zwei Indizes; vor W1 exakt fünf `MISSING`. |
| Remote-Ergebnis 2026-07-28 | exakt fünf `MISSING` (`events.client_event_id`, beide `audit_log`-Spalten, beide Indizes). |
| Rückwärtskompatibilität | nullable Spalten; historische Nullwerte bleiben zulässig. |
| Rollback | kein Löschen von Spalten/Indizes. Fehlerbeleg sichern, Ursache korrigieren, neue additive Forward-Migration. |
| Unzulässig | `supabase db push`, SQL-Konsole als Ausweichtransport, Produktdaten im Labor, W3-/RLS-Änderung mit W1. |

Pflichtsequenz vor einer Produktmutation: isoliertes Labor → erster Lauf →
Katalog/Index/Duplikat-Readback → identischer zweiter Lauf → negative
Typ-/Nullability-/Duplikat-/Lock-Fälle → erst dann ein explizit gehashtes
Produktmigrationspaket.

## 6. W3 – ACL-, Tenant- und Rollenfreigabe

Die finalen Beweisartefakte sind
`contracts/product-security-snapshot.v1.json`,
`contracts/product-security-acl-snapshot.v1.json` und
`docs/foundation/W3_AUTH_RLS_DISCOVERY_MANIFEST.md`.

| Befund | Ergebnis / Konsequenz |
| --- | --- |
| Security-Advisor | 69 Befunde: 27 `ERROR`, 31 `WARN`, 11 `INFO`; 26 RLS-lose Relationen plus `v_auftrag_db`. |
| Relation ACL | Für die 26 RLS-losen Tabellen und `v_auftrag_db` sind bei `anon`, `authenticated` und `service_role` `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` katalogseitig gewährt. Keine lokale UI-Gate neutralisiert das. |
| View | `v_auftrag_db` ist Security Definer und hat breite Grants; keine Analyse-/Finance-Reaktivierung. |
| Security Definer | zehn Funktionen nur `service_role`; sie bleiben private Serverpfade bis Owner-/Negative-Test-Beweis. |
| Öffentliche Funktionen | `fn_compute_warnings`, `fn_is_production_order`, `fn_verteile_energiekosten`, `search_global` haben `anon`/`authenticated` EXECUTE. Sie bleiben fachlich geschlossen. |
| Tenant-Mechanismus | kein belegtes serverseitiges `SET LOCAL app.tenant_id` im aktiven `src`; keine Policy darf es voraussetzen. |
| Rollenvertrag | aktuelle Rollen decken nicht Finance, Consent, Export, Kommunikation, Telemetrie, OCR/Foto oder KVP ab. |

### Ein gesammelter, fachlich nicht ableitbarer Entscheidungsblock

Empfehlung: Least Privilege, `anon` grundsätzlich verweigert, `service_role`
nur Serverpfad. Die folgende Matrix ist absichtlich konservativ und ersetzt
keine fachliche Zustimmung:

| Fachbereich | Empfohlene Leserechte | Empfohlene Schreib-/Freigaberechte | ausdrücklich nicht ohne Entscheidung |
| --- | --- | --- | --- |
| Operative Aufträge/Teile | `werkstatt` eigene zugewiesene Arbeit; `meister`, `buero` nach Scope | `werkstatt` nur Schritt/Fotos; `meister` QS/Route/Blocker; `buero` Stammdaten/Rahmen | cross-tenant, freie Stationssprünge, Finanzwerte |
| Buchhaltung | `buero` nur vorbereitete Belege; `admin` technischer Support ohne Buchungsfreigabe | ein noch zu benennender Finance-Owner | Buchen, Abschluss, Storno, Export |
| Marketing/Consent | ein noch zu benennender Marketing-Owner | derselbe Owner mit Auditreceipt | Kontakt, Consent-Änderung, Attribution, Versand |
| Warnungen/Suche | `meister` nur eigener Tenant/Scope | `meister` quittieren; Regeländerung nur Owner | globale Suche, Unterdrückung ohne Evidenz |
| Foto/OCR/AI | `werkstatt` nur eigene zugewiesene Objekte; `meister` Review | Server Jobreservation, keine Browser-RPC | Löschen, Provider-Start, fremde Fotos/Charges |
| Kalender/Kommunikation/Import/KVP/Telemetrie | kein Recht bis Owner benannt | kein Recht bis Owner + Retention feststeht | Export, Providersecrets, Personen-/Nutzungsprofiling |

Keine W3-Migration kann korrekt erstellt werden, bevor diese eine Matrix als
Produktentscheidung bestätigt oder fachlich korrigiert ist.

## 7. Disposition und keine Löschung

`docs/foundation/FOUNDATION_DISPOSITION_REGISTER.md` ist das verbindliche
Register. `scripts/verify-foundation-disposition-coverage.mjs` druckt für jeden
Pfad im Diff `origin/main...HEAD` eine genaue `KEEP`, `MERGE`, `QUARANTINE`
oder `UNKNOWN`-Entscheidung und schlägt bei `UNKNOWN` fehl.

Die konkrete `DELETE_AFTER_PROOF`-Liste ist **leer**. Keiner der alten Pfade
hat zugleich letzten Konsumenten, Ersatzvertrag, importfreien Suchbeweis,
Regressionstest, geordnete Release-Reihenfolge und Wiederherstellungspfad.
Deshalb wurde nichts gelöscht.

## 8. Sichere Reihenfolge, Smokes und Rückbau

| Welle | Vorbedingung | Zulässige Aktion | Pflichtnachweis | Rückbau |
| --- | --- | --- | --- | --- |
| R0 – lokale Reparaturbasis | Code-/Teständerungen | Draft-PR aktualisieren | TypeScript, fokussierte + volle Unit-Suite, Build, Boundary, Diff/Status | Git-Revert des einzelnen Draft-Commits; keine Produktänderung. |
| W1-Labor | isolierter, leerer/abgesicherter Test-Scope und kanonischer Runner | nur W1-Migration einmal/zweimal | Katalog, Ledger, Nullability, Indizes, Duplikate, negative Fälle | neue additive Forward-Migration, keine Löschung. |
| W1-Produkt | Labor vollständig + explizite gehashte Freigabe | nur W1-Migration | Action → Receipt → Reload → Retry → fremder Tenant negativ | Forward-Fix; Rollback-by-delete verboten. |
| W3-Design | bestätigte Rollenmatrix + relationweise Owner/Tenant-Map | konkrete, gehashte Migrationsentwürfe | policy/grant/view/storage diff und positive/negative Actor-/Tenant-Tests im Labor | per Relation Forward-Fix; keine globale Policy. |
| W3-Produkt | einzelne explizite Freigabe nach Labor | nur genehmigte W3-Wave | erneuter Advisor-/ACL-/RLS-/View-/Storage-Readback | gehashter Forward-Fix, keine blanket restore. |
| Merge / Preview | alle Waves grün, Voll-Lint bereinigt oder formell akzeptiert, unabhängiger Review | normaler Draft-PR-Merge | Preview: MK → Logout → Admin → MK; unauthorized/fremder Tenant/Receipt retry; list customer↔order; gated capture/performance | Revert-Merge, Preview erneut prüfen. |
| Production | erfolgreiche Preview-Smokes und eigener Produktionsfreigabeschritt | Deployment/Promotion | dieselben Browser-/Rollen-Smokes auf Produkt | Deployment-Revert plus Forward-DB-Fix nach Wave. |

`PR #20` darf erst nach diesen Punkten aus Draft heraus und nach `main`.
Weder ein erfolgreicher Build noch Fail-Closed-UI genügt.

### W1-/W3-Artefakthashes

| Artefakt | SHA-256 |
| --- | --- |
| `supabase/migrations/20260728124147_foundation_w1_runtime_receipt_columns.sql` | `c24a9b01a9093c56512b1860c87d00508e651ff3e20f7a6eb014d61cca4321fe` |
| `docs/foundation/W1_RUNTIME_RECEIPT_WAVE_MANIFEST.md` | `34bbb7ac1629661c9adbac67163c0b817a7097ae4208fe0de9eabc4b63c91773` |
| `contracts/product-security-snapshot.v1.json` | `ef29edf80a72ccc36ba7bbcb87d2bc381b06992aa18e0cc1135f4f597d8a36fe` |
| `contracts/product-security-acl-snapshot.v1.json` | `2f938229f625a51cfcd1082b7f558193230c02af45e79179d9947575ea3a8d1c` |
| `docs/foundation/W3_AUTH_RLS_DISCOVERY_MANIFEST.md` | `ad20f5e9574adcf1c0e9b86a0381b8b74291ae3c85ee999ef845d49cbfcbb36c` |
| Vollständiger Index | `docs/foundation/WAVE_EVIDENCE_INDEX.v1.json` (referenziert zusätzlich Reconciliation, Disposition, Schema-Snapshots und Coverage-Verifier) |

## 9. Eine einzige erforderliche Freigabe

**Noch nicht als Remote-Ausführungsfreigabe verwenden.** Nach Prüfung dieses
Pakets ist nur folgende gebündelte Fachentscheidung einzuholen:

> **FREIGABE W3-ROLE-MATRIX-001** – „Ich bestätige die oben empfohlene
> Least-Privilege-Matrix als fachliche Ausgangsentscheidung für Galvanik
> Kreile, insbesondere: `anon` erhält keinen Fachzugriff; Finance, Marketing,
> Consent, Export, Kalender, Kommunikation, Import, KVP, Telemetrie und
> Foto/OCR/AI bleiben bis zur je Bereich benannten Owner-Rolle gesperrt.
> Diese Freigabe autorisiert weder eine Remote-Migration, noch RLS-/Grant-
> Änderungen, Merge, Deployment oder Löschung.“

Danach kann ein einzelnes, relationweises W3-Laborpaket gebaut werden. Eine
spätere Produktmutation bleibt gemäß Projektregel separat ausdrücklich
freizugeben.

# Kreile WerkstattCockpit — F0-Übergabe & F1-Startpaket

**Erzeugt:** 2026-08-10 · **Repo:** `schoggertraube-rev/galvanik-kreile-app` ·
**main:** `a3d7db762ea4d95867a9edc2ade2850333f75f34` · **Prod-Deploy-Head:** `ae47f3de` (Vercel `dpl_7vwbgEJrPJhYHf9Rc…`)
**Adressat:** GPT/Implementierungsstrang für die geordnete F0-Sanierung und den F1-Start.

Diese Datei ist das ehrliche Übergabeartefakt. Sie ersetzt jede frühere „F0 GREEN/PASS"-Aussage.
Sie ist an den `KREILE_VERBINDLICHER_SANIERUNGS_UND_ABSCHLUSSPLAN_2026-08-10` gebunden und widerspricht ihm nicht.

---

## 1. Ehrlicher F0-Status (keine Beschönigung)

**`FINAL_STATUS = FAIL_INTERNAL`** · `ZIP_READINESS = RED` · `OPEN_EXTERNAL_BLOCKERS = 1 (EXT-01)`.

Begründung: Eine unabhängige read-only Verifikation gegen den echten `main`-Code hat **7 von 11 geprüften
P0-Anwendungsdefekten exakt bestätigt, 0 widerlegt, 4 teilweise** (Defekt real, Dateiangabe leicht
abweichend). Details + Zeilenbelege: `docs/evidence/f0/F0_DEFECT_REGISTER.md`.

**Warum trotz früherem „100% geprüft" noch Fehler da sind — die eine wichtige Wahrheit:**
Verifiziert war der **DB-/Infrastruktur-Vertrag** (Schema-Replay, RLS/Grants, Storage-Buckets, Ledger,
CI-Gates, Doc-Truth). Nicht verifiziert war **Anwendungslogik**. `tsc`/Lint/Unit/Build/DB-Replay sind
grün, obwohl „OCR ruft Provider vor Auth" oder „Buchung defaultet Steuer 19%" typkorrekt und testgrün
sind — ein Typechecker kann das nicht fangen. Der Sanierungsplan definiert „sauberes Fundament" zu Recht
strenger: **kein erreichbarer Pfad darf lügen oder unsicher schreiben.** Nach dieser Definition ist F0
noch nicht fertig.

## 2. Was solide ist und ERHALTEN bleibt (nicht neu bauen)

- Prod-Ledger 9/9 aktive Migrationen, `db push`-fähig (Digest `268ce6c1`); zweifacher Fresh-Replay deterministisch.
- 7 harte Fingerprint-Komponenten = Prod (cols/idx/func/rls/grants/func_grants/viewopts).
- 0 direkte anon/authenticated-Grants auf allen public-Tabellen/Views (relationsweiter CI-Test).
- 4 private Storage-Buckets mit Größen-/MIME-Limits; Storage-HTTP-Negativmatrix S1–S12 im CI.
- 6/6 PIN bcrypt; echte Session-Kette V1–V5 im CI; 17/17 Views `security_invoker`.
- CI-Gates: Fingerprint hart, Ledger-Vertrag, Client-Boundary, Doc-Truth, Doppel-Replay, Runtime-Audit-Artefakt.

## 3. Verifizierte P0-Defekte (Kurzform; volle Belege im Register)

| ID | Defekt (Ein-Satz) |
|---|---|
| STO-02 | OCR-Route ruft Provider + schreibt DB **vor** Auth; Dev-Fallback auf Null-UUID/ersten User. |
| STO-04 | Mock-OCR + `Math.random` sind aus erreichbarer Produktions-UI importiert (`BelegUploadOverlay`). |
| BUC-01 | `createBelegAction` schreibt bei Unbekanntem `brutto/netto=0, vorsteuer_abzug=true, absetzbar=100%`. |
| BUC-02 | Export/Rechnung defaulten fehlenden Steuersatz auf `19%`, fehlende USt auf `0,00`. |
| SEC-02 | 17/19 Buchhaltungs-Actions ohne Auth-/Autorisierungsprüfung; kein `resolveAuthorization`. |
| SEC-03 | Tenant `galvanik-kreile` 68× hardcodiert; `authorization.ts` nutzt zentrale Konstante nicht. |
| STO-07 | Item-Foto 10 MB durch 4,5-MB-Vercel-Function (kein signierter Direktupload). |
| ORD-01 | Zwei divergente Stationswechsel-Writer (`setOrderStationDb` vs. `transitionOrderProcess`). |
| ORD-13 | Scan-Auftrag erfindet Adresse „Hauptstraße 1 / 60311 Frankfurt / Deutschland". |
| ANA-01 | Buchhaltungs-Analyse teils hardcodiert (Trends, Vorjahr `*0.8` Mock). |
| ANA-03 | `isLive:true` unbedingt gesetzt, obwohl Quellen als `missing` erkannt werden. |

Der Sanierungsplan enthält darüber hinaus SEC-01/04/05/06-10, STO-01/03/05/06/08-10, BUC-03..09/11-13,
ORD-02..12, ANA-02/04-07, ARC-01..08, OPS-01..05 — als P0/P1/P2 bzw. spätere Slices klassifiziert.

## 4. Verbindliche Ausführungsreihenfolge (Stand & nächster Schritt)

Regel des Plans: **genau ein Paket, ein kurzlebiger Branch, ein PR; kein Selbstmerge; Merge nur nach
ausdrücklicher Principal-Freigabe; danach Branch nur mit gesonderter Freigabe löschen.**

| Paket | Inhalt | Stand |
|---|---|---|
| F0-W0 | Cleanup: Branch-Inventar, `agent/f0-marble-truth-repair` löschen, PR-#57-Merge-Abweichung dokumentieren | **ERLEDIGT** (2026-08-10) |
| F0-W1 | Governance-/Dokumentwahrheit: `FAIL_INTERNAL`, `ZIP=RED`, Status-Enum-Gate, Doc-Truth erweitert, Register+diese Übergabe ins Repo | **PR offen, wartet auf Principal-Merge** |
| F0-W2 | Quarantäne: alle lügenden/unsicheren Pfade serverseitig sperren + ehrlicher UI-Zustand (Spec §5) | **NÄCHSTES Paket** |
| F0-W3 | Ein Session-/Tenant-/Owner-Vertrag (SEC-01..04,06..08,10) | nach W2 |
| F0-W4 | Kanonischer Storage-/Attachment-Vertrag (STO-01..08,10); OCR fail-closed bis realer Adapter | nach W3 |
| F0-W5 | Volle CI-Murmelbahnen (ARC-01..08 soweit P1); alle internen A01–A15 PASS | nach W4 |
| F0-W6 | Externe ACL-Korrektur (EXT-01), unabhängige Ratifikation, Postflight, externes Attestat | zuletzt |
| F1→P10 | Produktbau in Strangler-Slices (siehe Plan §8) | erst nach F0-PASS |

## 5. F0-W2 Quarantäne-Spezifikation (direkt ausführbar, kein Raten nötig)

Quarantäne = **serverseitige Verweigerung + ehrlicher UI-Zustand** (NICHT nur Button ausblenden).
Kein Fix erfordert hier eine Steuer-/Fach-Entscheidung — es wird nur „aufgehört zu lügen".

1. **OCR (`src/app/api/ocr-process/route.ts`)**: Auth/Tenant/Capability VOR jedem Provider-/Storage-/DB-Zugriff; unauth → `401`, 0 Providerkosten, 0 DB-Nebeneffekt. Dev-Fallback (Null-UUID/`users[0]`) entfernen. Bis realer Adapter: Route liefert `NOT_CONFIGURED`.
2. **Mock-OCR (`BelegUploadOverlay.tsx`, `MockOcrProvider`)**: Produktionsimport entfernen; Feature serverseitig `NOT_CONFIGURED`; UI „Beleg-Erkennung nicht konfiguriert" statt Fake-Ergebnis.
3. **Beleg-Defaults (`createBelegAction`, `actions.ts:204`)**: Unbekannt bleibt `null`/`missing`; kein `brutto/netto=0`, kein `vorsteuer_abzug=true`, kein `absetzbar=100`. Unvollständiger Beleg nicht export-/festschreibbar → gesperrt.
4. **Steuer-Defaults Export/Rechnung (`actions.ts:335,460`)**: `19%`/`0,00`-Fallback entfernen; bei unvollständiger Steuerwahrheit verweigern.
5. **Buchhaltungs-Auth (SEC-02, ganze `actions.ts`)**: jede Business-Action über den kanonischen Autorisierungsvertrag (App-Session zuerst, Actor/Tenant serverseitig, tenantgefilterter Datenkontext); fehlt das → sperren.
6. **Energie/Analyse-Hardcodes (`analysis.actions.ts`, `analyse.actions.ts:433`)**: Produktions-Hardcodes/`isLive:true` entfernen; Status als diskriminierte Union aus echter Quellenabdeckung; fehlende Quelle ⇒ `DATA_THIN`/`NOT_CONFIGURED`, nie `live/ok`.
7. **Scan-Adresse (`orders.actions.ts:429`)**: erfundene Anschrift entfernen; fehlende Stammdaten = Pflichtfeld-/Review-Zustand; OCR-Ausfall ⇒ 0 Aufträge bis Mensch reale Daten bestätigt.
8. **Item-Foto (STO-07)**: kein Binärtransfer durch die Function; signierter Direktupload ODER Limit ehrlich auf 4,5 MB senken + UI-Text angleichen (Interimslösung bis W4).
9. **Stationswechsel (ORD-01)**: `setOrderStationDb` (non-transaktional) aus Produktionsimporten entfernen/an `transitionOrderProcess` delegieren; genau ein Owner-Command.

Abnahme W2: Vollrepo-Scan + Routen-/Action-Test beweisen: keine falsche Live-Wahrheit, kein synthetischer
Erfolg, keine Providerkosten/DB-Writes ohne Auth.

## 6. Menschliche & externe Entscheidungen — NICHT raten (Plan §9)

| ID | Entscheidung | Wer | Wann |
|---|---|---|---|
| EXT-01 | Default Privileges `supabase_admin` korrigieren | Supabase-Support/Operator | vor F0-PASS (blockiert aktuell) |
| DEC-01 | Rollenmatrix Beleg (Entwurf/Prüfung/Festschreibung/Storno/Export) | Principal + Steuerberatung | vor P8 |
| DEC-02 | Tenant-Zuordnung bestehender Buchhaltungszeilen | Principal + Datenowner | vor SEC-04-Migration |
| DEC-03 | Kanonische Bucketzwecke + Zuordnung bestehender Objekte | Datenowner + Operator | vor STO-Migration |
| DEC-04 | Welche Alt-Branches aufzubewahren sind | Repo-Owner | vor weiterer Branch-Löschung |
| EXT-02 | Unabhängige Ratifikation des finalen SHA | nicht der Autor | vor F0-PASS |
| EXT-03 | Restore-Fenster + Betriebsverantwortliche | Operator | vor Go-live |

Betreiberpflichten vor Go-live (bekannt, offen): DB-Passwortrotation (Nutzer rotiert zum Livegang),
Leaked-Password-Protection aktivieren, Restore-Drill, `pg_trgm` aus public verlagern.

## 7. Branch-Disposition (56 Rest-Branches; DEC-04)

`agent/f0-marble-truth-repair` = war identisch zu main → **gelöscht 2026-08-10**.
Vorschlag (nur nach DEC-04-Freigabe ausführen): `archive/*` + `checkpoint/*` = KEEP_ARCHIVE;
`codex/*`, `feature/rls-*`, `fix/*` mit bereits gemergtem Inhalt = DELETE_REDUNDANT nach Einzelprüfung;
Rest = UNKNOWN_EXTERNAL bis Owner-Entscheid. Vollständige SHA-Liste: `docs/evidence/f0/F0_BRANCH_INVENTORY.md`.

## 8. Arbeitsregeln (verbindlich, Plan §10)

Ein Branch/ein Paket/ein PR · kein Selbstmerge · Merge nur mit Principal-Freigabe · Branch-Löschung nur mit
gesonderter Freigabe · keine angewandte Migration umschreiben (nur Forward) · keine Fake-Wahrheit im
Produktionsimportgraph · kein UI-only-Fix · ein Owner pro veränderlicher Wahrheit · kein stilles Schlucken ·
max. 2 Reparaturzyklen pro Paket, dann ein reproduzierbarer Blocker · keine Scope-Vermischung.

## 9. Einziger erlaubter F0-Abschlusszustand (Plan §13)

Gleichzeitig: finaler SHA = Prod-Deploy = DB-Zustand = Evidence · A01–A15 alle PASS · Default-ACL korrigiert
+ fail-closed belegt · alle aktiven Pfade sicher/wahr ODER serverseitig ehrlich gesperrt · keine
Mock/Random/Hardcode/Phantom/Default im Produktionsbundle · genau ein Session-/Tenant-/Storage-/Outbox-/
Config-Vertrag · zwei Replays gleicher Digest · alle Pflichtprüfungen ohne Skip · Doks widersprechen weder
GitHub noch Runtime noch einander · unabhängige Ratifikation bindet den finalen SHA · offene Foundation-PRs
und ungeklärte Reparaturbranches = 0 · `OPEN_BLOCKERS=0` · `FINAL_STATUS=PASS` · `ZIP_READINESS=GREEN`.
Fehlt ein Punkt, ist der Status exakt einer der erlaubten Nicht-PASS-Enums — nicht „fast grün".

## 10. Produktinput für F1/P1 (nicht F0)

User-Twins Philipp/Michael/Rolf, USP-Neupositionierung, Ideensammlung 3.0, Markt-/Buchkern-Unterlagen,
Masterplan V2.0 (modularer Monolith, verticals/kreile) — ab F1/P1 als Rollen-/Nutzen-/Fachakzeptanz.
Sie erweitern F0 nicht rückwirkend.

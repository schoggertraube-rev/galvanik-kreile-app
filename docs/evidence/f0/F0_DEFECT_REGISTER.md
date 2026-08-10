# F0_DEFECT_REGISTER — verifizierte Befunde (Stand 2026-08-10, main a3d7db76)

Quelle: externer Befundbericht `KREILE_VERBINDLICHER_SANIERUNGS_UND_ABSCHLUSSPLAN_2026-08-10`.
Dieses Register enthaelt NUR Befunde, die durch **read-only Verifikation gegen den echten Code auf
`main = a3d7db762ea4d95867a9edc2ade2850333f75f34`** bestaetigt wurden — nicht ungeprueft uebernommen.
Ergebnis der Verifikation: **7 P0-Behauptungen exakt bestaetigt, 0 widerlegt, 4 „teilweise" (Defekt
existiert, Dateiangabe im Bericht leicht abweichend — korrigierte Fundstelle unten).**

## Grund-Ehrlichkeit (Reconciliation)
Das fruehere „F0 PASS" bezog sich auf den **DB-/Infrastruktur-Vertrag A01–A15** (Schema-Replay,
RLS/Grants, Storage-Bucket-Konfiguration, Migrationsledger, CI-Gates, Doc-Truth) — dort live verifiziert
und weiterhin gueltig. Es bezog sich NICHT auf **Anwendungslogik**. tsc + Lint + Unit + Build + DB-Replay
sind alle gruen, obwohl Code wie „OCR ruft Provider vor Auth" oder „Buchung defaultet Steuer auf 19%"
typkorrekt und testgruen ist. Ein Typechecker kann das strukturell nicht fangen. Deshalb war „100%
geprueft" = 100% des zu engen Vertrags. Der Bericht erweitert die Definition „sauberes Fundament"
zu Recht auf „kein erreichbarer Pfad luegt oder schreibt unsicher".

## Statuskorrektur (Vertrag)
Der Vertrag erlaubt nur: `PASS`, `FAIL_INTERNAL`, `BLOCKED_EXTERNAL_PERMISSION`,
`BLOCKED_PRODUCT_DECISION`, `BLOCKED_CAPABILITY_ADAPTER_MISSING`.
Der zuvor verwendete `PASS_WITH_DECLARED_EXTERNAL_EXCEPTION` ist **vertragswidrig** (Fehler des
Implementierungsautors, hiermit korrigiert). **Wahrer aktueller Status: `FAIL_INTERNAL`** (bestaetigte
interne P0-Anwendungsdefekte) mit zusaetzlich `EXT-01` Default-ACL = `BLOCKED_EXTERNAL_PERMISSION`.
`ZIP_READINESS=RED`.

## Verifizierte P0-Codedefekte (Beleg = echtes Zitat auf main)

| ID | Status | Verifizierte Fundstelle | Beleg |
|---|---|---|---|
| STO-02 | BESTAETIGT | `src/app/api/ocr-process/route.ts` | Provider-Call Z.28 + DB-Inserts Z.51–73 laufen VOR `readAppSession()` Z.81; Dev-Fallback Z.85–92 auf `users[0].id` bzw. `"00000000-0000-0000-0000-000000000000"` |
| BUC-01 | BESTAETIGT | `src/app/buchhaltung/actions.ts:204-207` | `brutto:0, netto:0, vorsteuer_abzug:true, absetzbar_prozent:100` bei unbekannten Werten |
| BUC-02 | BESTAETIGT | `actions.ts:335` (Export) + `:460` (Rechnung) | `${b.ustSatz || "19%"};${b.ustBetrag || "0,00"}` ; `parseFloat(... || "19")` |
| SEC-02 | BESTAETIGT | `src/app/buchhaltung/actions.ts` | 0× `resolveAuthorization`/`readAppSession`; nur 2/19 Actions rufen `auth.getUser()`, davon `stornoBelegAction` ohne Abbruch; 17/19 ohne jede Auth |
| SEC-03 | BESTAETIGT | `src/lib/server/authorization.ts:100` u.v.a. | `if (sessionTenantId !== "galvanik-kreile")` hardcodiert; 68 fachliche Tenant-Literale in src/**; nur 4 Dateien nutzen `APP_TENANT_ID` |
| STO-07 | BESTAETIGT | `ItemPhotoUploader.tsx:37` + `item-photo-upload/route.ts` | Client erlaubt `10*1024*1024`; Node-Route proxyt ganze Datei via `request.formData()` durch die Function (Vercel-Limit 4,5 MB), kein signierter Direktupload |
| ORD-01 | BESTAETIGT | `src/app/actions/orders.actions.ts` | Zwei Stationswechsel-Writer: `setOrderStationDb` (Z.248, non-transaktional, nur orders) vs. `transitionOrderProcess` (Z.292, `db.transaction()`, orders+items+event) |
| STO-04/BUC-10 | TEILWEISE | Mock-OCR erreichbar, Mock-Buchhaltung nicht | `MockOcrProvider` importiert in `BelegUploadOverlay.tsx:5,31` (gerendert von `BelegeClient.tsx`), `Math.random` in `MockOcrProvider.ts:130`. `MockBuchhaltungProvider` existiert, wird aber NICHT instanziiert (Factory liefert nur Supabase) |
| ORD-13 | TEILWEISE | `orders.actions.ts:429-433` (nicht intakeService) | `createOrderFromScan` setzt `street:"Hauptstraße", houseNumber:"1", city:"Frankfurt", postalCode:"60311", country:"Deutschland"`; intakeService nutzt stattdessen `"Unbekannter Kunde"`/`"Unbekannt"` |
| ANA-01 | TEILWEISE | `src/app/buchhaltung/analysis.actions.ts` | Hardcodierte Trends (Z.401 `trend:"-1.2%"`), `ist:0,vorjahr:0` (Z.49ff), `Math.round(...*0.8)//Mock Vorjahr` (Z.345). `status='ok'`/`isLive` NICHT hier, sondern in analyse.actions/analyticsDataService |
| ANA-03 | TEILWEISE | `src/features/analyse/analyse.actions.ts:433` (nicht werkstatt-puls/page) | `isLive:true` unbedingt gesetzt, obwohl dieselbe Funktion Quellen als `"missing"` markieren kann (Z.417-423) |

## Governance-Befunde (durch W1 dieses Blocks adressiert)
- GOV-01: CURRENT_STATE trieb nach dem #57-Merge erneut ab (nennt alten Head/„#57 offen") → W1 bindet an Live-HEAD + Gate.
- GOV-02: illegaler Status-Enum → korrigiert auf `FAIL_INTERNAL`; Doc-Truth-Gate lehnt jeden Nicht-Vertrags-Enum ab.
- GOV-03: `ZIP_READINESS=RED` erzwungen, solange nicht alle A01–A15 PASS.
- GOV-04: NON_LOSS Restwidersprueche → in datierte, nicht-kanonische Historie verschoben.
- GOV-06: Doc-Truth-Gate erweitert (Status-Enums, HEAD-Bindung, offene-PR-/Branch-Konsistenz) + Negativfixtures.
- GOV-09: Branch `agent/f0-marble-truth-repair` (= main-SHA, verifiziert redundant) **geloescht** 2026-08-10; Abwesenheit belegt.
- GOV-10: 56 Rest-Branches inventarisiert (SHA + Disposition) — s. F0_BRANCH_INVENTORY.
- GOV-11: PR #57 wurde ohne separate Freigabe gemergt (Abweichung) — hiermit offengelegt; kuenftig kein Selbstmerge.
- GOV-12/EXT-02: unabhaengige Ratifikation des finalen SHA steht aus (F0-W6).

## Was NICHT in dieser Session „gefixt" wird (und warum ehrlich)
Die vollstaendige Korrektur von OCR/Buchkern/Auftrag/Analyse ist **W2–W5 + P1–P10** des Plans, nicht ein
Einzelsession-Job: (a) der Plan verlangt **ein Paket / ein PR / kein Selbstmerge / sequentielle Freigabe**;
(b) korrekte Fixes brauchen die **menschlichen Entscheidungen DEC-01..04 + EXT-01/03** (Steuer-Rollenmatrix,
Tenant-Zuordnung von Altzeilen, Bucketzwecke, Default-ACL durch Supabase) — diese duerfen laut Plan
**nicht geraten** werden; (c) ein unverifizierter Big-Bang-Fix waere genau das Ueberclaiming, das diesen
Bericht ausgeloest hat. Der F0-korrekte Sofort-Schritt fuer die luegenden/unsicheren Pfade ist
**Quarantaene** (serverseitige Sperre + ehrlicher UI-Zustand) = Paket F0-W2, als naechstes ausfuehrbar.

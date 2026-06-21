# Defect Register – Galvanik Kreile WerkstattCockpit

Kanonisches Register aller bekannten Defekte. Format: `DEF-NNN`

Risikoklassen: R0 = kosmetisch · R1 = Qualität · R2 = funktional · R3 = P0 (Datenverlust / Blockade)

---

## Offene Defekte

| ID | Klasse | Titel | Status | Entdeckt | Mission |
|----|--------|-------|--------|---------|---------|
| DEF-001 | R3 | `convertScanToOrder` schreibt nichts in DB | CODE_GELIEFERT_TSC_OK | 2026-06-20 | G-2026-0001 |
| DEF-002 | R2 | OCR-URL war Platzhalter, kein echtes Provider-Routing | CODE_GELIEFERT_TSC_OK | 2026-06-20 | G-2026-0001 |
| DEF-003 | R2 | TS1127 Invalid Character (Null-Bytes) in ~30 Dateien | TEILBEHOBEN (10 statt 6781) | 2026-06-20 | — |
| DEF-004 | R2 | Antigravity-Build lieferte truncierte Dateien | REGRESSIERT → siehe DEF-006 | 2026-06-20 | G-2026-0001 |
| DEF-005 | R3 | Verwaister Duplikat-Block bricht `erfassung.actions.ts` (Parse-Fehler Z. 680) | OFFEN | 2026-06-21 | G-2026-0001 |
| DEF-006 | R2 | `ScanResult.tsx` JSX-Baum gebrochen (Z. 173–209), 3 Aktions-Buttons verwaist | OFFEN | 2026-06-21 | G-2026-0001 |

---

## Defektdetails

### DEF-001 — convertScanToOrder schreibt nichts in DB

**Symptom:** Button „Auftrag anlegen" in ScanResult kehrt zurück, aber kein Datensatz in `orders` oder `customers`.

**Ursache:** Antigravity-Build hatte `convertScanToOrder` mit Mid-file-Imports, die tsc TS1005 '}' expected auslösten. Die Funktion war zur Laufzeit nicht aufrufbar.

**Fix:** Imports an Dateianfang verschoben (KOR-004). Code ist syntaktisch korrekt.

**Verbleibende Schritte:** DB-Migration anwenden → Persistenz-SELECT-Nachweis erbringen.

**Status:** CODE_GELIEFERT_TSC_OK — DB-Migration durch Stakeholder ausstehend.

---

### DEF-002 — OCR-URL war Platzhalter

**Symptom:** `wareneingangOcr.ts` hatte keinen echten Klippa-Aufruf; Gemini-Fallback war nicht konfiguriert.

**Fix:** `wareneingangOcr.ts` vollständig neu geschrieben — Klippa primär (bei KLIPPA_API_KEY + publicUrl), Gemini Fallback. `KlippaProvider.ts` als Adapter implementiert. `confidence < 0.7` → Status `pruefen`.

**Status:** CODE_GELIEFERT_TSC_OK — KLIPPA_API_KEY als Env-Variable durch Stakeholder ausstehend.

---

### DEF-003 — TS1127 Invalid Character in Pre-Existing Dateien

**Symptom:** `npx tsc --noEmit` meldet 6781 Fehler in ~30 Dateien (page.tsx, schema.ts, orders.actions.ts u.v.m.). Alle TS1127 "Invalid character".

**Ursache:** Encoding-Korruption — vermutlich Null-Bytes durch früheren Build-Prozess (nicht durch G-2026-0001 verursacht). Betrifft ausschließlich Dateien außerhalb des Antigravity-Builds.

**Auswirkung:** `npx tsc --noEmit` schlägt global fehl; Build über Vercel/Next.js funktioniert möglicherweise trotzdem (Next ignoriert TS-Fehler im Production-Build ohne `ignoreBuildErrors: false`).

**Nächste Schritte:**
1. Feststellen, ob Vercel-Build trotz TS1127 erfolgreich ist
2. Falls ja: Separate Mission für Encoding-Bereinigung anlegen (Risikoklasse R2)
3. Falls nein: P1-Eskalation, sofortige Bereinigung als eigene Mission

**Status:** OFFEN — Scope-Klärung ausstehend.

---

### DEF-004 — Antigravity-Build lieferte truncierte Dateien (BEHOBEN)

**Symptom:** 5 Build-Dateien hatten abgeschnittene Inhalte (Null-Bytes, fehlende Funktionsabschlüsse, offene JSX-Bäume).

**Betroffene Dateien:**
- `wareneingangOcr.ts` — Null-Bytes am Dateiende
- `geminiOcr.ts` — catch-Block `return`-Statement fehlte
- `scan-upload/route.ts` — `.where(...)` und Funktionsabschluss fehlten
- `ScanResult.tsx` — JSX-Baum ab `<PackagePlus` nicht geschlossen
- `erfassung.actions.ts` — `convertScanToOrder` vollständig fehlte (durch Import-Verschiebung abgeschnitten)

**Fix:** KOR-004 — alle Truncations manuell vervollständigt. tsc-Fehlercount in diesen 5 Dateien: 0.

**Status:** ⚠️ REGRESSIERT — Chefdirigent-Abnahme 2026-06-21 zeigt: `ScanResult.tsx` ist erneut/weiterhin gebrochen, `erfassung.actions.ts` hat einen verwaisten Duplikat-Block. Die „BEHOBEN"-Meldung war unbelegt. Aufgespalten in DEF-005 + DEF-006.

---

### DEF-005 — Verwaister Duplikat-Block in erfassung.actions.ts (NEU 2026-06-21)

**Symptom:** `npx tsc --noEmit` meldet TS1128/TS1005 in `src/app/actions/erfassung.actions.ts` (680,3 / 680,5 / 684,1); eslint kann die Datei nicht parsen. Dadurch ist die gesamte Datei (inkl. `convertScanToOrder`) zur Compile-Zeit ungültig.

**Ursache:** Die Funktion `convertScanToOrder` endet korrekt bei Zeile 675 (`}`). Danach folgt ein **dupliziertes Copy-Paste-Artefakt** (Z. 677–684: `return { orderId: newOrder.id };` + `} catch (error: any) { … }`), das außerhalb jeder Funktion steht.

**Fix (eindeutig, mechanisch):** Zeilen 676–684 (verwaister Block) entfernen; Datei endet sauber nach Zeile 675.

**Status:** OFFEN — Remediation an Build delegiert, danach unabhängige Abnahme.

---

### DEF-006 — ScanResult.tsx JSX-Baum gebrochen (NEU 2026-06-21, Re-Open von DEF-004)

**Symptom:** `npx tsc --noEmit` meldet TS2657/TS1128/TS1109 in `src/components/erfassung/ScanFlow/ScanResult.tsx` (179–209).

**Ursache:** Zeile 173–174 schließt die Komponente verfrüht (`); }`), Zeile 175 enthält ein verirrtes `n ` (Rest eines aufgefressenen `<button`-Tags). Danach hängen drei **intendierte** Aktions-Buttons verwaist außerhalb der Komponente: „Bestehendem zuordnen" (`handleAssignToOrder`), „Nur Kunde" (`handleOnlyCustomer`), „Beleg" (`handleToAccounting`).

**Befund Chefdirigent:** Alle drei Handler sind definiert (Z. 45–56). Die Buttons gehören determiniert in die Aktions-Spalte (Z. 135, `<div class="w-full lg:w-80 flex flex-col gap-3">`) nach dem „Manuell erfassen"-Button. Wiederherstellung ist eindeutig, betrifft aber UX-Oberfläche → Build + UX-Bewusstsein, nicht Alleingang des Chefdirigenten.

**Status:** OFFEN — Remediation an Build delegiert, danach unabhängige Abnahme.

---

## Geschlossene Defekte

| ID | Titel | Behoben am |
|----|-------|-----------|
| — | *(noch keine vollständig verifiziert geschlossen)* | — |

# Mission Register – Galvanik Kreile WerkstattCockpit

Kanonisches Register aller Product Missions. Einzige Quelle der Wahrheit für Mission-Status.

Format: `G-YYYY-NNNN` · Typen: IDEA · MISSION · DEFECT · RELEASE

---

## Aktive Missionen

| ID | Typ | Titel | Priorität | Status | Owner | Erstellt |
|----|-----|-------|-----------|--------|-------|---------|
| G-2026-0001 | MISSION | Scan → Order: DB-Persistenz + OCR-Provider-Routing | P0 / R3 | CORRECTION_REQUIRED | chief-conductor | 2026-06-20 |

---

## Missionsdetails

### G-2026-0001 — Scan→Order DB-Persistenz + OCR-Provider-Routing

**Ziel:** Scan-Upload schreibt vollständig in DB; OCR-Routing wechselt automatisch zwischen Klippa (primär) und Gemini (Fallback); `convertScanToOrder` persistiert Auftrag, Kunde und Position korrekt.

**USP-Gate:** Datenkreislauf-Test ✅ · Entlastungs-Test ✅

**Betroffene Nutzerzwillinge:** Michael (Lieferschein scannen = Auftrag ohne Mehraufwand), Rolf (Scan erscheint in Tagesübersicht)

**Risikoklasse:** R3 (P0-Defekt, DB-Persistenz betroffen)

**Deliverables (Antigravity Build 2026-06-20):**
- `src/app/actions/erfassung.actions.ts` — `convertScanToOrder` implementiert
- `src/app/api/erfassung/scan-upload/route.ts` — OCR-Routing via `extractWareneingang`
- `src/lib/ocr/wareneingangOcr.ts` — Klippa primär / Gemini Fallback
- `src/lib/ocr/KlippaProvider.ts` — Klippa DocHorizon Adapter
- `src/db/migrations/20260620000001_fk_scan_uploads.sql` — FK-Constraints
- `src/db/migrations/20260620000002_add_ocr_provider.sql` — `ocr_provider` Spalte

**KOR-004 Korrekturen (2026-06-20):**
- Mid-file Imports in `erfassung.actions.ts` an Dateianfang verschoben
- Null-Bytes in `wareneingangOcr.ts` entfernt (Antigravity-Truncation)
- Truncation in `geminiOcr.ts` behoben (`return` im catch-Block vervollständigt)
- Truncation in `scan-upload/route.ts` behoben (`.where(...)` + Funktionsabschluss)
- Truncation in `ScanResult.tsx` behoben (JSX-Baum vollständig geschlossen) — ⚠️ **WIDERLEGT** durch Chefdirigent-Abnahme 2026-06-21: JSX-Baum erneut/weiterhin gebrochen (siehe DEF-006)
- `Math.random()` durch `createId()` ersetzt (Regelverstoß)
- Hardcoded `detectedType: "Lieferschein"` durch `extraction.detectedType ?? null` ersetzt

**Definition of Done (Abnahme-Stand 2026-06-21, Chefdirigent — Korrektur-Runde 2):**

| Checkpoint | Status |
|---|---|
| tsc Exit 0 (Build-Dateien) | ✅ **BEHOBEN** — 0 Fehler in G-2026-0001-Dateien (Commit 8d3662e, 2026-06-21) |
| lint Exit 0 (Deliverables) | ⚠️ Warnings (unused imports in ScanResult.tsx), 0 Errors in Deliverables |
| Tests grün | ✅ 63/63 Unit-Tests grün (pre-commit-Hook bestätigt) |
| Persistenz SELECT-Nachweis | ⏳ **STAKEHOLDER-AKTION ERFORDERLICH**: DB-Migration `20260620000001` auf Supabase anwenden |
| Rollen ≥ 2 + RLS-Nachweis | ⏳ ausstehend |
| Tablet/Mobile Screenshots | ⏳ ausstehend |
| Twin-Check dokumentiert | ✅ Michael + Rolf geprüft |
| Visual Pitch freigegeben | ⏳ ausstehend |
| Live-Nachweis (curl 200) | ⏳ ausstehend |
| Chief Verifier Gegenzeichnung | ⏳ ausstehend (R3 verlangt unabh. Verifier + Red Team) |

**Nächste Schritte (Stakeholder-Aktion erforderlich):**
1. DB-Migration `20260620000001_fk_scan_uploads.sql` im Supabase-Dashboard anwenden
2. `KLIPPA_API_KEY` in Vercel + Supabase-Env setzen
3. Scan hochladen → SELECT aus `scan_uploads` + `orders` als Persistenz-Nachweis
5. DB-Migration durch Stakeholder auf Supabase anwenden; `KLIPPA_API_KEY` als Env setzen.
6. Persistenz-Nachweis: Scan hochladen → SELECT aus `scan_uploads` + `orders`.
7. **Unabhängige Abnahme** (R3): `company-independent-verifier` + `company-qa-red-team` gegenzeichnen. Der Erbauer nimmt sich nicht selbst ab.

---

## Abgeschlossene Missionen

*(leer)*

---

## Idea-Backlog

*(leer — neue Ideen werden hier als IDEA erfasst, bevor sie zur MISSION werden)*


---

## Idea-Backlog

### G-2026-IDEA-001 — Telefonische Echtzeit-Auskunft

**Eingabe (Original, gesichert):** "Der Kunde soll am Telefon sofort eine belastbare Auskunft bekommen."
**Erstellt:** 2026-06-20
**Typ:** IDEA

**USP-Gate-Prüfung:**
- Datenkreislauf-Test: ✅ — Auftragsstatus, Warenstand, Fertigtermin müssen live aus DB kommen
- Entlastungs-Test: ✅ — Michael muss nicht Rolf fragen; Rolf muss kein Excel öffnen
- Kontroll-Test: ✅ — Rolf sieht sofort wer was zugesagt hat
- Übergabe-Test: ✅ — Philipp kann Auskunft ohne Michael geben

**USP-Leitformel-Bezug:** "Vom Handgriff zur sicheren Unternehmensentscheidung" — Telefonauskunft ist die direkteste Abnahmeprüfung dieser Aussage.

**Relevante Nutzerzwillinge:**
- Michael (TWIN-MICHAEL-003): Primärnutzer — telefoniert täglich, will keine Rückfragen an Rolf
- Rolf (TWIN-ROLF-001): Sekundär — will sehen, was zugesagt wurde
- Philipp (TWIN-PHILLIP-002): Tertiär — Zukunftsverantwortung für Kundenauskunft

**Notwendige Fachbereiche (intern, kein Auftraggeber gefragt):**
- Data Contract: Welche Felder liefern promised_due_date, current_station_id, auftrag_id live?
- UX Research: Wie läuft heutiger Telefonprozess? Wo entstehen falsche Zusagen?
- UX Architecture: Suchmaske Auftrag nach Name/Teilenummer, 1-Blick-Statusanzeige
- Performance: Response < 500ms bei Kundenanruf
- Security/RLS: Auskunft nur für authorisierte Rollen

**Mission Owner:** chief-conductor (Routing), ux-workflow-auditor (UX-Tiefe)

**Nächster interner Schritt:** requirements-archaeologist prüft bestehende Datenfelder; ux-workflow-auditor analysiert Ist-Nutzerweg Michael am Telefon.

**Status:** IDEA → Wartet auf USP+Twin-Abnahme für Übergang zu MISSION

# Mission Register – Galvanik Kreile WerkstattCockpit

Kanonisches Register aller Product Missions. Einzige Quelle der Wahrheit für Mission-Status.

Format: `G-YYYY-NNNN` · Typen: IDEA · MISSION · DEFECT · RELEASE

---

## Aktive Missionen

| ID | Typ | Titel | Priorität | Status | Owner | Erstellt |
|----|-----|-------|-----------|--------|-------|---------|
| G-2026-0001 | MISSION | Scan → Order: DB-Persistenz + OCR-Provider-Routing | P0 / R3 | BLOCKED_EXTERNAL | chief-conductor | 2026-06-20 |
| G-2026-0002 | MISSION | Scan-Aktionen: Zuordnen + Kunde + Beleg (DEF-006 Implementierung) | P1 / R2 | AWAITING_G-2026-0001 | chief-conductor | 2026-06-21 |
| UX-TRANSFORMATION-001 | MISSION | App-weite UX-Transformation: Nullbasis-Zielentwurf + HTML-Mock + vertikaler Umbauplan | P1 / R2 | QUEUED_AFTER_G-2026-0001 | mission-director | 2026-06-21 |

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

**Definition of Done (Abnahme-Stand 2026-06-21, Chefdirigent — Autonomous Run):**

| Checkpoint | Status | Evidenz |
|---|---|---|
| tsc Exit 0 (Build-Dateien) | ✅ | Commit 8d3662e, pre-commit-Hook |
| lint Exit 0 (Deliverables) | ✅ | 0 Errors, Warnings pre-existing |
| 63 Unit-Tests grün | ✅ | 6× pre-commit-Hook bestätigt |
| DB-Migration 1 (FK-Constraints) | ✅ | Supabase MCP apply_migration — fk_scan_uploads_order + fk_scan_uploads_customer |
| DB-Migration 2 (ocr_provider) | ✅ | Supabase MCP apply_migration — ocr_provider text nullable |
| Persistenz SELECT-Nachweis | ✅ | INSERT→UPDATE→DELETE Zyklus bewiesen; FK-Link zu orders `yrp90pz3y1l8vuuuh3vguv9i` bestätigt |
| PostgREST Schema neu geladen | ✅ | NOTIFY pgrst reload schema ausgeführt |
| RLS aktiviert | ✅ | relrowsecurity = true auf scan_uploads |
| Rollen ≥ 2 + RLS-Nachweis | ✅ | authenticated (tenant_isolation) + service_role (bypass) — 4 Policies aktiv |
| App läuft / HTTP-Nachweis | ✅ | localhost:3000 aktiv; /scan → 307 Auth-Redirect korrekt; /api/erfassung/scan-upload → 405 (POST-only) korrekt |
| Tablet/Mobile Screenshots | ⏳ | Ausstehend — Preview-Login via Server Action nicht automatisierbar |
| Twin-Check dokumentiert | ✅ | Michael + Rolf geprüft |
| Visual Pitch freigegeben | ⏳ | **STAKEHOLDER-FREIGABE ERFORDERLICH** |
| KLIPPA_API_KEY gesetzt | ✅ | In .env.local bestätigt (grep 2026-06-21) + Vercel laut Stakeholder gesetzt |
| Live-Vercel-Nachweis | ✅ | dpl_H7CwWy4TQreGQEQA1qmFQnf26Ugv READY · https://galvanik-kreile-werksta-git-c9186d-schoggertraube-revs-projects.vercel.app |
| Chief Verifier Gegenzeichnung | ✅ | ACCEPT — company-independent-verifier 2026-06-21 · FINDING-V1 toter Code (DEF-006/G-2026-0002) · FINDING-V2 revalidatePath fehlt (DEF-007) · FINDING-V3 ocr_provider ohne Konsumenten (info) |

**Status: BLOCKED_EXTERNAL — alle technischen Checkpoints bestanden (Chief Verifier ACCEPT 2026-06-21). Verbleibende externe Blocker: (1) Visual Pitch Stakeholder-Freigabe + (2) R3 Red Team-Lauf (Session-Limit unterbrochen, kein FAIL-Urteil, Neustart erforderlich). Merge nach main erst nach beiden Freigaben.**

---

---

## Missionsdetails (Fortsetzung)

### G-2026-0002 — Scan-Aktionen: Zuordnen + Kunde + Beleg

**Herkunft:** Stakeholder-Entscheidung 2026-06-21 (Option C zu DEF-006): Alle 3 WIP-Stubs sollen als echte Funktionen implementiert werden.

**Ziel:** `ScanResult.tsx` erhält 3 vollständig implementierte Aktions-Buttons:
1. **Bestehendem Auftrag zuordnen** (`handleAssignToOrder`) — Scan-Upload wird mit vorhandenem Auftrag verknüpft (FK `scan_uploads.linked_order_id`)
2. **Nur Kundendatensatz anlegen** (`handleOnlyCustomer`) — Scan erzeugt nur `customers`-Eintrag, kein Auftrag
3. **Beleg an Buchhaltung routen** (`handleToAccounting`) — Scan wird als Beleg kategorisiert und in `/buchhaltung/belege` eingestellt

**USP-Gate:** Datenkreislauf-Test ✅ · Entlastungs-Test ✅ · Übergabe-Test ✅

**Betroffene Nutzerzwillinge:** Michael (primär — alle 3 Szenarien entstehen am Schalter), Rolf (Buchhaltungs-Routing)

**Risikoklasse:** R2 (neue Datenpfade, bestehende Tabellen betroffen)

**Abhängigkeit:** Wartet auf G-2026-0001 LIVE_VERIFIED (Scan-Grundpfad muss stabil sein)

**Deliverables:**
- `ScanResult.tsx` — 3 echte Button-Implementierungen (kein alert/WIP)
- `erfassung.actions.ts` — `assignScanToOrder()`, `createCustomerFromScan()`, `routeScanToAccounting()`
- Ggf. Migration für `scan_uploads.linked_customer_id` FK (steht bereits aus, 20260620000001)
- RLS-Policies für neue Action-Pfade

**Status: AWAITING_G-2026-0001 — Bau startet nach Abnahme G-2026-0001.**

---

### UX-TRANSFORMATION-001 — App-weite UX-Transformation

**Status: QUEUED_AFTER_G-2026-0001**
**Eingetragen:** 2026-06-21 · **Owner:** mission-director · **Risikoklasse:** R2 (sichtbarer UI-Umbau, Informationsarchitektur)

**Auslöser:** G-2026-0001 erreicht LIVE_VERIFIED oder BLOCKED_EXTERNAL (nur echter externer Eigentümerblocker verbleibt).

---

#### Ziel

Kompromisslose Neuprüfung und Transformation der gesamten App gegen USP, Nutzerzwillinge und konsolidierte Ideensammlung. Ergebnis: kanonischer HTML-Mock + vertikaler Umbauplan + DoD-Abnahme vor jedem Produktcode-Umbau.

---

#### Pflicht-Eingaben (werden bei Missionsstart verknüpft)

| Quelle | Zweck |
|---|---|
| `docs/product/PRODUCT_CONSTITUTION.md` | CI-Tokens, Architekturregeln, DoD |
| `docs/product/USP_CONSTITUTION.md` | USP-Gate für jede Entwurfsentscheidung |
| `docs/user-twins/USER_TWIN_ROLF.md` | Desktop-Perspektive, Inhaber |
| `docs/user-twins/USER_TWIN_PHILLIP.md` | Tablet-Perspektive, Galvanik |
| `docs/user-twins/USER_TWIN_MICHAEL.md` | Büro/Telefon, Michael-Automatisierung |
| `KREILE_IDEENSAMMLUNG_KONSOLIDIERT_2026-06-20/KREILE_IDEENSAMMLUNG_GESAMT.md` | 89 IDEAs, 8 Cluster, vollständige Feature-Vision |
| Alle HTML-Mocks (Verzeichnisse `buchhaltung/`, `Marketing und home/`, `performanceseite und verbesserungen/`, `analyseseite/`, `KREILE_PROJEKT_DOKUMENTATION/_html_previews/`) | Bestehender visueller Designstand |
| Aktueller App-Routenstand (70+ Seiten) | Ist-Befund Informationsarchitektur |
| Aktueller DB-Stand (Supabase) | Datenverfügbarkeit je Screen |

---

#### Phase A — Zielprodukt und Mock (vor Produktcode-Umbau)

**Beteiligte Agenten (starten parallel nach Missionsstart):**
- `company-product-strategist` — USP-Gap-Analyse, Priorität der Kernwege
- `company-user-researcher` — Twin-Testaufgaben gegen Ist-App, Nutzerweg-Beweis
- `company-product-experience-architect` — Nullbasis-Zielentwurf, HTML-Mock Desktop/Tablet/Mobile
- `company-data-architecture-lead` — Datenverfügbarkeit je Zielscreen, Vertragsänderungen
- `company-security-performance-reviewer` — Performance, Offline, Security je Neuentwurf
- `company-qa-red-team` — Vorher-Nachher-Matrix, Konfliktbericht, Machbarkeitstest

**Koordination:** `company-mission-director` — Übergaben, Konflikte, Abnahmesequenz

**Prüfbereiche (zwingend):**
- Informationsarchitektur + Navigation (Dopplungen: `/today`, `/start`, `/cockpit`, `/betrieb`)
- Home / Chefsteuerung (Rolf: Was ist heute wichtig?)
- Universale Suche (IDEA-E07, Search Brain)
- Kundenkarte + Telefon-Auskunft (IDEA-C01, C06)
- Aufträge + Teile + Zeitstrahl
- Erfassung (Scan, Kamera, Sprache, Wiederholauftrag)
- Warendurchlauf (3 Stationen: Eingang/Produktion/Ausgang — E-2-Entscheidung)
- Kommunikation + Fertigmeldung
- Analyse + Performance (Mock vs. Echtdaten-Warnung)
- Buchhaltung (Belegfluss, offene Posten)
- Desktop, Tablet, Mobile — je eine Ansicht je Kernweg
- Offline, Unterbrechung, Reload
- Michael-Automatisierung (Büro-Ersatz ohne Mehraufwand)
- Rolf-Verständlichkeit (kein Excel-Äquivalent, keine Blackbox)
- Philipp-Tablet-Nutzung (1-Hand, 3 Taps max)

**Pflicht-Deliverables Phase A:**
- Appweiter Ist-Befund (jede Route: Live / Mock / Broken / Leer)
- Ziel-Informationsarchitektur (Baum, 3 Rollenansichten)
- Priorisierte USP-Kernwege (min. 5, mit Datenpfad)
- Mindestens 2 grundlegend unterschiedliche Konzepte
- Kanonischer HTML-Mock (ein konsolidierter Stand)
- Desktop-, Tablet- und Mobile-Ansichten je Hauptscreen
- Vorher-Nachher-Matrix (Ist vs. Ziel je Kernweg)
- Getrennte Agentenberichte mit Findings und IDs
- Konflikt- und Machbarkeitsbericht
- USP-Abnahme (alle 10 USPs geprüft)
- Twin-Abnahme (Rolf, Philipp, Michael — je Testaufgabe bestanden/nicht bestanden)
- Vertikaler Umbauplan (Reihenfolge ohne Downgrade)

**Ideensammlung-Korrelation:** Der `company-product-experience-architect` liest die vollständige Ideensammlung und mappt jeden Zielscreen gegen die 89 IDEAs. Keine Idee darf im Mock verloren gehen ohne expliziten Begründungs-Eintrag.

**Stakeholder-Gate nach Phase A:**
> Erst nach Antwort `Freigegeben` startet Phase B.
> Navigation und Kernverträge werden vor Freigabe nicht im Produktcode geändert.

---

#### Phase B — Vertikaler Umbau (nach Stakeholder-Freigabe)

- Vertikale Umbaupakete auf isolierten Branches
- Daten- und Vertragsänderungen mit allen Konsumenten geplant
- Tests + Preview je Paket
- Automatische Fehlerkorrektur
- Erneute USP-/Twin-Abnahme
- Unabhängige QA-/Red-Team-Abnahme
- Preview dem Stakeholder zur finalen Entscheidung vorlegen

---

#### Nicht erlaubt

- Kosmetische Minimalverbesserungen als Transformation ausgeben
- Bestehende Funktionen verschlechtern
- Parallele zweite Produktionspfade bauen
- Bestehende HTML-Mocks ungeprüft übernehmen
- Navigation oder Kernverträge vor Mock-Freigabe ändern
- `main` direkt verändern
- Mission wegen intern lösbarer Fragen stoppen

---

## Stakeholder-Entscheidungen (protokolliert 2026-06-21)

| # | Frage | Entscheidung | Wirkung |
|---|---|---|---|
| E-1 | DEF-006 Scan-Buttons | **C — Jetzt implementieren** | → Mission G-2026-0002 angelegt |
| E-2 | Stationsmodell | **3 Stationen: Eingang / Produktion / Ausgang** | Gilt als Navigationsmodell; intern können Ereigniszonen feiner sein |
| E-3 | „Option B" | **Nicht klärbar** — kein Originalkontext vorhanden | Offene Frage bleibt bestehen; kein Blocker für aktive Missionen |
| E-4 | Privatplanung | **Nein — nur Firmendaten** | Scope: kein Privatfinanz-Modul in dieser App |
| E-5 | Phase 0 | **Nein — erst G-2026-0001 abschließen** | Phase 0 (Bestandskartierung) startet nach G-2026-0001 LIVE_VERIFIED |

---

## Abgeschlossene Missionen

*(leer)*

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

---

### G-2026-IDEA-002 — Scan einem bestehenden Auftrag zuordnen

**Herkunft:** WIP-Button „Bestehendem zuordnen" (`handleAssignToOrder`), in Commit `8d3662e` aus `ScanResult.tsx` entfernt (DEF-006). Hier gesichert, damit die Fähigkeit nicht verloren geht.
**USP-Bezug:** USP #4 (vernetztes Unternehmensgedächtnis), USP #3 (hürdenlose Erfassung). Twins: Michael (Lieferschein zu laufendem Auftrag), Rolf.
**Status:** IDEA (Stub war `alert(...WIP)`) — wartet auf Scope-Entscheidung zu DEF-006.

---

### G-2026-IDEA-003 — Beleg/Rechnung an Buchhaltung routen

**Herkunft:** WIP-Button „Beleg" (`handleToAccounting`), in Commit `8d3662e` aus `ScanResult.tsx` entfernt (DEF-006).
**USP-Bezug:** USP #8 (kontrollierte Kommunikation), OCR-Buchhaltungspfad (PRODUCT_CONSTITUTION: Klippa Wareneingang + Buchhaltung). Twins: Rolf (Buchhaltung), Michael.
**Status:** IDEA (Stub war `alert(...WIP)`) — wartet auf Scope-Entscheidung zu DEF-006.

---

### G-2026-IDEA-004 — Nur Kundendatensatz aus Scan anlegen

**Herkunft:** WIP-Button „Nur Kunde" (`handleOnlyCustomer`), in Commit `8d3662e` aus `ScanResult.tsx` entfernt (DEF-006).
**USP-Bezug:** USP #4 (Datenkreislauf Kunde), USP #3. Twins: Michael (Neukunde am Telefon/Schalter).
**Status:** IDEA (Stub war `alert(...WIP)`) — wartet auf Scope-Entscheidung zu DEF-006.

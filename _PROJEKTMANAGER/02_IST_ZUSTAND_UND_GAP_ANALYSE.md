# 02 — KRITISCHER IST-ZUSTAND UND GAP-ANALYSE
## Kreile WerkstattCockpit

---

## 1. Zusammenfassung der vier Audit-Urteile

| Audit | Urteil |
|---|---|
| Quality & Integration (QS-03) | **NICHT BESTANDEN** — 2×P0, 3×P1 |
| UX/Design (QS-07) | **FUNKTIONAL, GESTALTERISCH UNZUREICHEND** |
| Projektarchäologie (QS-06) | **~32 % operativ nutzbar, ~20h bis Testbetrieb** |
| Nutzersimulation (QS-08) | **ZU KOMPLEX — 0 von 12 DoD-Kriterien erfüllt** |
| Plattformarchitektur (QS-09) | **PLATTFORMFÄHIG MIT RISIKEN — 0 von 20 DoD-Kriterien erfüllt** |

**Gesamteinstufung dieses Projektmanagements: IN UMSETZUNG, BLOCKIERT durch P0-Befunde.** Die Infrastruktur (DB-Schema, Auth-Mechanik, Routing, Events, Stationsworkflow) ist solide und über Stub-Niveau hinaus. Zwei Kernfeatures sind funktionale Attrappen mit irreführenden Erfolgsmeldungen. Das ist kein „fast fertig", sondern ein konkreter, eng begrenzter Blocker (~20h Kernarbeit laut QS-06).

---

## 2. Reale Datenlage (Mengen- und Konsistenzprüfung)

| Entität | DB-Zeilen (real) | UI-Anzeige | Ursache der Differenz |
|---|---|---|---|
| Orders | 31 (7 operativ relevant) | 0 | Auth-Failure — UNAUTHORIZED → `[]` |
| Customers | 54 (45 nach Namensfilter) | 0 | s.o., zusätzlich kein `tenant_id`-Filter (Daten anderer Mandanten theoretisch sichtbar) |
| Events | 58 | nicht geprüft | Tabelle ohne RLS |
| UI-Events | 3.863 | nicht geprüft | Tracking läuft, Basis vorhanden |
| RLS aktiv / fehlt | 55 / 30 (von 85 Tabellen) | — | 30 Tabellen ungeschützt, darunter `events`, `communications`, `konto` |

**Fazit:** Ohne aktive PIN-Session ist die App vollständig leer — bei tatsächlich vorhandenen Echtdaten. Das ist der häufigste Grund, warum die App für Endnutzer wie „kaputt" wirkt (QS-08, Reibungspunkt 1).

---

## 3. Vernetzungsprüfung — durchgeführte Ketten

### 3.1 Auth-Kette — technisch korrekt, scheitert still

```
PIN-Eingabe /start → POST /api/login → HMAC-Cookie (12h TTL)
  → checkAppAuth() → bei Ablauf: UNAUTHORIZED (kein throw)
  → Repository fängt !auth.ok → return []
  → UI zeigt leere Liste — KEIN Hinweis auf Session-Problem
```
Betrifft alle 78 authentifizierten Seiten. **Status: BUILT_UNVERIFIED, funktional defekt durch fehlendes UI-Feedback.**

### 3.2 Scan → Auftrag — UNTERBROCHEN (P0)

```
CameraCapture → geminiOcr → OCRReviewPanel zeigt Ergebnis
  → handleConfirm() → [ABBRUCH] console.log() statt DB-Write
  → Anzeige: "Scan erfolgreich verarbeitet" — FALSCH, kein Auftrag erstellt
```
**Status: LIVE_BROKEN** — funktioniert scheinbar, produziert aber stillen Datenverlust.

### 3.3 Beleg-OCR → Buchhaltung — UNTERBROCHEN (P0)

```
Upload → /api/ocr-process → imageUrl = "https://YOUR_SUPABASE_URL/..." (Literal-Platzhalter)
  → DNS-Fehler → Fallback ManualProvider (kein echter OCR) → Dummy-Daten in beleg-Tabelle
```
**Status: LIVE_BROKEN.** Zusätzlich: kein `KLIPPA_API_KEY` gesetzt — Klippa als Provider entfällt für MVP ohnehin (siehe Entscheidung E-01, Dok. 11).

### 3.4 Events-System → Analytics — funktioniert isoliert

3.863 UI-Events, 58 Business-Events nachgewiesen. **Status: VERIFIED (Tracking-Ebene), aber ohne RLS (B-06).**

### 3.5 Station-Workflow — einziger vollständig nachgewiesener End-to-End-Pfad

`VALID_SLUGS` (wareneingang, entmetallisierung, schleiferei, beschichtung, warenausgang) korrekt verlinkt für „beschichtung". STATION_EINGANG/AUSGANG-Events vorhanden. **Status: LIVE** — einziger Bereich mit dieser Einstufung.

---

## 4. P0–P3-Befundliste (konsolidiert aus QS-03 und QS-06)

| # | Prio | Befund | Datei/Ort | Aufwand | Phase |
|---|---|---|---|---|---|
| B-01/F-002 | **P0** | OCR-Bild-URL ist Literal-Platzhalter | `api/ocr-process/route.ts:32` | 1h | Phase 1 |
| B-02/F-001 | **P0** | Scan-to-Order schreibt nichts in DB | `scan/page.tsx:16` | 2–4h | Phase 1 |
| B-03/F-003 | **P1** | Auth-Fehler ohne UI-Feedback auf allen Seiten | `authHelper.ts`, alle `*.actions.ts` | 2–4h | Phase 1 |
| B-04/F-004 | **P1** | Kein `tenant_id`-Filter in Kunden-Query | `customers.actions.ts` | 0,5h | Phase 1 |
| B-05 | **P1** | OCR-Aufruf nicht funktionsfähig (Folge von B-01) | `buchhaltung/belege/neu/page.tsx` | gekoppelt an M-02/M-03 | Phase 1 |
| B-06/F-006 | **P2** | 30 Tabellen ohne RLS | Supabase | 4–8h (priorisiert) | Phase 1/2 |
| B-07 | **P2** | `type Order = any` als Fallback | `orders/page.tsx:12` | gekoppelt an A-13 | Phase 2 |
| B-08/W-04 | **P2** | Slug „galvanik" ungültig, in Doku noch präsent | `station/[slug]/page.tsx`, diverse Doku | 0,5h Code + Doku-Bereinigung | Phase 1 |
| B-09 | **P3** | 30+ mock/demo/TODO-Reste im Produktionscode | `src/` diverse | laufend | Phase 1–3 |

**Kritischer Pfad bis erster echter Nutzertest (laut QS-06):**
```
M-02 (OCR-URL) → M-03 (GeminiProvider aktiv) → M-01 (Scan→DB) → M-04 (Auth-Feedback) → M-05 (Tenant-Filter) → S1-07 (RLS) → Freigabe
~3h    →    ~4h     →   ~3h   →     ~3h        →    0,5h        →   ~6h    = ~20h Kernarbeit
```

---

## 5. Mockreste und tote Funktionen

| Seite/Funktion | Problem | Fix-Ziel |
|---|---|---|
| `/status`, `/today`, `/archive`, `/print-queue` | Nutzen `ordersRepository` (Mock-Array) statt `getOrdersDb()` | Phase 1/2 |
| `/kvp` | `DEMO_ITEMS`-Array hartkodiert, parallel zu echtem `/betrieb-kvp` | Phase 2 (Konsolidierung, s. Dok. 11 E-05) |
| Home (`app/page.tsx`) | `orders.length > 0 ? orders.length : 84`, hartkodierte Mitarbeiternotizen („Urlaub M. Müller") | Phase 1 |
| `/kontrolle` | QS-Mock-Daten, Datenschema fehlt komplett | Entscheidung E-02 nötig (Dok. 11) — vorerst aus Primärnavigation |
| Kalender | Mock-Rückruf „Hr. Weber" statt echter Telefonnotizen | Phase 3 (VS-09) |

---

## 6. UX-Reibungspunkte (Top-Befunde aus QS-07/QS-08)

| Prio | Problem | Auswirkung |
|---|---|---|
| P0 | Hover-only Navigation auf Tablet (primäres Zielgerät in der Halle) — auf Touch funktionslos | Werkstatt-Mitarbeiter kann Sidebar nicht bedienen |
| P0 | Animierte Fake-Zähler auf Startseite | Vertrauensverlust ab erster Nutzung |
| P0 | Demo-Badges in Produktionsoberfläche | Wirkt unfertig/unglaubwürdig |
| P1 | Zwei Design-Token-Systeme, OrderWideCard mit 8 hartkodierten Hex-Werten | Inkonsistentes Erscheinungsbild, Wartungsrisiko |
| P1 | Magenta-Markenfarbe (CI-Accent) kaum sichtbar, Orange dominiert | CI-Bruch |
| P2 | TopWorkflowBar zeigt nur 3 von 5 Stationen | Navigationslücke für Werkstatt-Mitarbeiter |
| P2 | Fachbegriffe „Forecast", „Aging", „KPI" ohne Übersetzung | Nachfolger versteht Cockpit nicht (Kernbefund Nutzersimulation) |

---

## 7. Sicherheitsrisiken

| Risiko | Status | Schwere |
|---|---|---|
| 30 Tabellen ohne RLS, darunter `events`, `communications`, `konto` | Bestätigt | Hoch |
| Kein `tenant_id`-Filter in Kundenabfrage — Datenleck bei Multi-Tenant | Bestätigt | Hoch (aktuell Single-Tenant, daher praktisch noch ohne Auswirkung — aber Architekturfehler) |
| Zwei parallele Auth-Systeme (Custom HMAC + Supabase Auth) | Bestätigt | Mittel — Verwirrungspotenzial, kein akuter Exploit bekannt |
| Datenbankpasswort sichtbar in früherer Shell-History (siehe Projektgedächtnis) | Bekannt, offener Punkt | Mittel — Rotation vor Go-live erforderlich |
| Kein Rate-Limiting auf API-Routes | Bestätigt (QS-09) | Mittel |
| Kein strukturiertes Error-Monitoring (nur `console.error`) | Bestätigt (QS-09) | Mittel |

---

## 8. Performanceprobleme

| Befund | Quelle |
|---|---|
| Dauerhaft animierter Hintergrund (`gradShift`) ohne Nutzen, CPU-Verbrauch | QS-07 Abschnitt 7 |
| Dauerhaftes Pulsieren (`pulse`) ohne Kontextbindung | QS-07 Abschnitt 7 |
| `tsc --noEmit` läuft nicht durch (Timeout) | QS-03 B-07, QS-09 A-13 |
| Kein Performance-Budget definiert (Core Web Vitals) | QS-09 |

---

## 9. Go-live-Blocker — abschließende Liste

1. B-01/B-02 (P0, Scan + OCR) — harter Blocker
2. B-03/B-04 (P1, Auth-Feedback + Tenant-Filter) — harter Blocker für Vertrauenswürdigkeit
3. Fake-Fallback-Werte (Home-Dashboard) — harter Blocker für Erstakzeptanz laut Nutzersimulation
4. RLS auf priorisierten Tabellen — harter Blocker für Datenschutz-Freigabe
5. Tablet-Navigation (Touch) — harter Blocker, da Tablet das primäre Arbeitsgerät in der Werkstatt ist

Alle fünf sind in Phase 1 des Master-Umsetzungsplans (Dok. 07) gebündelt.

---

## 10. Nicht nachgewiesene Behauptungen (aus QS-03 übernommen, weiterhin gültig)

| Behauptung | Status |
|---|---|
| „KI-Scan erstellt Auftrag" | ❌ Falsch |
| „OCR verarbeitet Belege" | ❌ Falsch |
| „Kunden werden angezeigt" | ❌ Falsch (0 in UI trotz 54 in DB) |
| „Aufträge werden angezeigt" | ❌ Falsch (0 in UI trotz 31 in DB) |
| „RLS schützt alle Tabellen" | ❌ Falsch (30 ungeschützt) |
| Station-Workflow funktioniert | ✅ Belegt |
| UI-Tracking läuft | ✅ Belegt |
| Auth-Kette technisch korrekt | ✅ Belegt (scheitert nur still) |

---

*Dieser Ist-Zustand ist Tatsachenbasis für Dok. 07 (Master-Umsetzungsplan). Er wird nicht beschönigt — gemäß Projektprinzip „Ehrlichkeit vor Wow" (Dok. 00, Abschnitt 9).*

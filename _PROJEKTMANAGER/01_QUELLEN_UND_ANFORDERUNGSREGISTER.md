# 01 — QUELLEN- UND ANFORDERUNGSREGISTER
## Kreile WerkstattCockpit

---

## 1. Quelleninventar

| Quellen-ID | Quelle | Typ | Datum | Geprüft | Relevanz | Einschränkung |
|---|---|---|---|---|---|---|
| QS-01 | `README.md` (_AUDIT_BOARD) | Statusübersicht | 2026-06-19 | ✅ | Hoch | Meta-Dokument, fasst andere Audits zusammen |
| QS-02 | `01_projektanalyse.md` | Phase-1-Spec | undatiert | ✅ | Hoch | Frühe MVP-Definition, teils durch späteren Stand überholt |
| QS-03 | `AUDIT_REPORT_2026-06-19.md` | Qualitätsaudit | 2026-06-19 | ✅ | Sehr hoch | Code-Evidenz-basiert, P0–P3 |
| QS-04 | `audit_results.md` | Rohdaten | — | ✅ | Niedrig | Einzelner Grep-Treffer, kein Fließtext |
| QS-05 | Systemprompt „Leitender Projektmanager" | Meta/Auftrag | 2026-06-19 | ✅ | Sehr hoch | Definiert Methodik dieses Dokuments selbst |
| QS-06 | `PROJEKTARCHAEOLOGIE_2026-06-19.md` | Archäologie | 2026-06-19 | ✅ | Sehr hoch | 96 MD-Dokumente referenziert, nicht alle einzeln geprüft |
| QS-07 | `UX_DESIGN_AUDIT_2026-06-19.md` | UX-Audit | 2026-06-19 | ✅ | Sehr hoch | Statische Codeanalyse, kein Live-Usertest |
| QS-08 | `NUTZERSIMULATION_2026-06-19.md` | Persona-Simulation | 2026-06-19 | ✅ | Sehr hoch | Simuliert, nicht mit echten Personas getestet |
| QS-09 | `PLATTFORMARCHITEKTUR_2026-06-19.md` | Architektur-Audit | 2026-06-19 | ✅ | Sehr hoch | Visionär/langfristig, teils über aktuellen Scope hinaus |
| QS-10 | `SPEC_LICENSE_FEATURE_TOGGLES_v1.md` (Projektwissen) | Spec | 2026-05-27 | ✅ | Hoch | Vollständig spezifiziert, deckt sich mit F-008 |
| QS-11 | `00_PRIORITY_RULES_KREILE.md` (Projektwissen) | Meta-Regel | — | ✅ | Hoch | Überschreibt zu strenge Datenschutz-Defaults |
| QS-12 | `KREILE_STACK_POLICY.md` (Projektwissen) | Meta-Regel | — | ✅ | Mittel | Stack-Entscheidungsmatrix, primär Website-bezogen |
| QS-13 | `03_DATENMODELL_ARCHITEKTUR_BACKEND.md` (Projektwissen) | Spec | — | ✅ | Hoch | Backend-Grundsatzentscheidung, Supabase bestätigt |
| QS-14 | `00_KREILE_APP_NEUSTART_MASTERPROMPT.md` (Projektwissen) | Spec | — | ✅ | Hoch | UX-Grundprinzipien Wareneingang/Kundenakte |
| QS-15 | `APP_Galvanik_Werkstatt_OS.md` (Projektwissen) | Spec | — | ✅ | Hoch | Vollständiges Kernobjekt-Modell |
| QS-16 | `UEBERGABE_KI_KAMERA_WARENDURCHLAUF.md` (Projektwissen) | Übergabe | — | ✅ | Sehr hoch | KI-Eskalationsarchitektur, Modell-Abstraktion |
| QS-17 | `KUNDENKARTEI_RECHERCHE_KOMPILATION.md` (Projektwissen) | Spec-Kompilation | — | ✅ | Hoch | CustomerOverlay-Akzeptanzkriterien |
| QS-18 | `UEBERGABE_ANALYSE_CHAT.md` (Projektwissen) | Übergabe | — | ✅ | Hoch | Analyseseite-Leitplanken, KPI-Rohdaten-Tabelle |
| QS-19 | `SPEC_LICENSE_FEATURE_TOGGLES_v1.md` Volltext (Projektwissen) | Spec | 2026-05-27 | ✅ | Hoch | s. QS-10, vollständiger gelesen |
| QS-20 | `01_NAVIGATION_STARTSEITE_WERKSTATTFLUSS.md` (Projektwissen, Titel bekannt) | Spec | — | ⚠️ nicht im Volltext gelesen | Mittel | Nur Dateiname bekannt — bei Bedarf in Folge-Chat nachladen |
| QS-21 | `04_WARENWIRTSCHAFT_BADREGELKARTE_VERBRAUCH.md` (Projektwissen, Titel bekannt) | Spec | — | ⚠️ nicht im Volltext gelesen | Mittel | s. QS-20 |
| QS-22 | `06_PERFORMANCE_GAMEDESIGN_ANALYTIK.md` (Projektwissen, Titel bekannt) | Spec | — | ⚠️ nicht im Volltext gelesen | Mittel | s. QS-20 |
| QS-23 | `05_KUNDENKARTEI_AUFTRAG_DETAIL_ZEITSTRAHL.md` (Projektwissen, Titel bekannt) | Spec | — | ⚠️ teilweise über QS-17 abgedeckt | Mittel | s. QS-20 |
| QS-24 | `dsgvo-security-auditor_PATCH.md` (Projektwissen, Titel bekannt) | Patch/Regel | — | ⚠️ nicht im Volltext gelesen | Mittel | Sicherheitsrelevant — vor Phase 1 nachladen empfohlen |
| QS-25 | `02_WARENEINGANG_KAMERA_OCR_AUTONOMIE.md` (Projektwissen, Titel bekannt) | Spec | — | ⚠️ nicht im Volltext gelesen | Hoch | Direkt M-01/M-02/M-03-relevant — vor Bauprompt-Ausgabe ideal nachzuladen |
| QS-26 | `kundenkarte_v1_CI.html` (Projektwissen) | HTML-Mockup | — | ⚠️ nicht geöffnet | Niedrig | Visuelle Referenz, kein Pflichttext |
| QS-27 | `43_UNIVERSELLE_KUNDENKARTE.md` (Projektwissen, Titel bekannt) | Spec | — | ⚠️ via QS-17 zitiert | Hoch | Akzeptanzkriterien bereits in QS-17 übernommen |
| QS-28 | `SPEZIFIKATIONEN/06a_ADDON_KALKULATION_KI_FINANZCONTROLLING.md` (laut QS-06 referenziert) | Spec | — | ❌ nicht zugänglich in diesem Chat | Hoch | **Nicht geprüft** — Existenz nur über QS-06 belegt |
| QS-29 | `ergänzungen/10_ADDON_WARNING_ENGINE.md` (laut QS-06 referenziert) | Spec | — | ❌ nicht zugänglich | Hoch | **Nicht geprüft** |
| QS-30 | `SPEZIFIKATIONEN/44_*UNIVERSAL_INTAKE*.md` (laut QS-06 referenziert) | Spec | — | ❌ nicht zugänglich | Mittel | **Nicht geprüft** |
| QS-31 | `SPEZIFIKATIONEN/WEBSITE_SPEC_v3.1.md` (laut QS-06 referenziert) | Spec | — | ❌ nicht zugänglich | Niedrig (außerhalb Scope) | **Nicht geprüft**, separates Projekt |
| QS-32 | 87 weitere `.md` in SPEZIFIKATIONEN/docs/ergänzungen (laut QS-06) | Mixed | — | ❌ nicht zugänglich | Variabel | **Nicht geprüft** — nur Fundliste aus QS-06 sekundär übernommen |
| QS-33 | Code-Basis selbst (`src/**`, 78 Pages, 18 API-Routes, 3 Schemas) | Code | 2026-06-19 | ⚠️ nur über Audit-Zitate | Sehr hoch | Kein Direktzugriff in diesem Chat — alle Code-Aussagen sind Sekundärzitate aus QS-03/06/07/08/09 |
| QS-34 | Supabase-DB selbst (85 Tabellen) | Live-Daten | 2026-06-19 | ⚠️ nur über Audit-Zitate | Sehr hoch | s. QS-33 |

**Explizit als nicht geprüft markiert:** QS-20 bis QS-32 sowie der direkte Code-/DB-Zugriff (QS-33/34). Alle Aussagen zu Code und DB in diesem Dokumentenset sind sekundäre Zitate aus den vier Auditberichten (QS-03, 06, 07, 08, 09), nicht eigene Direktprüfung dieses Projektmanager-Durchlaufs.

---

## 2. Quellenhierarchie (bei Widerspruch)

1. Ausdrücklich bestätigte aktuelle Entscheidung des Auftraggebers (Siglinder)
2. Aktueller produktiver Daten- und Codezustand (laut QS-03/06/07/08/09 — da kein Live-Zugriff: diese vier Audits gelten als bester verfügbarer Proxy)
3. Aktuelle Spezifikation aus Projektwissen (QS-10–QS-19)
4. Frühere Spezifikation (QS-02)
5. Chatidee / Archäologiefund (QS-06 Abschnitt 3)
6. Abgeleitete Annahme dieses Projektmanagements

Eine aktuelle Implementierung ist kein Beweis fachlicher Richtigkeit — sie ist nur Tatsachenbestand (gilt explizit für die Scan→Auftrag- und OCR-Fake-Success-Pfade).

---

## 3. Konsolidiertes Anforderungsregister

Format: Fund-ID (übernommen aus Archäologie wo möglich, sonst neu vergeben mit Präfix `A-PM-`) · Thema · Quelle(n) · Status · Entscheidung

### 3.1 Kritische Anforderungen (Go-live-blockierend)

| ID | Anforderung | Quelle(n) | Entscheidung |
|---|---|---|---|
| F-001 | Scan→Auftrag muss echten DB-Write auslösen | QS-03 B-02, QS-06 F-001/M-01 | **Scope aufnehmen — Phase 1** |
| F-002 | OCR-URL-Platzhalter durch echte Supabase-Storage-URL ersetzen | QS-03 B-01, QS-06 F-002/M-02 | **Scope aufnehmen — Phase 1** |
| F-003 | Auth-Fehler müssen sichtbares UI-Feedback erzeugen (kein stilles `[]`) | QS-03 B-03, QS-06 F-003/M-04, QS-07 P0, QS-08 VS-01 | **Scope aufnehmen — Phase 1** |
| F-004 | `tenant_id`-Filter in `customers.actions.ts` ergänzen | QS-03 B-04, QS-06 F-004/M-05 | **Scope aufnehmen — Phase 1** |
| F-006 | RLS auf priorisierte Tabellen aktivieren (events, communications, konto, ausgangsrechnung_position, arbeitszeit_buchung) | QS-03 B-06, QS-06 F-006/S1-07 | **Scope aufnehmen — Phase 1, Rest Phase 2** |
| F-009/10/11 | Fake-Fallback-Werte und tote Mock-Seiten entfernen (`\|\| 84`, `\|\| 3`, Demo-Notizen, ordersRepository) | QS-03 B-09, QS-06 F-009/F-010/F-011/W-06, QS-07 P0, QS-08 VS-02 | **Scope aufnehmen — Phase 1** |

### 3.2 Hohe Priorität (vor Livebetrieb)

| ID | Anforderung | Quelle(n) | Entscheidung |
|---|---|---|---|
| F-005/30 | Mollie-Zahlungspfad: Env-Var korrigieren, Edge Function deployen — **nur falls Mollie-Vertrag bestätigt (E-04)** | QS-06 F-005/F-030/S3-02 | **Scope später — bedingt durch Entscheidung E-04** |
| F-017 | RESEND_API_KEY beschaffen, Delivery-Mail-Trigger verdrahten | QS-06 F-017/S1-08 | **Scope aufnehmen — Phase 2** |
| F-018 | Kalkulations-/Pricing-Assistent (Gemini-gestützt) | QS-06 F-018/S3-01, QS-08 (Inhaber-Aufgabe „Preis nennen") | **Scope aufnehmen — Phase 4 (höchste wirtschaftliche Priorität nach Stabilisierung)** |
| A-01 | Zwei parallele Auth-Systeme konsolidieren | QS-09 A-01 | **Scope aufnehmen — Phase 1/7, kanonischer Provider: Custom HMAC für PIN-Login** |
| A-02 | Mandant aus Session lesen statt hartkodiert | QS-09 A-02 | **Scope aufnehmen — Phase 7 (Vorbereitung), Hardcode bleibt für Single-Tenant-Betrieb bis dahin tolerabel** |
| A-03 | Zwei Token-Systeme konsolidieren auf `ci-tokens.css` | QS-09 A-03, QS-07 Sprint 2 D | **Scope aufnehmen — Phase 1/Sprint** |
| A-05 | Feature-Flags verdrahten (`useFeatureFlag()`) | QS-09 A-05, QS-06 F-008/S2-04 | **Scope aufnehmen — Phase 2** |

### 3.3 UX-/Nutzungsanforderungen

| ID | Anforderung | Quelle(n) | Entscheidung |
|---|---|---|---|
| VS-01–VS-04 | Session-Hinweis, Fake-Fallback weg, Tages-Fokus-Block, Plain-Language-Cockpit-Labels | QS-08 | **Scope aufnehmen — Phase 1/3** |
| VS-05 | Auto-Draft bei unterbrochener Auftragserfassung | QS-08 | **Scope aufnehmen — Phase 3** |
| VS-06 | „Fertig zur Abholung"-Block auf Startseite | QS-08, QS-07 Pfad C | **Scope aufnehmen — Phase 3** |
| VS-07 | Vorwoche-Vergleich im Cockpit-Header | QS-08 | **Scope aufnehmen — Phase 5** |
| VS-08 | 1-Klick-Statuswechsel aus Auftragsübersicht | QS-08 | **Scope aufnehmen — Phase 3** |
| VS-09 | Kalender auf echte Telefonnotiz-Rückrufe koppeln | QS-08 | **Scope aufnehmen — Phase 3/4** |
| VS-10 | Global Search auf Auftragsbeschreibung/Fahrzeug erweitern | QS-08 | **Scope aufnehmen — Phase 2** |
| C (Sprint1) | Navigation Tablet-Touch-Fix (RightNav) | QS-07 P1, QS-09 (Tablet ist primäres Zielgerät) | **Scope aufnehmen — Phase 1** |
| H/I (Sprint3) | TopWorkflowBar alle 5 Stationen, GlobalSearch Touch-Trigger | QS-07 | **Scope aufnehmen — Phase 1/3** |

### 3.4 Architektur-/Plattformanforderungen

| ID | Anforderung | Quelle(n) | Entscheidung |
|---|---|---|---|
| A-04 | Branchenlogik (VALID_SLUGS) aus Navigationskern in Konfiguration auslagern | QS-09 | **Scope später — Phase 7, nicht vor Kern-Stabilisierung** |
| A-06 | KI-Zugriffsmuster auf `geminiClient.ts` konsolidieren | QS-09 | **Scope aufnehmen — Phase 2 (klein, lohnt sich früh)** |
| A-07 | KPI-Logik aus React-Komponenten in SQL-Views verlagern | QS-09, QS-18 (Analyse-Leitplanken: KPIs ausschließlich SQL-Views) | **Scope aufnehmen — Phase 2, bereits Projektprinzip** |
| A-08 | Modul-Manifest-System | QS-09 | **Scope später — Phase 7** |
| A-09 | API-Versionierung `/api/v1/` | QS-09 | **Scope später — Phase 7, nicht blockierend** |
| A-10 | EdgeFunctionAdapter mit Retry/Health-Check | QS-09 | **Scope später — Phase 4 (an Mollie/Zahlungen gekoppelt)** |
| A-11 | Observability (Sentry, strukturiertes Logging) | QS-09 | **Scope aufnehmen — Phase 1 (Sentry-Einbindung ist <1h, hoher Hebel)** |
| A-13 | Testsuite (Auth-Chain, Tenant-Filter, kritische Actions) | QS-09 | **Scope aufnehmen — Phase 1/2 minimal, Ausbau Phase 7** |
| A-14 | DB-Schema-Modulgrenzen (SQL-Views als Außengrenze) | QS-09 | **Scope später — Phase 7** |

### 3.5 KI-/Automatisierungsanforderungen

| ID | Anforderung | Quelle(n) | Entscheidung |
|---|---|---|---|
| F-007 | Warning Engine Live-Rules implementieren | QS-06 F-007/S2-03, QS-09 | **Scope aufnehmen — Phase 6** |
| KI-Eskalation | Mehrstufige KI-Eskalation (Regel → Haiku → Opus, Modell-Abstraktion mit Fable-5-Slot) | QS-16 | **Scope aufnehmen — Phase 6, Architekturprinzip ab Phase 2 vorbereiten** |
| Automatisierungstabelle | 10 Automatisierungs-Funktionen mit Freigabestufen 1–5 | QS-09 Abschnitt 5, QS-08 Abschnitt 5 | **Siehe Dok. 06 — gestuft nach Freigabestufe** |

### 3.6 Dubletten und Widersprüche (zu entscheiden)

| ID | Konflikt | Quellen | Auflösung |
|---|---|---|---|
| W-01 | Zwei Token-Systeme | QS-09, QS-07 | `ci-tokens.css` ist Quelle der Wahrheit — entschieden |
| W-02/D-02/D-03 | Zwei KVP-Seiten (`/kvp` Demo vs. `/betrieb-kvp` echt) | QS-06 | `/betrieb-kvp` ist canonical, `/kvp` redirected oder migriert — entschieden, siehe Dok. 11 E-05 |
| W-04 | `galvanik`-Slug in Doku vs. VALID_SLUGS ohne `galvanik` | QS-03 B-08, QS-06 W-04 | VALID_SLUGS ist Wahrheit (`beschichtung`); alle Dokumente korrigieren |
| W-05 | `SUPABASE_URL` vs. `NEXT_PUBLIC_SUPABASE_URL` in Mollie-Route | QS-06 W-05 | Server-seitige Var separat setzen — Teil von F-005 |
| D-01 | Doppeltes BarChart3-Icon (Cockpit/Analyse) | QS-06, QS-07 | Eindeutige Icons — Sprint 2 |

---

## 4. Status je Anforderung (Sammelindex)

Vollständiger Status mit Phasenzuordnung: siehe Dok. 07 (Master-Umsetzungsplan), Abschnitt Arbeitspakete. Dieses Register liefert die Quellenbasis; Dok. 07 liefert die Ausführungsreihenfolge.

---

## 5. Empfehlung zur Lückenschließung

Vor Beginn der Bauprompts für Phase 4 (Kalkulation) und Phase 1 (Wareneingang/OCR) sollten folgende noch nicht im Volltext geprüfte Dateien aus dem Projektwissen gezielt nachgeladen werden, da sie nach Titel direkt einschlägig sind:

- `02_WARENEINGANG_KAMERA_OCR_AUTONOMIE.md` (QS-25) — vor Bauprompt 08-P1-02/03
- `04_WARENWIRTSCHAFT_BADREGELKARTE_VERBRAUCH.md` (QS-21) — vor Phase 3 Bäder/Lager
- `dsgvo-security-auditor_PATCH.md` (QS-24) — vor RLS-Arbeitspaket Phase 1
- `01_NAVIGATION_STARTSEITE_WERKSTATTFLUSS.md` (QS-20) — vor Sprint-1-UX-Arbeitspaket

Diese Lücke wird in Dok. 02 als offener Punkt geführt und blockiert den aktuellen Plan nicht, da die vier Audits (QS-03/06/07/08/09) bereits ausreichend Tatsachenbasis für Phase 0–1 liefern.

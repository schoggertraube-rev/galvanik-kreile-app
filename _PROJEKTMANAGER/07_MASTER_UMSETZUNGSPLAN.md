# 07 — MASTER-UMSETZUNGSPLAN
## Kreile WerkstattCockpit

---

## 1. Statusdefinitionen (verbindlich für jedes Arbeitspaket)

```
NOT_STARTED · BLOCKED · IN_PROGRESS · BUILT_UNVERIFIED · VERIFIED · LIVE · LIVE_BROKEN · DEFERRED · REJECTED
```

`LIVE` ist nur zulässig, wenn DB, Server, UI, Persistenz, Reload, Rollen und Produktion nachgewiesen wurden. Aktueller Stand vieler Pakete laut Audit: `LIVE_BROKEN` (Scan, OCR) oder `BUILT_UNVERIFIED` (Warning Engine, Feature-Flags).

---

## 2. Phasenmodell — Übersicht

| Phase | Ziel | Voraussetzung |
|---|---|---|
| 0 | Sicherung und Wahrheit | — |
| 1 | Kritische Stabilisierung | Phase 0 |
| 2 | Kernvernetzung | Phase 1 |
| 3 | Operative Bedienung | Phase 2 |
| 4 | Wirtschaftliche Vernetzung | Phase 2 (Datenverträge stabil) |
| 5 | Analyse und Unternehmensführung | Phase 2/3 |
| 6 | Kontrollierte Automatisierung | Phase 5 |
| 7 | Plattformisierung | Phase 1–6 abgeschlossen |
| 8 | Go-live und Übergabe | Phase 1–5 mindestens |
| 9 | Kontinuierliche Weiterentwicklung | Phase 8 |

---

## 3. Abhängigkeitsgraph (Kern)

```
customers (tenant-fix)
  └─ orders (auth-feedback)
      └─ items / status_events
          ├─ operational_views (Phase 2)
          ├─ customer_status (Phase 2)
          ├─ performance_views (Phase 5)
          └─ automation_rules (Phase 6)

scan-to-order (M-01) ──┐
ocr-url-fix (M-02) ────┼─→ GeminiProvider aktiv (M-03) → Buchhaltung OCR (Phase 1)
auth-feedback (M-04) ──┤
tenant-filter (M-05) ──┘──→ Erster echter Nutzertest (Ende Phase 1)

RLS (S1-07) ──────────────────────────────→ Datenschutz-Freigabe (Ende Phase 1)
Token-Konsolidierung (S2-01) ─────────────→ OrderWideCard-Migration (S2-02)
Feature-Flags verdrahtet (S2-04) ─────────→ Lizenzsystem nutzbar (Phase 2 Ende)
Kalkulationsmodul (S3-01) ─────────────────→ Angebotsworkflow (S3-03) — Phase 4
Warning Engine Rules (S2-03) ─────────────→ Automatisierungsschicht (Phase 6)
[Phase 1–6 abgeschlossen] ─────────────────→ Plattformisierung (Phase 7)
[Phase 1–5 abgeschlossen] ─────────────────→ Go-live (Phase 8)
```

Keine Phase beginnt, wenn ihre Voraussetzungen nicht nachgewiesen sind (Statusnachweis, nicht Schätzung).

---

## 4. Priorisierungsgewichte (zur Reihenfolge innerhalb einer Phase, ersetzt keine Abhängigkeitsprüfung)

| Kriterium | Gewicht |
|---|---:|
| Go-live-Relevanz | 20 |
| Kundennutzen | 15 |
| Datenintegrität | 15 |
| operative Wirkung | 10 |
| Performance | 10 |
| Sicherheitsrisiko | 10 |
| wirtschaftliche Wirkung | 8 |
| UX | 5 |
| Wartbarkeit | 4 |
| Wiederverwendbarkeit | 3 |

---

## 5. PHASE 0 — Sicherung und Wahrheit

**Ziel:** Git-Status klären, uncommittete Arbeit trennen, Projektpfad bestätigen, Secrets prüfen, DB-Stand verifizieren, Sicherheits-Snapshot erstellen.

| AP-ID | Arbeitspaket | Status | Nachweis |
|---|---|---|---|
| P0-01 | `git status --short` + Branch prüfen | NOT_STARTED | Konsolenausgabe |
| P0-02 | `.env.local` gegen benötigte Variablen prüfen (`GEMINI_API_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `APP_SESSION_SECRET`, fehlend: server-seitiges `SUPABASE_URL`, `RESEND_API_KEY`) | NOT_STARTED | Vergleichsliste |
| P0-03 | DB-Passwort-Rotation vorbereiten (laut Projektgedächtnis in Shell-History sichtbar) | NOT_STARTED | Neues Passwort gesetzt, alte Sessions invalidiert |
| P0-04 | Supabase-Stand verifizieren: Migrationen wirklich remote ausgeführt, nicht nur lokal vorhanden | NOT_STARTED | `npx supabase db push` Diff = leer |
| P0-05 | Snapshot/Commit-Punkt vor Phase-1-Eingriffen | NOT_STARTED | Git-Tag |

Ohne Phase 0 keine Änderung. Diese fünf Punkte werden im ersten Bauprompt (Dok. 08) als Vorbedingung geprüft.

---

## 6. PHASE 1 — Kritische Stabilisierung

**Ziel:** Auth, Session, RLS, Tenant-Trennung, kaputte Kernpfade, Mockreste im Produktionspfad, Tablet-Navigation.

| AP-ID | Arbeitspaket | Quelle | Aufwand | Status |
|---|---|---|---|---|
| P1-01 | OCR-URL-Platzhalter ersetzen (`${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/belege/${storagePath}`) | F-002/M-02 | 1h | NOT_STARTED |
| P1-02 | GeminiProvider als primären OCR-Provider aktivieren (Klippa-Entscheidung E-01: vorerst nicht) | F-002/M-03 | 3–5h | NOT_STARTED |
| P1-03 | Scan→Auftrag: `handleConfirm()` → `createOrderFromScan()` Server Action | F-001/M-01 | 2–4h | NOT_STARTED |
| P1-04 | Auth-Feedback: bei `!auth.ok` Redirect `/start?reason=session_expired` oder `SessionWarningBanner` | F-003/M-04 | 2–4h | NOT_STARTED |
| P1-05 | `tenant_id`-Filter in `customers.actions.ts` ergänzen | F-004/M-05 | 0,5h | NOT_STARTED |
| P1-06 | Fake-Fallback-Werte aus `app/page.tsx` entfernen (`\|\| 84`, `\|\| 3`, Demo-Notizen) | F-011/VS-02 | 1h | NOT_STARTED |
| P1-07 | Global Search: Tenant-Filter verifizieren/ergänzen | F-007(Archäologie)/M-07 | 1h | NOT_STARTED |
| P1-08 | RLS auf priorisierte Tabellen aktivieren: `events`, `communications`, `ausgangsrechnung_position`, `arbeitszeit_buchung`, `konto` | F-006/S1-07 | 4–8h | NOT_STARTED |
| P1-09 | Navigation Tablet-Fix: Touch-Toggle statt reinem Hover in `RightNav.tsx` | UX P1/Sprint1-C | 2–3h | NOT_STARTED |
| P1-10 | TopWorkflowBar: alle 5 Stationen einbauen | F-012/S1-02 | 1h | NOT_STARTED |
| P1-11 | Slug-Bereinigung: „galvanik" aus Doku entfernen, VALID_SLUGS als Wahrheit dokumentieren | B-08/W-04 | 0,5h | NOT_STARTED |
| P1-12 | Sentry-Einbindung (Frontend + Server) | A-11 | <1h | NOT_STARTED |
| P1-13 | Server-seitige `SUPABASE_URL` ergänzen (getrennt von `NEXT_PUBLIC_SUPABASE_URL`) | F-005/S1-06/W-05 | 0,5h | NOT_STARTED |

**Akzeptanzkriterium Phase 1 (Gesamt):** Erster echter Nutzertest möglich — Inhaber kann sich einloggen, sieht echte Aufträge/Kunden, Scan erstellt tatsächlich einen Auftrag, OCR liefert reale (oder zumindest ehrlich fehlschlagende) Ergebnisse, Tablet-Navigation funktioniert.

**Geschätzter Gesamtaufwand Phase 1:** ~20–28h (deckt sich mit Archäologie-Schätzung von ~20h Kernarbeit plus UX-Sofortmaßnahmen).

---

## 7. PHASE 2 — Kernvernetzung

**Ziel:** Kunden, Aufträge, Teile, Stationen, StatusEvents, Suche, Dokumente, Kommunikation, Standort, Folgeaktionen vollständig end-to-end nachgewiesen.

| AP-ID | Arbeitspaket | Quelle | Status |
|---|---|---|---|
| P2-01 | Tote Seiten auf `getOrdersDb()` migrieren (`/status`, `/today`, `/archive`, `/print-queue`) | S1-01 | NOT_STARTED |
| P2-02 | `/kvp` konsolidieren auf `/betrieb-kvp` (Entscheidung E-05) | S1-05/W-02 | NOT_STARTED |
| P2-03 | Token-System konsolidieren: `ci-tokens.css` als einzige Quelle, `tokens.css` deprecaten | A-03/S2-01 | NOT_STARTED |
| P2-04 | OrderWideCard: hartkodierte Hex-Werte → Token-Variablen, Font → Fraunces | F-016/S2-02 | NOT_STARTED |
| P2-05 | Doppel-Icon-Fix (Cockpit/Analyse) | D-01/S1-04 | NOT_STARTED |
| P2-06 | Feature-Flags verdrahten: `useFeatureFlag()` in Premium-Bereichen | A-05/S2-04 | NOT_STARTED |
| P2-07 | KI-Zugriffsmuster konsolidieren auf `geminiClient.ts` | A-06 | NOT_STARTED |
| P2-08 | KPI-Logik aus Komponenten (`AgingKachel.tsx`, `OrderWideCard.tsx`) in SQL-Views verlagern | A-07 | NOT_STARTED |
| P2-09 | Global Search erweitern: Auftragsbeschreibung, Fahrzeugfeld | VS-10 | NOT_STARTED |
| P2-10 | RESEND_API_KEY beschaffen, Delivery-Mail-Trigger verdrahten | F-017/S1-08 | NOT_STARTED |
| P2-11 | Minimale Testsuite: Auth-Chain, Tenant-Filter, kritische Server Actions | A-13 | NOT_STARTED |

**Akzeptanzkriterium Phase 2:** Keine Mockreste mehr in Navigationspfaden, einheitliches Design-System, Feature-Flags aktiv nutzbar, Suchqualität erhöht.

---

## 8. PHASE 3 — Operative Bedienung

**Ziel:** Wareneingang, Werkstattfluss, Galvanik, Qualität, Versand, Kundenrückfragen, Teileauffindbarkeit, unterbrechbare Workflows, Tablet/Mobile.

| AP-ID | Arbeitspaket | Quelle | Status |
|---|---|---|---|
| P3-01 | Tages-Fokus-Block auf Startseite (VS-03) | VS-03 | NOT_STARTED |
| P3-02 | Auto-Draft bei unterbrochener Auftragserfassung (sessionStorage) | VS-05 | NOT_STARTED |
| P3-03 | „Fertig zur Abholung"-Block mit Anruf-Button | VS-06 | NOT_STARTED |
| P3-04 | 1-Klick-Statuswechsel aus Auftragsübersicht | VS-08 | NOT_STARTED |
| P3-05 | Kalender auf echte Telefonnotiz-Rückrufe koppeln | VS-09 | NOT_STARTED |
| P3-06 | GlobalSearch Touch-Trigger im Header (Such-Icon-Button) | UX Sprint3-I | NOT_STARTED |
| P3-07 | Stationsseiten: Klartext-Labels statt technischer Strings | UX Sprint2-F | NOT_STARTED |
| P3-08 | Offline/Sync-Ausbau für Werkstattfluss bei WLAN-Lücken | Plattform A-Offline | NOT_STARTED |
| P3-09 | Entscheidung E-02 umsetzen: `/kontrolle` aus Primärnavigation oder Schema-Erweiterung | E-02 | BLOCKED — wartet auf Entscheidung Inhaber |

---

## 9. PHASE 4 — Wirtschaftliche Vernetzung

**Ziel:** Angebote, Rechnungen, Zahlungen, offene Posten, Buchhaltung, Kosten, Nachkalkulation, Marge, Liquidität. Start erst, wenn zugrundeliegende Datenverträge (Phase 1–2) stabil sind.

| AP-ID | Arbeitspaket | Quelle | Status |
|---|---|---|---|
| P4-01 | Kalkulations-MVP: Bauteilparameter → Kostenschätzung (Gemini-gestützt) | F-018/S3-01 | NOT_STARTED — höchste wirtschaftliche Priorität nach Stabilisierung |
| P4-02 | Angebotsworkflow: Kalkulation → Angebot → Auftrag | S3-03 | NOT_STARTED |
| P4-03 | Mollie-Zahlungspfad reparieren (Env-Var, Edge Function) — **bedingt durch Entscheidung E-04** | F-005/F-030/S3-02 | BLOCKED — wartet auf Vertragsbestätigung |
| P4-04 | EdgeFunctionAdapter mit Retry/Health-Check für alle 5 Edge Functions | A-10 | NOT_STARTED |
| P4-05 | DATEV/Lexware-Export (Windows-1252-Encoding) | Stack-Standards (Memory) | DEFERRED — nach Buchhaltungsmodul-Stabilität |

---

## 10. PHASE 5 — Analyse und Unternehmensführung

**Ziel:** Werkstatt-Puls, Engpässe, Termintreue, Durchlaufzeit, Qualität, wirtschaftliche Kennzahlen, Chef-Dashboard, Maßnahmen, Wirksamkeitsmessung.

| AP-ID | Arbeitspaket | Quelle | Status |
|---|---|---|---|
| P5-01 | Cockpit Plain-Language-Labels (Forecast→„Erwarteter Umsatz" usw.) | VS-04 | NOT_STARTED |
| P5-02 | Vorwoche-Vergleich im Cockpit-Header | VS-07 | NOT_STARTED |
| P5-03 | PlaceholderKachel ausblenden bis gebaut | VS-04 | NOT_STARTED |
| P5-04 | ForecastKachel↔`forecast_version`-Tabelle verbinden | F-029/S2-05 | NOT_STARTED |
| P5-05 | Restliche Analyseseite-Kacheln fertigstellen (Qualität & Risiko, Bäder & Material, Kunden & Markt, KI-Strip) — laut Projektgedächtnis bereits in Arbeit | laufendes Arbeitspaket | IN_PROGRESS |
| P5-06 | `kpi_snapshots`-Tabelle für Wochen-/Monats-Snapshots (Vorjahresvergleich-Grundlage) | QS-18 | NOT_STARTED |

---

## 11. PHASE 6 — Kontrollierte Automatisierung

**Ziel:** Warnungen, Empfehlungen, vorbereitete Aktionen, Wiedervorlagen, automatische Kommunikation, Eskalationen, kontrollierte autonome Aktionen — gemäß Stufenmodell (Dok. 06).

| AP-ID | Arbeitspaket | Quelle | Status |
|---|---|---|---|
| P6-01 | Warning Engine: 3–5 Kernregeln implementieren (liegengebliebener Auftrag, Engpass, überfällige Rechnung) | F-007/S2-03 | NOT_STARTED |
| P6-02 | KI-Eskalationsarchitektur produktiv schalten (Regel→Haiku→Opus, Confidence-Schwellen) | QS-16 | NOT_STARTED |
| P6-03 | Mahnungs-Vorbereitung mit Freigabe (Stufe 3) | Dok. 06 Abschnitt 3 | NOT_STARTED |
| P6-04 | Abholbenachrichtigung (Stufe 4, Opt-in) | Dok. 06 Abschnitt 3 | NOT_STARTED |
| P6-05 | KI-Wochenbericht (Stufe 1, montags) | Dok. 06 Abschnitt 3 | NOT_STARTED |

---

## 12. PHASE 7 — Plattformisierung

**Ziel:** Modulverträge, Konfiguration, Branchenentkopplung, wiederverwendbare Komponenten, Modulregistrierung, Lizenzierung, externer Wartungsstandard. Beginnt erst nach Abschluss Phase 1–6.

| AP-ID | Arbeitspaket | Quelle | Status |
|---|---|---|---|
| P7-01 | Auth-System konsolidieren (ein kanonischer Provider) | A-01 | NOT_STARTED |
| P7-02 | `tenant_id` ausschließlich aus Session, kein Hardcode mehr | A-02 | NOT_STARTED |
| P7-03 | Branchenlogik (VALID_SLUGS, Stationsnamen) in Konfiguration auslagern | A-04 | NOT_STARTED |
| P7-04 | Modul-Manifest-System (`module.manifest.ts`) für die 3 größten Module | A-08 | NOT_STARTED |
| P7-05 | API-Versionierung `/api/v1/` | A-09 | NOT_STARTED |
| P7-06 | Architekturhandbuch (ARCHITECTURE.md, MODULE_GUIDE.md, RUNBOOK.md) | A-12 | NOT_STARTED |
| P7-07 | Zweiter Mandant als Pilottest | Plattform Phase 3 | NOT_STARTED |
| P7-08 | Datenexport-Format für DSGVO Art. 15/20 | QS-09 Punkt 3 | NOT_STARTED |
| P7-09 | Audit-Log für Datenmutationen (nicht nur operative Events) | QS-09 Punkt 4 | NOT_STARTED |

---

## 13. PHASE 8 — Go-live und Übergabe

Siehe Dok. 09 (Test-, Abnahme- und Go-live-Plan) für vollständige Checkliste.

| AP-ID | Arbeitspaket | Status |
|---|---|---|
| P8-01 | Vollständige Abnahme gegen Dok. 09 | NOT_STARTED |
| P8-02 | Account-/E-Mail-Handover an Kunde | NOT_STARTED |
| P8-03 | Schulung Inhaber + Nachfolger | NOT_STARTED |
| P8-04 | Hypercare-Zeitraum definieren | NOT_STARTED |

---

## 14. PHASE 9 — Kontinuierliche Weiterentwicklung

Produkttelemetrie, Kundenfeedback, Modulroadmap, Self-Improvement-Vorschläge, neue Branchenpakete, Monetarisierung, Lebenszykluspflege. Kein Go-live-Blocker, läuft nach Phase 8 dauerhaft weiter.

---

## 15. Konfliktlösungstabelle (verbindlich bei Widerspruch)

| Konflikt | Entscheidung |
|---|---|
| Design gegen Performance | Performance gewinnt |
| Innovation gegen Go-live | Go-live gewinnt |
| Wiederverwendbarkeit gegen akuten Kundennutzen | schlanke generische Lösung mit konkretem Kundennutzen |
| neue Funktion gegen Datenintegrität | Datenintegrität gewinnt |
| Automatisierung gegen Kontrolle | kontrollierte Freigabestufe gewinnt |
| Plattformumbau gegen stabile Live-Funktion | bestehende Funktion schützen, schrittweise migrieren |
| Fachwunsch gegen Sicherheit | Sicherheit gewinnt |
| Geschwindigkeit gegen Wartbarkeit | kleinste tragfähige, sauber wartbare Lösung |
| mehrere Wahrheiten | eine kanonische Wahrheit festlegen (siehe Dok. 01 Abschnitt 3.6) |
| alte gegen neue Anforderung | spätere bestätigte Entscheidung gewinnt, Konflikt dokumentieren (Dok. 11) |

---

*Dieser Plan ist die Ausführungsgrundlage für Dok. 08 (Bauprompts). Jeder Bauprompt referenziert exakt ein AP-ID aus diesem Dokument.*

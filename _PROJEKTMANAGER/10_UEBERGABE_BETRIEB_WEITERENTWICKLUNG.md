# 10 — ÜBERGABE, BETRIEB UND WEITERENTWICKLUNG
## Kreile WerkstattCockpit

---

## 1. Zugänge (vor Go-live zu übergeben)

| Zugang | Verantwortlich | Status |
|---|---|---|
| Supabase-Projekt-Owner | An Kunde übergeben oder Siglinder behält Verwaltung mit Wartungsvertrag | Zu klären (siehe Dok. 11 offene Punkte) |
| GitHub-Repository (`schoggertraube-rev/galvanik-kreile-app`) | Siglinder behält Commit-Hoheit (Projektprinzip) | Festgelegt |
| Vercel-Hosting | Wie Supabase | Zu klären |
| E-Mail-Account (Resend) | Kunde oder Siglinder verwaltet | Zu klären |
| Domain | Falls separates Website-Projekt: eigene Zugänge | Außerhalb Scope |

**Bekannter offener Punkt aus Projektgedächtnis:** „Account-/E-Mail-Handover an Kunde vor Go-live" — explizit in Phase 8 (Dok. 07) verankert.

---

## 2. Verantwortlichkeiten im Betrieb

| Aufgabe | Verantwortlich |
|---|---|
| Code-Wartung, Bugfixes | Siglinder (Requirements Architect + Umsetzung über Antigravity) |
| Tägliche Nutzung, Dateneingabe | Franz Kreile, Sohn, Mitarbeiter |
| Migrations-Ausführung | Siglinder, manuell am Tagesende (Projektprinzip) |
| Secrets-Rotation | Siglinder |
| Modulpflege bei künftiger Plattformisierung | Siglinder, perspektivisch mit Modul-Owner-Modell (Phase 7) |

---

## 3. Dokumentation (Pflichtartefakte, aus Plattformarchitektur-Audit A-12 übernommen)

| Dokument | Zweck | Status | Phase |
|---|---|---|---|
| `ARCHITECTURE.md` | Architekturhandbuch für externe Entwickler | Fehlt | Phase 7 |
| `MODULE_GUIDE.md` | Modulgrenzen, Verträge | Fehlt | Phase 7 |
| `RUNBOOK.md` | Betriebsanleitung bei Störungen | Fehlt | Phase 7/8 |
| Dieses 12-Dokumente-Set (00–11) | Projektleitfaden, lebendes Dokument | Vorhanden, wird laufend aktualisiert | laufend |

---

## 4. Monitoring

- Sentry-Einbindung (Frontend + Server) ist Teil von Phase 1 (Bauprompt-Vorbereitung, AP P1-12) — bisher kein strukturiertes Error-Monitoring vorhanden, nur `console.error()`.
- Supabase-eingebautes Monitoring für DB-Queries nutzen.
- Statusseite/Wartungsmodus-Konzept fehlt (QS-09 Punkt 6) — für Single-Tenant-Betrieb mit geringer Nutzerzahl aktuell kein Go-live-Blocker, aber für Phase 8 vorzusehen.

---

## 5. Updates und Wartung

- Dependency-Check: kein Dependabot aktiv (QS-09 A-13-Umfeld) — Empfehlung: monatlicher manueller `npm audit`, automatisierte Lösung erst bei Plattformisierung (Phase 7).
- Migrationen: Protokollierung mit Grund und Rollback fehlt strukturiert — ab Phase 1 für jede neue Migration nachzuholen.

---

## 6. Support

Kein definierter Supportweg für den Kunden (Telefon, E-Mail, Reaktionszeit) — vor Go-live (Phase 8) festzulegen, auch wenn informell (Siglinder ist direkter Ansprechpartner).

---

## 7. Externe Entwickler / Wissensmonopol

Aktuell kein `CODEOWNERS`, kein Modul-Owner-Dokument (QS-09). Für die aktuelle Projektgröße (Solo-Entwickler-Modell) ist das kein akuter Blocker, wird aber relevant, sobald das Projekt als Kern-Template für weitere Kundenprojekte (Evas Lerninsel) dient — dann ist Dokumentation Voraussetzung für saubere Wiederverwendung, nicht nur „nice to have".

---

## 8. Lizenzierung im Betrieb

Gemäß `SPEC_LICENSE_FEATURE_TOGGLES_v1.md` (QS-10): Anbieter-Admin-Konsole unter `/admin/workshops`, Pläne werden ausschließlich vom Anbieter (Siglinder) geschaltet, kein Self-Service in V1. Kunde sieht im Footer/Settings nur den aktiven Plan (nur Inhaber-Rolle sichtbar, Mitarbeiter nie).

---

## 9. Roadmap (Geschäftsmodell-Bezug)

Aus Plattformarchitektur-Audit (QS-09 Abschnitt 7) übernommen als Orientierung, nicht als verbindliche Preisliste — Pricing-Konkretisierung ist laut Lizenz-Spec ausdrücklich ein späterer Schritt:

| Paket | Inhalt | Voraussetzung |
|---|---|---|
| Basis | Kern + Warendurchlauf | Phase 1–2 abgeschlossen |
| Operations | + Kommunikation, Kalender, KVP | Phase 3 |
| Finance | + Buchhaltung, Belege, DATEV | Phase 4 |
| AI-Paket | + Kalkulation, KI-Zusammenfassung | Phase 4/6 |
| Automation | + Warning Engine, Mahnwesen | Phase 6 |
| Managed Service | Monitoring, SLA, Backup-Garantie | Phase 8 |

---

## 10. Technische Lebensdauer

Next.js, Drizzle, Supabase sind aktuelle, gut gewartete Technologien (Stand Juni 2026). Kein akutes Ablösungsrisiko. Wichtiger als Technologiewahl ist laut Plattformarchitektur-Schlusswort die strukturelle Frage: Wird das Projekt als Plattform oder als Einzelanwendung weitergedacht? Diese Entscheidung prägt jede künftige Erweiterung — siehe Dok. 03.

---

## 11. Self-Improvement-Governance

Phase 9 (kontinuierliche Weiterentwicklung) sieht eine „Self-Improvement Engine" vor (Plattform erkennt eigene Nutzungslücken und schlägt Erweiterungen vor, Freigabestufe 2 — Empfehlung, nicht Autopilot). Dies ist explizit eine Phase-9/langfristige Idee, kein Bestandteil des aktuellen Go-live-Pfads.

---

*Übergabe ist erst abgeschlossen, wenn die Checkliste in Dok. 09 Abschnitt 8 vollständig erfüllt ist.*

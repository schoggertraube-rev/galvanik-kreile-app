# 11 — ENTSCHEIDUNGS- UND ÄNDERUNGSPROTOKOLL
## Kreile WerkstattCockpit

---

## 1. Zweck

Jede projektrelevante Entscheidung wird hier mit ID, Datum, Quelle, Problem, Optionen, Entscheidung, Begründung, betroffenen Verträgen und Konsequenzen festgehalten. Dieses Dokument wird laufend ergänzt, niemals rückwirkend überschrieben — Korrekturen erhalten neue Einträge mit Verweis auf die ursprüngliche Entscheidung.

---

## 2. Bereits getroffene Entscheidungen (aus Quellenlage übernommen)

### ENT-001 — Klippa vs. Gemini als OCR-Provider für MVP
- **Datum:** 2026-06-19 (übernommen aus Archäologie E-01)
- **Quelle:** QS-06
- **Problem:** Klippa ist Spezial-OCR für Belege, aber `KLIPPA_API_KEY` fehlt und verursacht laufende Kosten. Gemini-Key ist bereits vorhanden.
- **Optionen:** (a) Klippa beschaffen, (b) Gemini als MVP-OCR nutzen, später evaluieren
- **Entscheidung:** Gemini als primärer OCR-Provider für MVP (Option b)
- **Begründung:** Kein zusätzlicher Beschaffungsaufwand, kein Blocker für Phase 1, Qualität ausreichend für strukturierte Belegerkennung mit striktem JSON-Schema
- **Betroffene Verträge:** Bauprompt 02 (Dok. 08)
- **Konsequenz:** Klippa-Integration bleibt als spätere Option dokumentiert (Dok. 02), kein Code-Aufwand aktuell

### ENT-002 — `/kontrolle`-Seite: Scope oder Entfernung
- **Datum:** offen
- **Quelle:** QS-06 E-02
- **Problem:** QS-Daten (Ausschussquoten, Prüfprotokolle) sind nicht im DB-Schema vorhanden, Seite zeigt aktuell Mock-Daten
- **Optionen:** (a) Schema erweitern und Seite bauen, (b) aus Primärnavigation entfernen, später als eigenes Modul
- **Empfehlung dieses Projektmanagements:** Option b — aus Primärnavigation entfernen bis Schema-Erweiterung ansteht
- **Entscheider:** Franz Kreile (Inhaber) — **AUSSTEHEND, blockiert AP P3-09**
- **Konsequenz bei Nichtentscheidung:** P3-09 bleibt `BLOCKED`, Seite bleibt vorerst sichtbar mit Mock-Daten — das ist ein Live-Data-Policy-Verstoß und sollte vor Phase 3 final entschieden werden

### ENT-003 — Marketing Studio: integriert oder eigenes Tool
- **Datum:** offen
- **Quelle:** QS-06 E-03
- **Problem:** 8 Tabellen Teil des App-Schemas, 0 Einträge, kein UI. Echter Marketingbedarf für B2B-Galvanik unklar.
- **Empfehlung dieses Projektmanagements:** Marketing-Tabellen einfrieren, keine neue UI-Entwicklung bis Bedarf bestätigt
- **Entscheider:** Siglinder/Inhaber — **AUSSTEHEND**
- **Konsequenz:** Modul bleibt `DEFERRED` in Dok. 07, keine Arbeitspakete dafür vor Entscheidung

### ENT-004 — Mollie-Zahlungsdienstleister: Vertrag vorhanden?
- **Datum:** offen
- **Quelle:** QS-06 E-04
- **Problem:** Route und Edge-Function-Aufruf existieren bereits im Code — unklar ob ein aktiver Mollie-Account/API-Key existiert
- **Empfehlung dieses Projektmanagements:** Falls kein Vertrag: Feature-Flag deaktivieren bis Klärung, kein Aufwand in P4-03 investieren
- **Entscheider:** Büro-Mitarbeiter/Buchhaltung — **AUSSTEHEND, blockiert AP P4-03**

### ENT-005 — KVP-Konsolidierung
- **Datum:** 2026-06-19 (übernommen aus Archäologie E-05)
- **Quelle:** QS-06
- **Problem:** Zwei parallele KVP-Seiten (`/kvp` mit Demo-Daten, `/betrieb-kvp` mit echtem Repository)
- **Entscheidung:** `/betrieb-kvp` ist canonical, `/kvp` wird migriert oder redirected
- **Begründung:** `/betrieb-kvp` ist vollständiger (Produktionsboden-tauglich, Rollen-Checkbox, echte DB)
- **Betroffene Verträge:** AP P2-02 (Dok. 07)

### ENT-006 — Arbeitszeit-Buchung: Nutzung klären
- **Datum:** offen
- **Quelle:** QS-06 E-06
- **Problem:** `arbeitszeit_buchung`-Tabelle existiert, kein UI. Unklar, ob/wie Stundenerfassung gewünscht ist.
- **Entscheider:** Inhaber — **AUSSTEHEND**
- **Konsequenz:** Nachkalkulation (Phase 6, P6-Automatisierung) bleibt ohne diese Daten unvollständig

### ENT-007 — Website-Projekt (kreile.de): Zeitpunkt und Abgrenzung
- **Datum:** 2026-06-19 (Scope-Entscheidung dieses Projektmanagements)
- **Quelle:** QS-06 E-07, Charter Dok. 00 Abschnitt 5
- **Entscheidung:** Eigenständiges, separates Next.js-Deployment, explizit außerhalb des Scopes dieses App-Projekts, Start frühestens nach App-Stabilität (Ende Phase 2/3)
- **Begründung:** Vermeidung von Scope-Creep, Konfliktregel „Plattformumbau gegen stabile Live-Funktion" sinngemäß angewendet

### ENT-008 — Klartext-Begriffe statt Fachjargon im Cockpit
- **Datum:** 2026-06-19
- **Quelle:** QS-08 VS-04
- **Entscheidung:** „Forecast" → „Erwarteter Umsatz", „Aging" → „Offene Rechnungen — wie alt?", generisches „KPI" wird durch konkreten Begriff ersetzt
- **Begründung:** Nachfolger-Persona versteht Fachbegriffe nicht, Motivationseffekt entscheidend für Nutzung
- **Betroffene Verträge:** AP P5-01 (Dok. 07)

### ENT-009 — Auth-Provider-Konsolidierung: Custom HMAC bleibt führend
- **Datum:** 2026-06-19
- **Quelle:** QS-09 A-01, Empfehlung übernommen
- **Entscheidung:** Custom-HMAC-Cookie-Session bleibt der produktive Mechanismus für PIN-Login (Werkstatt-Realität: Mitarbeiter ohne Account-Verwaltung). Supabase Auth wird isoliert für Admin-/Entwicklerzugang verwendet, kein Mischbetrieb im selben Flow.
- **Begründung:** PIN-basierter Zugang ist für Werkstattmitarbeiter alltagstauglicher als klassisches Auth; Supabase Auth bleibt für administrative Zwecke sinnvoll
- **Betroffene Verträge:** AP P7-01 (Dok. 07) — Umsetzung erst in Phase 7, Entscheidung aber bereits jetzt getroffen, um keine weitere Mischarchitektur zu vertiefen

### ENT-010 — Keine pauschale Stack-/Datenschutz-Dogmatik
- **Datum:** 2026-06-19
- **Quelle:** `00_PRIORITY_RULES_KREILE.md`, `KREILE_STACK_POLICY.md`, Projektanweisungen dieses Chats
- **Entscheidung:** Jede Stack-Frage wird über eine Entscheidungs-Matrix bewertet (Nutzen, UX, Performance, Aufwand, Kosten, Wartbarkeit, Datenschutzrisiko, Alternativen, Empfehlung). Keine automatischen Verbote von Google Maps, Vimeo, US-Diensten o. Ä.
- **Begründung:** Explizite Projektregel, übergeordnet gültig für alle Folgeentscheidungen in diesem Projekt

---

## 3. Offene Entscheidungen — Sammelliste (blockierend markiert)

| ID | Frage | Blockiert | Entscheider | Deadline-Empfehlung |
|---|---|---|---|---|
| ENT-002 | `/kontrolle` bauen oder entfernen | AP P3-09 | Franz Kreile | vor Phase 3 |
| ENT-003 | Marketing Studio Zukunft | Marketing-Arbeitspakete | Siglinder/Inhaber | vor Phase 7 |
| ENT-004 | Mollie-Vertrag bestätigen | AP P4-03 | Büro/Buchhaltung | vor Phase 4 |
| ENT-006 | Arbeitszeit-Erfassung gewünscht? | Nachkalkulation (P6) | Inhaber | vor Phase 6 |
| — | Wer hält Supabase-/Vercel-Projekt-Ownership nach Go-live? | Dok. 10 Abschnitt 1 | Siglinder/Kunde | vor Phase 8 |

---

## 4. Widersprüche — Auflösungsprotokoll

| ID | Widerspruch | Auflösung | Quelle |
|---|---|---|---|
| W-01 | Zwei Token-Systeme | `ci-tokens.css` ist Wahrheit | QS-09, QS-07 — siehe Dok. 01 Abschnitt 3.6 |
| W-02 | Zwei KVP-Seiten | `/betrieb-kvp` canonical | ENT-005 |
| W-04 | Slug „galvanik" vs. VALID_SLUGS | VALID_SLUGS ist Wahrheit, Doku korrigieren | QS-03, QS-06 |
| W-05 | Falscher Env-Var-Name in Mollie-Route | Server-seitige `SUPABASE_URL` separat setzen | QS-06 |

---

## 5. Scope-Änderungen seit Projektstart

Keine bisher dokumentiert — dies ist der erste konsolidierte Projektmanagement-Durchlauf nach den vier Fachrollen-Audits. Künftige Scope-Änderungen werden ab hier fortlaufend ergänzt (ENT-011, ENT-012, …).

---

## 6. Hinweis zur Pflege dieses Dokuments

Bei jeder neuen Entscheidung im Projektverlauf: neuer Eintrag mit fortlaufender ENT-Nummer, niemals bestehende Einträge löschen oder umschreiben. Bei Revision einer früheren Entscheidung: neuer Eintrag mit explizitem Verweis „revidiert ENT-XXX" und Begründung für die Änderung.

---

*Dieses Protokoll ist die Gedächtnisinstanz des Projekts. Es verhindert, dass dieselbe Entscheidung mehrfach neu diskutiert wird oder stillschweigend widersprüchlich getroffen wird.*

# PLATTFORMARCHITEKTUR-ANALYSE — KREILE WERKSTATTCOCKPIT
## Visionärer Principal Software Architect
### Analysedatum: 2026-06-19

---

## ARCHITEKTURURTEIL

> **PLATTFORMFÄHIG MIT RISIKEN**

**Begründung:** Die technischen Fundamente (Next.js 15 App Router, Drizzle ORM, Supabase, Event-System, Feature-Flags, Lizenz-Tier-Architektur) sind prinzipiell plattformtauglich. Die Umsetzung weist jedoch strukturelle Muster auf, die eine Multi-Tenant-Plattform langfristig verhindern: hartkodierte Branchenlogik im Kern, zwei parallele Auth-Systeme, keine Modulverträge, keine API-Versionierung, kein Architekturhandbuch, KPI-Logik direkt in React-Komponenten. Diese Muster sind heute noch korrigierbar — in 18-24 Monaten nicht mehr ohne Neubau.

Das Projekt ist kein schlechtes Fundament. Es ist ein Fundament ohne Baupläne, das dringend strukturiert werden muss, bevor es in Beton gegossen wird.

---

## 1. KERN- UND MODULGRENZEN

| Bereich | Gehört in Kern | Gehört in Modul | Vertrag | Begründung |
|---------|---------------|----------------|---------|------------|
| **Auth / Session** | ✅ Kern | — | HMAC-Cookie-Session + `appUsers`-Tabelle | Kern-OK, aber zwei Auth-Systeme parallel (→ A-01) |
| **Mandantenfähigkeit** | ✅ Kern | — | `tenant_id` in Tabellen; hartkodiert `galvanik-kreile` | Konzept vorhanden, Implementierung defekt (→ A-02) |
| **Designsystem / UI-Shell** | ✅ Kern | — | ci-tokens.css + tokens.css | Zwei parallele Systeme — KERN-BRUCH (→ A-03) |
| **Navigation (TopBar, RightNav, WorkflowBar)** | ✅ Kern | — | Hartkodierte Stationsnamen, kein Konfigurations-Schema | Branchenlogik im Kern-Component (→ A-04) |
| **Event-System** | ✅ Kern | — | `events`-Tabelle, `ui_events`-Tabelle | Gut — aber kein versioniertes Event-Schema |
| **Feature-Flags / Lizenzsteuerung** | ✅ Kern | — | `resolveFeatures.ts`, `feature_flags`-Tabelle | Gebaut, aber nicht verdrahtet (→ A-05) |
| **Globale Suche** | ✅ Kern | — | `global-search-actions.ts` | Kein Tenant-Filter, kein Berechtigungs-Gate |
| **KI-Client (Gemini)** | ✅ Kern | — | `geminiClient.ts` + direkter `genAI`-Aufruf in `ai-enrichment.actions.ts` | Zwei parallele KI-Zugangsmuster (→ A-06) |
| **Offline/Sync** | ✅ Kern | — | `OfflineManager`, `idbSync` | Gut konzipiert, unvollständig |
| **Warendurchlauf / Stationslogik** | ❌ → Modul | `warendurchlauf`-Modul mit Branchenpaket Galvanik | `VALID_SLUGS`, Stationsnamen, Prozesslogik | Galvanik-spezifisch, hartkodiert im Routing |
| **Buchhaltung** | ❌ → Modul | `buchhaltung`-Modul | `schema_buchhaltung.ts` als eigenes Schema — gut | Kein expliziter Modulvertrag |
| **Marketing Studio** | ❌ → Modul | `marketing`-Modul | `schema_marketing.ts` als eigenes Schema — gut | InstagramAdapter existiert — aber kein Manifest |
| **KVP / Qualitätssicherung** | ❌ → Modul | `kvp`-Modul | Zwei parallele KVP-Seiten ohne Modul-Konsolidierung | Modul-Interna divergieren |
| **Kalkulation / Pricing** | ❌ → Modul | `kalkulation`-Modul | Spezifiziert (Spec 06a), kein Code | Höchste Priorität nach Kern-Stabilisierung |
| **Kommunikation** | ❌ → Modul | `kommunikation`-Modul | Tabelle + teilweise UI, aber Modul-Grenze unklar | Gemeinsame `communications`-Tabelle mit `events` |
| **KPI-Berechnungen** | ❌ → Kern-Service | SQL-Views oder versionierte Analyse-Services | Heute in React-Komponenten verteilt | Architekturverstoß (→ A-07) |

---

## 2. ARCHITEKTURPROBLEME

| Prio | Problem | Auswirkung | Ursache | Korrektur |
|------|---------|------------|---------|-----------|
| **A-01** 🔴 | **Zwei parallele Auth-Systeme** | `appSession.ts` (custom HMAC Cookie) UND `supabase/server.ts` (Supabase Auth) laufen gleichzeitig. `auth.ts`-Actions nutzen Supabase Auth; `checkAppAuth()` nutzt eigenes Cookie. Widerspruch in Sicherheitsmodell. | Historisches Wachstum — zuerst Custom-Auth, dann Supabase-Auth addiert | Einen kanonischen Auth-Provider wählen. Empfehlung: Custom HMAC ist produktionstauglicher (PIN-basiert für Werkstatt) — Supabase-Auth als Admin-Login für Entwickler isolieren |
| **A-02** 🔴 | **Hartkodierter Mandant** `galvanik-kreile` | `appSession.ts` kennt nur `galvanik-kreile`. Kein zweiter Mandant ohne Code-Änderung möglich. `customers.actions.ts` hat zudem keinen Tenant-Filter. | Bewusste Abkürzung | `TENANT_ID` aus Session lesen, nie hardkodieren. Multi-Tenant-Test mit zweitem Datensatz |
| **A-03** 🔴 | **Zwei Design-Token-Systeme** | `ci-tokens.css` (`--ci-*`) und `tokens.css` (`--navy-`, `--accent-`) koexistieren. `OrderWideCard` ignoriert beide. Kein konsistentes Theming möglich. | Parallele Entwicklungspfade | ci-tokens.css als Single Source, tokens.css deprecaten, Migration aller Komponenten |
| **A-04** 🔴 | **Branchenlogik im Navigationskern** | `TopWorkflowBar` hardkodiert `["wareneingang","entmetallisierung","schleiferei","beschichtung","warenausgang"]`. Ein Hotel oder eine Schule kann diese Plattform nicht ohne Code-Änderung nutzen. | Direktes Build ohne Konfigurationsschicht | Stations/Workflow-Config als DB-Konfiguration oder JSON-Modul pro Mandant. Navigation aus Konfiguration rendern. |
| **A-05** 🔴 | **Feature-Flags gebaut, aber nicht verdrahtet** | `resolveFeatures.ts` vollständig implementiert — kein UI-Aufruf. `feature_flags`-Tabelle in DB — kein UI liest daraus. Lizenz-Tier-System existiert nur auf Papier. | Infrastruktur vor Integration gebaut | `useFeatureFlag(featureKey)`-Hook in alle Premium-Bereiche einbauen. Ab sofort keine neue Funktion ohne Feature-Gate. |
| **A-06** 🟡 | **Zwei KI-Integrationsmuster** | `geminiClient.ts` (zentraler Client mit Fallback) UND direkte `genAI.getGenerativeModel()` in `ai-enrichment.actions.ts`. Kein einheitlicher KI-Adapter. | Unterschiedliche Entwicklungszeitpunkte | Alle KI-Calls über `geminiClient.ts` routen. Direktzugriffe entfernen. KI-Adapter als austauschbarer Dienst: `KIAdapter.generate()` statt Gemini-Direktzugriff |
| **A-07** 🟡 | **KPI-Logik in React-Komponenten** | `AgingKachel.tsx` berechnet Fälligkeit, `OrderWideCard.tsx` berechnet Dringlichkeit — inline in Komponenten-Logik. Nicht wiederverwendbar, nicht testbar, nicht versioniert. | Schnelligkeit vor Struktur | KPI-Berechnungen in SQL-Views oder Server-Side-Services isolieren. Komponenten empfangen nur berechnete Werte. |
| **A-08** 🟡 | **Keine Modulverträge / kein Manifest** | Kein Modul definiert: ID, Version, Events, Abhängigkeiten, Berechtigungen. Module importieren direkt in fremde Ordner. | Kein Modul-Registry-Konzept beim Start | `module.manifest.ts` pro Modul einführen. Beginnen mit den 3 größten Modulen: warendurchlauf, buchhaltung, kommunikation. |
| **A-09** 🟡 | **Keine API-Versionierung** | Alle 18 API-Routes ohne Versions-Prefix (`/api/ocr-process` statt `/api/v1/ocr-process`). Breaking Changes können nicht kontrolliert eingeführt werden. | Standard-Next.js-Muster ohne Versionsstrategie | `/api/v1/` als Prefix einführen. Alte Routes via Redirect übergangsweise erhalten. |
| **A-10** 🟡 | **Externe Dienste ohne Adapter** | Supabase Edge Functions werden direkt via `fetch(${supabaseUrl}/functions/v1/...)` aufgerufen — kein Health-Check, kein Retry, kein Fallback, keine Deaktivierbarkeit. 5 Edge Functions: `customer-enrich`, `freetext-extract`, `inquiry-extract`, `item-photo-analyze`, `email-send` | Direkter HTTP-Call in Actions | `EdgeFunctionAdapter`-Klasse mit Health-Check, Retry (exponential backoff), Fallback, Circuit-Breaker |
| **A-11** 🟡 | **Kein Observability-Stack** | Kein strukturiertes Logging, kein Error-Monitoring (kein Sentry o.ä.), kein Performance-Monitoring. Fehler gehen in `console.error()`. | Nicht geplant | Strukturiertes Logging via `pino` oder `winston`. Sentry für Production-Errors. Supabase-built-in für DB-Queries. |
| **A-12** 🟠 | **Kein Architekturhandbuch** | `docs/` enthält Audit-Reports und Statusdokumente, aber kein Architekturhandbuch, kein Modul-Handbuch, kein Runbook, keine lokale Dev-Anleitung. | Kein formaler Dokumentationsstandard | ARCHITECTURE.md, MODULE_GUIDE.md, RUNBOOK.md als Pflicht-Artefakte |
| **A-13** 🟠 | **Keine Tests** | Kein Unit-Test, kein Integrationstest, kein E2E-Test identifiziert. `tsc --noEmit` läuft nicht durch (Timeout). | Nicht in Entwicklungsprozess | Mindest-Testsuite: Auth-Chain, Tenant-Filter, Kritische Server-Actions, Migrations-Integrität |
| **A-14** 🟠 | **Drei gemischte DB-Schemas ohne Isolation** | `schema.ts`, `schema_buchhaltung.ts`, `schema_marketing.ts` teilen denselben Drizzle-Client ohne Modul-Grenze. Jede Action kann direkt auf alle Tabellen zugreifen. | Technisch einfachster Weg | SQL-Views als Modul-Außengrenze. Dann in eigenständige Drizzle-Schemata trennen mit explizitem Cross-Schema-Zugriff nur via Views. |

---

## 3. WIEDERVERWENDBARKEIT

| Funktion | Generisch nutzbar | Branchenspezifisch | Notwendige Abstraktion | Empfehlung |
|----------|------------------|-------------------|----------------------|------------|
| **Auth / PIN-Login** | ✅ Jede Werkstatt, Praxis, Gastronomie | Nein | Rollen konfigurierbar machen (`role_config.json`) | Plattformkern — sofort generalisieren |
| **Event-System** (`events`-Tabelle) | ✅ Universell | Event-Typen galvanik-spezifisch | Event-Typen als Konfiguration, nicht Enum im Code | Kern-Asset — abstrakten Event-Typ definieren |
| **Global Search** | ✅ Generisch konfigurierbar | Entity-Typen galvanik-spezifisch | Entity-Registry: Module registrieren ihre suchbaren Entitäten | Kern-Dienst — Modul-Plugin-System für Search |
| **Warning Engine** | ✅ Universell | Regel-Implementierungen galvanik-spezifisch | Regelmotor mit konfigurierbaren Regeln pro Mandant | Kern-Infra mit Modul-Regeln — bereits richtig strukturiert |
| **Feature-Flags / Lizenzsystem** | ✅ Vollständig generisch | Feature-Keys sind teilweise galvanik-nah | Abstrakte Feature-Keys + Branchenpaket-Mapping | Plattformkern — sofort aktivieren |
| **Gemini KI-Client** | ✅ Universell | Prompts galvanik-spezifisch | `KIAdapter` mit konfigurierbaren Prompts per Modul | Kern-Dienst — Direktzugriffe konsolidieren |
| **Cockpit-Kachel-System** | ✅ Kachel-Architektur generisch | Kachel-Inhalte galvanik-spezifisch | Kacheln als Modul-Einstiegspunkte; Modul registriert seine Kacheln | Kern-Shell + Modul-Kacheln |
| **Offline / Sync** | ✅ Generisch | Sync-Logik Next.js-spezifisch | Abstraktionsschicht über IndexedDB-Sync | Kern-Dienst |
| **Warendurchlauf / Stationslogik** | ❌ Galvanik-Only | Vollständig | `ProcessFlow`-Abstraktion: Stationen, Übergaben, Events generisch | Branchenpaket `galvanik-process` |
| **`TopWorkflowBar` mit VALID_SLUGS** | ❌ Galvanik-Only | Vollständig | Workflow-Nav aus DB-Konfiguration rendern | Muss raus aus Kern |
| **Marketing Studio** | ⚠️ Teilweise | Schema generisch, aber Branchenfelder nötig | B2B-Galvanik vs. B2C-Marketing — Felder konfigurierbar | Modul mit Konfigurations-Schema |
| **Buchhaltung** | ⚠️ Teilweise | Galvanik-typische Belegtypen | Belegtypen konfigurierbar per Mandant | Modul mit Branchenpaket |

---

## 4. ERWEITERUNGSPLAN

| Modul | Nutzen | Abhängigkeiten | Vertrag | Monetarisierung | Priorität |
|-------|--------|----------------|---------|-----------------|-----------|
| **Kern-Stabilisierung** (Auth, Tenant, Design, Feature-Gates) | Plattformfähigkeit. Ohne dies: jeder Kunde = Code-Fork | Auth-Refaktor, Token-Konsolidierung, Feature-Flag-Verdrahtung | `CorePlatform.v1` | Voraussetzung aller Erlöse | **1 — JETZT** |
| **Kalkulation / Pricing-Assistent** | Direkte Umsatz-/Margenwirkung für Kreile | Gemini-KI, Baeder-Tabelle, Auftragsdaten | `KalkulationsModul.v1` | Premium-Feature (Pro/Enterprise) | **2 — SPRINT 1** |
| **Warning Engine Live-Rules** | Proaktive Betriebssteuerung ohne manuellen Scan | Events, Orders, Baeder, Inventar | `WarningRules.v1` | Automation-Paket | **3 — SPRINT 2** |
| **Modul-Manifest-System** | Externe Entwickler können Plattform erweitern | Alle bestehenden Module | `ModuleRegistry.v1` | Marktplatz-Vorstufe | **4 — SPRINT 2** |
| **Kommunikation (vollständig)** | Rückrufmanagement, Wiedervorlage, Kundenbenachrichtigung | `phoneNotes`, `calendar_events`, Email-Adapter | `KommunikationModul.v1` | Operations-Paket | **5 — SPRINT 3** |
| **Kunden-Portal** (externes Login) | Kunden können Status selbst abrufen — weniger Anrufe | Auth-Kern, Orders, Status-Service | `KundenPortal.v1` | Premium-Modul | **6 — MITTEL** |
| **Arbeitszeit / Personal** | Nachkalkulation, Kapazitätsplanung | `arbeitszeit_buchung`-Tabelle, Orders | `PersonalModul.v1` | Operations-Paket | **7 — MITTEL** |
| **Websites-Modul** (kreile.de) | Marketing-Kanal, Anfrage-Eingang | Keine (eigenständig) | Separates Deployment, Schnittstelle zu Intake | Website-Aufbauprojekt (Fixpreis) | **8 — LATER** |
| **Branchen-Marktplatz** | Neue Kunden mit fertigem Branchenpaket | Modul-Manifest-System, Signing, Billing | `MarketplaceRegistry.v1` | Provision + Listing-Fee | **9 — LANGFRISTIG** |
| **Self-Improvement Engine** | Plattform erkennt eigene Lücken und schlägt Erweiterungen vor | Telemetrie, KVP, Warning Engine, Gemini | `SelfImprovement.v1` | Enterprise / KI-Kontingent | **10 — LANGFRISTIG** |

---

## 5. AUTOMATISIERTE UNTERNEHMENSFÜHRUNG — STUFENMODELL

| Funktion | Datenbasis | Auslöser | Empfehlung / Aktion | Freigabestufe | Messbare Wirkung |
|----------|------------|----------|---------------------|---------------|------------------|
| Tages-Prioritätsliste | `orders.dueDate`, `risk`, `currentStationId` | Täglich 06:00 Uhr Cron | „Heute 3 kritische Aufträge + 2 Abholungen = CHF 1.400 offen" | Stufe 1 – Information | Suchzeit ↓, Fokus ↑ |
| Liegengebliebener Auftrag | `orders.updatedAt` > 48h ohne Statuswechsel | Stündlich, Schwellenwert konfigurierbar | Warning Engine: „Auftrag #4712 — seit 3 Tagen keine Bewegung" | Stufe 2 – Empfehlung | Durchlaufzeit ↓ |
| Fertigstellungsprognose | Ø Verweildauer je Station × Auftragsstand | Neue Auftragsanlage | „Voraussichtlich fertig: Mittwoch 14.06. (±1 Tag)" | Stufe 1 – Information | Anruf-Eingang ↓ |
| Mahnungs-Vorbereitung | `aging_bucket` > 30 Tage, Rechnungsdaten | Täglich, SQL-View | Entwurf Mahnschreiben, vorausgefüllt, per Klick freigeben | Stufe 3 – Vorbereitung | Liquidität ↑ |
| Abholbenachrichtigung | `currentStationId = warenausgang` | Statuswechsel-Event | SMS/Email-Entwurf: „Ihr Auftrag ist abholbereit." | Stufe 4 – Freigabepflichtig | Abholquote ↑, Anrufe ↓ |
| Nachkalkulation Abweichung | `arbeitszeit_buchung` + Auftragswert | Auftragsabschluss | „Auftrag #4712: geplant 2h, tatsächlich 4,5h → Marge -18 %" | Stufe 2 – Empfehlung | Preisfindung verbessert |
| Engpass-Erkennung | `currentStationId` Zählung je Station | Stündlich | Cockpit-Warnung: „Schleiferei überlastet: 7 Aufträge (Normal: 3)" | Stufe 2 – Empfehlung | Bottleneck-Zeit ↓ |
| Rückruf-Erinnerung | `phoneNotes.status = waiting_callback` + Datum | Fälligkeitsereignis | Push / In-App: „Rückruf Müller – heute bis 12:00" | Stufe 1 – Information | Vergessenheitsrate ↓ |
| Batch-Optimierung | ähnliche Teile + freie Kapazität | Täglich 07:00 | „5 Aufträge für Verfahren Nickel — heute batch-fähig, spart 40 min" | Stufe 3 – Vorbereitung | Durchsatz ↑ |
| KI-Wochenbericht | Alle KPIs, Vorwochenvergleich | Montags 07:30 | Gemini-Zusammenfassung: Was lief gut? Was nicht? 3 Maßnahmen. | Stufe 1 – Information | Nachfolger-Kompetenz ↑ |

**Stufenprinzip:** Kein System schlägt je Stufe 4 ohne explizite Nutzer-Freigabe. Stufe 5 (kontrollierte Autonomie) nur für risikolose, vollständig protokollierte Aktionen (z.B. Status-Log schreiben).

---

## 6. LEBENSZYKLUS UND WARTBARKEIT

| Bereich | Aktueller Stand | Risiko | Zielzustand | Maßnahme |
|---------|----------------|--------|-------------|---------|
| **Typsicherheit** | `type Order = any` in `orders/page.tsx`. `tsc --noEmit` läuft nicht durch (Timeout >45s) | 🔴 Hoch — Type-Erosion bei jedem neuen Entwickler | Strict TypeScript, 0 `any` | Typen aus Drizzle-Schema auto-generieren (`drizzle-zod`) |
| **Tests** | Keine identifizierten Tests | 🔴 Hoch — jede Änderung bricht ggf. unbemerkt | 80% Server-Action-Coverage, 100% Auth-Chain | `vitest` oder `jest` + `playwright` für E2E |
| **Dokumentation** | `docs/` = Audit-Protokolle. Kein Architektur-, kein Modul-Handbuch, kein Runbook | 🔴 Hoch — externer Entwickler braucht Wochen zum Einarbeiten | ARCHITECTURE.md, MODULE_GUIDE.md, RUNBOOK.md | 1 Woche Dokumentations-Sprint nach Stabilisierung |
| **Abhängigkeiten** | Next.js 15 aktuell. Andere Versionen unbekannt. Kein Dependabot. | 🟡 Mittel | Monatlicher Dependency-Check, automatisierter Sicherheits-Scan | `npm audit` in CI, Dependabot aktivieren |
| **Migrationen** | 70+ Drizzle-Migrationen vorhanden. Kein Migrations-Protokoll. | 🟡 Mittel — bei Konflikt schwer debugbar | Jede Migration dokumentiert mit Grund und Rollback | `drizzle-kit` Migrations-Log ergänzen |
| **Rollback** | Kein Rollback-Konzept dokumentiert | 🔴 Hoch — bei fehlerhaftem Deploy kein kontrollierter Rückbau | Git-Tag + DB-Snapshot als Pre-Deploy-Pflicht | Pre-Deploy-Checklist (Audit-Skill vorhanden) |
| **Monitoring / Observability** | `console.error()` als einziges Logging | 🔴 Hoch — Produktionsfehler unsichtbar | Sentry für Frontend + Server, strukturiertes Logging | Sentry Free-Tier in 1h einzubinden |
| **Externe Dienste** | Supabase Edge Functions direkt angesprochen, ohne Health-Check | 🟡 Mittel — Ausfall einer Funktion → Cascade-Fehler | Circuit Breaker, Fallback, Deaktivierbarkeit | `EdgeFunctionAdapter` mit Retry + Fallback |
| **Performance-Budget** | Nicht definiert. Animierte Zähler auf Startseite. | 🟡 Mittel | Core Web Vitals: LCP < 2.5s, CLS < 0.1 | Lighthouse in CI, Server-Component-First |
| **Code-Ownership** | Kein Modul-Owner dokumentiert. Wissensmonopol möglich. | 🟡 Mittel | Jede Modul-Datei mit `@owner`-JSDoc | `CODEOWNERS`-Datei einführen |

---

## 7. GESCHÄFTSMODELL

| Erlösquelle | Kundennutzen | Technische Voraussetzung | Risiko | Empfehlung |
|-------------|-------------|-------------------------|--------|------------|
| **Basis-Lizenz** (Kern + Warendurchlauf) | Auftragsübersicht, Stationsstatus, Suche | Kern-Stabilisierung + Multi-Tenant | Zu günstig → keine Weiterentwicklung möglich | CHF/EUR 149-199/Monat, max. 5 Nutzer |
| **Operations-Paket** (+Kommunikation, Kalender, KVP) | Rückruf-Management, Wiedervorlage, Feedback | Kommunikation-Modul vollständig | Nutzer nutzen nur Kern, zahlen nichts extra | Monatlich zu Basis addieren, ca. +EUR 49 |
| **Finance-Paket** (+Buchhaltung, Belege, DATEV) | Weniger Arbeit für Steuerberater, schnellere Abrechnung | OCR fix, Buchhaltungs-Modul vollständig | DATEV-Anbindung aufwändig | +EUR 79/Monat, oder einmalig EUR 990 Setup |
| **AI-Paket** (+Kalkulation, KI-Zusammenfassung, Wochenbericht) | Preisfindung, automatische Priorisierung | Gemini-Adapter stabil, Kalkulations-Modul | KI-Kosten skalieren mit Nutzung | +EUR 39/Monat inkl. KI-Kontingent |
| **Automation-Paket** (+Warning Engine, Mahnwesen, Batch) | Weniger manuelle Arbeit, proaktive Steuerung | Warning Engine Live-Rules, Mahnungs-Workflow | Komplexität in Regelpflege | +EUR 49/Monat |
| **Einmalig: Implementierung** | Schnellstart, Datenmigration, Schulung | Mandanten-Setup-Script | Einmalig, skaliert nicht direkt | EUR 2.500-5.000 je Neukunde |
| **Einmalig: Website** | Kundenakquise für Kreile | Separates Deployment | Scope-Creep-Risiko | Fixpreis EUR 3.500-5.500 |
| **Branchenpaket** (z.B. Schule, Hotel) | Neue Märkte ohne Neubau | Kern-Modularisierung abgeschlossen | Vertrieb in neuen Branchen | Erst nach Kern-Stabilisierung |
| **Marktplatz-Provision** | Drittmodule für Spezialbranchen | Modul-Manifest-System + Signing | Qualitätskontrolle aufwändig | Langfristig: 20-30% Provision |
| **Managed Service** | Keine IT-Kompetenz beim Kunden nötig | Monitoring, SLA, Backup-Garantie | Supportlast | +EUR 99/Monat inkl. SLA |

**Kernprinzip:** Kein Feature sperren, das für operative Basisnutzung erforderlich ist. Monetarisierung über Tiefe, nicht Breite.

---

## 8. LANGFRISTIGER ENTWICKLUNGSPLAN

### Phase 0 — Fundament (heute, 4-6 Wochen)

**Stabiler Plattformkern:**
- Auth: einen kanonischen Auth-Mechanismus wählen. Custom HMAC bleibt für PIN-Login. Supabase-Auth isoliert für Admin. Kein Mischbetrieb im selben Auth-Flow.
- Mandanten: `tenant_id` aus Session, nie hartkodiert. Multi-Tenant-Test mit Mandant „test-galvanik-2".
- Design: ci-tokens.css als einziger Token-Provider. tokens.css → Migration → Deprecation.
- Feature-Gates: `useFeatureFlag()` in alle Premium-Seiten einbauen. Ab sofort jede neue Funktion hinter Flag.
- Fehler-Monitoring: Sentry einbinden.
- Typen: `type Order = any` eliminieren. Drizzle-Schema-Typen auto-generieren.

### Phase 1 — Modul-Konsolidierung (1-3 Monate)

**Kurzfristige Module:**
- `warendurchlauf`-Modul mit explizitem Modulvertrag: Events, Berechtigungen, Konfiguration der Stationssequenz.
- `buchhaltung`-Modul mit eigenem Service-Layer: keine Direktzugriffe von außen.
- `kommunikation`-Modul vollständig: echte Kalender, echte Wiedervorlage.
- KPI-Logik aus Komponenten in SQL-Views extrahieren.
- Alle Edge-Function-Calls durch `EdgeFunctionAdapter` ersetzen.

### Phase 2 — Branchenpaket Galvanik (2-4 Monate)

**Branchenpakete:**
- Branchenpaket `galvanik-kreile-v1`: Stationssequenz, Bäder-Logik, Beschichtungsverfahren als Konfiguration.
- Kalkulations-Modul MVP mit Gemini.
- Warning Engine Live-Rules (5 Kern-Regeln).
- Website kreile.de als separates Projekt.

### Phase 3 — Plattform-Generalisierung (3-6 Monate)

**Plattform-Erweiterung:**
- Modul-Manifest-System (`module.manifest.ts` pro Modul).
- Branchenpaket-Abstraktion: generische Entitäten (Vorgang, Ressource, StatusEvent).
- Zweiter Mandant (z.B. andere Galvanik oder Metallverarbeitung) als Pilottest.
- Modulmarktplatz-Vorstufe: interne Modul-Registry.

### Phase 4 — KI und Autonomie (6-12 Monate)

**Automatisierung und KI:**
- KI-gestützte Wochenberichte (Stufe 1).
- Fertigstellungsprognose auf Basis echter Durchlaufzeiten (Stufe 2).
- Automatische Mahnungs-Vorbereitung mit Freigabe (Stufe 3-4).
- Self-Improvement Engine: Plattform erkennt eigene Nutzungslücken (Stufe 2).

### Langfristig — Marktplatz und Governance

- Modulmarktplatz mit Signing, Versionierung, Qualitätszertifizierung.
- Partnerportal für Branchen-Implementierer.
- Governance: Modulowner-Modell, Breaking-Change-Prozess, Deprecation-Policy.

---

## 9. FEHLENDE, ABER NOTWENDIGE PUNKTE

Diese Aspekte wurden in keiner bisherigen Analyse adressiert:

**1. Disaster Recovery und Backup-Konzept**
Supabase hat automatische Backups — aber kein Restore-Test, kein dokumentierter Recovery-Time-Objective (RTO), kein Recovery-Point-Objective (RPO). Was passiert, wenn die DB korrupt wird? Niemand weiß es.

**2. Rate-Limiting und Missbrauchsschutz**
Keine API-Route hat Rate-Limiting. Gemini-Quota-Schutz ist im Client rudimentär vorhanden, aber kein systematisches Throttling auf API-Ebene. Ein einzelner fehlerhafter Request kann Kosten verursachen.

**3. Datenmigration und Portabilität**
Kein Export-Format für Kundendaten, Auftragsdaten oder Buchhaltungsdaten definiert. DSGVO-Auskunftsrecht (Artikel 15) und Recht auf Datenübertragbarkeit (Artikel 20) erfordern strukturierte Exportfunktion.

**4. Änderungsprotokoll für Geschäftsdaten (Audit-Log)**
`events`-Tabelle erfasst operationale Events — aber kein Audit-Trail für Datenmutationen (wer hat wann was geändert?). Für Kundenstreit oder Behördenauskunft unentbehrlich.

**5. Nachfolge-Wissenstransfer**
Die App soll Nachfolge erleichtern — aber kein einziger Prozess ist so dokumentiert, dass ein Nachfolger ohne Vorkenntnisse startet. Kein Onboarding-Flow, kein Prozess-Wiki, kein eingebettetes Wissen über Galvanik-Abläufe.

**6. SLA und Verfügbarkeitsversprechen**
Wenn Kreile die App im Tagbetrieb nutzt und Supabase oder Vercel ausfallen — was passiert? Kein Wartungsmodus, keine Statusseite, kein Kommunikationsweg für Ausfälle.

**7. Dependency-Lock und Supply-Chain-Sicherheit**
`package-lock.json` oder `pnpm-lock.yaml` vorhanden? Keine automatische Sicherheitsprüfung für kompromittierte npm-Pakete (z.B. via `npm audit` in CI). Supply-Chain-Angriff auf ein npm-Paket würde unbemerkt bleiben.

**8. Internationalisierung (i18n)**
Alle Strings sind deutsch hartkodiert. Wenn Kreile einen zweiten Standort in der Schweiz oder Österreich mit anderem Rechnungsformat öffnet: komplette Überarbeitung nötig. i18n-Rahmen kostet jetzt 2 Tage, später 2 Monate.

---

## DEFINITION OF DONE — PLATTFORMCHECK

| Kriterium | Status |
|-----------|--------|
| Kern und Module klar getrennt | ❌ Keine Modulverträge |
| Modulverträge versioniert | ❌ Kein Manifest-System |
| Mandantenfähigkeit nachgewiesen | ❌ Hartkodiert `galvanik-kreile` |
| Branchenbegriffe konfigurierbar | ❌ VALID_SLUGS im Code |
| Keine kritischen Tiefkopplungen | ❌ Direkte Fetch-Calls, zwei Auth-Systeme |
| Externe Wartung dokumentiert möglich | ❌ Kein Architekturhandbuch |
| Updates und Migrationen kontrolliert | ⚠️ 70+ Migrationen vorhanden, kein Protokoll |
| Rollbacks nachgewiesen | ❌ Nicht dokumentiert |
| Performancebudgets existieren | ❌ Nicht definiert |
| Sicherheits- und Datenschutzmodell vollständig | ❌ 30 Tabellen ohne RLS, kein Exportformat |
| Automatisierungen kontrollierbar und auditierbar | ⚠️ Architektur vorhanden, keine Live-Regeln |
| Kundennutzen messbar | ⚠️ Events vorhanden, keine KPI-Auswertung produktiv |
| Monetarisierung nachhaltig geplant | ⚠️ Lizenz-Typ-System gebaut, nicht aktiviert |
| Daten exportierbar und portabel | ❌ Kein Export-Format |
| Neue Module ohne Kern-Umbau ergänzbar | ❌ Kein Modul-Registry-System |
| Altmodule migrierbar | ❌ Kein Deprecation-Prozess |
| Self-Improvement kontrolliert rückrollbar | ❌ Nicht vorhanden |
| Branchenanpassung ohne Code-Fork | ❌ Noch nicht möglich |
| In mehreren Jahren weiterentwickelbar | ⚠️ Mit Korrekturen: ja |
| Kein Wissensmonopol | ❌ Kein CODEOWNERS, kein Handbuch |

**Ergebnis: 0 von 20 DoD-Kriterien vollständig erfüllt. 6 in Arbeit.**

---

## ARCHITEKTONISCHES SCHLUSSWORT

Das Kreile WerkstattCockpit ist kein schlechtes Fundament — es ist ein gutes Fundament ohne Baupläne, das gerade noch rechtzeitig strukturiert werden kann. Die Entscheidung für Next.js App Router, Drizzle ORM, Supabase, Event-Tracking und ein Lizenz-Tier-System sind richtig. Sie bilden einen soliden Plattformkern — der nur noch als solcher erkannt und behandelt werden muss.

Das kritischste Architekturproblem ist nicht technisch. Es ist konzeptionell: Die Anwendung wurde als Branchenanwendung für Galvanik Kreile gebaut, nicht als Plattform. Solange dieser mentale Rahmen bestehen bleibt, werden jede neue Funktion und jeder neue Mandant als Sonderfall behandelt — bis das System zu komplex zum Warten wird.

Der Wechsel zum Plattformdenken kostet heute 4-6 Wochen Umbauarbeit. In 12 Monaten kostet derselbe Wechsel einen Neubau.

---

*Analyse durchgeführt: 2026-06-19*
*Methodik: Statische Architekturanalyse, Schemaprüfung, Dependency-Mapping, Integrations-Kartierung*
*Rolle: Visionärer Principal Software Architect — Dauerhaft lebende modulare Unternehmensplattform*

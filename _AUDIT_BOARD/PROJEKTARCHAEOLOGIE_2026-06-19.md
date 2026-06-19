# PROJEKTARCHÄOLOGIE — KREILE WERKSTATTCOCKPIT
## Principal Product Strategist & Requirements Archaeologist
### Analyse-Datum: 2026-06-19 | Methode: 7-Phasen-Archäologie

---

## EXECUTIVE SUMMARY

Das Kreile WerkstattCockpit ist kein Prototyp und kein MVP — es ist ein **teilweise fertiggestelltes Produktionssystem** mit erheblichem realisiertem Wert und ebenso erheblichen strukturellen Lücken. Die Archäologie legt einen Befund offen, den Audit-Reports allein nicht erfassen: **Rund 40% der spezifizierten Funktionen sind gebaut, weitere 25% sind halbfertig, und 35% existieren ausschließlich auf Spezifikationsebene.**

**Kernbefund:** Die Infrastruktur (Datenmodell, Auth, Routing, Events, Station-Workflow, KI-Integration) ist substanziell und weit über Stub-Niveau. Die kritischen End-to-End-Flows (Scan→Auftrag, OCR→Buchhaltung) sind an ihrer letzten Meile unterbrochen — durch technisch kleine, aber operativ fatale Platzhalter. Das Projekt hat einen klaren Charakterbruch zwischen frühen Teilen (schlichter, vollständig, DB-backed) und späteren Teilen (reich spezifiziert, UI gebaut, DB-Schreibpfad fehlt).

**Gesamtbewertung Umsetzungsgrad:** ~32% (operativ nutzbar) | ~60% (gebaut, aber mit Lücken) | ~40% (spezifiziert, nicht gebaut)

**Wichtigste Entdeckung der Archäologie:** Das System enthält **drei ausgewachsene, vollständig beschriebene Produkte**, die nie als eigenständige Deliverables behandelt wurden: (1) die WerkstattApp selbst, (2) ein vollständiges Marketing-CRM-Studio, (3) ein strukturiertes Lizenz-/Feature-Tier-System. Alle drei teilen dieselbe Codebasis, ohne klare Schnittstellentrennung.

---

## 1. VOLLSTÄNDIGES QUELLENINVENTAR

### 1.1 Spezifikationsdokumente

| # | Datei | Typ | Inhalt | Relevanz |
|---|-------|-----|--------|----------|
| Q-01 | `KREILE_PROJEKT_DOKUMENTATION/00_PROJEKTSTATUS_JUNI_2026.md` | Status | App ~30-35% fertig (Mai-Schätzung), Prisma→Drizzle Migration dokumentiert | Hoch |
| Q-02 | `docs/UEBERGABE_NAECHSTER_CHAT_2026-06-03.md` | Übergabe | Telefonnotiz DB-Fix post-Audit, Seed-Scripts nicht ausgeführt | Hoch |
| Q-03 | `docs/LIVEGANG_AUDIT_REPORT.md` | Audit | Früherer Audit: viele Module noch localStorage/Mock | Hoch |
| Q-04 | `ergänzungen/10_ADDON_WARNING_ENGINE.md` | Spec | Warning Engine vollständig spezifiziert | Hoch |
| Q-05 | `ergänzungen/SPEC_LICENSE_FEATURE_TOGGLES_v1.md` | Spec | 4-Tier-Lizenzmatrix (Basis/Pro/Premium/Enterprise) | Hoch |
| Q-06 | `SPEZIFIKATIONEN/06a_ADDON_KALKULATION_KI_FINANZCONTROLLING.md` | Spec | Kalkulations-/Pricing-Assistent, KI-gestützt | Hoch |
| Q-07 | `SPEZIFIKATIONEN/44_*UNIVERSAL_INTAKE*.md` | Spec | 4 Intake-Flows spezifiziert | Mittel |
| Q-08 | `SPEZIFIKATIONEN/WEBSITE_SPEC_v3.1.md` | Spec | Komplette Kreile-Website-Spec | Mittel |
| Q-09 | `03_SYSTEMPROMPT_PROJEKTARCHAEOLOGIE...md` | Meta | Persona-Prompt für diese Analyse | Meta |
| Q-10 | 87 weitere `.md`-Dateien in `SPEZIFIKATIONEN/`, `docs/`, `ergänzungen/` | Mixed | Diverse Feature-Specs, Changelog-Einträge, Notizen | Variabel |

**Gesamtumfang:** 96 Markdown-Dokumente (exkl. node_modules)

### 1.2 Code-Quellen

| Kategorie | Anzahl | Pfad |
|-----------|--------|------|
| Next.js Pages/Routes | 78 | `src/app/**/page.tsx` |
| API Routes | 18 | `src/app/api/**/route.ts` |
| DB-Schema-Dateien | 3 | `src/db/schema.ts`, `schema_buchhaltung.ts`, `schema_marketing.ts` |
| Drizzle-Migrationen | 70+ | `drizzle/migrations/` |
| Server Actions | ~25 | `src/app/actions/*.ts` |
| Repositories | ~15 | `src/lib/repositories/*.ts` |
| UI-Komponenten | ~120 | `src/components/**/*.tsx` |
| Styles | 2 Token-Systeme | `src/styles/ci-tokens.css`, `src/styles/tokens.css` |

### 1.3 Umgebungs- und Infrastrukturquellen

| Ressource | Status | Bemerkung |
|-----------|--------|-----------|
| `.env.local` | Vorhanden | `GEMINI_API_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `APP_SESSION_SECRET`, `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` gesetzt |
| Supabase-Projekt | Aktiv | 85 Tabellen, 55 mit RLS |
| Git-History | Nicht analysiert | Scope: statische Code-Analyse |
| Prisma (alt) | Deprecated | Erwähnt in Q-01, durch Drizzle ersetzt |

---

## 2. MASTER-FUNDLISTE

| Fund-ID | Thema | Quelle | Status | Modul | Problem / Potenzial | Empfehlung |
|---------|-------|--------|--------|-------|---------------------|------------|
| F-001 | Scan→Auftrag: handleConfirm ist Stub | `scan/page.tsx:16` | **KRITISCH** | Scan/Intake | `console.log()` statt DB-Write; false success UI | Server Action `createOrderFromScan()` einbauen — 2-4h |
| F-002 | OCR-URL Literal-Platzhalter | `api/ocr-process/route.ts:32` | **KRITISCH** | OCR/Buchhaltung | `"https://YOUR_SUPABASE_URL/..."` — nie aufgelöst | Ersetzen: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/...` |
| F-003 | Auth silent failure: 0 Daten ohne Session | Auth-Kette | **KRITISCH** | Auth/Alle Seiten | UNAUTHORIZED → `[]` → leere UI, kein Feedback | Redirect `/start` oder `SessionWarningBanner` |
| F-004 | customers.actions.ts: kein tenant_id-Filter | `actions/customers.actions.ts` | **KRITISCH** | Kunden | Gibt Daten ALLER Mandanten zurück | `where(eq(customers.tenantId, "galvanik-kreile"))` ergänzen |
| F-005 | Mollie: falscher Env-Var-Name | `api/payments/mollie/create/route.ts` | **HOCH** | Zahlungen | `SUPABASE_URL` nicht gesetzt, nur `NEXT_PUBLIC_SUPABASE_URL` | Env-Var korrigieren + Edge Function deployen |
| F-006 | 30 Tabellen ohne RLS | Supabase DB | **HOCH** | Sicherheit | Events, communications, marketing-Tabellen ungeschützt | RLS-Policies aktivieren, Priorität: events, communications, konto |
| F-007 | Warning Engine: Infra gebaut, Daten-Rules fehlen | `src/lib/warnings/` | **MITTEL** | Warnings | engine.ts, hooks.ts, ruleRegistry.ts, store.ts vorhanden — aber keine Live-Datenkopplung | Regel-Implementierungen in ruleRegistry ergänzen |
| F-008 | License System: gebaut, aber UI-Gates fehlen | `src/lib/license/resolveFeatures.ts` | **MITTEL** | Lizenz | resolveFeatures vollständig, aber keine UI nutzt Feature-Gates | `useFeatureFlag()`-Hook in Premium-Seiten einbauen |
| F-009 | Tote Seiten: /status, /today, /archive nutzen Mock | `ordersRepository`, `MockOrder` | **MITTEL** | Navigation | Seiten erreichbar, zeigen Fake-Daten | Auf `getOrdersDb()` migrieren oder aus Nav entfernen |
| F-010 | /print-queue nutzt ordersRepository (Mock) | `print-queue/page.tsx:7` | **MITTEL** | Drucken | Druckwarteschlange zeigt keine echten Aufträge | Auf DB-Abfrage migrieren |
| F-011 | Home: Fake-Zähler und hardcoded Mitarbeiternotizen | `app/page.tsx` | **MITTEL** | Dashboard | `orders.length > 0 ? orders.length : 84`, "M. Müller Urlaub..." | Echte Daten oder leeren State statt Fakes |
| F-012 | TopWorkflowBar: 3 von 5 Stationen | `TopWorkflowBar.tsx` | **MITTEL** | Navigation | Entmetallisierung + Schleiferei fehlen in der Leiste | Alle 5 VALID_SLUGS einbauen |
| F-013 | RightNav: Hover-Only, defekt auf Tablet | `RightNav.tsx` | **MITTEL** | Navigation/UX | mouseEnter/Leave → kein Touch-Support | Touch-Toggle oder feste Sidebar für ≥md |
| F-014 | RightNav: Cockpit + Analyse = gleicher Icon | `RightNav.tsx` | **NIEDRIG** | UX | BarChart3 doppelt verwendet | Eindeutige Icons je Seite |
| F-015 | Zwei parallele Token-Systeme | `ci-tokens.css`, `tokens.css` | **MITTEL** | Design-System | `--ci-*` und `--navy-/--accent-*` inkonsistent genutzt | Konsolidierung auf ci-tokens.css |
| F-016 | OrderWideCard: 8 Hardcoded Hex + JetBrains Mono | `OrderWideCard.tsx` | **MITTEL** | Design-System | dangerouslySetInnerHTML mit Rohfarben, Font nicht geladen | Token-Variablen statt Hardcodes |
| F-017 | Email: Template vorhanden, kein RESEND_API_KEY | `deliveryMailTemplate.ts` | **HOCH** | Kommunikation | Delivery-Mail kann nie versendet werden | RESEND_API_KEY beschaffen und setzen |
| F-018 | Kalkulations-/Pricing-Assistent: spec, nicht gebaut | `06a_ADDON_KALKULATION...md` | **HOCH** | Finanzen | Vollständig spezifiziert — kein Code vorhanden | Sprint-Planung: Kalkulation-MVP nach OCR-Fix |
| F-019 | Website kreile.de: spec v3.1, nicht gebaut | `WEBSITE_SPEC_v3.1.md` | **HOCH** | Marketing | Komplette Spec existiert — separates Projekt nötig | Eigenständiges Next.js-Projekt starten |
| F-020 | Marketing Studio: Schema vollständig, UI Mock | `schema_marketing.ts`, `/marketing/*` | **MITTEL** | Marketing | kampagne, kanal, segment, aktion, touchpoint, attribution — Tabellen leer, UI ohne echte Daten | Sekundäres Sprint-Ziel nach App-Stabilisierung |
| F-021 | Arbeitszeit-Buchung: Tabelle, keine UI | `schema.ts: arbeitszeit_buchung` | **NIEDRIG** | Betrieb | Tabelle im Schema, kein Formular, keine Auswertung | In KVP-/Betrieb-Module integrieren |
| F-022 | Zwei KVP-Seiten (kvp + betrieb-kvp), divergiert | `/kvp/`, `/betrieb-kvp/` | **MITTEL** | KVP | `/kvp` nutzt DEMO_ITEMS-Hardcodes; `/betrieb-kvp` nutzt echtes kvpRepository | `/kvp` auf kvpRepository migrieren oder entfernen |
| F-023 | Gemini AI: 3 aktive Nutzungsstellen | `aiSearch.ts`, `analyzePhoneNote.ts`, `geminiOcr.ts` | **POSITIV** | KI | API-Key gesetzt, Client vollständig mit Fallback | Erweitern: Kalkulations-Assistent, Risiko-Analyse |
| F-024 | Global Search: vollständig DB-backed, 10 Entitäten | `global-search-actions.ts` | **POSITIV** | Suche | Belege, Orders, Customers, Rechnungen, Lieferanten, Bäder, Lager, Kosten, Telefonnotizen, Zahlungen | Gut — Tenant-Filter prüfen |
| F-025 | Cockpit: 8 reale Kacheln + WhatIfStudio | `cockpit/components/` | **POSITIV** | Analytics | AgingKachel, EngpassKachel, ForecastKachel, TopKundenKachel, WhatIfStudio gebaut | Datenkopplung vertiefen, PlaceholderKachel ersetzen |
| F-026 | Jahresplan: vollständig DB-backed | `cockpit/jahresplan/` | **POSITIV** | Planung | `getAktiverJahresplan()`, `speichereJahresplan()` — funktioniert | — |
| F-027 | PWA Service Worker: nicht in Dev registriert | `service-worker.ts` | **NIEDRIG** | PWA | Offline-Outbox spezifiziert, SW deaktiviert in dev | Prüfen ob Production-Build SW korrekt registriert |
| F-028 | Hardcoded `galvanik-kreile` in appSession.ts | `src/lib/auth/appSession.ts` | **NIEDRIG** | Mandanten | Kein dynamisches Tenant-Lookup — bewusste Entscheidung oder Schuld? | Für jetziges Single-Tenant ok; Notiz für Multi-Tenant |
| F-029 | `forecast_version`-Tabelle: keine UI | DB-Schema | **NIEDRIG** | Forecast | Tabelle existiert, ForecastKachel im Cockpit — Verbindung unklar | ForecastKachel auf forecast_version-Tabelle prüfen |
| F-030 | Supabase Edge Function `mollie-create-payment`: nicht deployed | `mollie/create/route.ts` | **HOCH** | Zahlungen | Route ruft nicht-existierende Edge Function auf | Edge Function deployen oder Mollie direkt ansprechen |

---

## 3. VERLORENE ODER ÜBERSEHENE IDEEN

### 3.1 Vollständig spezifiziert, kein Code

**Kalkulations- und Pricing-Assistent** (Spec 06a)
Ein KI-gestützter Kalkulationsassistent für Galvanikleistungen: Bauteilparameter eingeben → automatische Kostenschätzung mit Badchemie-Verbrauch, Energiekosten, Rüstzeit → Angebotspreisvorschlag mit Deckungsbeitragslogik. Gemini-API ist bereits gesetzt. Das ist das umsatzstärkste ungebaute Feature — direkt auf tägliche Kernarbeit (Angebote erstellen) ausgerichtet.

**Kreile-Website** (Spec v3.1)
Komplette Marketing-Website für kreile.de mit Referenzen, Verfahrensdarstellung, Anfrage-Formular, Vertrauenssignalen. Als eigenständiges Next.js-Projekt konzipiert. Kein einziger Code-Commit erkennbar.

**Elster-Direktanbindung, DATEV-Export, Bankanbindung** (Lizenz-Spec)
Im Feature-Flag-System als `datev_export`, `bank_anbindung`, `elster_direkt` definiert — vollständig im Typ-System beschrieben, kein Implementierungsansatz vorhanden.

### 3.2 Spezifiziert, partiell begonnen, dann liegengelassen

**Universal Intake** (Spec 44, 4 Flows)
Vier Eingangsflüsse beschrieben: Telefon-Auftragsannahme, Scan-to-Order, Walk-In, E-Mail-Import. Scan-to-Order ist halbfertig (OCR läuft, DB-Write fehlt). Die anderen drei fehlen vollständig.

**Batch-Verarbeitung / Risikoklassen-Zuweisung via Gemini**
In frühen Specs erwähnt: automatische Dringlichkeitsbewertung von Aufträgen per KI. Die Risk-Logik existiert im Code (`o.risk === 'red'`), aber die Zuweisung ist manuell/statisch.

### 3.3 Gefundene Ideen ohne Spec-Abdeckung

**Zwei-KVP-System** — `/kvp` (Büro-/Digitalnotes) und `/betrieb-kvp` (Produktionsboden) wurden parallel entwickelt und divergierten. Eine gemeinsame KVP-Plattform mit Rollen-getrennten Ansichten wäre das richtige Ziel.

**OfflineManager + OfflineSyncBadge** — in mehreren Komponenten importiert (`KvpClient.tsx`, `BetriebKvpClient.tsx`). Offline-Strategie ist weiter als aus den Specs ersichtlich — wurde still eingebaut.

**FeedbackFooter** — Komponente existiert (`src/components/feedback/FeedbackFooter.tsx`), eingebunden in BetriebKvpClient. Kein Spec-Dokument gefunden. Origin unklar — vermutlich ad-hoc während Build entstanden.

---

## 4. UNVOLLSTÄNDIGE FUNKTIONEN

### Kritisch unterbrochene Flows (letzter Schritt fehlt)

| Funktion | Was gebaut ist | Was fehlt | Aufwand |
|----------|---------------|-----------|---------|
| **Scan → Auftrag** | OCR via Gemini, ReviewPanel, UI | DB-Write in `handleConfirm()` | 2-4h |
| **Beleg-OCR → Buchhaltung** | Upload-UI, Route, Klippa-/GeminiProvider | Korrekter Storage-URL, KLIPPA_API_KEY oder Gemini-Switch | 3-6h |
| **Delivery-Mail** | E-Mail-Template vollständig | RESEND_API_KEY in .env.local, Versand-Trigger | 1-2h |
| **Mollie-Zahlung** | Create-Route vorhanden | Korrekter Env-Var, Edge Function deployen | 4-8h |
| **Warning Engine Live-Rules** | Infra (engine, hooks, store, ruleRegistry) | Tatsächliche Daten-Queries je Regel | 8-16h |
| **Feature-Gates im UI** | resolveFeatures.ts, planMatrix | `useFeatureFlag()`-Aufruf in Premium-Seiten | 4-8h |

### Halbfertige Bereiche (Grundgerüst vorhanden, Tiefe fehlt)

| Bereich | Stand | Lücke |
|---------|-------|-------|
| **Marketing Studio** | Schema (8 Tabellen), Pages (/marketing/*) | Keine UI-Formulare für Dateneingabe, keine API-Routes |
| **Kommunikation/Communications** | Tabelle im Schema, Seite existiert | Messenger-Layout laut Demo-KVP-Eintrag noch nicht implementiert |
| **Arbeitszeit** | `arbeitszeit_buchung`-Tabelle | Kein Formular, keine Zeiterfassung-UI |
| **Forecast** | `forecast_version`-Tabelle, ForecastKachel | Verbindung Kachel↔Tabelle unklar |
| **Cockpit PlaceholderKachel** | Komponente existiert | Steht für unfertige Kacheln — welche, ist nicht dokumentiert |
| **Kontrolle/QS** | `/kontrolle`-Seite existiert | Nutzt Mock-Daten |

---

## 5. VERNETZUNGSMATRIX

Die Matrix zeigt, welche Module miteinander integriert sind (✅), nur teilweise (⚠️), oder gar nicht (❌).

| | Auth | DB/ORM | Gemini KI | Warning Engine | License | OCR | Events | Marketing |
|--|------|--------|-----------|---------------|---------|-----|--------|-----------|
| **Station-Workflow** | ✅ | ✅ | ❌ | ⚠️ keine Regeln | ❌ | ❌ | ✅ | ❌ |
| **Aufträge/Orders** | ✅ | ✅ | ❌ | ⚠️ | ❌ | ❌ | ✅ | ❌ |
| **Scan-to-Order** | ✅ | ⚠️ **DB-Write fehlt** | ✅ geminiOcr | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Buchhaltung/Belege** | ✅ | ✅ | ⚠️ url-broken | ❌ | ❌ | ⚠️ url-broken | ❌ | ❌ |
| **Kunden** | ✅ | ⚠️ **kein tenant filter** | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| **Cockpit/Analyse** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Global Search** | ✅ | ✅ 10 Entitäten | ✅ aiSearch | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Telefonnotizen** | ✅ | ✅ | ✅ analyzePhoneNote | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Marketing Studio** | ✅ | ⚠️ Schema only | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Zahlungen/Mollie** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **KVP (Betrieb)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **KVP (Büro)** | ✅ | ❌ **Demo-Daten** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Jahresplan** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Vernetzungs-Schlussfolgerung:** Das System ist intern gut strukturiert — Auth und ORM sind durchgängig. Die KI (Gemini) ist an 3 Stellen produktiv eingesetzt, könnte aber 5+ weitere Stellen bedienen. Warning Engine und License System sind vollständige Querschnittsmodule, die von keiner Seite aktiv konsumiert werden.

---

## 6. AUTOMATISIERTE UNTERNEHMENSFÜHRUNG

Bewertung: In welchem Ausmaß kann das System bereits autonom Unternehmensführungs-Entscheidungen unterstützen oder vorbereiten?

### Heute funktionsfähig

- **Event-Tracking:** 3.863 UI-Events + 58 Business-Events (ORDER_CREATED, STATION_EINGANG/AUSGANG) — Basis für Verhaltensanalyse vorhanden
- **Cockpit mit echten Datenkacheln:** AgingKachel, EngpassKachel, TopKundenKachel — lesen aus DB
- **Telefonnotiz-KI:** Gemini analysiert Anrufnotizen und extrahiert strukturierte Daten
- **Globale Suche:** 10 Entitätstypen durchsuchbar — Informationszugang ohne Navigation
- **Jahresplan:** Monatsziel-Setzung und Ist-Vergleich grundlegend vorhanden

### Spezifiziert, nicht gebaut

- **Automatische Dringlichkeitsbewertung:** Risk-Score vorhanden (`risk: 'red'`), Zuweisung aber manuell
- **Kalkulations-KI:** Angebotspreise aus Bauteilparametern + Badchemie-Daten — vollständig spezifiziert (06a), kein Code
- **Warning Engine Live-Regeln:** Architektur vollständig vorhanden — rules-Implementierungen fehlen
- **Forecast-Mechanismus:** Tabelle vorhanden, Kachel vorhanden — Berechnungslogik unklar
- **Marketing-Attribution:** 8 Marketing-Tabellen vollständig definiert — kein einziger Eintrag in DB

### Blockierende Voraussetzungen für echte Automatisierung

1. Auth-Feedback (F-003) — ohne Login kein Nutzer → keine personalisierten Benachrichtigungen
2. Warning Engine Daten-Rules (F-007) — Architektur fertig, nur Implementierungen fehlen
3. Kalkulations-Modul (F-018) — fehlt komplett, ist aber der direkteste Wertbeitrag für Chef

---

## 7. WIDERSPRÜCHE UND DUBLETTEN

### Technische Widersprüche

| # | Widerspruch | Dateien | Auflösung |
|---|-------------|---------|-----------|
| W-01 | Zwei Token-Systeme: `--ci-accent: #C2185B` (Magenta) vs. `--accent-orange` (Orange) | `ci-tokens.css` vs. `tokens.css` | ci-tokens.css ist das CI-Dokument — tokens.css ist Legacy; Konsolidierung nötig |
| W-02 | Zwei KVP-Seiten: `/kvp` (Demo-Daten) vs. `/betrieb-kvp` (echtes Repository) | `KvpClient.tsx` vs. `BetriebKvpClient.tsx` | betrieb-kvp ist canonical — /kvp migrieren oder redirecten |
| W-03 | Scan-UI zeigt Erfolg ohne DB-Write | `scan/page.tsx:handleConfirm()` | false success — DB-Write als Erfolgsbedingung einbauen |
| W-04 | `galvanik`-Slug in Texten/Doku vs. VALID_SLUGS ohne `galvanik` | `TopWorkflowBar.tsx`, Stations-Spec | VALID_SLUGS = Wahrheit. Alle Doku-Referenzen auf `beschichtung` korrigieren |
| W-05 | Env-Var `SUPABASE_URL` (server-only) vs. `NEXT_PUBLIC_SUPABASE_URL` | `mollie/create/route.ts` | Route liest nicht-existenten Var — Server-Side-Var separat setzen oder umschreiben |
| W-06 | Home zeigt `orders.length || 84` — fake Fallback in Production | `app/page.tsx` | Fake-Fallback entfernen; 0 ehrlich anzeigen |

### Konzeptuelle Dubletten

| # | Dublette | Empfehlung |
|---|----------|------------|
| D-01 | BarChart3-Icon für Cockpit **und** Analyse in RightNav | Eindeutige Icons pro Route |
| D-02 | `ordersRepository` (Mock) und `getOrdersDb()` (real) parallel | ordersRepository auf getOrdersDb() umleiten, dann deprecaten |
| D-03 | KVP-Formular in `/kvp` und `/betrieb-kvp` — identische Felder, unterschiedliche Backends | Zusammenführen mit Rollen-Filter |

---

## 8. NICHT ERREICHBARE ODER TOTE FUNKTIONEN

### Tote Seiten (erreichbar, aber Fake-Daten)

| Seite | Problem | Daten-Quelle | Fix |
|-------|---------|--------------|-----|
| `/status` | ordersRepository (Mock-Array) | `ordersRepository.getAll()` | → `getOrdersDb()` |
| `/today` | MockOrder, MockCustomer | Hardcoded Objekte | → echte DB-Queries |
| `/archive` | ordersRepository | `ordersRepository.getAll()` | → `getOrdersDb()` mit `status='abgeschlossen'` |
| `/kontrolle` | QS-Mock-Daten | Hardcoded | → Entscheidung: bauen oder aus Nav entfernen |
| `/print-queue` | ordersRepository | `ordersRepository.getAll()` | → `getOrdersDb()` |
| `/kvp` | DEMO_ITEMS-Array | Hardcoded DEMO_ITEMS | → kvpRepository |

### Broken-but-reached (erreichbar, aber Fehler im Flow)

| Flow | Letzter funktionierender Punkt | Bruchstelle |
|------|-------------------------------|-------------|
| Scan→Auftrag | OCR-Ergebnis-Review anzeigen | `handleConfirm()` → kein DB-Write |
| Beleg-OCR | Upload + Route-Aufruf | URL-Platzhalter → DNS-Fehler → ManualProvider |
| Mollie-Zahlung | POST /api/payments/mollie/create | Fehlender Env-Var → undefined URL → Fetch-Error |
| Delivery-Mail | Template-Rendering | Kein Resend-Key → Mail nie versendet |
| Station `galvanik` | Navigation-Click | 404 (kein gültiger Slug) |

### Tabellen ohne UI-Anbindung

| Tabelle | Schema | UI | Daten |
|---------|--------|----|-------|
| `arbeitszeit_buchung` | ✅ | ❌ | 0 |
| `forecast_version` | ✅ | ⚠️ (Kachel, Verbindung unklar) | ? |
| `kampagne`, `kanal`, `segment`, `aktion`, `touchpoint`, `attribution`, `lern_metrik`, `einwilligung` | ✅ | ❌ | 0 |
| `kommunikation`/`communications` | ✅ | ⚠️ (Seite existiert, UI unvollständig) | ? |
| `calendar_events` | ✅ | ❌ | ? |
| `price_agreements` | ✅ | ❌ | ? |

---

## 9. KONSOLIDIERTER BACKLOG

### MVP — Vor erstem echten Nutzertest (P0/P1)

| # | Task | Betroffene Datei(en) | Aufwand |
|---|------|--------------------|---------|
| M-01 | `handleConfirm()` → `createOrderFromScan()` Server Action | `scan/page.tsx` | 2-4h |
| M-02 | OCR-URL-Platzhalter ersetzen (`NEXT_PUBLIC_SUPABASE_URL`) | `api/ocr-process/route.ts` | 1h |
| M-03 | GeminiProvider als primären OCR-Provider aktivieren | `api/ocr-process/route.ts`, `geminiOcr.ts` | 3-5h |
| M-04 | Auth-Feedback einbauen (Redirect oder SessionWarningBanner) | Alle Server Actions | 2-4h |
| M-05 | `tenant_id`-Filter in `customers.actions.ts` | `actions/customers.actions.ts` | 0.5h |
| M-06 | Fake-Fallbacks aus `app/page.tsx` entfernen | `app/page.tsx` | 1h |
| M-07 | Global Search: Tenant-Filter prüfen und ergänzen | `global-search-actions.ts` | 1h |

**MVP-Gesamtaufwand: ~11-16h**

### Nächste Stufe — Sprint 1 (technische Schulden + Navigation)

| # | Task | Aufwand |
|---|------|---------|
| S1-01 | Tote Seiten auf getOrdersDb() migrieren (/status, /today, /archive, /print-queue) | 4-6h |
| S1-02 | TopWorkflowBar: alle 5 Stationen einbauen (Entmetallisierung + Schleiferei) | 1h |
| S1-03 | RightNav: Touch-Toggle für Tablet | 2-3h |
| S1-04 | RightNav: doppelten BarChart3-Icon fixen | 0.5h |
| S1-05 | /kvp: DEMO_ITEMS → kvpRepository, oder Redirect → /betrieb-kvp | 1-2h |
| S1-06 | Env-Var `SUPABASE_URL` (server-side) in .env.local ergänzen | 0.5h |
| S1-07 | RLS auf 30 fehlende Tabellen aktivieren (Priorität: events, communications, konto) | 4-8h |
| S1-08 | RESEND_API_KEY setzen und Delivery-Mail-Trigger einbauen | 2-3h |

### Nächste Stufe — Sprint 2 (Design-System + Warning Engine)

| # | Task | Aufwand |
|---|------|---------|
| S2-01 | Token-Systeme konsolidieren: ci-tokens.css als Quelle der Wahrheit | 3-5h |
| S2-02 | OrderWideCard: Hardcoded Hex → Token-Variablen | 2h |
| S2-03 | Warning Engine: Live-Data-Rules implementieren (3-5 Kernregeln) | 8-12h |
| S2-04 | Feature-Gates: `useFeatureFlag()` in Premium-Bereichen einbauen | 4-6h |
| S2-05 | ForecastKachel↔forecast_version-Tabelle verbinden | 2-4h |

### Nächste Stufe — Sprint 3 (Kalkulation + Zahlungen)

| # | Task | Aufwand |
|---|------|---------|
| S3-01 | Kalkulations-MVP: Bauteilparameter → Kostenschätzung (Gemini-gestützt) | 16-24h |
| S3-02 | Mollie: Env-Var fixen, Edge Function deployen | 4-8h |
| S3-03 | Angebotsworkflow: Kalkulation → Angebot → Auftrag | 12-20h |

### Später (nach Produktionsstabilität)

| # | Task |
|---|------|
| SP-01 | Marketing Studio: Eingabeformulare für kampagne, kanal, segment |
| SP-02 | Arbeitszeit-Buchung: Formular + Auswertung |
| SP-03 | Communications/Messenger-Layout |
| SP-04 | PWA-Service-Worker in Production testen |
| SP-05 | Calendar-Events-UI |

### Optional / Evaluieren

| # | Task | Vorbedingung |
|---|------|-------------|
| O-01 | Kreile-Website (Spec v3.1) | Eigenständiges Projekt, App muss stabil sein |
| O-02 | DATEV-Export | Buchhaltungsmodul vollständig |
| O-03 | Bankanbindung | Regulatorische Prüfung |
| O-04 | Elster-Direktanbindung | Steuerberater-Abstimmung |
| O-05 | Multi-Tenant-Ausbau | Weitere Kunden vorhanden |

### Verworfen

| # | Item | Grund |
|---|------|-------|
| V-01 | Prisma ORM | Durch Drizzle ersetzt (Q-01) |
| V-02 | localStorage-basierte Datenpersistenz | Durch DB-Server-Actions ersetzt |

### Zu klären (Entscheidungsbedarf)

| # | Frage | Kontext |
|---|-------|---------|
| Z-01 | Klippa OCR beschaffen oder dauerhaft Gemini als OCR? | KLIPPA_API_KEY fehlt; Gemini-Key vorhanden und ausreichend |
| Z-02 | `/kontrolle`-Seite: bauen oder aus Nav entfernen? | QS-Daten nicht spezifiziert genug |
| Z-03 | Marketing Studio: In App integriert oder als eigenes Tool? | 8 Tabellen, 0 Einträge, keine UI-Routes |
| Z-04 | Zwei KVP-Seiten: Zusammenführen oder entfernen? | betrieb-kvp ist canonical |

---

## 10. ABHÄNGIGKEITSPLAN

```
M-01 (Scan→DB) ──────────────────────────────────┐
M-02+M-03 (OCR-URL + GeminiProvider) ─────────────┤
M-04 (Auth-Feedback) ──────────────────────────────┤──→ Erster echter Nutzertest
M-05 (Tenant-Filter Kunden) ───────────────────────┤
M-06 (Fake-Fallbacks entfernen) ───────────────────┘

S1-07 (RLS) ──────────────────────────────────────────→ Datenschutz-Freigabe
S1-06 (Env-Var SUPABASE_URL) ─────────┐
S3-02 (Mollie Edge Function) ──────────┘──→ Zahlungsmodul aktiv

S2-01 (Token-Konsolidierung) ────────────────────────→ S2-02 (OrderWideCard)
S2-03 (Warning Rules) ────────────────────────────────→ S2-04 (Feature-Gates)

S3-01 (Kalkulations-MVP) ─────────────────────────────→ S3-03 (Angebotsworkflow)

[Alle MVP-Tasks] ──────────────────────────────────────→ O-01 (Website-Projekt)
```

### Kritischer Pfad bis Produktionsbetrieb

```
M-02 → M-03 → M-01 → M-04 → M-05 → S1-07 → Freigabe
(~3h)   (~4h)  (~3h)  (~3h)  (0.5h)  (~6h)   = ~20h Kernarbeit
```

---

## 11. ENTSCHEIDUNGSBEDARF

### Entscheidungen mit Blockierwirkung (sofort klären)

**E-01: Klippa OCR vs. Gemini OCR**
- Klippa: Speziallösung für Belegerkennung, KLIPPA_API_KEY fehlt, monatliche Kosten
- Gemini: API-Key vorhanden, generalistisch, kein Belegformat-Spezialisierung
- **Empfehlung:** Gemini als MVP-OCR (M-03), Klippa als spätere Option evaluieren
- **Entscheider:** Projektinhaber | **Deadline:** vor M-03

**E-02: `/kontrolle`-Seite — Scope definieren oder aus Navigation entfernen**
- QS-Daten (Ausschussquoten, Prüfprotokolle) sind nicht im DB-Schema vorhanden
- Bauen erfordert Schema-Erweiterung, neue Datenerfassung durch Mitarbeiter
- **Empfehlung:** Aus Primär-Navigation entfernen, später als eigenes Modul behandeln
- **Entscheider:** Inhaber (Franz Kreile) | **Deadline:** Sprint 1

**E-03: Marketing Studio — integriert oder separates Tool**
- 8 Tabellen sind Teil des App-Schemas → Schema-Trennung aufwändig
- Echter Marketingbedarf ist unklar (B2B-Galvanik, keine Endkundenwerbung)
- **Empfehlung:** Marketing-Tabellen vorerst einfrieren, keine neue UI-Entwicklung
- **Entscheider:** Inhaber | **Deadline:** Sprint 2

**E-04: Mollie-Zahlungsdienstleister — Vertrag vorhanden?**
- Route und Edge-Function-Aufruf existieren — Mollie-Account/API-Key?
- Falls kein Mollie-Vertrag: Feature-Flag deaktivieren bis Klärung
- **Entscheider:** Büro-MA (Buchhaltung) | **Deadline:** vor S3-02

### Entscheidungen ohne sofortige Blockierwirkung

**E-05: KVP-Konsolidierung**
Welche der beiden KVP-Seiten ist das Zielprodukt? betrieb-kvp (Produktionsboden, Rollen-Checkbox, echte DB) ist vollständiger — /kvp sollte redirecten.

**E-06: Arbeitszeit-Buchung**
Soll `arbeitszeit_buchung` für Stundenerfassung genutzt werden? Falls ja: wer erfasst, wie, und welche Auswertung ist gewünscht?

**E-07: Website-Projekt**
Kreile-Website (Spec v3.1) ist ein vollständiges eigenständiges Projekt. Wann soll es gestartet werden, und ist es dasselbe Projekt wie die App oder ein separates Deployment?

---

## GESAMTBEWERTUNG PROJEKTARCHÄOLOGIE

| Dimension | Bewertung | Kommentar |
|-----------|-----------|-----------|
| Infrastruktur-Reife | ⭐⭐⭐⭐ 4/5 | DB-Schema, Auth, Routing, Events — solide |
| Feature-Vollständigkeit | ⭐⭐ 2/5 | ~32% operativ nutzbar |
| Code-Qualität | ⭐⭐⭐ 3/5 | Gut strukturiert, aber Mock-Schulden und Typlücken |
| KI-Nutzung | ⭐⭐⭐ 3/5 | 3 Stellen produktiv, 5+ Stellen ungenutzt |
| Design-System-Konsistenz | ⭐⭐ 2/5 | Zwei Token-Systeme, Hardcoded Farben |
| Dokumentationsqualität | ⭐⭐⭐⭐ 4/5 | 96 MD-Dokumente, gut strukturiert |
| Umsetzbarkeit Restarbeit | ⭐⭐⭐⭐ 4/5 | Kritische Fixes sind klein (M-01 bis M-07: ~16h) |
| **Gesamtnote** | **⭐⭐⭐ 2.9/5** | Solide Basis, kritische Last-Mile-Gaps |

**Fazit:** Das Projekt ist gut konzipiert und substanziell gebaut — aber ein Muster von "letzter-Meile-Abbrüchen" verhindert operative Nutzbarkeit. Die gute Nachricht: Die kritischsten Lücken (M-01 bis M-07) kosten zusammen unter 20 Stunden und würden die App in einen echten Testbetrieb heben. Die größten ungenutzten Potenziale sind das Kalkulations-Modul (F-018) und die vollständig gebaute, aber unverschaltete Warning Engine (F-007).

---

*Archäologie durchgeführt: 2026-06-19*
*Methode: 7-Phasen-Analyse (Quellenerfassung, Codekartierung, Spezifikationsabgleich, Vernetzungsanalyse, Lückenkatalog, Backlog-Synthese, Entscheidungsformulierung)*
*Analysierte Quellen: 96 Markdown-Dokumente, 78 Pages, 18 API-Routes, 3 DB-Schemas, 85 Supabase-Tabellen, .env.local*

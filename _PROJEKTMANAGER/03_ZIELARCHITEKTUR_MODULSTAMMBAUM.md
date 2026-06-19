# 03 — ZIELARCHITEKTUR UND MODULSTAMMBAUM
## Kreile WerkstattCockpit

---

## 1. Leitidee: Stammbaum statt Seitensammlung

Das Ziel ist ein **stabiler Grundstamm** (Plattformkern) mit **modularen Ästen** (Fachmodule). Der Stamm darf sich nicht bei jedem neuen Ast verformen. Module dürfen den Stamm konsumieren, aber nicht in ihn hineinschreiben außer über definierte Verträge.

```
                              ┌─────────────────────────┐
                              │   PLATTFORMKERN (Stamm)  │
                              │  Auth · Tenant · Design  │
                              │  Navigation · Events     │
                              │  Suche · Feature-Flags   │
                              │  KI-Adapter · Offline    │
                              └────────────┬─────────────┘
                ┌───────────────┬──────────┼──────────┬───────────────┐
                │               │          │          │               │
        ┌───────▼──────┐ ┌──────▼─────┐ ┌──▼───────┐ ┌▼────────────┐ ┌▼─────────────┐
        │ Warendurchlauf│ │ Buchhaltung│ │ Kalkula- │ │ Kommuni-    │ │ Kunden/      │
        │ (Branchenpaket│ │            │ │ tion     │ │ kation      │ │ Aufträge     │
        │  galvanik-process)            │ │          │ │             │ │              │
        └───────────────┘ └────────────┘ └──────────┘ └─────────────┘ └──────────────┘
                │               │
        ┌───────▼──────┐ ┌──────▼─────┐
        │ Bäder/Lager   │ │ Lizenz/    │
        │ (Branchenpaket)│ │ Feature-   │
        │               │ │ System     │
        └───────────────┘ └────────────┘

                              ┌─────────────────────────┐
                              │  Cockpit/Analyse (Kern-  │
                              │  Shell + Modul-Kacheln)  │
                              └─────────────────────────┘

                  Später, nach Kern-Stabilisierung:
        ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐
        │ Marketing      │  │ KVP/Qualität  │  │ Branchenpaket #2   │
        │ Studio (frozen)│  │               │  │ (z. B. Lerninsel-  │
        │               │  │               │  │ Kern-Wiederverw.)  │
        └───────────────┘  └───────────────┘  └────────────────────┘
```

---

## 2. Plattformkern — Verträge

Diese Bereiche bleiben dauerhaft im Kern. Sie werden in Phase 1/2 stabilisiert, in Phase 7 formal vertraglich gefasst (Manifest-System) — aber bereits ab Phase 1 nach diesen Prinzipien gebaut, damit keine Nacharbeit entsteht.

| Kern-Bereich | Heutiger Stand | Zielvertrag |
|---|---|---|
| **Auth/Session** | Zwei parallele Systeme (Custom HMAC + Supabase Auth) | Ein kanonischer Provider: Custom HMAC-Cookie für PIN-Login (Werkstatt-Realität), Supabase Auth isoliert für Admin-/Entwicklerzugang. Kein Mischbetrieb im selben Flow. |
| **Mandantenfähigkeit** | `tenant_id` als Spalte vorhanden, aber `galvanik-kreile` teils hartkodiert, teils fehlender Filter | `tenant_id` immer aus Session gelesen, nie literal im Code (außer Konfigurationsdefault für Single-Tenant-Übergangszeit). Jede Query mit Tenant-Bezug MUSS den Filter führen. |
| **Designsystem** | Zwei Token-Systeme (`ci-tokens.css`, `tokens.css`) | `ci-tokens.css` ist einzige Quelle der Wahrheit. CI-Werte: Cream `#F1E9DC`, Navy `#1A1F2E`, Magenta `#C2185B`, Gradient `linear-gradient(115deg,#7A3FB0,#C2185B 38%,#F2643C 72%,#F6A93B)`, Fraunces (Zahlen/Beträge), Inter (UI-Text). |
| **Navigation** | Stationsnamen/Slugs hartkodiert in `TopWorkflowBar` | Mittelfristig (Phase 7) aus Konfiguration gerendert. Kurzfristig (Phase 1) bleibt Hardcode bestehen, aber korrekt und vollständig (alle 5 Stationen). |
| **Event-System** | `events`, `ui_events` — funktioniert, kein RLS, kein Schema-Versioning | RLS ergänzen (Phase 1). Versioniertes Event-Schema ist Phase 7-Thema. |
| **Feature-Flags/Lizenz** | `resolveFeatures.ts` vollständig gebaut, nicht verdrahtet | `useFeatureFlag()`-Hook in allen Premium-Bereichen ab Phase 2. Siehe `SPEC_LICENSE_FEATURE_TOGGLES_v1.md` als führende Spec. |
| **Globale Suche** | Funktioniert für 10 Entitäten, kein Tenant-Filter geprüft | Tenant-Filter verifizieren (Phase 1), Suchfelder erweitern um Auftragsbeschreibung/Fahrzeug (Phase 2, VS-10). |
| **KI-Adapter** | Zwei parallele Zugriffsmuster (`geminiClient.ts` + Direktzugriff in `ai-enrichment.actions.ts`) | Alle KI-Calls über einen zentralen Adapter routen. Modell-Abstraktion mit konfigurierbarem Modell-String (Vorbereitung für künftige Modellwechsel, vgl. QS-16) — eine Config-Zeile, kein Code-Umbau. |
| **Offline/Sync** | `OfflineManager`, `idbSync` konzipiert, unvollständig | Ausbau Phase 3 (Werkstattfluss muss bei WLAN-Lücken funktionieren). |

---

## 3. Fachmodule — Abgrenzung

Diese Bereiche sind branchenspezifisch und gehören NICHT in den Kern, dürfen den Kern aber über definierte Schnittstellen nutzen.

| Modul | Inhalt | Wiederverwendbarkeit |
|---|---|---|
| **Warendurchlauf** (`galvanik-process`) | Stationssequenz Wareneingang→Entmetallisierung→Schleiferei→Beschichtung→Warenausgang, Ampellogik, OrderItem-Tracking | Galvanik-spezifisch. Abstraktion `ProcessFlow` (Stationen, Übergaben, Events) ist generisch — wird perspektivisch als Vorlage für andere Werkstatt-/Praxis-Branchenpakete (z. B. künftige Kundenprojekte) nutzbar, aber NICHT vorzeitig generalisieren. |
| **Bäder/Lager** | Badregelkarte (Chemie, Messwerte, Grenzwerte), Lagerorte, Verbrauchsbuchung | Galvanik-spezifisch (Bäder), Lagerlogik selbst generisch. |
| **Buchhaltung** | Beleg-OCR, Rechnungen, DATEV/Lexware-Export | Eigenes Schema (`schema_buchhaltung.ts`) bereits getrennt — gut. Modulvertrag fehlt formal noch. |
| **Kalkulation/Pricing** | Bauteilparameter → Kostenschätzung (Badchemie, Energie, Rüstzeit) → Angebotspreis mit Deckungsbeitrag | Spezifiziert (Spec 06a laut QS-06), kein Code. Umsatzstärkstes ungebautes Feature. |
| **Kommunikation** | Telefonnotizen, Rückruf-Wiedervorlage, Kalender, E-Mail-Versand | Teilgebaut, Modul-Grenze zu `events`/`communications`-Tabelle unklar — klären in Phase 2. |
| **Kunden/Aufträge** | Kundenkartei (universelles `CustomerOverlay`/`CustomerTile`, vgl. QS-17), Auftragsverwaltung | Kern-naher Pflichtbereich, aber fachlich modular (Branchenfelder konfigurierbar). |
| **Lizenz/Feature-System** | 4-Tier-Matrix (Basis/Pro/Premium/Enterprise), Admin-Konsole, Demo-Modus | Vollständig generisch spezifiziert (QS-10/19) — Kern-Dienst, sofort aktivierbar. |
| **Cockpit/Analyse** | Kachel-Architektur (AgingKachel, EngpassKachel, ForecastKachel, TopKundenKachel, WhatIfStudio) | Kachel-Shell generisch, Kachel-Inhalte galvanik-spezifisch. Jedes Modul registriert eigene Kacheln (Zielbild Phase 7). |
| **KVP/Qualität** | Zwei parallele Implementierungen — Konsolidierung nötig | Nach Konsolidierung generisch (jede Werkstatt hat KVP-Bedarf). |
| **Marketing Studio** | 8 Tabellen, kein UI, 0 Einträge | Eingefroren (Entscheidung E-03, Dok. 11). B2B-Galvanik hat unklaren Marketingbedarf. |

---

## 4. Datenverträge (Kurzform — Detail in Dok. 05)

Kernentitäten gemäß `APP_Galvanik_Werkstatt_OS.md` (QS-15) und `01_projektanalyse.md` (QS-02):

```
Customer → CustomerAsset (Fahrzeug/Objekt) → Order → OrderItem → ItemPhoto
                                                    └→ StatusEvent (Stationswechsel)
                                                    └→ Location (Lagerort)
Order → Quote → QuoteLine
Order → CommunicationLog / Complaint
Order → ConsumableUse → InventoryItem
Order → WorkTimeLog
Bath → BathMeasurement → BathAddition
```

Diese Struktur ist bereits in `03_DATENMODELL_ARCHITEKTUR_BACKEND.md` (QS-13) vollständig typisiert (TypeScript-Interfaces vorhanden) und mit Postgres-Tabellenliste hinterlegt. Sie gilt als bestätigt und wird in Dok. 05 referenziert statt erneut definiert.

---

## 5. Events als Vertragsgrundlage

Jede relevante fachliche Handlung erzeugt ein Event: `StatusEvent`, `StockMovement`, `WorkTimeLog`, `ConsumableUse`, `BathMeasurement`, `ActionLog`. Aus diesen Rohdaten entstehen Durchlaufzeiten, Engpassanalysen, Nachkalkulation, Kundenhistorie, Performance-Kennzahlen — niemals aus direkt in der UI berechneten Werten (Prinzip A-07).

---

## 6. Migrationsstrategie Kern vs. Module

| Schritt | Wann | Risiko bei Überspringen |
|---|---|---|
| Kern stabilisieren (Auth, Tenant, Token, Feature-Flags) | Phase 1–2 | Jeder neue Kunde = Code-Fork |
| Modulgrenzen durch SQL-Views statt Direktzugriff erzwingen | Phase 2 (KPI-Views), Phase 7 (vollständig) | Schema-Kopplung verhindert spätere Modul-Trennung |
| Formales Modul-Manifest (`module.manifest.ts`) | Phase 7 | Externe Wartung/Erweiterung bleibt unmöglich |
| Branchenkonfiguration statt Hardcode (Stationsnamen etc.) | Phase 7 | Plattform bleibt Single-Branche für immer |
| Zweiter Mandant als Pilottest | Phase 7+ | Mandantenfähigkeit bleibt unbewiesene Behauptung |

**Wichtig:** Diese Reihenfolge ist absichtlich spät gestaffelt. Laut Konfliktregel (Dok. 01, Abschnitt „Plattformumbau gegen stabile Live-Funktion") wird die bestehende Funktion geschützt und schrittweise migriert — der aktuelle Go-live für Galvanik Kreile hat Vorrang vor Plattform-Generalisierung.

---

## 7. Wiederverwendbarkeit ohne Kundenfork — Leitplanken

1. Kein hartkodierter Kreile-Begriff im zukünftigen Plattformkern (sobald Kern extrahiert wird — nicht vor Stabilisierung).
2. Generische Verträge: `ProcessFlow`, `Entity-Registry` (Suche), `KIAdapter`, `WarningRule`-Engine — alle bereits in Grundzügen vorhanden oder spezifiziert.
3. Austauschbare Branchenpakete statt Parallelcode.
4. Wiederverwendbarkeit darf nie zu Lasten des aktuellen Kundennutzens gehen (Konfliktregel Dok. 01: „schlanke generische Lösung mit konkretem Kundennutzen").

---

## 8. Bezug zu anderen Siglinder-Projekten

Evas Lerninsel soll laut Projektgedächtnis ihren Kern-Template aus Galvanik extrahieren — **aber erst nach Stabilisierung**, nicht parallel. Hotel Revenue Intelligence bleibt vollständig getrennt (anderer Stack, anderer Tenant, andere Domäne) und wird in keinem Galvanik-Dokument referenziert oder vermischt.

---

*Dieses Dokument definiert das WIE der Modularität. Das WANN steht in Dok. 07.*

# 05 — DATENMODELL UND END-TO-END-VERTRÄGE
## Kreile WerkstattCockpit

---

## 1. Vernetzungskette (Pflichtnachweis je Feature)

```
Datenquelle → Datenmodell → SQL-View/Serverlogik → Repository → Server Action/API
  → Hook/State → Komponente → UI-Zustand → Benutzeraktion → Persistenz → Reload
  → Folgeprozess → Analyse
```

Eine Funktion gilt erst als `LIVE`, wenn jedes Glied dieser Kette nachgewiesen ist (siehe Statusdefinition, Dok. 07). Diese Kette ist der Maßstab, an dem die zwei P0-Befunde (Scan→Auftrag, OCR→Buchhaltung) gescheitert sind: Sie brechen exakt einen Schritt vor der Persistenz ab.

---

## 2. Kernentitäten (konsolidiert aus QS-02, QS-13, QS-15)

| Entität | Zweck | Schlüsselbeziehungen |
|---|---|---|
| `Customer` | Kunde (Privat/Gewerblich) | 1:n `Order`, 1:n `CustomerAsset` |
| `CustomerAsset` | Fahrzeug/Objekt/Sammlerstück | n:1 `Customer` |
| `Order` | Hauptauftrag, Status, Priorität, Risikofarbe, Fälligkeit, KV-Daten | 1:n `OrderItem`, 1:n `Quote`, 1:n `CommunicationLog`, 1:n `Complaint` |
| `OrderItem` | Einzelnes Teil (Material, Altbeschichtung, Zieloberfläche, Zustand, Lagerort) | n:1 `Order`, 1:n `ItemPhoto`, n:1 `Location` |
| `ItemPhoto` | Bilddokumentation (Eingang/Schaden/Zwischenstand/Ende) | n:1 `OrderItem` |
| `Location` | Lagerort (z. B. `L-SCH-R2-F4`) | 1:n `OrderItem` |
| `StatusEvent` | Protokoll von Status-/Lagerortänderungen | n:1 `Order` oder `OrderItem` |
| `Quote` / `QuoteLine` | Kostenvoranschlag, manuelle Positionen | n:1 `Order` |
| `CommunicationLog` | E-Mails, Telefonnotizen, Zusagen | n:1 `Order` oder `Customer` |
| `Complaint` | Reklamation/Nacharbeit | n:1 `Order` |
| `Bath` | Galvanikbad (Verfahrenstyp, Status, Zielwerte) | 1:n `BathMeasurement`, 1:n `BathAddition` |
| `BathMeasurement` | Messwert (Temperatur, pH, Konzentration) | n:1 `Bath` |
| `BathAddition` | Chemiezugabe | n:1 `Bath` |
| `InventoryItem` | Artikelstamm (Lager/Verbrauchsmaterial) | 1:n `ConsumableUse`, 1:n `StockMovement` |
| `ConsumableUse` | Verbrauchsbuchung je Auftrag/Station | n:1 `Order`, n:1 `InventoryItem` |
| `WorkTimeLog` | Arbeitszeitbuchung je Station/Tätigkeit | n:1 `Order`, n:1 `Station` |
| `StockMovement` | Lagerbewegung | n:1 `InventoryItem` |

Vollständige TypeScript-Interfaces für diese Entitäten liegen bereits in `03_DATENMODELL_ARCHITEKTUR_BACKEND.md` (QS-13) vor und sind als bestätigt zu übernehmen — keine Neudefinition in den Bauprompts, nur Referenzierung.

---

## 3. Rollenmodell

```ts
type UserRole =
  | "admin"     // Vollzugriff
  | "meister"   // Aufträge, Preise, Badkarte, Verbrauch, Performance
  | "office"    // Kunden, Aufträge, Kommunikation, Versand
  | "workshop"  // Stationen, Fotos, Verbrauch, Status
  | "quality"   // Qualitätskontrolle, Nacharbeit
  | "viewer";   // nur lesen
```

Zusätzlich (Lizenzsystem, QS-10): `anbieter_admin` für die Admin-Konsole — separat geschützt, 2FA-Pflicht, eigener Navigationsbereich `/admin/workshops`.

---

## 4. Modulweise Datenverträge

### 4.1 Kunden/Aufträge

| Aspekt | Vertrag |
|---|---|
| Tabellen | `customers`, `orders`, `order_items`, `item_photos`, `locations`, `status_events` |
| Views | `v_kunden_uebersicht`, `v_auftrag_status_aktuell` (KPI-Berechnung ausschließlich hier, nicht in React) |
| Server Actions | `customers.actions.ts` (MUSS `tenant_id`-Filter führen), `orders.actions.ts` |
| Komponenten | Genau eine `CustomerOverlay.tsx`, eine `CustomerTile.tsx`, eine `OrderOverlay.tsx`, eine `OrderWideCard.tsx` — keine Duplikate (Prinzip aus QS-17) |
| UI-Zustände | Loading/Empty-Auth/Empty-Data/Error/Data (siehe Dok. 04 Abschnitt 6) |
| Folgeprozess | Status-Update löst `StatusEvent` aus, das wiederum Engpass-/Durchlaufzeit-Views speist |
| Analytics | Aging, Termintreue, Kunden-LTV — aus Views, nicht Komponenten |
| Rollen/Datenschutz | RLS-Policy: `tenant_id = current_setting('app.tenant_id')` |

**CustomerOverlay-Akzeptanzkriterien (vollständig aus QS-17 übernommen, gelten unverändert):**
1. Genau eine `CustomerTile.tsx` und eine `CustomerOverlay.tsx` in der gesamten Codebase.
2. Klick auf Kundenname an jeder Trigger-Stelle öffnet identisch dieses Overlay.
3. Alle KPIs klickbar, Drill-Down als Sub-Overlay mit echten Daten.
4. Offene-Posten-Drill-Down hat Button „Erinnerung senden" pro Zeile.
5. Stammdaten-Felder inline editierbar, Persistenz nach Supabase.
6. Aufträge-Liste (aktiv + abgeschlossen), Klick öffnet OrderOverlay (LIFO-Stack).
7. Zahlungsliste mit Status, „offen" → Erinnerungsaktion.
8. Kommunikationshistorie mergt `communication_messages`, `phone_notes`, `events`, `payments`.
9. Quick Action „Neuer Auftrag" mit vorausgefülltem `customer_id`.
10. Tags als JSONB, editierbar als Chips.
11. Keine Mock-Daten, kein `Math.random`.
12. CI-Tokens durchgehend.
13. LIFO-Stack-Navigation: CustomerOverlay → OrderOverlay → ItemDrawer, ESC funktioniert.
14. Automatische Erinnerungs-Trigger schlagen vor, senden nicht automatisch.

### 4.2 Warendurchlauf/Stationen

| Aspekt | Vertrag |
|---|---|
| Tabellen | `orders`, `order_items`, `status_events`, `stations` (implizit via VALID_SLUGS) |
| Konfiguration | `VALID_SLUGS = ["wareneingang","entmetallisierung","schleiferei","beschichtung","warenausgang"]` — Wahrheit, alle Doku-Referenzen müssen damit übereinstimmen |
| Views | `v_station_health` (StationHealth-Typ aus QS-13: status, waitingItems, activeItems, criticalOrders, mainReason) |
| Folgeprozess | Stationswechsel erzeugt `StatusEvent` mit `STATION_EINGANG`/`STATION_AUSGANG` |

### 4.3 Bäder/Lager

| Aspekt | Vertrag |
|---|---|
| Tabellen | `baths`, `bath_measurements`, `bath_additions`, `inventory_items`, `storage_locations`, `stock_movements`, `consumable_uses` |
| Pflichtfeld-Korrektur | `inventory_items.einkaufspreis_eur` und `inventory_items.tenant_id` (laut Projektgedächtnis bereits gepatcht — Status verifizieren in Phase 1) |
| Folgeprozess | `BathMeasurement` setzt `Bath.status` (stable/watch/critical/blocked) — keine manuelle Statuspflege ohne Messung |

### 4.4 Buchhaltung

| Aspekt | Vertrag |
|---|---|
| Tabellen | `beleg`, `ausgangsrechnung`, `ausgangsrechnung_position`, `konto`, `payments` |
| Bekannter Fix | `ausgangsrechnung` ohne `order_id`-FK war Datenfehler — laut Projektgedächtnis in Spec 39 Phase A bereits gepatcht, in Phase 1 zu verifizieren |
| OCR-Pfad | `api/ocr-process/route.ts` → korrekte Storage-URL (F-002) → GeminiProvider (Phase 1) |
| Export | DATEV EXTF (Windows-1252-Encoding zwingend), Lexware, ZUGFeRD/XRechnung — Phase 4+ |

### 4.5 Kalkulation (neu zu bauen)

| Aspekt | Vertrag |
|---|---|
| Eingabe | Bauteilparameter (Material, Maße, Zieloberfläche, Verfahren) |
| Logik | Badchemie-Verbrauch + Energiekosten + Rüstzeit → Kostenschätzung → Deckungsbeitrags-Aufschlag → Angebotspreisvorschlag |
| KI-Einsatz | Gemini für Parametererkennung/Plausibilisierung, niemals für die eigentliche Preisberechnung (die bleibt deterministische Formel/View) |
| Output | Vorschlag editierbar, fließt in `QuoteLine` |

### 4.6 Lizenz-/Feature-System

Vollständig spezifiziert in `SPEC_LICENSE_FEATURE_TOGGLES_v1.md` (QS-10/19) — diese Spec gilt unverändert als Datenvertrag:

```
LicensePlan, FeatureFlag, FeatureOverride, LicenseAuditEntry (append-only)
resolveFeatures(plan, readiness) → einzige Quelle der Wahrheit
useFeatureFlag(key) → einziger UI-Zugriffspunkt, kein "if (tier === 'premium')" im JSX
```

Downgrade-Regel: Daten bleiben immer erhalten, nur Sicht/Auswertung wird gesperrt. Mitarbeiter-Rollen sehen nie Plan-/Tarifinformationen.

---

## 5. Live-Data-Policy (technische Durchsetzung)

- Kein `Math.random` im Produktionspfad — bekannte Verstöße: `buchhaltung/analysis.actions.ts` (laut QS-18, separater Bereinigungszyklus vorgemerkt).
- NULL-Werte zeigen „Noch keine Daten erfasst" + Aktionslink — nie 0 oder erfundene Zahl als Fallback.
- Seed-Daten sind für Demo-Modus zulässig (vgl. Lizenzsystem-Demo, QS-10), Mock-Provider im Produktionspfad sind es nicht.
- Jede KPI-Berechnung erfolgt in SQL-Views (`v_analyse_*`-Namenspräfix laut QS-18), niemals inline in React.

---

## 6. KPI-Rohdaten-Referenztabelle (aus QS-18 übernommen, weiterhin gültig)

| KPI | Berechenbar aus | Einschränkung |
|---|---|---|
| Durchlaufzeit gesamt | `orders.created_at → completed_date` | nur bei abgeschlossenen Aufträgen |
| Durchlaufzeit pro Station | `events` STATION_EINGANG → STATION_AUSGANG | noch wenig Daten |
| Termintreue | `completed_date <= promised_due_date` | nur wo beide gesetzt |
| Umsatz | `SUM(ausgangsrechnung.brutto_eur)` | nur bei erstellten Rechnungen |
| Deckungsbeitrag | `orders.db_ist` oder Berechnung aus Items/Consumables/Arbeitszeit | `db_ist` oft NULL |
| Offene Zahlungen | `payments WHERE status != 'succeeded'` | — |
| Kunden-LTV | `SUM(ausgangsrechnung.brutto_eur) GROUP BY customer_id` | — |
| Reklamationsquote | `COUNT(complaints) / COUNT(orders abgeschlossen)` | — |
| Stau/Engpass | `items GROUP BY current_station_id` | — |
| Mitarbeiter-Auslastung | `arbeitszeit_buchung GROUP BY employee_id` | kein UI bisher (F-021) |
| Vorjahresvergleich | historische `orders` <12 Monate | erst bei ausreichender Datenmenge, sonst `kpi_snapshots`-Tabelle nutzen |

---

## 7. Datenschutz und Rollen je Modul

| Modul | RLS-Policy-Grundsatz |
|---|---|
| Alle tenant-gebundenen Tabellen | `tenant_id = current_setting('app.tenant_id')` |
| `events`, `communications` | Priorität für RLS-Nachrüstung (Phase 1) |
| Lizenz/Admin-Konsole | Zugriff ausschließlich `anbieter_admin`, 2FA |
| Personenbezogene Daten (Kunden) | DSGVO-Auskunft (Art. 15) und Datenübertragbarkeit (Art. 20) — Exportformat fehlt aktuell (QS-09 Punkt 3), Phase 7 |

---

*Dieses Dokument ist die Referenz für jeden Bauprompt in Dok. 08 — jeder Prompt muss seine betroffenen Verträge aus diesem Dokument zitieren.*

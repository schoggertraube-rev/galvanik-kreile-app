# Patch 09a — Beschichtung, Stationswechsel, Kosten-Erfassung

> **Status: VERBINDLICH. Patch zu 09_ABSCHLUSSPLAN_DEMO_KREILE.md.**
> **Ablage:** `docs/antigravity/kreile-workshop-app/09a_PATCH_BESCHICHTUNG_STATIONSWECHSEL.md`
> **Antigravity liest:** 09a (diese Datei) direkt nach 09. Bei Konflikt mit 09 zählt 09a.

---

## 1. Bestätigte Entscheidungen aus Klärungsrunde

| # | Frage | Entscheidung |
|---|---|---|
| 1 | Stationsname für Veredelungs-Station | Slug **`beschichtung`**, Anzeige **„Beschichtung (Galvanik)"** |
| 2 | Werkstattfluss-Reihenfolge | Wareneingang → Entmetallisierung → Schleiferei → **Beschichtung** → Warenausgang |
| 3 | Verhalten „Station abschließen" | Modal mit Material- und Zeit-Erfassung + Kostenanzeige, danach automatisch in nächste Station |

---

## 2. Konsequenz für Slug-Migration (Session 1)

Überall, wo bisher `galvanik` als Slug geplant war, wird daraus `beschichtung`.

**Konkrete Stellen, die Antigravity anpassen muss:**

| Datei | Änderung |
|---|---|
| `src/constants/stations.ts` | Eintrag `galvanik` umbenennen auf `id: "beschichtung"`, `label: "Beschichtung (Galvanik)"`, `slug: "beschichtung"` |
| `src/app/station/[slug]/page.tsx` | Whitelist: `["wareneingang", "entmetallisierung", "schleiferei", "beschichtung", "warenausgang"]` |
| `src/lib/mockData.ts` | Alle `currentStationId: "galvanik"` → `currentStationId: "beschichtung"` |
| `Topbar.tsx` | Stations-Buttons: Beschriftung „Beschichtung" (kompakt für Topbar, voller Name als Tooltip) |
| alle bestehenden Repository-Mocks | `galvanik` → `beschichtung` per Suche/Ersetzen |

**Migration nicht aus 08_…:** In Datei 08 §2 stand noch `galvanik` als Slug. Dieser Patch ersetzt diesen Wert. Antigravity orientiert sich an 09a, nicht an 08.

---

## 3. Detail-Spezifikation: „Station abschließen"-Modal

Diese Aufgabe ersetzt die alte Aufgabe 2 in §2 Session 2 von Datei 09.

### 3.1. Trigger

Button „Station abschließen" im `OrderActionGrid` (`src/components/orders/OrderActionGrid.tsx`).

### 3.2. Flow

```text
Klick „Station abschließen"
  → Prüfung: Existiert für (orderId, currentStationId) bereits ein
              consumableUse + workTimeLog Eintrag?

  Fall A: NEIN (nichts gebucht)
    → Modal „Stationsabschluss <Stationsname>" öffnet
    → Tab 1: Arbeitszeit + Material
    → Tab 2: Kostenübersicht (live aktualisiert)
    → CTA: „Abschließen und zu <Nächste Station>"

  Fall B: JA (bereits gebucht)
    → Modal zeigt Zusammenfassung der gebuchten Werte
    → Option „Nachbuchen" (öffnet Tab 1 zum Ergänzen)
    → CTA: „Abschließen und zu <Nächste Station>"

  Nach Bestätigung:
    → consumableUses + workTimeLog persistieren (falls neu)
    → eventsRepository: STATION_COMPLETED
    → ordersRepository: currentStationId = nächste Station
    → eventsRepository: STATION_STARTED (für neue Station)
    → ggf. status anpassen (z.B. ready_shipping wenn warenausgang erreicht)
    → Toast „Auftrag <Nr.> jetzt in <neue Station>"
    → Modal schließt
```

### 3.3. Modal-Aufbau

**Header:**
```
Stationsabschluss · Schleiferei
Auftrag A-2026-0042 · Stoßstangen vernickeln
```

**Tab 1: Erfassung**

```
ARBEITSZEIT
[ - ]  90 Minuten  [ + ]   per Slider / Stepper
Tätigkeit: [Dropdown: Schleifen | Polieren | Setup | Sonstiges]
Bemerkung (optional): [Textfeld]

MATERIALVERBRAUCH
+ Schleifpapier P240    [ - ]  3 Stück   [ + ]   × 0.80 € = 2.40 €
+ Polierscheibe Filz    [ - ]  1 Stück   [ + ]   × 4.50 € = 4.50 €
+ Bürste Messing        [ - ]  1 Stück   [ + ]   × 6.20 € = 6.20 €
[ + Material hinzufügen ]   (öffnet Dropdown aus inventory)
```

**Tab 2: Kostenübersicht (live)**

```
Arbeitszeit       90 min × 75 €/h    = 112.50 €
Material          3 Positionen        =  13.10 €
─────────────────────────────────────────────────
Gesamtkosten Station Schleiferei      = 125.60 €

(Kumuliert über alle bisherigen Stationen: 247.30 €)
```

**Footer:**
```
[Abbrechen]   [Abschließen und zu Beschichtung ›]
```

### 3.4. Datenmodell-Ergänzungen

**Neu auf `InventoryItem`:**
```ts
type InventoryItem = {
  // ...vorhandene Felder
  pricePerUnit?: number;  // in EUR, Nettopreis
};
```

**Neu — Konfigurations-Konstante:**
```ts
// src/constants/pricing.ts
export const DEFAULT_HOURLY_RATE_EUR = 75;
// Später in /settings konfigurierbar. Erstmal global.
```

**Berechnungsfunktion:**
```ts
// src/lib/costs/stationCost.ts
export function computeStationCost(
  workTimeLogs: WorkTimeLog[],
  consumableUses: ConsumableUse[],
  inventoryItems: InventoryItem[],
  hourlyRate = DEFAULT_HOURLY_RATE_EUR
): { laborCost: number; materialCost: number; total: number } {
  const laborMinutes = workTimeLogs.reduce(
    (sum, w) => sum + (w.netMinutes ?? w.minutes ?? 0), 0
  );
  const laborCost = (laborMinutes / 60) * hourlyRate;

  const materialCost = consumableUses.reduce((sum, use) => {
    const item = inventoryItems.find(i => i.id === use.inventoryItemId);
    const unitPrice = item?.pricePerUnit ?? 0;
    return sum + use.quantity * unitPrice;
  }, 0);

  return {
    laborCost: round2(laborCost),
    materialCost: round2(materialCost),
    total: round2(laborCost + materialCost)
  };
}
```

### 3.5. Nächste-Station-Logik

```ts
// src/lib/stations/nextStation.ts
const FLOW = ["wareneingang", "entmetallisierung", "schleiferei", "beschichtung", "warenausgang"] as const;

export function getNextStation(currentSlug: string): string | null {
  const idx = FLOW.indexOf(currentSlug as typeof FLOW[number]);
  if (idx === -1 || idx === FLOW.length - 1) return null;
  return FLOW[idx + 1];
}
```

Bei `getNextStation() === null` (Warenausgang erreicht):
- `order.status = "shipped"` (oder `ready_shipping`, je nachdem ob Versand-Modul folgt)
- Modal zeigt CTA „Auftrag abschließen" statt „zu nächster Station"

### 3.6. Mockdaten-Auswirkung (für Session 3)

In `mockData.ts` muss `pricePerUnit` an alle Lagerartikel:

| Artikel | Preis EUR |
|---|---|
| Schleifpapier P240 | 0.80 |
| Schleifpapier P400 | 0.95 |
| Polierscheibe Filz | 4.50 |
| Polierscheibe Baumwolle | 3.20 |
| Bürste Messing | 6.20 |
| Bürste Stahl | 7.40 |
| Nickelzusatz Typ X | 18.00 / Liter |
| Entfetter Universal | 9.50 / Liter |
| Karton A4 | 1.20 |
| Schutzfolie Rolle | 0.15 / Meter |

Diese Werte sind Demo-Plausibilität. Echte Kreile-Preise erst in V2.

### 3.7. Edge Cases

| Fall | Verhalten |
|---|---|
| Stunden = 0 und kein Material | CTA disabled, Hinweis „Mindestens Arbeitszeit oder Material erfassen" |
| InventoryItem ohne `pricePerUnit` | Position erscheint, Kosten = 0, kleines „⚠ Preis fehlt" Icon |
| Warenausgang abgeschlossen | Modal-CTA = „Auftrag versendet markieren", danach Status `shipped` |
| Nutzer drückt Abbrechen | Keine Persistierung, Auftrag bleibt in aktueller Station |
| Bereits gebucht und Nutzer ergänzt | Neue Einträge werden hinzugefügt, nicht überschrieben |

---

## 4. Aktualisierte Session-2-Aufgabenliste

Die ursprüngliche Liste in 09 §2 Session 2 wird durch diese ersetzt:

1. **„Station starten":** Bestehende Aufgabe wie in 09 — Modal mit Dropdown, schreibt `STATION_STARTED`.
2. **„Station abschließen":** komplett nach §3 dieses Patches. Größte Einzelaufgabe der Session.
3. **„Foto aufnehmen":** wie in 09 — `<input type="file" accept="image/*" capture="environment" />`, base64, max. 200 KB nach Kompression.
4. **„Kunde anrufen":** `<a href="tel:{phone}">` oder disabled.
5. **„Weitere"-Dropdown:** Nacharbeit starten / Auftrag schließen / Auftrag stornieren.
6. **Heute-Button-Status dynamisch** wie in 09.
7. **`StatusEventType` Union** wie in 09 — ergänzt um `COSTS_BOOKED` als neuen Event-Typ.
8. **`priority.ts` dynamisch** wie in 09.
9. **`pricePerUnit` zu `InventoryItem`** + Werte in Mock.
10. **`computeStationCost` + `getNextStation`** Helper-Funktionen.
11. **Tote Buttons disablen** wie in 09.

**Geschätzter Aufwand neu:** 3–4 h statt 2–3 h. Session 2 wird die größte.

---

## 5. Aktualisierter Session-1-Prompt (kopierfertig)

```text
Session 1 — Routen-Stabilisierung Kreile WerkstattCockpit.

Lies zuerst in dieser Reihenfolge:
1. docs/antigravity/kreile-workshop-app/09a_PATCH_BESCHICHTUNG_STATIONSWECHSEL.md  (Slugs, Patch zu 09)
2. docs/antigravity/kreile-workshop-app/09_ABSCHLUSSPLAN_DEMO_KREILE.md            (§2 Session 1)

Erstelle Branch feat/session-1-routen-stabil. Zeige vor jeder Dateioperation git status.

Aufgaben:

1. src/app/today/page.tsx erstellen — eigenständige Seite mit gleicher Leitstand-Logik wie src/app/page.tsx, vorgefiltert auf Aufträge, deren dueDate heute fällig oder bereits überfällig ist.

2. src/app/settings/page.tsx — Platzhalter mit 3 disabled Sektionen: Mein Profil, Benachrichtigungen, Werkstattdaten. Oben Hinweis-Banner: "Einstellungen sind in Vorbereitung."

3. src/app/archive/page.tsx — Liste abgeschlossener Aufträge aus Mockdaten (Status closed).

4. src/app/station/[slug]/page.tsx — generische Stationsseite:
   - Whitelist: wareneingang, entmetallisierung, schleiferei, beschichtung, warenausgang
   - Bei unbekanntem Slug: Next.js notFound()
   - Filtert Mockaufträge nach currentStationId === slug
   - Layout wie /orders/page.tsx, aber vorgefiltert

5. src/middleware.ts erstellen. Importiere proxy.ts. Wenn Supabase-ENVs fehlen: NextResponse.next() statt zu werfen.

6. Topbar.tsx: Heute-Button als <Link href="/today">. Stationsname "Beschichtung" mit Tooltip "Beschichtung (Galvanik)".

7. SLUG-MIGRATION: Alle Vorkommen von "galvanik" als Stations-Slug systematisch ersetzen durch "beschichtung":
   - src/constants/stations.ts
   - src/lib/mockData.ts (currentStationId)
   - alle weiteren Repository-/Mock-Dateien
   - Anzeigename überall: "Beschichtung (Galvanik)" oder kompakt "Beschichtung"

8. IntakeCompletionSummary — Link auf /today funktioniert jetzt.

Constraints:
- Kein Supabase, keine OCR, kein TanStack Query, kein neuer Stack
- Mockdaten und bestehende Repositories unverändert in der Logik, nur Slug-Umbenennung
- Nach jedem Schritt: npm run typecheck && npm run lint, beides 0 Fehler

Am Ende:
- git diff --stat
- Liste aller geänderten und neuen Dateien
- Manueller Test: klicke alle Sidebar- und Topbar-Links durch. Kein 404. Stations-Tabs öffnen vorgefilterte Listen.
- Notiere alle Beobachtungen und offene Probleme.
```

---

## 6. Was du jetzt tun musst

1. **Datei 09a** in `docs/antigravity/kreile-workshop-app/` ablegen (zusammen mit 09 und 08).
2. **Session-1-Prompt** aus §5 kopieren und in Antigravity einfügen.
3. **Nach Session 1:** zurückkommen, Ergebnis berichten. Ich erstelle dann den finalisierten Session-2-Prompt (der wird wegen der Kosten-Logik länger).

Restliche Klärungen (Demo-Nutzer, QR-Inhalt, Teile-Schwerpunkt) bleiben für vor Session 3 offen. Nicht jetzt nötig.

Ende.

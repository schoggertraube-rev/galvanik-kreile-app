# Performance-Cockpit — Spezifikation
Kreile WerkstattCockpit · Stand 2026-06-01

Diese Datei ist die verbindliche Referenz. Die Antigravity-Prompts (Datei `02_ANTIGRAVITY_BAUPLAN.md`) verweisen auf die Abschnitte hier.

---

## 1. Ziel

Chef-Cockpit. In 5 Sekunden erkennbar: läuft es gut, wo brennt es. Prägnante Übersicht, Tiefe erst beim Anklicken. Edel, nicht verspielt-kindisch, nahtlos zum Rest der App (nur Hintergrundfarbe + Kachelabrundung müssen exakt passen, Rest darf abweichen). Dark/Hell umschaltbar nach Nutzerpräferenz.

## 2. Designprinzipien (verbindlich)

| Prinzip | Regel |
|---|---|
| Schlanke Hotzone | Wenige, prägnante KPIs ohne Scrollen. Keine Reizüberflutung. |
| Tiefe per Klick | Details ausführlich im Vollbild-Overlay (unscharfer Hintergrund), nicht auf der Übersicht. |
| Ampel nur bei Bedarf | Rot/Gelb nur bei echtem Handlungsbedarf, sonst neutral. |
| Beide Themes lesbar | JEDES Label erfüllt WCAG-AA (4.5:1) in Dark UND Hell. Kein hellgrauer Text auf Cream. |
| Selbst-integrierend | Neue Bäder, Metalle, Kacheln, Module erscheinen automatisch im Layout — datengetrieben, kein Hardcoding. |
| Lebende Daten | Live-Preise mit „Stand HH:MM"-Stempel und Datenherkunft. |

## 3. Theme-System (Abschnitt für WP-1)

- ALLE Farben ausschließlich über CSS-Design-Tokens. Kein hartkodiertes Hex in Komponenten.
- Token-Set (Beispielnamen, an bestehende Konvention anpassen):
  `--bg, --surface, --surface-2, --ink, --ink-2, --ink-3, --border, --pos, --neg, --warn, --info, --accent, --accent-2, --glass`
- Zwei Token-Sets: `theme-dark`, `theme-light`. Umschalter speichert Präferenz in `localStorage` UND in den User-Settings (Supabase), damit sie geräteübergreifend gilt.
- **KRITISCHER Kontrast-Audit Hell-Theme:** Jedes Textelement gegen seinen Hintergrund prüfen. Sekundär-/Tertiärtext darf nicht im Cream verschwinden. Mindestkontraste:
  - Primärtext ≥ 7:1, Sekundärtext ≥ 4.5:1, Tertiär/Hints ≥ 3:1, Icons/Borders ≥ 3:1.
- Akzentblöcke (Navy-Karten wie Score-Box, Finanzcontrolling) bleiben in beiden Themes dunkel; ihr Innentext bleibt hell.
- Neue Komponenten MÜSSEN Tokens nutzen → erben Theme automatisch (Teil von „selbst-integrierend").

## 4. Graph-Styling (Abschnitt für WP-1)

- Keine Excel-Optik. Farbverläufe (Gradient-Fill unter Linien/Flächen), abgerundete Balken, dezente Einfahr-Animation.
- Semantik konsistent: Ist = Akzent-Verlauf (z. B. Blau→Cyan), Vorjahr = neutral gestrichelt, Forecast = Amber gestrichelt, Positiv = Grün-Verlauf, Negativ = Rot-Verlauf.
- Grid sehr dezent (rgba), Achsenbeschriftung dezent, keine harten schwarzen Linien.
- Gradient-Fills müssen in Dark UND Hell funktionieren (Deckkraft anpassen).

## 5. Informationsarchitektur

### 5.1 Hotzone (ohne Scrollen, prägnant)
- Score-Ring (kompakt) + 4 KPI-Karten: Termintreue, Ø Durchlaufzeit, Umsatz (vs. Vorjahr), Deckungsbeitrag.
- Metall-Marge als Hero-Karte (Alleinstellung).
- KPI-Titel als Frage formuliert. Jede Karte zeigt Wert, Vergleich (vs. Vorjahr/Ziel), Sparkline, Trendrichtung.

### 5.2 Sekundärbereich (scrollen)
Stationsauslastung · Umsatzverlauf 12 M + Forecast · Wochenziel + Trend · Reklamationen nach Ursache · Top-Kunden (CLV) · Forecast & Frühwarnungen · Finanzcontrolling (gesperrte Regler) · Zahlungs-/Regionen-Analytik · Finanzzentrale/Export · Marketing-Timing.

### 5.3 Detailebene (Klick → Vollbild-Overlay)
- Jede Kachel öffnet ein Vollbild-Overlay mit unscharfem Hintergrund (gemeinsame `DetailOverlay`-Komponente).
- Im Overlay: ausführliche Daten, Zeitreihen, Filter, Segmentierung, Verknüpfungen in andere App-Bereiche.
- Schließen per Backdrop-Klick, X, Wisch (mobil), ESC. Body-Scroll gesperrt. Ein einziger Scrollcontainer.

## 6. Suchleiste oben (Abschnitt für WP-2)

- Freitextfeld ganz oben: Nutzer stellt Fragen oder gibt Begriffe ein.
- Filtert/findet relevante Inhalte der Performance-Seite und verweist in andere App-Bereiche (Auftrag, Kunde, Bad, Lagerartikel, Station).
- Phase 1 (jetzt): clientseitiger Index über alle sichtbaren Kennzahlen + Entitäten. Treffer öffnet das passende Overlay oder navigiert zur Zielroute. Begriffe wie „Reklamation", „Schleiferei", „Goldmarge", „Zahlungsmoral", Kundennamen, Auftragsnummern werden erkannt.
- Phase 2 (später, optional): natürliche Fragen via LLM-API beantworten („Warum ist die Termintreue gefallen?").

## 7. Metall-Marge + Bäder (Abschnitt für WP-3, Kernmodul)

### 7.1 Bäder-Seite — detaillierte Anlage
Pro Bad erfassbar/bearbeitbar:
- Name, Verfahren, Metalltyp (Verknüpfung Metall-Stammdaten)
- Metallgehalt (g/l), Badvolumen (l) → ergibt Gesamt-Metallmenge im Bad
- Einkaufspreis: Gesamtbetrag ODER €/g Metallgehalt, Kaufdatum, erwartete Standzeit (Monate)
- Dichte (vorbelegt je Metall: Gold 19,3 · Nickel 8,9 · Kupfer 8,96 · Silber 10,49 · Rhodium 12,4 g/cm³)
- Stromausbeute-Faktor (CE, default je Verfahren), Drag-out-Aufschlag (%)
- Sollwerte für Badregelkarte: pH min/max, Temperatur min/max, Konzentration min/max
- Status (stabil/beobachten/kritisch/gesperrt)

### 7.2 Margen-Berechnung
- Abgeschiedene Masse pro Teil/Auftrag = `Fläche [cm²] × (Schichtdicke [µm] × 0,0001) [cm] × Dichte [g/cm³]`
- Materialeinsatz = `Masse × Einkaufsbasis [€/g]`
- Erlös = `Masse × Tagespreis [€/g]` (Live)
- Metall-Marge = `(Erlös − Einsatz) × Stromausbeute − Drag-out-Verlust`
- Aggregation pro Metall, pro Bad, pro Auftrag, pro Zeitraum.

### 7.3 Einkauf Gewinn/Verlust — explizit sichtbar
Eigene Ansicht/Karte: „Lohnt sich der Metalleinkauf?"
- Pro Bad/Metall: investierter Einkaufsbetrag vs. aktueller Marktwert des **noch im Bad verbliebenen** Metalls (Restmenge × Tagespreis).
- Anzeige: „Eingekauft für X €. Aktueller Marktwert verbleibend: Y €. Bisher abgeschieden/verkauft zum Tagespreis: Z €. Gesamtergebnis Metall: +/− W €."
- Klar erkennbar, ob Einkaufszeitpunkt günstig war (Lagergewinn/-verlust durch Preisänderung).

### 7.4 Live-Preise
- Quelle: **metals.dev** (Edel- + Industriemetalle, EUR, LME/LBMA). Serverseitig (Next.js Route Handler / Supabase Edge Function), 1×/Tag abrufen, in `metal_prices` cachen, Historie behalten. „Stand HH:MM" an der Kachel.
- Fallback-Quellen: metalpriceapi.com, GoldAPI.io.
- **Rhodium:** keine zuverlässige API → manuelle Preispflege im Admin; falls kein Wert gepflegt, Rhodium-Marge ausblenden statt falsch rechnen.
- Energiepreis (optional, später): aWATTar/SMARD; Hinweis, dass Börsenpreis ≠ gewerblicher Endpreis (Lieferantenvertrag hinterlegbar).

## 8. Zahlungs- & Regionen-Analytik (Abschnitt für WP-4, neue Kachel)

- **Zahlungsmoral:** Ø Zahlungsdauer (Tage), Anteil pünktlich / verspätet / offen, Summe offener Forderungen.
- **Bevorzugte Zahlungsart:** Verteilung (Überweisung/Bar/Karte/Lastschrift/…).
- **Abholung vs. Versand:** Anteil, Trend.
- **Regionen:** Kunden nach PLZ → Land → Kontinent. Klickbare Karte (leichtgewichtig, z. B. Leaflet mit OSM-Tiles oder D3-Choropleth). Klick auf Region → Drill-down (Umsatz/Anzahl/CLV der Region).
- Datenschutz: PLZ/Region aggregiert darstellen; keine personenbezogenen Einzelstandorte an Dritt-Tiles senden.

## 9. „Was fehlt?"-Feedback (app-weit, Teil von WP-2)

- Unten auf JEDER Seite: kurze Frage „Was fehlt?" + einzeiliges Eingabefeld + Senden.
- Speichert in `feedback_notes` mit Route, Seitentitel, Text, Zeitstempel, (pseudonyme) User-ID.
- Zweck: Entwickler sammeln kontextbezogene Verbesserungswünsche. Erfolgsbestätigung (Toast), kein Reload.

## 10. Selbst-Integration (verbindlich, betrifft alle WP)

- Metall-Marge, Bäder, Stationen sind **datenbankgetrieben**: neue Datensätze erscheinen automatisch, ohne Code-Änderung.
- Kacheln/Module liegen in einem Grid, das sich automatisch füllt/umbricht (responsive `auto-fit`).
- Theme-Tokens sorgen für automatisches Styling neuer Elemente.
- Neue Seiten erben Header, Suchleiste, „Was fehlt?"-Feld über ein gemeinsames Seiten-Layout.

## 11. Datenmodell (Supabase, additiv, idempotent)

```sql
-- Metall-Stammdaten
metals: id uuid pk, symbol text, name text, density_g_cm3 numeric, default_unit text

-- Bäder
baths: id uuid pk, tenant_id text default 'galvanik-kreile', name text, process text,
  metal_id uuid fk, metal_content_g_l numeric, volume_l numeric,
  purchase_price_total_eur numeric, purchase_price_per_g_eur numeric,
  purchase_date date, expected_lifetime_months int,
  current_efficiency numeric default 0.95, dragout_factor numeric default 0.05,
  ph_min numeric, ph_max numeric, temp_min numeric, temp_max numeric,
  conc_min numeric, conc_max numeric, status text, created_at timestamptz default now()

-- Abscheidungen pro Auftrag/Teil
deposition_logs: id uuid pk, tenant_id text, order_id uuid, bath_id uuid fk, metal_id uuid fk,
  area_cm2 numeric, thickness_um numeric, mass_g numeric,
  cost_basis_eur numeric, revenue_dayprice_eur numeric, margin_eur numeric,
  created_at timestamptz default now()

-- Metallpreis-Cache (Historie)
metal_prices: id uuid pk, symbol text, price_eur_per_g numeric, source text, fetched_at timestamptz default now()

-- Zahlungen
payment_records: id uuid pk, tenant_id text, order_id uuid, customer_id uuid,
  amount_eur numeric, method text, due_date date, paid_date date, status text,
  created_at timestamptz default now()

-- Kundenregionen (erweitert customers)
customers ADD: postal_code text, country text, country_code text, lat numeric, lng numeric, region text

-- Entwickler-Feedback
feedback_notes: id uuid pk, tenant_id text, route text, page_title text, note text,
  user_id text, created_at timestamptz default now()
```
Indizes auf `deposition_logs(created_at)`, `metal_prices(symbol, fetched_at desc)`, `payment_records(status, due_date)`, `feedback_notes(created_at desc)`.

## 12. Rollen/Rechte

- Inhaber/Chef: alles sehen + Finanz/Steuerdaten + Bäder/Preise bearbeiten.
- Büro: Aufträge/Kunden/Zahlungen, eingeschränkt Finanzen.
- Werkstatt: keine Finanz-/Margendaten.
- RLS-Policies entsprechend; Service-Role nur serverseitig (Preis-Abruf, Export).

## 13. Datenschutz

- Metallpreise: kein Personenbezug, unkritisch.
- CLV/Kundenanalytik/Zahlungsmoral: personenbezogen → Rechtsgrundlage Art. 6 Abs. 1 lit. f (berechtigtes Interesse), Interessenabwägung dokumentieren. Kein vollautomatisches Scoring mit Rechtsfolge.
- Karten: Regionen aggregieren, keine Einzelkoordinaten an externe Tiles ohne Not.
- Supabase EU-Region, AV-Vertrag.

## 14. Akzeptanzkriterien (Gesamtmodul)

- [ ] Dark/Hell umschaltbar; in BEIDEN Themes ist jedes Label lesbar (Kontrast-Audit bestanden).
- [ ] Graphen haben Farbverläufe, keine Excel-Optik, lesbar in beiden Themes.
- [ ] Hotzone prägnant; Details ausschließlich per Klick im Vollbild-Overlay.
- [ ] Suchleiste oben filtert/findet Performance-Inhalte und verlinkt in App-Bereiche.
- [ ] „Was fehlt?"-Feld unten auf jeder Seite, speichert in `feedback_notes`.
- [ ] Bäder detailliert anlegbar (Mengen, Einkaufspreise, Metallgehalt, Sollwerte).
- [ ] Metall-Marge live berechnet; Einkauf-Gewinn/Verlust klar ersichtlich.
- [ ] Live-Preise serverseitig gecacht, „Stand HH:MM"-Stempel; Rhodium manuell/ausgeblendet.
- [ ] Zahlungs-/Regionen-Kachel inkl. klickbarer Karte.
- [ ] Neue Bäder/Metalle/Kacheln erscheinen automatisch (datengetrieben, kein Hardcoding).
- [ ] Regler app-weit gegen versehentliches Verstellen gesichert.
- [ ] Build grün, kein neues `any`.

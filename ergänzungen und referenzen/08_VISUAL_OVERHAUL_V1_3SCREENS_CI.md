# KREILE GALVANIK APP — VISUAL OVERHAUL V1
## Antigravity-Spezifikation: 3 Hauptscreens + globaler CI-Rollout

> **Status:** Build-fertig.
> **Zielsystem:** Bestehende Kreile-App (Tablet-first, Desktop-responsiv).
> **Quelle:** Drei Referenzbilder (Wake-Screen, Home, Warendurchlauf) + Logo/CI (Bild 4, 5).
> **Regel:** Keine bestehende Funktion entfernen. Alle anderen Screens (Performance, Aufträge, Anfragen, Teile, Kunden, Lager, Scan, Mehr, Submenüs) werden visuell auf dieses System gehoben.
> **Hintergrundfarbe der gesamten App = Cremeton aus Bild 1.**

---

## 0. Sicherheits- und Vorbereitungsschritte (Pflicht vor Code-Änderung)

1. `git status` prüfen, alle offenen Änderungen committen.
2. Branch anlegen: `git checkout -b feat/visual-overhaul-v1`.
3. Snapshot/Tag setzen: `git tag pre-visual-overhaul-v1`.
4. Screenshots der aktuellen Screens A/B/Warendurchlauf in `/docs/before/` ablegen.
5. Nach Build erneut Screenshots in `/docs/after/` und Pixel-Vergleich gegen Referenzbilder.

---

## 1. Design Tokens (verbindlich, global einsetzen)

### 1.1 Farben

| Token | HEX | Verwendung |
|---|---|---|
| `--bg-app` | `#F5EFE3` | Globale App-Hintergrundfarbe (Cremeton, Bild 1) |
| `--bg-app-soft` | `#FAF6EC` | Subtile Card-Innenflächen, sehr helle Bereiche |
| `--surface-card` | `#FFFFFF` | Standard-Cards, KPI-Cards, Listenelemente |
| `--surface-tinted` | `#F9EFE0` | Hervorgehobene Cards (z. B. „Kamera"-Card Bild 3) |
| `--surface-tinted-soft` | `#F2E9D8` | Sekundärer Tint, Hover-Zustände |
| `--navy-900` | `#0E1A2E` | Primärtext, Logo-Wortmarke „KREILE" |
| `--navy-700` | `#1A2845` | Avatar-Hintergrund, aktiver Bottom-Nav-Pill, Hauptüberschriften |
| `--navy-500` | `#2E3A55` | Sekundärtext, Icons normal |
| `--gold-600` | `#B8923F` | Akzent: Skyline, Linien, Zahlen-Highlights, Sub-Tagline |
| `--gold-500` | `#C9A661` | Avatar-Initialen-Hintergrund auf Wake-Screen (MK/CD/RS-Kreise) |
| `--gold-100` | `#EFE2C4` | Sehr weicher Goldton, Hintergrund für Kreis-Avatare hellere Variante |
| `--accent-orange` | `#E8943C` | Warnungen, „kritisch"-Indikator, „2 heute fällig", Tipp-Banner |
| `--accent-orange-soft` | `#FBE8D2` | Orange Card-Hintergründe, Tip-Banner Fläche |
| `--success-green` | `#5A8F4D` | Erledigt-Häkchen, „im Plan", positive States |
| `--success-green-soft` | `#DDE9D3` | Hintergrund für grüne Status-Pills |
| `--danger-red` | `#D14F3D` | Roter Prozess-Indikator (z. B. „Galvanik" Punkt Bild 3), Bell-Badge |
| `--neutral-gray-300` | `#C8C2B5` | Inaktive Timeline-Punkte, Trennlinien |
| `--neutral-gray-100` | `#ECE6D9` | Sehr leichte Trennlinien, leere Zustände |
| `--text-muted` | `#7A7466` | Hilfstext, Datum, Sekundärlabels |

### 1.2 Typografie

| Token | Familie | Gewicht | Größe (Tablet) |
|---|---|---|---|
| `--font-display` | Custom „Kreile Display" (Logo-Wortmarke, siehe Bild 1, 5) | Regular | 28–48px |
| `--font-body` | Inter (oder Geist Sans) | 400 / 500 / 600 / 700 | 14 / 16 / 18 / 20 / 24px |
| `--font-mono` | JetBrains Mono | 400 | 13–14px (nur technische Felder) |

**Logo-Wortmarke „KREILE" / „GALVANIK KREILE":** als SVG aus `/assets/logo/kreile-wordmark.svg` einbinden, **niemals als Font nachbauen**. Beide Varianten vorhalten:
- `kreile-wordmark-skyline.svg` (Bild 1: Skyline + KREILE + GALVANIK · VEREDLUNG + MEISTERBETRIEB SEIT 1962)
- `kreile-logo-compact.svg` (Bild 2/3 Top-Left: „GK"-Monogramm + „GALVANIK KREILE" + „Meisterbetrieb seit 1962")

### 1.3 Spacing, Radius, Shadow

| Token | Wert |
|---|---|
| `--radius-sm` | `8px` (Buttons, Pills) |
| `--radius-md` | `16px` (Cards, Inputs) |
| `--radius-lg` | `20px` (große KPI-Cards, Haupt-Panels) |
| `--radius-xl` | `28px` (Avatar-Kacheln Wake-Screen) |
| `--shadow-card` | `0 1px 2px rgba(14,26,46,0.04), 0 4px 16px rgba(14,26,46,0.06)` |
| `--shadow-elevated` | `0 4px 24px rgba(14,26,46,0.10)` |
| `--space-1..8` | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px |

### 1.4 Icon-System

- Bibliothek: **Lucide Icons**, einheitlich `stroke-width: 1.5`, Größe Standard `20px`, KPI-Cards `28px`, Prozess-Steps `40px`.
- Farbe Standard: `--navy-700`. Akzent: `--gold-600`. Warnung: `--accent-orange`.
- Tool-Icons unter Avataren Wake-Screen (Bild 1): `wrench-screwdriver`, `wrench`, `calculator` — in `--gold-600`.

---

## 2. Globale Layout-Bausteine

### 2.1 App-Shell

```
[Header (fixed, 72px)]
[Content (scrollbar, padding 24–32px)]
[Bottom-Navigation (fixed, 80px)]
```

- Hintergrund App-Shell: `--bg-app`.
- Inhalt zentriert auf Tablet (1024–1366px), Desktop max-width `1440px`, dann Whitespace links/rechts in `--bg-app`.

### 2.2 Header (Bild 2 + 3, identisch)

| Element | Spezifikation |
|---|---|
| Logo links | `kreile-logo-compact.svg`, Höhe 56px, Tagline „Meisterbetrieb seit 1962" in `--gold-600`, `14px`, `letter-spacing 0.02em` |
| Suchleiste mittig | Höhe 56px, `border-radius: 16px`, Hintergrund `#FFFFFF`, Placeholder „Bei Auftrag, Kunde, Teilenummer suchen…", links Lucide `search`, rechts Lucide `camera`. Im Hintergrund der Suchleiste **dezente Frankfurt-Skyline als sehr transparentes SVG** (10–12 % Opacity, in `--gold-600`). |
| Datums-Chip | Rechts neben Suche, weiße Card, Lucide `calendar`, Text „Heute · So., 24.05.", danach kleiner orangefarbener Punkt (Pulsanimation 2s ease) als Hinweis auf Tagestermine. Datum live aus System-Locale `de-DE`. |
| Online-Pill | Grüner Punkt + „Online" + Nutzer-Counter-Badge im `--gold-500`/Cream. Live verbunden mit WebSocket-Channel `presence` (Anzahl aktiver Mitarbeiter). |
| Bell | Lucide `bell`, rotes Badge bei `notifications.unread > 0` (`--danger-red`, weiße Schrift). |
| Avatar | Kreis 48px, `--navy-700`, Initialen weiß. Klick → User-Menü-Dropdown. |

### 2.3 Bottom-Navigation (Bild 2 + 3)

- Höhe 80px, Hintergrund `#FFFFFF`, oben `border-top: 1px solid --neutral-gray-100`.
- Einträge in fester Reihenfolge:

| Reihenfolge | Label | Icon (Lucide) | Route |
|---|---|---|---|
| 1 | Home | `home` | `/` |
| 2 | Aufträge | `clipboard-list` | `/auftraege` |
| 3 | Anfragen | `file-question` | `/anfragen` |
| 4 | Teile | `package` | `/teile` |
| 5 | Kunden | `users` | `/kunden` |
| 6 | Warendurchlauf | `boxes` | `/warendurchlauf` |
| 7 | Lager | `warehouse` | `/lager` |
| 8 | Scan | `scan-line` | `/scan` |
| 9 | Mehr | `more-horizontal` | `/mehr` |

- **Aktiver Eintrag:** Pill-Shape, Hintergrund `--navy-700`, Schrift weiß, Icon weiß (Bild 2 = Home aktiv, Bild 3 = Warendurchlauf aktiv mit Variante in `--accent-orange` + weiß — Begründung: Warendurchlauf-Modul nutzt Orange als Modul-Akzent, siehe Sektion 5).
- **Inaktive Einträge:** Icon und Label in `--navy-500`, Hover `--navy-700`, Touch-Area mindestens 48×48px.

### 2.4 Card-Typen

| Typ | Anwendung | Stil |
|---|---|---|
| `KPICard` | Top-Row Bild 2 (5 Stück) | weiß, `radius-lg`, `shadow-card`, Icon-Kreis 56px in passendem Soft-Ton, Label + Großzahl + Sub-Hinweis |
| `TimelineCard` | „Tagesablauf auf einen Blick" | weiß, `radius-lg`, vertikale Timeline links, Zeilen mit Zeit + Statuspunkt + Titel + Sub + Action-Button |
| `SidePanelCard` | „Heute wichtig", „Kleiner Hinweis zum Tag" | weiß, `radius-lg`, Icon-Liste, max. 3 Einträge sichtbar |
| `ProcessStepCard` | Bild 3 oben (Wareneingang → Galvanik → Warenausgang) | weiß, `radius-md`, großes Icon zentriert, Label darüber, roter Punkt-Indikator falls aktiv/kritisch |
| `ActionTileCard` | Bild 3 „Kamera"/„Manuell anlegen" | groß, `radius-lg`, links Icon-Kreis, rechts Pfeil. „Kamera" mit `--surface-tinted` Hintergrund, „Manuell" weiß. |
| `MessageBubbleCard` | Bild 1 Wetter-Bubble oben rechts | weiß, `radius-lg`, links Lucide `sun`, Text, unten rechts Zeit + Doppel-Häkchen `check-check` in `--gold-600` |
| `AvatarTile` | Bild 1 MK/CD/RS-Kacheln | weiß, `radius-xl`, Kreis mit Initialen in `--gold-100`, darunter Tool-Icon in `--gold-600` |

---

## 3. Screen A — Tablet-Wake / Startbildschirm „Guten Morgen, Meister!"

> **Route:** `/start` (oder `/wake`).
> **Trigger:** Erste Anmeldung nach Idle > 30 Min oder bei Tablet-Wake. Danach Button „Weiter zur App" oder Auto-Forward nach 4s Idle ohne Interaktion deaktiviert (bewusst, damit Wetter/Begrüßung sichtbar bleiben). Übergang per Tap auf eine Avatar-Kachel → Login als entsprechender Nutzer → `/`.
> **Status:** Bereits umgesetzt, Pixel-Politur nötig.

### 3.1 Aufbau (vertikal, zentriert)

| Block | Position | Inhalt |
|---|---|---|
| 1 | Top-Center | Skyline-Logo-Lockup (SVG) — siehe 1.2. Breite 480px Tablet. |
| 2 | Top-Right | Message-Bubble-Card Wetter (siehe 3.2). |
| 3 | Mitte oben | Wave-Emoji + „Guten Morgen, Meister!" — `--font-body 700 32px`, `--navy-900`. Begrüßung tageszeitabhängig (siehe 6.1). |
| 4 | Mitte | Clock-Hinweis-Card: Lucide `clock`, **fett:** „Zuerst steht an: 3 Teile in den Versand bringen." **leichter:** „Wenn das bis 11:30 Uhr erledigt ist, bleibt der Nachmittag entspannt." rechts Chevron. Klick → Versand-Liste. |
| 5 | Unten | 3 Avatar-Kacheln nebeneinander: MK, CD, RS. Jede 220×260px, Cremeton-Card, Kreis-Avatar in `--gold-100` mit goldenen Initialen, darunter Werkzeug-Icon. Klick → Login als jeweiliger Nutzer. |

### 3.2 Wetter-Bubble (Top-Right)

- Breite 320px, Padding 20px.
- Inhalt: `[sun-icon]  Heute: 20°C und noch 4 Stunden hell – perfekte Bedingungen, um nach Feierabend noch kurz an den Main zu gehen. 🍺`
- Footer: Uhrzeit `08:42` + Doppel-Häkchen in `--gold-600` (Status: „gelesen"-Optik wie Messenger).
- **Datenquelle:** Open-Meteo API (kostenlos, ohne Key), Koordinaten Frankfurt am Main (`50.1109, 8.6821`), Update alle 15 Min.
- **Generierter Textbaustein:** Backend-Route `/api/morning-message` liefert tageszeit-/wetter-/jahreszeitabhängigen Mikrotext (siehe 6.2).

### 3.3 Avatar-Kacheln

| Initialen | Rolle | Icon |
|---|---|---|
| MK | Meister Kreile | `wrench-screwdriver` (gekreuzt) |
| CD | Werkstatt (Chef-Stellvertreter) | `wrench` |
| RS | Büro/Rechnung | `calculator` |

- Datenquelle Nutzerliste: `/api/users?active=true` → bei mehr als 3 Nutzern Karussell horizontal scrollbar.
- Tap → PIN-Eingabe (4-stellig) → Session-Login → Routing `/`.

### 3.4 Akzeptanzkriterien Screen A

- [ ] Logo zentriert, Skyline ist Teil des SVG, kein Rastereffekt.
- [ ] Begrüßungstext wechselt korrekt nach Tageszeit (siehe 6.1).
- [ ] Wetter-Bubble lädt asynchron, zeigt Skeleton 600ms.
- [ ] Avatar-Kachel-Tap löst PIN-Sheet aus, kein Direkt-Login ohne PIN.
- [ ] Hintergrund exakt `#F5EFE3`.
- [ ] Auf 1024×768 Tablet vollständig ohne Scroll sichtbar.

---

## 4. Screen B — Home / Tagesablauf-Dashboard

> **Route:** `/`.
> **Status:** Bestehender Home-Screen wird durch dieses Layout ersetzt. Keine Funktion entfällt — alle bisherigen Inhalte werden in die KPI-Cards, Timeline oder das „Heute wichtig"-Panel integriert.

### 4.1 Layout-Grid

```
Header (siehe 2.2)
─────────────────────────────────────────────
Row 1: KPI-Cards (5 Spalten, gleichbreit)
─────────────────────────────────────────────
Row 2:
  Left  (≈ 66%)  Timeline-Card „Tagesablauf auf einen Blick"
  Right (≈ 34%)  Stack:
                  - „Heute wichtig"-Card
                  - „Kleiner Hinweis zum Tag"-Card
─────────────────────────────────────────────
Bottom-Nav
```

Auf Tablet-Hochkant (768px breit): KPI-Cards in 2 Reihen à 2–3, Timeline + Side-Panels stapeln vertikal.

### 4.2 KPI-Card-Definitionen

| # | Label | Icon | Wert | Sub | Wert-Quelle |
|---|---|---|---|---|---|
| 1 | „So läuft's heute" | Smiley-Avatar in `--gold-100` | „Gut auf Kurs" | „Weiter so! 💪" | `/api/today/status` (Algorithmus aus offenen/kritischen/fertigen Aufträgen) |
| 2 | „Offene Anfragen" | `file-question` in `--neutral-gray-100` | Zahl | „davon X neu" | `/api/anfragen?status=offen` |
| 3 | „In Galvanik" | `flask` in `--gold-100` | Zahl | „X kritisch" (orange wenn > 0) | `/api/auftraege?status=in_galvanik` |
| 4 | „Warenausgang" | `package` in `--success-green-soft` | Zahl | „X heute fällig" | `/api/warenausgang?faellig_heute=true` |
| 5 | „Fertig heute" | `party-popper` in `--gold-100` | Zahl | „Super!" wenn > 0, sonst „Heute noch nichts." | `/api/auftraege?status=fertig&datum=heute` |

- Card-Größe: gleichbreit, Höhe 132px, Padding 20px.
- Bei Klick auf eine Card → gefilterte Detailansicht des jeweiligen Moduls.

### 4.3 Timeline „Tagesablauf auf einen Blick"

- Header der Card: Titel links, Dropdown „Kommende Arbeiten ▾" rechts (Filter: Kommende / Erledigte / Alle).
- Timeline-Items von oben nach unten chronologisch heute:

| Zeit | Status-Punkt | Titel | Sub | Action |
|---|---|---|---|---|
| 08:00 | grüner Check `--success-green` | Wareneingang geprüft | Alle Eingänge erfasst. | — |
| 09:15 | grüner Check | 3 Teile in Galvanik gestartet | Sie laufen planmäßig. | — |
| 11:30 | oranger `clock` | Anfragen sortieren | 7 Anfragen warten auf Rückmeldung. | Button „Ansehen" |
| 12:30 | Food-Icon `utensils` | Mittagspause | Gönn dir was! | Pill „In 2 Std." |
| 14:30 | grauer Punkt `--neutral-gray-300` | Versand vorbereiten | 6 Aufträge bereitstellen. | Button „Ansehen" |
| 16:30 | offener Kreis (Outline) | Tagesabschluss | Offene Punkte prüfen & abschließen. | Button „Checkliste" |

- Daten kommen aus `/api/today/timeline`, die Items werden automatisch aus folgenden Quellen aggregiert:
  - Wareneingangs-Bestätigungen
  - laufende Galvanik-Aufträge
  - offene Anfragen-Queue
  - Pausen aus Stammdaten (`/api/settings/working-hours`)
  - heute fällige Warenausgänge
  - Tagesabschluss-Routine
- Live-Update via Socket-Channel `today:timeline:updated`.
- Action-Buttons → Detail-Route des jeweiligen Items.

### 4.4 Side-Panel „Heute wichtig"

| Icon | Titel | Sub | Klick-Ziel |
|---|---|---|---|
| `alert-triangle` orange | „Salzsäure fast leer" | „Bestellung nicht vergessen." | `/warenwirtschaft/chemikalien/salzsaeure` |
| `info` `--navy-700` | „2 Freigaben fehlen" | „Kunden warten auf Rückmeldung." | `/freigaben?status=offen` |
| `check-circle` `--success-green` | „Warenausgang im Plan" | „Heute 4 Abholungen geplant." | `/warenausgang?datum=heute` |

- Datenquelle: `/api/today/important` (max. 3 Items, sortiert nach Dringlichkeit).

### 4.5 Side-Panel „Kleiner Hinweis zum Tag"

- Kopfzeile: Smiley + „Kleiner Hinweis zum Tag" + Herz-Icon rechts (Favorit/„Tipp gemerkt").
- Inhalt dynamisch aus `/api/morning-message?context=end-of-day` (siehe 6.2).
- Beispiel: „Gleich feierabend! 🍺 Salzsäure bestellen nicht vergessen und dann: wohlverdient Feierabend."
- Wechselt im Tagesverlauf den Ton (siehe 6.2).

### 4.6 Akzeptanzkriterien Screen B

- [ ] Alle 5 KPI-Cards laden Live-Daten, kein Hardcoding.
- [ ] Timeline wird korrekt nach aktueller Uhrzeit gefärbt (Vergangenes = Grün, Aktuelles = Orange, Zukünftiges = Grau).
- [ ] Dropdown „Kommende Arbeiten" filtert ohne Reload.
- [ ] „Heute wichtig" zeigt max. 3 Items mit Pfeil-Chevron rechts, jeder ein Deep-Link.
- [ ] Hintergrund exakt `#F5EFE3`.
- [ ] Keine bisherigen Home-Funktionen entfallen (Funktions-Diff gegen Vorzustand vorlegen).

---

## 5. Screen C — Warendurchlauf „Neue Annahme erfassen" (NEU)

> **Route:** `/warendurchlauf`.
> **Status:** **NEU.** Bisher in der App nicht vorhanden.
> **Modul-Akzentfarbe:** `--accent-orange`. Bottom-Nav „Warendurchlauf"-Eintrag aktiv in Navy mit Orange-Glow, oder klassisch Navy-Pill (entscheide gem. Bild 3 — dort Navy-Pill aktiv; halte konsistent zu Bild 2).

### 5.1 Aufbau

```
Header (siehe 2.2)
─────────────────────────────────────────────
Prozess-Visual (volle Breite, weiches Orange-Fading rechts)
  Wareneingang  →  Galvanik (• rot)  →  Warenausgang
─────────────────────────────────────────────
Section-Header „Neue Annahme erfassen" (mit goldener Unterlinie)
─────────────────────────────────────────────
Grid:
  Left   ActionTileCard „Kamera — Foto aufnehmen"   (tinted)
  Right  ActionTileCard „Manuell anlegen — Ohne Scan erfassen"
─────────────────────────────────────────────
Center-Card schmaler: „Anfragen [3] — Offene Angebotsanfragen"  →
─────────────────────────────────────────────
Section „Letzte Annahmen"
  Listen-Card „Letzte Annahmen anzeigen" → (Klick öffnet Liste)
─────────────────────────────────────────────
Tipp-Banner orange-soft:
  „Tipp: Scanne Lieferschein, Zettel oder Kundenbegleitschreiben für schnellere Erfassung."  „So funktioniert's →"
─────────────────────────────────────────────
Bottom-Nav (Warendurchlauf aktiv)
```

### 5.2 Prozess-Visual (Hero)

- Volle Content-Breite, Höhe 220px.
- Drei `ProcessStepCard`s nebeneinander, dazwischen orangefarbene Pfeile (Lucide `arrow-right`, `stroke-width: 2.5`).
- Karte 1 „Wareneingang" — Icon `package-open`, Label oben, weiß.
- Karte 2 „Galvanik" — Icon `flask-conical`, **roter Punkt** (`--danger-red`, 12px) oben rechts auf der Karte, signalisiert „aktive Charge / Aufmerksamkeit nötig".
- Karte 3 „Warenausgang" — Icon `truck`.
- Hintergrund des gesamten Hero-Bands: lineares Gradient von links `--bg-app` → rechts `--surface-tinted` mit subtilem orangem Punkte-Raster oben rechts (SVG-Dots, 8 % Opacity).
- Klick auf eine Karte → Detail-Liste des jeweiligen Status.

### 5.3 ActionTileCards

| Card | Icon | Titel | Sub | Klick-Ziel |
|---|---|---|---|---|
| Kamera (links, hervorgehoben mit `--surface-tinted`) | `camera` in `--accent-orange` Kreis | „Kamera" | „Foto aufnehmen" | öffnet Kamera-Sheet → OCR-Pipeline (siehe Bestehendes Modul `02_WARENEINGANG_KAMERA_OCR_AUTONOMIE`) |
| Manuell anlegen (rechts, weiß) | `edit-3` in `--surface-tinted` Kreis | „Manuell anlegen" | „Ohne Scan erfassen" | `/warendurchlauf/annahme/neu?modus=manuell` |

- Beide Cards Höhe 140px, Padding 24px, Pfeil rechts in `--accent-orange`.

### 5.4 Anfragen-Mini-Card

- Schmal, mittig, 60 % Breite.
- Icon `message-square` in grauer Kreis, Titel „Anfragen", Badge `[3]` in `--danger-red`, Sub „Offene Angebotsanfragen", Pfeil rechts.
- Klick → `/anfragen?status=angebot`.

### 5.5 „Letzte Annahmen"

- Section-Titel „Letzte Annahmen" (`--navy-900`, 18px, 600).
- Card-Zeile „Letzte Annahmen anzeigen" mit `clock` Icon, Chevron rechts.
- Klick → Detail-Liste der letzten 50 Annahmen (`/warendurchlauf/letzte`).

### 5.6 Tipp-Banner

- Vollbreite, Hintergrund `--accent-orange-soft`, Border-Radius `--radius-md`, Padding 16–20px.
- Links: `info`-Icon in oranger Kreis.
- Text: „Tipp: Scanne Lieferschein, Zettel oder Kundenbegleitschreiben für schnellere Erfassung."
- Rechts: Link-Button „So funktioniert's →" in `--accent-orange`, öffnet Modal mit Kurzanleitung (3 Schritte, Bilder).

### 5.7 Akzeptanzkriterien Screen C

- [ ] Prozess-Visual rendert pixelnah zu Bild 3 inkl. rotem Indikator auf „Galvanik".
- [ ] Kamera-Card öffnet die bestehende Kamera/OCR-Pipeline ohne Funktionsverlust.
- [ ] „Manuell anlegen" führt zum existierenden Annahme-Formular.
- [ ] Anfragen-Badge spiegelt Live-Count aus `/api/anfragen?status=angebot`.
- [ ] „Letzte Annahmen" lädt die 50 jüngsten Eingänge sortiert nach `created_at desc`.
- [ ] Tipp-Banner-Modal funktioniert, 3-Step-Slider.
- [ ] Bottom-Nav „Warendurchlauf" aktiv im selben Pill-Stil wie Home auf Bild 2.
- [ ] Hintergrund exakt `#F5EFE3`.

---

## 6. Funktionale Live-Features

### 6.1 Tageszeitabhängige Begrüßung

Service-Modul `greeting-service.ts`:

| Uhrzeit lokal | Begrüßung |
|---|---|
| 04:00–10:59 | „Guten Morgen, {Rolle}!" |
| 11:00–13:59 | „Mahlzeit, {Rolle}!" |
| 14:00–17:59 | „Schönen Nachmittag, {Rolle}!" |
| 18:00–21:59 | „Guten Abend, {Rolle}!" |
| 22:00–03:59 | „Späte Schicht, {Rolle}." |

- `{Rolle}` = Anzeigename oder Rolle (Meister, Werkstatt, Büro). Default „Meister" wenn Rolle Inhaber.
- Emoji wechselt entsprechend (👋 morgens, 🍽 mittags, ☀️ nachmittags, 🌙 abends).
- Quelle Uhrzeit: Server-Zeit, Anzeige in `Europe/Berlin`.

### 6.2 Mikrotext-Generator („Wetter-Bubble" + „Kleiner Hinweis zum Tag")

Backend-Route `GET /api/morning-message`:

**Input-Variablen (auto-erfasst):**

| Variable | Quelle |
|---|---|
| `tageszeit` | Server-Clock |
| `wetter` | Open-Meteo (Temperatur, Wettercode, Sonnenstunden bis Sonnenuntergang) |
| `wochentag` | Clock |
| `feiertag` | nager.date API (DE-HE) |
| `offene_kritische_auftraege` | DB |
| `verbrauchs_warnungen` | DB (Chemikalien-Stände) |
| `feierabend_in_minuten` | Stammdaten + Clock |

**Output:** ein bis zwei Sätze, locker, Mainhattan-Bezug erlaubt (z. B. „kurz an den Main"), nie kitschig.

**Template-Beispiele:**
- Morgens + sonnig + viele Sonnenstunden: „Heute: {temp}°C und noch {sun_h} Stunden hell – perfekte Bedingungen, um nach Feierabend noch kurz an den Main zu gehen. 🍺"
- Nachmittag + Warnung: „Gleich feierabend! 🍺 {warnung_text} nicht vergessen und dann: wohlverdient Feierabend."
- Regen: „Draußen Schmuddel – guter Tag, drinnen ein paar liegengebliebene Aufträge abzuhaken."

Implementierung: feste Template-Pool, Auswahl per Heuristik. Optional später ein lokales LLM-Hook (vermerkt, nicht im MVP).

### 6.3 Online-Status-Pill

- Socket-Verbindung zu `presence`-Channel.
- Anzeigt: Anzahl aktuell aktiver Nutzer (alle mit Heartbeat < 60s).
- Klick → kleines Popover mit Liste der aktiven Nutzer (Avatar + Name + Standort/Modul).

### 6.4 Benachrichtigungs-Glocke

- Badge zeigt `unread`-Count, max. 99+.
- Klick öffnet Drawer rechts mit den letzten 20 Notifications, gruppiert nach „Heute / Diese Woche / Älter".
- Quellen: Warenwirtschaftswarnungen, fehlende Freigaben, neue Anfragen, kritische Aufträge.

### 6.5 Datums-Chip mit Punkt-Indikator

- Pulsanimation des orangen Punkts an, wenn `/api/today/has-deadlines?datum=heute` truthy.
- Klick → Tageskalender-Sheet (Termine + Deadlines, optional Verknüpfung mit Outlook/Google Cal später).

### 6.6 Suchleiste

- Tipp-Suche live ab 2 Zeichen, debounce 250ms.
- Suchquellen (parallel): Aufträge, Kunden, Teile, Anfragen.
- Ergebnisse als Dropdown unter dem Inputfeld, Tab-Switcher nach Quelle, max. 5 Top-Treffer pro Quelle.
- Kamera-Icon rechts → öffnet Scan-Modus (gleicher wie Bottom-Nav „Scan").

---

## 7. CI-Rollout auf alle bestehenden Seiten

> **Regel:** Jede bestehende Seite (Performance, Aufträge, Anfragen, Teile, Kunden, Lager, Scan, Mehr und sämtliche Submenüs, Modals, Drawer, Formulare, Tabellen) bekommt das gleiche Design-System. **Keine Funktion entfällt**, nur Hülle und Konsistenz ändern sich.

### 7.1 Mapping bestehende → neue Stile

| Aktuelles Element | Neuer Standard |
|---|---|
| Beliebiger Seitenhintergrund | `--bg-app` (`#F5EFE3`) |
| Card mit eigener Hintergrundfarbe | `--surface-card` (weiß), bei Hervorhebung `--surface-tinted` |
| Primärbutton | Hintergrund `--navy-700`, Text weiß, `--radius-sm`, Höhe 44–48px, Hover `--navy-900` |
| Sekundärbutton | Hintergrund weiß, Border `1px --navy-700`, Text `--navy-700` |
| Akzent-/CTA-Button (Modul Warendurchlauf) | Hintergrund `--accent-orange`, Text weiß |
| Inputfelder | Höhe 48px, `--radius-md`, weiß, Border `1px --neutral-gray-300`, Focus `2px --navy-700` |
| Tabellen | Header `--navy-700` auf `--bg-app-soft`, Zebra `--bg-app-soft` / weiß, Border-Bottom `--neutral-gray-100` |
| Status-Pills | Grün/Orange/Rot-Soft + farbiger Text, Höhe 24px, `--radius-sm`, 12px Schrift |
| Icons | Lucide, Strich 1.5, Farben gem. Tokens |
| Schatten | nur `--shadow-card` für Cards, `--shadow-elevated` für Modals/Drawer |
| Modal-Header | weiße Card, Titel `--navy-900` 20px 600, X-Close oben rechts |
| Drawer | von rechts, max-width 480px, weißer Hintergrund, gleiche Token-Logik |

### 7.2 Performance-Seite (referenziert in Anweisung)

- Selber Header, selbe Bottom-Nav, selbe KPI-Card-Optik.
- Charts: Bibliothek **Recharts** (oder bestehende beibehalten), Farbpalette: `--navy-700`, `--gold-600`, `--accent-orange`, `--success-green`.
- Card-Titel und Achsenbeschriftungen in `--navy-700` 14–16px 500.
- Gridlines `--neutral-gray-100`.
- Keine Funktion entfällt; lediglich Farbschema + Card-Stile werden auf das System gehoben.

### 7.3 Menü / Submenüs / „Mehr"-Übersicht

- „Mehr"-Screen als Grid aus 2–3 Spalten, jede Kachel = `ActionTileCard` (siehe 2.4).
- Submenüs als linke Sidebar im jeweiligen Modul oder als Tabs unter dem Header.
- Aktiver Eintrag: Pill `--navy-700`, weiße Schrift. Inaktiv: transparent, `--navy-500`.

---

## 8. Responsives Verhalten

| Viewport | Verhalten |
|---|---|
| ≥ 1280px (Desktop/Tablet Querformat) | Volles Grid, KPI-Cards 5-spaltig, Timeline + Side-Panels nebeneinander, Header zentriert max-width 1440px |
| 1024–1279px (Tablet Querformat klein) | KPI-Cards 5-spaltig, ggf. Schrift leicht reduziert, Side-Panels schmaler |
| 768–1023px (Tablet Hochkant) | KPI-Cards 2–3 in 2 Reihen, Side-Panels unter Timeline, Header mit kompakterer Suche |
| < 768px (Smartphone, nicht Primärziel) | Single-Column, KPI als horizontaler Scroll oder 2×N-Grid, Bottom-Nav reduziert auf 5 Haupteinträge + „Mehr" |

App-First: Optimierungs-Zielgerät Tablet Querformat 1366×1024. Auf PC wird identische Optik gerendert, nur mit Whitespace links/rechts.

---

## 9. Akzeptanzkriterien (Build-Abnahme)

### 9.1 Pixel- und CI-Check

- [ ] App-Hintergrund global `#F5EFE3` auf jedem Screen, kein abweichender Wert mehr im Repo.
- [ ] Logo-SVGs in beiden Varianten korrekt referenziert, keine Pixel-Logos mehr.
- [ ] Alle Farben aus Design-Tokens, keine Inline-Hex-Werte außerhalb der Token-Datei.
- [ ] Alle Icons aus Lucide, kein Fremd-Icon-Set parallel.
- [ ] Schatten und Radien folgen Tokens.
- [ ] Bottom-Nav identisch auf allen Hauptseiten.

### 9.2 Funktionscheck

- [ ] Begrüßung wechselt nachweisbar bei Uhrzeit-Mock (Tests).
- [ ] Wetter-Bubble lädt echte Daten aus Open-Meteo, Fehlerfall zeigt Fallback („Heute mal kein Wetter — aber bestimmt was zu tun.").
- [ ] KPI-Cards zeigen Live-Werte, keine Mocks.
- [ ] Timeline-Items spiegeln Tagessituation, Live-Update via Socket.
- [ ] „Heute wichtig" + „Kleiner Hinweis" laden dynamisch.
- [ ] Warendurchlauf-Screen: Kamera, Manuell, Anfragen, Letzte Annahmen, Tipp-Modal alle funktional.
- [ ] Keine bestehende Funktion ist nach Build verschwunden (Diff-Liste).

### 9.3 Performance

- [ ] First Contentful Paint auf Tablet ≤ 1.5s im LAN.
- [ ] Socket-Reconnects ohne UI-Flicker.
- [ ] Keine Layout-Shifts > 0.1 CLS.

---

## 10. Antigravity-Build-Schritte (Reihenfolge verbindlich)

1. **Token-Datei anlegen/aktualisieren**: `src/styles/tokens.css` mit allen Variablen aus Sektion 1.
2. **Tailwind-Config anpassen**: Farb-/Spacing-/Radius-Tokens auf CSS-Variablen mappen.
3. **Logo-SVGs ablegen** unter `src/assets/logo/` (zwei Dateien).
4. **App-Shell refaktorieren**: globaler Background, Header-Komponente, BottomNav-Komponente (Sektion 2).
5. **Card-Komponenten generisch implementieren**: `KPICard`, `TimelineCard`, `SidePanelCard`, `ProcessStepCard`, `ActionTileCard`, `MessageBubbleCard`, `AvatarTile` in `src/components/ui/`.
6. **Screen A** `/start`: Wake-Screen gemäß Sektion 3 fertigstellen (Pixel-Politur).
7. **Screen B** `/`: Home-Dashboard gemäß Sektion 4 implementieren, KPI-/Timeline-/Side-Panel-Endpoints anbinden.
8. **Screen C** `/warendurchlauf`: Neuer Screen gemäß Sektion 5, inkl. Anbindung an bestehende Kamera/OCR- und Annahme-Module.
9. **Backend-Endpunkte**: `/api/morning-message`, `/api/today/status`, `/api/today/timeline`, `/api/today/important`, `/api/today/has-deadlines`, `/api/users?active=true` implementieren oder anpassen.
10. **Wetter-Service**: Open-Meteo-Client + Caching (15 Min, In-Memory ok).
11. **Greeting-Service**: Pure-Function, mit Unit-Tests für alle Tageszeit-Buckets.
12. **CI-Rollout**: Alle bestehenden Routen durchgehen, Hintergrundfarben, Cards, Buttons, Inputs, Tabellen auf Tokens umstellen (Sektion 7).
13. **Performance-Seite**: Charts und Cards auf neues System heben.
14. **Smoke-Tests**: Playwright-Suite, Screenshot-Vergleich gegen Referenzbilder.
15. **Diff-Doku**: `/docs/visual-overhaul-diff.md` mit Vorher-/Nachher-Screenshots und Funktionsliste (vor/nach), um Funktionsverlust auszuschließen.
16. **Commit-Strategie**: pro Sektion ein Commit (`feat: tokens`, `feat: app-shell`, `feat: screen-a-wake`, `feat: screen-b-home`, `feat: screen-c-warendurchlauf`, `feat: ci-rollout-existing-pages`).
17. **Review-Build** auf Tablet realistisch testen, danach Branch-PR.

---

## 11. Annahmen (vom Builder bestätigen lassen)

| Annahme | Begründung | Bestätigung nötig? |
|---|---|---|
| Stack ist React + Vite + Tailwind (oder vergleichbar) | übliche Antigravity-Annahme | ja, falls Stack anders |
| Bestehende Routen heißen wie in Bottom-Nav-Tabelle | aus Bild 2/3 abgeleitet | ja, ggf. Mapping anpassen |
| Bestehende API-Endpunkte für KPIs existieren in ähnlicher Form | Modul war bisher aktiv | ja, ggf. neue Endpunkte ergänzen |
| Wetter darf Open-Meteo nutzen (kein API-Key, frei verfügbar) | Performance/Kosten/Datenschutz pragmatisch ok | nein, übliche Wahl |
| Logo-SVGs werden vor Build bereitgestellt (`/assets/logo/`) | Bilder 4, 5 zeigen Vorlagen | ja, ggf. SVG aus Vorlage erzeugen |

---

## 12. Offene Fragen (an den Nutzer)

1. Soll der Wake-Screen `/start` auch nach Idle automatisch erscheinen (z. B. nach 30 Min Inaktivität)? **Annahme: ja.**
2. Im aktiven Bottom-Nav-Tab „Warendurchlauf" auf Bild 3 ist die Pill in Navy. Soll für das Modul-Akzentkonzept (Orange) ein dezentes oranges Glow/Border ergänzt werden, oder bleibt der Stil identisch zu Bild 2 (Navy-Pill)? **Annahme: identisch zu Bild 2.**
3. PIN-Login auf Avatar-Kachel: bestehender Mechanismus oder neu? **Annahme: bestehend, falls vorhanden.**
4. „Performance"-Seite: aktueller Charting-Stack? Sollen Charts bestehen bleiben oder mit Recharts neu? **Annahme: bestehen lassen, nur Farben/Tokens angleichen.**

---

# ANHANG: Antigravity-Prompt zum direkten Einfügen

> Diesen Block 1:1 in Antigravity einfügen. Er verweist auf diese Spezifikation und gibt klare Reihenfolge sowie Sicherheitsregeln.

```
ROLLE: Du bist Senior-Fullstack-Engineer mit Fokus auf React/Tailwind, REST-APIs und Tablet-UI.

ZIEL: Setze die Spezifikation aus 08_VISUAL_OVERHAUL_V1_3SCREENS_CI.md vollständig um.
Die drei Hauptscreens (Wake/Start, Home/Tagesablauf, Warendurchlauf) müssen pixelnah
zu den drei mitgelieferten Referenzbildern aussehen. Hintergrundfarbe der gesamten App
ist #F5EFE3. Alle bestehenden Seiten (Performance, Aufträge, Anfragen, Teile, Kunden,
Lager, Scan, Mehr, sämtliche Submenüs, Modals, Drawer, Tabellen, Formulare) werden auf
dasselbe Design-System gehoben. KEINE bestehende Funktion darf entfernt werden.

SICHERHEIT (zwingend, vor Code-Änderung):
1. `git status` prüfen, offene Änderungen committen.
2. Branch `feat/visual-overhaul-v1` anlegen.
3. Tag `pre-visual-overhaul-v1` setzen.
4. Vorher-Screenshots aller Hauptscreens in /docs/before/.
5. Funktionsliste (Routen + Endpunkte) als /docs/functions-before.md erfassen.

ARBEITSREIHENFOLGE (Sektion 10 der Spezifikation):
1. Design-Tokens in src/styles/tokens.css.
2. Tailwind-Config auf Tokens mappen.
3. Logo-SVGs in src/assets/logo/.
4. App-Shell (Background, Header, BottomNav).
5. Generische Card-Komponenten in src/components/ui/.
6. Screen A: /start (Wake-Screen) — Pixel-Politur.
7. Screen B: / (Home/Tagesablauf) — neu aufbauen.
8. Screen C: /warendurchlauf — NEU implementieren.
9. Backend-Endpunkte gemäß Sektion 6 ergänzen oder anbinden.
10. Wetter-Service (Open-Meteo) + Greeting-Service.
11. CI-Rollout auf alle bestehenden Seiten (Sektion 7).
12. Performance-Seite auf neues System heben.
13. Playwright-Smoke-Tests inkl. Screenshot-Vergleich.
14. /docs/visual-overhaul-diff.md mit Vorher/Nachher + Funktionsliste.
15. Commit pro Sektion, am Ende Branch-PR.

QUALITÄTSREGELN:
- Keine Inline-Hex-Werte außerhalb tokens.css.
- Lucide-Icons ausschließlich, stroke-width 1.5.
- Keine Funktion entfernen, jede entfernte/ersetzte Route in der Diff-Doku vermerken
  und das jeweilige Feature in die neue Oberfläche überführen.
- Wenn eine Annahme aus Sektion 11 falsch ist: STOP, Frage stellen, nicht raten.
- Bei Stack-Inkompatibilität: STOP, Frage stellen.
- Vor `rm`, `--force`, DB-Migrationen, npm-uninstall: STOP, Plan + Zustimmung einholen.

ABNAHME-CHECK (am Ende):
- Sektion 9 der Spezifikation komplett durchgehen, jede Checkbox als erfüllt belegen.
- Screenshots der drei Hauptscreens neben die Referenzbilder legen.
- Funktions-Diff-Liste vor/nach: 0 verlorene Funktionen.

Spezifikationsdatei: 08_VISUAL_OVERHAUL_V1_3SCREENS_CI.md
Referenzbilder: bild1_wake.png, bild2_home.png, bild3_warendurchlauf.png, logo_ci_4.jpg, logo_5.png
```

---

**Ende der Spezifikation.**

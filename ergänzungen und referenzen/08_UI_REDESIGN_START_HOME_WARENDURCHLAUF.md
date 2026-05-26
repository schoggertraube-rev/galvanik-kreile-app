# Galvanik Kreile WerkstattCockpit — UI-Redesign nach 3 Referenzbildern

## Zweck dieser Datei

Diese Datei ist eine direkte Bauanweisung für Antigravity/Claude Code.  
Die bestehende Kreile-App soll **nicht neu gebaut**, sondern optisch und funktional so umgebaut werden, dass die drei gelieferten Oberflächen als neue Corporate-Identity-Grundlage dienen:

1. **Bild 1 — Warendurchlauf / Neue Annahme erfassen**  
2. **Bild 2 — Home / Tagesübersicht**  
3. **Bild 3 — neue Start-/Login-Oberfläche beim Einschalten des Tablets**

Wichtig: **Keine bestehende Funktion darf verschwinden.** Vorhandene Seiten wie Aufträge, Kunden, Teile, Scan, Lager, Performance, Verzug/Engpässe usw. bleiben erhalten und werden auf denselben Stil angepasst.

---

# 1. Nicht verhandelbare Projektregeln

## 1.1 Bestehende App nicht zerstören

Vor jeder Änderung:

1. Bestehende Routen, Komponenten, Styles, Datenquellen und Server Actions prüfen.
2. Keine funktionierende Funktion löschen.
3. Keine vorhandene Datenlogik ersetzen, wenn sie erweitert werden kann.
4. Supabase/Drizzle-StatusEvents und lokale Fallback-/PWA-Logik erhalten.
5. Bestehende Navigation nur optisch konsolidieren.
6. Jede neue Oberfläche modular bauen, damit spätere Änderungen einfach bleiben.

## 1.2 Zielbild

Die App soll wirken wie ein käufliches, professionelles Werkstatt-Cockpit:

- warm,
- hell,
- hochwertig,
- ruhig,
- tablet-tauglich,
- schnell erfassbar,
- handwerklich-seriös,
- nicht nach Standard-Dashboard,
- nicht nach Excel,
- nicht nach Website-Baukasten.

Die Referenz ist **nicht** „maximale Informationsdichte“, sondern:  
**Ein Meister muss im Vorbeigehen sehen, was wichtig ist.**

---

# 2. Bildzuordnung und Funktionszuordnung

## 2.1 Bild 1 — Seite „Warendurchlauf“

Diese Seite ersetzt/überarbeitet die bestehende Wareneingang-/Warendurchlauf-Oberfläche.

### Sichtbarer Inhalt

- links oben Logo „Galvanik Kreile“
- darunter „Meisterbetrieb seit 1962“
- globaler Header mit:
  - Suche
  - Kamera-Schnellbutton
  - Datum
  - Online-Status
  - Benachrichtigung
  - User-Kreis
- Prozessleiste:
  - Wareneingang
  - Galvanik
  - Warenausgang
  - Pfeile ohne Buttonwirkung
  - Statuspunkt bei Problem/Blocker
- Bereich „Neue Annahme erfassen“
  - große Kachel „Kamera“
  - große Kachel „Manuell anlegen“
  - kleinere mittige Kachel „Anfragen“ mit rotem Zähler
- Bereich „Letzte Annahmen“
- Hinweisleiste mit Tipp
- Bottom Navigation mit aktivem Punkt **Warendurchlauf**

### Funktionalität

- Kamera-Kachel öffnet vorhandene Kamera-/Scan-/Fotoerfassung.
- Manuell-Kachel öffnet vorhandenen manuellen Auftrag-/Annahme-Wizard.
- Anfragen-Kachel öffnet offene Angebots-/Website-/E-Mail-Anfragen.
- roter Zähler zeigt echte Anzahl offener Anfragen.
- Letzte Annahmen öffnet Liste der zuletzt angelegten Wareneingänge.
- Prozessleiste bleibt Informations-/Statusleiste, keine Fake-Buttons für Pfeile.
- Bottom Navigation navigiert wie bisher, nur optisch neu.

---

## 2.2 Bild 2 — Seite „Home“

Diese Seite ersetzt/überarbeitet die bestehende Home-/Heute-Seite.

### Sichtbarer Inhalt

- gleicher Header wie Bild 1
- KPI-Karten oben:
  - „So läuft’s heute“
  - „Offene Anfragen“
  - „In Galvanik“
  - „Warenausgang“
  - „Fertig heute“
- Tagesablauf links:
  - vertikale Timeline
  - erledigte Punkte mit Haken
  - aktueller Punkt markiert
  - kommende Punkte neutral
- rechte Spalte:
  - „Heute wichtig“
  - „Kleiner Hinweis zum Tag“
- Bottom Navigation mit aktivem Punkt **Home**

### Funktionalität

- KPI-Zahlen aus echten App-Daten oder vorhandenen Mockdaten berechnen.
- Timeline aus Tagesaufgaben, StatusEvents und fälligen Aufgaben generieren.
- Buttons wie „Ansehen“ öffnen betroffene Aufträge/Anfragen.
- „Heute wichtig“ enthält echte Warnungen: Material, Freigaben, Warenausgang, Engpässe.
- „Kleiner Hinweis zum Tag“ wird aus Tageslage, Wetter und nächstem Ziel generiert.
- Bottom Navigation: Home aktiv dunkel hinterlegt; Warendurchlauf normal.

---

## 2.3 Bild 3 — neue Start-/Login-Oberfläche

Diese Seite existiert bisher nicht und muss neu gebaut werden.

### Ziel

Beim Einschalten des Tablets erscheint zunächst eine ruhige Startfläche.  
Dort wählt der Mitarbeiter seinen Benutzer aus und gibt einen PIN/Code ein.

### Sichtbarer Inhalt

- kein App-Header
- keine Bottom Navigation
- zentral großes Kreile-Logo mit Skyline
- Claim „Galvanik · Veredlung“
- „Meisterbetrieb seit 1962“
- Begrüßung je nach Tageszeit
- oben rechts WhatsApp-artige Wetter-/Tagesnotiz
- zentrale Prioritätskachel „Zuerst steht an: …“
- Benutzerkacheln:
  - exakt eine Kachel pro angelegtem Nutzer
  - Initialen groß
  - kleines Funktionssymbol darunter
  - keine Rollenbeschriftung wie „Meister“, „Werkstatt“, „Buchhaltung“ innerhalb der Kacheln
- PIN-Dialog nach Klick auf Benutzerkachel

### Funktionalität

- Nutzerliste aus vorhandenen User-/Mockdaten/Supabase ziehen.
- Anzahl Kacheln entspricht exakt der Anzahl angelegter Nutzer.
- Klick auf User-Kachel öffnet PIN-Eingabe.
- PIN korrekt: Session setzen und zu `/home` weiterleiten.
- PIN falsch: kurze ruhige Fehlermeldung, keine grelle Alarmfläche.
- Session kann lokal gespeichert werden, damit erneutes Entsperren optional schneller geht.
- Abmeldung führt zurück zur Startfläche.
- Begrüßung, Wettertext und Prioritätskachel sind dynamisch.

---

# 3. Einheitliche Corporate Identity

## 3.1 Hintergrundfarbe

Alle drei Seiten und später alle weiteren Seiten sollen die Hintergrundfarbe aus **Bild 1** erhalten.

### Globaler App-Hintergrund

```css
--kreile-bg: #FCF9F6;
```

Diese Farbe gilt für:

- `body`
- App-Shell
- Startscreen
- Home
- Warendurchlauf
- Performance
- Aufträge
- Kunden
- Teile
- Lager
- Scan
- Einstellungen
- Detailseiten
- Modals, sofern sie nicht bewusst auf Kartenebene liegen

## 3.2 Farbvariablen

In `globals.css`, `tailwind.config.ts` oder einem zentralen Theme-File definieren:

```css
:root {
  --kreile-bg: #FCF9F6;
  --kreile-surface: #FFFFFF;
  --kreile-surface-warm: #FFF6EA;
  --kreile-surface-soft: #FEFBF7;

  --kreile-navy: #001B38;
  --kreile-navy-soft: #0B2748;
  --kreile-text: #10223A;
  --kreile-muted: #667085;

  --kreile-accent: #F28A0C;
  --kreile-accent-soft: #FFE7C2;
  --kreile-sand: #F4E8D6;
  --kreile-gold-muted: #A87922;

  --status-green: #4F8A2D;
  --status-green-soft: #EDF6E7;
  --status-yellow: #F2B84B;
  --status-orange: #F28A0C;
  --status-orange-soft: #FFF1DE;
  --status-red: #E20B0B;
  --status-red-soft: #FFE3E1;
  --status-gray: #E8E9EA;

  --shadow-soft: 0 16px 40px rgba(16, 34, 58, 0.08);
  --shadow-card: 0 10px 28px rgba(16, 34, 58, 0.07);
  --radius-xl: 24px;
  --radius-lg: 18px;
  --radius-pill: 999px;
}
```

## 3.3 Stilregeln

- Keine harten Schwarz-Weiß-Kontraste außer Logo/Icons.
- Dunkelblau für aktive Navigation und Haupttext.
- Orange/Kupfer nur als Akzent, nicht flächig übertreiben.
- Sand/Beige für warme Prozessflächen.
- Weiß für Karten.
- Rot nur für echte Störung, offene Anfrage-Zähler oder Warnstatus.
- Schatten weich, großflächig und diffus.
- Alle Karten mit großen Radien, nicht eckig.

---

# 4. Globales Layout

## 4.1 AppShell

Erstelle/überarbeite eine zentrale AppShell:

```text
src/components/layout/AppShell.tsx
src/components/layout/AppHeader.tsx
src/components/layout/BottomNav.tsx
src/components/layout/KreileLogoBlock.tsx
```

### AppShell-Regeln

- App-Hintergrund immer `var(--kreile-bg)`.
- Header und BottomNav global gleich.
- Seiteninhalt max. Breite wie in Bildern, aber responsiv.
- Auf Tablet quer optimiert.
- PC darf breiter sein, aber Inhalte nicht endlos auseinanderziehen.
- Mobile bekommt kompaktere Navigation.

## 4.2 Header

Header nach Bild 1 und Bild 2 vereinheitlichen.

### Muss enthalten

- Logo links
- Suchfeld:
  - Auftrag
  - Kunde
  - Teilenummer
  - Oberfläche
  - Station
  - Notiz-Schlagwörter
- Kamera-Schnellbutton
- Datum
- Online-Status
- Benachrichtigungsglocke mit Badge
- User-Kreis

### Verhalten

- Suche global; Enter öffnet Suchergebnis-Overlay oder gefilterte Seite.
- Kamera öffnet Scan/Kamera-Funktion.
- Datumskachel öffnet optional Tagesfilter/Kalender.
- Online zeigt tatsächlichen Sync-/Netzwerkstatus.
- Glocke zeigt Benachrichtigungen.
- User-Kreis öffnet Profil/Abmelden.

## 4.3 Bottom Navigation

Bottom Navigation nach Bild 1/2 vereinheitlichen.

### Reihenfolge

1. Home
2. Aufträge
3. Anfragen
4. Teile
5. Kunden
6. Warendurchlauf
7. Lager
8. Scan
9. Mehr

### Aktiver Zustand

- aktiver Punkt: dunkelblaue, längliche Kachel
- Icon und Text im aktiven Punkt hell/orange
- inaktive Punkte: schwarzes/dunkles Icon, normaler Text
- vertikale Trenner dezent
- keine überladenen Hover-Effekte

### Wichtig

Wenn Seite `Warendurchlauf` aktiv ist:

- Warendurchlauf dunkel hinterlegt
- Home normal

Wenn Seite `Home` aktiv ist:

- Home dunkel hinterlegt
- Warendurchlauf normal

---

# 5. Seite „Start/Login“ neu bauen

## 5.1 Route

Empfohlen:

```text
src/app/start/page.tsx
```

oder bei bestehendem Auth-Routing:

```text
src/app/(auth)/start/page.tsx
```

Weiterleitung:

```text
/           -> wenn keine Session: /start
/start      -> Login-/Startscreen
/home       -> Home nach Login
```

## 5.2 Komponenten

```text
src/components/start/StartScreen.tsx
src/components/start/UserTile.tsx
src/components/start/PinDialog.tsx
src/components/start/DailyStartMessage.tsx
src/components/start/WeatherBubble.tsx
src/lib/greeting.ts
src/lib/session.ts
```

## 5.3 Layout-Vorgabe

- Hintergrund `#FCF9F6`
- Logo zentral oben/mittig, groß
- Skyline als feine Liniengrafik über Logo
- Startscreen darf luftiger sein als die Arbeitsseiten
- Wetter-/Tagesnotiz oben rechts als helle Karte
- Prioritätskachel unter Begrüßung
- User-Kacheln in einer Reihe, bei mehr Nutzern als Grid

## 5.4 Begrüßungslogik

In `src/lib/greeting.ts`:

```ts
export function getGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 11) return "Guten Morgen, Meister!";
  if (hour >= 11 && hour < 14) return "Willkommen zurück vom Essen!";
  if (hour >= 14 && hour < 18) return "Willkommen zurück, Meister!";
  if (hour >= 18 && hour < 23) return "Guten Abend, Meister!";
  return "Ruhige Nachtschicht, Meister!";
}
```

## 5.5 Prioritätskachel

Nicht statisch bauen.  
Die Kachel zieht die nächste wichtigste Aufgabe aus der App-Logik.

Beispiele:

```text
Zuerst steht an: 3 Teile in den Versand bringen.
Wenn das bis 11:30 Uhr erledigt ist, bleibt der Nachmittag entspannt.
```

```text
Zuerst steht an: 2 Freigaben klären.
Dann können die wartenden Aufträge in die Vorarbeit.
```

```text
Zuerst steht an: Salzsäure-Bestand prüfen.
Bestellung heute nicht vergessen.
```

Logik:

1. kritisch/überfällig
2. heute fällig
3. offene Freigaben
4. Materialmangel
5. Versand/Abholung
6. Tagesabschluss

## 5.6 Wetter-/Tagesnotiz

Die Karte oben rechts soll funktional sein.

### Datenquellen

- Primär: echte Wetter-API über zentrale Funktion `getWeatherSummary()`
- Fallback: Mockdaten, wenn API-Key fehlt
- Standort konfigurierbar, Standard: Frankfurt am Main

### Inhalt

- Wetterlage
- Temperatur
- Tageslicht-/Resthelligkeits-Hinweis
- kurze positive, aber konkrete Tagesnotiz
- Uhrzeit
- kleiner Haken/Lesestatus

Beispiel:

```text
Heute: 20°C und noch 4 Stunden hell – perfekte Bedingungen, um nach Feierabend noch kurz an den Main zu gehen.
08:42
```

## 5.7 PIN-Dialog

- nach Klick auf UserTile öffnen
- 4- bis 6-stelliger Code
- optional numerisches Pad
- nach 3 Fehlversuchen kurze Sperrzeit
- kein permanenter Klartext
- PIN später durch echte Auth ersetzbar
- Startscreen bleibt optisch ruhig

---

# 6. Seite „Home“ nach Bild 2 bauen

## 6.1 Route

Bestehende Home-/Heute-Seite verwenden. Nicht neu daneben bauen, außer temporär als Preview.

Mögliche Dateien prüfen:

```text
src/app/page.tsx
src/app/home/page.tsx
src/app/(app)/home/page.tsx
src/components/pages/HomePage.tsx
```

## 6.2 Komponenten

```text
src/components/home/HomeDashboard.tsx
src/components/home/HomeKpiRow.tsx
src/components/home/HomeKpiCard.tsx
src/components/home/DayTimeline.tsx
src/components/home/ImportantTodayPanel.tsx
src/components/home/DailyHintCard.tsx
```

## 6.3 KPI-Reihe oben

Die fünf Karten aus Bild 2 als wiederverwendbare KPI-Karten bauen.

### Karte 1: Tagesstimmung

```text
So läuft’s heute
Gut auf Kurs
Weiter so!
```

Datenbasis:

- kritische Aufträge
- erledigte Tagespunkte
- offene Engpässe
- Versandziel

Regel:

- keine kritischen und Tagesfortschritt gut: „Gut auf Kurs“
- offene kritische Punkte: „Aufpassen“
- viele rote Punkte: „Eingreifen nötig“

### Karte 2: Offene Anfragen

- Zahl groß
- darunter „davon X neu“
- Progressbar dezent
- Klick öffnet Anfragen-Seite

### Karte 3: In Galvanik

- Zahl groß
- Hinweis „X kritisch“
- orange Progressbar
- Klick filtert Aufträge/Teile nach Station Galvanik

### Karte 4: Warenausgang

- Zahl groß
- Hinweis „X heute fällig“
- grüne Progressbar
- Klick öffnet Warenausgang/Lager/Versand-Kontext

### Karte 5: Fertig heute

- Zahl groß
- kurzer Text „Super!“ oder neutraler Status
- Klick öffnet abgeschlossene Tagesaufträge

## 6.4 Tagesablauf-Timeline

Timeline links, wie Bild 2:

- Zeit links
- vertikale Linie
- Statuspunkte:
  - erledigt: grüner Haken
  - aktuell: orange Kreis/Uhr
  - Pause: sandfarbener Kreis
  - kommend: grauer Punkt
- pro Eintrag:
  - Titel fett
  - Unterzeile kurz
  - optional Aktionsbutton rechts

Beispieldaten:

```text
08:00 Wareneingang geprüft — Alle Eingänge erfasst.
09:15 3 Teile in Galvanik gestartet — Sie laufen planmäßig.
11:30 Anfragen sortieren — 7 Anfragen warten auf Rückmeldung.
12:30 Mittagspause — Gönn dir was!
14:30 Versand vorbereiten — 6 Aufträge bereitstellen.
16:30 Tagesabschluss — Offene Punkte prüfen & abschließen.
```

## 6.5 „Heute wichtig“

Rechte Karte mit 3–5 Einträgen:

- Icon
- Statusfarbe
- Titel
- Untertitel
- Pfeil rechts
- Klick öffnet Detail/Filter

Beispiele:

```text
Salzsäure fast leer — Bestellung nicht vergessen.
2 Freigaben fehlen — Kunden warten auf Rückmeldung.
Warenausgang im Plan — Heute 4 Abholungen geplant.
```

## 6.6 „Kleiner Hinweis zum Tag“

Funktional aus `DailyAssistantMessage` generieren.

Inputs:

- Wetter
- Uhrzeit
- offene Aufgaben
- Feierabend-/Tagesabschluss-Zeit
- kritische Materialhinweise

Der Text muss kurz bleiben. Keine langen Motivationsreden.

---

# 7. Seite „Warendurchlauf“ nach Bild 1 bauen

## 7.1 Route

Bestehende Wareneingang-/Scan-/Warendurchlauf-Struktur prüfen und darauf aufbauen.

Empfohlen:

```text
src/app/(app)/warendurchlauf/page.tsx
```

oder bestehende Route erweitern:

```text
src/app/wareneingang/page.tsx
```

Falls es bereits `Wareneingang` gibt, Menülabel auf **Warendurchlauf** ändern, Funktion intern aber nicht löschen.

## 7.2 Komponenten

```text
src/components/flow/WorkflowStrip.tsx
src/components/flow/NewIntakeSection.tsx
src/components/flow/IntakeActionCard.tsx
src/components/flow/InquiryMiniCard.tsx
src/components/flow/RecentIntakesRow.tsx
src/components/flow/FlowTipBar.tsx
```

## 7.3 Prozessleiste oben

### Aufbau

- große sandfarbene Fläche
- drei Stationen:
  - Wareneingang
  - Galvanik
  - Warenausgang
- jede Station:
  - Titel oben
  - weiße Kachel darunter
  - Icon mittig
- Pfeile zwischen Stationen:
  - orange Linienpfeil
  - nicht klickbar
  - Cursor normal, nicht `pointer`
  - keine runden Buttonflächen
- Problem-Badge:
  - kleiner roter Punkt an betroffener Station
  - optional Tooltip/Klick auf Station, nicht auf Pfeil

### Zweck

Die Prozessleiste ist eine klare Orientierung:  
**Wo kommen Sachen rein, wo laufen sie, wo gehen sie raus?**

## 7.4 „Neue Annahme erfassen“

### Kachel „Kamera“

- links großes rundes Iconfeld
- Text:
  - „Kamera“
  - „Foto aufnehmen“
- rechts runder Pfeilbutton
- Klick:
  - öffnet Kamera-/Scanprozess
  - bei Tablet: Kamera aktivieren
  - bei PC: Dateiupload/Fallback ermöglichen

### Kachel „Manuell anlegen“

- Text:
  - „Manuell anlegen“
  - „Ohne Scan erfassen“
- Klick:
  - öffnet manuellen Wareneingangswizard
  - bestehende Funktion behalten

### Kachel „Anfragen“

- mittig unter den beiden großen Kacheln
- kleiner als Kamera/Manuell
- roter Badge mit Anzahl offener Anfragen
- Text:
  - „Anfragen“
  - „Offene Angebotsanfragen“
- Klick:
  - öffnet Anfragen-Seite oder Drawer

## 7.5 Letzte Annahmen

- ruhige, breite Karte
- Icon links
- Text „Letzte Annahmen anzeigen“
- Pfeil rechts
- Klick öffnet Liste/Drawer mit letzten Wareneingängen

## 7.6 Tipp-Leiste

- warmer Sand-/Orange-Hintergrund
- Info-Icon links
- kurzer Tipp
- rechts Link „So funktioniert’s“
- Klick öffnet kurzen Hilfe-Drawer

Beispiel:

```text
Tipp: Scanne Lieferschein, Zettel oder Kundenbegleitschreiben für schnellere Erfassung.
```

---

# 8. Alle anderen Seiten auf denselben Stil bringen

## 8.1 Betroffene Seiten

- Aufträge
- Anfragen
- Teile
- Kunden
- Lager
- Scan
- Performance
- Verzug & Engpässe
- Einstellungen
- Detailseiten
- Modals/Drawer

## 8.2 Einheitliche Anpassung

Für alle Seiten:

- Hintergrund `#FCF9F6`
- gleicher Header
- gleiche BottomNav
- gleiche Kartenradien
- gleiche Schatten
- gleiche Statusfarben
- gleiche Typografie
- gleiche Icon-Sprache
- keine alten gelben Standardflächen
- keine verstreuten Farben
- keine harten Tabellenflächen ohne Kartenstruktur

## 8.3 Performance-Seite

Die Performance-Seite bleibt funktional, aber wird optisch dem Stil angepasst:

- KPI-Karten wie Home-Karten
- große Zahlen
- warme weiße Karten
- Statusfarben nach zentralem Token
- keine Excel-Optik
- Diagramme ruhig und funktional
- Heatmap als Kartenmatrix im Kreile-Stil
- Empfehlungen als konkrete Handlungskarten

## 8.4 Aufträge/Teile/Kunden

Diese Seiten behalten ihre Datenlogik, erhalten aber:

- Suchfeld/Filter oben in einheitlicher Optik
- Karten statt Tabellenwüste
- Detailpanel/Drawer mit gleichen Radien
- StatusBadge aus zentraler Komponente
- PriorityIndicator aus zentraler Komponente
- Aktionsbuttons in dunkelblau/orange

---

# 9. Funktionale Anforderungen, die zwingend bleiben oder neu entstehen

## 9.1 Suche

Globale Suche muss funktionieren für:

- Auftragsnummer
- Kunde
- Teilenummer
- Oberfläche
- Station
- Telefonnummer
- Notizen
- Anfrage

## 9.2 Kamera/Scan

- Kamera-Button im Header
- Kamera-Kachel auf Warendurchlauf
- Scan-Menüpunkt unten
- Dateiupload-Fallback für PC
- vorhandene Foto-/OCR-Logik nicht entfernen
- bei fehlender echter OCR: Demo-OCR als fallbackfähig kapseln

## 9.3 Anfragen

- Anfragen müssen als eigene Navigation sichtbar bleiben.
- Warendurchlauf-Seite zeigt Anzahl offener Anfragen.
- Neue Website-/E-Mail-Anfragen sollen in Warendurchlauf/Wareneingang einlaufen.
- Anfragen dürfen nicht im UI verschwinden.

## 9.4 Wetter und Tageskommentar

Funktionstüchtig bauen:

```text
src/lib/weather.ts
src/lib/dailyAssistant.ts
```

### `weather.ts`

- echte API später konfigurierbar
- Mockfallback
- Standort aus Settings
- Temperatur
- Wetterlage
- Tageslicht/Resthelligkeit

### `dailyAssistant.ts`

- nimmt Wetter, Uhrzeit, Aufgaben und Engpässe
- erzeugt kurze Texte für:
  - Startscreen-Wetterbubble
  - Home-Karte „Kleiner Hinweis zum Tag“
  - Prioritätskachel auf Startscreen

## 9.5 Benachrichtigungen

Badge an Glocke zeigt echte Anzahl:

- kritische Aufträge
- offene Freigaben
- neue Anfragen
- Materialwarnungen
- Versand heute fällig

## 9.6 Online-Status

Online-Kachel zeigt echten Sync-/Network-Status:

- grün: online/synchronisiert
- orange: offline oder Sync-Warteschlange
- Zahl-Badge: ausstehende Sync-/Event-/Aufgabenanzahl

---

# 10. Daten- und State-Anforderungen

## 10.1 Zentral definieren

Prüfen/erstellen:

```text
src/constants/navigation.ts
src/constants/theme.ts
src/constants/status.ts
src/constants/stations.ts
src/lib/priority.ts
src/lib/nextAction.ts
src/lib/dailyAssistant.ts
src/lib/weather.ts
src/lib/session.ts
```

## 10.2 Beispieltypen

```ts
export type AppUser = {
  id: string;
  initials: string;
  displayName?: string;
  icon: "tools" | "wrench" | "calculator" | "user";
  pinHash?: string;
  role?: "master" | "workshop" | "office" | "admin";
  active: boolean;
};

export type DailyImportantItem = {
  id: string;
  severity: "info" | "watch" | "warning" | "critical" | "success";
  title: string;
  description: string;
  targetRoute?: string;
  targetFilter?: Record<string, string>;
};

export type IntakeCountSummary = {
  openInquiries: number;
  newInquiries: number;
  recentIntakes: number;
  inGalvanik: number;
  inWarenausgang: number;
  dueToday: number;
  critical: number;
};
```

## 10.3 Keine redundante UI-Logik

Counts und Status nicht in Komponenten berechnen, sondern in Lib-Funktionen/Selectors:

```text
src/lib/selectors/dashboard.ts
src/lib/selectors/flow.ts
src/lib/selectors/notifications.ts
```

---

# 11. Umsetzungsschritte für Antigravity

## Schritt 1 — Audit

Analysiere zuerst:

- aktuelle Routen
- aktuelle Navigation
- bestehende Header-/Layout-Komponenten
- vorhandene Scan-/OCR-/Kamera-Funktionen
- vorhandene Anfrage-Funktionen
- vorhandene Performance-Seite
- vorhandene Datenquellen
- Supabase/Drizzle- und localStorage-Verhalten

Dann kurze Liste ausgeben:

```text
Gefundene Dateien:
- ...
Geplante Änderungen:
- ...
Risiken:
- ...
```

## Schritt 2 — Theme-Tokens einführen

- `--kreile-bg` und übrige Tokens global setzen.
- Hardcoded Farben schrittweise ersetzen.
- Kein vollständiger CSS-Neubau ohne Notwendigkeit.

## Schritt 3 — AppShell/Header/BottomNav vereinheitlichen

- Header wie Bild 1/2 bauen.
- BottomNav wie Bild 1/2 bauen.
- Navigation-Konfiguration zentralisieren.
- Aktiver Zustand route-basiert.
- Alte Nav nicht ersatzlos entfernen; vorher sicherstellen, dass alle Seiten erreichbar bleiben.

## Schritt 4 — Startscreen bauen

- neue Route `/start`
- UserTiles aus Userdaten
- PIN-Dialog
- Greeting-Logik
- Wetterbubble
- Prioritätskachel
- Redirect nach Login
- Abmelden zurück zu `/start`

## Schritt 5 — Home nach Bild 2 umbauen

- KPI-Zeile
- Timeline
- Heute-wichtig-Panel
- Daily-Hint-Karte
- vorhandene Daten anbinden
- Buttons zu echten Seiten/Filtern verbinden

## Schritt 6 — Warendurchlauf nach Bild 1 umbauen

- Prozessleiste
- Kamera/Manuell/Anfragen-Kacheln
- Letzte Annahmen
- Tipp-Leiste
- echte Count-Anbindung
- vorhandene Scan-/Manual-Create-Funktion weiterverwenden

## Schritt 7 — restliche Seiten stilistisch anpassen

- Hintergrund
- Header
- BottomNav
- Karten
- Buttons
- StatusBadges
- Panels/Drawer
- Performance im gleichen Stil
- keine Funktion entfernen

## Schritt 8 — Funktionstest

Prüfen:

1. Startscreen erscheint ohne Session.
2. PIN-Login funktioniert.
3. Home öffnet nach Login.
4. BottomNav navigiert zu allen Seiten.
5. Aktiver Menüpunkt stimmt.
6. Warendurchlauf zeigt aktive Warendurchlauf-Kachel.
7. Home zeigt aktive Home-Kachel.
8. Kamera-Button funktioniert.
9. Manuell anlegen funktioniert.
10. Anfragen öffnen sich und Badge zählt korrekt.
11. Wetter-/Tageshinweise zeigen echte oder fallbackfähige Daten.
12. Performance bleibt erreichbar und ist im neuen Stil.
13. Keine bestehende Funktion ist verschwunden.
14. App startet fehlerfrei.
15. Tablet-Querformat sieht wie Referenz aus.

---

# 12. Akzeptanzkriterien

Die Umsetzung ist erst akzeptabel, wenn:

- alle drei Referenzseiten klar wiedererkennbar sind,
- alle Seiten denselben Hintergrund aus Bild 1 verwenden,
- Header und BottomNav auf Home und Warendurchlauf identisch wirken,
- Startscreen neu vorhanden ist,
- Nutzerkacheln dynamisch aus Nutzerdaten entstehen,
- PIN-/Code-Login funktioniert,
- Tageszeit-Begrüßung korrekt wechselt,
- Wetter-/Kommentar-/Hinweiskarten funktional sind,
- alle bestehenden App-Funktionen weiterhin erreichbar sind,
- Performance und andere Seiten den neuen CI-Stil übernehmen,
- keine gelb/orangen Altflächen mehr den Stil brechen,
- Statusfarben zentral definiert sind,
- kritische Zustände deutlich sichtbar bleiben,
- die App auf Tablet und PC hochwertig wirkt.

---

# 13. Kurzer Ausführungsprompt für Antigravity

```text
Setze die bestehende Galvanik-Kreile-WerkstattCockpit-App gemäß dieser Markdown-Datei um. Baue die App nicht neu, sondern ersetze/überarbeite die existierenden Oberflächen so, dass sie den drei Referenzbildern entsprechen: Warendurchlauf, Home und neuer Start-/Login-Screen. Nutze überall die Hintergrundfarbe aus Bild 1 (#FCF9F6). Erhalte alle bestehenden Funktionen, Datenquellen, Routen und Aktionen. Baue eine zentrale AppShell mit einheitlichem Header und Bottom Navigation. Erstelle den neuen Startscreen mit dynamischen Nutzerkacheln, PIN-Login, tageszeitabhängiger Begrüßung, Wetter-/Tagesnotiz und nächster Prioritätsaufgabe. Überarbeite Home und Warendurchlauf exakt nach den Referenzlayouts. Passe anschließend alle weiteren Seiten wie Performance, Aufträge, Anfragen, Teile, Kunden, Lager und Scan an dieselbe Corporate Identity an. Zentrale Farben, Statuslogik, Navigation, Wetter-/DailyAssistant-Logik und Counts müssen gekapselt werden. Keine Funktion darf verschwinden. Arbeite iterativ, teste nach jedem Schritt und gib vor riskanten Änderungen die betroffenen Dateien aus.
```

---

# 14. Empfohlener Ablageort

Diese Datei in das Projekt legen unter:

```text
/docs/antigravity/08_UI_REDESIGN_START_HOME_WARENDURCHLAUF.md
```

Die drei Referenzbilder zusätzlich ablegen unter:

```text
/docs/design-references/01_warendurchlauf.png
/docs/design-references/02_home.png
/docs/design-references/03_start_login.png
```

Danach Antigravity mit dem Kurzprompt aus Abschnitt 13 starten und ausdrücklich sagen, dass diese Datei zusammen mit den bestehenden Projekt-MDs geprüft werden muss.

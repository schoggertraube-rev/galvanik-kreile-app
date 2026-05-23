# Kreile WerkstattCockpit — Navigation, Startseite und Werkstattfluss

## Ziel

Diese Datei definiert die neue Informationsarchitektur und Haptik der App nach Login.

Die bisherige linke Navigation wird nicht zerstört, aber neu gewichtet. Der Werkstattfluss wird oben über die gesamte Breite geführt. Die Sidebar bleibt für Leitstand, Archiv, Analyse und Einstellungen.

## Problem im aktuellen Stand

Die Screenshots zeigen:

- Sidebar links mit Werkstattfluss und Kontrolle/Archiv.
- Der Werkstattfluss wirkt dadurch wie Navigation, nicht wie operativer Produktionsfluss.
- „Kontrolle & Archiv“ enthält mehrere Punkte, die teilweise noch keine klare Funktion haben.
- Es ist nicht immer eindeutig, wo man sich gerade befindet.
- Stationsbuttons zeigen noch nicht konsequent den aktuellen Problemstatus.
- Nach Login fehlt eine echte Orientierungsseite.

## Neue Grundstruktur

```text
App Shell
├── Header oben
│   ├── globale Suche
│   ├── Tagesstatus / Datum
│   ├── kritische Benachrichtigungen
│   └── Nutzerprofil
├── Werkstattfluss oben über volle Breite
│   ├── Wareneingang
│   ├── Lager
│   ├── Galvanik / Entmetallisierung
│   ├── Schleiferei
│   ├── Veredelung / Galvanik
│   ├── Warenausgang
│   └── Button: Heutiger Tag
├── Sidebar links kompakt
│   ├── Start
│   ├── Alle Aufträge
│   ├── Kundenkartei
│   ├── Verzug & Engpässe
│   ├── Performance
│   ├── Kontrolle & Archiv (Untermenü)
│   └── Einstellungen
└── Arbeitsbereich
    ├── Karten / Listen / Detailpanel
    └── Drawer / Modal für Bearbeitung
```

## Startseite nach Login

### Zweck

Die Startseite ist keine Deko-Seite. Sie gibt Orientierung und führt zum richtigen Handeln.

### Inhalte

Pflicht:

- Kreile Logo / WerkstattCockpit.
- Begrüßung je nach Uhrzeit und Login.
- Kompakte Tageszusammenfassung.
- Drei bis vier priorisierte Handlungen.
- Button zum heutigen Tag.
- Button zum Wareneingang.
- Button zu kritischen Punkten.

### Beispieltext

```text
Guten Morgen, Max.
Heute sind 7 Aufträge aktiv.
1 kritisch, 2 gefährdet, 3 im Plan.
Aktueller Engpass: Schleiferei.
```

### Layout

```text
+---------------------------------------------------------------+
| Kreile WerkstattCockpit                         Suche / User  |
+---------------------------------------------------------------+
|                                                               |
|          [Logo]                                               |
|          Guten Morgen, Max.                                   |
|          Heute zählt: 1 kritisch · 2 gefährdet · 3 im Plan     |
|                                                               |
|          [ Zum heutigen Tag ]  [ Wareneingang ] [ Kritisch ]   |
|                                                               |
|  Tageskarten:                                                  |
|  - Schleiferei kritisch: 5 Teile warten                        |
|  - 2 Kundenfreigaben offen                                     |
|  - Warenausgang: 1 Auftrag fertig                              |
|                                                               |
+---------------------------------------------------------------+
```

## Begrüßungslogik

```ts
type Greeting = "Guten Morgen" | "Guten Tag" | "Guten Abend";

function getGreeting(hour: number): Greeting {
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}
```

Der Name kommt aus dem Loginprofil.

## Werkstattfluss oben

### Anforderungen

Der Werkstattfluss muss sofort sichtbar sein und über die gesamte Breite laufen.

Jeder Stationsbutton zeigt:

- Icon,
- Stationsname,
- Statusfarbe,
- Anzahl wartender/aktiver Teile,
- optional kritischste Meldung als kurze Zahl oder Punkt.

### Stationen

```text
1. Wareneingang
2. Lager
3. Galvanik / Entmetallisierung
4. Schleiferei
5. Veredelung / Galvanik
6. Warenausgang
```

### Button-Status

| Zustand | Button-Wirkung |
|---|---|
| im Plan | weiß/grau mit grünem Punkt |
| beobachten | gelber Punkt oder gelber Rand |
| gefährdet | orange Rand und Zahl |
| kritisch | roter Rand, roter Punkt, stärkere Fläche |
| aktiv ausgewählt | grauer/hellblauer Hintergrund, leichte Erhöhung |
| blockiert | blau-grau mit Pausen-/Blocker-Symbol |

### Keine Legende

Nicht schreiben:

```text
Rot bedeutet kritisch.
```

Stattdessen direkt:

```text
Schleiferei · 5 warten · kritisch
```

## Heutiger Tag als eigener Button

Neben dem Werkstattfluss gibt es einen Button:

```text
Heute
```

Dieser Button ist ebenfalls ein Statusindikator.

Beispiele:

| Tageslage | Darstellung |
|---|---|
| alles stabil | neutral/weiß mit grünem Punkt |
| einige Warnungen | gelb/orange |
| kritischer Verzug | rot |

Klick führt zur Tagesansicht / Leitstand.

## Sidebar: Verschlankung

Die linke Sidebar soll nicht mehr den vollständigen Werkstattfluss tragen. Sie wird ruhiger.

### Neue Sidebar-Struktur

```text
Start
Alle Aufträge
Kundenkartei
Verzug & Engpässe
Performance
Kontrolle & Archiv ▾
Einstellungen
```

### Kontrolle & Archiv

Dieser Bereich wird ein Untermenü oder ein eigener Button mit großem Untermenü.

Darin:

- Qualitätskontrolle,
- Nacharbeit,
- Archiv,
- abgeschlossene Aufträge,
- Dokumentenarchiv,
- Export.

Wichtig: Nichts löschen, bevor geprüft wurde, ob es gebraucht wird. Aber Dopplungen konsolidieren.

## Aktive Position sichtbar machen

Der Nutzer muss jederzeit sehen:

- in welcher Hauptsektion er ist,
- in welcher Station er ist,
- ob es dort ein Problem gibt.

### UI-Regel

Aktiver Bereich:

- heller grauer Hintergrund,
- dezenter Schatten,
- stärkerer Text,
- Statuspunkt links oder oben,
- keine grelle Fläche bei normalen Zuständen.

Kritischer Bereich:

- roter Akzent unabhängig vom aktiven Zustand,
- aber nicht die gesamte App rot färben.

## Wareneingang und Lagerverbindung

Der Lagerbutton darf im Wareneingang sichtbar sein, weil Wareneingang und Lager fachlich eng zusammenhängen.

Umsetzung:

- Auf der Wareneingangsseite unterhalb der zwei Hauptbuttons ein kleiner Bereich:

```text
Direkt weiter:
[Lagerbestand prüfen] [Letzte Annahmen] [Kundenprofil öffnen]
```

Diese Buttons sind sekundär. Sie dürfen den Kamera/Manuell-Fokus nicht stören.

## Globale Suche

Die Suche bleibt zentral.

Sie sucht nach:

- Auftragsnummer,
- Kundennamen,
- Teilenummer,
- Material,
- Oberfläche,
- Station,
- Telefonnummer,
- Notiz-Schlagwort,
- Lagerartikel,
- Badnummer.

Bei Treffer wird das passende Detailpanel geöffnet.

## Komponenten

Antigravity soll diese Komponenten prüfen oder erstellen:

```text
src/components/layout/AppShell.tsx
src/components/layout/AppHeader.tsx
src/components/layout/TopWorkflowBar.tsx
src/components/layout/SidebarNav.tsx
src/components/layout/ArchiveControlMenu.tsx
src/components/dashboard/HomeWelcome.tsx
src/components/dashboard/TodaySummaryStrip.tsx
src/components/status/StationStatusButton.tsx
src/components/status/TodayStatusButton.tsx
```

## Routen

Empfohlene Routen:

```text
/                           Startseite
/today                      Der heutige Tag
/station/wareneingang       Wareneingang
/station/lager              Lager
/station/entmetallisierung  Galvanik / Entmetallisierung
/station/schleiferei        Schleiferei
/station/veredelung         Veredelung / Galvanik
/station/warenausgang       Warenausgang
/orders                     Alle Aufträge
/customers                  Kundenkartei
/bottlenecks                Verzug & Engpässe
/performance                Performance
/archive                    Kontrolle & Archiv
/settings                   Einstellungen
```

Falls bestehende Routen anders heißen, nicht blind ändern. Erst Redirects oder Mapping nutzen.

## Akzeptanzkriterien

- Nach Login erscheint eine Startseite mit Logo, Begrüßung und minimalem Tagesdruck.
- Der Werkstattfluss läuft horizontal oben über die volle Breite.
- Jeder Stationsbutton kann abhängig von Problemstatus die Farbe ändern.
- „Heute“ ist als Button neben dem Werkstattfluss sichtbar und statusfähig.
- Sidebar ist kompakter und nicht doppelt mit dem Werkstattfluss.
- Aktive Seite und aktive Station sind eindeutig sichtbar.
- Keine Funktion verschwindet ohne Ersatz.
- Keine toten Buttons bleiben bestehen.

# Kreile WerkstattCockpit — Master-Anweisung für Antigravity

## Ziel

Baue die bestehende Kreile-WerkstattCockpit-App **nicht neu von null**, sondern entwickle sie kontrolliert weiter. Die aktuelle Grundstruktur ist bereits brauchbar und soll erhalten bleiben. Ziel ist eine professionelle, tablet-taugliche Werkstatt-App für Galvanik Kreile, die Arbeitsfluss, Engpässe, Verzug, Kundenhistorie und Performance sichtbar macht.

Die App soll nicht wie ein altes Tabellenprogramm wirken, sondern wie ein modernes operatives Cockpit: ruhig, hochwertig, traditionsbewusst, aber mit klarer visueller Priorisierung. Rote Probleme müssen sofort ins Auge springen. Grüne Zustände dürfen beruhigen, aber nicht die Aufmerksamkeit stehlen.

---

## Nicht zerstören: Arbeitsmodus für Antigravity

Vor Änderungen am bestehenden Code:

1. **Bestehende Struktur analysieren**
   - Komponenten, Seiten, Routing, Styles, Mockdaten, Statuslogik und bestehende UI-Patterns prüfen.
   - Keine vorhandene Seite vollständig ersetzen, solange sie funktional ist.
   - Bestehende Komponenten bevorzugt erweitern, konsolidieren oder optisch aufwerten.

2. **Änderungen schrittweise umsetzen**
   - Erst Design- und Logikverbesserungen auf vorhandenen Seiten.
   - Danach neue Komponenten ergänzen.
   - Danach Performance-/Prozesslogik ausbauen.
   - Keine komplette App-Rekonstruktion ohne explizite Freigabe.

3. **Vor größeren Umbauten Vorschau/Review ermöglichen**
   - Wenn möglich, eine Variante oder Preview-Komponente erstellen.
   - Bestehende Seite daneben oder über Feature-Flag vergleichbar halten.
   - Keine Navigation entfernen, ohne Ersatz.

4. **Sicherheitsprinzip**
   - Wenn eine Änderung riskant ist: erst eine Kopie der Komponente anlegen.
   - Layoutänderungen modular halten.
   - Datenmodell nicht willkürlich ändern, sondern migrationsfähig erweitern.

---

## App-Zweck in einem Satz

Die App soll der Werkstatt helfen, jeden Auftrag vom Wareneingang bis zum Versand transparent zu steuern, kritische Verzögerungen sofort zu erkennen und den Durchlauf operativ zu verbessern.

---

## Zentrale Nutzerintention

Der Nutzer möchte nicht primär schöne Zahlen sehen. Er möchte **Probleme im Ablauf erkennen und rechtzeitig eingreifen**.

Daher gilt:

- Rot = sofortiger Handlungsbedarf.
- Orange = kritisch beobachten.
- Gelb = drohender Engpass.
- Grün = stabiler Zustand.
- Grau/Blau = neutral, wartend, dokumentarisch.
- Die App darf Erfolg zeigen, aber sie soll zuerst operative Reibung sichtbar machen.

---

## Bestehende Seiten beibehalten und veredeln

Die Navigation soll grundsätzlich erhalten bleiben:

| Seite | Zweck | Ziel der Verbesserung |
|---|---|---|
| Heute | operative Tagesansicht | Sofort sehen, was als Nächstes gemacht werden muss |
| Aufträge | Auftragsbuch | bessere Lesbarkeit, Status, Priorität, Detailsteuerung |
| Teile | Teile-/Objektverwaltung | Teilestatus je Station und Foto-/Scanbezug |
| Kunden | Kundenkartei | Historie, Preisabsprachen, Reklamationen, technische Profile |
| Scan (OCR) | Wareneingang / Dokumente | schneller Auftragseingang per Kamera/Foto |
| Verzug & Engpässe | operative Problemseite | konkrete Maßnahmen, nicht nur Anzeige |
| Performance | Analyse & Verbesserung | Heatmap, Durchlauf, Engpassentwicklung, Qualitätskennzahlen |

---

## Designrichtung

Die App soll wirken wie:

- ein modernes Werkstatt-Tablet-System,
- ein hochwertiges Produktionscockpit,
- robust und klar,
- farblich intuitiv,
- nicht kitschig, nicht überladen, nicht wie ein Website-Baukasten,
- nicht wie Excel/ERP aus den 1990ern.

Orientierung: professionelles Dashboard, klare Statuskarten, große Prioritäten, sichtbare Ampellogik, handwerkliche Seriosität.

---

## Wichtigste UI-Regel

Ein Meister oder Mitarbeiter muss im Vorbeigehen erkennen:

1. Gibt es ein rotes Problem?
2. Welche Station ist betroffen?
3. Welcher Auftrag hängt?
4. Was ist die nächste sinnvolle Handlung?

Wenn diese vier Fragen nicht innerhalb von 3 Sekunden beantwortbar sind, ist die Oberfläche zu schwach.

---

## Hauptfeatures

### 1. Problemorientierte Tagesansicht

Die Seite „Heute“ zeigt nicht alles gleich stark, sondern sortiert nach Handlungsdruck:

1. Kritisch / überfällig
2. Fällig heute
3. Fällig morgen
4. In 2–5 Tagen
5. Wartet auf Material / Kundenfreigabe / externe Entscheidung
6. Im Plan

### 2. Farb- und Formkodierung

Status darf nicht nur über Text erkennbar sein. Er muss über Farbe, Form, Größe und Position sichtbar werden.

Beispiele:

- Kritisch: roter Rand, großes Warnsymbol, große Fristangabe, stärkere Karte
- Leicht kritisch: orange Karte/Rand, mittlere Priorität
- Im Plan: grün, aber visuell ruhiger
- Wartend: grau/blau, mit Pausen-/Wartesymbol
- Material fehlt: separates Symbol und neutral-kritischer Farbton

### 3. Stations-Heatmap

Die bestehende Heatmap aus „Verzug & Engpässe“ ist gut und soll zusätzlich in „Performance“ integriert werden.

Es soll zwei Formen geben:

- **Operative Heatmap** in „Verzug & Engpässe“: Was blockiert heute?
- **Analytische Heatmap** in „Performance“: Welche Station ist regelmäßig Engpass?

### 4. Performance-Seite als Analysezentrale

Die Performance-Seite soll professionell wirken, aber nicht zur Selbstbeweihräucherung werden. Der Fokus liegt auf:

- Terminquote
- Durchlaufzeit
- offene Aufträge
- kritische Aufträge
- Reklamationsquote
- Scan-/Dokumentationsquote
- Engpass pro Station
- Trend der letzten Tage/Wochen
- konkrete Verbesserungsempfehlungen

### 5. Kundenkartei als Werkstattgedächtnis

Jeder Kunde erhält eine technische Historie:

- bisherige Aufträge
- bearbeitete Teile
- Fotos
- Preise / Preisabsprachen
- Reklamationen
- Material- und Oberflächenpräferenzen
- wiederkehrende Artikel
- Besonderheiten bei Verpackung, Kommunikation, Zahlung, Freigabe

---

## Prozess-Grundlogik

Jeder Auftrag besteht aus:

- Auftrag
- Kunde
- mehreren Teilen/Objekten
- Stationen
- StatusEvents
- Fotos/Dokumenten
- Fristen
- Engpass- und Verzugssignalen
- internen Notizen
- Kundenkommunikation
- Versand-/Abholstatus

Statusänderungen sollen möglichst einfach per Klick/Scan erfolgen.

---

## Event- statt Freitext-Prinzip

Die App soll nicht nur aktuelle Zustände speichern, sondern Ereignisse:

- Auftrag angelegt
- Wareneingang gescannt
- Foto aufgenommen
- Teil etikettiert
- Station gestartet
- Station abgeschlossen
- Material fehlt
- Kundfreigabe fehlt
- Reklamation erfasst
- Nacharbeit gestartet
- Versand vorbereitet
- Auftrag abgeschlossen

Daraus können Durchlaufzeiten, Wartezeiten und Engpässe automatisch berechnet werden.

---

## Umsetzungsvorgaben

### Technisch

- Bestehendes Projekt analysieren.
- Vorhandene Komponenten wiederverwenden.
- UI-Logik als Komponenten kapseln.
- Statuslogik zentral definieren.
- Farben zentral definieren.
- Mockdaten realistisch erweitern.
- Keine redundanten Felder, wenn Daten berechnet werden können.
- Für Demo zunächst lokal/mocked möglich, später backendfähig.

### UI

- Tablet-first.
- Große Touchflächen.
- Wenige, klare Aktionen.
- Kritische Dinge groß.
- Details erst auf Klick/Drawer/Modal.
- Linke Navigation kompakter, aber verständlich.
- Searchbar erhalten.
- Keine überflüssigen Legenden wie „Rot bedeutet schlecht“; Status muss selbsterklärend über Label und Inhalt sein.

### Sprache

Ton der App:

- kurz,
- handwerklich,
- konkret,
- nicht verspielt im Text,
- visuell darf die App lebendig sein.

Beispiele:

- „Überfällig seit 3 Std.“
- „Wartet auf Material“
- „Kundenfreigabe offen“
- „Engpass Schleiferei“
- „Nächste Aktion: Rückfrage stellen“
- „Station abschließen“
- „Foto fehlt“

---

## Ergebnis, das Antigravity bauen soll

Die bestehende App soll zu einem visuell stärkeren, operativ sinnvolleren WerkstattCockpit werden:

- Die Grundseiten bleiben erhalten.
- Die visuelle Priorisierung wird deutlich stärker.
- Die Tagesansicht wird problemorientiert.
- Die Performance-Seite erhält Heatmap und Prozessanalyse.
- Verzug & Engpässe bleibt operative Eingriffszentrale.
- Kunden, Teile und Aufträge werden stärker miteinander verknüpft.
- Wareneingang, Fotos, Etiketten, OCR und StatusEvents werden als Prozesskette abgebildet.

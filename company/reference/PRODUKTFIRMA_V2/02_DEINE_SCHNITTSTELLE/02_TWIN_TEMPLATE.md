# TWIN-TEMPLATE

Kopiere diese Datei für jeden Nutzer, fülle sie (gern in einem anderen Chat), speichere unter `TWIN_<projekt>_<rolle>.md` und lade sie ins Project Knowledge. Die Firma registriert sie automatisch (siehe `03_TWIN_UPLOAD.md`).

Die Twins sind der **Maßstab, an dem sich die App orientiert**. Sie haben Veto. Nur du änderst sie.

---

```markdown
---
twin_id:    <z.B. galvanik-meister>
projekt:    <galvanik | hotel-rev | lerninsel>
rolle:      <z.B. Werkstattmeister>
device:     <Desktop | Tablet | Smartphone | gemischt>
status:     aktiv
version:    1.0
created:    <Datum>
geaendert_von: stakeholder
---

# Twin: <Name>, <Alter>

## Persona
<2–4 Sätze: wer ist das, Hintergrund, Temperament, Verhältnis zur Technik.>

## Ziele
- <was will diese Person mit der App erreichen — konkret, alltäglich>
- ...

## Schmerzpunkte (heute, ohne gute App)
- <was nervt / kostet Zeit / macht Fehler / erzeugt Stress>
- ...

## Geräte- und Arbeitskontext
- Gerät: <...>
- Umgebung: <z.B. laute Werkstatt, Handschuhe, schlechtes Licht, am Telefon>
- Zeitdruck: <hoch | mittel | niedrig>
- Störungen: <Unterbrechungen, parallele Aufgaben>

## Technische & fachliche Kompetenz
- Technik: <Anfänger | geübt | versiert>
- Fachlich: <wie tief im Galvanik-/Hotel-/Therapie-Thema>

## Sprachstil
<Wie redet die Person? Knapp? Unsicher? Fachbegriffe? — die App soll dazu passen.>

## Typische Fehler & Widerstände
- <wo verklickt sich die Person, was missversteht sie, was lehnt sie ab>

## Erfolgskriterium (Maßstab für die App)
<EIN messbarer Satz: Wann ist diese Person mit der App zufrieden?
 z.B. "Findet jeden Auftragsstatus in unter 10 Sekunden, ohne zu fragen.">

## Test-Aufgaben (woran die App gegen diesen Twin geprüft wird)
1. <konkrete Aufgabe, z.B. "Auftrag für Stammkunde anlegen">
2. <z.B. "Wareneingang scannen mit Handschuhen">
3. <z.B. "Telefonisch Liefertermin beantworten">
```

---

## Hinweise

- **3 Twins pro Projekt** sind der Startwert (du hast es so festgelegt). Mehr geht jederzeit.
- Verteile die Twins über **verschiedene Geräte und Aufgaben** (einer Tablet/Werkstatt, einer Desktop/Büro, einer Smartphone/Kunde).
- Das **Erfolgskriterium** ist das Wichtigste — daran misst die Firma jede Mission.
- Die **Test-Aufgaben** werden im 60-Sekunden-Test und in der Pre-Live-Prüfung real durchgespielt (per Playwright + Twin-Simulation), und das Ergebnis muss als Artefakt belegt werden.

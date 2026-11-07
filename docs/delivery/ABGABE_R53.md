# R53 – Angleich und Eingangsoriginale

**Arbeitsstand, nicht abgenommen und nicht mergefähig.** Die folgenden Angaben
werden nach dem Merge von #183 am neuen Kandidaten ergänzt.

## Umfang

- Gebundene Texte, Zustände und Aktionen der Runde 53 außerhalb der Seite `rein`.
- Erneute Texterkennung: manuell geänderte und bestätigte Angaben bleiben
  erhalten; nicht bestätigte erkannte Positionen werden nicht doppelt angelegt.
- Bei mehr als 20 Positionen entstehen getrennte Fortsetzungsbelege mit Bezug
  auf dasselbe Original. Die Auftragskarte erhält Zugriff auf zugeordnete
  Eingangsoriginale über den vorhandenen Originalweg.
- Die Seite `rein` und Mailbilder gehören laut P100 zum Folgepaket Teil 2b.

## Vorläufige Nachweise und offene Punkte

- Produktstand vor Rebase: `88b768c2`. Vorschau und CI dieses Stands: offen.
- Gezielte Oberflächen- und Typprüfungen bestanden; sie ersetzen keine
  Integration gegen die echte Replay-Datenbank.
- Die SQL-Abfrage zum Originalbezug wurde lokal mit zurückgerollten Migrationen
  auf Ausführbarkeit geprüft. Ein echter Buchungs-, Rollen- und Originalabruf
  gegen die Replay-Datenbank steht aus.
- Nach #183-Merge: Rebase, additive Dev-Migrationen nach P47 mit Abbruchprobe,
  Migrationsgleichstand, echte Replay-Actions, Sichtlauf, CI und Preview des
  endgültigen Kandidaten dokumentieren.
- Der Owner-Klickweg wird anhand des endgültigen Kandidaten und der gebundenen
  Paketvorgabe ergänzt.

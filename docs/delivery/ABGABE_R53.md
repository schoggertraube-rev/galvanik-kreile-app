# R53 – Angleich und Eingangsoriginale

**Arbeitsstand, nicht abgenommen und nicht mergefähig.** Der abschließende
Sichtlauf und die CI-Prüfungen des PR-Kopfs stehen noch aus.

## Umfang

- Gebundene Texte, Zustände und Aktionen der Runde 53 außerhalb der Seite `rein`.
- Erneute Texterkennung: manuell geänderte und bestätigte Angaben bleiben
  erhalten; nicht bestätigte erkannte Positionen werden nicht doppelt angelegt.
- Bei mehr als 20 Positionen entstehen getrennte Fortsetzungsbelege mit Bezug
  auf dasselbe Original. Die Auftragskarte erhält Zugriff auf zugeordnete
  Eingangsoriginale über den vorhandenen Originalweg.
- Die Seite `rein` und Mailbilder gehören laut P100 zum Folgepaket Teil 2b.

## Nachweise und offene Punkte

- #183 ist mit `323b919f` gemergt; der Reparaturzweig wurde darauf rebasiert.
  Geprüfter lokaler Produktstand: `8ffc576149b75ae81b4242006cd6dd3e3d303d3c`.
  Ein PR-Kopf und eine READY-Preview dafür stehen noch aus.
- Echte Serveraktionen gegen die lokale Replay-Datenbank und den lokalen
  Storage: **3/3** Fortsetzungsfälle bestanden. Geprüft sind drei aufeinander
  folgende Belege, dieselbe Originaldatei ohne Kopie, Zuordnung zum Auftrag,
  Zugriff mit Auftragsrecht ohne Mailrecht, Ablehnung ohne Recht, Öffnungsereignis
  und erneutes Lesen auch nach mehr als 90 Tagen.
- Die drei additiven Migrationen wurden jeweils einzeln mit erzwungenem
  Rollback geprüft und danach auf Dev angewendet. Gespeicherte SQL-Bytes
  entsprechen den Dateien; Prüfsummen bestehender Geschäftsdaten und Rechte
  blieben unverändert. Repository, Dev und Replay enthalten **85/85**
  Migrationsversionen.
  - `20261107064622_ein2_fortsetzung.sql`: SHA-256
    `0029DFFB517CE5725FAF34C192600F9025EC35744BC2D6E98331C8A7276A4A0F`
  - `20261107070105_ein2_fortsetzung_schutz.sql`: SHA-256
    `D6323B0032D8BE5ABA9AE389884C4A75B59AB01D93F2B4C9D35BCD09B1B00CC7`
  - `20261107091500_ein2_fortsetzung_kette.sql`: SHA-256
    `2CBDD8F90A53652838FFFEF744DC011FA89BE03BBB12DE37CBEEDCC4BED8279C`
- Typprüfung, H18-Inventar, Modulgrenzen und No-Fake-Prüfung bestanden am
  rebasierten Produktstand. Der gebundene Sichtvergleich sowie die vollständigen
  CI-Checks am endgültigen PR-Kopf bleiben offen.
- RT04-11/12/14/15 sind nach P103 als `Endversion-Angleich Testmodell RT04`
  eingeordnet; ihre Assertions wurden nicht verändert.

## Vorgesehener Owner-Klickweg

Nach Bereitstellung der Preview: Einen gekennzeichneten Eingang mit Original
und mehr als 20 Positionen erfassen, die Fortsetzung öffnen und die zugehörigen
Aufträge buchen. In den Auftragskarten prüfen, dass jeweils das vorhandene
Original unter „Aus Eingang · Beleg k/n“ angezeigt und geöffnet werden kann.
Den Weg nach einem erneuten Öffnen der Karten prüfen.

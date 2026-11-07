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
  Der aktuelle Kandidat steht in [PR #188](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/188).
  Exakter Kopf-SHA und zugehörige READY-Preview werden in dessen Beschreibung
  nach dem Git-Push nachgetragen.
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
- E01: Die Prüfmaschine liest den tatsächlichen Status der sichtbaren
  Prüflistenzeile, während die Anzeige gemäß U-242 eine konkrete Handlung
  wie „Kunde wählen“ statt des isolierten Wortes „fehlt“ nennt. Der
  generierte Akzeptanzfall bleibt unverändert; zwei realRender-Fälle prüfen
  leere und ausgefüllte Kundenangaben sowie den Zustandswechsel.
- Der anfänglich grüne generierte CI-Lauf enthielt nur je einen Rauchtest pro
  Seite. Der PR-Umfang wurde anschließend auf die tatsächlich berührten
  Ablaufbereiche erweitert: Eingang, Kundenanlage und -bearbeitung, Ware,
  Mail-Eingang, Eingangsrechnung, Original, Nachrichten, Anliegenwahl und
  Entwurf. Ihr vollständiger Lauf am endgültigen Kopf steht noch aus.
- Der bisherige CI-Lauf auf `e57f8b5a` meldete E01 und im vollständigen
  Replay den bereits früher beobachteten Tablet-Navigationsfehler nach
  `/settings`. Für den neuen Kopf sind beide Prüfungen erneut offen. Die
  fremden, noch ungebundenen Endversion-Dateien im lokalen Arbeitsbaum
  verfälschen dort die Quellen-Bindungsprüfung; sie sind nicht Teil des PRs.
- RT04-11/12/14/15 sind nach P103 als `Endversion-Angleich Testmodell RT04`
  eingeordnet; ihre Assertions wurden nicht verändert.

## Vorgesehener Owner-Klickweg

Nach Bereitstellung der Preview: Einen gekennzeichneten Eingang mit Original
und mehr als 20 Positionen erfassen, die Fortsetzung öffnen und die zugehörigen
Aufträge buchen. In den Auftragskarten prüfen, dass jeweils das vorhandene
Original unter „Aus Eingang · Beleg k/n“ angezeigt und geöffnet werden kann.
Den Weg nach einem erneuten Öffnen der Karten prüfen.

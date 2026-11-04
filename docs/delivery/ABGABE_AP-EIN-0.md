# AP-EIN Teil 0 – Generator und Replay-Fundament, Runde 52

Status: Draft zur Prüfung; kein Merge und keine fachliche Abnahme der späteren Teile.

## Stand und Produktbasis

Der Runtime-Produktbaum ist unverändert gegenüber `3060b2abed9312e49ce5617091a0d24a990e3061`.
Dessen exakte Git-Preview ist READY: https://galvanik-kreile-werkstatt-gtx1aww3d.vercel.app .
Teil 0 ändert ausschließlich Generator, Testgerüst, generierte Testdaten und diese Abgabe.
Der genaue neue Testfundament-SHA, seine Git-Preview und die Check-Liste werden im PR #166 und im laufenden Protokoll zugeordnet.

## Umsetzung

- BAUPLAN spec `ee64f8882bb7`, SHA-256 `DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4`.
- Alle 306 Fälle aller 14 Modellseiten werden deterministisch erzeugt; Paketzuordnungen filtern keine Fälle aus.
- Die eingebetteten Fallbeschreibungen und Assertions sind bytegleich zur JSON-Projektion des Owner-Modells.
- Sieben ausschließlich synthetische Replay-Logins; Datenlagen werden je Fall mit ihren Abhängigkeiten in die echte lokale Datenbank eingebracht.
- Modell-/Speichernamen stehen einmal im Generator. Das vorhandene `private.intake_drafts` wird im privaten Schema geprüft und befüllt; es entsteht keine zweite Tabelle.
- Ergänzte Datums-/Wertplatzhalter, gezielte Netzwerkunterbrechung und erneutes Lesen sowie exakte Zeilen-/Delta-Prüfungen im Testgerüst.
- Auswahlerwartungen behalten die vom Owner-Modell verlangte `aria-pressed`- und Erfolg-Grün-Prüfung. Optionsknöpfe werden über ihren exakten sichtbaren Text im bezeichneten Steuerelement gefunden; ein umgebendes HTML-Label kann ihren zugänglichen Namen verändern.

## Prüfungen und offene Befunde

- Frische lokale Supabase-Replay-Kette ohne Seed: PASS. Keine Dev-Migration und keine Dev-Datenänderung.
- Produktions-Build gegen diese lokale Datenbank: PASS.
- Generator-Schreiben/`--check`, Modellvergleich aller 306 Fälle und Whitespace-Prüfung: PASS.
- Der frühere breite Runde-51-Lauf wurde nach 144 begonnenen Fällen wegen konkreter Gerüstbefunde beendet; er gilt ausdrücklich nicht als vollständiger PASS. Der Runde-52-Gesamtlauf der 306 Fälle läuft gemäß Owner-Freigabe in CI. Teil 0 besitzt keine eigenen Produktseiten; lokal werden sein Generator und die zwei betroffenen Gerüstfälle D07/TA14 geprüft.
- D07: Fixture wurde im falschen Schema gesucht. Korrektur nutzt die bestehende private Tabelle samt echtem fremdem Login und isoliertem Rücksetzen der Testdaten.
- Gezielter Nachlauf D07 und TA14 gegen die echte Replay-DB: beide PASS. JSON-Fixtures verwenden den typisierten JSON-Parameter des vorhandenen Treibers statt doppelter Serialisierung.
- P50: Der vollständige CI-Lauf des Teil-0-SHA widerlegt den lokalen TA14-Einzelnachweis: Die Ladefehleranzeige fehlt an diesem älteren Produktstand. TA14 ist deshalb ausdrücklich AP-EIN-2 zugeordnet. Die Erwartung bleibt unverändert.
- E32: Die Modellkonvention verlangt Erfolg-Grün für erkannte Eingaben. Dieser ältere Produktstand liefert es noch nicht; P50 ordnet den Fall AP-EIN-2 zu. T05c besteht im vollständigen CI-Lauf und hat keinen Rot-Marker mehr. Die Liste enthält damit 268 tatsächlich noch rote Zukunftsfälle; sie wird pro gestapeltem Stand geführt.
- Die vollständigen 306 Fälle laufen weiterhin in der CI. Die Check-Liste im PR nennt den wirklichen Stand; rot ist keine Abnahme.
- Der übergeordnete Anker #165 entfernt die unnötige alte ESLint-Ignore-Ausnahme; ESLint-Konfiguration und Baseline bleiben bytegleich main. Seine laufende CI wird gesondert mit Job und Schritt ausgewertet.
- Sichtprüfung für Teil 0: nicht anwendbar, da keine Produktseite verändert wird. Die vollständige visuelle Ausgangsmessung folgt genau einmal in Teil 0b mit dem unveränderten Runde-52-Prüfer und Ausgabe außerhalb des Repositorys.

## Owner-Klickweg und DB-Soll

Gerüstkorrektur aus dem ersten vollständigen Runde-52-Kundenlauf: Der DB-Readback las trotz vorhandener Zeile 0 Treffer, weil ein JSON-Parameter doppelt kodiert wurde. Dieselbe lokale Zeile liefert mit der expliziten Text-zu-JSON-Konvertierung genau 1 Treffer. Daten, Erwartungen und Zeilenzahlprüfung bleiben unverändert.

Weitere mechanische Anschlüsse: 5.2 benutzt den vorhandenen Knopf `kunde.bearbeiten`; ein Modus wird als vollständiges Argument an den bestehenden Kundenadapter übergeben. Optionslabels werden als zugängliche Namen gelesen, ohne den zusätzlichen Beschreibungstext der gelieferten Auswahlkarten. Die positive Sichtbarkeit eines Texts verlangt weiterhin einen sichtbaren Treffer; ausdrücklich vorgegebene Anzahl-/Eindeutigkeitsprüfungen bleiben unverändert. Kein Owner-Modellfall und keine feste Akzeptanzdatei wurde umgeschrieben. Die geänderten Anschlüsse werden gezielt im folgenden Teil 1 geprüft; es wird kein zweiter unveränderter Gesamtlauf gestartet.

Der exakte Auswahl-Farbvergleich wartet lediglich die gelieferte CSS-Transition ab; Sollfarbe und Auswahlzustand bleiben unverändert. `orders.geprueft` wird nach P39 direkt als Datenbankspalte gelesen, statt aus der bloßen Existenz eines Auftragsereignisses abgeleitet. Vor Lieferung dieser Spalte in Teil 2 bleiben entsprechende Zukunftsfälle rot.

Teil 0 liefert keine neue sichtbare Produktfunktion. Die Preview oben zeigt die unveränderte Produktbasis; die Korrektur des roten Plus folgt in Teil 2 nach dem UI-Fundament und der Kundenoberfläche.

DB-Soll dieses Teils: ausschließlich synthetische Daten auf `127.0.0.1:54322`; vorhandene Produkt-, Auth- und Tenant-Verträge bleiben bestehen. Die sichtbaren Teile bekommen ihren eigenen Preview-/Sichtnachweis und ihren jeweiligen echten Action–DB–Ansicht-Nachweis.

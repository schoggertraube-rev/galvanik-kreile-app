# AP-EIN Teil 5 · Eingangsrechnungen

## Aktualisierung P63/P64 · 05.11.

Auf Teil 4 zusammengeführt, einschließlich des Teil-2-Modus-Fixes `003a6a68` (Datei-Einstieg und QR-Unterzeile). Die eine Erkennung bewahrt PDF-/Bildtext und die explizite Art-Wahl; strukturiertes UBL/CII geht ausschließlich in den vorhandenen XML-Parser. Rechnungsnummer bzw. gespeichertes Rechnungsanliegen halten den Beleg im Rechnungsweg, auch wenn vorher eine andere Art gewählt wurde. Ein Login nur mit Geld sieht weiterhin ausschließlich den freigegebenen Rechnungsbezug, keine Mailtexte oder erwarteten Waren anderer Bereiche.

Geprüft: **8/8 echte Rechnungs-Actions → Replay-DB/Event → Leser**, **9/9 gezielte Klassifikations-/Provider-/Original-Tests**, A11 **22/22**, Build grün. Der einmalige vollständige Lauf der unveränderten Rechnungs-Modellfälle besteht **16/16 tatsächlich grün**, keine erwarteten Fehler, keine Wiederholungen: R01–R15 einschließlich R06b. Enthalten sind Pflichtangaben, Rechnung ohne Lieferant, Klärung, Zahlung, Dublette, Abbrechen, Schreibfehler mit erhaltenen Eingaben, Wiederholung, Doppelklick und fehlendes Recht. Bericht `e2e/generated/.git/kreile-p51-invoice-owner-cases.json` (lokal ignoriert).

Bestehende UBL-/CII-Assertions wurden ausschließlich verstärkt: vorher Original fertig → zusätzlich `recognition.kind=rechnung` und erneuter Capture-Leser mit gespeichertem Rechnungsanliegen; OCR bleibt nachweislich unaufgerufen. Kein Akzeptanztest geändert. Der Stapel übernimmt jetzt #173 `8070384f`: belegte F07/O08-Rotlistenbereinigung und die eine G09-Korrektur (Erneut stellt Eingaben wieder bereit, erst der Hauptklick wiederholt denselben Auftrag). Diese Task-Dateien werden unverändert geerbt; dessen eigener Regressionstest und echter G09-Replay sind in Teil 4 belegt. Neue exakte CI, READY-Preview und vollständige Sicht bleiben offen; kein Mergeclaim.

## CI-Folgekorrektur · 05.11.

[Lauf 42025459507](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/42025459507) am vorherigen SHA `09f8de31`: Einheitstests 1151 grün, ausschließlich „Was ist neu“ rot (erwartet #175 zuerst, tatsächlich #173 vom 05.11.). Ursache war das noch auf 04.11. stehende Datum des am 05.11. aktualisierten Rechnungsteils. Korrigiert werden ausschließlich das tatsächliche Aktualisierungsdatum und seine Position bei gleichem Datum. Die bestehende Datums-/Reihenfolge-Assertion bleibt vollständig unverändert. Generated war zusätzlich an den bereits geerbten F07/O08-Markern und dem G09-Race rot; deren Korrekturen kommen aus Teil 3/4, keine weitere Variante hier.

Die ungebundene fremde Runde-53-Lieferung bleibt außerhalb des Produktcommits. Ihre lokalen Bindungsfehler sind in NACHTLAUF C dokumentiert und werden nicht durch Änderungen an Checkern, Referenzen oder gelieferten Dateien umgangen.

Nachweis des Datums-Fixes: bestehende Neuigkeiten-Tests und geerbter G09-Komponententest **6/6 grün**, Typprüfung/Lint/Whitespace grün. A11 vollständig **19 grün / 3 rot**, ausschließlich die bereits gemeldeten fremden R53-Bindungsfehler (authority/selftest/module-gates). Der letzte unveränderte Rechnungs-Volllauf **16/16** wird durch die reine Datums-/Sortierkorrektur nicht wiederholt; die neue CI am Kandidaten bleibt maßgeblich.

Dev nach P47: additive `20261104100455_ein5_eingangsrechnungen.sql`, SHA-256 `F123679895736A5890A17A1861B19E07F0F8B01257833631134AA05BF72E4C3E`, unverändert angewendet. Zuerst erzwungener ROLLBACK: 75 → 75, neue Tabelle nicht vorhanden, Funktionsdefinitionen und Rechte wieder identisch. Anschließend Anwendung: **vollständige Repo-/Dev-Versionslisten 76 = 76**, keine fehlende oder unerwartete Version, SQL bytegleich im Ledger. Geschäftszeilenzahlen und bestehende Tabellenrechte unverändert; `supplier_invoice` mit RLS und nur SELECT/INSERT/UPDATE für service_role, kein DELETE/TRUNCATE. Die zwei bestehenden Kundenfunktionen bleiben SECURITY INVOKER und behalten ihre bisherigen Ausführungsrechte. Belege `.git/kreile-p64-invoice-dev-probe.json` und `-apply.json`. Vorhandene Originale werden nicht kopiert.

**Entwurf; nicht abgenommen und nicht mergefähig.** Aufbauend auf Teil 4. Der konkrete Commit, die CI und die Git-Preview stehen im PR und im NACHTLAUF C.

P55: UBL- und CII-XML werden strukturiert gelesen, nicht per OCR. Rechnungen ohne Lieferant erhalten eine verknüpfte Klärungsaufgabe; Zahlung bleibt bis zur Ergänzung gesperrt. Anlage nutzt den bestehenden Kundenschreibweg, Ergänzung den versionsgeschützten Rechnungsschreibweg. Die Nachweise erfolgen mit synthetischen Daten auf der lokalen Replay-Datenbank.

ZUGFeRD/Factur-X: `pdfjs-dist` ist nur eine Testabhängigkeit, keine freigegebene Laufzeitabhängigkeit. Bis eine vorhandene Laufzeitbibliothek die eingebettete XML nachweisbar lesen kann, bleibt der bestehende PDF-Erkennungsweg maßgeblich. Sichtprüfung und Freigaben der gestapelten Vorgänger stehen aus. Kein Merge oder Production-Deploy durch Codex.

CI-Hygiene: O01/O03a/O03b/O04 waren auf Teil 4 und G08/G11 auf dem Vorgänger dieses Teils nachweislich bestanden und wurden deshalb aus der Erwartungsliste entfernt; die Testinhalte blieben unverändert. N14, G09 und B11 werden separat geprüft.

P62: Bei G09 und B11 unterbricht der bestehende Netzwerk-Harness gezielt die zugehörige Schreibaction aus dem Next-Build-Manifest statt eines parallelen Leseaufrufs. Die Bestätigung des abgebrochenen Requests und alle UI-, Retry- und DB-Assertions bleiben erhalten. Beide vorgegebenen Fälle bestanden lokal gegen eine frisch aufgebaute Replay-Datenbank; die vollständige CI am neuen SHA steht noch aus. N14 wird im vorgelagerten Teil 4 behandelt.

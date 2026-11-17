# S54a · Ist-Probe E-Rechnung

Probe: 2026-11-17T20:57:30.675Z; ausschließlich eigene Loopback-DB 127.0.0.1:54342, isolierter Mandant `TEST-ablauf-9bf86d17-1b77-4d3f-a968-8422ba55be3f`. Ursprüngliche Produktbasis main `2d8007c9`; nur Fixtures, Probelauf und dieser Befund. Eigene DB192, Basis-Repo191: kein Dev-/Fresh-Gleichstand behauptet. Ausführungsfreigabe PL17.11.20:55.

## Weg und Grenzen

Alle Eingänge liefen über vorhandene prepareIntakeFileAction → echten signierten Storage-Upload → finishIntakeFileAction → getIncomingInvoiceAction → saveIncomingInvoiceAction → erneutes Lesen und frisch deserialisierten Retry. Neun Originale wurden nach erneuter Auth-Prüfung tatsächlich heruntergeladen und ihr SHA-256 geprüft. Kein Parser, Produkt-Writer, Recht oder Anbieter wurde geändert. Der Test-Mandant ist ausdrücklich synthetisch; die Rechnungsdateien sind offizielle öffentliche Beispiele.

Die sechs ZUGFeRD-/Factur-X-Proben sind die **unveränderten eingebetteten XML-Bytes** der unten belegten offiziellen Hybrid-PDFs. Das Herauslesen ist nur Testvorbereitung mit dem bereits vorhandenen pdfjs-dist. Der heutige Eingang erhält XML. Dies belegt **keine automatische Verarbeitung des PDF-Containers**. Die PDF-Originaldateien bleiben bytegleich im Fixture-Verzeichnis; Quellen/Versionen/Lizenzen stehen in SOURCES.json.

Der selbsttragende Probelauf umfasst genau zehn echte Fälle: acht Formate, ein beschädigtes XML, eine Ausgangsrechnung. Ergebnis: 10/10 grün in19.49s. Das bedeutet, dass Probe, Originalschutz und manuelle Fortsetzung funktioniert haben; fehlende Erkennungsfelder bleiben unten sichtbar. Eine vorherige lokale Vorprobe mit derselben Produktbasis war ebenfalls10/10; keine Bestandsschutz-Gesamtlaufbehauptung daraus.

## E1/E3 · Erkannte Felder

„nicht erkannt“ ist ein fehlender Wert, kein angenommener Nullbetrag. Bei USt ist nur der tatsächlich gelesene Gesamtbetrag genannt, keine erfundene Aufteilung.

| Datei / Formatprofil | Gelesen | Rechnungsnummer | Datum | Absender | Netto EUR | USt je Satz | Brutto EUR | IBAN | Grund / Lücke |
|---|---|---|---|---|---|---|---|---|---|
| TEST_xrechnung_ubl.xml · XRechnung/UBL | ja, teilweise | 123456XX | 2016-04-04 | nicht erkannt | 314.86 | Gesamt 22.04; Sätze fehlen | 336.90 | DE79000000001234567890 | Absender und USt-Aufteilung fehlen |
| TEST_xrechnung_cii.xml · XRechnung/CII | ja, teilweise | 123456XX | 2016-04-04 | nicht erkannt | 314.86 | Gesamt 22.04; Sätze fehlen | 336.90 | DE79000000001234567890 | Absender und USt-Aufteilung fehlen |
| TEST_zugferd_minimum.xml · ZUGFeRD/Factur-X/MINIMUM | ja, teilweise | 471102 | 2020-03-05 | nicht erkannt | 198.00 | Gesamt 37.62; Sätze fehlen | 235.62 | nicht erkannt | Absender und USt-Aufteilung fehlen |
| TEST_zugferd_basic_wl.xml · ZUGFeRD/Factur-X/BASIC WL | ja, teilweise | TX-471102 | 2019-10-30 | nicht erkannt | 16.90 | Gesamt 1.18; Sätze fehlen | 18.08 | nicht erkannt | Absender und USt-Aufteilung fehlen |
| TEST_zugferd_basic.xml · ZUGFeRD/Factur-X/BASIC | ja, teilweise | 471102 | 2026-03-05 | nicht erkannt | 198.00 | Gesamt 37.62; Sätze fehlen | 235.62 | nicht erkannt | Absender und USt-Aufteilung fehlen |
| TEST_zugferd_en16931.xml · ZUGFeRD/Factur-X/EN16931 | ja, teilweise | 471102 | 2026-03-05 | nicht erkannt | 473.00 | Gesamt 56.87; Sätze fehlen | 529.87 | nicht erkannt | Absender und USt-Aufteilung fehlen |
| TEST_zugferd_extended.xml · ZUGFeRD/Factur-X/EXTENDED | ja, teilweise | 99877 | 2026-05-30 | nicht erkannt | 1405.00 | Gesamt 266.95; Sätze fehlen | 1671.95 | DE75512108001245126199 | Absender und USt-Aufteilung fehlen |
| TEST_zugferd_xrechnung.xml · ZUGFeRD/Factur-X/XRECHNUNG | ja, teilweise | 471102 | 2024-11-15 | nicht erkannt | 473.00 | Gesamt 56.87; Sätze fehlen | 529.87 | DE02120300000000202051 | Absender und USt-Aufteilung fehlen |
| TEST_xrechnung_broken.xml · XRechnung/UBL | nein | nicht erkannt | nicht erkannt | nicht erkannt | nicht erkannt | nicht erkannt | nicht erkannt | nicht erkannt | UNSUPPORTED_XML; Original und manueller Weg erhalten |

### Originalschutz und Herkunft je Datei

| Geprüftes XML | Offizielles Quelloriginal / Lizenz | XML-SHA-256 | Speicherung / manuelle Fortsetzung |
|---|---|---|---|
| TEST_xrechnung_ubl.xml | [TEST_xrechnung_ubl.xml](https://raw.githubusercontent.com/itplr-kosit/xrechnung-testsuite/1ce1dafffd035e5ce59a7ab0d3bf44ac14af16c9/src/test/business-cases/standard/01.01a-INVOICE_ubl.xml) · Apache-2.0 with preserved upstream LICENSE/NOTICE | `74fb09c609d5fba15a8c543060998d3b92858f56a81fb5b0ed244d6794e498d1` | Original gesichert, echter Download bytegleich; unklar speichern / Neulesen / Retry erfolgreich |
| TEST_xrechnung_cii.xml | [TEST_xrechnung_cii.xml](https://raw.githubusercontent.com/itplr-kosit/xrechnung-testsuite/1ce1dafffd035e5ce59a7ab0d3bf44ac14af16c9/src/test/business-cases/standard/01.01a-INVOICE_uncefact.xml) · Apache-2.0 with preserved upstream LICENSE/NOTICE | `ae8062ecc2aaec56515e8e361e2885515df785f3d1cb9effa825bd41e37faf9a` | Original gesichert, echter Download bytegleich; unklar speichern / Neulesen / Retry erfolgreich |
| TEST_zugferd_minimum.xml | [TEST_zugferd_minimum.pdf](https://raw.githubusercontent.com/ZUGFeRD/mustangproject/0abe7bba61f0d248d0c96cedf03f975837a7e252/library/src/test/resources/ZF252_Beispiele/0.%20MINIMUM/MINIMUM_Rechnung/MINIMUM_Rechnung_fx.pdf) · Apache-2.0 with preserved upstream LICENSE/NOTICE | `7abfa87a8f0fc4265df5b380702322e8a1a1ee77e0a9315d0c40c30f01f39e34` | Original gesichert, echter Download bytegleich; unklar speichern / Neulesen / Retry erfolgreich |
| TEST_zugferd_basic_wl.xml | [TEST_zugferd_basic_wl.pdf](https://raw.githubusercontent.com/ZUGFeRD/mustangproject/0abe7bba61f0d248d0c96cedf03f975837a7e252/library/src/test/resources/ZF252_Beispiele/1.%20BASIC%20WL/BASIC-WL_Einfach/BASIC-WL_Einfach_fx.pdf) · Apache-2.0 with preserved upstream LICENSE/NOTICE | `a379421b7f1789ad44d1db24d964c3b3a24380908938d88a253999e151fc8178` | Original gesichert, echter Download bytegleich; unklar speichern / Neulesen / Retry erfolgreich |
| TEST_zugferd_basic.xml | [TEST_zugferd_basic.pdf](https://raw.githubusercontent.com/ZUGFeRD/mustangproject/0abe7bba61f0d248d0c96cedf03f975837a7e252/library/src/test/resources/ZF252_Beispiele/2.%20BASIC/B01_Einfach/B01_01_Einfach_fx.pdf) · Apache-2.0 with preserved upstream LICENSE/NOTICE | `d446dd9089a65ec411dd553b580c03742823d36e7d8495679d8610c87be576d6` | Original gesichert, echter Download bytegleich; unklar speichern / Neulesen / Retry erfolgreich |
| TEST_zugferd_en16931.xml | [TEST_zugferd_en16931.pdf](https://raw.githubusercontent.com/ZUGFeRD/mustangproject/0abe7bba61f0d248d0c96cedf03f975837a7e252/library/src/test/resources/ZF252_Beispiele/3.%20EN16931/E05_Einfach/E05_01_Einfach_fx.pdf) · Apache-2.0 with preserved upstream LICENSE/NOTICE | `239272bc8c226c8d7f6058fef48722a15a48808dc0536a702662fef24e809fc7` | Original gesichert, echter Download bytegleich; unklar speichern / Neulesen / Retry erfolgreich |
| TEST_zugferd_extended.xml | [TEST_zugferd_extended.pdf](https://raw.githubusercontent.com/ZUGFeRD/mustangproject/0abe7bba61f0d248d0c96cedf03f975837a7e252/library/src/test/resources/ZF252_Beispiele/4.%20EXTENDED/X02_SubInvoiceLines_Buero_Material_Bsp3/X02_01_SubInvoiceLines_Buero_Material_Bsp3___fx.pdf) · Apache-2.0 with preserved upstream LICENSE/NOTICE | `8d5eb92384ace53954359606231b01975a2a6ea14068eb4a6638bb8387ae803f` | Original gesichert, echter Download bytegleich; unklar speichern / Neulesen / Retry erfolgreich |
| TEST_zugferd_xrechnung.xml | [TEST_zugferd_xrechnung.pdf](https://raw.githubusercontent.com/ZUGFeRD/mustangproject/0abe7bba61f0d248d0c96cedf03f975837a7e252/library/src/test/resources/ZF252_Beispiele/5.%20XRECHNUNG/XRECHNUNG_Einfach/XRECHNUNG_Einfach_fx.pdf) · Apache-2.0 with preserved upstream LICENSE/NOTICE | `b93a969db177c3dd931b6c511fcc58a821fe94d4c76fb49f8367130adab760c2` | Original gesichert, echter Download bytegleich; unklar speichern / Neulesen / Retry erfolgreich |
| TEST_xrechnung_broken.xml | [TEST_xrechnung_broken.xml](https://raw.githubusercontent.com/itplr-kosit/xrechnung-testsuite/1ce1dafffd035e5ce59a7ab0d3bf44ac14af16c9/src/test/business-cases/standard/01.01a-INVOICE_ubl.xml) · Apache-2.0 with preserved upstream LICENSE/NOTICE | `96018ed636a1f7b33a92fe1ce0078be98d5c5e264ba183f1a4ba939146dbc0b4` | Original gesichert, echter Download bytegleich; unklar speichern / Neulesen / Retry erfolgreich |

E3 ist ausdrücklich eine isolierte Negativprobe: Vom offiziellen UBL-Beispiel wurden nur für TEST_xrechnung_broken.xml die letzten64Bytes entfernt. Der Eingang meldete UNSUPPORTED_XML, behielt das Original und ließ die manuelle Erfassung als „unklar“ mit normaler Aufgabe zu. Keine Format-Reparatur oder Ersatz-Erkennung.

## E2 · PDF ohne Datenteil / Scan

Vorhandensein der beiden Azure-Laufzeitvariablen wurde ohne Ausgabe ihres Inhalts geprüft: beide fehlen. Daher nach ausdrücklicher PL-Entscheidung keine simulierte OCR, kein Aufruf mit fremden Schlüsseln.

| Datei | Ergebnis | Quelle / Lizenz |
|---|---|---|
| TEST_invoice_plain.pdf | E2 offen – Azure-Zugang lokal nicht vorhanden | [Offizielles Mustang-Beispiel](https://raw.githubusercontent.com/ZUGFeRD/mustangproject/0abe7bba61f0d248d0c96cedf03f975837a7e252/library/src/test/resources/MustangGnuaccountingBeispielRE-20201121_508blanko.pdf); Apache-2.0 with preserved upstream LICENSE/NOTICE |
| TEST_invoice_scan.png | E2 offen – Azure-Zugang lokal nicht vorhanden | TEST-Rasterung von Seite1 desselben [offiziellen PDFs](https://raw.githubusercontent.com/ZUGFeRD/mustangproject/0abe7bba61f0d248d0c96cedf03f975837a7e252/library/src/test/resources/MustangGnuaccountingBeispielRE-20201121_508blanko.pdf); Apache-2.0 with preserved upstream LICENSE/NOTICE. Kein Kamera-/OCR-Nachweis. |

## E4 · Heutige TEST-Ausgangsrechnung

Tatsächlich ausgestellt mit issueInvoiceAction: `R-2026-0001`, Rechnung-ID `67ebbe0d-ef7a-4943-a946-ef8924cb9977`, Leistungsdatum 2026-11-17. Dieselbe frisch deserialisierte Anfrage ergab denselben Beleg. Der authentifizierte PDF-Leseweg lieferte 5537Bytes mit SHA-256 `8d59cd69a6216160ef1aeb0cd276774fefc7eb6ac0b61dd9b4e8dfb2b53b7467`; dieser stimmt mit dem unveränderlichen Ausstellungsbeleg überein.

| Pflichtangabe laut Schritt-Blatt | Technischer Ist-Befund am tatsächlichen PDF und eingefrorenen Snapshot |
|---|---|
| Leistender: Name / Anschrift | vorhanden: TEST Ablauf Galvanik, TEST Weg1,70176 Stuttgart, Deutschland |
| Empfänger: Name / Anschrift | vorhanden: TEST TEST S54a Pflichtangaben Firma GmbH, TEST Weg1,70176 Stuttgart, Deutschland |
| Steuernummer oder USt-IdNr. | vorhanden: DE123456789 (ausdrücklich TEST) |
| Ausstellungsdatum | vorhanden:17.11.2026 |
| Rechnungsnummer | vorhanden: R-2026-0001 |
| Menge und Art der Leistung | vorhanden:1 Stk. TEST TEST S54a Pflichtangaben Teil |
| Leistungszeitpunkt | vorhanden:2026-11-17 |
| Entgelt nach Steuersätzen | vorhanden: Netto100,00EUR bei19% |
| Steuersatz und Steuerbetrag | vorhanden:19% /19,00EUR; brutto119,00EUR |
| Strukturierte E-Rechnung im geprüften Ausgabeweg | nein: PDF mit 1Seite, 0eingebetteten Dateien, keine XRechnung-/ZUGFeRD-XML; interner JSON-Snapshot ist kein strukturierter Rechnungsexport |

Dies ist die technische Ist-Aufnahme nach der PL-Pflichtangabenliste. Gesetzesstand und rechtliche Formatprüfung werden wie beauftragt erst in S54 belegt.

## Arbeitsliste für S54 (keine Behebung in S54a)

1. Absender-/Lieferantenfelder aus den offiziellen XML-Originalen in der bestehenden Eingangserkennung berücksichtigen; aktuell bleibt der erkannte Absender bei allen acht Dateien leer.
2. USt je Satz statt nur Gesamt-USt ausgeben; die EN16931-/XRECHNUNG-Beispiele liefern hier nur Gesamt 56,87 EUR.
3. Die Verarbeitung eines ZUGFeRD-/Factur-X-PDF-Containers ist durch die direkte XML-Probe nicht belegt. Eine eigenständige Ist-Probe dieses heutigen PDF-Eingangswegs ist mit echtem Zugang nachzuholen.
4. E2 mit echtem lokal freigegebenem Azure-Zugang ausführen; bis dahin beide Zeilen ausdrücklich offen.
5. Der geprüfte Ausgangsweg erzeugt derzeit ein PDF ohne strukturierten Datenteil; XRechnung/ZUGFeRD-Ausgabe ist in dieser Probe nicht vorhanden.

## E5 · Bestandsschutz und Liefergrenze

Gegenüber dem jeweiligen main-Stand ändert S54a keine Produktdateien, Migrationen, Auth, Gates oder CI. Normale Hooks der Fixtures und des Runners/Befunds: Typen und Lint grün; keine zugehörigen Unitfälle. Selbsttragender tatsächlicher Probelauf: 10/10 grün in 19.49s. Vollständiger lokaler Unitlauf am83e6effb genau einmal: 210 Dateien /2072 Tests grün in613.08s. Anschließend Owner-S21 main17d4ba14 per normalem Zwei-Eltern-Merge6d904995 übernommen: 5299 Steuerdateien bytegleich, Produktcode exakt main; normaler Merge-Hook129 Dateien /1122 Tests grün. Danach genau fünf betroffene echte Integrationsfälle grün in18.70s (3 Anmeldung/Schalter, beschädigtes XML und Rechnungsausgabe; elf nicht ausgewählte Fälle ausdrücklich nicht erneut ausgeführt). Modul-, Scope- und NoFake-Gates grün. Exakte eigene PR-CI/PL-Prüfung stehen noch aus; kein S54a-fertig/Dev-/Production-Nachweis.

Reproduktion: bestehende Vitest-Konfiguration mit include exakt auf istProbe.integration.test.ts setzen, übrige Einstellungen und vorhandenen replayHarness unverändert nutzen; DATABASE_URL und H18_EXPECTED_DATABASE_URL nur als Prozessvariablen für die freigegebene Loopback-DB. Keine Schlüssel in Dateien. Der Runner prüft die Quellenhashes, extrahiert nur zur Testvorbereitung die PDF-Anhänge und schreibt Rohbeobachtungen ausschließlich nach .git/kreile-s54a-actual-results.json.

Nach der Main-Integration umfasst der Lieferzweig192 Repo-Migrationen, passend zu den192 Versions-IDs der eigenen Replay-DB; das ist keine Dev-/Fresh-Abnahme. Die vollständige Formatbeobachtung und die dazugehörige Ausgangsrechnung wurden vor dem Main-Sync gesichert. Die fünf anschließenden Integrationsfälle sind zusätzliche eng ausgewählte Nachweise, keine behauptete Wiederholung aller Formate am neuen Kopf.

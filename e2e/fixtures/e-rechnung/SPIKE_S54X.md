# S54x – Machbarkeitsprobe ZUGFeRD/Factur-X EN 16931

Stand: 2026-11-18T11:42:33.410192+01:00. A-03/A-10. Auftrag: PL 18.11. 11:28 und `_review/pakete/S54x_SPIKE_ZUGFERD.md`. Reiner lokaler Wegwerf-Spike; kein Produktbau, keine Migration, keine Runtime-Abhängigkeit installiert, kein PR und keine Lieferung nach main. S14b hat bei M1-Freigabe Vorrang.

## Ergebnis

**Technisch ja, mit eingebetteten Schriften. Der unveränderte bisherige PDF-Ausgang allein reicht nicht.** Aus dem tatsächlichen eingefrorenen TEST-Rechnungs-Snapshot ließ sich über den bestehenden `ImmutableInvoiceDocument`/@react-pdf-Renderer, eine isolierte Schrift-Ersetzung im erzeugten Elementbaum und pdf-lib ein PDF/A-3B mit genau einer bytegleichen `factur-x.xml` erzeugen. Sowohl PDF/A als auch EN-16931-XML sind unabhängig vom irreführenden Mustang-Gesamtstatus positiv geprüft. Der bestehende S54e-Eingangsparser liest den fertigen Container wieder korrekt. Das ist ein Machbarkeitsbeleg für genau diesen TEST-Fall, keine fertige Ausgangsfunktion.

## Tatsächliche Quelle und Abgrenzung

- Bestehende, zuvor über `issueInvoiceAction` ausgestellte TEST-Rechnung **R-2026-0001**, ID `6990a0ab-a651-49cb-b678-23428e58429f`, aus der eigenen Loopback-DB 54342. Snapshot und gespeichertes Original wurden in einer READ-ONLY-Transaktion erneut gelesen. Keine neue Rechnungsnummer, kein neuer Schreibweg, keine DB-Änderung.
- Original-PDF: SHA-256 `55c2aa47ccf32faaa09cb759dc26f453be58b55c4621bd96a1335070c839c2af`; identisch zum ursprünglichen Ausstellungsbeleg. Nur diese ausdrücklich TEST-markierten Daten wurden verwendet.
- Eine tatsächliche BASE-Zeile, Menge 1, netto 100,00 EUR, 19 % / 19,00 EUR USt, brutto 119,00 EUR; Fälligkeit 01.12.2026. Keine Preise oder Steuerwerte neu berechnet. `seller.taxId` ist im bestehenden PDF ausdrücklich als USt-IdNr. beschriftet und wurde deshalb als VA exportiert. Das vorhandene Länderlabel Deutschland wurde für diesen Fall in DE übersetzt.
- Die historische lokale Ergebnis-JSON hatte ausschließlich im Auftragstitel einen falsch dekodierten Mittelpunkt; der aktuelle DB-Snapshot ist maßgeblich. Original-PDF-SHA und alle übrigen Felder wurden gleich geprüft. Kein Produkt- oder Daten-Fix.
- XML und technische Hilfen liegen nur unter `.git/kreile-s54x/`. Getrackt wird ausschließlich dieser Bericht. Kein Klon, Worktree, Dienst, CI-Job oder dauerhafter Validator wurde angelegt.

## Messungen

| Prüfung | Tatsächliches Ergebnis | Fehlerzahl / Grenze |
|---|---|---|
| KoSIT Validator 1.6.3, offizielle Konfiguration 2026-08-31 / XRechnung 3.0.2, Szenario **EN16931 (CII)** | Schema Y, Schematron Y, ACCEPTABLE, Exit 0 | **0 Fehler**, 1 akzeptiert / 0 abgelehnt |
| Mustang CLI 2.26.0: finale eingebettete EN-16931-XML | XML summary valid | **0 Fehler**, 6 zusätzliche XRechnung-Hinweise; diese sind kein XRechnung-PASS |
| Im Mustang enthaltene veraPDF 1.30.2: **finales PDF/A-3B** | isCompliant=true, PDF summary valid | **0 fehlgeschlagene Assertions von 9731** |
| Gegenprobe auf dem unveränderten bisherigen Helvetica-PDF plus XML/XMP | XML gültig, **PDF/A ungültig** | **2 Font-Assertions**: Helvetica und Helvetica-Bold sind nicht eingebettet |
| Bestehender `recognizeInvoicePdf`, finale Datei | OK, echte Nummer/Absender/USt-ID und 100/19/119 wieder gelesen | 1 gezielte Probe grün, keine Parser-Dopplung oder Azure-Antwort |
| Containerprüfung mit pdf-lib | 1 Seite, 1 AF-Datei, Name factur-x.xml, AFRelationship=Alternative | XML-Anhang bytegleich zur validierten XML |
| Zusätzliche strikte XRechnung-CII-Probe aus denselben Daten, nur Profil-ID umgestellt | REJECTED, Exit 1 | **5 Fehler**; fehlende Quellfelder wurden nicht erfunden |

**Wichtige Validator-Falle:** Mustang meldete beim ursprünglichen Helvetica-PDF oben `Parsed PDF:invalid`, im PDF-Abschnitt `isCompliant=false`, aber ganz unten trotzdem `summary valid` und Exit 0. Eine spätere CI darf nicht nur Exit/Gesamtsummary auswerten: PDF/A-Unterergebnis UND XML-Unterergebnis müssen erfolgreich sein. Beim finalen PDF sind beide tatsächlich gültig.

Die sechs Mustang-Hinweise betreffen Geschäftsprozess, elektronische Absender-/Empfängeradresse, BuyerReference, XRechnung-Profilkennung und Verkäuferkontakt. Die streng als XRechnung deklarierte Variante hat genau diese fünf Fehler: `PEPPOL-EN16931-R001`, `PEPPOL-EN16931-R020`, `PEPPOL-EN16931-R010`, `BR-DE-15`, `BR-DE-2` (die Profilkennung ist dort bereits gesetzt). Das offizielle EN-16931-Basisszenario hat dagegen keine dieser zusätzlichen XRechnung-Pflichten.

## Bibliothek und PDF/A-Bausteine

- **pdf-lib 1.17.1 – MIT**, nur isolierte UMD-Datei für den Spike, unverändertes App-package.json/Lockfile. Datei-Anhang und AF-Beziehung über `PDFDocument.attach`; XMP/OutputIntent über vorhandene Low-Level-Objekt-API. Es ist **kein automatischer PDF/A-Konverter**.
- Bestehender **@react-pdf/renderer 4.5.1**; keine Produktdatei geändert. Die erste Registrierung unter dem bereits eingebauten Familiennamen Helvetica änderte die Standardfonts nicht. Für die positive Probe wurde ausschließlich im isolierten Elementbaum die Familie auf separat registrierte **Source Sans Pro Regular/Bold** umgestellt. Deren Fonts sind in der validierten PDF eingebettet; Lizenz **SIL OFL 1.1**, Original-Lizenz lokal gesichert. Das verändert Metriken und braucht später einen eigenen Layout-Abgleich; kein V45-/Bildabgleich-PASS.
- sRGB-Profil aus Apache FOP im Mustang-JAR, zugehörige **ZLIB-Lizenz** lokal gesichert. OutputIntent mit eingebettetem ICC, PDF/A-3B-XMP, Factur-X-Erweiterungsschema mit Dateiname/Version/Profil und synchronen Dokument-/XMP-Metadaten.
- Mustang **Apache-2.0**, KoSIT **Apache-2.0**, portable Temurin-JRE nur lokales Werkzeug. veraPDF wird durch Mustang tatsächlich ausgeführt; kein separater dauerhafter Java- oder Konvertierungsdienst erforderlich. Die Produktentscheidung über eine neue Laufzeitabhängigkeit bleibt dem späteren Paket vorbehalten.

## Bauaufwand und Risiken für das spätere Schritt-Blatt

**Technische Schätzung: 1,5–2,0 Einheiten** für einen vollständig getesteten ZUGFeRD-Ausgang im vorhandenen Writer, keine Freigabe oder Planänderung. Grob: 0,5 für vollständige Snapshot→CII-Abbildung und Fehlerwege, 0,5 für eingebettete Schriften/XMP/ICC/Container, 0,5–1,0 für unveränderliche Original-Persistenz, Wiederholung, Versand-Anbindung und Abnahmefälle. Kein zweiter Nummern-/Rechnungs-/Mailweg.

Offen vor Produktbau:

1. Fontwahl und Layout: eingebettete Schriften müssen den gesamten bisherigen Rechnungsinhalt, Zeilenumbrüche und Glyphen tragen; Helvetica-Standardfonts dürfen nicht durch bloße PDF/A-Metadaten als konform ausgegeben werden. Die Probe zeigt nur eine Seite mit diesen TEST-Daten.
2. CII-Abbildung aller vorhandenen Snapshots: BASE, Mehrarbeit, Versand-/Referenzzeilen, mehrere Steuersätze, Reverse Charge, Storno/Korrektur, historische Daten und fehlende Pflichtwerte sind hier **nicht vollständig abgenommen**. Länder- und Steuer-ID-Typen benötigen echte kanonische Quellen, keine pauschalen Defaultwerte.
3. Neue PDF-/XML-Bytes müssen vor dem bestehenden Hash-/Originalbeleg eingefroren werden. Bereits ausgestellte Originale dürfen nicht nachträglich umgeschrieben werden. Retry/Neusendung muss dieselben gespeicherten Bytes senden.
4. ICC/XMP/Fontprogramme und Anhangsnamen sind dauerhafte Dateikonformität, keine reine UI-Frage. Bei Library-Updates sind externe Validator-Versionen und Profile explizit festzuhalten. pdf-lib 1.17.1 benötigt eine gesonderte Wartungs-/Abhängigkeitsprüfung vor Aufnahme.
5. Testmaterial und Validator-Ausgaben bleiben TEST/lokal. Kein realer Mailversand, keine Production-/Dev-/Tablet-/Gesamt-Abnahme aus diesem Spike.

## Ausweichweg: separate XML plus normales PDF in derselben Mail

Der vorhandene PDF- und Mailweg könnte die gespeicherte CII-XML zusätzlich zum unveränderten normalen PDF versenden. Dadurch entfallen PDF/A-3-Konvertierung, eingebettete Fonts und Factur-X-XMP. **Schätzung 0,75–1,0 Einheiten** für EN-16931-CII aus dem vorhandenen Snapshot, unveränderliches XML-Original und gemeinsame Versand-/Retry-Belege; keine Umsetzung hier.

Die gemessene **EN-16931-CII-XML ist mit 0 Fehlern gültig**, aber **keine fertige XRechnung 3.0.2**. Für den ausdrücklich XRechnung genannten Ausweichweg fehlen im Snapshot Geschäftsprozess, elektronische Verkäufer-/Käuferadressen, BuyerReference und Verkäuferkontakt. Diese Quellen/Erfassungswege muss das Schritt-Blatt festlegen; bis dahin ist diese Variante nicht als gültige XRechnung auszugeben. Ihre zusätzliche Datenerfassung ist in der Schätzung nicht enthalten. Der Spike trifft keine fachliche Auswahl zwischen den Wegen.

## Belege und Reproduktion

- Gesamter maschinenlesbarer Befund: `.git/kreile-s54x/final-proof.json`.
- Positive XML: `.git/kreile-s54x/factur-x.xml`, SHA-256 `f104525da93012437bef5e4f3c385658a95c76722f70c17c5cd782386ad68654`.
- Finales PDF: `.git/kreile-s54x/final-factur-x.pdf`, 28533 Bytes, SHA-256 `19df9174cb158c649543f09928ec4b42c97d1476543b48059d7fd687e0b97f76`.
- KoSIT-Reports: `.git/kreile-s54x/kosit-results/factur-x-report.xml` und `strict-xrechnung-report.xml`; jeweilige HTML-Berichte liegen daneben. Keine Prüfkonfiguration verändert.
- Mustang/veraPDF vollständig: `.git/kreile-s54x/final-mustang.log`; negativer Helvetica-Vergleich `pdf-original-mustang.log`. Attach-/Byteprüfung `attachment-proof.json`, bestehender Eingangsleser `reader-final-proof.json` / `reader-final-licensed-profile.log`.
- Technische Erzeuger: `export.mjs` (READ ONLY), `generate-xml.py`, `attach.cjs`, `spike.test.ts` und isolierte Vitest-Konfiguration im selben lokalen Verzeichnis. Alle Werkzeuge/Downloads samt Quellen und SHA unter `downloads.json`/Metadaten. Kein Produktcode committet.
- Zwei frühe technische Probeprobleme waren im eigenen Aufbau: falscher Vorschlagsfeldname `rechnung.brutto` statt bestehendem `rechnung.betrag`, und Windows-Java-Stdin-Handle ohne Datei. Nur die eigene Probe/Startumgebung korrigiert; Erwartungen des Pakets, Produktcode und Validatoren unverändert.

Primärquellen: [pdf-lib / MIT](https://github.com/Hopding/pdf-lib), [KoSIT CLI-Nutzung](https://github.com/itplr-kosit/validator-configuration-xrechnung/blob/master/docs/usage.md), [offizielle Prüfkonfiguration 2026-08-31](https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/tag/v2026-08-31), [Mustang 2.26.0](https://github.com/ZUGFeRD/mustangproject/releases/tag/core-2.26.0), [Source Sans / OFL](https://github.com/adobe-fonts/source-sans/blob/release/LICENSE.md).

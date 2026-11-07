# Mini-Module 04 – Vernetzt für dich

07.11.2026 · Bestehende Vernetzung 04 nach Abschlussprüfung behutsam korrigiert. Keine neue Vorschauversion. Der vorherige V04-Stand ist im Arbeitsarchiv gesichert; V03 und ältere HTMLs bleiben unverändert.

**Für Claude zuerst:** [Aktualisierte Übergabe zur Vernetzung 04](Kreile_Zuvorkommende_App_Uebergabe_2026-11-07.md). Sie liegt jetzt im selben Paket. Claude entscheidet; kein Neubau der App oder vorhandener Karten.

## Öffnen und ausprobieren

`Kreile_MiniModule_04_Vernetzung.html` öffnen. Die drei Einstiegsdateien führen in dieselbe Datei und denselben lokalen Teststand:

- `Eingang_04.html`: rotes Plus → Eingang. Unter **„Vernetzung ausprobieren · Testfälle“** stehen vier bewusst synthetische Belegabläufe bereit.
- `Nachrichten_04.html`: **Mailansicht / Anliegen** wählen. Anfrage zu KV weiterführen; nach Testversand steht die Kundenantwort aus. Nebeninformationen wie „alte Halter erhalten“ werden mitgenommen.
- `Werkstatt_04.html`: Kurzansichten mit AZ/Mehrarbeit bleiben erhalten. Eine offene Kunden-Terminanfrage lässt sich direkt vom zugehörigen Auftrag öffnen.

Die gemeinsame Hauptdatei darf nicht vom Rest des Pakets getrennt werden, wenn die drei Einstiegsdateien verwendet werden. Die Hauptdatei selbst funktioniert eigenständig. Keine vertraulichen oder echten Firmenunterlagen in diese Vorschau geben.

## Was jetzt konkret vernetzt ist

Referenz und Lieferant verbinden Rechnung, Lieferschein und Angebot im lokalen Testbestand. Positionsbezeichnung und Mengen werden verglichen; abweichende Gesamtbeträge werden zur Gegenüberstellung angeboten. Ein eindeutiger Kontobeleg mit passendem Lieferanten, Rechnungsnummer und Gesamtbetrag belegt die dargestellte Testzahlung. Teilzahlungen bleiben offen; mehrere passende Kontobelege werden nicht eigenmächtig zusammengefasst.

Das grüne Feld zeigt zuerst die Bedeutung und eine passende Handlung. Herkunft und weitere Angaben bleiben aufklappbar. Neue Belege und Änderungen verändern den Abgleich. Eine Rückfrage erledigt den Fall nicht. Fristen werden als verknüpfte Aufgaben im bestehenden Datenbestand gehalten; eine erledigte Abweichung wird nicht weiter als offen dargestellt. Die Oberfläche und die Darstellungsfunktionen von **Der Tag wurden nicht neu gestaltet**; sie lesen weiterhin die gemeinsamen Vorgänge und Aufgaben.

Im Postfach sind Mail und Anliegen zwei Ansichten derselben Daten. KV-Version, Versandstand, Anfrage und Folgeschritt hängen zusammen. Der Rückverweis Nachricht → Beleg ist direkt gespeichert. Der Eingang bleibt über das rote Plus ohne vorgeschaltete Auswahl erreichbar.

## Klare Grenzen

**Dies ist eine isolierte Funktions- und Bedienprobe, keine Backend-Implementierung.** Verbindungen werden aus lokal erfassten Werten und gekennzeichneten Testdaten berechnet – nicht als statische Ergebnissätze eingeblendet. Die Textauswertung bleibt jedoch regelbasiert und begrenzt. Echte KI/OCR, freie semantische Zuordnung, Geräteübergabe, E-Mail-Versand, Bank, Buchhaltung und Produktionsdaten sind nicht angeschlossen. Ein funktionierender Testfall ist kein Nachweis für beliebige Dokumente oder alle Kundenfälle.

Die Testfälle enthalten vereinfachte Einzelpositionen. Mehrpositionen, Teil-/Sammellieferungen, Gutschriften, Währungen, steuerliche Behandlung und mehrere Zahlungseingänge benötigen die tatsächlichen Fachverträge; sie werden hier nicht vorgetäuscht. Zahlungs- und Buchhaltungsaktionen enden ehrlich an der nicht angeschlossenen Fähigkeit. Quellen und offene Folgeschritte bleiben dabei erhalten.

Kunden-, Auftrags- und Teilkarten sind in dieser Datei ausdrücklich markierte **lokale Testkarten** aus dem bisherigen Entwurf. Keine neuen Ersatzkarten wurden gestaltet. Beim Einbau müssen die bereits vorhandenen Endversionskarten öffnen. Die Vorschau hat keinen sicheren Zugriff auf deren echte IDs, Anmeldung oder Daten und kann sie daher nicht direkt darstellen.

## Anschluss für den Endversionschat – kein Neubauauftrag

Claude prüft und entscheidet. Die HTML-Datei ist eine Bedienreferenz, **nicht komplett in die Produkt-App kopieren**. Keine neuen Tabellen, Provider oder parallelen Zustände daraus ableiten. Bestehende Paket-/Stufenfolge unverändert lassen.

| Vorschau-Code | Aufgabe | Anschluss im Produkt |
| --- | --- | --- |
| `netFacts`, `netFill` | In dieser Testdatei begrenzte Textauswertung | Bestehende Capture-/Dokumentenverträge; Fundstellen und Unsicherheit mitführen. Nicht die Regex-Erkennung zur KI erklären. |
| `netContext`, `netPayment` | Belege, Unterschiede und Zahlungsbezug aus demselben Testbestand berechnen | Berechtigte Fach-Read-Ports; keine zweite Datenwahrheit. Vorschläge durch belegte Fakten absichern. |
| `netSync` | Zustände/Folgeschritte nach Datenänderung zusammenhalten | Bestehende Commands, Events, Receipts und Readback; atomare/idempotente Änderungen und sichere Wiederaufnahme. Kein clientseitiger Ersatz dafür. |
| `updateEntry`, `netReview`, `netCompare` | Kontext zuerst, konkrete Aktion, Herkunft aufklappbar | Bestehender Eingang und seine Fachaktionen, aktuelles Endversions-Designsystem. |
| `renderMessages`, `messageDetail`, `messageReply` | Zwei Sichten, gleiche Quellen/Fälle; Antwort mit bekanntem Bezug | Vorhandene `messageContract`-/Lifecycle-/Assignment-Ports; keine eigene Nachrichtenerledigung neben dem Fachvorgang. |
| `workCard`, `buddyOrder` | Relevante Kundenanliegen am Auftrag sichtbar machen | Vorhandene Werkstattprojektion; vorhandene `openOrder`/`openCustomer`-/Teilkartenaufrufe. |

Der gemeinsame Produktvertrag bleibt: **Quelle → Fakten/Fundstellen → Kandidaten/Abweichungen → zulässige Aktion → Bestätigung → bestehender Fachbefehl → nachgewiesenes Ergebnis → aktualisierte Sichten/Folgeschritte.** KI darf keine Rechte, Preise, Zahlung oder Ausführungserfolge erfinden. Bestätigte Kundensonderwünsche gehen auftragsspezifisch mit, nicht ungeprüft als Arbeitsanweisung auf jedes Teil.

Die beiliegende Markdown `Kreile_Zuvorkommende_App_Uebergabe_2026-11-07.md` wurde auf diesen V04-Stand aktualisiert. Ältere Übergaben unter V03 sind historische Vergleichsstände, nicht der aktuelle Integrationsbrief.

## Abschlussprüfung und gezielte Korrekturen

- Geänderter KV: Fassung, Status, Begleitung und Versandbutton aktualisieren sich gemeinsam; der Eingabefokus bleibt erhalten.
- Mengenabweichung von Rechnung **und** Lieferschein aus sichtbar; bei passendem Vergleich keine unnötige Rückfrage.
- Fehlendes Angebot und uneindeutige Kontobelege erhalten konkrete nächste Aktionen.
- Gesendete Rückfragen bleiben als unveränderte Nachricht lesbar, nicht als neuer Entwurf mit Senden-Button.
- Zurück aus Vergleich/Rückfrage/Kontobelegen führt wieder zum Beleg; das rote Plus bleibt auch im Postfach rechts.

[Prüfbericht und Grenzen](Kreile_Vernetzung04_Abschlusspruefung.md): 57 bestandene Prüfpunkte in drei Skripten, zusätzlich Sichtprüfung. Keine Aussage über alle denkbaren Eingaben oder Produktreife.


Browser-Durchläufe und Gegenfälle: Beleg-/Zahlungsabgleich, falscher Lieferant, mehrdeutige Referenzen, Teilzahlung, doppelte Zahlungsreferenz, Quellenkorrektur, spätere Lieferung, Fristaufgabe, KV-Sonderwunsch, Versandstatus, Mail-Reiter, zugeordnete Rückfrage, dauerhafter Belegbezug, rotes Plus und AZ-Korrektur. Ansichten bei 1914 × 917, 1220 × 880 und 390 × 844 geprüft. Einzelheiten stehen in `PRUEFUNG_Vernetzung04.json` im Archiv.

Keine unabhängige Agentenabnahme: zusätzlicher Prüfer war wegen der Sitzungsgrenze nicht verfügbar. Kein Produktcode, Backend oder alter HTML-Stand wurde verändert.

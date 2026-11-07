# Vorschau-Modul Eingang (rotes Plus → „Neuer Eingang“) – Knöpfe und App-Wege

Öffnen: `index.html` (eigenständig, Teststand `kreile-vorschau-modul-eingang`; enthält die KV-Schicht unverändert). Start öffnet den Eingang; zum Prüfen „×“ schließen, dann Vorschauleiste → „Prüfwege Eingang“ (Startknopf + erwartetes Ergebnis je Weg).

Grundlage: V04-Eingang, Auftrag V04 §2 (Erhalt), §4 (Kreislauf Reklamation), §5 Nr. 5, 6, 8, 9, 10, 13; U-241, U-242, U-243 Punkte 1–8. Das grüne Begleitfeld ist die Ergebniskarte (keine zweite Karte).
App-Weg = Anschluss laut Auftrag §3 (Code main `323b919`) bzw. gebundener Bauplan 4.8 `screens[reklamation]`/`prozesse.reklamation` (AP-EIN 4c, PL-Entscheide BAULOG 07.11. 17:50). Stand: vorhanden / teilweise / fehlt.


**App-weite Regel (Owner 07.11.):** Die App stellt keine Zuordnungs- oder Art-Fragen („Wem gehört das?“, „Was ist das?“, „Welcher … ist gemeint?“, „zu welchem Auftrag?“). Sie schlägt den wahrscheinlichsten Weg mit Grund vor (ein Hauptknopf), Alternativen stehen daneben. Grundlage der Vorschläge: Name/Adresse/Nummer im Text, Thread-Bezug, frühere Aufträge/KVs mit gleichem Teil, erwartete Ware, Ankündigungen. Ohne belastbaren Grund kein erfundener Treffer.

## A. Vor der Aufnahme

| Knopf | Nächster Zustand | App-Weg | Stand |
|---|---|---|---|
| Rotes Plus (Titel „Neuer Eingang“) | Eingang „Hey {Vorname}, was kann ich für dich tun?“ | `KreileHeader.tsx:147` → `GlobalCreateFlow.tsx` (erste Ansicht ersetzen, 3.x bleibt) | vorhanden |
| Sprechen | Diktat ins Textfeld | **fehlt – Owner-Frage F2** (Anbieter/Datenschutz); im Bauplan `stufe: offen` | fehlt |
| Foto / Foto aufnehmen (Handy/Tablet: Hauptweg, U-243 §1) | Kamera; Foto hängt am Eingang | vorhandene Kamera/Upload der Erfassung | vorhanden |
| Datei / Datei wählen | Dateiauswahl; Original am Eingang | vorhandener Upload | vorhanden |
| Aus Mail (U-243 §8) | Mailliste → „In den Eingang“ → **ein** Eingang je Mail, Anhänge und Bilder im Text als Originale, danach dieselbe Ergebniskarte | Mail-Auswahl `mailSelectionContract` → `intake_item` `kanal='mail'`, idempotent über `graph_message_id` (AP-EIN 3.4, PL 17:50 Nr. 4) | fehlt (läuft bei Codex) |
| Fotos mit Tablet/Handy (nur Desktop) → Handy-Ansicht zeigen · Test / Anfrage zurückziehen | Gerät zeigt „PC möchte Fotos · Öffnen“ | Geräteübergabe an dieselbe Eingangs-ID | teilweise |
| PC möchte Fotos · Öffnen | Kamera für **diesen** Eingang; „Am Desktop weiter“ → Foto liegt im PC-Eingang | wie oben | teilweise |
| Neu | leerer Eingang, alter bleibt in der Liste | Entwurf erhalten | vorhanden |

## B. Ergebniskarte (U-243 §2–§7)

| Knopf / Element | Nächster Zustand | App-Weg | Stand |
|---|---|---|---|
| Vorschaubild (Galerie) | Original groß | Original aus der gesicherten Datei | vorhanden |
| Feld-Chip (Empfänger, Absender, Sendungsnummer, Dienst; gelb = unsicher) | „{Feld} berichtigen“ → „{Feld} übernehmen“, Treffer neu | Fundstellen + Unsicherheit aus `recognizeIntakeNoteAction`/`captureRecognition.ts` (**keine** Vorschau-Regex) | teilweise |
| Ware zu {Auftrag} buchen | Wareneingang des Auftrags mit Etikettfoto und Regal vorbelegt → „Wareneingang übernehmen“ | `saveGoodsReceiptAction` (`eingang.actions.ts:64`), Foto als Warenfoto | vorhanden |
| Ware für {Kunde} annehmen | Ware-Dialog mit Kunde, passende Aufträge zuerst | `saveGoodsReceiptAction` ohne Auftrag | vorhanden |
| Kunde {Absender} anlegen | Kundendialog vorbelegt → danach Ware | Kunde anlegen der Erfassung | vorhanden |
| Sendungsnummer zu {Auftrag} übernehmen (Absender = eigene Firma, U-243 §3) | Übergabe mit Dienst + Nummer vorbelegt | Warenausgang `recordGoodsOut` | vorhanden |
| Versand einem Auftrag zuordnen / Vorgang zuordnen · Richtung unklar | Auswahl Kunde/Vorgang | Picker (`vorgang-waehlen`) | teilweise |
| Weitere Seite (U-243 §5) | Datei/Foto hängt an, Karte liest neu („2 Seiten gelesen“) | `retryIntakeRecognitionAction` (`eingang.actions.ts:77`) | teilweise |
| Gelesener Text (eingeklappt) | Rohtext | Erkennungsergebnis | teilweise |
| Erneut lesen (Fehlerkarte, U-243 §6) | Ergebniskarte | `retryIntakeRecognitionAction` | vorhanden |
| Selbst eintragen | Textfeld, Foto bleibt | Erfassung ohne Erkennung | vorhanden |
| Protokoll (eingeklappt) | Fehlercode nur hier | Ablaufprotokoll | teilweise |
| Ja, KV vorbereiten / Auftrag aufnehmen / … aufnehmen (Text erkannt) | jeweiliger Fachweg (siehe KV-Modul) | `chooseIntakeCaptureKindAction` (`:107`) + Fachbefehl | teilweise |
| {Feld} berichtigen · {Grund} (Widerspruch, U-242) | markiert die widersprüchliche Stelle im Text | Erfassung | fehlt (Text) |

## C. Nebenwege an jeder Karte (U-241/U-243 §4)

| Knopf | Nächster Zustand | App-Weg | Stand |
|---|---|---|---|
| Vorschlag bei unklarer Art (kein Text lesbar): z. B. „Ware zu K-26-1090 buchen“ · Grund „einziger Auftrag mit erwarteter Ware“ bzw. „… hat das Paket angekündigt“; sonst „Foto neu aufnehmen“, „Notiz zu {Kunde} ablegen“ oder „Aufgabe anlegen“ | jeweiliger Weg | Kontext aus Erwartungen/Ankündigungen (Lese-Ports Aufträge, Nachrichten) | fehlt |
| Anderer Kunde/Vorgang | Liste „Kunde oder Vorgang zuordnen“, nach Wahrscheinlichkeit sortiert, oberster mit „Vorschlag: {Grund}“ | Kundenpicker + `vorgang-waehlen` | teilweise |
| Etwas anderes ▾ | Arten als Knöpfe: Auftrag/KV, Ware, Eingangsrechnung, Lieferschein, Quittung, Reklamation, Dokument/Notiz zum Kunden, Aufgabe | `chooseIntakeCaptureKindAction` | teilweise |
| Dokument / Notiz zum Kunden | Original + Text an der Kundenkarte | Kundenkarte (Dokumente) | teilweise |
| Später zuordnen | Eingang bleibt in „Neuer Eingang“ (· zuordnen) + Aufgabe „Eingang zuordnen · …“ auf Der Tag | `intake_item` offen + Aufgabe (`saveIntakeTaskAction`) | teilweise |
| Original ansehen | Original groß | vorhanden | vorhanden |
| Weiterbearbeiten (Liste) | Eingang wieder offen | vorhanden | vorhanden |
| Verwerfen → Eingang verwerfen (Korrektur 9) | Rückfrage, dann weg; nur ohne entstandenen Vorgang | `discardIntakeDraftAction` | vorhanden |
| Eingang zuordnen (Der Tag) | öffnet den Eingang | Der Tag Anschluss | teilweise |

## D. Korrektur 6 – Nummer im Text ist Bezug

| Fall | Ergebnis | App-Weg | Stand |
|---|---|---|---|
| „K-26-1090“, „KV-26-118“ im Text | keine Stückzahl, grün markiert „Auftrag … gefunden“, Kunde aus dem Auftrag, Treffer „Auftrag … im Text“; Picker nur ohne eindeutigen Treffer | Erkennung: Auftrags-/KV-/Rechnungsnummer als Bezug | fehlt |

## E. Reklamation 4.8 – aufnehmen → entscheiden (Korrektur 13, Kreislauf K1–K4)

| Knopf | Nächster Zustand | App-Weg | Stand |
|---|---|---|---|
| Reklamation zu {Auftrag} aufnehmen (eindeutiger Bezug) bzw. Reklamation am Auftrag aufnehmen → Picker | Reklamationskarte „aufnehmen“ (Teile je Teilesatz, Mangel, Foto, Ware zurück?) – **kein** Sofort-Nacharbeitsauftrag mehr | 4.8 aufnehmen; `complaints.intake_item_id` | teilweise (P106) |
| Auftrag-Vorschlag: „Vorschlag: {Auftrag} · {Grund}“ → „Reklamation zu {Auftrag} aufnehmen“; darunter „Anderer Auftrag“ (auch übergebene/fertige) und „Kein passender Auftrag · Vorgang ohne Auftrag aufnehmen“ (Korrektur 5) | Reklamation mit bzw. ohne Auftrag | `vorgang-waehlen` mit Rangfolge | fehlt |
| Foto vom Mangel | Foto an der Reklamation | Upload | vorhanden |
| Ja, kommt zurück / Nein, bleibt beim Kunden | vorbelegt aus der Nachricht („… zurückbringen“), änderbar | 4.8 Feld Ware-Rückgabe | teilweise |
| Reklamation {RK} aufnehmen | „Vorschlag: Nacharbeit · Ware kommt zurück“ vorausgewählt (sonst keine Vorauswahl), Aufgabe auf Der Tag | 4.8 aufgenommen | teilweise |
| Nacharbeit → Nacharbeitsauftrag anlegen | eigener Auftrag NA-…, Preis 0, „Rücksendung ausstehend“; Aufgabe „Ware fehlt · Nacharbeit …“ | `nacharbeitAnlegenAction` (`reworkOrderCommand.ts:273`) | teilweise |
| Nacharbeit gesperrt: „Neue Reklamation zum Nacharbeitsauftrag {NA} aufnehmen“ / „Ware kommt doch zurück“ | neue Reklamation am NA bzw. Rückgabe Ja | PL 17:50 Nr. 1 (Unique `orders_nacharbeit_zu`) | fehlt |
| Kulanz-Gutschrift → Gutschrift festhalten | Betrag Pflicht → „Kunde informieren“ | 4.8 Gutschrift | teilweise |
| Ablehnen → Ablehnung festhalten | Begründung Pflicht → „Kunde informieren“ | 4.8 abgelehnt | teilweise |
| Kunde zieht zurück → Rücknahme festhalten | Vermerk Pflicht → abgeschlossen | 4.8 zurückgezogen | teilweise |
| Ergebnis an Kunden senden · Test | Vorlage „Reklamation Ergebnis“ → abgeschlossen (mail), Anliegen erledigt | `email_templates` + `CommunicationPanel`/`sendCustomerMailAction`, Abschluss `mail` nur mit Versandbeleg (PL 17:50 Nr. 2) | teilweise |
| Ohne Mail abschließen | abgeschlossen (ohne_mail) | Regelweg vor Go-live | teilweise |
| Kunde will trotzdem Bearbeitung · KV mit Bezug (K4) | KV mit betroffenen Teilen, Bezug RK, berechnet | `createQuoteAction` mit Bezug | fehlt |
| Rücklauf aufnehmen → Galvanik → Fertig melden → Abholung/Versand abschließen | nach Übergabe automatisch „Abgeschlossen · Nachgearbeitete Ware hat das Haus verlassen“ (`nacharbeit_raus`); Ausgang ohne Rechnung (Preis 0) | `saveGoodsReceiptAction`, `transitionWareneingangToGalvanikAction`, `setOrderItemFinishedAction`, `recordGoodsOut` | vorhanden |
| Reklamation {RK} wieder öffnen | Grund Pflicht → Entscheidung offen | 4.8 wieder öffnen | teilweise |
| Reklamation {RK} · {Stand} (Auftrags- und Kundenkarte) | Reklamationskarte | `getByOrder` am Lese-Port `complaintRead.ts` | teilweise |
| Reklamation öffnen (Der Tag) | Reklamationskarte | `tagkonfig` reklamation_entscheiden/_informieren, nacharbeit_ware_fehlt | teilweise |

## F. Frist und Aufgaben

| Knopf | Nächster Zustand | App-Weg | Stand |
|---|---|---|---|
| Frist im Test vormerken (Korrektur 8) | mit Datum: „Die Frist steht auf Der Tag: {Datum}“ + „Der Tag öffnen“; ohne Datum: Zahlungsfrist wählen → „Frist … auf Der Tag setzen“ | `saveIntakeTaskAction` (Frist am Beleg) | vorhanden |
| Änderung übernehmen (Aufgabe) | Text/Fälligkeit gespeichert; „Zurück“ mit ungespeicherter Änderung fragt nach (übernehmen/verwerfen) | Aufgaben-Befehl statt lokaler Änderung (Korrektur 10) | teilweise |
| Erledigt → Zurücknehmen (im Hinweis) | Aufgabe wieder offen | `completeIntakeTaskAction` + neu Zurücknehmen | teilweise |
| Aufgabe wieder öffnen (erledigte Aufgabe) | wieder offen | wie oben | fehlt |

## G. Vorschau-Gerüst (entfällt im Produkt)

Beispiele ausprobieren (inkl. „Versandetikett · Eingang/Versand“, „Erkennung nicht erreichbar“, „Foto ohne Text“, „Auftragsnummer im Text“), Vernetzung ausprobieren · Testfälle, Handy-Ansicht zeigen · Test, Testetiketten, Prüfwege.

## Änderungen gegenüber V04 (nichts entfernt)

1. Grünes Feld wird bei Foto/Etikett zur Ergebniskarte (Art in Worten, Feld-Chips antippbar, Treffer mit Grund, ein Hauptknopf, „Weitere Seite“, Gelesener Text eingeklappt, Fehler in Worten).
2. Nebenzeile „Anderer Kunde/Vorgang · Etwas anderes ▾ · Später zuordnen · Original ansehen“. Bei unklarer Art fragt die App nicht („Was ist das?“/„Wem gehört das?“ entfallen, Owner 07.11.), sondern schlägt den wahrscheinlichsten Weg mit Grund vor; die Arten stehen unter „Etwas anderes ▾“.
3. Werkzeugzeile ergänzt: „Aus Mail“, „Fotos mit Tablet/Handy“; auf Handy/Tablet „Foto aufnehmen“ zuerst und grün, „Datei wählen“, Notizfeld „oder Notiz schreiben“ (U-243 §1).
4. Titel „Neuer Eingang“ in Kopfzeile, Liste und rotem Plus; Überschrift bleibt „Hey {Vorname} …“.
5. „Angabe im Text berichtigen“ → „{Feld} berichtigen · {Grund}“ und markiert die Stelle (U-242).
6. „Reklamation am Auftrag aufnehmen“ legt keine Nacharbeit mehr sofort an, sondern öffnet 4.8 aufnehmen → entscheiden (Korrektur 13); Picker zeigt übergebene Aufträge und „Kein passender Auftrag“ (Korrektur 5).
7. Paket-Ablage aus dem Text wird übernommen (V04 setzte immer „Annahmeregal E2“).
8. Testbestand: Auftrag K-26-1090 „Ware erwartet“, Zahlung bei K-26-1077, Bild im Text bei der Reklamations-Mail, Firmenadresse in den Einstellungen.

Entfallen: nichts.

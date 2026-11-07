# Vorschau-Modul KV – Knöpfe und App-Wege

Öffnen: `index.html` (eigenständig, lokaler Teststand `kreile-vorschau-modul-kv`). Basis: `_review/quellen/minimodule_v04/Kreile_MiniModule_04_Vernetzung.html`, Optik unverändert; angehängt ist eine Korrekturschicht (nur Logik und kleinste Ergänzungen im V04-Stil). Prüfwege mit Startzustand und erwartetem Ergebnis: Vorschauleiste oben rechts → „Prüfwege KV“.

Spalte „App-Weg“ = Anschluss laut `_review/pakete/AP-KV-V04.md` (§1–§3) und `AUFTRAG_ENDVERSION_V04_VERNETZUNG_2026-11-07.md` (§3), Code main `323b919`. Stand: vorhanden / teilweise / fehlt (= im Paket neu zu bauen).


**App-weite Regel (Owner 07.11.):** Die App stellt keine Zuordnungs- oder Art-Fragen („Wem gehört das?“, „Was ist das?“, „Welcher … ist gemeint?“, „zu welchem Auftrag?“). Sie schlägt den wahrscheinlichsten Weg mit Grund vor (ein Hauptknopf), Alternativen stehen daneben. Grundlage der Vorschläge: Name/Adresse/Nummer im Text, Thread-Bezug, frühere Aufträge/KVs mit gleichem Teil, erwartete Ware, Ankündigungen. Ohne belastbaren Grund kein erfundener Treffer.

## A. Eingang → KV (AP-KV §3.1, §3.3)

| Knopf | Wo | Nächster Zustand in der Vorschau | App-Weg im Paket | Stand |
|---|---|---|---|---|
| Rotes Plus | Kopfzeile | Eingang „Hey {Vorname} …“ | `KreileHeader.tsx:147` → `GlobalCreateFlow.tsx` | vorhanden |
| Ja, KV vorbereiten | Eingang, grünes Feld | Kunde eindeutig → KV-Karte; mehrdeutig → Vorschlag „KV für {Kunde}“ mit Grund (z. B. „hatte schon Weber-Trompeten (K-26-1048, KV-26-118)“) | `recognizeIntakeNoteAction` (`eingang.actions.ts:55`) → `createQuoteAction` (`quotes.actions.ts:54`) mit `quelle_intake_item_id`; `intake_item.vorgang_art='kv'` schreiben | teilweise (Art KV fehlt: `GlobalCreateFlow.tsx:2417/1836`) |
| KV für {Kunde} vorbereiten / Stattdessen {Kunde} | Eingang, Vorschlag | KV-Karte mit diesem Kunden, ohne Neueingabe | Kundentreffer mit Grund aus der Erkennung (Name, Ort, frühere Aufträge/KVs mit gleichem Teil) → `createQuoteAction` | teilweise (Rangfolge + Grund neu) |
| Neuen Kunden aufnehmen → Kundenangaben übernehmen | Eingang | Kunde angelegt → KV-Karte | vorhandener Kunde-anlegen-Weg der Erfassung → `createQuoteAction` | vorhanden |
| KV duplizieren | Eingang („wie beim letzten Mal“) | neuer KV mit Positionen/Stunden der Vorlage, damaliger Preis daneben | neu: Kopie über `createQuoteAction` (Positionen der Vorlage), Ist-Stunden des Vorauftrags lesen | fehlt |
| 8 Std. wie damals / … aus Abschluss | KV-Karte, Vergleich | Stunden übernommen, Preis neu | `updateQuoteAction` (`quotes.actions.ts:97`) | vorhanden |
| Zusätzlich Rückruf / Aufgabe aufnehmen | Eingang | Aufgabe angelegt | `saveIntakeTaskAction` | vorhanden |

## B. Nachrichten → Reiter Anliegen → KV (AP-KV §3.2, §3.7, §3.9; Korrektur 3, 7)

| Knopf | Wo | Nächster Zustand | App-Weg im Paket | Stand |
|---|---|---|---|---|
| KV aus Nachricht öffnen / KV weiterbearbeiten | Anliegen „fragt … an“ | KV-Karte mit Originaltext, Mail-Anhang als Original, Kundenhinweis + Sonderwunsch in „Kundenwünsche“ | `IntakeMessages.tsx`/`getIntakeMessagesAction` → `createQuoteAction` mit `quelle_nachricht_id`, `sonderwuensche`; Anhänge aus `mailSelectionContract` | teilweise |
| KV aus Nachricht öffnen (ohne Kunde) | Anliegen „Absender noch offen“ | Vorschlag „KV für Jörg Becker“ · Grund „voller Name im Text“ → „KV für Jörg Becker anlegen“; daneben „Stattdessen …“, „Neuen Kunden aufnehmen“ (Korrektur 7) | Kundentreffer mit Grund, dann `createQuoteAction` | fehlt |
| KV für {Kunde} anlegen / Stattdessen {Kunde} / Neuen Kunden aufnehmen → Kundenangaben übernehmen | Vorschlag | Nachricht dem Kunden zugeordnet → KV-Karte | Zuordnung `messageContract` + Kunde anlegen → `createQuoteAction` | teilweise |
| Gesendeten KV ansehen | Anliegen, KV beim Kunden | KV-Karte | `openQuote` (KV-Karte) | vorhanden |
| Nachfrage vorbereiten | Anliegen, KV beim Kunden | Antwortentwurf am Anliegen | `sendCustomerMailAction` (`communications.actions.ts:46`) mit Thread-Bezug (`conversationId`/`In-Reply-To`) | teilweise |
| Absage festhalten | Anliegen, KV beim Kunden | Absage-Dialog | neu `kv.absagen` (`abgesagt_am`, `absage_grund`) + Anliegen erledigt | fehlt |
| Freigabe & Wareneingang übernehmen | Anliegen „bestätigt den KV“ | Umwandeln-Dialog; **nichts gespeichert, solange nicht übernommen** (Abbruch = unverändert) | `kv.annehmen` aus Nachricht + `convertQuoteToOrderAction` in derselben Transaktion | teilweise |
| Freigabe & Wareneingang übernehmen (ältere Fassung) | Anliegen | KV-Karte + „Antwort bezieht sich auf Fassung 1, aktuell Fassung 2“ + „Geänderte Fassung 2 senden“ | Fassungsbindung `zugesagt_fassung = fassung` (KV-05) | fehlt |
| Absage zu {KV} übernehmen | Anliegen „sagt … ab“ | Absage-Dialog mit Nachricht als Nachweis → „Abgesagt“, Anliegen erledigt | `kv.absagen` aus Nachricht, Anliegen in derselben Transaktion raus | fehlt |
| {KV} ansehen | Anliegen | KV-Karte | `openQuote` | vorhanden |
| Zur Anfrage zurück | nach Versand | Anliegen der Ursprungsnachricht | Rückweg Nachricht (`kreile:oeffne`) | vorhanden |

## C. KV-Karte (AP-KV §3.4–§3.7, §3.9)

| Knopf / Feld | Nächster Zustand | App-Weg im Paket | Stand |
|---|---|---|---|
| Kunde (Link) | Kundenkarte | `openCustomer` (`EntityOverlayStack.tsx`) – keine Testkarte | vorhanden |
| Anzahl, Bauteil, Bearbeitung, Stunden, Fertigtermin | Preis = Stunden × Satz + Rüst + Material sofort; **Fassung +1 nur bei der ersten Änderung nach Versand** | `updateQuoteAction` + neue Spalte `fassung` (getrennt vom Sperrzähler `version`) | teilweise |
| 2 / 3 / 4 Wochen | Termin aus Beispielkalender | `lieferzeit_wochen` | fehlt (Spalte) |
| Ansätze (Stundensatz, Rüst, Material) | gilt nur für diesen KV, Preis neu | `stundensatz_cents`, `ruest_cents`, `material_cents` am KV | fehlt (Spalten) |
| Ansätze in den Einstellungen → Ansätze übernehmen | Einstellungen-Dialog; gilt für neue KVs, versendete bleiben | Einstellungen (`/settings`, `SettingsAdminClient`): Stundensatz, Rüst, Material, Nachfrage-Frist, Gültigkeit | fehlt |
| Kundenwünsche / interne Notiz | änderbar, geht in den Auftrag | `sonderwuensche` | fehlt (Spalte) |
| Eingang ergänzen → Am KV ergänzen | Text/Positionen am KV ergänzt | `updateQuoteAction` + Original | teilweise |
| Bilder hinzufügen | Foto als Original am KV | vorhandener Upload | vorhanden |
| Zusage zu Fassung {n} festhalten → Zusage zu Fassung {n} übernehmen | Wortlaut/Kanal Pflicht → Umwandeln-Dialog | neu `kv.annehmen` an der Karte (`zugesagt_fassung`, `zugesagt_am`, `zusage_nachweis`) | fehlt |
| Absage festhalten → Absage zu {KV} übernehmen | Grund Pflicht, Vermerk Pflicht → „Abgesagt“, Felder gesperrt, raus aus Der Tag | `kv.absagen` | fehlt |
| Absage zu {KV} zurücknehmen | wieder „Beim Kunden“, Verlauf behält die Absage | **nicht im Paket – Vorschlag gegen Fehlbedienung, Owner bestätigt** | fehlt |
| Fassung {n} erneut senden (abgelaufen) | Versand-Dialog, neue Gültigkeit | `sendCustomerMailAction`, neues `valid_until` | teilweise |
| Drucken → Druckdialog öffnen | Druckansicht der aktuellen Fassung | `readQuotePdfAction` | vorhanden |
| Gedruckt · Fassung {n} als versendet vermerken | „Beim Kunden“, Kanal Druck | `gesendet_fassung/_am`, `gesendet_kanal='druck'` | fehlt |
| KV an Kunden senden / Geänderte Fassung {n} senden | Versand-Dialog der aktuellen Fassung | `sendCustomerMailAction` (Ziel KV, PDF der aktuellen Fassung) | teilweise |
| Gesendete Fassung ansehen | Versand-Bestätigung | Readback Versandbeleg | teilweise |
| Freigabe & Ware übernehmen | Umwandeln-Dialog | `convertQuoteToOrderAction` | vorhanden |
| Auftrag öffnen | Auftragskarte | `openOrder` | vorhanden |

## D. Versand (AP-KV §3.5)

| Knopf | Nächster Zustand | App-Weg im Paket | Stand |
|---|---|---|---|
| KV senden · Test | „Beim Kunden“, gültig bis heute + Gültigkeit, Nachfrage-Datum gesetzt | `sendCustomerMailAction` → nach Versandbeleg `gesendet_fassung/_am/_kanal='mail'` | teilweise |
| Als versendet vermerken | wie oben ohne Testmail (Regelweg vor Go-live) | `gesendet_kanal='mail'` ohne Versand | fehlt |
| Nachricht aktualisieren | Mailentwurf der neuen Fassung | Entwurf je Fassung | teilweise |
| KV ansehen / Zur Anfrage zurück / Zum Eingang zurück / Weiter mit deinem Tag | jeweiliger Ursprung | Rückwege | vorhanden |
| Versandfehler ausprobieren; Kunde bestätigt diesen KV; Kunde lehnt diesen KV ab; Antwort bleibt aus · Nachfrage fällig; Gültigkeit läuft ab | Testzustände | **Vorschau-Gerüst, entfällt im Produkt** | – |

## E. Umwandeln (AP-KV §3.8, KV-05…07, KV-10)

| Knopf | Nächster Zustand | App-Weg im Paket | Stand |
|---|---|---|---|
| Zusage zu Fassung {n} festhalten / Geänderte Fassung {n} senden / Aktuellen KV senden | bei fehlender Zusage zur aktuellen Fassung: Umwandeln gesperrt, dieser Knopf führt weiter | Fassungsbindung | fehlt |
| Direktauftrag mit Nachweis | Haken + Wortlaut erscheinen | `convertQuoteToOrderAction` mit Nachweis | teilweise |
| Ware ist da / Ware kommt noch | Felder für Menge, Regal, Fotos bzw. Hinweis „Ware erwartet“ | mit Ware: `convertQuoteToOrderAction` + `saveGoodsReceiptAction` in **einer** Transaktion; ohne: nur Auftrag | teilweise |
| Paketetikett fotografieren / Inhalt fotografieren | Foto am KV, danach am Auftrag | vorhandener Upload, Rolle Etikett/Inhalt | vorhanden |
| Menge und Inhalt stimmen (Haken), Stückzahl, Regal | Pflicht bei „Ware ist da“ | `saveGoodsReceiptAction` | vorhanden |
| 2 / 3 / 4 Wochen, Fertigtermin | Termin neu ab heute | Auftrag `due` + Aufgabe „Neuen Fertigtermin bestätigen“ | vorhanden |
| Abholung / Versand | vorbelegt aus Kundenkarte | Übergabeart am Auftrag (Owner 02.11.) | teilweise |
| Zahlung (Auswahl) | vorbelegt aus Einstellungen/Kundenkarte | Zahlungsart am Auftrag (Owner 02.11.) | teilweise |
| In Auftrag übernehmen | genau **ein** Auftrag `K-26-…`, Ware im Regal, „Wartet bei Annahme“, Zusage festgehalten, Anliegen erledigt; zweiter Klick öffnet nur den Auftrag | `convertQuoteToOrderAction` + `saveGoodsReceiptAction` + `kv.annehmen`, idempotent (`clientEventId`) | teilweise |
| Auftrag anlegen · Ware erwartet | Auftrag „Ware erwartet“, keine Ware im Haus | `convertQuoteToOrderAction` ohne Wareneingang | teilweise |

## F. Auftrag mit erwarteter Ware (KV-07)

| Knopf | Wo | Nächster Zustand | App-Weg im Paket | Stand |
|---|---|---|---|---|
| Wareneingang aufnehmen | Werkstattkachel, Auftragskarte | Dialog Menge, Ablage, Etikett-/Inhaltsfoto, Haken | `saveGoodsReceiptAction` auf diesen Auftrag | vorhanden |
| Wareneingang übernehmen | Dialog | Ware im Regal, Auftrag „Wartet bei Annahme“; falsche Menge → konkrete Meldung | `saveGoodsReceiptAction` | vorhanden |
| Paket aufnehmen & Auftrag finden → „K-… · Ware erwartet“ → Zuordnung übernehmen | Eingang (Paket) | erwarteter Auftrag steht oben, bucht auf diesen Auftrag, kein zweiter Auftrag | Eingang Ware (`saveGoodsReceiptAction`), Treffer über Kunde + Auftragsnummer | teilweise |

## G. Nachfrage und Der Tag (AP-KV §3.10, KV-08/09)

| Knopf | Nächster Zustand | App-Weg im Paket | Stand |
|---|---|---|---|
| Nachfrage vorbereiten (Der Tag, Aufgabe „Bei {Kunde} wegen {KV} nachfragen“) | Antwort am Ursprungs-Anliegen bzw. Nachfrage-Dialog | vorhandene Aufgaben (`saveIntakeTaskAction`), Frist aus Einstellungen, genau eine Aufgabe je KV | fehlt |
| Antwort senden · Test / Nachfrage zu {KV} senden · Test | Aufgabe weg, nächste nach Frist | `sendCustomerMailAction` mit Thread-Bezug | teilweise |
| (automatisch) | Zusage → Aufgabe weg; abgesagt/abgelaufen → KV nicht mehr auf Der Tag, an der Karte sichtbar | Der Tag nur Anschluss (`tagkonfig` kv_freigabe) | teilweise |

Jeder Dialog hat „Zurück“ (vorheriger Dialog, Eingaben bleiben) und „×“.

## Änderungen gegenüber V04 (nichts entfernt)

1. Fassung zählt nur nach Versand bzw. Zusage hoch (V04 zählte jeden Tastendruck, auch im Entwurf).
2. Zusage bleibt als Nachweis erhalten; eine Zusage zu Fassung 1 gilt nicht für Fassung 2 (V04 löschte sie).
3. „Freigabe & Wareneingang übernehmen“ speichert nichts mehr vorab (Korrektur 3); Zusage und Anliegen-Erledigung erst mit „In Auftrag übernehmen“.
4. Knopftext „Geänderte Fassung {n} senden“ statt „Geänderten KV an Kunden senden“ (AP-KV KV-04).
5. Ergänzt im V04-Stil: Zusage/Absage an der KV-Karte, Absage-Dialog und Absage-Nachricht, Ansätze je KV und Einstellungen, „Ware ist da / kommt noch“, Übergabe- und Zahlungsart, „Als versendet vermerken“ (Mail/Druck), Nachfrage-Aufgabe, „Kunde zuerst“ bei Anfrage ohne Absender (Korrektur 7), „Wareneingang aufnehmen“ für Aufträge mit erwarteter Ware (V04 zeigte „Rücklauf aufnehmen“).
6. Auftragsnummer fortlaufend `K-26-…` statt Zufallskennung.
7. Testbestand: Mail „Stoßstangen“ mit Foto-Anhang, zusätzliche Anfrage ohne Kundenbezug (Jörg Becker).

Entfallen: nichts.

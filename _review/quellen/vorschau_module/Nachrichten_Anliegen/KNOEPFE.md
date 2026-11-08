# Vorschau-Modul Nachrichten · Reiter „Anliegen“ – Knöpfe und App-Wege

Öffnen: `index.html` (eigenständig, Teststand `kreile-vorschau-modul-anliegen`; enthält KV- und Eingang-Schicht unverändert). Prüfwege: Vorschauleiste → „Prüfwege Anliegen“.

Grundlage: V04 `renderMessages/messageDetail/messageReply`, Auftrag V04 §2 (Filter, 11 Arten, Nur Info, Kein Geschäftsvorgang, Wieder öffnen, Antwortzeile), §4 (Nachricht ↔ Vorgang, K9), §5 Nr. 1, 2, 4, 11, 13. **Mailansicht bleibt unverändert V04.**
App-Weg: `src/modules/eingang/ui/IntakeMessages.tsx` auf `src/app/nachrichten/page.tsx`, `getIntakeMessagesAction`, `messageContract.ts` (concerns/openConcerns), Lebenszyklus `intakeLifecycle.ts`, Antwort `sendCustomerMailAction` (`communications.actions.ts:46`) mit Thread-Bezug (`conversationId`/`In-Reply-To`).


**App-weite Regel (Owner 07.11.):** Die App stellt keine Zuordnungs- oder Art-Fragen („Wem gehört das?“, „Was ist das?“, „Welcher … ist gemeint?“, „zu welchem Auftrag?“). Sie schlägt den wahrscheinlichsten Weg mit Grund vor (ein Hauptknopf), Alternativen stehen daneben. Grundlage der Vorschläge: Name/Adresse/Nummer im Text, Thread-Bezug, frühere Aufträge/KVs mit gleichem Teil, erwartete Ware, Ankündigungen. Ohne belastbaren Grund kein erfundener Treffer.

## Abbildung 11 Anliegen-Arten → 5 V04-Kategorien

| Kategorie (V04) | Arten |
|---|---|
| KV | KV, Annahme, Absage |
| Reklamation | Rekla |
| Termine | Termin, Rückruf, Nachfrage |
| Belege | Rechnung, Ware, Lieferanten |
| Sonstiges | Hinweis (auch unklare Nachrichten) |

Die Art steht in jeder Karte (`E-Mail · {Art} · {Stand}`); App-Weg: `messageContract` concern-Art → Kategorie.

## A. Ansicht

| Knopf | Nächster Zustand | App-Weg | Stand |
|---|---|---|---|
| Mailansicht / Anliegen | zwei Sichten derselben Nachrichten | `IntakeMessages.tsx` + neuer Reiter | teilweise |
| KV · Reklamation · Termine · Belege · Sonstiges (Zahl = offen) | Kategorie | concern-Art → Kategorie | teilweise |
| Offen · Zuordnen · Alle · Erledigt · Aussortiert (mit Zahl) | Filter innerhalb der Kategorie; „Zuordnen“ = ohne Kunde | `openConcerns` + Lebenszyklus | teilweise |
| Nachrichtenkarte | Detail rechts | vorhanden | vorhanden |

## B. Am Anliegen (je Art)

| Knopf | Nächster Zustand | App-Weg | Stand |
|---|---|---|---|
| Reklamation zu {Auftrag} aufnehmen / Reklamation aufnehmen · Auftrag wählen | 4.8 aufnehmen (siehe Eingang-Modul E); Anliegen „wartet“, bis die Reklamation abgeschlossen ist (Korrektur 13) | 4.8 + Empfänger `kreile:oeffne` für Ziel `reklamation` (`IntakeMessages.tsx:68`) | fehlt (P106) |
| Reklamation {RK} öffnen | Reklamationskarte | wie oben | fehlt |
| Stand & Antwort öffnen → Antwort senden · Test (Termin/Nachfrage) | Antwort am Anliegen; **bleibt offen** „Antwort gesendet · Termin noch nicht bestätigt“ (Korrektur 11) | `sendCustomerMailAction` mit Thread-Bezug | teilweise |
| Neuen Termin für {Auftrag} bestätigen / Termin für {Auftrag} abstimmen | Terminkarte; mit Zusage-Haken + neuem Datum → Anliegen erledigt | Auftrag `due/confirmed` (vorhanden) | teilweise |
| Rückruf bei {Kunde} auf Der Tag → Rückruf-Aufgabe öffnen | Aufgabe; Anliegen „wartet“, erledigt mit der Aufgabe | `saveIntakeTaskAction`/`completeIntakeTaskAction` | vorhanden |
| Bei {Auftrag} als unterwegs vermerken → Wareneingang für {Auftrag} aufnehmen | Vermerk am Auftrag; nach Wareneingang erledigt | Auftragsnotiz + `saveGoodsReceiptAction` | vorhanden |
| Lieferverzug … als Aufgabe für Rolf | Aufgabe; erledigt mit der Aufgabe | `saveIntakeTaskAction` | vorhanden |
| An Kundenkarte {Kunde} merken · Info ablegen | Hinweis in der Kundenkarte, Anliegen erledigt | Kundenhinweis + Lebenszyklus | teilweise |
| Als Werbung aussortieren | Aussortiert (Grund Werbung) | Lebenszyklus „aussortiert“ | fehlt |
| Rechnung öffnen (Belege) | öffnet **den vorhandenen** Beleg, nie einen zweiten (Korrektur 1) | `saveIncomingInvoiceAction`, Bezug `documentId` | teilweise |
| KV-Knöpfe (KV aus Nachricht öffnen, Freigabe & Wareneingang übernehmen, Absage …) | siehe KV-Modul, Teil B | AP-KV | – |
| Auftrag zuordnen / Rückfrage vorbereiten (Sonstiges, V04) | Picker bzw. Rückfrage | `messageContract` Zuordnung | teilweise |

## C. An jedem Anliegen (Korrektur 4, §4, K9)

| Knopf | Nächster Zustand | App-Weg | Stand |
|---|---|---|---|
| Nur Info | erledigt („Nur Info · abgelegt“) – **gesperrt**, solange der Fachvorgang fehlt, mit konkretem Knopf (z. B. „Reklamation aufnehmen“, „Termin für … abstimmen“, „Rechnung öffnen“) + „Kein Geschäftsvorgang“ | `intakeLifecycle.ts:59-72` mit Prüfung Fachvorgang | fehlt (Prüfung) |
| Kein Geschäftsvorgang → Grund → Nachricht aussortieren | Filter „Aussortiert“ (bewusst verneint) | Lebenszyklus „kein Geschäftsvorgang“ | fehlt |
| Wieder öffnen | wieder offen | Lebenszyklus | fehlt |
| Vorschlag „Zu {Auftrag} zuordnen · {Grund}“ (z. B. „Antwort auf eure Mail zu K-26-1051“ aus dem Thread) bzw. „Kunde zuordnen · Absender unbekannt“ ohne Treffer; „Anderer Auftrag“ → Vorschlagsliste oder „Kein passender Auftrag“ → Kunden-Vorschlag | zugeordnet | `messageContract` Zuordnung + Thread-Bezug (`conversationId`/`In-Reply-To`) | teilweise |
| Antwortzeile „Antwort an {Kunde}“ + Senden · Test | Antwort am Anliegen (Thread), **schließt keinen Vorgang** | `sendCustomerMailAction` mit `conversationId/In-Reply-To` | teilweise |
| Antwort schreiben (V04, ausführlich) | Antwortdialog | wie oben | teilweise |

## D. Status nur aus dem Fachvorgang (Korrektur 2)

Termin: offen bis Termin bestätigt · Beleg: erledigt, wenn übernommen und ohne offene Abweichung, sonst „wartet“ · Ware: erledigt mit Wareneingang · Reklamation: „wartet“ bis abgeschlossen · KV: erledigt mit Auftrag oder Absage · Rückruf/Lieferant: folgt der Aufgabe · „Nur Info“/„Aussortiert“ bleiben bewusste Entscheidungen. App-Weg: Status aus den Lese-Ports der Fachvorgänge statt eigener Nachrichtenerledigung.

## Vorschau-Gerüst (entfällt im Produkt)

Testnachrichten (Rückruf, Nachfrage, Ware, Lieferant, Hinweis, Werbung), Testversand, Prüfwege.

## Änderungen gegenüber V04 (nichts entfernt)

1. Filterzeile Offen/Zuordnen/Alle/Erledigt/Aussortiert im Reiter „Anliegen“ (V04: nur Kategorien).
2. Art in jeder Karte; Kategorie aus der Art (Abbildung oben).
3. „Nacharbeit anlegen“ → „Reklamation … aufnehmen“ (4.8, Korrektur 13).
4. Terminantwort schließt nicht mehr (Korrektur 11); Beleg-Status leitet sich aus dem Beleg ab (Korrektur 2).
5. Neu im V04-Stil: „Nur Info“, „Kein Geschäftsvorgang“, „Wieder öffnen“, „Kunde zuordnen · Absender unbekannt“, Antwortzeile, Knöpfe für Rückruf/Ware/Lieferant/Hinweis/Werbung.

Entfallen: nichts.

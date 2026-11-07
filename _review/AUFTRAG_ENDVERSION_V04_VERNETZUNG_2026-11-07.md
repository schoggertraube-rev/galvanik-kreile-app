# Auftrag an den Endversion-Chat: Mini-Module V04 „Vernetzt für dich“ einbinden (Planungschat, 07.11.2026)

Quelle (bindend für die Optik): `_review/quellen/minimodule_v04/` – `Kreile_MiniModule_04_Vernetzung.html` (SHA-256 `EE9DD324…0CC4`), `kreile-vernetzung-04.css/.js`, Übergabe `Kreile_Zuvorkommende_App_Uebergabe_2026-11-07.md`, `Kreile_Vernetzung04_LESEN.md`, `Kreile_Vernetzung04_Abschlusspruefung.md`. Zuerst die Übergabe lesen, dann die HTML im Browser durchklicken.

## 0. Owner-Entscheidung U-244 (Owner 07.11., direkt an den Planungschat)
1. Die **Optik der V04-Module bleibt exakt** (Aufbau, Texte, Farben, Größen, Reihenfolge). Angepasst werden nur Logik und Anschluss – nicht das Aussehen.
2. V04 **ersetzt** die erste Ansicht und die Bedienwege von: **Eingang** (rotes Plus → „Hey {Vorname}, was kann ich für dich tun?“, ersetzt den rein-Dialog „Neu erfassen“), **Nachrichten** (bestehende Mailansicht bleibt; **neu kommt der Reiter „Anliegen“** mit Filter KV/Reklamation/Termine/Belege/Sonstiges dazu), **Werkstatt-Übersicht** (Auftragskacheln).
3. Alles andere bleibt: Kunden-, Auftrags- und Teilkarten der Endversion, Der Tag (nur Anschluss), Dialoge 3.x/4.x, Designsystem-Grundlage.
4. **Kreislauf ist entscheidend:** Reklamation oder KV per Mail/Eingang muss sicher zum Ziel kommen – Ablehnung oder Nacharbeitsauftrag, der wieder in der Galvanik landet und belegt abgeschlossen wird.
5. Kein Neubau der App, keine zweite Wahrheit, keine parallelen Datenwege (Owner-Regel „eine Wahrheit“).

## 1. Lieferform (eine Runde V44, eine Lieferung)
- `docs/project/endversion/ui/`: V04-Stil **einbinden, nicht abschreiben** (CSS als Teil des Bündels; Klassen aus V04). `SICHTVERTRAG.json` für `rein`, `nachrichten` (+ Reiter `anliegen`), `werkstatt` aus V04 neu ableiten: Kennungen `data-spec-id`, Texte wörtlich aus V04, Desktop 1914 / Tablet 1220×880 / Handy 390. `pruefbilder/` aus der V04-HTML. `routen.json` vollständig – **auch Reklamation/Nacharbeit mit Beispiel-Datensatz** (bisher `null`, MACHTWORT F2).
- `codex/BAUPLAN.next.json`: Abschnitte je Aktion (Abschnitt 3), Logik-Korrekturen (Abschnitt 5), Datenbedarfe (Abschnitt 6), Abnahmefälle (Abschnitt 8) – je Fall `paket`, `quelle`, `dann.db`.
- Änderungsliste gegenüber V43 (was entfällt, ersetzt, neu) – jeder entfallende Punkt mit Grund (Owner-Regel „nichts still entfernen“).
- Paketschnitt (Abschnitt 9) und Gegenprüfung: Bauplan gegen V04-HTML und gegen den Code auf main `323b919` (lesend, Pfade unten).

Nicht ins Produkt (nur Vorschau-Gerüst, bewusst entfallen): „Beispiele ausprobieren“, „Vernetzung ausprobieren · Testfälle“, „Nur diesen Teststand zurücksetzen“, Testkarten, Testversand-Hinweise.

## 2. Aus dem bisherigen Stand erhalten (nicht still entfernen)
Diese Punkte stehen im Sichtvertrag V43 bzw. in Owner-Entscheidungen und fehlen in V04. Sie kommen **im V04-Stil** hinzu (kleinste passende Stelle, keine neue Optik):
- **Eingang:** „Wem gehört das?“ und „Später zuordnen“ (U-241, `rein#unklar`); „Fotos mit Tablet/Handy“ / „PC möchte Fotos · Öffnen“ (Geräteübergabe); „Original ansehen“; U-243 Punkte 1–8 (`AUFTRAG_ENDVERSION_SA_2026-11-07_IDEENABGLEICH.md` Abschnitt 6) – das **grüne Begleitfeld von V04 ist die Ergebniskarte** aus U-243 (Vorschaubild, Art in Worten, erkannte Felder antippbar, Treffer mit Grund, genau ein Hauptknopf, Rohtext eingeklappt, Fehler in Worten, Etikett-Richtung über Firmenadresse, mehrere Seiten, „Aus Mail“). Es darf keine zweite Ergebniskarte geben. Einheitlicher Name „Neuer Eingang“ (OWNER_ENTSCHEIDUNGEN Z. 77) für Menü/Titel, die Ansprache „Hey {Vorname} …“ ist die Überschrift.
- **Nachrichten:** Filter Offen/Zuordnen/Alle/Erledigt/Aussortiert, die 11 Anliegen-Arten (KV, Ware, Rekla, Rückruf, Absage, Termin, Hinweis, Nachfrage, Annahme, Rechnung, Lieferanten) – im Reiter „Anliegen“ auf die 5 V04-Kategorien abgebildet (Abbildung festlegen), „Nur Info“, „Kein Geschäftsvorgang/Aussortieren“, „Wieder öffnen“, Antwortzeile mit Senden.
- **Werkstatt:** „x von y fertig“, „noch N Arbeitstage“, „Ware raus“, „Auftrag öffnen / scannen“; Mehrarbeits-Chip „Mehrarbeit {ist} Min. von {spielraum}“. V04-Filter (Alle/Wartet bei Annahme/In Galvanik/Fertig im Haus/Übergeben) ersetzen die Gruppen Im Lager/In Galvanik/Fertig – Abbildung angeben.
- U-240 (Größen/Tablet/Enter), U-242 (keine Floskeln; V04-Knopf „Angabe im Text berichtigen“ konkret machen: „{Feld} berichtigen · {Grund}“).

## 3. Jede V04-Aktion an einen bestehenden Weg (Code main `323b919`)
| V04 | App heute | Stand |
|---|---|---|
| Rotes Plus → Eingang | `KreileHeader.tsx:147` `requestGlobalCreate("DIRECT_INTAKE")` → `src/modules/eingang/GlobalCreateFlow.tsx` (erste Ansicht ersetzen; 3.x-Dialoge bleiben) | vorhanden |
| Erkennung (`analyze/entryAnalysis/netFacts`) | `recognizeIntakeNoteAction`, `retryIntakeRecognitionAction`, `chooseIntakeCaptureKindAction` (`eingang.actions.ts:55,77,107`), `captureRecognition.ts` – **Regex der Vorschau nicht übernehmen**; Fundstellen + Unsicherheit aus der echten Erkennung. Neu: Art `reklamation`; Auftrags-/KV-/Rechnungsnummer im Text als Bezug (V04 liest „K-26-1048“ als „1048 Stück“) | teilweise |
| KV / Auftrag aus Eingang | `createQuoteAction`, `convertQuoteToOrderAction` (`quotes.actions.ts:54,168`), `erfasseAuftragAusEingangAction` (`eingang.actions.ts:124`). Lücke: Art „KV“ in der Erfassung (`GlobalCreateFlow.tsx:2417/1836`), `intake_item.vorgang_art='kv'` wird nie geschrieben | teilweise |
| KV duplizieren („wie beim letzten Mal“) | kein Befehl | **fehlt** |
| Reklamation aus Eingang/Nachricht | Bauplan 4.8 `screens[reklamation]` + `prozesse.reklamation` (gebunden, Fälle L01–L13, Paket AP-EIN) – **im Code nicht gebaut** außer 4b `nacharbeitAnlegen` (`reworkOrderCommand.ts:273`, ohne UI-Aufrufer). Ziel `reklamation` ohne Empfänger (`IntakeMessages.tsx:68`) | **fehlt** (baut Codex jetzt, P106) |
| Ware | `saveGoodsReceiptAction` (`eingang.actions.ts:64`) | vorhanden |
| Eingangsrechnung | `saveIncomingInvoiceAction` u. a. (`eingang.actions.ts:31-33`), `invoiceContract.ts` | teilweise |
| Lieferschein, Quittung, Abgleich Rechnung↔Lieferschein↔Angebot, Kontobeleg (`netContext/netCompare/netPayment`) | `IncomingInvoice` ohne Positionen/Mengen/Bezüge/Skonto; keine Bankquelle | **fehlt** – Owner-Frage F1 |
| Aufgabe / Frist | `saveIntakeTaskAction`, `completeIntakeTaskAction` | vorhanden (Zurücknehmen fehlt) |
| Mailansicht / Anliegen (`renderMessages`) | `src/modules/eingang/ui/IntakeMessages.tsx` auf `src/app/nachrichten/page.tsx`, `getIntakeMessagesAction`, `messageContract.ts` (concerns/openConcerns) | teilweise |
| Mail kommt in den Eingang | Graph-Mails nur in `communication_threads` (`communicationPort.ts:177,248`); kein Schreiber für `intake_item.kanal='mail'`. Bauplan `screens[mailein]` + P100 | **fehlt** (baut Codex jetzt, P106) |
| Antwort senden (`messageReply`) | `sendCustomerMailAction` (`communications.actions.ts:46`) nur in `CommunicationPanel.tsx:104`; Ziel nur Kunde/Auftrag, kein KV/Reklamation; kein Thread-Bezug (`conversationId/In-Reply-To` ungenutzt) | teilweise |
| Werkstattkachel (`workCard/nextAction`) | `src/modules/werkstatt/ui/WerkstattView.tsx`, `deriveWerkstattView.ts`, Ports `werkstatt/server/types.ts:55-61`; Aktionen `transitionWareneingangToGalvanikAction`, `setOrderItemFinishedAction`, `changeOrderItemExtraWorkAction` | teilweise (Projektion zu schmal, Abschnitt 7) |
| AZ je Tag (`azCard`) | Tabelle `arbeitszeit_buchung` (`schema_erfassung.ts:35`) ohne Schreibbefehl, nicht im Bauplan | **fehlt** – Owner-Frage F1 |
| Karten öffnen | `EntityOverlayStack.tsx` `openOrder/openCustomer` – **diese verwenden, keine V04-Testkarten**. `openItem` (Teilkarte) wird nicht angezeigt (`EntityOverlayStack.tsx:15` gibt `null` zurück und verdeckt die Auftragskarte) → Teilchip springt in die Auftragskarte an die Position, bis eine Teilkarte gebunden ist | teilweise |
| „Sprechen“ (Spracheingabe) | kein Weg in der App; Browser-Spracherkennung schickt Audio je nach Browser an einen Fremdanbieter | **fehlt** – Owner-Frage F2 (Datenschutz/Anbieter); bis dahin Knopf im Bauplan mit `stufe: offen` |
| Fertig → Rechnung/Zahlung/Abholung/Versand (`nextAction`, `outgoing`) | Warenausgang `recordGoodsOut`, Rechnungen/Zahlungen vorhanden | vorhanden |
| Der Tag | `/` `HomeAppAdapter`; Fälle aus `tagkonfig` (reklamation_entscheiden/_gutschrift/_informieren/_laeuft, nacharbeit_ware_fehlt, kv_freigabe) | Anschluss, kein Umbau |

Vertrag je Aktion (aus der V04-Übergabe, gilt): Quelle → Fakten/Fundstellen → Kandidaten/Abweichungen → zulässige Aktion → Bestätigung → bestehender Fachbefehl → Receipt/Readback → aktualisierte Sichten/Folgeschritte. Nichts aus `D`, localStorage, synthetischen Belegen, Testkarten oder simuliertem Versand in Produktpfade.

## 4. Kreislauf – Soll und was dafür im Bauplan stehen muss
**Reklamation** (gebunden, `prozesse.reklamation`): aufgenommen → (Meister entscheidet) **Nacharbeit** (eigener Auftrag, Preis 0, Ware zurück → Wareneingang → Galvanik → fertig → Warenausgang → `abgeschlossen/nacharbeit_raus`) | **Gutschrift** → Kunde informieren → abgeschlossen | **abgelehnt** (Begründung Pflicht) → Kunde informieren (Vorlage „Reklamation Ergebnis“) → abgeschlossen (mail/ohne_mail) | zurückgezogen; abgeschlossen → wieder öffnen (Grund). Lehnt der Meister ab und will der Kunde trotzdem eine Bearbeitung: normaler KV/Auftrag mit Bezug zur Reklamation (berechnet) – bitte als Weg in 4.8 aufnehmen.
V04 legt heute bei „Reklamation am Auftrag aufnehmen“ **sofort** einen Nacharbeitsauftrag an (`createRework`) – das wird zu **4.8 aufnehmen** (Teile, Mangel, Fotos, Ware kommt zurück?) mit anschließender Entscheidung. Der V04-Knopf bleibt optisch gleich.
**KV** (`prozesse.kv`): versendet → angenommen | abgesagt | abgelaufen. Für V04 zusätzlich festlegen (AP-KV): Fassung (gesendete/zugestimmte Fassung je KV; die Zusage gilt nur für die zugestimmte Fassung – `version` ist heute nur der Sperrzähler), Status „versendet“ mit Kanal, Absage (`absage_am/grund`), Nachfass-Aufgabe bei fehlender Antwort (Frist in den Einstellungen konfigurierbar), Zusage aus der Antwort-Mail (`kv.annehmen` aus der Nachricht, Anliegen in derselben Transaktion raus), genau ein Auftrag, danach Wareneingang. KV aus dem Eingang schreibt `vorgang_art='kv'`.
**Nachricht ↔ Vorgang:** Antwort-Mails hängen am Thread (`conversationId`/`In-Reply-To`) und am Vorgang (KV/Reklamation/Auftrag). „Erledigt“/„Nur Info“ an der Nachricht darf ein Anliegen nur leeren, wenn der Fachvorgang angelegt oder bewusst verneint ist (heute `intakeLifecycle.ts:59-72` ohne Prüfung). Eine Antwort schließt nie eine Reklamation, einen KV-Schritt oder eine Terminfrage, deren Termin noch nicht bestätigt ist.

## 5. Logik-Korrekturen an V04 (Optik bleibt, nur Verhalten)
1. `message-document` legt bei jedem Klick einen neuen Beleg an → vorhandenen `documentId` öffnen.
2. `netSync`/`netMsgStatus`: Nachricht mit fertigem Beleg/angelegtem Auftrag bleibt `waiting` → Status nur aus dem Fachvorgang ableiten (eine Wahrheit).
3. `message-accept` setzt `waiting` vor der Umwandlung; Abbruch hinterlässt falschen Stand → erst nach Receipt setzen. Weg „KV abgelehnt“ ergänzen.
4. Nachrichten ohne Ende → „Nur Info“, „Kein Geschäftsvorgang“, „Wieder öffnen“ (siehe Abschnitt 2).
5. `showOrderPicker` blendet übergebene Aufträge aus – Reklamationen betreffen genau diese → einblenden; „Kein passender Auftrag · Vorgang ohne Auftrag aufnehmen“ ergänzen (Picker `vorgang-waehlen` aus dem Bauplan, bisher nicht in AP-EIN).
6. Auftrags-/KV-Nummer im Text als Bezug → Picker nur, wenn kein eindeutiger Treffer.
7. `message-quote` ohne Kunde → zuerst Kunde zuordnen (wie Eingang `entryMode='choose'`).
8. `deadline` meldet „Frist ist verbunden“ ohne Wirkung → Aufgabe/Frist wirklich anlegen oder Knopf erst bei vorhandener Frist zeigen.
9. Unterbrochene Eingänge nur fortsetzbar → „Verwerfen“ über `discardIntakeDraftAction`.
10. `task-done` ohne Zurücknehmen; Aufgabenänderungen nur lokal → über Aufgaben-Befehle.
11. Terminantwort (`message-send`, `kind==='date'`) schließt sofort → offen bis Termin bestätigt.
12. Werkstatt „Kundenfrage beantworten“ springt nach Nachrichten ohne Rückweg und nur für Termine → Nachricht im Overlay über dem Auftrag, alle offenen Anliegen des Auftrags (Reklamation, Sonstiges), Zurück führt zur Werkstatt.
13. Reklamation: siehe Abschnitt 4 (aufnehmen → entscheiden statt Sofort-Nacharbeit).

## 6. Datenbedarfe (neu im Bauplan, jeweils mit Stufe)
Stufe 1 (Pilot 30.11.), weil der Kreislauf sonst nicht trägt: Mail→Eingang (`kanal='mail'`, P100), Reklamation 4.8 komplett, Lese-Port Reklamation mit `stand/nummer/bewertung/nacharbeit_auftrag_id` (heute `complaintRead.ts:16` nur alte Spalten; Dossier zeigt fest 0), KV-Zustände + Fassungsbindung + Absage + Nachfass, Thread-Bezug Nachricht↔Vorgang, Werkstatt-Projektion (Abschnitt 7).
**Owner-Frage F1 (Planungschat klärt, nicht vorziehen):** Belegabgleich Rechnung↔Lieferschein↔Angebot mit Positionen/Mengen, Lieferschein/Quittung als Belegart, Kontobeleg als Zahlungsnachweis, Skonto-Frist, AZ-Tageserfassung, KV kopieren. Bis zur Antwort: im Bauplan als eigener Abschnitt mit `stufe: offen` vollständig spezifizieren (Felder, Befehle, Fälle), damit nach der Entscheidung ohne neue Runde gebaut werden kann. Bank: keine Quelle vorhanden → nur Kontobeleg-Upload, keine Bankanbindung (neuer Anbieter = Owner).

## 7. Werkstatt-Projektion (nur Lesen, aus vorhandenen Tabellen)
`WerkstattSurfaceOrder` (`werkstatt/server/types.ts:2-18`) erweitern um: `customerId` (für `openCustomer`), Teile/Positionen mit Fortschritt, Bild, Lagerort, Planaufwand, Mehrarbeit Ist/Spielraum, Freigabestatus, Zahlstatus, offene Anliegen je Auftrag, Kennung Nacharbeit (`source='REKLAMATION_NACHARBEIT'`, heute nur am Titel erkennbar). Keine neue Tabelle.

## 8. Abnahmefälle Kreislauf (Ende-zu-Ende, echte Replay-DB, je mit `dann.db` und Sicht)
- K1 Reklamation per Mail → Eingang (Mail) → 4.8 aufnehmen → Nacharbeit → Ware zurück → Galvanik → fertig → Warenausgang → Reklamation `abgeschlossen/nacharbeit_raus`; sichtbar in Auftrag, Kunde, Werkstatt, Der Tag.
- K2 Reklamation abgelehnt (Begründung) → Kunde informieren (Mail) → abgeschlossen; keine Nacharbeit, kein Preis.
- K3 Reklamation Kulanz-Gutschrift → Kunde informieren → abgeschlossen.
- K4 Reklamation abgelehnt, Kunde will Bearbeitung → KV/Auftrag mit Bezug, berechnet.
- K5 KV-Anfrage per Mail → KV (Fassung 1) → versendet → Antwort-Mail „Zusage“ → genau ein Auftrag → Wareneingang → Galvanik.
- K6 KV geändert nach Versand → Fassung 2 → alte Zusage gilt nicht → erneuter Versand → Zusage zu Fassung 2.
- K7 KV Absage per Mail → abgesagt; keine Auftragsanlage.
- K8 KV ohne Antwort → Nachfass-Aufgabe nach Frist; gültig-bis überschritten → abgelaufen, nicht auf Der Tag.
- K9 Antwort auf Reklamation/Terminfrage schließt den Vorgang nicht; „Erledigt“ an der Nachricht ohne Fachvorgang ist gesperrt mit konkreter Handlung.
- K10 Doppelklick/Wiederholung erzeugt keinen zweiten Auftrag, Beleg, Versand oder Nacharbeitsauftrag.

## 9. Paketschnitt und Takt
Feature-Stopp 29.11., Pilot 30.11. **Lieferung bitte bis Mo 09.11. 12:00** (danach je Tag Verzug +1 Tag Eingang-Ziel).
- AP-EIN-2b `rein` = V04-Eingang + U-243 (ersetzt die bisherige Planung Teil 2b, eine Lieferung).
- AP-NACHR-V04: Reiter „Anliegen“ + Antwort am Vorgang + Thread-Bezug.
- AP-WERK-V04: Werkstatt-Übersicht + Projektion (Abschnitt 7).
- AP-KV: KV-Prozess (Abschnitt 4) inkl. KV aus Eingang/Nachricht.
- Reklamation 4.8 und Mail→Eingang baut Codex **jetzt** aus dem gebundenen Bauplan (P106); V44 schließt nur die V04-Knöpfe daran an und ergänzt Abschnitt 4 (Weg K4).
Rückfragen nur bei echter Owner-Entscheidung an den Planungschat in `_review/MELDUNG_ENDVERSION_CHAT.md`; Technisches entscheidest du selbst.

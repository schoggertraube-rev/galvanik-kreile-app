# Abgleich Endversion-Spec ↔ Code (Stufe 1)

Stand: 2026-10-27 · Spec `docs/project/endversion/spec.json` · Code `kreile/s1-p2-eingang @ 5aece709` (read-only) · Dev-DB nur SELECT.

**Umfang:** alle 44 Screens mit Stufe 1 (Funktionsstufe über `funktionen[].stufe`). Ausgenommen: `datevein`, `datev` (R06 = Stufe 2) sowie alle `ausgrau`/`ausbau`-Blöcke anderer Stufen (Z01, X0x, B0x, W0x).
**Elemente:** Spec-Felder (inkl. aufgelöster `formulare.kunde`/`position`), Screen-Aktionen und die fachlich wirksamen Aktionen aus `inhalt` (Karten-, Ketten-, Schnellaktionen). Die Aktionen haben in der Spec fast nie eine `id` – Element = Text. Reine Navigation (Schließen/Abbrechen/Zurück/Erneut laden) je Screen als eine Zeile `nav`.
**Pfade** relativ zu `src/` (Migrationen: `../supabase/…`).

**Klassen:** OPTIK = Fähigkeit existiert (Action/Read/Route genannt), nur Darstellung · INHALT_NEU = neuer Read/Query/abgeleitete Daten, keine neue Schreiblogik · FUNKTION_NEU = neue Schreiblogik/Command/Feld mit Schreibweg/Tabelle/Integration (ein neues *gespeichertes* Feld zählt hier, weil der Command-Vertrag mit `exactKeys` erweitert werden muss) · ZIEL_FEHLT = `ziel` ohne Screen/Zustand.

**ZIEL_FEHLT: 0.** Alle Ziele lösen auf. Die Treffer des automatischen Checks sind keine Lücken: `start` ist `navigation.kopf.marke` (Startseite je Rolle), `zurueck` und `extern:tel|pdf|datei` sind Systemziele; `extern:datei` liegt nur in `datev` (Stufe 2).

## 1 Zusammenfassung

| Flow | OPTIK | INHALT_NEU | FUNKTION_NEU | ZIEL_FEHLT | Summe |
|---|---|---|---|---|---|
| F1 Neuer Eingang | 50 | 4 | 10 | 0 | 64 |
| F2 Der Tag | 12 | 1 | 5 | 0 | 18 |
| F3 Auftragskarte | 46 | 5 | 5 | 0 | 56 |
| F4 Werkstatt | 33 | 5 | 6 | 0 | 44 |
| F5 Kunde | 22 | 6 | 8 | 0 | 36 |
| F6 Geld | 19 | 1 | 2 | 0 | 22 |
| F7 Einstellungen | 32 | 0 | 7 | 0 | 39 |
| F8 Wartung | 10 | 3 | 1 | 0 | 14 |
| Login/Suche/Menüs (Querschnitt) | 23 | 0 | 2 | 0 | 25 |
| **Gesamt** | **247** | **25** | **46** | **0** | **318** |

Hinweis zu den Zahlen: OPTIK enthält 42 Zeilen `nav` (reine Navigation). Ohne sie: 205 OPTIK · 25 INHALT_NEU · 46 FUNKTION_NEU (= 32 Fähigkeiten, s. Abschnitt 3) · 0 ZIEL_FEHLT.

Zuordnung Screen→Flow: F1: eingang, kundeneu, mailein, kamera, beleg; F2: tag, spaeter, hbmehr; F3: auftraege, auftrag, teil, termin, foto, rauspruefen; F4: werkstatt, picker, mehrarbeit, fertig, raus; F5: kunden, kunde, kundebearbeiten, mail; F6: geld, rechnung, zahlung; F7: einstellungen, firmendaten, katalog, leistung, stundensatz, rechte, zielfrei, datenkiste; F8: backend, protokoll, anbindung, stufen; Login/Suche/Menüs: login, suche, plus, konto, mehr, stufenseite

## 2 Tabellen je Screen

### login – 0 Anmelden (Login/Suche/Menüs (Querschnitt))

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F pin | OPTIK | `actions/auth.actions.ts:123` | Server /^\d{4}$/ = Spec 4 Ziffern |
| A anmelden (auto) | OPTIK | `actions/auth.actions.ts:115` | Auto-Submit schon in StartScreenClient.tsx:31 |
| Personenkreise aktive Nutzer | OPTIK | `lib/server/startUserRead.ts:11` |  |
| Vorauswahl letzte Person | OPTIK | – | nur Client (localStorage) |
| Fehler/Sperre | OPTIK | `actions/auth.actions.ts:150` | runPinAttempt, Sperrlogik vorhanden |
| A email (developer) | OPTIK | `actions/auth.ts:29` | E-Mail+Passwort |
| Ziel start je Rolle | OPTIK | `app/page.tsx:23` | Routing heute dev→/settings, werkstatt→Werkstatt; s. K17 |

### tag – 2 Der Tag (F2 Der Tag)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Handlungsbedarf / In Arbeit / Heute&Woche | OPTIK | `lib/server/operationalOrders.ts:16` | + buildOrdersHomeProjection.ts:67 |
| Neu seit gestern | OPTIK | `modules/orders/domain/buildOrdersHomeProjection.ts:67` | createdAt vorhanden |
| Termin-Ampel A02 | OPTIK | `modules/orders/domain/getUrgency.ts:3` |  |
| Frühwarnung A09 | INHALT_NEU | `actions/orders.actions.ts:389` | getRiskOrders = NOT_AVAILABLE; Prognose fehlt |
| Bündel-Vorschlag | OPTIK | `modules/werkstatt/server/deriveWerkstattView.ts:90` | heute nur in Werkstatt-View |
| Offene Rechnungen | OPTIK | `actions/invoices.actions.ts:106` | getInvoiceSummariesAction |
| Abwesenheiten | FUNKTION_NEU | – | keine Datenquelle/Pflege |
| A Anpassen (Felder je Person) | FUNKTION_NEU | – | Layout je Nutzer speichern |
| Woche aus Outlook R01 | FUNKTION_NEU | – | keine Graph-Kalender-Anbindung |
| A Neuer Eingang (schnell) | OPTIK | `app/GlobalCreateAppAdapter.tsx` | requestGlobalCreate |
| A Ware raus (schnell) | OPTIK | `actions/goodsOut.actions.ts:9` |  |
| A Rückgängig / Erledigt | FUNKTION_NEU | – | hängt an Später/Wiedervorlage |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### spaeter – M4 Später erinnern (F2 Der Tag)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| A heute Nachmittag / morgen früh / nach dem Termin | FUNKTION_NEU | – | Wiedervorlage je Eintrag fehlt |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### hbmehr – M5 Weitere Aktionen (F2 Der Tag)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| A an Phillip delegieren | OPTIK | `actions/orders.actions.ts:96` | assignOrderTaskAction, UI ungenutzt; dev fehlt (K3) |
| A Auftrag öffnen | OPTIK | `actions/orders.actions.ts:184` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### eingang – 3 Neuer Eingang (F1 Neuer Eingang)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Erfassen Text/Diktat/Foto (E07) | FUNKTION_NEU | `actions/ai-enrichment.actions.ts:5` | NOT_AVAILABLE; api/erfassung/freetext-extract quarantäniert |
| A Zettel, Etikett, Karte → kamera | OPTIK | `actions/domainAttachments.actions.ts:20` | Upload+Analyse vorhanden; Ziel nötig (K16) |
| A Datei lesen → beleg | OPTIK | `actions/domainAttachments.actions.ts:62` |  |
| A Aus Mail → mailein | OPTIK | `actions/communications.actions.ts:30` |  |
| F* kunde (suche) | OPTIK | `warendurchlauf/actions.ts:179` | searchOrderIntakeCustomersAction |
| A Neukunde anlegen | OPTIK | `actions/customers.actions.ts:36` | 2 Schritte (GlobalCreateFlow.tsx:1202), nicht atomar |
| Kunde+Auftrag atomar (Regel) | FUNKTION_NEU | `lib/server/commands/orderIntakeCommand.ts:194` | nur EXISTING; K1 |
| fehlende Kundendaten inline | OPTIK | `actions/customers.actions.ts:90` | updateCustomerCommercialAction |
| F* position x1–20 | OPTIK | `lib/server/commands/orderIntakeCommand.ts:164` | 1..20 = Spec |
| A Position hinzufügen | OPTIK | – | Client |
| Preisvorschlag A11 | INHALT_NEU | – | Query ähnliche Aufträge/Median |
| Terminvorschlag A10 | INHALT_NEU | `modules/katalog/public.ts:1` | Durchlauf vorhanden; Auslastung/Erfahrung fehlt |
| F art (Auftrag/KV) | OPTIK | `actions/quotes.actions.ts:46` | KV = createQuoteAction |
| F liefertermin | OPTIK | `warendurchlauf/actions.ts:171` | dueDate Pflicht = Spec |
| F terminstatus Wunsch/bestätigt | FUNKTION_NEU | `components/layout/GlobalCreateFlow.tsx:1133` | nur 1 dueDate gespeichert |
| F uebergabe | OPTIK | `lib/server/commands/orderIntakeCommand.ts:172` | pickup/shipping |
| F zahlungsmodus | OPTIK | `lib/server/paymentContract.ts:5` | heute aus Kunde abgeleitet; K5–K7 |
| F eingangsart | FUNKTION_NEU | – | kein Feld |
| F telefonnotiz | OPTIK | `lib/server/commands/orderIntakeCommand.ts:174` | note ≤2000 |
| F gueltig_bis (KV) | FUNKTION_NEU | – | Quote ohne Gültigkeit |
| F eingangsfoto | OPTIK | `warendurchlauf/actions.ts:357` | reserve/finalize Intake-Anhang |
| F dokument | OPTIK | `warendurchlauf/actions.ts:357` |  |
| F geprueft | OPTIK | `components/layout/GlobalCreateFlow.tsx:1196` | Client-Sperre, nicht persistiert |
| A buchen | OPTIK | `warendurchlauf/actions.ts:171` | createOrderIntakeAction |
| A Nur als Interessent speichern | OPTIK | `actions/customers.actions.ts:36` | Name+Telefon reichen = Server |
| A Entwurf behalten | OPTIK | – | nur Client |
| A Auftragskarte öffnen | OPTIK | `actions/orders.actions.ts:184` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### kundeneu – 3.1 Kunde anlegen (F1 Neuer Eingang)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| A Visitenkarte scannen | FUNKTION_NEU | `lib/server/documentIntelligencePort.ts:11` | Analyse braucht Ziel; Modell Visitenkarte |
| A Aus Mail-Signatur | FUNKTION_NEU | – | Signatur-Parsing fehlt |
| F kundentyp | OPTIK | `modules/customers/server/createCustomerCommand.ts:75` | business/privat/institution |
| F name | OPTIK | `modules/customers/server/createCustomerCommand.ts:76` | 2..160 |
| F telefon | OPTIK | `modules/customers/server/createCustomerCommand.ts:87` | Pflicht = Spec |
| F ansprechpartner/email/strasse/plz/ort/land | OPTIK | `modules/customers/server/createCustomerCommand.ts:78` |  |
| F zahlungsbedingung | OPTIK | `modules/customers/server/createCustomerCommand.ts:89` | vorkasse\|bar\|rechnung_N; K5 |
| F ustid | OPTIK | `modules/customers/server/createCustomerCommand.ts:86` |  |
| F notiz | FUNKTION_NEU | `modules/customers/server/createCustomerCommand.ts:71` | kein notes-Key; K9 |
| Ort/Land aus PLZ | INHALT_NEU | – | PLZ-Verzeichnis |
| Dublettenprüfung beim Tippen | OPTIK | `warendurchlauf/actions.ts:179` | Suche vorhanden |
| Kundennummer automatisch | OPTIK | `modules/customers/server/createCustomerCommand.ts:148` | K-JJJJ-NNNN |
| A Kunde speichern | OPTIK | `actions/customers.actions.ts:36` |  |
| A Vorhandenen öffnen / Kundenkarte | OPTIK | `actions/customers.actions.ts:20` |  |
| A Neuer Auftrag | OPTIK | `app/GlobalCreateAppAdapter.tsx` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### mailein – 3.4 Mail zuordnen (F1 Neuer Eingang)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Mail-Anzeige | OPTIK | `actions/communications.actions.ts:30` | Graph-Inbox |
| A Kunde zuordnen | OPTIK | `actions/communications.actions.ts:37` | CUSTOMER |
| A Auftrag zuordnen | OPTIK | `actions/communications.actions.ts:37` | ORDER |
| A Neuer Eingang aus Mail | OPTIK | `components/layout/GlobalCreateFlow.tsx:44` | Prefill name/email/note |
| A Neukunde aus Absender | OPTIK | `components/layout/GlobalCreateFlow.tsx:44` |  |
| Anhänge am Kunden ablegen | INHALT_NEU | `lib/server/communicationPort.ts:68` | Anhang-Übernahme prüfen |
| A Später | OPTIK | – |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### kamera – 3.2 Beleg/Foto aufnehmen (F1 Neuer Eingang)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| A Auslösen | OPTIK | `actions/domainAttachments.actions.ts:20` | Kamera = Client |
| A Datei wählen | OPTIK | `actions/domainAttachments.actions.ts:20` |  |
| Original sichern | OPTIK | `actions/domainAttachments.actions.ts:25` |  |
| A Weitere Seite | FUNKTION_NEU | – | mehrseitiger Beleg |
| Aufruf ohne Ziel (Kopf/Plus) | FUNKTION_NEU | `lib/server/documentIntelligencePort.ts:11` | Ziel Pflicht; K16 |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### beleg – 3.3 Beleg prüfen (F1 Neuer Eingang)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Vorschlag mit Sicherheit | OPTIK | `actions/domainAttachments.actions.ts:62` | suggestions+confidence |
| In Klärung ohne Azure | OPTIK | `actions/domainAttachments.actions.ts:53` |  |
| F geprueft | OPTIK | – | Client |
| A In Neuer Eingang übernehmen | OPTIK | `components/layout/GlobalCreateFlow.tsx:44` | Prefill um Positionen erweitern |
| A Manuell erfassen | OPTIK | – |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### auftraege – 4 Aufträge (F3 Auftragskarte)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Liste/Filter/Suche | OPTIK | `actions/orders.actions.ts:326` | getOrdersDb |
| Kundenklammer | OPTIK | `actions/orders.actions.ts:326` | Client-Gruppierung |
| Filter KV | INHALT_NEU | `actions/quotes.actions.ts:76` | zweite Quelle zusammenführen |
| Woche A03 | OPTIK | `actions/orders.actions.ts:326` |  |
| A Neuer Eingang | OPTIK | `app/GlobalCreateAppAdapter.tsx` |  |
| A Kundenkarte / Öffnen | OPTIK | `actions/customers.actions.ts:20` |  |
| A Foto / Mehrarbeit | OPTIK | `actions/domainAttachments.actions.ts:20` | + orders.actions.ts:73 |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### auftrag – 4.1 Auftragskarte (F3 Auftragskarte)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Kopf/Teile/Kunde | OPTIK | `actions/orders.actions.ts:184` | getLiveOrderCardAction |
| Terminstatus bestätigt | INHALT_NEU | – | nicht gespeichert (s. eingang) |
| A Termin ändern → termin | OPTIK | `actions/orders.actions.ts:114` |  |
| Kette angenommen→Galvanik | OPTIK | `actions/orders.actions.ts:60` | + Korrektur :67 |
| Kette fertig | OPTIK | `actions/orders.actions.ts:82` | freezeOrderAction |
| Kette Zahlung | OPTIK | `actions/payments.actions.ts:68` |  |
| Kette verschickt | OPTIK | `actions/goodsOut.actions.ts:9` |  |
| Nächster Schritt | INHALT_NEU | – | Ableitungsregel fehlt |
| Teil: Foto | OPTIK | `app/orders/OrderCardAppAdapter.tsx:33` |  |
| Teil: fertig | OPTIK | `actions/orders.actions.ts:130` | setOrderItemFinishedAction |
| Teil bearbeiten/hinzufügen | OPTIK | `actions/orders.actions.ts:123` |  |
| Mehrarbeit Block + Erfassen | OPTIK | `actions/orders.actions.ts:73` |  |
| Akte Verlauf | OPTIK | `actions/timeline.actions.ts:206` |  |
| Akte Fotos & Dokumente | OPTIK | `actions/domainAttachments.actions.ts:30` |  |
| Akte Mails & Notizen | INHALT_NEU | `lib/server/searchAuxiliaryRead.ts:21` | Mails je Auftrag lesen |
| Akte Rechnungen & Zahlungen | OPTIK | `actions/invoices.actions.ts:80` |  |
| Notiz speichern | FUNKTION_NEU | `actions/phoneNotes.actions.ts:29` | NOT_AVAILABLE |
| A Status-Mail / Kunden-Update | OPTIK | `actions/communications.actions.ts:43` |  |
| A Anrufen | OPTIK | `lib/server/orderCardRead.ts:593` |  |
| A Foto+ / Dokument+ | OPTIK | `actions/domainAttachments.actions.ts:20` |  |
| A KV | OPTIK | `actions/quotes.actions.ts:46` |  |
| A Freigeben → Auftrag (KV) | OPTIK | `actions/quotes.actions.ts:160` |  |
| A Duplizieren | OPTIK | `warendurchlauf/actions.ts:171` | Prefill Positionen ergänzen |
| Verknüpft (KV, Ursprungsmail, ähnlicher Auftrag) | INHALT_NEU | – | Links/Ähnlichkeit fehlen |
| Geld-Block | OPTIK | `actions/payments.actions.ts:68` |  |
| A Rechnung erstellen | OPTIK | `actions/invoices.actions.ts:44` |  |
| Dock Fertig | OPTIK | `actions/orders.actions.ts:82` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### teil – 4.2 Teil bearbeiten (F3 Auftragskarte)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F* position | OPTIK | `actions/orders.actions.ts:123` | changeOrderContentAction; Rolle K2 |
| Storno statt Löschen | FUNKTION_NEU | – | Storno-Status fehlt |
| Sperre nach Abschluss | OPTIK | `lib/server/commands/orderContentCommand.ts:141` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### termin – 4.5 Termin ändern (F3 Auftragskarte)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F termin | OPTIK | `actions/orders.actions.ts:114` |  |
| F grund | OPTIK | `lib/server/commands/orderPromiseCommand.ts:57` | 3..500 |
| F status Wunsch/bestätigt/verschoben | FUNKTION_NEU | – | kein Feld |
| F informieren | OPTIK | `actions/communications.actions.ts:43` | Vorlage fehlt |
| A Termin speichern | OPTIK | `actions/orders.actions.ts:114` | werkstatt/dev verboten; K2/K3 |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### foto – 4.6 Foto zum Auftrag (F3 Auftragskarte)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| A Auslösen (speichert) | OPTIK | `actions/domainAttachments.actions.ts:20` | ORDER |
| A Datei wählen | OPTIK | `actions/domainAttachments.actions.ts:20` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### rauspruefen – 10.1 Warenausgang (F3 Auftragskarte)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| A Übergabe bestätigen | OPTIK | `actions/goodsOut.actions.ts:9` | versand/abholung |
| Vorkasse-Sperre | OPTIK | `../supabase/migrations/20261027113000_q5_intake_payment_handover.sql:353` |  |
| F bezahlt (bar/Karte bei Übergabe) | FUNKTION_NEU | `lib/server/commands/recordGoodsOutCommand.ts:441` | Zahlung+Ausgang in einem Schritt; K13 |
| A Lieferschein drucken | FUNKTION_NEU | `actions/pdf.actions.ts:8` | NOT_AVAILABLE |
| A Zahlung bestätigen | OPTIK | `actions/payments.actions.ts:46` |  |
| A Auftrag ansehen | OPTIK | `actions/orders.actions.ts:184` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### werkstatt – 11 Werkstatt (F4 Werkstatt)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Wareneingang/Dringend/In Arbeit | OPTIK | `modules/werkstatt/server/deriveWerkstattView.ts:110` | + warendurchlauf/actions.ts:98/102 |
| Abschnitt Fertig | INHALT_NEU | `modules/werkstatt/server/deriveWerkstattView.ts:112` | liest nur wareneingang+galvanik |
| Priorität spätester Start | INHALT_NEU | `modules/werkstatt/server/deriveWerkstattView.ts:134` | heute Gruppe+Termin |
| Karte Eingangsfoto | INHALT_NEU | `warendurchlauf/actions.ts:334` | Batch-Read je Liste |
| Bündel | OPTIK | `modules/werkstatt/server/deriveWerkstattView.ts:90` |  |
| A Öffnen | OPTIK | `actions/orders.actions.ts:184` |  |
| A Start (→In Arbeit) | OPTIK | `actions/orders.actions.ts:60` |  |
| A Fertig melden | OPTIK | `actions/orders.actions.ts:82` |  |
| A Ware raus | OPTIK | `actions/goodsOut.actions.ts:9` |  |
| A Foto | OPTIK | `actions/domainAttachments.actions.ts:20` |  |
| A Mehrarbeit | OPTIK | `actions/orders.actions.ts:73` |  |
| A Auftrag öffnen/scannen | OPTIK | – | → picker |
| Freigabe fehlt statt Vorkasse | OPTIK | `actions/payments.actions.ts:68` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### picker – 4.7 Auftrag wählen (F4 Werkstatt)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Suche Nummer/Teil/Oberfläche | OPTIK | `actions/search.actions.ts:34` |  |
| A Scannen | FUNKTION_NEU | – | Code-Scan; Begleitschein W05 erst Stufe 3 |
| Ziele öffnen/mehrarbeit/fertig | OPTIK | `actions/orders.actions.ts:184` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### mehrarbeit – 4.3 Mehrarbeit (F4 Werkstatt)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Teil wählen | OPTIK | `actions/orders.actions.ts:73` | itemId |
| Ganzer Auftrag | FUNKTION_NEU | `lib/server/commands/orderExtraWorkCommand.ts:110` | itemId Pflicht; K12 |
| Arbeitsgang-Kacheln + Minuten | OPTIK | `actions/orders.actions.ts:204` | Katalogpositionen via :137 |
| Regler 5-Min | OPTIK | `lib/server/commands/orderExtraWorkCommand.ts:133` | 1..1440 |
| KV-Spielraum grün/orange/rot | FUNKTION_NEU | – | Minutenbudget im KV fehlt |
| Verteilung Verlauf/Rechnungsposition | OPTIK | `actions/orders.actions.ts:82` | über Freeze |
| Verteilung Terminprognose/Erfahrung | INHALT_NEU | – |  |
| Kunde informieren | OPTIK | `actions/communications.actions.ts:43` |  |
| A Speichern | OPTIK | `actions/orders.actions.ts:73` |  |
| A Stundensatz pflegen | OPTIK | `actions/orders.actions.ts:146` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### fertig – 4.4 Fertig melden (F4 Werkstatt)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| je Teil fertig | OPTIK | `actions/orders.actions.ts:130` |  |
| Stückzahl gut/Ausschuss + Grund | FUNKTION_NEU | – |  |
| Fertigfoto | OPTIK | `actions/domainAttachments.actions.ts:20` |  |
| Was fehlt (Foto je Teil) | INHALT_NEU | – | Foto-Teil-Zuordnung lesen |
| Problem melden | FUNKTION_NEU | – | Meldung an Rolf |
| Notiz per Diktat | FUNKTION_NEU | – | E06 + Notiz |
| A Mehrarbeit | OPTIK | `actions/orders.actions.ts:73` |  |
| A Fertig melden (Freeze) | OPTIK | `actions/orders.actions.ts:82` |  |
| Kunde informieren vorausgewählt | OPTIK | `actions/communications.actions.ts:43` |  |
| A Ware raus | OPTIK | `actions/goodsOut.actions.ts:9` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### raus – 10 Ware raus (F4 Werkstatt)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Liste fertig + Übergabe/Zahlung | OPTIK | `actions/orders.actions.ts:326` | + payments.actions.ts:68 (N+1) |
| Filter Abholung/Versand | OPTIK | – | Client |
| Chip Vorkasse offen/Freigabe fehlt | OPTIK | `lib/server/paymentContract.ts:30` | goodsOutAllowed |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### kunden – 5 Kunden & Kontakt (F5 Kunde)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Liste | OPTIK | `actions/customers.actions.ts:140` | getCustomersDb |
| Filter Unvollständig | OPTIK | `actions/customers.actions.ts:140` | Client aus Pflichtfeldern |
| Oranges ! (Mails, Termin, Zahlungsmoral) | INHALT_NEU | – | Aggregat-Read je Kunde |
| A Kunde anlegen | OPTIK | `actions/customers.actions.ts:36` |  |
| A Neuer Auftrag | OPTIK | `app/GlobalCreateAppAdapter.tsx` | Prefill customerId |
| A Mail | OPTIK | `actions/communications.actions.ts:43` |  |
| A Datenkiste öffnen | FUNKTION_NEU | – | s. datenkiste |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### kunde – 5.1 Kundenkarte (F5 Kunde)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Kopf/Chips | OPTIK | `actions/customers.actions.ts:20` | getCustomerSummaryAction |
| Hinweise (!) | INHALT_NEU | – | wie Liste |
| Unvollständig + Ergänzen | OPTIK | `actions/customers.actions.ts:90` |  |
| Nächster Schritt | INHALT_NEU | – |  |
| Aktive Aufträge | OPTIK | `actions/customers.actions.ts:20` |  |
| Absprachen & Eigenheiten | INHALT_NEU | `modules/customers/server/types.ts:4` | nur notes/tags; Struktur fehlt |
| Akte (Verlauf, Dateien) | OPTIK | `actions/timeline.actions.ts:121` | + actions/domainAttachments.actions.ts:30 |
| Akte Mails/Rechnungen zusammengeführt | INHALT_NEU | – |  |
| Notiz speichern | FUNKTION_NEU | `actions/phoneNotes.actions.ts:29` | NOT_AVAILABLE |
| Kennzahlen (Termintreue Abholung) | INHALT_NEU | – |  |
| Rechnungen-Block | OPTIK | `actions/invoices.actions.ts:106` | nach Kunde filtern |
| A Neuer Auftrag / Bearbeiten / Mail / Foto | OPTIK | `actions/communications.actions.ts:43` |  |
| A Anrufen | OPTIK | – | tel: |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### kundebearbeiten – 5.2 Kunde bearbeiten (F5 Kunde)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F* kunde (fehlende zuerst) | OPTIK | `actions/customers.actions.ts:90` |  |
| Kundennummer für Altkunde | OPTIK | `../supabase/migrations/20261027140000_q8_assign_legacy_customer_number.sql:1` |  |
| F kundentyp ändern | FUNKTION_NEU | `modules/customers/server/updateCustomerCommercialCommand.ts:12` | kein Key |
| F notiz | FUNKTION_NEU | – | K9 |
| A Trotzdem speichern (unvollständig) | FUNKTION_NEU | `modules/customers/server/updateCustomerCommercialCommand.ts:21` | K8 |
| A Speichern | OPTIK | `actions/customers.actions.ts:90` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### mail – 5.3 Mail senden (F5 Kunde)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F an | FUNKTION_NEU | `lib/server/communicationPort.ts:58` | Empfänger fix = Kunden-E-Mail; K15 |
| F vorlage | FUNKTION_NEU | – | Vorlagen fehlen |
| F betreff / text | OPTIK | `actions/communications.actions.ts:43` |  |
| F anhang KV | OPTIK | `actions/communications.actions.ts:47` |  |
| F anhang Rechnung | FUNKTION_NEU | `actions/communications.actions.ts:47` | nur QUOTE |
| A Senden | OPTIK | `actions/communications.actions.ts:43` | Graph |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### geld – 7 Buchhaltung (F6 Geld)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Summe / Geld fehlt / Offen | OPTIK | `actions/invoices.actions.ts:106` |  |
| Abrechnen (fertig ohne Rechnung) | INHALT_NEU | – | Query fehlt |
| A Zahlung bestätigen | OPTIK | `actions/payments.actions.ts:46` |  |
| A Rechnung erstellen | OPTIK | `actions/invoices.actions.ts:44` |  |
| A Erinnern | OPTIK | `actions/communications.actions.ts:43` | Vorlage s. mail; mahnung.actions.ts:3 = Stub |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### rechnung – 7.1 Rechnung erstellen (F6 Geld)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F positionen | OPTIK | `actions/invoices.actions.ts:44` | aus Freeze |
| F fehlpreis | OPTIK | `actions/invoices.actions.ts:54` |  |
| F leistungsdatum | OPTIK | `lib/server/commands/immutableInvoiceCommand.ts:533` | serverseitig abgeleitet, nicht änderbar |
| F zahlungsbedingung | OPTIK | `lib/server/commands/immutableInvoiceCommand.ts:531` | abgeleitet |
| A Festschreiben | OPTIK | `actions/invoices.actions.ts:44` | R-JJJJ-NNNN |
| A PDF öffnen | OPTIK | `app/api/invoices/[invoiceId]/pdf/route.ts:14` |  |
| A Per Mail senden | FUNKTION_NEU | `actions/communications.actions.ts:47` | Rechnungsanhang fehlt |
| Storno per Gutschrift | OPTIK | `actions/invoices.actions.ts:66` |  |
| A Firmendaten ergänzen | OPTIK | `actions/settings.actions.ts:49` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### zahlung – 7.2 Zahlung bestätigen (F6 Geld)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F rechnung | OPTIK | `actions/payments.actions.ts:68` |  |
| F betrag (Teilzahlung) | OPTIK | `lib/server/commands/confirmPaymentCommand.ts:169` | teilbezahlt |
| F datum (Eingang am) | FUNKTION_NEU | `lib/server/commands/confirmPaymentCommand.ts:29` | kein Datum im Input |
| F art | OPTIK | `lib/server/paymentContract.ts:9` | bar/ueberweisung/karte |
| A Zahlung bestätigen | OPTIK | `actions/payments.actions.ts:46` | dev verboten; K3 |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### einstellungen – 8 Einstellungen (F7 Einstellungen)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Reiter Firma | OPTIK | `actions/settings.actions.ts:19` |  |
| Reiter Leistungen & Preise | OPTIK | `actions/settings.actions.ts:19` | services + hourlyRate |
| Reiter Personen & Rechte | OPTIK | `actions/settings.actions.ts:19` |  |
| Reiter Zahlung (Ziel-Kunden) | OPTIK | `actions/customers.actions.ts:140` | paymentPreference |
| Reiter Daten: Datenkiste | FUNKTION_NEU | – | s. datenkiste |
| Rolle werkstatt sieht Seite | OPTIK | `actions/settings.actions.ts:11` | heute FORBIDDEN; K2 |
| A Ersteinrichtung / Leistung anlegen | OPTIK | `actions/settings.actions.ts:49` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### firmendaten – 8.1 Firmendaten (F7 Einstellungen)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F firma/anschrift/steuer/bank/logo | OPTIK | `actions/settings.actions.ts:49` | CompanySettingsInput |
| F nummern | OPTIK | `modules/fundament/public.ts:16` | numberRanges (Anzeige) |
| A Speichern (und weiter) | OPTIK | `actions/settings.actions.ts:49` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### katalog – 8.2 Leistungskatalog (F7 Einstellungen)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Liste + Suche | OPTIK | `actions/catalog.actions.ts:7` |  |
| A Leistung anlegen | OPTIK | `actions/settings.actions.ts:68` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### leistung – 8.3 Leistung (F7 Einstellungen)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F bezeichnung/einheit/preis/steuer | OPTIK | `actions/settings.actions.ts:68` |  |
| F oberflaeche | OPTIK | `modules/katalog/public.ts:4` | Server Freitext |
| F durchlauf | OPTIK | `modules/katalog/public.ts:8` | standardLeadTimeWorkingDays |
| A Leistung speichern | OPTIK | `actions/settings.actions.ts:68` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### stundensatz – 8.4 Stundensatz (F7 Einstellungen)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F satz | OPTIK | `actions/orders.actions.ts:146` |  |
| F tagesleistung | FUNKTION_NEU | – | kein Feld |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### rechte – 8.5 Rechte (F7 Einstellungen)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F rolle | OPTIK | `actions/settings.actions.ts:57` |  |
| F pin | OPTIK | `modules/fundament/server/systemSettingsPort.ts:126` | genau 4 Ziffern = Spec |
| F aktiv | OPTIK | `modules/fundament/server/systemSettingsPort.ts:146` | letzter Manager geschützt (Q7) |
| F bereiche | FUNKTION_NEU | `lib/auth/authorizationContract.ts:42` | nur fest je Rolle |
| A Rechte speichern | OPTIK | `actions/settings.actions.ts:57` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### zielfrei – 8.6 Rechnung auf Ziel (F7 Einstellungen)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F kunde | OPTIK | `actions/customers.actions.ts:140` |  |
| F ziel (Tage) | OPTIK | `actions/customers.actions.ts:90` | rechnung_N |
| F skonto | FUNKTION_NEU | – | kein Feld |
| A Freischalten | OPTIK | `actions/customers.actions.ts:90` | verlangt volle Adresse (K8) |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### datenkiste – 3.5 Datenkiste (F7 Einstellungen)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Dropzone/Dateien wählen | FUNKTION_NEU | – | Import-Pipeline fehlt |
| Erkannt: Kunden/Doppelte/alte Belege | FUNKTION_NEU | – |  |
| A Prüfen und übernehmen | FUNKTION_NEU | – | Bulk über createCustomerCommand |
| A Doppelte prüfen / Kunden ansehen | OPTIK | `actions/customers.actions.ts:20` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### backend – 12 Wartung (F8 Wartung)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| System (Version/DB/Sicherung) | INHALT_NEU | `actions/systemStats.ts:8` | Migrationsstand/Sicherung nicht gelesen |
| Updates-Liste | INHALT_NEU | – | Quelle fehlt |
| Anbindungen | OPTIK | `actions/communications.actions.ts:20` | + actions/domainAttachments.actions.ts:53 |
| Stufen & Add-ons / Nutzer | OPTIK | `actions/settings.actions.ts:34` |  |
| Startseite developer | OPTIK | `app/page.tsx:23` | heute /settings |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### protokoll – 12.1 Fehlerprotokoll (F8 Wartung)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Fehlerliste | FUNKTION_NEU | – | kein Fehlerspeicher |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### anbindung – 12.2 Anbindungen (F8 Wartung)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Verbindungsliste | OPTIK | `actions/communications.actions.ts:20` |  |
| A Verbindung testen | INHALT_NEU | `lib/server/microsoftGraph.ts` | nur Konfig-Status, kein Live-Test; Kalender fehlt |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### stufen – 12.3 Stufen & Add-ons (F8 Wartung)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Stufenschalter | OPTIK | `actions/settings.actions.ts:41` | tenant_features |
| A Übernehmen | OPTIK | `actions/settings.actions.ts:41` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### suche – 1 Suchen oder tun (Login/Suche/Menüs (Querschnitt))

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Treffer Kunden/Aufträge/KV/Rechnungen/Dok./Mails/Termine | OPTIK | `actions/search.providers.ts:75` |  |
| Treffer im erkannten Belegtext | OPTIK | `lib/server/searchAuxiliaryRead.ts:25` | extracted_data |
| Werkstatt ohne Geld | OPTIK | `actions/search.providers.ts:90` | Provider rechtegesteuert |
| Tun: Neuer Eingang / Kunde anlegen | OPTIK | `app/GlobalCreateAppAdapter.tsx` |  |
| Mikrofon/Diktat E06 | FUNKTION_NEU | – | Azure Speech appweit |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### plus – M1 Neu anlegen (Login/Suche/Menüs (Querschnitt))

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| A Neuer Eingang | OPTIK | `app/GlobalCreateAppAdapter.tsx` |  |
| A Kunde anlegen | OPTIK | `actions/customers.actions.ts:36` |  |
| A Datenkiste | FUNKTION_NEU | – | s. datenkiste |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### konto – M2 Konto (Login/Suche/Menüs (Querschnitt))

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| A Abmelden | OPTIK | `actions/auth.ts:94` |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### mehr – M3 Weitere Bereiche (Login/Suche/Menüs (Querschnitt))

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| A Buchhaltung/Einstellungen/Wartung | OPTIK | `app/settings/page.tsx` | Routen vorhanden |
| A Material & Einkauf / Zahlen → stufenseite | OPTIK | – |  |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### stufenseite – 13 Freigeschaltete Funktion (Login/Suche/Menüs (Querschnitt))

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Sperranzeige | OPTIK | `modules/fundament/server/tenantFeaturePort.ts:66` |  |
| A Stufen schalten | OPTIK | `actions/settings.actions.ts:41` |  |
| A Zur Startseite | OPTIK | – | Ziel start = navigation.kopf.marke |

## 3 FUNKTION_NEU – Liste mit Größe

S < 0,5 T · M ≈ 1 T · L > 1 T. Gleiche Fähigkeit aus mehreren Screens = eine Zeile.

| # | Fähigkeit | Screens | Größe | Bemerkung |
|---|---|---|---|---|
| 1 | Neukunde + Auftrag atomar in einem Command | eingang | M | `orderIntakeCommand` nimmt nur `EXISTING` (K1) |
| 2 | Terminstatus Wunsch/bestätigt/verschoben speichern | eingang, termin, auftrag | S | Intake + `orderPromiseCommand` erweitern |
| 3 | Eingangsart am Auftrag | eingang | S | neues Feld |
| 4 | Ausführung je Position | eingang (position), teil | S | heute nur `surfaceRequested` (K11) |
| 5 | KV „gültig bis“ | eingang | S | Quote-Vertrag erweitern |
| 6 | Erfassen aus Volltext/Foto (E07) | eingang | L | Azure + Regeln; heute NOT_AVAILABLE |
| 7 | Diktat (E06, Azure Speech) | suche, alle Freitexte, fertig | M | appweit |
| 8 | Erkennung ohne Ziel + Visitenkarte/Signatur | kundeneu, kamera | M | Analyse braucht heute Ziel (K16) |
| 9 | Mehrseitiger Beleg | kamera | S | |
| 10 | Datenkiste (E01) Import, Dubletten, Altbelege | datenkiste, plus, kunden, einstellungen | L | |
| 11 | Kundennotiz anlegen/bearbeiten, Kundentyp ändern, unvollständig speichern | kundeneu, kundebearbeiten | S | K8, K9 |
| 12 | Notizen in der Akte (Auftrag/Kunde) | auftrag, kunde | S | `phoneNotes` = NOT_AVAILABLE |
| 13 | Später/Wiedervorlage + Erledigt/Rückgängig | tag, spaeter | M | |
| 14 | „Anpassen“ Der Tag je Person | tag | M | |
| 15 | Abwesenheiten | tag | M | Tabelle + Pflege |
| 16 | Outlook-Kalender (R01) | tag, termin | L | kein Graph-Kalender |
| 17 | Teil stornieren statt löschen | teil | S | |
| 18 | Auftrag per Code scannen | picker | M | Begleitschein W05 erst Stufe 3 |
| 19 | Mehrarbeit „ganzer Auftrag“ | mehrarbeit | S | K12 |
| 20 | KV-Spielraum (Minutenbudget) | mehrarbeit | S | |
| 21 | Fertig: Ausschuss + Grund | fertig | M | |
| 22 | Fertig: Problem melden | fertig | S | |
| 23 | Zahlung bei Übergabe + Warenausgang in einem Schritt | rauspruefen | S | K13 |
| 24 | Lieferschein-PDF | rauspruefen | M | `generateDeliveryNote` = NOT_AVAILABLE |
| 25 | Zahlungseingangsdatum | zahlung | S | K14 |
| 26 | Mail: Vorlagen | mail, geld (Erinnern), termin, mehrarbeit, fertig | S | |
| 27 | Mail: Empfänger wählbar | mail | S | K15 |
| 28 | Mail: Rechnungs-PDF als Anhang | mail, rechnung | S | heute nur KV |
| 29 | Tagesleistung (€/Arbeitstag) | stundensatz | S | Basis für Werkstatt-Priorität |
| 30 | Skonto je Kunde | zielfrei | S | |
| 31 | Bereiche je Rolle pflegbar | rechte | M | Produktentscheidung, heute fest im Code |
| 32 | Fehlerprotokoll | protokoll | M | |

Summe grob: 4 L, 10 M, 18 S → ca. 4×1,5 + 10×1 + 18×0,4 ≈ **23 Personentage**. Davon in den Flows F1–F6: Nr. 1–5, 11–13, 17–28.

INHALT_NEU (nur zur Einordnung, je S–M): Frühwarnung A09, Terminvorschlag A10 (M), Preisvorschlag A11 (M), Werkstatt-Abschnitt Fertig + Priorität + Eingangsfoto, KV in der Aufträge-Liste, Kunden-Hinweise (!), nächster Schritt (Kunde/Auftrag), Kunden-Kennzahlen, Absprachen, Mails in der Akte, Liste „Abrechnen“, Verknüpft/ähnliche Aufträge, Foto je Teil, Terminprognose, PLZ→Ort, Systemstatus/Updates, Live-Test der Anbindungen.

## 4 Konflikte Spec ↔ Serverregeln

| # | Thema | Spec | Server/Code | Wirkung |
|---|---|---|---|---|
| K1 | Neukunde im Eingang | Kunde und Auftrag in einem Vorgang, „kein Kunde ohne Auftrag“ | `orderIntakeCommand.ts:194` nur `mode: EXISTING`; `OrderIntakePanel.tsx:251` sendet `NEW` → immer VALIDATION_ERROR (toter Pfad); `GlobalCreateFlow.tsx:1202` legt zuerst den Kunden an, dann den Auftrag | Fehler nach Schritt 1 hinterlässt Kunden ohne Auftrag |
| K2 | Rechte der Rolle werkstatt | werkstatt in eingang, kundeneu, kundebearbeiten, teil, termin, mail (Status), einstellungen, firmendaten, rechte | werkstatt ohne `perm_data_orders`/`perm_data_customers` (`authorizationContract.ts:89`); Termin nur buero/meister/admin (`orderPromiseCommand.ts:8`); Mail braucht data-Recht (`communicationPort.ts:30`); Settings nur meister/admin/developer (`settings.actions.ts:11`) | Phillip bekommt FORBIDDEN. Produktentscheidung: Spec-Rollen oder Server-Rollen |
| K3 | Rolle developer | developer überall wie meister | developer fehlt in den Rollenlisten von confirmPayment (`:23`), issueInvoice (`immutableInvoiceCommand.ts:41`), Promise (`:8`), ExtraWork/Freeze/Station (`:11/:13/:17`), GoodsOut (`:25`), Assign (`:13`), setPaymentMode (`:18`). Dev-DB: 1 aktiver developer | Gregor kann nicht abrechnen/buchen |
| K4 | Preise für meister | meister sieht Preise/Geld | meister ohne `perm_view_prices` (`authorizationContract.ts:72–81`); nur Shell-Sonderfall `KreileAppShell.tsx:86` | Preis-Gates je Read prüfen |
| K5 | Zahlungsvokabular | eine Optionsliste „Bar oder Karte bei Abholung / Vorkasse / Rechnung auf Ziel“ | Kunde: `vorkasse\|bar\|rechnung_N` (`createCustomerCommand.ts:89`); Auftrag: `vorkasse\|abholung\|rechnung` (`paymentContract.ts:5`); Zuordnung nur im Client (`GlobalCreateFlow.tsx:1135`) | Zuordnung festschreiben, einmal serverseitig |
| K6 | Stiller Fallback | Neukunde = Vorkasse (U-110), Ziel nur freigeschaltet | `GlobalCreateAppAdapter.tsx:105` `paymentPreference ?? "rechnung_14"` | Kunde ohne Bedingung wird zu „Ziel 14 Tage“; verstößt gegen die AGENTS-Regel „kein stiller Fallback“ |
| K7 | Ziel-Freischaltung | „Rechnung auf Ziel“ nur wenn freigeschaltet (OF-18, Q5) | Intake akzeptiert `rechnung` ohne Kundenprüfung (`orderIntakeCommand.ts:172`, Guard in q5-Migration :21) | Serverregel fehlt |
| K8 | Kunde unvollständig speichern | „Trotzdem speichern“, Interessent nur Name + Telefon | Update verlangt Straße/PLZ/Ort/Land/Zahlungsbedingung (`updateCustomerCommercialCommand.ts:20–23`); Kundentyp nicht änderbar; „Freischalten“ (zielfrei) läuft über dasselbe Update | Teilweises Speichern abgelehnt |
| K9 | Kundennotiz | Feld `notiz` in `formulare.kunde` | `createCustomer` ohne notes-Key (`exactKeys` :71), Update ebenso | Feld nicht speicherbar |
| K10 | Preis bei Freitextposition | `position.preis` bedingt (KV immer, Auftrag nein) | Intake: Freitext muss `unitPriceCents=null` sein (`orderIntakeCommand.ts:185`); Katalogposition muss Name/Oberfläche/Preis exakt treffen (:427–430) | passt, solange der Auftragspreis bei Freitext leer bleibt; nachträglich über `setInvoiceItemPrices` (Q4) |
| K11 | Oberfläche/Ausführung | Auswahl inkl. „noch zu klären“ + Ausführung | `surfaceRequested` Freitext 2–160; keine Ausführung; bei Katalogleistung muss die Oberfläche gleich sein | Ausführung braucht ein eigenes Feld (F#4) |
| K12 | Mehrarbeit ganzer Auftrag | Teil oder „Ganzer Auftrag“ | `itemId` Pflicht (`orderExtraWorkCommand.ts:110`), Minuten 1–1440 | nur je Teil |
| K13 | Bar bei Abholung | darf vor der Zahlung raus (Q5); Haken „bezahlt“ bei Übergabe | abholung verlangt eine **ausgestellte Rechnung** (`recordGoodsOutCommand.ts:441–462`, q5 :353–362) | Rechnung muss vor der Übergabe festgeschrieben sein |
| K14 | Zahlungsdatum | „Eingang am“ Pflicht | `ConfirmPaymentInput` ohne Datum (`confirmPaymentCommand.ts:29`) | Feld wird ignoriert |
| K15 | Mail-Empfänger | „An“ Pflicht, vorbelegt (Kunde/Ansprechpartner) | Empfänger fest = Kunden-E-Mail (`communicationPort.ts:58`) | nicht änderbar |
| K16 | Beleg/Foto ohne Zuordnung | Scan aus Kopfleiste/Plus, vor Kundenwahl | `analyzeDomainAttachment` verlangt targetType/targetId (`documentIntelligencePort.ts:11`) | Scan vor Zuordnung nicht möglich |
| K17 | Startseite je Rolle | Rolf/Phillip = Der Tag, Gregor = Wartung | `app/page.tsx:23–25`: developer → /settings, werkstatt → Werkstatt | Routing anpassen |
| K18 | Termin ändern | Status Wunsch/bestätigt/verschoben, „informieren“ | Promise: nur dueDate + Grund 3–500 Zeichen | Status fehlt (F#2) |
| K19 | Rechte: Bereiche | Bereiche per Häkchen | Rechte fest je Rolle (`authorizationContract.ts:42`) | F#31, Produktentscheidung |

Ohne Konflikt geprüft: PIN genau 4 Ziffern (Login `auth.actions.ts:123`, Pflege `systemSettingsPort.ts:126`) · letzte Person mit Verwaltungsrecht nicht entziehbar (`:146–148`) · 1–20 Positionen · Liefertermin Pflicht · Telefon Pflicht bei Neukunde · Pflichtfelder „für Auftrag“ = `resolveCustomer` (`orderIntakeCommand.ts:362`) · Zahlungsarten bar/Überweisung/Karte + Teilzahlung · Rechnungsnummer R-JJJJ-NNNN, Storno nur als Gutschrift · Kundennummer nie eingegeben, Altkunde bekommt sie beim Speichern (Q8-Migration).


## Nachtrag 27.10. abends – Screens 3.6, 8.5 (neu), 8.8, 11.1 (spec 6ee430a3a8d1)

Stand: Spec `spec.json` (6ee430a3a8d1) · Code `kreile/s1-p2-eingang @ 13e07375` (read-only). Klassen und Tabellenformat wie oben. Neue Ziele `entwurf` (aus eingang/kundeneu „Abbrechen“), `meincode` (Logins-Kachel, `nur_selbst`), `buendel` (Der Tag/Werkstatt Bündel-Block), `rechte` lösen alle auf → **ZIEL_FEHLT: 0**.

| Screen | OPTIK | INHALT_NEU | FUNKTION_NEU | ZIEL_FEHLT | Summe |
|---|---|---|---|---|---|
| entwurf (3.6) | 3 | 0 | 1 | 0 | 4 |
| rechte (8.5 neu) | 7 | 1 | 6 | 0 | 14 |
| meincode (8.8) | 4 | 0 | 1 | 0 | 5 |
| buendel (11.1) | 6 | 1 | 1 | 0 | 8 |
| **Nachtrag gesamt** | **20** | **2** | **9** | **0** | **31** |

Die alte Zeile `rechte` (Abschnitt 2, „Bereiche je Rolle pflegbar“) und F#31/K19 sind durch diesen Nachtrag ersetzt.

### entwurf – 3.6 Entwurf behalten? (F1 Neuer Eingang)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Rückfrage beim Abbrechen (eingang, kundeneu) | OPTIK | `components/layout/GlobalCreateFlow.tsx:464` | `close` schließt heute sofort, ohne Rückfrage/Dirty-Erkennung (Knöpfe :1311, :1320, :1504) |
| A Verwerfen (schließt 2 Ebenen) | OPTIK | `components/layout/GlobalCreateFlow.tsx:464` | = heutiges `close` |
| A Weiter bearbeiten | OPTIK | – | nur Dialog schließen |
| A Entwurf behalten + Wiederaufnahme unter „Neuer Eingang“ | FUNKTION_NEU | – | kein Entwurfsspeicher für Eingang/Neukunde; Muster nur `hooks/useAutosaveDraft.ts:4` (Telefonnotiz, localStorage). Gilt auch für eingang-Fehlerzustand „Entwurf behalten und schließen“. Speicherort offen (K27) |

### rechte – 8.5 Logins & Rechte, neu (F7 Einstellungen/Wartung)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Loginliste: Name, aktiv | OPTIK | `modules/fundament/server/systemSettingsPort.ts:34` | readSystemSettings |
| Loginliste: Kürzel, Bezeichnung | FUNKTION_NEU | `db/schema.ts:8` | keine Spalten in `app_users`; Kürzel heute nur Konstante `lib/auth/authorizationContract.ts:114` |
| Loginliste: Anzahl Bereiche | INHALT_NEU | – | abgeleitet aus Matrix (F#34) |
| Ändern: Name, Kürzel, Bezeichnung | FUNKTION_NEU | `systemSettingsPort.ts:124` | `updateManagedUser` exactKeys = active,pin,role,userId; kein Name |
| Ändern: Code zurücksetzen | OPTIK | `systemSettingsPort.ts:128` | bcrypt, 4 Ziffern (:126); setzt `updated_at` → Ziel-Sitzung endet (gewollt) |
| Ändern: aktiv, Gregor selbst nicht deaktivierbar | OPTIK | `systemSettingsPort.ts:147` | USER_SELF_DEACTIVATION gilt für jeden Admin selbst |
| Login anlegen (Name, Kürzel, Bezeichnung, Vorlage, Code) | FUNKTION_NEU | `app/actions/admin.actions.ts:21` | `createUser` = NOT_AVAILABLE; UI „geplant“ `app/settings/SettingsAdminClient.tsx:112`; K22, K23 |
| Neuer Login sofort bei der Anmeldung | OPTIK | `lib/server/startUserRead.ts:15` | liest aktive Nutzer mit PIN; Achtung :27 (K23) |
| Start auf „Der Tag“ mit Standardauswahl der Vorlage | OPTIK | `app/page.tsx:23` | hängt an F#14 und K17 |
| Matrix Bereich × Login, Haken wirkt sofort, ohne Haken unsichtbar | FUNKTION_NEU | `lib/auth/authorizationContract.ts:42` | Rechte heute fest je Rolle, abgeleitet in `lib/server/authorization.ts:174`; K21 |
| Fest: developer behält „logins“ + „wartung“ | FUNKTION_NEU | `systemSettingsPort.ts:149` | heute nur „letzter aktiver Manager“; K24 |
| Zugang nur mit Recht „logins“ | FUNKTION_NEU | `app/actions/settings.actions.ts:11` | heute meister/admin/developer; K20 |
| Fehler „Nicht gespeichert“ / Erneut | OPTIK | – | |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### meincode – 8.8 Mein Code ändern (F7 Einstellungen)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| F code_neu / code_wdh (4 Ziffern) | OPTIK | `systemSettingsPort.ts:126` | Regel /^\d{4}$/ vorhanden |
| Teilweise „Codes stimmen nicht überein“ | OPTIK | – | nur Client |
| A Code speichern (eigener Login, jede Rolle) | FUNKTION_NEU | `app/actions/settings.actions.ts:57` | kein Self-Service: nur Admin-Pfad (`adminContext` :11), verlangt role+active; werkstatt FORBIDDEN; K25 |
| Einstieg „Mein Code“ je Zeile, nur_selbst | OPTIK | – | Kachel Logins |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### buendel – 11.1 Bündeln (F4 Werkstatt / F2 Der Tag)

| Element | Klasse | Code-Anker | Bemerkung |
|---|---|---|---|
| Liste offene Aufträge gleicher Oberfläche (Wareneingang + Galvanik), dringendste oben | INHALT_NEU | `modules/werkstatt/server/deriveWerkstattView.ts:90` | heute nur die größte Gruppe aus den `held`-Karten (:127–133, risikoklassifiziert), nicht alle offenen; Gleichheit = Freitext nach trim (:93) |
| Kopf Anzahl offen · gewählt | OPTIK | – | |
| Haken je Zeile, alle vorausgewählt | OPTIK | – | nur Client |
| Etikett Start/Termin | OPTIK | `modules/orders/domain/getUrgency.ts:3` | |
| A Bündel starten (gewählte → Galvanik, Verlauf) | FUNKTION_NEU | `lib/server/commands/orderStationCommand.ts:210` | nur Einzelwechsel je Auftrag (`orders.actions.ts:60`), Event ORDER_STATION_MOVED_V1 = Verlauf; heute ist „Bündeln“ nur ein Filter (`modules/werkstatt/ui/WerkstattView.tsx:482`); K26 |
| Leer „Keine Aufträge mit gleicher Oberfläche“ | OPTIK | `ui/kr/BuendelVorschlag.tsx:10` | |
| Fehler „Nicht gestartet“ / Erneut | OPTIK | – | |
| nav | OPTIK | – | Schließen/Abbrechen/Zurück/Erneut laden: reine Navigation |

### FUNKTION_NEU – Nachtrag (Fortsetzung der Nummerierung)

| # | Fähigkeit | Screens | Größe | Bemerkung |
|---|---|---|---|---|
| 33 | Entwurf behalten/verwerfen + Wiederaufnahme | entwurf, eingang, kundeneu | S (lokal je Gerät) / M (serverseitig) | K27 |
| 34 | Rechte je Login × Bereich (Speicher, Resolver, alle Server-Gates, UI-Sichtbarkeit) | rechte, alle Screens | L (≈ 3 T) | ersetzt F#31; K21 |
| 35 | Login anlegen mit Vorlage | rechte | M | K22, K23 |
| 36 | Login ändern: Name, Kürzel, Bezeichnung | rechte | S | neue Spalten + exactKeys |
| 37 | Feste Rechte developer + Zugang nur mit „logins“ | rechte | S | Teil von 34; K20, K24 |
| 38 | Eigenen Code ändern (Self-Service) | meincode | S | K25 |
| 39 | Bündel starten (mehrere Aufträge → Galvanik, je Verlauf) | buendel | M | K26 |

Netto: +1 L, +2–3 M, +4–5 S, −F#31 (M) → ca. **+5,5 Personentage** (Gesamt ≈ 28,5).

### 8.5 – was der Server für Rechte je Rolle/Login ändern muss

Heute: Rechte = fest je Rolle (`lib/auth/authorizationContract.ts:42` `ROLE_PERMISSIONS`, abgeleitet in `lib/server/authorization.ts:174`), und die meisten Commands prüfen zusätzlich **harte Rollenlisten**. Ein Haken in der UI wirkt erst, wenn alle diese Stellen umgestellt sind.

1. **Datenmodell (Migration):** Tabelle `app_user_rights (tenant_id, user_id, bereich, granted_by, granted_at)` mit Bereichs-Katalog = `spec.rechte.bereiche` (auftraege, eingang, kunden, geld, mails, einstellungen, logins, wartung); `app_users` + `kuerzel`, `bezeichnung`; Seed aus `rechte.vorlagen` je heutiger Rolle. Rechte **nicht** über `app_users.updated_at` schreiben, sonst greift `SESSION_REVOKED` (`authorization.ts:163–172`) und der Ziel-Login fliegt raus.
2. **Resolver:** `resolveAuthorization` liest die Bereiche je Request (wirkt dadurch sofort) und liefert `bereiche` im `AuthorizationSnapshot`; `role` bleibt nur Vorlage/Etikett. Feste Abbildung Bereich → bestehende `PermissionKey`s (z. B. geld → `perm_view_prices`; logins → `perm_sys_users`; wartung → `perm_sys_toggles`/`perm_sys_diag`; auftraege → `perm_op_status`/`perm_op_photos`/`perm_op_qa`/`perm_view_leitstand`; eingang → `perm_data_orders`; kunden → `perm_data_customers`/`perm_view_customers`), damit vorhandene `permissions.includes`-Prüfungen weiter gelten.
3. **Harte Rollenlisten ersetzen** durch Bereichsprüfung (Hauptdateien):
   - Commands `lib/server/commands/`: `orderPromiseCommand.ts:8`, `orderStationCommand.ts:17`, `orderExtraWorkCommand.ts`, `orderFreezeCommand.ts`, `orderFreezeCorrectionCommand.ts`, `orderTaskAssignmentCommand.ts`, `immutableInvoiceCommand.ts:41`, `invoiceItemPriceCommand.ts`, `confirmPaymentCommand.ts`, `setPaymentModeCommand.ts`, `recordGoodsOutCommand.ts`, `extraWorkAdminCommand.ts`.
   - Reads/Verträge `lib/server/`: `orderCardRead.ts`, `orderTaskAssignmentRead.ts`, `invoiceRead.ts`, `paymentContract.ts`, `productActorReadinessCore.ts`.
   - Actions: `app/actions/settings.actions.ts:11` (`adminContext`), `app/actions/search.providers.ts`, `lib/search/actionRegistry.ts`, `app/warendurchlauf/actions.ts`, `lib/auth/permissions.ts:26` (`requireAdminOrDeveloper`, inkl. Altrolle „inhaber“).
   - `modules/fundament/server/systemSettingsPort.ts:10–11` (`ROLES`, `MANAGER_ROLES`) und :149 (Regel „letzter Manager“ → „mind. ein aktiver Login mit `logins`“ + developer-fest).
   - DB: View `private.v_order_task_assignee_options_v1` (`supabase/migrations/20260820121500_f1_3_foundation_ports.sql:539/545`, `role IN (…)`).
   - Client-Sichtbarkeit („ohne Haken unsichtbar“): `lib/auth/PermissionsContext.tsx`, `components/layout/KreileAppShell.tsx`, `MoreMenu.tsx`, `RightNav.tsx`, `MobileNav.tsx`, `app/orders/OrderCardAppAdapter.tsx` (9 Rollenvergleiche), `app/page.tsx`.
4. **Neue Commands** (exactKeys, Audit-Event, Prüfung „Akteur hat `logins`“): `setUserRight(userId, bereich, granted)` mit Fest-Schutz, `createLogin`, `updateLogin` (Name/Kürzel/Bezeichnung/aktiv/Code), `changeOwnPin`.
5. **Tests:** Integrationstests mit `withRealSession("<rolle>")` auf Bereiche umstellen.

### Konflikte Spec ↔ Serverregeln – Nachtrag

| # | Thema | Spec | Server/Code | Wirkung |
|---|---|---|---|---|
| K20 | Wer Rechte verwaltet | nur Recht „logins“ (vorerst nur Gregor, U-200) | `settings.actions.ts:11` lässt meister/admin/developer Rolle, PIN, aktiv aller Nutzer ändern | Rolf kann heute Rechte ändern; Gate auf „logins“ umstellen |
| K21 | Rollen nur Vorlage | Haken je Login × Bereich sind maßgeblich | ~20 Dateien mit harten Rollenlisten + `ROLE_PERMISSIONS` + DB-View (Liste oben) | Teilumstellung = Haken sichtbar, Server FORBIDDEN. Ersetzt K19 |
| K22 | Login anlegen ohne E-Mail | Name, Kürzel, Bezeichnung, Vorlage, Code | `app_users.email` NOT NULL (`db/schema.ts:11`), `id` „matches auth.users.id“ (:9); `createUser` NOT_AVAILABLE „benötigt W3-Command-Vertrag“ (`admin.actions.ts:24`) | Spec-intern: `funktionen.X08` gilt Stufe 1, Grund sagt aber „später eigene Auth-Erweiterung, ‚geplant‘ zeigen“ → Owner klären |
| K23 | Vorlage „leer“ | Login ohne jeden Bereich | Rolle muss gültig sein (`authorization.ts:146` UNKNOWN_ROLE); eine ungültige Zeile macht die ganze Anmeldeliste UNAVAILABLE (`startUserRead.ts:27`) | Rolle für „leer“ festlegen (z. B. readonly) und Startseite ohne Bereiche definieren |
| K24 | Kein Aussperren | developer: „logins“ + „wartung“ fest | nur „letzter aktiver Manager“ (`systemSettingsPort.ts:149`) und Selbstdeaktivierung (:147) | Gregor kann heute von Rolf auf werkstatt gesetzt werden |
| K25 | Eigener Code | jeder Login, Toast „Neuer Code gespeichert“ | nur Admin-Pfad; PIN-Änderung setzt `updated_at` (`systemSettingsPort.ts:152`) → `SESSION_REVOKED` (`authorization.ts:163–172`) | eigener Login wird nach dem Speichern abgemeldet; Session neu ausstellen oder Revocation trennen |
| K26 | Bündel starten | alle offenen gleicher Oberfläche (Wareneingang + In Arbeit) → Galvanik, Verlauf | nur Einzelwechsel `angenommen`→`galvanik` mit `expectedVersion` (`orderStationCommand.ts:8–9`, :310); bereits in Galvanik = kein Wechsel; developer fehlt in der Rollenliste (:17, K3); Oberfläche = Freitext je Auftrag (`deriveWerkstattView.ts:93`, K11) | Batch atomar oder mit Teilergebnis festlegen; Schreibvarianten („Verzinken“/„verzinkt“) bilden getrennte Bündel |
| K27 | Entwurf-Speicherort | „Eingaben bleiben als Entwurf unter ‚Neuer Eingang‘“ (OR-05) | kein Entwurfsspeicher; Login-Wechsel am selben Gerät (PIN-Start) ist üblich | Owner: lokal je Gerät (S) oder serverseitig je Login (M) |

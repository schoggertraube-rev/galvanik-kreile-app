<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 02 — Funktionen und Abläufe

## Personen- und Rechtebasis

Zielvertrag für alle Funktionen: Alle angemeldeten Kreile-Personen dürfen die Funktion sehen und grundsätzlich verwenden; Admin kann Fähigkeiten je Person sperren oder erweitern. Identität, Tenant und Fähigkeit werden serverseitig aus G01 bezogen. Die heutigen festen Rollenlisten in F1.4/F1.5 sind Ist-Code und müssen auf diesen Vertrag umgebaut werden, ohne Audit-Actor oder Sicherheitsgrenzen zu schwächen.

### F-G07-001 — Geld & Rechnungen öffnen

**Auslöser:** Person wählt in der Ziel-Shell `Geld & Rechnungen`.

**Personen:** Alle angemeldeten Kreile-Personen; Admin kann die Sicht je Person sperren.

**Schritte:**

1. G01 liefert serverseitig Actor, Tenant und persönliche Fähigkeit.
2. G07 liest die tenantgebundene Rechnungsprojektion aus `public.invoices` über die öffentliche Accounting-Fassade.
3. Die Liste zeigt Rechnungsnummer, Auftrag, Kunde, Status, offenen Betrag und nächste belegte Handlung; synthetische V5-Werte werden nie übernommen.
4. Ein Eintrag öffnet das Rechnungsdetail oder dieselbe G04-Auftragskarte; Filter-/Rückwegzustand bleibt bei der Shell.

**Ergebnis + Receipt/Readback:** Reiner Read ohne Mutation; der Readback stammt aus der kanonischen Invoice-/Payment-Projektion. Kein Receipt wird erzeugt.

**Fehlerfälle:** Auth/Tenant unklar, Projektion nicht verfügbar, Integritätsprüfung negativ, persönliche Fähigkeit gesperrt.

**Sperren/Konflikte:** G01-Fähigkeit; `K-G07-004`, `K-G07-008`.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Reale Liste mit Rechnung/Auftrag, Status, offenem Betrag und Aktion | „Geld & Rechnungen“ | V5 `accountingPage()`; `InvoicesClient.tsx` |
| lädt | DS-Skelett, keine alten Daten als Erfolg | „Rechnungsliste wird geladen“ | `rechnungen/loading.tsx` |
| leer | Leere reale Liste ohne Statistik-Fake | „Keine Rechnungen ausgestellt.“ | `InvoicesClient.tsx` |
| Fehler | Alert ohne Teilwahrheit | „Rechnungsliste konnte nicht sicher geladen werden.“ | `rechnungen/page.tsx` |
| gesperrt | G01-Denial, keine Rechnungsdaten | „Sitzung oder Berechtigung ist nicht verfügbar.“ | `rechnungen/page.tsx` |
| In Klärung | Ausgegraute Export-/E-Rechnungs-Anschlüsse | „In Klärung“ | OE-2609-04; Anleitung §6 |
| In Aufbau | Ausgegraute M01-Anschlüsse | „In Aufbau“ | OE-2609-04/05; Anleitung §6 |

### F-G07-002 — Rechnung unveränderlich ausstellen

**Auslöser:** Person wählt in der G04-Auftragskarte bei abrechnungsreifem Auftrag `Rechnung`.

**Personen:** Alle mit persönlicher Fähigkeit `Rechnung ausstellen`; Admin kann sperren/erweitern.

**Schritte:**

1. UI erzeugt eine stabile `clientEventId` und sendet Auftrag, erwartete Version und Datum an die öffentliche Accounting-Command-Fassade.
2. Server prüft Identität, Tenant, Fähigkeit, Freeze, Auftragszustand, Kunden-/Firmen-/Katalogdaten und Zahlungsmodus.
3. Alle Snapshot- und PDF-Inhalte werden vor der Nummernvergabe vorbereitet.
4. `private.allocate_invoice_number` vergibt `R-JJJJ-NNNN`; Command speichert Snapshot, PDF-Bytes, Hash, Event und Zahlungsanfangszustand atomar.
5. UI liest Receipt und kanonischen Readback; nur bei Feldgleichheit wird Erfolg gezeigt.

**Ergebnis + Receipt/Readback:** `INVOICE_CREATED_V1` oder nach Zielrechnungs-Warenausgang `INVOICE_CREATED_V2`; Receipt enthält Invoice-/Order-ID, Nummer, Version, Summen, Datum, PDF-Referenz/-Hash, Event und Korrelation; Reload bestätigt dieselben Daten.

**Fehlerfälle:** Nicht fertig, Freeze/Version fehlt, aktive Rechnung vorhanden, Stammdaten unvollständig, Zahlungsmodus ungültig, Nummern-/PDF-/Readback-Fehler.

**Sperren/Konflikte:** `K-G07-003`, `K-G07-005`, `K-G07-006`, `K-G07-007`, `K-G07-008`.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Aktivierte Aktion in der Auftragskarte | „Rechnung unveränderlich ausstellen“ | `OrderCardView.tsx` |
| lädt | Aktion ist gesperrt, während Command/Readback läuft | „Rechnung wird sicher ausgestellt.“ | `OrderCardAppAdapter.tsx` |
| leer | Aktion ist ohne abrechnungsreifen Auftrag nicht sichtbar | „Kein weiterer freigegebener Schritt“ | `OrderCardView.tsx` |
| Fehler | Kein Erfolg; Auftragsstand muss neu gelesen werden | „Die Rechnung konnte nicht sicher bestätigt werden. Bitte den Auftragsstand neu laden.“ | `OrderCardAppAdapter.tsx` |
| gesperrt | Unvollständige Quelle oder fehlende Fähigkeit | „Stammdaten für die Rechnungsausgabe sind unvollständig.“ | `immutableInvoiceCommand.ts` |
| In Klärung | Neue Zielrechnungs-/PDF-Bedingung nicht aktiv | „Rechnung auf Ziel — In Klärung“ | OE-2609-04/11; Q-G07-003/Q-G07-006 |
| In Aufbau | Nicht für diese Kernaktion verwendet | „In Aufbau“ | Anleitung §6; nur Anschlussstatus |

### F-G07-003 — Rechnungs- oder Storno-PDF öffnen

**Auslöser:** Person öffnet eine Rechnung und wählt `Original-PDF öffnen` oder `Stornobeleg öffnen`.

**Personen:** Alle mit persönlicher Lesefähigkeit; Admin kann sperren.

**Schritte:**

1. API bestimmt Actor/Tenant serverseitig und validiert Invoice-ID sowie Dokumentart.
2. G07 liest gespeicherte Bytes und Hash aus `public.invoices`.
3. Integritätsprüfung hasht die Bytes und vergleicht den gespeicherten Hash.
4. Nur ein valides Dokument wird als PDF ausgeliefert.

**Ergebnis + Receipt/Readback:** Reiner Read; Response-Bytes, Rechnungsnummer, Dokumentart und Hash sind der Readback.

**Fehlerfälle:** Fremder Tenant, ungültige ID/Art, Dokument fehlt, Hashabweichung, Infrastruktur nicht verfügbar.

**Sperren/Konflikte:** `K-G07-004`, `K-G07-008`.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Dokumentaktion passend zum Status | „Original-PDF öffnen“ / „Stornobeleg öffnen“ | `InvoicesClient.tsx` |
| lädt | Browser-/API-Ladevorgang ohne Erfolgsvorabmeldung | „Rechnungsliste wird bestätigt.“ | `InvoicesClient.tsx`; vorhandener Wiederlesetext |
| leer | Keine Dokumentaktion ohne Rechnung | „Keine Rechnungen ausgestellt.“ | `InvoicesClient.tsx` |
| Fehler | Kein beschädigtes/tenantfremdes PDF | „Rechnungs-PDF konnte nicht sicher geladen werden.“ | `invoiceRead.ts` |
| gesperrt | Keine Bytes bei fehlender Sitzung/Berechtigung | „Sitzung oder Berechtigung ist nicht verfügbar.“ | `invoices.actions.ts`; Auth-Vertrag |
| In Klärung | ZUGFeRD-Dokument ist noch nicht behauptet | „E-Rechnung — In Klärung“ | OE-2609-14; Q-G07-001 |
| In Aufbau | Nicht für den vorhandenen PDF-Read verwendet | „In Aufbau“ | Anleitung §6; nur Anschlussstatus |

### F-G07-004 — Zahlungsregel bestimmen und Zielrechnung freigeben

**Auslöser:** Auftrag wird angelegt/geändert oder Admin/Rolf bearbeitet die Kundenfreigabe.

**Personen:** Zahlungsstandard gilt für alle; nur Admin/Rolf darf die Kundenfreigabe ändern; Admin kann persönliche Fähigkeiten steuern.

**Schritte:**

1. G05 liefert die versionierte Kundenfreigabe über einen Host-Port.
2. Bei Abholung werden `bar` oder `karte` angeboten; sonst wird `vorkasse` gesetzt.
3. Nur bei aktiver Kundenfreigabe darf `rechnung` gewählt werden; dann gelten 2 Prozent/10 Tage und 14 Tage.
4. Jede Änderung nutzt erwartete Version, `clientEventId`, Actor, Event, Receipt und Reload-Readback.
5. Nach Warenausgang ist keine Änderung mehr möglich.

**Ergebnis + Receipt/Readback:** `PAYMENT_MODE_SET_V1` bleibt der bestehende Modusbeleg; die Kundenfreigabe benötigt den in Q-G07-003 festzulegenden G05-Receipt.

**Fehlerfälle:** Kundenfreigabe fehlt/unklar, unberechtigte Person, veraltete Version, Warenausgang vorhanden, ID wiederverwendet.

**Sperren/Konflikte:** `K-G07-003`, `K-G07-005`, `K-G07-008`.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Erlaubte Regel mit belegtem Modus | „Abholung: bar oder Karte“ / „Vorkasse“ | OE-2609-07 |
| lädt | Auswahl nicht erneut auslösbar | FEHLT → Q-G07-008 | Designphase; bis dahin vorhandene Aktion unverändert lassen |
| leer | Ohne Kundenfreigabe keine Zielrechnungsoption | „Rechnung auf Ziel — In Klärung“ | OE-2609-04/11; Q-G07-003 |
| Fehler | Keine stille Modusänderung | „Zahlungsmodus konnte nicht sicher geändert werden.“ | `setPaymentModeCommand.ts` |
| gesperrt | Änderung nach Warenausgang blockiert | „Nach dem Warenausgang kann der Zahlungsmodus nicht geändert werden.“ | `setPaymentModeCommand.ts` |
| In Klärung | Kundenfreigabe noch ohne Datenvertrag | „Rechnung auf Ziel — In Klärung“ | Q-G07-003 |
| In Aufbau | Terminal-Auswahl noch ohne Adapter | „Kartenterminal — In Aufbau“ | OE-2609-12 |

### F-G07-005 — Zahlung manuell bestätigen

**Auslöser:** Person wählt in der Auftragskarte `Zahlung bestätigen` und eine erlaubte Methode.

**Personen:** Alle mit persönlicher Zahlungsfähigkeit; Admin kann sperren/erweitern.

**Schritte:**

1. UI verwendet offenen Betrag, Methode und erwartete Payment-Version; `clientEventId` bleibt bei Wiederholung stabil.
2. Server sperrt Auftrag und Rechnung, prüft Tenant, aktive Rechnung, Status, Betrag, Methode und Version.
3. Betrag wird addiert; Zustand wird `teilbezahlt` oder `bezahlt`; Event und Receipt werden atomar gespeichert.
4. UI liest Payment-Receipt und `v_payment_summary_v1`; Erfolg erst bei identischem Readback.

**Ergebnis + Receipt/Readback:** `PAYMENT_CONFIRMED_V1` mit Betrag, kumuliert bezahlt, offen, Methode, Actor, Zeit, Event, Korrelation und Version; Reload zeigt denselben offenen Betrag.

**Fehlerfälle:** Keine/gesperrte Rechnung, Überzahlung, ungültige Methode, Version/ID-Konflikt, unklarer Ausgang, Readback-Differenz.

**Sperren/Konflikte:** `K-G07-001`, `K-G07-002`, `K-G07-004`, `K-G07-005`, `K-G07-008`.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Offener Betrag und aktive Zahlungsaktion | „Zahlungseingang bestätigen“ | `OrderCardView.tsx` |
| lädt | Aktion deaktiviert bis Receipt/Readback | „Zahlung wird sicher bestätigt.“ | `OrderCardAppAdapter.tsx` |
| leer | Ohne aktive offene Rechnung keine Aktion | „Rechnung noch nicht ausgestellt“ | `OrderCardView.tsx` |
| Fehler | Kein lokaler Erfolg | „Die Zahlung konnte nicht sicher bestätigt werden. Bitte den Zahlungsstand neu laden.“ | `OrderCardAppAdapter.tsx` |
| gesperrt | Zahlungsdetails/Fähigkeit gesperrt | „Zahlungsdetails sind für diese Rolle nicht freigegeben.“ | `OrderCardAppAdapter.tsx` (Text bleibt bis G01-Personenrechte umgebaut sind) |
| In Klärung | Automatische Skontobuchung nicht aktiv | „Skonto — In Klärung“ | Q-G07-004 |
| In Aufbau | Terminalzahlung nicht aktiv | „Kartenterminal — In Aufbau“ | OE-2609-12; Q-G07-005 |

### F-G07-006 — Warenausgang bestätigen

**Auslöser:** Person wählt `Ware raus`, öffnet einen fertigen Auftrag und bestätigt Versand oder Abholung.

**Personen:** Alle mit persönlicher Warenausgangsfähigkeit; Admin kann sperren/erweitern.

**Schritte:**

1. G04/Werkstatt zeigt nur echte Aufträge mit Station `fertig`.
2. G07 liest Zahlungsmodus, Rechnung, Zahlung und bisherigen Ausgang aus `v_goods_out_ui_state_v1`.
3. Vorkasse verlangt Vollzahlung; Abholung verlangt bestätigte Bar-/Kartenzahlung; freigeschaltete Zielrechnung darf ohne Rechnung/Zahlung ausgeben.
4. Command sperrt Auftrag, prüft Version und Gate, bewegt Auftrag/Teile genau einmal und schreibt den passenden V1-/V2-Ausgangsbeleg.
5. Receipt und Reload-Readback müssen Auftrag, Event, Actor und Modus bestätigen.

**Ergebnis + Receipt/Readback:** `ORDER_PICKED_UP_V1` oder `ORDER_PICKED_UP_V2`; Auftrag ist `abgeholt`, Ausgangsbeleg und UI-Readback stimmen überein.

**Fehlerfälle:** Nicht fertig, Gate nicht erfüllt, Kundenfreigabe unklar, Adresse bei Versand unvollständig, bereits ausgegeben, Version/ID-Konflikt.

**Sperren/Konflikte:** `K-G07-001`, `K-G07-002`, `K-G07-003`, `K-G07-005`, `K-G07-007`, `K-G07-009`.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Picker mit ausschließlich fertigen Aufträgen | „Ware raus“ | `WerkstattView.tsx` |
| lädt | Aktion gesperrt bis Beleg/Readback | „Warenausgang wird sicher gebucht.“ | `OrderCardAppAdapter.tsx` |
| leer | Ehrlicher Picker-Leerzustand | „Keine fertig gemeldete Ware zur Ausgabe vorhanden.“ | `WerkstattView.tsx` |
| Fehler | Kein lokaler Erfolg | „Der Warenausgang konnte nicht sicher bestätigt werden. Bitte den Auftragsstand neu laden.“ | `OrderCardAppAdapter.tsx` |
| gesperrt | Zahlungsgate blockiert | „Der Zahlungsstand erlaubt den Warenausgang noch nicht.“ | `OrderCardAppAdapter.tsx` |
| In Klärung | Zielrechnung ohne belegte Kundenfreigabe | „Rechnung auf Ziel — In Klärung“ | OE-2609-11; Q-G07-003 |
| In Aufbau | Terminalweg fehlt, manueller Kassenweg bleibt | „Kartenterminal — In Aufbau“ | OE-2609-12 |

### F-G07-007 — Rechnung stornieren

**Auslöser:** Person öffnet eine ausgestellte Rechnung, gibt einen Grund ein und wählt `Rechnung stornieren`.

**Personen:** Alle mit persönlicher Stornofähigkeit; Admin kann sperren/erweitern. Die interne Sperre gegen bezahlte/unklare Zustände gilt unabhängig von der Fähigkeit.

**Schritte:**

1. UI validiert Grund 5–500 Zeichen und verwendet stabile `clientEventId` sowie erwartete Version.
2. Server sperrt Auftrag vor Rechnung und prüft Tenant, Actor, Status, Version sowie vollständig unbezahlten, konsistenten Zahlungszustand.
3. DB-Trigger muss dieselbe Zahlungsinvariante als zweite Schicht prüfen; bis OP-06 geschlossen ist, bleibt Live-Gate rot.
4. Command ändert nur erlaubte Stornofelder, erzeugt Storno-PDF/Event/Receipt und lässt Originalfelder unverändert.
5. UI liest Storno-Receipt und Rechnungsliste neu und vergleicht beide feldgenau.

**Ergebnis + Receipt/Readback:** `INVOICE_CANCELLED_V1`, Status `cancelled`, Originalhash unverändert, Stornobeleg gespeichert; Replay ist wirkungsfrei.

**Fehlerfälle:** Zahlung/unklarer Zustand, Grund ungültig, schon storniert/verändert, ID-Konflikt, DB-Gate oder Readback scheitert.

**Sperren/Konflikte:** `K-G07-004`, `K-G07-005`, `K-G07-008`.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Grundfeld und Stornoaktion an ausgestellter Rechnung | „Rechnung stornieren“ | `InvoicesClient.tsx` |
| lädt | Formular deaktiviert | „Storno wird bestätigt…“ | `InvoicesClient.tsx` |
| leer | An stornierter Rechnung keine erneute Aktion | „Storniert“ | `InvoicesClient.tsx` |
| Fehler | Kein Erfolg ohne verifizierten Readback | „Storno wurde nicht bestätigt; Rechnungsliste neu laden.“ | `InvoicesClient.tsx` |
| gesperrt | Bezahlter/unklarer Zustand | „Die Rechnung kann nicht storniert werden, weil bereits eine Zahlung vorliegt oder der Zahlungsstand nicht eindeutig ist.“ | `immutableInvoiceCommand.ts` |
| In Klärung | P0-DB-Zweitschicht bis OP-06 | „Storno — In Klärung“ | OP-06; Red-Team RT-14 |
| In Aufbau | Nicht verwendet | „In Aufbau“ | Anleitung §6; nur Anschlussstatus |

### F-G07-008 — Ausgangsrechnungen exportieren

**Auslöser:** Nach Formatfreigabe wählt eine berechtigte Person Zeitraum und Exportformat.

**Personen:** Alle mit persönlicher Exportfähigkeit; Admin kann sperren. Vor Steuerberater-Freigabe niemand.

**Schritte:**

1. Bis Q-G07-002 geschlossen ist, existiert nur das nicht klickbare Element.
2. Später liest G07 ausschließlich immutable Invoice-Snapshots/Events im Tenant und prüft Zeitraum sowie Berechtigung.
3. Versionierter Formatierer erzeugt deterministisch CSV und/oder DATEV einschließlich Storno/Skonto nach freigegebenem Mapping.
4. Export erhält technischen Receipt/Hash und wird durch Golden File plus Steuerberater-Import geprüft.

**Ergebnis + Receipt/Readback:** Derzeit keines. Später Exportdatei, Formatversion, Hash, Zeitraum, Actor und Anzahl; keine Buchungsmutation.

**Fehlerfälle:** Format nicht freigegeben, inkonsistente Rechnung, fremder Tenant, Zeitraum ungültig, Generator/Hash fehlerhaft.

**Sperren/Konflikte:** `K-G07-008`; Q-G07-002.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Kein produktiver Export bis Formatfreigabe | FEHLT → Q-G07-002 | MODULKARTE; Plan T-10 |
| lädt | Kein Lade-/Erfolgssimulator | „Export Ausgangsrechnungen — In Klärung“ | OE-2609-04; Q-G07-002 |
| leer | Keine Datei/Null-CSV erzeugen | „Export Ausgangsrechnungen — In Klärung“ | Q-G07-002 |
| Fehler | Keine falsche NOT_AVAILABLE-Aktion | „Export Ausgangsrechnungen — In Klärung“ | Q-G07-002 |
| gesperrt | Element nicht klickbar, keine Route | „Export Ausgangsrechnungen — In Klärung“ | Anleitung §6 |
| In Klärung | Format wartet auf Steuerberater | „In Klärung“ | Q-G07-002 |
| In Aufbau | Nach Freigabe während realem Bau | „In Aufbau“ | Anleitung §6 |

### F-G07-009 — ZUGFeRD-E-Rechnung erzeugen

**Auslöser:** Später automatisch mit Rechnungsausstellung, sobald Q-G07-001 geschlossen und der Vertrag abgenommen ist.

**Personen:** Dieselbe persönliche Fähigkeit wie Rechnungsausstellung; keine separate Fake-Aktion.

**Schritte:**

1. Bis zur Freigabe bleibt das Element nicht klickbar und die vorhandene PDF-Rechnung wird nicht als E-Rechnung bezeichnet.
2. Später erzeugt derselbe Invoice-Command XML aus demselben Snapshot und bettet es in das Rechnungs-PDF ein.
3. Schema-/Business-Rule-Validator, PDF-Validator, Hash und Feldvergleich laufen vor Erfolgs-Receipt.
4. Storno-/Korrekturdokument folgt demselben versionierten Vertrag.

**Ergebnis + Receipt/Readback:** Derzeit keines. Später unveränderliche validierte PDF-/XML-Bytes, Hashes, Profil-/Versionsangabe und Receipt im kanonischen Invoice-Vertrag.

**Fehlerfälle:** Mapping-/Rundungsdifferenz, Validatorfehler, fehlende Pflichtangabe, Hash-/Einbettungsfehler; keine Rechnungs-Erfolgsmeldung bei Fehler.

**Sperren/Konflikte:** `K-G07-006`, `K-G07-008`; Q-G07-001/Q-G07-007.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Kein ZUGFeRD-Erfolg vor Vertrag/Validator | FEHLT → Q-G07-001 | OE-2609-14; Plan T-09 |
| lädt | Kein Fake-Ladevorgang | „E-Rechnung — In Klärung“ | Q-G07-001 |
| leer | Kein leeres XML/PDF erzeugen | „E-Rechnung — In Klärung“ | Q-G07-001 |
| Fehler | Fehlertext wird erst mit Vertrag festgelegt | FEHLT → Q-G07-001 | Q-G07-001 |
| gesperrt | Element nicht klickbar, keine Route | „E-Rechnung — In Klärung“ | Anleitung §6 |
| In Klärung | Profil/Validator/Felder offen | „In Klärung“ | Q-G07-001 |
| In Aufbau | Nach Freigabe während echtem Bau | „In Aufbau“ | Anleitung §6 |

### F-G07-010 — Kartenterminal ansteuern

**Auslöser:** Später wählt eine Person bei Abholung `Karte`, nachdem M01-Adapter und Owner-Gate bestanden sind.

**Personen:** Alle mit persönlicher Kassierfähigkeit; Admin kann sperren. Bis zum Gate niemand über Terminal.

**Schritte:**

1. Bis Q-G07-005 geschlossen ist, bleibt das Terminal-Element nicht klickbar; manuelle Kassenbestätigung bleibt der echte Weg.
2. Später sendet G07 nur eine idempotente Payment-Absicht an den app-neutralen `PaymentAdapter`.
3. Der Adapter handhabt Provider-Auth, Betrag, Terminal, Timeout, Retry und Provider-Readback serverseitig.
4. Erst ein verifizierter Provider-Readback darf `confirmPayment` mit stabiler Korrelation auslösen.

**Ergebnis + Receipt/Readback:** Derzeit nur manuelles `PAYMENT_CONFIRMED_V1`. Später Provider-Receipt plus kanonisches Payment-Receipt/Reload; Provider besitzt nie den G07-Zahlungsstand.

**Fehlerfälle:** Adapter/Terminal offline, Betrag abweichend, Timeout/unklarer Ausgang, Ablehnung, doppelter Callback, Owner-Gate fehlt.

**Sperren/Konflikte:** `K-G07-002`, `K-G07-005`, `K-G07-009`; Q-G07-005.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Kein produktiver Terminalweg vor M01-Gate | FEHLT → Q-G07-005 | OE-2609-12 |
| lädt | Kein simuliertes Terminal | „Kartenterminal — In Aufbau“ | OE-2609-12 |
| leer | Kein Terminal gewählt/verbunden | „Kartenterminal — In Aufbau“ | OE-2609-12 |
| Fehler | Kein Providerfehler ohne Provider | „Kartenterminal — In Aufbau“ | OE-2609-12 |
| gesperrt | Gedämpft, nicht klickbar, keine Route | „Kartenterminal — In Aufbau“ | Anleitung §6 |
| In Klärung | Anbieter/Kosten/Secrets offen | „In Klärung“ | Q-G07-005 |
| In Aufbau | M01-Anschlussstatus | „In Aufbau“ | OE-2609-12 |

### F-G07-011 — Aufbewahrung prüfen und Anonymisierung freigeben

**Auslöser:** Ein versionierter Retention-Read meldet nach Mindestfrist und berücksichtigter Ablaufhemmung einen prüfbaren Vorschlag; es gibt keinen stillen Zeitjob mit Löschwirkung.

**Personen:** Rolf prüft den fachlichen Vorschlag; eine persönlich berechtigte Admin-Person gibt eine Anonymisierung frei. Ohne beide belegten Schritte erfolgt keine Änderung.

**Schritte:**

1. G10 liefert Dokumentart, mindestens acht Jahre Aufbewahrung für Rechnungen/Buchungsbelege, Beginn, Ablaufhemmung und nächste Prüfbarkeit über einen app-neutralen Port.
2. G07 liefert nur die betroffenen kanonischen Belegreferenzen; Originalrechnung, Snapshot und Hash werden niemals still geändert oder gelöscht.
3. Ein fälliger Fall erzeugt einen auditierten Vorschlag mit Actor, Grund, Umfang und vorhersehbarer Wirkung.
4. Admin prüft/freigibt bewusst; der spätere Anonymisierungs-Command muss Personenbezug entfernen, Geschäftszahlen erhalten und Receipt plus Reload-Readback liefern.
5. Steuerberater/Datenschutz bestätigen Fristen und das Verfahren für Originaldokument versus anonymisierte Geschäftsprojektion vor Live.

**Ergebnis + Receipt/Readback:** Derzeit keines. Später versionierter Vorschlag, Admin-Freigabe, Audit und Anonymisierungs-Receipt. Bis zur freigegebenen Wirkung bleiben Originalbytes unverändert; danach müssen Personenbezug entfernt und Geschäftszahlen erhalten sein. Ob das Original dann vollständig gelöscht oder anders gesetzeskonform behandelt wird, entscheidet Q-G07-009 — niemals per In-place-Umschreiben.

**Fehlerfälle:** Frist/Ablaufhemmung unklar, Steuerberater-/Datenschutz-Gate fehlt, Person nicht berechtigt, Freigabe fehlt, Personenbezug nicht vollständig entfernbar, Geschäftszahlen würden verloren gehen oder das Original würde unzulässig in-place verändert.

**Sperren/Konflikte:** `K-G07-011`; Q-G07-009.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Noch keine aktive G07-Verwaltungsfläche; spätere Vorschlagsliste benötigt Vertrag | FEHLT → Q-G07-009 | OE-2609-20 |
| lädt | Kein stiller Job/Spinner mit Löschwirkung | „Aufbewahrung — In Klärung“ | Q-G07-009 |
| leer | Kein fälliger Vorschlag bedeutet keine Aktion | FEHLT → Q-G07-009 | OE-2609-20; bis dahin keine Fläche |
| Fehler | Keine Änderung ohne eindeutigen Policy-Readback | „Aufbewahrung — In Klärung“ | Q-G07-009 |
| gesperrt | Keine Löschung/Anonymisierung ohne Admin-Freigabe | „Aufbewahrung — In Klärung“ | OE-2609-20; Q-G07-009 |
| In Klärung | Policy-/Audit-Vertrag und externe Werteprüfung offen | „In Klärung“ | Q-G07-009 |
| In Aufbau | Nach Vertragsfreigabe während echtem Bau | „In Aufbau“ | Anleitung §6 |

## Funktionsübergreifende No-Guess-Regel

Ein `FEHLT → Q-G07-…` ist kein Auftrag, Text oder Datenmodell selbst zu bestimmen. Der betreffende Teil bleibt exakt im angegebenen Status nicht klickbar. Die bereits gebauten manuellen Kernwege werden nicht durch Platzhalter, Demoantworten oder lokale Erfolgszustände ersetzt.

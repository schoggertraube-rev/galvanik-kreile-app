<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 05 — Regeln, Sperren und Konflikte

## 1. Sperren (vorbeugend)

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| Serverbestimmte Identität, Tenant und persönliche Fähigkeit | fremde Daten, Client-Rolleneskalation, anonyme Commands | Server/DB | G01; D-ARCH-009; Authorization in F1.4/F1.5 | GEBAUT für Tenant/Rollen; SPEZ für persönliche OE-2609-09-Rechte |
| Nur fertiger, versionierter Freeze mit vollständigen Quellen | Rechnung aus unfertigem/verändertem Auftrag oder unvollständigen Daten | Server/DB | F1.4-Command; `v_invoice_issue_source_v1/v2` | GEBAUT |
| Nummer erst nach allen Vorprüfungen | Lücke durch Validierungs-/PDF-Vorabfehler | Server/DB | F1.4-Bauvertrag; `allocate_invoice_number` | GEBAUT |
| Eine aktive Rechnung je Auftrag und Freeze | doppelte aktive Rechnung | Server/DB | F1.4 Unique-Indizes + Command | GEBAUT |
| Immutable Snapshot/PDF + Hash | nachträgliche Änderung/Löschung ausgestellter Rechnung | DB | `guard_f1_4_invoice_update/delete`; PDF-Hashchecks | GEBAUT |
| Kreile-USt ausschließlich 19 Prozent | unzulässige 7-Prozent-Rechnung | Server/DB | A-G07-006; Ist erlaubt 7/19 | FEHLT |
| Kundenfreigabe vor `rechnung` | Zielrechnung für nicht freigeschalteten Kunden | UI/Server/DB | OE-2609-11; Q-G07-003 | FEHLT |
| Zahlungsstandard nach Übergabeart | freie/abweichende Wahl entgegen Abholung→bar/Karte, sonst Vorkasse | UI/Server | OE-2609-07 | SPEZ; Ist-Code erlaubt alle drei Modi frei |
| Erwartete Version + stabile `clientEventId` | Doppelwirkung und Lost Update bei Rechnung, Zahlung, Modus, Ausgang, Storno | Server/DB | F1.4/F1.5 Commands/Unique-Indizes | GEBAUT |
| Payment-Invariante: bezahlt + offen = brutto | unklare oder negative Zahlungssumme | Server/DB | F1.5 Constraints; `paymentContract.ts` | GEBAUT |
| Keine Überzahlung | Zahlung über offenen Betrag | Server | `confirmPaymentCommand.ts` | GEBAUT |
| Vorkasse nur vollbezahlt ausgeben | Ware ohne Vorkasse | UI/Server/DB-View | D-F15-001; `v_goods_out_ui_state_v1` | GEBAUT |
| Abholung nur nach bestätigtem bar/Karte | Ware ohne Kassieren-Bestätigung | UI/Server/DB-View | OE-2609-07/12 | SPEZ; Ist-Gate verlangt bezahlt, Zieltext/-auswahl fehlt |
| Zielrechnung nur mit Kundenfreigabe vor Rechnung ausgeben | ungedeckter freier `rechnung`-Modus | UI/Server/DB-View | OE-2609-11; D-F15-003 | FEHLT |
| Zahlungsmodus nach Warenausgang unveränderlich | rückwirkende Gate-Manipulation | Server/DB | `setPaymentModeCommand.ts`; F1.5 Events | GEBAUT |
| Storno nur bei vollständig unbezahltem, konsistentem Zustand | Storno nach Teil-/Vollzahlung oder bei Alt-/Nullzustand | Server | `hasClearlyUnpaidPaymentState` | GEBAUT |
| Storno-Payment-Gate als zweite Schicht | Umgehung des App-Checks durch direkten DB-Updatepfad | DB | OP-06; `guard_f1_4_invoice_update` prüft Payment nicht | FEHLT — P0 vor Live |
| Originalfelder beim Storno unverändert | manipuliertes Original oder Hash | DB | F1.4 Update-Guard vergleicht alle Nicht-Stornofelder | GEBAUT |
| Standalone-Rechnungsformular ohne Produktweg | zweite Erstellwahrheit/Stub-Sackgasse | UI/Route | MODULKARTE; Plan T-13 | GEPLANT |
| ZUGFeRD/Export/Zielrechnung bei offenem Vertrag nicht klickbar | erfundene Formate, Scheindownload, falscher Erfolg | UI/Server | Q-G07-001/002/003/006; Anleitung §6 | SPEZ |
| Terminal ohne M01-Adapter nicht klickbar | Fake-Terminal oder unbestätigte Providerzahlung | UI/Server | OE-2609-12; Q-G07-005 | SPEZ |
| Keine Shadow-Tabellen als Fallback | zweite Rechnungs-/Zahlungswahrheit | Server/DB/CI | F1.5-Migration; D-ARCH-009; `11` | SPEZ; CI-Negativtest fehlt |
| Keine fremden Zielapp-Ressourcen | Daten-/Secret-/Kontenvermischung | HostAdapter/Server/CI | Owner-Nachtrag 2026-09-26 | SPEZ |
| Acht Jahre Mindestfrist plus steuerliche Ablaufhemmung | vorzeitige Löschung/Anonymisierung von Rechnung oder Buchungsbeleg | Server/Policy-Read/DB | OE-2609-20; OP-13 | SPEZ; Port fehlt |
| Vorschlag + Admin-Freigabe, niemals still | zeitgesteuerte oder unbeaufsichtigte Löschwirkung | UI/Server/Audit | OE-2609-20; Q-G07-009 | SPEZ; Command fehlt |
| Originalbeleg bis zur freigegebenen Retention-Wirkung unverändert; Geschäftszahlen danach erhalten | vorzeitige/in-place Dokumentänderung oder Verlust der anonymisierten Langzeitanalyse | Server/DB | OE-2609-20; F1.4-Unveränderlichkeit | SPEZ; Originalbehandlung nach Frist offen |

## 2. Konflikte

`Anzeigeort` bezeichnet die Zielprojektion; die technische Projektion in G02/G09 ist noch zu bauen. Die Domänensperre kann bereits GEBAUT sein, ohne dass die Startseitenanzeige existiert.

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-G07-001 | Warenausgang bei Vorkasse ohne Vollzahlung | Payment-Readback `openAmountCents > 0` oder Status nicht `bezahlt` | Rolf | Rolf › Der Tag › Handlungsbedarf | Zahlung real bestätigen oder Warenausgang abbrechen; kein Override | GEBAUT (Gate) / FEHLT (Anzeige) |
| K-G07-002 | Abholung ohne bestätigte Bar-/Kartenzahlung | Modus `abholung`, Status nicht `bezahlt` oder Methode nicht bar/Karte | Phillip | Phillip › Heute sichern › Ware raus | Kassenbestätigung durchführen; Terminal erst nach M01-Gate | SPEZ (Gate-Text/Regel) / FEHLT (Anzeige) |
| K-G07-003 | `rechnung` gewählt, aber Kundenfreigabe fehlt/ist unklar | `CustomerBillingProfilePort` liefert false/kein valides versioniertes Readback | Rolf | Rolf › Der Tag › Handlungsbedarf | Admin/Rolf klärt Freigabe; bis dahin auf Vorkasse/Abholung setzen | FEHLT — Q-G07-003 |
| K-G07-004 | Storno bei Teil-/Vollzahlung oder inkonsistentem Zahlungsstand | `hasClearlyUnpaidPaymentState=false`; künftig identische DB-Invariante | Rolf | Rolf › Der Tag › Konflikte Geld | Storno blockiert lassen; Zahlung/Altzustand fachlich klären, nie per UI überschreiben | GEBAUT (App) / FEHLT P0 (DB + Anzeige) |
| K-G07-005 | Veraltete Version oder bereits anders verwendete `clientEventId` | Expected-Version-/Idempotenzvergleich | Rolf bei Geld; Phillip bei Warenausgang | jeweilige Startseite › Konflikte | kanonischen Readback neu laden; bei identischem Intent Replay, sonst neuen bewussten Vorgang starten | GEBAUT (Command) / FEHLT (Anzeige) |
| K-G07-006 | Rechnungsausgabe mit unvollständigen Firmen-/Kunden-/Positionsdaten | Invoice-Source-Integrität false | Rolf | Rolf › Der Tag › Handlungsbedarf | Stammdaten in G05/G10 vervollständigen, Freeze neu prüfen, dann erneut ausstellen | GEBAUT (Gate) / FEHLT (Anzeige) |
| K-G07-007 | Versand/Abrechnung ohne vollständige Kundenadresse | G05-Port liefert Straße/PLZ/Ort unvollständig | Rolf | Rolf › Der Tag › Handlungsbedarf | Kundenadresse ergänzen und Readback bestätigen | GEBAUT für Rechnung / SPEZ für gemeinsame Anzeige |
| K-G07-008 | Readback, Receipt, PDF-Hash oder View-Integrität stimmt nicht | feldgenauer Receipt-/Reload-/Hashvergleich | Rolf | Rolf › Der Tag › Konflikte Geld | keinen Erfolg zeigen; neu laden; bei Fortbestand technischer Support/Audit | GEBAUT (fail-closed) / FEHLT (Anzeige) |
| K-G07-009 | Terminal offline, Timeout oder Providerstatus unklar | späterer `PaymentAdapter` liefert nicht eindeutig bestätigt | Phillip; Rolf bei Zahlungsabweichung | Phillip › Heute sichern › Ware raus; ggf. Rolf › Konflikte Geld | keine Zahlung buchen; Adapter-Readback wiederaufnehmen oder manuelle freigegebene Kassenbestätigung | GEPLANT — Q-G07-005 |
| K-G07-010 | ZUGFeRD- oder Exportvalidator meldet Feld-/Summendifferenz | XML/PDF-/Golden-File-Validator | Rolf | Rolf › Der Tag › Konflikte Geld | Ausgabe/Export blockieren, Snapshot unverändert lassen, Mapping korrigieren und neu validieren | GEPLANT — Q-G07-001/002 |
| K-G07-011 | Aufbewahrungsfrist/Ablaufhemmung oder Umfang des Personenbezugs ist unklar | `RetentionPolicyPort` liefert keinen eindeutigen versionierten Readback | Rolf (fachlich), Gregor nur für Admin-Freigabe | Rolf › Der Tag › Konflikte Geld; Admin › Einstellungen | keine Änderung; Steuerberater/Datenschutz klären, danach neuer Vorschlag und bewusste Admin-Freigabe | GEPLANT — Q-G07-009 |

## 3. Unverhandelbare Auflösungsschranken

- Keine Konfliktkarte darf eine „trotzdem ausführen“-Aktion anbieten.
- Rolf löst Geld-, Freigabe-, Stamm- und Dokumentkonflikte; Phillip löst den operativen Ausgang nach erfülltem Gate. Gregor betreibt nur technische Administration und erhält keine stillschweigende fachliche Zahlungsentscheidung.
- Eine Startseitenprojektion besitzt nicht die Fachwahrheit; sie verweist auf kanonischen Readback und verschwindet erst nach belegter Auflösung.
- `LIVE = NO_GO`, solange K-G07-004 nicht auch auf DB-Ebene geschlossen und real negativ getestet ist.
- Eine Aufbewahrungs-/Anonymisierungsroutine darf niemals Originalrechnung, PDF-/XML-Hash oder Geschäftszahlen still verändern; bis zur freigegebenen Wirkung bleibt das Original unverändert, danach gilt der extern bestätigte Vertrag aus Q-G07-009.

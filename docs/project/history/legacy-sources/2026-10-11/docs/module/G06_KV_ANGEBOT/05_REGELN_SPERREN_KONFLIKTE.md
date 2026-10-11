<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G06 KV / Angebot — Regeln, Sperren und Konflikte

## 1. Sperren (vorbeugend)

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| S-G06-001: Capability vor jeder Aktion | unberechtigte Anlage, Änderung, Lektüre oder Conversion | UI + Server | `quotes.actions.ts`; `QuoteCommandCapabilities` | GEBAUT; Personenmodell GEPLANT |
| S-G06-002: Tenant aus Session, nie aus Client | Fremdtenant-Zugriff | Server + DB | `resolveAuthorization`; tenantgebundene Transaktion/FKs | GEBAUT |
| S-G06-003: strikte Eingabeform | unbekannte Felder und manipulierte Absicht | Server | Exact-Key-/UUID-/Datumsvalidierung in `quoteCommands.ts` | GEBAUT |
| S-G06-004: 1–20 Positionen und Feldgrenzen | leere/unbegrenzte oder technisch schädliche KVs | UI + Server + DB | Types/Commands/DB-Checks | GEBAUT |
| S-G06-005: Cent-Beträge und DB-Zeilensumme | Rundungs-/Client-Manipulation | Server + DB | `unit_price_cents`, generated `line_total_cents` | GEBAUT |
| S-G06-006: keine Fake-Vorschläge | erfundene Positionen, Preise oder Termine | UI + Host-Port | D-USP-001; Digest KOORD_late P2 | SPEZ |
| S-G06-007: idempotente Client-Kennung + Intent-Hash | Doppelanlage und veränderte Wiederholung | Server + DB | Unique `(tenant,actor,client_event_id)`; Receipts | GEBAUT |
| S-G06-008: Optimistic Lock `expectedVersion` | Lost Update | Server + DB | Update-/Conversion-Commands, Versionschecks | GEBAUT |
| S-G06-009: append-only Positionsrevision | stilles Überschreiben der KV-Historie | DB | Migration `20260916090000…` | GEBAUT |
| S-G06-010: bestehender Kunde per Tenant-FK | verwaister/fremder KV | Server + DB | `quotes_customer_fkey` | GEBAUT |
| S-G06-011: Wunschtermin ≠ Zusagetermin | falsches Auftragsversprechen | UI + Server | `ConvertQuoteInput.confirmedOrderDueDate` | GEBAUT |
| S-G06-012: Conversion-Request je Quote unique | zwei konkurrierende Zuschläge | DB | Unique `(tenant_id,quote_id)` | GEBAUT |
| S-G06-013: Award erst nach F1.1-Erfolg | KV als beauftragt ohne Auftrag | Server + DB | Konsum `ORDER_INTAKE_CREATED_V1`; Integrationstest | GEBAUT |
| S-G06-014: Conversion-Receipt je Quote/Order unique | mehr als ein verknüpfter Auftrag | DB | Unique Quote und Order in Conversion-Receipts | GEBAUT |
| S-G06-015: Versand ohne Gate nicht klickbar | Fake-Versand/Provider-Fallback | UI + Adapter | OE-2609-04; Q-G06-002/-003 | SPEZ |
| S-G06-016: Zusatzdetails ohne Vertrag gesperrt | Schattenfelder für Zahlung/Eingangsart/Express | UI + Adapter | Q-G06-001 | SPEZ |
| S-G06-017: direkte KV-Alt-Routen 404 | parallele fachliche Wahrheit | Routing | Evidence Work Unit 2; MODULKARTE | GEBAUT |
| S-G06-018: Erfolg nur mit Receipt+Readback | scheinbarer Erfolg bei unklarem Ausgang | UI + Server | D-RES-001; Actions/GlobalCreateFlow | GEBAUT |
| S-G06-019: unveränderliche Events/Receipts | nachträgliche Beweismanipulation | DB | Guard-Trigger und REVOKE in Quotes-Migrationen | GEBAUT |

## 2. Konflikte

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-G06-001 | KV wurde seit Öffnen geändert | `expectedVersion` passt nicht | Rolf | `Der Tag › Handlungsbedarf` | aktuellen Stand öffnen, Änderungen bewusst erneut anwenden; nie auto-merge | GEBAUT (Erkennung), FEHLT (Anzeige) |
| K-G06-002 | Ausgang von Speichern/Zuschlag nach Timeout unbekannt | kein bestätigter Receipt-Readback | Rolf | `Der Tag › Handlungsbedarf` nach ungelöster Statusprüfung | mit derselben Kennung Receipt/Readback prüfen; erst danach explizites idempotentes Retry | GEBAUT (lokale Rettung), FEHLT (Anzeige) |
| K-G06-003 | gleiche Kennung mit anderer Absicht wiederholt | Intent-Hash weicht ab | Rolf | `Der Tag › Handlungsbedarf` | Originalnachweis öffnen; neue fachliche Absicht erhält neue Kennung | GEBAUT (Erkennung), FEHLT (Anzeige) |
| K-G06-004 | parallele Zuschläge oder bereits konvertierter KV | Unique Conversion-Request/Receipt oder Status `converted` | Rolf | `Der Tag › Handlungsbedarf` nur wenn Link/Outcome unklar | Conversion-Receipt und verknüpften Auftrag öffnen; keinen zweiten Auftrag anlegen | GEBAUT (Sperre), FEHLT (Anzeige) |
| K-G06-005 | Kunde fehlt, gehört anderem Tenant oder wurde unzugänglich | tenantgebundener Customer-FK/Read-Port | Rolf | `Der Tag › Handlungsbedarf` | korrekten Kunden wählen; kein Auto-Merge/keine Fremdübernahme | GEBAUT (Sperre), FEHLT (Anzeige) |
| K-G06-006 | Preis-/Mengenbasis ist vor Versand unvollständig | Validierung/Dokument-Gate | Rolf | `Der Tag › Handlungsbedarf` erst nach Dokumentmodul | KV öffnen, Positionen korrigieren und neue Version sichern | SPEZ; Versand FEHLT |
| K-G06-007 | Person wurde für eine KV-Capability gesperrt | G01 Authorization-Snapshot | Gregor | `Einstellungen › Rechte` | personenbezogene Sperre prüfen/ändern; keine Rollenannahme im G06-Kern | GEPLANT |

Lokale Pflichtfeldfehler sind keine Startseitenkonflikte: Sie bleiben am Formular und verwerfen keine Eingabe. „In Aufbau“ ist ebenfalls kein Fehler, sondern ein nicht klickbarer, ehrlicher Produktzustand.

## 3. Fachregeln

1. `draft` ist der einzige bearbeitbare Status; `converted` ist final.
2. Der KV-Wunschtermin ist nicht bindend. Ein Auftrag entsteht nur mit eigenem bestätigten Termin.
3. Der Quote-Kern legt keinen Auftrag direkt an; er nutzt genau den bestehenden G04/F1.1-Port.
4. Die Zahlungsregel ist Kreile-Hostlogik: Abholung bedeutet bar oder Karte, sonst Vorkasse; Rechnung auf Ziel nur bei Kundenfreigabe.
5. Keine Löschung, kein Dual Write, kein Shadow-Status und kein Provider-Fallback.
6. Ein wiederverwendeter Wert muss auf eine reale Quelle verweisen, sichtbar editierbar sein und vom Mitarbeiter bestätigt werden.
7. Technische Kennungen stehen nur in aufklappbaren Supportdetails; Mitarbeitertexte bleiben fachlich.
8. Ungelöste fachliche Konflikte werden G09 übergeben, nicht in einem zweiten G06-Konfliktspeicher dupliziert.


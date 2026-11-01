# ABGABE AP-01 – Eingang, Kanal Paket/persönlich, Fassung 4.2

Stand: 01.11.2026, Korrektur Fassung 4.2 einschließlich Punkte 6–9 und echter Namenssuche

Branch: `kreile/b2-eingang` · PR: `#158` · kein Merge durch Codex

## 1. Produkt-SHA und exakte Preview

- Produkt-SHA: `1acf911800b3954ea7cb7e748317fe5b22fa6525`
- Basis: `8e1e03f567278d24d5f3a468f6cbef3729db96b9` (`origin/main`, #159)
- Exakte READY-Preview dieses Produkt-SHA:

  `https://galvanik-kreile-werkstatt-rgqxchogv.vercel.app`
- Vercel-Zustand: `READY`; Deployment-Metadaten nennen exakt den Produkt-SHA und PR `#158`.
- Kein Merge und kein Production-Deploy durch Codex.

## 2. Eine Erfassungs-, Kunden- und Auftragswahrheit

- `requestGlobalCreate` liegt kanonisch in `src/modules/eingang/requestGlobalCreate.ts`; die alten Layout-Pfade sind nur Re-Exports.
- `src/app/actions/eingang.actions.ts#erfasseAuftragAusEingangAction` ist die einzige AP-01-Schreibaktion.
- Die Auftragsanlage läuft ausschließlich über den bestehenden, unveränderten `createOrderIntake`.
- Drei idempotente Schritte verwenden denselben `clientKey`: `intake_item` anlegen, Auftrag anlegen/lesen, Eingang zuordnen und `intake_event` anhängen.
- Der alte Produktweg über `intake_drafts` ist entfernt; die Tabelle bleibt ohne zweiten Produktzugriff bestehen.
- Ein vollständiger Bestandskunde wird über seine ID verwendet. Gibt es keinen Treffer, öffnet AP-01 den bestehenden Dialog `Kunde anlegen` über der erhaltenen Erfassung; dessen einziger Schreibweg bleibt `createCustomerAction`.
- Ein unvollständiger Bestandskunde wird in Oberfläche und Server durch dieselbe reine Prüffunktion bewertet. Der Server antwortet vor dem ersten Schreiben mit `CUSTOMER_INCOMPLETE`. `Ansprechpartner` ist dabei ausschließlich für Firmen und Institutionen Pflicht; bei Privatkunden ist die Person selbst der Kontakt.
- Korrekturen erfolgen ausschließlich in der bestehenden Kundenkarte über `updateCustomerCommercialAction`; der Eingang zeigt keine lokalen PLZ-/Land- oder sonstigen Kundenfelder.
- Die für AP-K1 geplante Umbenennung von `getOrderReadiness` zu `kundeVollstaendigkeit` ist ausdrücklich nicht Teil von #158 und wird hier weder als Alias noch als zweite Funktion vorweggenommen.
- Eingangsart, Terminstatus, Übergabe und Zahlungsmodus starten leer. Zahlung bleibt gesperrt, bis eine Übergabe gewählt ist. Fehlende `intakeSource`/`termStatus` werden als `null` gespeichert, nicht still ersetzt.
- Erkannte Kundendaten gelten nicht als bestätigt: Telefon, E-Mail oder Name befüllen und starten nur die bestehende Kundensuche. Ein allein eingegebener Kundenname wird als Suchbegriff übernommen; bei Treffern erscheinen bis zu drei Vorschläge mit `· übernehmen`. `Kunde anlegen` bleibt während des Tippens sowie unter Treffern und unter `Kein Kunde gefunden` sichtbar.
- Ursache des Namensfehlers: Der bisherige realRender-Stub lieferte für jede Suchanfrage `Sabrina Schmidt` und belegte nur die Übergabe in der Oberfläche. Produktiv gab es keinen servergestützten Abgleich der Notizwörter gegen echte Kunden; der Client leitete lediglich einen Suchstring aus strukturiert erkannten Feldern ab. `findRecognizedCustomers` fragt jetzt ausschließlich die bestehende Serversuche `searchOrderIntakeCustomers` ab und filtert deren echte Treffer nach der BAUPLAN-Ganzwortregel (Wörter ab vier Zeichen, Rechtsformen ausgeschlossen, höchstens drei Vorschläge). Es gibt keinen zweiten Suchweg.
- Abbrechen, × und Esc schließen eine unveränderte Erfassung sofort. Bei Änderungen erscheint ausschließlich die Stufe-1-Rückfrage mit `Verwerfen` und `Weiter bearbeiten`; Verwerfen leert den gesamten Zustand und erzeugt einen neuen `clientKey`.
- Ein Mail-Eintrag in „Der Tag“ zeigt `Mail ansehen`, öffnet die bestehende Mailansicht und niemals den Eingangsdialog.
- `Wareneingang buchen` und der mobile Weiter-Knopf bleiben bedienbar. Bei fehlenden Angaben wird nichts geschrieben; die Oberfläche springt zur ersten offenen Prüflisten-Zeile und meldet `Noch offen: {Label}`. Während des Schreibens steht `Wird gebucht …`; ein zweiter Klick bleibt ohne Wirkung.
- Nach Erfolg schließt die Erfassung, meldet `Auftrag {Nummer} angelegt` und öffnet direkt die Auftragskarte. Der frühere Erfolgszwischenbildschirm ist entfernt.
- Die Kundenkarte öffnet für Ergänzungen als Ebene über der Erfassung. Rückkehr oder Speichern erhält alle Eingaben, liest den Kunden neu und prüft ihn erneut; Esc schließt nur die oberste Ebene.
- `Neuer Auftrag` aus der Kundenkarte öffnet dieselbe Erfassung mit gesetztem Kunden und sichtbarer Markierung `aus der Kundenkarte`.

## 3. Migration und Datenbankgleichstand

- Migration: `supabase/migrations/20261031212320_ap01_intake_item.sql`
- SHA-256: `308A6A1548E67147AD549923BF4C8B9C840B969A05B3447AD4A4BBBE388912B9`
- Die verknüpfte Dev-Datenbank und das Repository zeigen jeweils `66` Migrationen; letzter Zeitstempel jeweils `20261031212320`.
- Der frische lokale Replay wurde aus allen `66` Repo-Migrationen ohne Seed neu aufgebaut; Replay und Repository stehen ebenfalls `66/66`.
- Die Migration ist additiv. Für `intake_item` besteht kein DELETE-Recht; `intake_event` ist nur anhängbar.

## 4. Unveränderte Abnahmetests gegen die echte Replay-Datenbank

| Test | SHA-256 | Lauf |
|---|---|---|
| `src/test/acceptance/ap01_eingang_paket_persoenlich.integration.test.ts` | `BE54C2C5FD0F7B6EF707D8B81B00F542732395FE7AC6695EA86DB8E26627E48E` | einzeln, `3/3` grün |
| `src/test/acceptance/ap01b_eingang_bestandskunde_unvollstaendig.integration.test.ts` | `4B67978D5433D16395A7072E4B691F6AB5EF6B4A3F3D4D4C42131994120057A1` | einzeln, `2/2` grün |
| `src/test/acceptance/ap01c_eingang_kundenvorschlag.integration.test.ts` | `5D7FD9672EB10346C0569BFED39BBB1F0ADA6768B0F198630A7DB36BE3506A6D` | einzeln, `1/1` grün |

Alle drei Tests rufen echte Server-Actions mit signierter Sitzung gegen Loopback-Postgres auf. Es gibt keinen Action- oder Datenbank-Mock. Der dritte Test legt über `createCustomerAction` den Kunden `Sabrina Schmidt` an, prüft Kundenzeile und `CUSTOMER_CREATED_V1`, ruft die echte Erkennung sowie die bestehende Serversuche auf und verlangt den eben angelegten Kunden unter höchstens drei Vorschlägen.

### Datenbankbeleg aus diesem Lauf

| `client_key` | Auftrag | Kunde | `intake_item` | `intake_event` | Auftragsevent |
|---|---|---|---|---|---|
| `7305af0c-0879-4c88-b095-1d9ad644a614` | `A-2026-0001` | `AP01 Bestandskunde 97db7048` | `notiz`, `geraet`, `auftrag` | `angelegt`, `zugeordnet` | `ORDER_INTAKE_CREATED_V1`, `success` |
| `0216aa33-1ff1-48e1-81c9-95a4e6248bbe` | `A-2026-0002` | `AP01 Bestandskunde 97db7048` | `notiz`, `geraet`, `auftrag` | `angelegt`, `zugeordnet` | `ORDER_INTAKE_CREATED_V1`, `success` |
| `c9133a44-d186-4647-a2c6-649537d2c133` | `A-2026-0003` | `AP01B Schmidt 74c5c8fd` | `notiz`, `geraet`, `auftrag` | `angelegt`, `zugeordnet` | `ORDER_INTAKE_CREATED_V1`, `success` |

- Für alle drei Aufträge sind `intake_source` und `intake_term_status` in `private.order_intake_receipts` tatsächlich `null`, weil die Tests diese Felder nicht senden. Damit ist die fehlende stille Vorbelegung auf Server/DB-Ebene belegt.
- Der Idempotenzfall ruft dieselbe Action zweimal mit demselben `clientKey` auf und erhält denselben Auftrag/dasselbe `intake_item`; DB-Zähler bleiben jeweils `1`.
- Ohne Recht `eingang` bleiben `intake_item` und Receipt jeweils bei `0`.
- Der unvollständige Kunde `3013 Bern / Deutschland` führt zu `CUSTOMER_INCOMPLETE`, nennt `zipCode` und schreibt weder Eingang noch Auftrag.
- Nach Korrektur auf `Schweiz` über `updateCustomerCommercialAction` wird derselbe Kunde erneut gelesen; erst danach entstehen genau ein Eingang und genau ein Auftrag (`A-2026-0003`).

## 5. Prüfungen auf dem Produkt-SHA

Lokal vollständig grün:

- Authority-, Delivery-, Package-Scope- und Live-Regression-Gates jeweils mit Selbsttest
- Package-Scope gegen Basis `8e1e03f5…`, Kopf `1319b3d8…`, Branch `kreile/b2-eingang`
- Modul-Gates
- H18 mit Selbsttest: `247` Actions inventarisiert, `99` schreibend, `35` getestet, `64` bestehende Ausnahmen
- H16 mit Selbsttest
- No-fake-production mit Selbsttest: `0` erreichbare Produktions-Mocks, `0` unregistrierte sichtbare Fähigkeiten
- F0-Doku-Wahrheit mit Selbsttest und Supabase-Client-Grenze
- F0/F2-Schema mit Selbsttest: `10` SQL-Verträge grün
- `live:advance:selftest` und `live:close:selftest`
- `git diff --check origin/main`: leer
- TypeScript: grün
- ESLint: `0` Fehler; sechs bereits vorhandene Warnungen ausschließlich in `docs/project/endversion/werkzeuge/bauplan.mjs`
- Zielgerichtete Fassung-4.2-Abnahme: `35/35` realRender-Tests grün
- Unit: `133` Dateien, `1064` Tests grün
- Produktions-Build: grün
- Replay-Abnahme: `3/3` plus `2/2` plus `1/1` grün

Remote auf dem Produkt-SHA:

- Vercel: `SUCCESS`, exaktes Deployment `READY`
- Ratchet: `SUCCESS`
- Quality: `SUCCESS`
- Fresh Supabase replay: `SUCCESS`
- Agentur-Gate: beide ausgelösten Läufe `SUCCESS`
- H16-Schema: beide ausgelösten Läufe `SUCCESS`
- Vercel Preview Comments: `SUCCESS`
- Nach dem separaten Abgabe-Commit wird dieselbe Remote-Liste auf dessen Kopf erneut abgewartet; der Produktkandidat bleibt dabei unverändert.

## 6. Änderung an `src/lib/auth/authorizationContract.ts`

Alt: `Neuer Eingang & Kunde anlegen`

Neu: `Neu erfassen & Kunde anlegen`

Begründung: sichtbare Umbenennung der bestehenden AccessArea `eingang`. Bereich, Rollenmodell und Serverautorisierung bleiben unverändert. AP-01 benötigt für die Auftragsanlage `eingang`; das Recht `geld` steuert ausschließlich die geldbezogene Vollständigkeitsprüfung und Felder.

## 7. Geänderte Assertions in bestehenden Tests/E2E: alt → neu

### 7.1 Sichtbare Bezeichnung

| Datei / Assertion | Alt | Neu |
|---|---|---|
| `e2e/f1-4-immutable-invoice.real.spec.ts` | Heading `Neuer Eingang` | Heading `Neu erfassen` |
| `e2e/path1-ui-convergence-v5-global-create.spec.ts` | Button und Heading `Neuer Eingang` | Button und Heading `Neu erfassen` |
| `e2e/path1-ui-convergence-v5-p3.real.spec.ts` | Hub-Button, Hub-Dialog, Stationsdialog, Rolf-Button und Rolf-Heading `Neuer Eingang` | alle fünf auf `Neu erfassen` |
| `w2cB2m5j.unavailable.realRender.test.tsx` | fünf Sichtbarkeits-/Nicht-Sichtbarkeitsassertionen `Neuer Eingang` | dieselben fünf Assertions `Neu erfassen` |
| `RolfHome.realRender.test.tsx` | leere/gefüllte Zustände prüfen `Neuer Eingang` | dieselben Zustände prüfen `Neu erfassen` |
| `w2cHeaderTruth.realRender.test.tsx` | Titel `Neu anlegen` | Titel `Neu erfassen` |
| `WerkstattView.singleProjection.test.tsx` | Button `Neuer Eingang` | Button `Neu erfassen` |

### 7.2 `path1GlobalCreateFlow.realRender.test.tsx`

| Nr. | Alt | Neu / gleichwertiger Ersatz |
|---:|---|---|
| 1 | Haupttrigger `Anlegen` | Haupttrigger und Dialog `Neu erfassen` |
| 2 | Mail-Dialog im globalen Flow | `Aus Mail` ist in AP-01 nicht vorhanden |
| 3 | Mail-Kunde vorausgewählt | Bestandskunde wird ausschließlich über `Kunde suchen` gewählt |
| 4 | Mail konnte aus dem Eingang Kunden/Aufträgen zugeordnet werden | Mailzuordnung bleibt im vorhandenen Mail-Port; kein zweiter Eingangsschreibweg |
| 5 | Alter `intake_drafts`-Entwurf wurde gelesen/abgewählt | kein Entwurf und kein Text „wieder aufgenommen“ |
| 6 | Foto/Datei waren aktive Altanschlüsse | Foto-Kachel ist `aria-disabled=true`, Kamera vorhanden; Dateiweg fehlt |
| 7 | Leere Kundensuche bot keinen Kundenanlage-CTA im Eingang | `Kunde anlegen` öffnet den bestehenden Kundendialog über der erhaltenen Erfassung |
| 8 | Direkteingang erwartete `{ mode: NEW, name }` | exakt `{ mode: EXISTING, customerId }` |
| 9 | Texterkennung zeigte erkannte Kundendaten als bestätigt und ließ die Kundensuche leer | PLZ/Ort erscheinen nicht als bestätigt; die Suche wird mit dem erkannten Namen vorbelegt und ausgelöst |
| 10 | Freitext-Auftrag legte Inline-Kunden an | Freitext-Auftrag verwendet den ausdrücklich gewählten Bestandskunden |
| 11 | Manuelle Vollständigkeits-Checkbox | echte Prüfliste; vollständig `9 von 9`, Action genau einmal |
| 12 | Hauptknopf war bei fehlenden Pflichtfeldern deaktiviert | Hauptknopf bleibt klickbar; ohne Pflichtangabe erfolgt kein Schreibaufruf, stattdessen Sprung/Fokus und `Noch offen: {Label}` |
| 13 | Zahlungsmodus startete mit einem Wert | startet leer |
| 14 | Übergabe setzte Zahlungsmodus automatisch | Zahlung bleibt leer; Nutzerwahl ist erforderlich |
| 15 | Zielkunde setzte `rechnung` automatisch | keine automatische Zahlungsentscheidung |
| 16 | Aufruf/Kundenhistorie setzte Übergabe | alle Übergabe-Knöpfe starten ungewählt |
| 17 | Aufruf/Kundenhistorie setzte Eingangsart | Eingangsart startet leer |
| 18 | Terminstatus war vorausgewählt | alle Terminstatus-Knöpfe starten ungewählt |
| 19 | Zahlungsmodus war trotz fehlender Übergabe bedienbar | leer und deaktiviert, bis Übergabe gewählt ist |
| 20 | Oberfläche startete mit Ersatzwert | Oberfläche startet leer |
| 21 | erreichbarer Termin wurde automatisch Pflichtwert | Liefertermin bleibt leer; Vorschlag nur nach ausdrücklichem Klick |
| 22 | Preisvorschlag und Preisübernahme sichtbar | kein erfundener Preisvorschlag; nur Terminvorschlag bleibt |
| 23 | Ohne Geldrecht wurde die alte Gruppe `Art` geprüft | Anliegen zeigt `Auftrag`; alte Art-Gruppe und Preisfelder fehlen |
| 24 | Fehlerfall hielt Inline-Neukunden sichtbar | ausgewählter Bestandskunde bleibt sichtbar; kein falscher Erfolg |
| 25 | Veränderte Erfassung schloss ohne Stufe-1-Verwerfentscheidung | `Abbrechen` öffnet exakt `Verwerfen`/`Weiter bearbeiten`; nach Verwerfen öffnet das Plus eine vollständig leere Erfassung |
| 26 | Test änderte PLZ/Land lokal im Eingang | unvollständiger Kunde zeigt konkreten Grund; PLZ/Land fehlen als Eingabefelder |
| 27 | Lokaler `updateCustomer`-Port war vorhanden | kein Kunden-Write-Port im Eingang |
| 28 | Unvollständiger Kunde konnte im Dialog korrigiert werden | `Wareneingang buchen` gesperrt; `In Kundenkarte ergänzen` ruft `openCustomer(customerId)` |
| 29 | Zahlungs-/Übergabe-Test prüfte nur, dass Kundenzahlungsziel unverändert bleibt | F4-Test prüft serverkonforme Sperre bei `3013 Bern / Deutschland`, keine lokalen Felder und Kundenkarten-Rückweg |
| 30 | Kein Test für die Kundenanlage über einer laufenden Erfassung | bestehender Kundendialog liegt über der Erfassung; nach Speichern ist der neue Kunde gesetzt und die vorhandene Position erhalten |
| 31 | Privat- und Firmenkunden ohne Ansprechpartner wurden gleich behandelt | Privatkunde ohne Ansprechpartner ist vollständig; Firma/Institution ohne Ansprechpartner bleibt konkret gesperrt |
| 32 | Reiner Namensfreitext ohne strukturiert erkanntes Feld startete keine Kundensuche | `sabrina schmidt` befüllt die Suche, startet die bestehende Serversuche und zeigt `Sabrina Schmidt · übernehmen` |
| 33 | Suchtreffer hatten den allgemeinen Knopf `Auswählen` | jeder Treffer zeigt konkret `<Kundenname> · übernehmen` und setzt per Klick genau diesen Kunden |
| 34 | `Kunde anlegen` erschien nur im leeren Zustand oder nach `Kein Kunde gefunden` | der Knopf bleibt beim Tippen und unter Trefferlisten sichtbar |
| 35 | Kein belegter Handy-Weg bei fehlender Pflichtangabe | `Positionen` bleibt klickbar, wechselt in den passenden Schritt und meldet die erste offene Angabe |
| 36 | Erfolgszwischenbildschirm mit zwei Folgeknöpfen | Erfassung schließt; `openOrder(orderId)` öffnet direkt die Karte und die Meldung nennt die Auftragsnummer |
| 37 | Kein Doppelklick-Beleg | während des Schreibens `Wird gebucht …`; ein zweiter Klick löst keinen zweiten Action-Aufruf aus |
| 38 | Kundenkarte ersetzte den Kontext oder verlor Eingaben | Kundenkarte liegt als Ebene über der Erfassung; Rückkehr erhält Eingaben, liest den Kunden neu und prüft erneut |
| 39 | Kein Beleg für den Aufruf aus der Kundenkarte | `Neuer Auftrag` setzt den Kunden in derselben Erfassung und zeigt `aus der Kundenkarte` |

### 7.3 `RolfHome.realRender.test.tsx`

| Alt | Neu |
|---|---|
| `Zuordnen` öffnete die gewählte Outlook-Mail | `Mail ansehen` öffnet exakt dieselbe Outlook-Mail und ruft `requestGlobalCreate` nicht auf |

Neue Tests haben kein „alt“: `orderReadiness.test.ts` prüft zusätzlich Privatkunde gegen Firma ohne Ansprechpartner. Die realRender-Abnahme belegt den reinen Namensweg über die bestehende Serversuche sowie den dauerhaft sichtbaren Kundenanlage-Knopf. Die beiden Abnahmetests sind unverändert aus den Planungsquellen kopiert.

## 8. Sichtbare Stellen „Neu erfassen“ und Kamera

- Dialog, Haupttrigger und deaktivierte Foto-Kachel mit Kamera: `src/modules/eingang/GlobalCreateFlow.tsx`
- Rotes Plus: `KreileHeader.tsx` und `GlobalesPlus.tsx`
- Weitere erlaubte Einstiege: `MoreMenu.tsx`, `SearchDialog.tsx`, `OfficeHomeClient.tsx`, `OrdersAppAdapter.tsx`, `WerkstattView.tsx`, `AppShell.tsx`
- Sichtbare Fähigkeit/Recht: `featureCatalog.ts` und `authorizationContract.ts`

## 9. Preview-Screenshot und Owner-Klickweg aus PAKET Fassung 4.2, Punkt 5

- Screenshot der exakten Preview auf Produkt-SHA `1acf9118…`:
  `output/playwright/ap01-1acf9118-sabrina-schmidt.png`
- Sichtbarer Nachweis: Suchfeld `Sabrina Schmidt`, Vorschlag `Sabrina Schmidt · übernehmen`, Kundennummer `K-2026-0011` und der weiterhin sichtbare Knopf `Kunde anlegen`.

1. Exakte Preview öffnen, als Rolf anmelden und über das Plus den bestehenden Privatkunden `gregor laucht` (`K-2026-0013`) wählen. Es erscheint kein Hinweis `Ansprechpartner fehlt`; nach Ergänzung der übrigen Pflichtangaben ist `Wareneingang buchen` möglich.
2. Plus erneut öffnen, in `Schnell erfassen` nur `sabrina schmidt` eingeben und `Angaben erkennen` wählen. Die Kundensuche ist mit `sabrina schmidt` vorbelegt und zeigt `Sabrina Schmidt · übernehmen`; ein Klick setzt diesen Kunden.
3. Bei `Kunde suchen` tippen. Während des Tippens sowie unter vorhandenen Treffern bleibt `Kunde anlegen` sichtbar; ohne Treffer steht der Knopf direkt unter `Kein Kunde gefunden`.
4. Ohne Position `Wareneingang buchen` wählen. Es gibt keinen Schreibaufruf; die Ansicht springt zu `Teil / Leistung` und meldet `Noch offen: Teil / Leistung`. Auf dem Handy führt `Positionen` entsprechend in Schritt 2.
5. Alle Pflichtangaben ausfüllen und buchen. Währenddessen steht `Wird gebucht …`; ein Doppelklick erzeugt keinen zweiten Auftrag. Danach schließt die Erfassung, meldet `Auftrag {Nummer} angelegt` und öffnet direkt die Auftragskarte.
6. Den unvollständigen Kunden `Sabrina Schmidt` wählen und `In Kundenkarte ergänzen` öffnen. Die Karte liegt über der Erfassung. Land auf `Schweiz` korrigieren und speichern oder schließen: dieselbe Erfassung mit allen Eingaben erscheint wieder, der Kunde wurde neu gelesen und der frühere Hinweis ist verschwunden. Esc schließt nur die Kundenkarte.
7. In einer Kundenkarte `Neuer Auftrag` wählen. Die Erfassung öffnet mit gesetztem Kunden und der Markierung `aus der Kundenkarte`.

Nach dem Owner-Klick prüft der Planungschat die reale Kette `intake_item` → `orders`/Receipt → `intake_event` → `ORDER_INTAKE_CREATED_V1`. #158 bleibt bis zur Owner-Entscheidung ungemergt.

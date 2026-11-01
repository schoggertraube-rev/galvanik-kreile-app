# ABGABE AP-01 — Eingang, Kanal Paket/persönlich

Stand: 01.11.2026 01:15 CET  
Branch: `kreile/b2-eingang`

## 1. Produktkandidat und Preview

- Produkt-SHA: `750e0534fc28efb9e6a8eb517355986cd459dc15`
- Basis: `11091c0be7b2c58ef7b009d4ad5664ad3e9db01d` (`origin/main` nach Merge von #157)
- Exakte READY-Preview dieses Produkt-SHA:  
  `https://galvanik-kreile-werkstatt-mblgvzoei.vercel.app`
- Vercel-Deployment: `dpl_5k4QmWDxCSo2WLCQQzgYtYwiT9ix`, Ziel `preview`, Zustand `READY`, Region `fra1`
- Zuordnung zum SHA: Der GitHub-Commit-Status von `750e0534…` verweist auf genau dieses Deployment; die Vercel-Inspektion meldet dieselbe Deployment-ID und den obigen eindeutigen Deployment-Host.
- Kein Merge und kein Production-Deploy durch Codex.

## 2. Eine Erfassungs- und Datenwahrheit

- `requestGlobalCreate` liegt kanonisch in `src/modules/eingang/requestGlobalCreate.ts`.
- Die alten Pfade `src/components/layout/globalCreateRequest.ts` und `src/components/layout/GlobalCreateFlow.tsx` sind nur noch Re-Exports auf das Modul `eingang`.
- `src/app/actions/eingang.actions.ts#erfasseAuftragAusEingangAction` ist die einzige neue AP-01-Server-Action.
- Die Auftragsanlage delegiert ausschließlich an den bestehenden, unveränderten `createOrderIntake`.
- Drei idempotente Schritte mit demselben `clientKey`: `intake_item` anlegen → Auftrag über `createOrderIntake` anlegen/lesen → `intake_item` zuordnen und `intake_event` anhängen.
- Vor jedem der drei Schritte wird Recht `eingang` erneut serverseitig aufgelöst. Ohne das Recht schreibt der Akzeptanztest keine Zeile.
- Der alte Produkt-Schreibweg über `intake_drafts` ist entfernt: `src/app/actions/intakeDraft.actions.ts` und `src/lib/server/intakeDraft.ts` wurden gelöscht; Dashboard und Adapter lesen/schreiben keinen Eingangs-Entwurf mehr.
- Es gibt keine zweite Kunden- oder Auftragsanlage im AP-01-Dialog. AP-01 verwendet ausschließlich `{ mode: "EXISTING", customerId }`.
- Mail, OCR, Datei- und Fotoverarbeitung wurden nicht gebaut. Die Foto-Kachel ist sichtbar, ehrlich deaktiviert und hat ein Kamerasymbol.

## 3. Migration und Dev-Gleichstand

- Datei: `supabase/migrations/20261031212320_ap01_intake_item.sql`
- SHA-256: `308A6A1548E67147AD549923BF4C8B9C840B969A05B3447AD4A4BBBE388912B9`
- Vor Anwendung meldete der Dry-Run ausschließlich diese eine Migration als offen.
- Anwendung auf das verknüpfte Dev-Projekt `syhaigjhsbpjmtnggqka`: erfolgreich.
- Gleichstand danach: Repository `66` Migrationen, Dev `66` Migrationen; letzter Zeitstempel jeweils `20261031212320`.
- Zweiter Dry-Run: `Remote database is up to date`, keine offene Migration.
- Die Migration ist additiv. `intake_item` hat kein DELETE-Recht; `intake_event` hat weder UPDATE- noch DELETE-Recht.

## 4. Akzeptanztest und echter Datenbankbeleg

- Unverändert kopierter Test: `src/test/acceptance/ap01_eingang_paket_persoenlich.integration.test.ts`
- SHA-256: `BE54C2C5FD0F7B6EF707D8B81B00F542732395FE7AC6695EA86DB8E26627E48E`
- Ergebnis gegen eine aus allen 66 Migrationen frisch aufgebaute lokale Replay-Postgres-DB: `1` Testdatei, `3/3` Tests grün.
- Der Test ruft die echte Server-Action mit signierter Sitzung auf, prüft anschließend die DB-Zeilen und belegt zusätzlich Idempotenz und die schreibfreie Rechteverweigerung.

Echter Lauf 1:

- `client_key`: `bd348b87-e16f-4acb-91f3-9d9810b16fc3`
- `intake_item`: `kanal=notiz`, `richtung=rein`, `quelle=geraet`, `vorgang_art=auftrag`, `vorgang_id=A-2026-0001`
- `orders.id`: `064d813a-cea5-4a00-9dec-2f03c4991953`
- `intake_event`: genau ein `angelegt`, genau ein `zugeordnet`
- `events`: genau ein erfolgreiches `ORDER_INTAKE_CREATED_V1`

Echter Lauf 2 / Idempotenz:

- `client_key`: `3a71dce4-f5dd-4526-885e-fbc050245390`
- `intake_item`: `kanal=notiz`, `richtung=rein`, `quelle=geraet`, `vorgang_art=auftrag`, `vorgang_id=A-2026-0002`
- `orders.id`: `47d4b9a8-a445-4536-bf46-4de71fa50ffe`
- `intake_event`: genau ein `angelegt`, genau ein `zugeordnet`
- `events`: genau ein erfolgreiches `ORDER_INTAKE_CREATED_V1`
- Wiederholung mit demselben `clientKey`: derselbe Auftrag und dasselbe `intake_item`, keine zweite Zeile und kein zweites Auftragsevent.

## 5. Prüfliste

Lokal auf dem Produkt-SHA bzw. unmittelbar vor seinem Commit:

- `quality:authority-gate:selftest` / `quality:authority-gate`: PASS
- `quality:delivery-contracts:selftest` / `quality:delivery-contracts`: PASS
- `quality:package-scope:selftest`: PASS
- `quality:package-scope -- --base 11091c0b… --head 750e0534… --branch kreile/b2-eingang`: PASS
- `quality:live-regression:selftest`: PASS
- `quality:module-gates`: PASS
- `quality:h18-server-actions:selftest` / `quality:h18-server-actions`: PASS (`99` Schreibaktionen, `35` getestet, `64` bestehende Ausnahmen)
- `quality:h16-eslint-contracts:selftest` / `quality:h16-eslint-contracts`: PASS
- `quality:no-fake-production` plus Selbsttest: PASS
- `check-f0-doc-truth.mjs` plus Selbsttest: PASS
- `check-supabase-client-boundary.mjs`: PASS
- `quality:f0-f2-schema:selftest` / `quality:f0-f2-schema`: PASS gegen Replay-DB
- `live:advance:selftest` / `live:close:selftest`: PASS
- `npx tsc --noEmit --incremental false`: PASS
- `npm run lint:full`: PASS, keine Fehler; sechs bereits auf `main` vorhandene Warnungen in `docs/project/endversion/werkzeuge/bauplan.mjs`
- `npm run test:unit`: PASS, `132` Dateien / `1047` Tests
- `npm run build`: PASS
- AP-01-Akzeptanztest gegen Replay-DB: PASS, `3/3`
- Commit-Hook: TypeScript, Staged-Lint und nochmals `132` Dateien / `1047` Tests: PASS
- Vercel Preview: READY

Remote-Checks des Produkt-SHA bei Erstellung dieser Abgabe:

- `Vercel`: SUCCESS / READY
- `Vercel Preview Comments`: SUCCESS
- `agentur-gate`: läuft
- `h16-schema`: läuft

Die finalen PR-Checks werden nach dem separaten Abgabe-Commit erneut abgewartet und außerhalb dieses unveränderlichen Produktkandidaten gemeldet.

## 6. Änderung an `authorizationContract.ts`

Alt: `Neuer Eingang & Kunde anlegen`  
Neu: `Neu erfassen & Kunde anlegen`

Begründung: reine sichtbare Umbenennung der bereits bestehenden AccessArea `eingang` entsprechend Endversion spec `5ac4d4b5ea34`. Bereich, Rechteauflösung, Rollenmodell und Serverautorisierung bleiben unverändert. Für die AP-01-Auftragsanlage ist ausschließlich `eingang` erforderlich; die Geldberechtigung steuert weiterhin nur Geldfelder.

## 7. Geänderte Assertions in bestehenden Tests/E2E: alt → neu

### 7.1 Reine sichtbare Umbenennung

Jede folgende Selektor-/Sichtbarkeitsassertion behält ihre Aussage und wechselt nur den zugänglichen Namen:

| Datei / Stelle | Alt | Neu |
|---|---|---|
| `e2e/f1-4-immutable-invoice.real.spec.ts`, Intake-Dialog | Heading `Neuer Eingang` | Heading `Neu erfassen` |
| `e2e/path1-ui-convergence-v5-global-create.spec.ts`, rotes Plus | Button `Neuer Eingang` | Button `Neu erfassen` |
| dieselbe E2E, geöffneter Dialog | Heading `Neuer Eingang` | Heading `Neu erfassen` |
| `e2e/path1-ui-convergence-v5-p3.real.spec.ts`, Hub | Button `Neuer Eingang` sichtbar | Button `Neu erfassen` sichtbar |
| dieselbe E2E, Hub-Dialog | Dialog `Neuer Eingang` sichtbar | Dialog `Neu erfassen` sichtbar |
| dieselbe E2E, Station | Dialog `Neuer Eingang` sichtbar | Dialog `Neu erfassen` sichtbar |
| dieselbe E2E, Rolf-Start | Button `Neuer Eingang` klicken | Button `Neu erfassen` klicken |
| dieselbe E2E, Rolf-Dialog | Heading `Neuer Eingang` sichtbar | Heading `Neu erfassen` sichtbar |
| `w2cB2m5j.unavailable.realRender.test.tsx`, autorisierte Aktion | `Neuer Eingang` nicht sichtbar | `Neu erfassen` nicht sichtbar |
| dieselbe Datei, Root-Aktion | `Neuer Eingang` vorhanden/klickbar | `Neu erfassen` vorhanden/klickbar |
| dieselbe Datei, leerer Root | `Neuer Eingang` nicht sichtbar | `Neu erfassen` nicht sichtbar |
| dieselbe Datei, Developer | `Neuer Eingang` nicht sichtbar | `Neu erfassen` nicht sichtbar |
| dieselbe Datei, partieller Fehler | `Neuer Eingang` nicht sichtbar | `Neu erfassen` nicht sichtbar |
| `RolfHome.realRender.test.tsx`, leerer Bestand | `Neuer Eingang` vorhanden | `Neu erfassen` vorhanden |
| dieselbe Datei, vorhandene Aufträge | `Neuer Eingang` nicht vorhanden | `Neu erfassen` nicht vorhanden |
| `w2cHeaderTruth.realRender.test.tsx` | Titel `Neu anlegen` klickbar | Titel `Neu erfassen` klickbar |
| `WerkstattView.singleProjection.test.tsx` | Button `Neuer Eingang` sichtbar | Button `Neu erfassen` sichtbar |

### 7.2 `path1GlobalCreateFlow.realRender.test.tsx` — fachliche Umstellung auf AP-01

| Nr. | Alt | Neu / gleichwertiger Ersatz |
|---:|---|---|
| 1 | Haupttrigger hieß `Anlegen` | Haupttrigger heißt und öffnet `Neu erfassen` |
| 2 | Mail-Dialog war im globalen Erfassungsflow sichtbar | `Aus Mail` ist in AP-01 ausdrücklich nicht vorhanden |
| 3 | Mail-Kunde wurde im globalen Flow vorausgewählt | Keine Mailstrecke; Bestandskunde wird nur über `Kunde suchen` gewählt |
| 4 | `Neuer Eingang aus Mail` schloss den Mail-Dialog | Kein Mail-Button; die Nicht-Verfügbarkeit wird explizit asserted |
| 5 | Ein aus Mail übernommener Kunde war im Eingangsformular sichtbar | AP-01 behauptet keine Mailübernahme; `Aus Mail` bleibt unsichtbar |
| 6 | `Eingangsart=mail` wurde asserted | AP-01 schreibt kanonisch `kanal=notiz`, `quelle=geraet`; das prüft der unveränderte DB-Akzeptanztest |
| 7 | Inline-Feld `Name / Firma` fehlte nach Mailauswahl | Inline-Neukunde fehlt generell; Assertion: kein `Name / Firma` im AP-01-Eingang |
| 8 | Mailübernahme durfte keinen Kunden anlegen | AP-01 darf ebenfalls keinen Kunden anlegen; die bestehenden `createCustomer not called`-Assertions bleiben im Direkteingang |
| 9 | `attachOutlookMailAction` wurde für CUSTOMER geprüft | Mailzuordnung bleibt außerhalb AP-01; die vorhandene `CommunicationPanel`-Testsuite schützt den bestehenden Mail-Port |
| 10 | Erfolgstext der Mailzuordnung wurde geprüft | AP-01 zeigt keinen Mail-Erfolg und keinen Mail-Button |
| 11 | `attachOutlookMailAction` wurde für ORDER geprüft | Mailzuordnung bleibt außerhalb AP-01; kein zweiter Eingangsschreibweg im neuen Modul |
| 12 | Ein konkreter Graph-Eintrag öffnete `Mail zuordnen` | `Neu erfassen` öffnet die Paket/persönlich-Strecke; Mail ist nicht Teil dieses Pakets |
| 13 | Ausgewählte Mail war sichtbar | `Aus Mail` ist nicht sichtbar |
| 14 | Andere Mail war nicht sichtbar | Der gesamte Mailkanal ist nicht sichtbar |
| 15 | Alter `intake_drafts`-Entwurf wurde nicht gelesen | Assertion jetzt stärker auf Produktwahrheit: kein Text `Entwurf … wieder aufgenommen`; der Leser/Writer wurde entfernt |
| 16 | Doppelte Mailadresse ließ Kundenauswahl leer | Kein Mailkanal in AP-01; die Bestandskundensuche bleibt serverseitig und ohne Raten |
| 17 | Absendername wurde in Inline-Neukunde übernommen | Kein Inline-Neukunde; `Name / Firma` ist nicht vorhanden |
| 18 | Mailstrecke durfte keinen Kunden schreiben | AP-01-Direkteingang erwartet `customer: { mode: EXISTING, customerId }` und assertiert weiterhin keinen Kunden-Write |
| 19 | Foto-/Datei-Anschlüsse waren aktive Altstrecken | Kachel `Fotos mit Tablet/Handy` ist `aria-disabled=true`, Kamerasymbol vorhanden; `Datei lesen` ist nicht vorhanden |
| 20 | Zahlungsmodus startete bei Abholung mit `abholung` | Zahlungsmodus startet leer (`""`), also keine Ersatzentscheidung |
| 21 | Wechsel zu Versand setzte automatisch `vorkasse` | Zahlungsmodus bleibt leer; Auswahl ist ausdrücklich nötig |
| 22 | Leere Kundensuche bot `… als Neukunde anlegen` | Kein zweiter Kundenweg: CTA und Feld `Name / Firma` sind nicht vorhanden |
| 23 | Zielkunde startete automatisch mit `rechnung` | Zahlungsmodus startet leer; `rechnung` gilt erst nach expliziter Auswahl |
| 24 | Direkteingang erwartete Inline-Kunde `{ mode: NEW, name }` | Direkteingang erwartet exakt `{ mode: EXISTING, customerId }` |
| 25 | Direkteingang fokussierte das Inline-Neukundenfeld | Direkteingang fokussiert `Kunde suchen` |
| 26 | Direkteingang/KV aus derselben Intake-Maske assertierte `validUntil`, `termStatus`, `intakeSource=anfrage_mail` | Intake-KV ist nicht AP-01. Gleichwertige KV-Verträge bleiben in der bestehenden Kunde→KV-Strecke und `src/modules/quotes/__tests__/quoteCommands.test.ts`; AP-01 assertiert nur Auftrag Paket/persönlich |
| 27 | Texterkennung füllte `Name / Firma` | Texterkennung ändert keinen Kunden; `Name / Firma` fehlt und Kundensuche bleibt leer, erkannter Liefertermin bleibt asserted |
| 28 | Freitext-Auftrag legte Inline-Neukunden an | Freitext-Auftrag verwendet ausgewählten Bestandskunden |
| 29 | Manuelle Checkbox behauptete Vollständigkeit | Prüfliste muss tatsächlich `7 von 7 Pflichtangaben` zeigen und die Action genau einmal aufrufen |
| 30 | Desktop-Dialog startete mit Zahlungsmodus `abholung` | Desktop-Dialog startet mit leerem Zahlungsmodus |
| 31 | Ohne Geldrecht wurde die alte Gruppe `Art` mit Auftrag/ohne KV geprüft | Neue Anliegenanzeige zeigt Auftrag; die alte Art-Gruppe ist nicht vorhanden; Preisfelder bleiben unsichtbar |
| 32 | Preisvorschlag und `125,00 … Stück` waren sichtbar | AP-01 erfindet keinen Preis: `Preisvorschlag` ist nicht vorhanden |
| 33 | Preis wurde über `Übernehmen` bestätigt | Kein Preisvorschlag in AP-01; nur der separat sichtbare Terminvorschlag kann explizit übernommen werden |
| 34 | Aufruf/Kundenhistorie setzte Übergabe `Versand` | Kein Ersatzwert: alle Übergabe-Buttons starten `aria-pressed=false` |
| 35 | Aufruf/Kundenhistorie setzte `Eingangsart=shipping` | Keine Eingangsart-Auswahl; DB-Kanal ist im Akzeptanztest fest `notiz` |
| 36 | Oberfläche startete mit `noch zu klären` | Oberfläche startet leer |
| 37 | Erreichbarer Termin wurde automatisch in das Pflichtfeld geschrieben | Liefertermin bleibt leer; Vorschlag wird nur nach Klick übernommen |
| 38 | Fehlerfall hielt den Namen des Inline-Neukunden sichtbar | Fehlerfall hält den ausgewählten Bestandskunden sichtbar und zeigt keinen falschen Erfolg |
| 39 | Escape öffnete `Entwurf behalten?` und erforderte Verwerfen | Ohne `intake_drafts` schließt Escape den nicht persistenten AP-01-Dialog direkt; Dialogfreiheit wird asserted |

## 8. Alle Produktstellen „Neu erfassen“ und Kamerasymbol

- `src/modules/eingang/GlobalCreateFlow.tsx`: Haupttrigger und aria-label, Dialogtitel, interne Überschrift; Foto-Kachel `Fotos mit Tablet/Handy` mit Lucide-`Camera`, ehrlich deaktiviert.
- `src/components/layout/KreileHeader.tsx`: rotes Plus, `aria-label` und `title`.
- `src/components/layout/MoreMenu.tsx`: Menüeintrag.
- `src/modules/suche/ui/SearchDialog.tsx`: Suche › Tun, inklusive Taste `N`.
- `src/components/home/OfficeHomeClient.tsx`: Primäraktion im leeren Desktop-Zustand und mobile Schnellaktion.
- `src/app/orders/OrdersAppAdapter.tsx`: Primäraktion in beiden leeren Auftragslisten.
- `src/modules/werkstatt/ui/WerkstattView.tsx`: Primäraktion im leeren Werkstattzustand und Aktionsschaltfläche.
- `src/ui/kr/AppShell.tsx`: Desktop-/Tablet-Schnellaktion und Navigation.
- `src/ui/kr/GlobalesPlus.tsx`: rotes Plus, `aria-label` und `title`.
- `src/modules/fundament/featureCatalog.ts`: sichtbare Bezeichnung der bestehenden Fähigkeit E02.
- `src/lib/auth/authorizationContract.ts`: sichtbare Bezeichnung des bestehenden Bereichsrechts `eingang`.

## 9. Owner-Klickweg (höchstens sechs Schritte)

1. Exakte Preview öffnen und als Rolf anmelden.
2. Rotes Plus `Neu erfassen` öffnen.
3. Text `2 Stück Flansch verzinken` eingeben.
4. Anliegen `Auftrag`, einen Bestandskunden und alle als `fehlt` markierten Pflichtangaben ausdrücklich wählen/ausfüllen.
5. `Wareneingang buchen` klicken und die Erfolgsmeldung mit Auftrag `A-2026-00NN` prüfen.
6. Auftrag in der Auftragsliste öffnen; Planungschat prüft dazu DB-Kette `intake_item` → `orders` → `intake_event` → `ORDER_INTAKE_CREATED_V1`.


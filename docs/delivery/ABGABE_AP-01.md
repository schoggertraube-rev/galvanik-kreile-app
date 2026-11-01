# ABGABE AP-01 – Eingang, Kanal Paket/persönlich, Fassung 4

Stand: 01.11.2026, Produktkandidat nach Merge von TA-B2c (#159)

Branch: `kreile/b2-eingang` · PR: `#158` · kein Merge durch Codex

## 1. Produkt-SHA und exakte Preview

- Produkt-SHA: `bbf4c2faa913c325ab7b049b5a2dde45763c1632`
- Basis: `8e1e03f567278d24d5f3a468f6cbef3729db96b9` (`origin/main`, #159)
- Exakte READY-Preview dieses Produkt-SHA:

  `https://galvanik-kreile-werkstatt-nwips9lp6.vercel.app`
- Vercel-Zustand: `READY`; Deployment-Metadaten nennen exakt den Produkt-SHA und PR `#158`.
- Kein Merge und kein Production-Deploy durch Codex.

## 2. Eine Erfassungs-, Kunden- und Auftragswahrheit

- `requestGlobalCreate` liegt kanonisch in `src/modules/eingang/requestGlobalCreate.ts`; die alten Layout-Pfade sind nur Re-Exports.
- `src/app/actions/eingang.actions.ts#erfasseAuftragAusEingangAction` ist die einzige AP-01-Schreibaktion.
- Die Auftragsanlage läuft ausschließlich über den bestehenden, unveränderten `createOrderIntake`.
- Drei idempotente Schritte verwenden denselben `clientKey`: `intake_item` anlegen, Auftrag anlegen/lesen, Eingang zuordnen und `intake_event` anhängen.
- Der alte Produktweg über `intake_drafts` ist entfernt; die Tabelle bleibt ohne zweiten Produktzugriff bestehen.
- Ein vollständiger Bestandskunde wird über seine ID verwendet. AP-01 legt keinen Kunden an und verändert keine Kundendaten.
- Ein unvollständiger Bestandskunde wird in Oberfläche und Server durch dieselbe reine Prüffunktion bewertet. Der Server antwortet vor dem ersten Schreiben mit `CUSTOMER_INCOMPLETE`.
- Korrekturen erfolgen ausschließlich in der bestehenden Kundenkarte über `updateCustomerCommercialAction`; der Eingang zeigt keine lokalen PLZ-/Land- oder sonstigen Kundenfelder.
- Die für AP-K1 geplante Umbenennung von `getOrderReadiness` zu `kundeVollstaendigkeit` ist ausdrücklich nicht Teil von #158 und wird hier weder als Alias noch als zweite Funktion vorweggenommen.
- Eingangsart, Terminstatus, Übergabe und Zahlungsmodus starten leer. Zahlung bleibt gesperrt, bis eine Übergabe gewählt ist. Fehlende `intakeSource`/`termStatus` werden als `null` gespeichert, nicht still ersetzt.
- Ein Mail-Eintrag in „Der Tag“ öffnet die bestehende Mailansicht und niemals den Eingangsdialog.

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

Beide Tests rufen die echte Server-Action mit signierter Sitzung gegen Loopback-Postgres auf. Es gibt keinen Action- oder Datenbank-Mock.

### Datenbankbeleg aus diesem Lauf

| `client_key` | Auftrag | Kunde | `intake_item` | `intake_event` | Auftragsevent |
|---|---|---|---|---|---|
| `ede95557-e08f-4eb1-acaf-ec45cde23ce8` | `A-2026-0001` | `AP01 Bestandskunde fa709f39` | `notiz`, `geraet`, `auftrag` | `angelegt`, `zugeordnet` | `ORDER_INTAKE_CREATED_V1`, `success` |
| `28f44232-4d68-4110-8e3a-ead2982412df` | `A-2026-0002` | `AP01 Bestandskunde fa709f39` | `notiz`, `geraet`, `auftrag` | `angelegt`, `zugeordnet` | `ORDER_INTAKE_CREATED_V1`, `success` |
| `5aebeae2-16b9-43da-8b82-3dff87c81169` | `A-2026-0003` | `AP01B Schmidt 0d257e6b` | `notiz`, `geraet`, `auftrag` | `angelegt`, `zugeordnet` | `ORDER_INTAKE_CREATED_V1`, `success` |

- Für alle drei Aufträge sind `intake_source` und `intake_term_status` in `private.order_intake_receipts` tatsächlich `null`, weil die Tests diese Felder nicht senden. Damit ist die fehlende stille Vorbelegung auf Server/DB-Ebene belegt.
- Der Idempotenzfall ruft dieselbe Action zweimal mit demselben `clientKey` auf und erhält denselben Auftrag/dasselbe `intake_item`; DB-Zähler bleiben jeweils `1`.
- Ohne Recht `eingang` bleiben `intake_item` und Receipt jeweils bei `0`.
- Der unvollständige Kunde `3013 Bern / Deutschland` führt zu `CUSTOMER_INCOMPLETE`, nennt `zipCode` und schreibt weder Eingang noch Auftrag.
- Nach Korrektur auf `Schweiz` über `updateCustomerCommercialAction` wird derselbe Kunde erneut gelesen; erst danach entstehen genau ein Eingang und genau ein Auftrag (`A-2026-0003`).

## 5. Prüfungen auf dem Produkt-SHA

Lokal vollständig grün:

- Authority-, Delivery-, Package-Scope- und Live-Regression-Gates jeweils mit Selbsttest
- Package-Scope gegen Basis `8e1e03f5…`, Kopf `bbf4c2fa…`, Branch `kreile/b2-eingang`
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
- Unit: `133` Dateien, `1052` Tests grün
- Produktions-Build: grün
- Replay-Abnahme: `3/3` plus `2/2` grün

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
| 7 | Leere Kundensuche bot Inline-Neukunde und `Name / Firma` | kein Neukunde-CTA und kein Kunden-Eingabefeld im Eingang |
| 8 | Direkteingang erwartete `{ mode: NEW, name }` | exakt `{ mode: EXISTING, customerId }` |
| 9 | Texterkennung schrieb Kundenname | Kundensuche bleibt unverändert; erkannter Liefertermin bleibt geprüft |
| 10 | Freitext-Auftrag legte Inline-Kunden an | Freitext-Auftrag verwendet den ausdrücklich gewählten Bestandskunden |
| 11 | Manuelle Vollständigkeits-Checkbox | echte Prüfliste; vollständig `9 von 9`, Action genau einmal |
| 12 | Hauptknopf blieb bei fehlenden Pflichtfeldern aktiv und sprang zum Feld | Hauptknopf ist gesperrt; es erfolgt kein Schreibaufruf |
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
| 25 | Escape öffnete `Entwurf behalten?` | nicht persistenter AP-01-Dialog schließt direkt |
| 26 | Test änderte PLZ/Land lokal im Eingang | unvollständiger Kunde zeigt konkreten Grund; PLZ/Land fehlen als Eingabefelder |
| 27 | Lokaler `updateCustomer`-Port war vorhanden | kein Kunden-Write-Port im Eingang |
| 28 | Unvollständiger Kunde konnte im Dialog korrigiert werden | `Wareneingang buchen` gesperrt; `In Kundenkarte ergänzen` ruft `openCustomer(customerId)` |
| 29 | Zahlungs-/Übergabe-Test prüfte nur, dass Kundenzahlungsziel unverändert bleibt | F4-Test prüft serverkonforme Sperre bei `3013 Bern / Deutschland`, keine lokalen Felder und Kundenkarten-Rückweg |

### 7.3 `RolfHome.realRender.test.tsx`

| Alt | Neu |
|---|---|
| `Zuordnen` rief `requestGlobalCreate` mit `sourceMode: mail` auf | `Zuordnen` liest exakt die gewählte Outlook-Mail, öffnet den Dialog `Mail` und ruft `requestGlobalCreate` nicht auf |

Neue Tests haben kein „alt“: `orderReadiness.test.ts` prüft vollständigen Kunden, konkrete PLZ-/Land-Abweichung und die geldabhängige Zahlungsbedingung. Die beiden Abnahmetests sind unverändert aus den Planungsquellen kopiert.

## 8. Sichtbare Stellen „Neu erfassen“ und Kamera

- Dialog, Haupttrigger und deaktivierte Foto-Kachel mit Kamera: `src/modules/eingang/GlobalCreateFlow.tsx`
- Rotes Plus: `KreileHeader.tsx` und `GlobalesPlus.tsx`
- Weitere erlaubte Einstiege: `MoreMenu.tsx`, `SearchDialog.tsx`, `OfficeHomeClient.tsx`, `OrdersAppAdapter.tsx`, `WerkstattView.tsx`, `AppShell.tsx`
- Sichtbare Fähigkeit/Recht: `featureCatalog.ts` und `authorizationContract.ts`

## 9. Owner-Klickweg aus PAKET Fassung 4, Punkt 8

1. Exakte Preview öffnen, als Rolf anmelden und das rote Plus anklicken: Dialog `Neu erfassen` öffnet mit Plus-Symbol.
2. Einen vollständigen Bestandskunden wählen, Pflichtangaben ausdrücklich wählen und Auftrag anlegen: Auftragsnummer erscheint.
3. Kunden mit `3013 Bern / Deutschland` wählen: konkreter Hinweis erscheint und `Wareneingang buchen` bleibt gesperrt.
4. `In Kundenkarte ergänzen` anklicken, Land auf `Schweiz` ändern und dort über den bestehenden Kundenweg speichern.
5. Zurück zu `Neu erfassen`, Kunden neu wählen; Eingangsart, Übergabe, Zahlung und Terminstatus sind leer, werden ausdrücklich gewählt, danach lässt sich der Auftrag anlegen.
6. In „Der Tag“ einen Mail-Eintrag öffnen: die Mail erscheint, nicht `Neu erfassen`.

Nach dem Owner-Klick prüft der Planungschat die reale Kette `intake_item` → `orders`/Receipt → `intake_event` → `ORDER_INTAKE_CREATED_V1`. #158 bleibt bis zur Owner-Entscheidung ungemergt.

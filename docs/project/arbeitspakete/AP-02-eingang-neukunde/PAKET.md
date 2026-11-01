# AP-02 · Neukunde im Eingang (3.0 → Abschnitt 1 inline), eine Wahrheit

Status: **ZURÜCKGEZOGEN (Fassung 1) – nicht bauen.** Wird nach AP-K1 als Fassung 2 neu geschrieben: Kunde inline ergänzen + Neukunde inline über die eine Kunden-Komponente (Runde 21), Buchen nach `werkbank.buchen` in EINER Transaktion (orderIntakeCommand erweitert, U-225). Der Akzeptanztest `ap02_eingang_neukunde.integration.test.ts.txt` (SHA 2F21C7E6…) ist ungültig; Codex' AP-02-WIP auf Branch `wip/ap02-parkiert` sichern, nicht in `kreile/b2-eingang` und nicht in `src/test/acceptance/`.
Gate-Rahmen: Mission KREILE-VERKAUFSSTUFE-1, Block **B2**, Branch **`kreile/b2-eingang`** (frisch von main).
WAS: BAUPLAN spec `5ac4d4b5ea34`, Abschnitt `eingang` (Screen `eingang` Abschnitt 1 „Kunde suchen oder Neukunde anlegen“), `formulare.kunde`, Testfall „Gegeben ein Suchtext ohne Treffer … Wenn ‚Neukunde anlegen‘ …“.

## Ziel (ein Satz)
In „Neu erfassen“ kann ein unbekannter Kunde **inline** angelegt werden; Kunde und Auftrag entstehen in **einem** Schritt über den bestehenden kanonischen Weg `createOrderIntake` (customer `mode: "NEW"`), der Eingang hängt am neuen Kunden.

## Datenfluss (roter Faden, keine Parallelwege)
`3.0 Neu erfassen` → Abschnitt 1 Suche ohne Treffer → „Neukunde anlegen“ → Abschnitt 1 wird inline zur Kunden-Komponente → „Auftrag anlegen“ → `erfasseAuftragAusEingangAction({ customer: { mode: "NEW", … } })` → Schritt a) `intake_item` (wie AP-01) → Schritt b) `createOrderIntake` mit `customer` unverändert durchgereicht (legt Kunde + Auftrag atomar an, idempotent über `clientEventId = clientKey`) → Schritt c) `intake_item.kunde_id` = Kunde des Auftrags (`orders.customer_id`), `vorgang_art='auftrag'`, Ereignis `zugeordnet`.

## Bauen
1. `erfasseAuftragAusEingangAction` / `erfasseAuftragAusEingangCommand`: `customer` akzeptiert exakt `OrderIntakeCustomerInput` (EXISTING **oder** NEW) – Typ aus `orderIntakeCommand.ts` importieren, nicht nachbauen. Validierung NEW nach `formulare.kunde` (Name 2–160, Telefon 6–20 mit ≥ 6 Ziffern, E-Mail-Muster, PLZ je Land); Verstoß → `VALIDATION_ERROR`, **nichts** geschrieben (Validierung vor Schritt a).
2. Bei NEW wird `kunde_id` des Eingangs erst in Schritt c gesetzt (aus dem Auftrag). Replay (gleicher `clientKey`) liefert denselben Kunden, keinen zweiten.
3. UI im Modul `src/modules/eingang/`: Abschnitt 1 „Kunde suchen oder Neukunde anlegen“ mit „Neukunde anlegen · Abbrechen“; Wechsel inline in die bestehende Kunden-Komponente (dieselbe wie Dialog `kundeneu`, **kein** Dialog 3.1, keine Kopie des Formulars). Suchtext-Vorbelegung nach Muster: E-Mail-Muster → E-Mail, Telefon-Muster → Telefon, sonst Name/Firma. Keine Kunden-Notiz. Ähnliche Kunden als Dublettenhinweis in der rail. „Zurück zur Suche“ führt zurück. Pflicht: Kundentyp, Name, Telefon; „für Aufträge nötig“: Ansprechpartner, E-Mail, Straße, PLZ, Ort, Land. „fehlt“ statt Vorbelegung.
4. `GlobalCreateAppAdapter.tsx`: Port `createDirectIntake` reicht `customer` (EXISTING|NEW) unverändert an die Action.
5. Bestehenden realRender-Test `path1GlobalCreateFlow.realRender.test.tsx` zurückführen: die in AP-01 eingesetzten Negativ-Assertions zu Neukunde („kein … als Neukunde anlegen“, „kein Name / Firma“) ersetzen durch die positive Strecke (Suchtext → Neukunde anlegen → Name vorbelegt → Speichern ruft `createDirectIntake` mit `mode: "NEW"`, `createCustomer` nicht aufgerufen). In der Abgabe alt → neu je Assertion.

## Rechte
Neukunde im Eingang = Recht `eingang` („Neu erfassen & Kunde anlegen“). Server prüft wie AP-01. Keine Rechte-Änderung.

## Nicht anfassen
`createOrderIntake`/`orderIntakeCommand.ts`, `createCustomerAction` (bleibt der Weg für Kunden-Seite und Dialog `kundeneu`), Migrationen (keine nötig), Mail/OCR/Visitenkarte (spätere Pakete), Lieferant-Modus.

## Gate
- Akzeptanztest `ap02_eingang_neukunde.integration.test.ts.txt` (H18-Harness) bytegleich nach `src/test/acceptance/ap02_eingang_neukunde.integration.test.ts`, SHA-256 `2F21C7E61A0CA145A7CB098CE7471E0F948274FBA6B2334563B52F2B4B0FF167`. Nie ändern. Läuft im CI-Schritt „Acceptance tests against replay DB“.
- H18: keine neue Server-Action → `h18-server-actions.json` unverändert.
- Keine Migration. A11-Strecke grün. Scope B2 grün (nach TA-B2c).
- Abgabe `docs/delivery/ABGABE_AP-02.md`: SHA, READY-Preview genau dieses SHA, Checks, Test-SHA, DB-Beleg aus echtem Lauf, Assertion-Liste alt → neu.

## Abnahme (Owner-Klickweg ≤ 6 Schritte)
1. Preview öffnen, als Rolf anmelden. 2. Rotes Plus „Neu erfassen“. 3. Bei Kunde einen neuen Namen tippen → „Kein Kunde gefunden“ → „Neukunde anlegen“: Name steht drin. 4. Telefon, Ansprechpartner, E-Mail, Adresse ergänzen; Position, Termin, Übergabe, Zahlung wählen. 5. Auftrag anlegen → Auftragsnummer erscheint. 6. Kunden: der neue Kunde steht genau einmal da, mit dem Auftrag.

# AKTUELLE ANWEISUNG – einzige Auftragsquelle für den Bau-Codex (Stand 29.10.2026, 16:40)

Diese Datei **ersetzt alle früheren Fassungen**. Das Archiv `_review/archiv/AKTUELLE_ANWEISUNG_bis_2026-10-29.md` ist nur Nachschlagewerk und **kein Auftrag**. Steht etwas dort anders als hier, gilt diese Datei. Der Planungschat hält diese Datei kurz: Erledigtes fliegt raus, und nichts wird nur angehängt.

## A. Feste Regeln (gelten immer)
1. **Quellen.** Aufträge stehen nur hier im Abschnitt C. Dazu kommen ab dem Eingang die Arbeitspakete mit Status `bereit` in `docs/project/arbeitspakete/WORKQUEUE.json` (Format: `docs/project/arbeitspakete/README.md`). Das WAS steht in `docs/project/endversion/codex/BAUPLAN.json`. Grenzen setzen `_review/OWNER_ENTSCHEIDUNGEN.md` und AGENTS.md (mit Vorrangregel). Andere Dateien sind kein Auftrag.
2. **Reihenfolge.** Immer nur der oberste offene Punkt in C. Vor jedem Unterpunkt diese Datei neu lesen.
3. **Fertig heißt:**
   - Ein Integrationstest ruft die **echte** Server-Action gegen die Replay-DB auf und prüft die DB-Zeile. Nachgestellte DB, Mocks oder reine UI-Tests zählen nicht.
   - CI ist grün.
   - Es gibt eine Abgabe `docs/delivery/ABGABE_<Nr>.md` mit Befund, Datei:Zeile, DB-Soll und Owner-Klickweg. Der Klickweg beginnt mit dem **Preview-Link genau dieses SHA** (Status READY, nicht der Branch-Alias).
4. **Fehler sind sichtbar.**
   - Kein `catch` ohne serverseitiges Log mit Code.
   - Jede Meldung erscheint dort, wo gerade gehandelt wird, also im Dialog selbst.
   - Ein Lesefehler erscheint als sichtbare Zeile mit Code und wird nie still ausgeblendet.
   - Keine Ersatzwerte: Fehlt ein Wert, steht dort „fehlt“.
5. **Eine Wahrheit.**
   - Keine zweite Tabelle, Route oder Regel neben einer vorhandenen.
   - Wer etwas ersetzt, löscht das Alte im selben Paket.
   - Keine Umschreibungen, die einen Wächter austricksen.
6. **Scheitern.** Scheitert ein Unterpunkt fachlich nach einem Fixversuch, wird er zurückgenommen, `RUECKFRAGEN_<Nr>.md` geschrieben und der nächste Unterpunkt begonnen. Mechanische Folgearbeit zählt nicht als Fixversuch: Lint-Umbenennung, Fixture-Feld, Manifest, Testselektor. Bei einem Werkzeug-Timeout entscheidet CI.
7. **Grenzen.**
   - Branch nach Mission: Anker TA-B2 auf `codex/ta-b2`, danach AP-01 auf `kreile/b2-eingang` (#154 ist erledigt).
   - Kein Merge und kein Production-Deploy durch Codex.
   - Nichts löschen, keine Secrets, keine alte Migration ändern.
   - Dev-DB-Migrationen nur additiv; danach belegen, dass die Migrationsliste der DB gleich dem Repo ist.
   - Eine App: ein Repo, ein Vercel-Projekt, eine Dev-DB (U-219).
   - Codex macht keine Klicktests; die macht die Owner (4d).
8. **Eingang eingefroren.** Nichts am Eingang bauen oder reparieren, bis dazu Arbeitspakete mit Status `bereit` vorliegen.
9. **Nicht härten, was die Endversion ersetzt (U-220).** Codex testet und repariert nur Aktionen, die der Planungschat als stabiler Stufe-1-Kern bestätigt hat. Alles, was auf der Ausnahmeliste als eingefroren, Stub, ersetzt, Legacy-außerhalb-Stufe-1 oder Stufe-2 steht, bleibt unangetastet und wird erst gebaut und getestet, wenn die Endversion es neu schneidet. Im Zweifel: nicht anfassen, als Frage an den Planungschat.
10. **Test schreibt nicht, wer den Code schrieb (U-221).** Der Abnahmefall je Fix (Eingaben → Soll-Zeile in der DB → Soll-Ansicht) wird vom lesenden Prüf-/Red-Team-Codex und vom Planungschat vorgegeben, nicht vom Bau-Codex. Der Bau-Codex erfüllt ihn, definiert ihn nicht. Nur der Bau-Codex schreibt auf dem Branch; der Prüf-Codex liest und urteilt, er baut nichts. Keine zweite schreibende Codex-Sitzung auf demselben Branch.
11. **Durchlauf statt Pingpong (U-224).**
   - Vor jedem Commit und PR läuft die komplette lokal ausführbare Strecke von `quality` und `agentur-gate`: authority-gate (+selftest), delivery-contracts (+selftest), package-scope-selftest, live-regression-selftest, module-gates, h18 (+selftest), h16 (+selftest), no-fake-production (+selftest), f0-doc-truth, supabase-client-boundary, `git diff --check origin/main` (Whitespace/Merge-Marker, muss leer sein), `npx tsc --noEmit --incremental false`, `npm run lint:full`, `npm run test:unit`. Alle Befunde werden **gesammelt** gemeldet, nie einzeln.
   - **Selbst lösen, dokumentieren, weitermachen** bei rein mechanischen Befunden: Import-Pfade/Dateiorte nach Gate-Regeln, Testselektoren, Fixture-Felder, Lint-Formalien, Benennung, Ablage im Planungsordner — solange der Akzeptanztest bytegleich bleibt, kein Gate/Workflow/Hash/`tsconfig.json` geändert und kein Produktverhalten anders als im Paket gebaut wird.
   - **Stoppen nur bei:** Änderung geschützter Checker/Workflows/Hashes/`tsconfig.json` über die freigegebene Liste hinaus; Lockern einer Regel; Inhalt eines Akzeptanztests; `createOrderIntake` oder bestehende Migrationen; fehlende Produktentscheidung; Merge/Deploy. Dann **alle** offenen Punkte in **einer** Meldung, je mit Empfehlung.

12. **Spec-Freeze je Paket (U-226).** Der Bauplan, den WORKQUEUE für das laufende Paket nennt (spec + SHA-256), gilt bis zu dessen Merge. Der Endversion-Chat ändert `docs/project/endversion/codex/BAUPLAN.json` nicht, solange ein Anker oder Paket offen ist; Änderungen legt er in `docs/project/endversion/codex/BAUPLAN.next.json` ab (nicht im Repo). Der Planungschat übernimmt sie beim nächsten Anker und nennt die neue SHA. Weicht die SHA im Arbeitsbaum von WORKQUEUE ab: Codex stoppt nicht, sondern meldet es und baut nach der WORKQUEUE-SHA, sofern diese Datei vorliegt; sonst Stopp.

## B. Stand (geprüft vom Planungschat, 29.10. 16:40)
- **Bereinigung H11–H16c erledigt** (Kopf 37b0c566, CI grün). Erledigt sind Rechte aus einer Quelle, „Der Tag“ ohne Absturz, keine Ersatzwerte bei Firmendaten und Zahlungsziel, eine Rechnungswahrheit, entfernter Müll, Wächter und das Datenregister.
- **Owner-Klicktest 29.10. ist gescheitert**, siehe C1. Das Zahlungsziel funktioniert (DB-Beleg). Code ändern, Rechte setzen und die Auftragskarte nach einer Terminänderung funktionieren nicht.
- Mail-Versand: Graph sendet zwar, die Zustellung scheitert aber (Rückläufer). Das wird mit dem Mail-Kanal im Eingang geklärt, nicht jetzt.

## C. Warteschlange (nur offene Punkte, in dieser Reihenfolge)
**WÄCHTER-HALT (01.11. 14:30 UTC):** 7319c912 (AP-01 F4, lokal auf kreile/b2-eingang) fügt in `src/components/home/OfficeHomeClient.tsx` (openMail) ein neues `catch {}` ohne Log ein. Nachbessern: Log mit Code ergänzen (wie `[CUSTOMER_ORDER_READINESS_READ_FAILED]`), lokale Strecke A11 komplett, nicht pushen vor TA-B2c-Merge; dann weiterarbeiten an AP-01 F4 → TA-B2c.
**C-Eingang · Stand 01.11. 14 Uhr (verbindlich, ersetzt die Blöcke darunter zu AP-01/AP-02):** U-225. Reihenfolge laut `docs/project/arbeitspakete/WORKQUEUE.json`: AP-01 Fassung 4 lokal auf `kreile/b2-eingang` bauen → TA-B2c (Bauplan 6b782924 + Pfad-Probe) → Owner-Merge → AP-01 F4 pushen auf #158 → Owner-Klicktest/Merge → AP-K1 (Paket folgt) → AP-02 Fassung 2. AP-02 Fassung 1 ist zurückgezogen; WIP auf `wip/ap02-parkiert`. Prüfdatei `zz_*probe*` des Planungschats nie committen.
**PRÜFER 31.10. 11:55: C1/C2 ERLEDIGT.** #154 auf main gemergt (Kopf ae79c12f). Pflicht-Checks quality+agentur-gate grün, dazu Fresh-Supabase-Replay und h16-schema grün. Guards nicht aufgeweicht: ESLint-Baseline weiter 0 Fehler, Ratchet-Vertrag regulär neu signiert, neue Prüfskripte dazu. Dev-DB 65/65 = Repo, additiv. Rebaseline fasste nur Rechnung/Auftragskarte an, NICHT den Eingang. Smoke auf main grün (Login, Storno, Auftrag öffnen). Hinweis: #154 = „P2 Eingang", daher liegt jetzt auch der alte, zu ersetzende Eingang auf main (geparkt, nicht neu gebaut). Nächster und einziger kritischer Pfad: Owner gibt F1 (Eingang) in der Endversion-Vorschau frei -> dann Arbeitspakete -> Neubau Eingang mit Ersetzt-Liste. Bis dahin baut Codex nichts (kein WORKQUEUE bereit, korrekt).

### C-Eingang · Stand 31.10. 22 Uhr (verbindlich, ersetzt die Reihenfolge darunter)
1. TA-B2 erledigt: #156 gemergt, main ac6c1d2a vollständig grün.
2. **TA-B2b** (`docs/project/arbeitspakete/TRUST_ANCHOR_B2B.md`): H18-Inventar in die B2-Allowlist + dauerhafter CI-Schritt „Acceptance tests against replay DB". Owner merged.
3. **AP-01 Fassung 3** auf `kreile/b2-eingang`: Akzeptanztest neu im H18-Harness (`ap01_eingang_paket_persoenlich.integration.test.ts`), zugleich H18-Nachweis; Kunden-Typ `customerId` wie `OrderIntakeCustomerInput`. Werte in WORKQUEUE.json.

### C-Eingang · Stand 31.10. abends
**Weg (Owner hat dem Planungschat den sichersten Weg ueberlassen, U-223):** Mission KREILE-VERKAUFSSTUFE-1 ist der gueltige Gate-Rahmen (sie loest den Live-Plan V1 ab; die Rueckfrage 'Live-Plan V1' beruhte auf einem Irrtum des Planungschats). B1 ist erledigt, die Gates stehen aber noch auf B1. Reihenfolge:
1. **TA-B2** (docs/project/arbeitspakete/TRUST_ANCHOR_B2.md): Mission und Scope-Gate von B1 auf B2, Branch kreile/b2-eingang, enge Allowlist fuer AP-01, nach Muster PR154-Anker. Owner merged.
2. **AP-01 Fassung 2** (Eingang-Modul + Kanal Paket/persoenlich, getippt -> Auftrag) auf kreile/b2-eingang: korrigiert nach BLOCKER.md (Action src/app/actions/eingang.actions.ts; drei idempotente Schritte statt Einzel-Transaktion; createOrderIntake unveraendert). Migration per Probelauf gegen Dev belegt (ROLLBACK, keine Rueckstaende). Akzeptanztest-SHA in WORKQUEUE.json.
WAS bleibt BAUPLAN F1 (spec 403d1b31ad24). Kein zweiter Erfassungsweg, kein zweiter Auftrags-Schreibweg, kein Gate gelockert.

### C1a · H18-Nachtrag – Prüfer-Funktionstest 29.10. 17:25 (jetzt, vor allem anderen)

**PRÜFER 29.10. 22:12: C1a GRÜN** auf 84effe2c (Preview jo5wpnjpo). Eigener Funktionstest + DB-Beleg: Dev 61/61, letzte 20261029173000; Login 3/3; Rechte setzen/entfernen mit 'Rechte speichern' -> app_user_rights + ui_events 21:08/21:09; Wartung für alle außer Entwickler gesperrt; Phillip 'Der Tag' = 'Nichts offen'; 8/8 Auftragskarten öffnen, keine internen Codes, keine fremden Mails; Termin A-2026-0001 -> 13.11. (orders.promised_due_date + ORDER_PROMISED_DUE_DATE_CHANGED_V1), Karte öffnet danach; Zahlung im Verlauf. Nächster Schritt: C2 Owner-Klick auf jo5wpnjpo, dann Merge. Offene Owner-Entscheidung: #154 auf main umstellen (Stapel #152/#153).
- PRÜFER 30.10. 06:40: Rechnung geprüft auf f93ece18 (Preview 6gxksup79). Ausstellen funktioniert: A-2026-0006 -> R-2026-0004 (invoices issued/offen, ORDER_INVOICE_PRICES_SET_V1 + INVOICE_CREATED_V1). Knopf 'Rechnung' erscheint erst bei Station fertig (Bauplan). Mangel: keine Erfolgsmeldung nach Ausstellen. 'Rechnung ändern' gibt es absichtlich nicht (nur Storno + neu). Nachtlauf H18.8: 34/100 getestet, 9 echte Fehler behoben, Dev 65/65.
Der Prüfer hat auf `galvanik-kreile-werkstatt-d1m0go0j9.vercel.app` (e494aeeb) selbst im Browser geklickt und danach die DB abgefragt.

**Grün, mit DB-Beleg:**
- Anmelden für alle drei.
- Eigenen Code ändern und mit dem neuen Code anmelden (`own_pin_changed` um 16:24 UTC).
- Rechte-Haken setzen und entfernen (`app_user_rights.mails` bei Phillip, `granted_by` = Rolf).
- Login umbenennen (`full_name`).
- Die Liste zeigt A-2026-0001 als „Lesefehler“ statt ihn auszublenden.

**Rot:**
1. **H18.6 wirkt nicht:** Die Migration `20261029173000_h18_order_intake_due_change_integrity.sql` ist **nicht auf die Dev-DB angewendet**. Die Dev-DB endet bei `20261028234500`. A-2026-0001 zeigt deshalb weiter `ORDER_CARD_INTAKE_RECEIPT_INVALID`. Gegen Regel A7: Migration additiv auf die Dev-DB anwenden, Migrationsliste DB = Repo belegen, danach A-2026-0001 öffnen.
2. **Wartung bei Rolf anklickbar:** Der Haken „Wartung, Stufen & Anbindungen für Rolf“ ist bedienbar. Nach U-216/H11 ist Wartung nur für developer vorgesehen. Sperren wie die übrigen festen Bereiche, Server und Oberfläche gleich.
3. **„Der Tag“ bei Phillip** zeigt „Noch keine Aufträge erfasst“, obwohl 8 Aufträge existieren. Den Leerzustand-Text nach BAUPLAN F2 korrigieren: „nichts zu tun“ ist nicht dasselbe wie „keine Aufträge“.
4. **Klein:** `saveManagedUser` setzt `app_users.updated_at` beim Umbenennen nicht.
5. **Zahlung bestätigen** (A-2026-0003, Bar): Die Zahlung steht in der DB (`payments`, `PAYMENT_CONFIRMED_V1` um 16:28 UTC). In der Oberfläche erscheint aber **keine Erfolgsmeldung**, und der Verlauf der Karte zeigt die Zahlung nicht. Regel A4: Meldung am Ort der Handlung, und der Verlauf liest die Ereignisse.
6. **Interne Codes sichtbar:** Die Auftragskarte A-2026-0008 zeigt unter „Fotos & Dokumente“ `LEGACY_SCAN_UPLOAD · LEGACY_RECORDED`. Für den Nutzer verständlichen Text anzeigen, keine internen Codes.
7. **Mail-Kasten auf jeder Auftragskarte zeigt fremde Mails:** „Letzte Outlook-Mails“ listet auf jeder Karte dieselben Rückläufer („Unzustellbar …“), unabhängig vom Auftrag. Das ist eine zweite Wahrheit. Nur Mails zeigen, die diesem Auftrag zugeordnet sind, sonst den Leerzustand. Der Mail-Kanal selbst bleibt eingefroren.

**Ebenfalls grün mit DB-Beleg:**
- Zahlung bestätigen (Datenebene).
- Ware raus (`ORDER_PICKED_UP_V1`, Status `abgeholt`).
- Station „In Galvanik“ (A-2026-0006 → `galvanik`).
- Alle Hauptseiten laden ohne Fehlertext; Ausnahme ist die Auftragsliste wegen A-2026-0001, siehe 1.

Bericht und Screenshots liegen außerhalb des Repos in `galvanik_kreile/_pruefer/`.

**Regel ab jetzt:** Eine Abgabe mit Migration gilt nur, wenn die Migration auf der Dev-DB angewendet und der Gleichstand belegt ist. CI-Replay allein reicht nicht.

### C1 · H18 – Schreibaktionen ohne Wirkung (Code fertig e494aeeb; Rest siehe C1a)
Preview zum Zeitpunkt des Owner-Tests: `galvanik-kreile-werkstatt-d1d6m0aud.vercel.app` (37b0c566).

**Gemeinsame Ursache von 1–3 (Prüfer-Beleg):**
- Der letzte erfolgreiche Schreibvorgang in „Logins & Rechte“ war am **27.10. um 14:49 UTC**; das ist die letzte Zeile in `public.ui_events`. Seitdem ist keiner mehr angekommen.
- Der DB-Pfad selbst funktioniert: Ein Probelauf mit dem UPDATE `app_users` und dem INSERT `ui_events` als Transaktion, danach zurückgerollt, läuft durch. **Der Fehler liegt vor der DB**: Die Action kommt nicht an oder wird von Sitzung/Rechteprüfung abgelehnt.
- Die Meldung steht in `SettingsAdminClient.tsx:276` hinter dem modalen Dialog (`:330`).
- `systemSettingsPort.ts:394` verschluckt den Fehler ohne Log.

**Unterpunkte:**
1. Eigenen Code ändern (Konto/meincode und Logins & Rechte): Speichern ist ohne Wirkung, es kommt keine Meldung.
2. Neuer Code für einen anderen Login (`saveManagedUserAction`): dasselbe.
3. Rechte-Haken als Rolf (`setManagedUserAreaAction`): keine neue Zeile in `app_user_rights`.
4. Login bearbeiten, Name lässt sich nicht ändern: Sieht BAUPLAN F0 das vor, wird es gebaut. Sonst eine Rückfrage, nicht raten.
5. Nach „Code ändern“ gibt es keinen Rückweg: Rückweg nach BAUPLAN.
6. Auftragskarte nach Liefertermin-Änderung nicht ladbar: A-2026-0001 (`fa31ffa8-…`), `ORDER_PROMISED_DUE_DATE_CHANGED_V1` um 14:47:27 UTC, danach `ORDER_CARD_READ_ERROR ORDER_CARD_INTAKE_RECEIPT_INVALID`. Die Daten sind korrekt. Beheben ohne Datenpatch; alle 8 Aufträge müssen öffnen.
7. Die Auftragsliste blendet einen Auftrag mit Lesefehler still aus. Stattdessen eine sichtbare Zeile mit Code.

**App-weit im selben Zug:**
- a) Dialog-Baustein: Meldung im Dialog, Schließen nur bei Erfolg. Überall verwenden.
- b) Kein `catch` ohne Log in Server-Ports. Die H16.2-Override-Liste für Server-Ports wird leer.
- c) Ursache „Action kommt nicht an“ mit Datei:Zeile in die Abgabe.

**Wächter H18.8, dauerhaft:** CI listet alle Server-Actions mit Schreibwirkung. Jede braucht einen Integrationstest nach Regel A3, der sie beim Namen aufruft. Fehlende stehen in einer Override-Liste, die nur schrumpfen darf. Eine neue Schreib-Action ohne Test macht CI rot.

**Prüfschritt:**
- Für 1–7 je ein Integrationstest grün, H18.8 in CI.
- DB-Soll nach dem Owner-Klick: `own_pin_changed` bei Gregor, eine neue Zeile in `app_user_rights` mit `granted_by` = Rolf, A-2026-0001 öffnet.
- Abgabe `ABGABE_H18.md` mit Preview-Link.

### C2 · Owner-Klick und Merge #154
Erst nach C1. Den Klickweg und die DB-Prüfung bereitet der Planungschat vor. Die Owner klickt und mergt (squash). Danach arbeitet Codex auf einem neuen Branch aus `main`.

### C3 · Eingang über Arbeitspakete
- Owner-Befund 29.10. (Eingang-Paket, Pflicht): 'Neuer Eingang' zeigt bei leerem Formular 4/8 Pflichtangaben OK (Menge, Oberfläche, Übergabe=Abholung, Zahlungsmodus) = stille Vorbelegung, Verstoß gegen 'keine Ersatzwerte'. Soll: alle Pflichtfelder leer und FEHLT, bis der Nutzer wählt oder die Erkennung sie belegt.
- Owner-Befund 29.10.: Wege lang und kompliziert -> Klickzahl je Kernaufgabe im Eingang-Paket als Akzeptanzkriterium festlegen.
- Owner-Befund 29.10. (für Eingang/Mail-Paket, nicht vorher anfassen): 'Zuordnen' auf Der Tag öffnet 'Mail zuordnen' ÜBER dem Dialog 'Neuer Eingang' (Dialog auf Dialog, 7 Knöpfe gleichrangig). Rückläufer eigener Testmails (Undeliverable) landen als Zuordnungsaufgabe auf Der Tag.
Nur Pakete mit Status `bereit` aus `WORKQUEUE.json`. Solange es keins gibt, meldet Codex „warte auf Arbeitspakete“ und baut nichts.

### C4 · H17 Produktions-DB – erst in der Woche vor Go-live
Erst nach dem Owner-Schritt (Supabase-Projekt anlegen). Ablauf genau nach `docs/delivery/GO_LIVE_ABLAUF.md`.

### Gesperrt bis nach Go-live
Stationsspalten, `tenant_features`, Tenant-Default, Drizzle-Angleich, toter Code außerhalb eines ersetzenden Pakets, nächtlicher Bericht, Schreibpfade für `orders.payment_status`.

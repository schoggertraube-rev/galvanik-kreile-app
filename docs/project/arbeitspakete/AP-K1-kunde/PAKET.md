# AP-K1 · Kunde (Runde 21): eine Kunden-Komponente, ein Schreibweg, neuer Datenvertrag

Status: **bereit nach TA-B2d** – Voraussetzung: AP-01 Fassung 4 (#158) gemergt; TA-B2d (`../TRUST_ANCHOR_B2D.md`) gemergt. Fassung 1 vom 01.11.
Gate-Rahmen: Mission KREILE-VERKAUFSSTUFE-1, Block **B2** („Kundenkarte“), Branch **`kreile/b2-eingang`** frisch von main.
WAS: BAUPLAN spec `c82bf2d6d880` (BAUPLAN.json SHA-256 `1D2A62680FDCCBE6E40D2802D629972F77747BCAD0ED5FF7101D761FB3FF9DDA`, kommt mit TA-B2d auf main): `formulare.kunde` (felder, typ_felder, anzeige, vollstaendigkeit, validierung_regel, autofill, adresspruefung, daten), `bausteine_vertraege.dublette`, `bausteine_vertraege.adresse`, `bausteine_vertraege.KundeFormular`, Screens `kundeneu` (3.1) und `kundebearbeiten` (5.2). Funktionen A06, E15 (ohne Verzeichnis-Import, siehe AP-K2). Der HTML-Mock geht nicht an Codex.

## Ziel (ein Satz)
Jeder Kunde wird an genau einer Stelle angelegt und bearbeitet – eine Komponente, ein Schreibweg, eine Vollständigkeitsfunktion – mit getrennten Feldern (Anrede, Vor-/Nachname, Funktion, Straße/Nr., E-Mail für Rechnungen, Website), sodass Eingang (AP-02 F2), Kundenkarte und Rechnung dieselbe Wahrheit lesen.

## Datenfluss
Komponente `KundeFormular` (Typ Firma | Privat; Lieferant später mit Eingangsrechnungen) → Client prüft je Feld mit denselben Grenzen wie der Server → `createCustomerAction` bzw. `updateCustomerCommercialAction` → **ein** Server-Schreibweg (createCustomerCommand / updateCustomerCommand) → `public.customers` (neue Spalten) → erneut lesen → Kundenkarte, Kundenliste, Suche, Eingang.

## Bauen
1. **Migration** `migration.sql` (dieser Ordner) bytegleich als `supabase/migrations/<zeitstempel>_b2_kunde_k1.sql`, SHA-256 `C724DA84283D94E7EEA1684EA9DF720EAA9D6356AB0C1DD290426B5F2CC380F7`. Probelauf 01.11. gegen Dev mit ROLLBACK fehlerfrei; Teilung belegt („Frau Sabrina Schmidt“ → frau/Sabrina/Schmidt; „Müller & Söhne“ → unsicher, Tag `name_pruefen`; alle 12 Dev-Kunden geteilt). Nur additiv; `contact_person` bleibt als stillgelegte Spalte.
2. **Ein Schreibweg:** Create und Update nehmen `customerType`, `companyName`, `salutation` (frau|herr|ohne|null), `firstName`, `lastName`, `contactRole`, `phone`, `email`, `billingEmail`, `website`, `street` (ohne Nr.), `houseNumber`, `zipCode`, `city`, `country`, `paymentPreference` (nur mit `geld`), `vatId` (nur Firma), `notes`. `name` bildet **nur der Server** nach `formulare.kunde.anzeige.name` (Firma = Firmenname, Privat = „Vorname Nachname“). Eine neue SQL-Funktion für den Schreibweg ist erlaubt (z. B. `create_customer_v2`); der Code ruft danach **nur** sie, nie mehr die alte. `contact_person` wird nirgends mehr geschrieben.
3. **Altes Eingabeformat** (`contactPerson`, `name`, „Straße Nr.“ ohne `houseNumber`) wird serverseitig über **dieselbe** Teilungsregel wie die Migration normalisiert (`private.kunde_split_name`, `private.kunde_split_street`). Das ist kein zweiter Weg; es hält die Akzeptanztests von AP-01 gültig. Neue Oberflächen senden nur das neue Format.
4. **Validierung** genau nach `formulare.kunde.felder[].validierung` in Client und Server (VALIDATION_ERROR je Feld). PLZ: DE 5 Ziffern, AT/CH 4 Ziffern, sonst 2–10 Zeichen.
5. **Eine Vollständigkeitsfunktion** `kundeVollstaendigkeit(kunde, { geld })` in `src/modules/customers/orderReadiness.ts`, Export über `src/modules/customers/public.ts`. Rückgabe `{ vollstaendig: boolean; felder: string[]; fehlt: string[]; text: string | null }`: `fehlt` = Labels nach `formulare.kunde.vollstaendigkeit.labels` in dieser Reihenfolge, `felder` = Feldschlüssel (z. B. `lastName`, `zipCode`), `text` nach `.text` bzw. `.ohne_geld`. Die F4-Prüfung wird **diese** Funktion (kein zweiter Prüfer); `CUSTOMER_INCOMPLETE.missing` = `felder`.
6. **Adressprüfung** nach `formulare.kunde.adresspruefung` und `bausteine_vertraege.adresse` gegen `public.address_directory`. Hat das Verzeichnis für das Land **keine Zeilen** (bis AP-K2 überall), gilt der Zustand `fehler` („Prüfung gerade nicht möglich – wird beim Speichern geprüft“), es wird nicht gesperrt und mit `address_status = NULL` gespeichert („Anschrift ungeprüft“). „Adresse stimmt so“ speichert `bestaetigt` mit Zeitpunkt.
7. **Komponente `KundeFormular`** nach `typ_felder` (Reihenfolge, Zwischenüberschrift „Ansprechpartner“, `ohne_wahl`, `wechsel` mit Rückfrage – nichts verschwindet still). Eingesetzt in **3.1 Kunde anlegen** (rail: Dublette → Adresse → Prüfliste) und **5.2 Kunde bearbeiten** (Modus fehlende_zuerst, Aufrufe `{kunde}#fehlend`, `{kunde}#uebernahme`). Die bisherigen Kundenfelder (`CustomerFormFields` im Eingangsmodul, Kundenkarten-Formular) werden durch sie **ersetzt**, nicht daneben gestellt. Eingang Abschnitt 1 bleibt wie in AP-01 F4 (Anzeige + Sperre); Inline-Neukunde/Ergänzen kommt mit AP-02 F2 über dieselbe Komponente.
8. **Dublette** nach `bausteine_vertraege.dublette` live über die bestehende Serversuche (eine Normalisierung, auch für die Sortierung der Kundensuche). Aktionen „Diesen Kunden bearbeiten“ (→ 5.2 `#uebernahme`), „Vorhandenen öffnen“, „Ist ein anderer Kunde“.
9. **Autofill (ohne Verzeichnis):** Suchtext nach Muster (E-Mail → E-Mail, Telefon → Telefon, sonst Firmenname bzw. „Vorname Nachname“ geteilt), E-Mail-Domain → Website-Vorschlag (nicht bei Freemail, Liste `eingang.zuordnung.freemail`), Telefon normalisiert gespeichert. Jeder Vorschlag mit Herkunft, nie still übernommen. PLZ→Ort/Straßen-Vorschläge erst mit AP-K2.
10. **Anzeige überall umstellen:** jede Stelle, die `contact_person`/`contactPerson` liest (Kundenkarte, Kundenliste, Suche, Rechnung „z. Hd.“, Lieferschein, Mail-Platzhalter `{anrede_zeile}`, 3.4), nutzt `formulare.kunde.anzeige`. In der Abgabe vollständige Liste (grep) alt → neu.

## Nicht anfassen
`orderIntakeCommand` NEW (ohne UI-Aufrufer; Umstellung auf den Kunden-Schreibweg in AP-02 F2), Lieferant-Modus, Import des Adressverzeichnisses (AP-K2), Internet-Abgleich (Z11, Stufe 4), Entwürfe (X12, Stufe 2).

## Rechte
3.1/5.2: `kunden`; Zahlungsbedingung nur mit `geld` (ohne `geld` kein Feld, kein Payload, Server ignoriert nichts still, sondern lehnt ab). Client und Server prüfen dieselbe Regel.

## Gate
- Akzeptanztest `apk1_kunde_datenvertrag.integration.test.ts.txt` bytegleich nach `src/test/acceptance/apk1_kunde_datenvertrag.integration.test.ts`, SHA-256 `CFFFA0314A4BA1EA50969C5070F1438E984B80FFF7BCCC128C4B81820ABC42A1`. Nie ändern. Die Tests von AP-01 (`BE54C2C5…`, `4B67978D…`) müssen grün bleiben.
- H18: Der neue Test ist zusätzlicher Nachweis für `createCustomerAction` und `updateCustomerCommercialAction` (Einträge ergänzen, `inventorySha256` nachführen).
- Migration auf Dev anwenden, Gleichstand Repo = DB belegen. A11-Strecke inkl. `git diff --check origin/main`.
- Abgabe `docs/delivery/ABGABE_AP-K1.md`: SHA, READY-Preview genau dieses SHA, Checks, Test- und Migrations-SHA, DB-Beleg (Dev-Kunden nach Teilung), Liste der ersetzten Kundenfelder/Leser von contact_person, Assertions alt → neu.

## Abnahme (Owner-Klickweg)
1. Kunden → „Kunde anlegen“: oben groß „Firma oder Privat?“. 2. Firma wählen: Firmenname, darunter „Ansprechpartner“ mit Anrede, Vorname, Nachname, Funktion; Straße und Nr. getrennt. 3. Telefon eines bestehenden Kunden tippen → Dublettenhinweis „Diesen Kunden gibt es schon“. 4. Andere Daten, speichern → Kundenkarte zeigt „Frau Nora Neu · Einkauf“. 5. Kunde „Sabrina Schmidt“ öffnen → Bearbeiten: Anrede/Vor-/Nachname sind getrennt übernommen; Land Schweiz → speichern. 6. Privat anlegen → Kundenliste zeigt „Vorname Nachname“.

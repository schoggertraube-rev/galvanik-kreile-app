# Kreile – Bauauftrag Stufe 1 an Codex (verbindlich)

Owner: Siglinder · Stand 25.10.2026 · Repo `schoggertraube-rev/galvanik-kreile-app`, lokal `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app`
Prüfer: Claude (unabhängig). Du baust, du prüfst nicht selbst ab, du mergst nie.

## 0. Regeln (gelten für jedes Paket)

1. **Einzige Bauquelle** ist `docs/delivery/KREILE_BAUUMFANG_STUFEN.html` (Tab „Bauumfang“, IDs E01…S03) plus dieses Dokument. Was dort nicht steht, wird nicht gebaut.
2. **Optik** ausschließlich aus `docs/project/linie/ui/`:
   - Rahmen, Navigation, Der Tag: `KREILE_STARTSEITE_ROLF_V8_2026-08-20.html`
   - Werkstatt-Home: `KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html`
   - Auftrag (Detail): `KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html`
   - Kunde (Detail): `KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html` (ohne Analyse-/Marketing-Teil)
   - Abläufe und Zwischenschritte: `KREILE_GESAMTMOCK_V5_2026-09-14.html`
   - Tokens und Komponenten: `designsystem_v1_1/`
   Keine neuen Bausteine. Listenansichten ohne eigene Vorlage (Aufträge, Geld, Kalender) nur aus V8-Bausteinen `field`, `row`, `pi`, `modstrip`, so wie in der Bauumfang-HTML gezeigt.
3. **Gesperrte Funktionen** (Stufe 2–4) im V8-Muster: Navigation `nav planned` + „geplant“, Inhalt `modstrip` mit Tag „kommt · Paket“. Nicht klickbar, keine leere Seite.
4. **Daten vollständig ab Stufe 1.** Pflichtfelder Kunde und Auftrag stehen im Tab „Bauumfang“. Kein Datensatz darf ohne Pflichtfelder gespeichert werden. Spätere Pakete lesen nur.
5. **Keine Governance-Arbeit.** Keine Änderungen an `scripts/quality/**`, `.github/workflows/**`, `AGENTS.md`, `missions/**`, `quality/**`, außer ein Paket nennt es ausdrücklich.
6. **Datenbank:** Alte Migrationen nie ändern. Je Paket genau eine neue Migration `supabase/migrations/<YYYYMMDDHHMMSS>_s1_<paket>_<thema>.sql`. Erst lokal auf frischem Replay grün.
7. **Module:** Code nur in `src/modules/<modul>/` über `public.ts`/`server-public.ts`, Manifest pflegen, `npm run quality:module-gates` grün. Neues Modul nur, wenn das Paket es nennt.
8. **Unklar = stoppen, nicht raten.** Eine Frage an den Owner mit genau einer Entscheidung, an der Stelle in der App „In Klärung“ ausgegraut. Weiterbauen am Rest.
9. **Ein Branch je Paket**, Name `kreile/s1-<paket>`, abgezweigt vom Branch des vorigen Pakets (gestapelt, PR-Basis = voriger Branch). Draft-PR, nie mergen. Gemergt wird nur vom Owner, nachdem er die Preview gesehen hat.
10. **Daten:** Keine Daten in der Live-Datenbank anlegen, ändern oder löschen. Eigene Prüfungen nur im Fresh-Replay.

## 1. Abgabe je Paket (Pflicht, Datei `docs/delivery/ABGABE_<paket>.md`)

1. Preview-URL und exakter SHA
2. Welche Rolle was auf der Preview sieht (ohne PINs)
3. Tabelle: ID · gebaut ja/teilweise/nein · Route · Datei · Test
4. Abweichungen von Vorlage/Bauumfang, je Zeile ehrlich
5. Checks am SHA: `npx tsc --noEmit`, `npm run lint:full`, `npm run test:unit`, `npm run build`, `npm run quality:module-gates`, Paket-E2E unter `e2e/`
6. Screenshots 1914×917, 1220×880, 390×844 je neuer Seite

## 1a. Zugänge

Nutzer Rolf, Phillip und Gregor existieren bereits in der App (Login zeigt sie). Keine neuen Nutzer, keine Testnutzer, kein zweites Datenbankprojekt. Die PINs kennt der Owner; sie gehören nie ins Repo oder in Abgaben. Für eigene Prüfungen nutzt du Fresh-Replay und Tests.

## 1b. Dauerlauf: so arbeitest du ohne Pause

Starte mit `/goal Stufe 1 P1–P5 nach docs/delivery/KREILE_CODEX_BAUAUFTRAG_STUFE1.md`.
1. Paket bauen → Abgabe-Datei → Draft-PR aktualisieren → sofort das nächste Paket beginnen. Nicht auf den Owner warten.
2. Vor jedem neuen Paket `_review/REVIEW_<paket>.md` lesen (Ordner `_review/` im Repo-Stamm, in `.gitignore` eintragen, nie committen; schreibt nur Claude). Steht dort FAIL: zuerst genau diese Punkte im betroffenen Branch beheben, dann weiter.
3. Blockiert etwas (Zugang, Schlüssel, Owner-Entscheidung): Eintrag in `docs/delivery/OWNER_TODO.md` mit genau einem Schritt für den Owner und deiner Empfehlung. Dann mit allen nicht blockierten IDs weiterbauen.
4. Am Ende jeder Abgabe der Abschnitt „Nächster Schritt“: was du als Nächstes baust und was der Owner tun muss (oder „nichts“).
5. Du stoppst nur bei: Feature-Stopp 29.11., FAIL im Review zweimal am selben Punkt, oder Konflikt mit §3.

## 2. Pakete in dieser Reihenfolge

### P0 · B1-Korrektur · bis Mo 26.10.
Branch: weiter `kreile/b1-shell` (PR #152).
- `src/components/layout/MockAppFrame.tsx`: Label zurück auf „Kunden & Kontakt“ (V8).
- Navigation exakt wie Bauumfang-HTML: Bereiche Der Tag, Werkstatt, Aufträge, Kunden & Kontakt, Geld & Rechnungen, Zahlen (geplant); Weiteres: Kalender (geplant bis P3), Material & Einkauf (geplant), Einstellungen.
Abnahme: Owner loggt sich auf der Preview je Rolle ein und landet auf dem richtigen Home. Screenshots aus dem Fresh-Replay. 

### P1 · Datenfundament · 27.10.–01.11. · IDs S01, S02, S03, A06, E02, A04 (Verlauf)
Branch `kreile/s1-p1-daten`, abgezweigt vom aktuellen Stand `kreile/b1-shell` (PR #152 bleibt offen bis Owner-Merge; PR-Basis von P1 = `kreile/b1-shell`). Migration `..._s1_p1_datenfundament.sql`.
- **S01 Firmendaten:** Tabelle `public.company_settings` existiert (Quelle des Rechnungsabsenders in `supabase/migrations/20260821152949_f1_4_immutable_invoice_contract.sql`). Nur Pflege-UI unter `/settings` (Admin) bauen: Name, Straße, PLZ, Ort, Land, USt-ID/Steuernummer, IBAN, BIC, Bank, Zahlungsziel, Logo. Nummernkreise anzeigen, nicht änderbar.
- **S02 Leistungskatalog:** neues Modul `src/modules/katalog/` (Aufbau wie `src/modules/quotes/`). Tabelle Leistungen: Bezeichnung, Oberfläche, Einheit, Nettopreis, Steuersatz, Standard-Durchlaufzeit in Arbeitstagen, aktiv. Pflege unter `/settings`. Lesen über `public.ts` für quotes, orders, invoice.
- **S03 Nutzer & Rollen:** Admin legt Nutzer an, vergibt Rolle, setzt PIN, sperrt. Vorhandene Auth unter `src/app/settings/` nutzen, keine neue Auth.
- **A06 Kunde vollständig:** Der kanonische Anlage-Befehl `src/modules/customers/server/createCustomerCommand.ts` und der Vertrag `20260914100000_path1_customer_persistence_contract.sql` speichern heute KEINE Straße, PLZ, Land und keine Zahlungsbedingung. Die Rechnung verlangt Straße und PLZ (sonst blockiert). Neue Migration erweitert den Befehl: Straße, PLZ, Ort, Land (Pflicht), Zahlungsbedingung (Pflicht: `rechnung_<tage>` / `vorkasse` / `bar`), USt-ID (optional). Bestehende Spalten in `public.customers` nutzen (`street`, `zip_code`, `country`, `payment_preference`). Kundenkarte V2 zeigt und bearbeitet diese Felder.
- **E02/A04 Auftrag vollständig:** Der Intake-Vertrag `20260812133649_f1_order_intake_contract.sql` speichert heute weder Liefertermin noch Preis. Erweitern: Positionen aus Leistungskatalog mit Menge, Material, Oberfläche, Nettopreis, Steuersatz (in `public.items`, die Rechnung liest dort `base_lines`); `promised_due_date` Pflicht. Jede Terminänderung nur mit Grund, als Ereignis gespeichert.
Abnahme: Kunde ohne Adresse oder Zahlungsbedingung nicht speicherbar; Auftrag ohne Liefertermin oder Preis nicht speicherbar; ein so angelegter Auftrag ist nach „fertig“ ohne Nacharbeit abrechenbar (vorhandener Test `e2e/f1-4-immutable-invoice.real.spec.ts` mit neu angelegtem Kunden grün).

### P2 · Angebot, Eingang, Suche · 02.–08.11. · IDs A07, E03, E04, E05, R02, A08
Branch `kreile/s1-p2-eingang`.
- **A07:** `src/modules/quotes/` hat Persistenz und Lebenszyklus. Ergänzen: Positionen aus Katalog, KV-PDF, Zuschlag übernimmt Liefertermin.
- **R02:** Mailversand über Microsoft Graph (Owner-Testkonto), Anhang KV/Rechnung/Lieferschein, Kopie als Ereignis am Vorgang.
- **E05:** Outlook-Posteingang lesen, Mail am Kunden ablegen, aus Mail Kunde oder KV anlegen.
- **E04:** Azure Document Intelligence (Owner-Testkonto). Ergebnis nur Vorschlag mit Fundstelle und Sicherheit, Übernahme erst nach Bestätigung in KV oder Auftrag.
- **E03:** Foto/Dokument an Kunde und Auftrag (privater Storage vorhanden).
- **A08 Suche:** `src/modules/suche/server/searchTenant.ts` kennt heute nur Kunden und Aufträge über feste `SearchPorts`. Umbauen auf Anbieter-Register: Jedes Modul meldet einen Suchanbieter an (Typ, Name, Suchfunktion). Stufe 1 meldet an: Kunden, Aufträge, Angebote, Rechnungen, Dokumente, Mails, Termine. Suchleiste zeigt „Durchsucht: …“. Ein neuer Anbieter darf keine Änderung an der Suchleiste brauchen (Test dafür).
Zugangsdaten für Graph und Azure fragt Codex beim Owner ab, keine Secrets ins Repo.

### P3 · Termintreue und Der Tag · 09.–15.11. · IDs A01, A02, A09, A03, R01, A05
Branch `kreile/s1-p3-termine`.
- **A02:** Puffer = Liefertermin − heute − Standard-Durchlaufzeit der Oberfläche (Katalog). Rot < 0, Gelb ≤ 1 Arbeitstag.
- **A09:** Punkte in „Das braucht dich“ (V8-Muster) mit „Termin sichern“ und „Kunde vorwarnen“ (Mail-Entwurf über R02).
- **A01:** Der Tag nach V8 aus echten Ereignissen: Zähler dringend/weitere, „erledigt, sobald …“, Heute raus, Neu seit gestern.
- **A03/R01:** Kalender nach Outlook schreiben, Outlook-Termine lesend; Wochenansicht nur Anzahlen, keine Auslastung. Navigation „Kalender“ wird scharf.
- **A05:** Werkstatt-Home nach Phillip V4 vollständig.

### P4 · Rechnung, Zahlung, Ausgang · 16.–22.11. · IDs R03, R04, R05
Branch `kreile/s1-p4-geld`.
- Vorhandene Befehle nutzen: `src/lib/server/commands/immutableInvoiceCommand.ts`, `confirmPaymentCommand.ts`, Vertrag `20260909170000_f1_5_payment_goods_out_v2_contract.sql`.
- **R03:** Storno per Gutschrift mit eigener Nummer (Ansatz im Branch `claude/kr-b1-storno-p0` prüfen, nicht blind übernehmen). PDF mit allen Pflichtangaben.
- **R05:** Lieferschein-PDF; Vorkasse-Sperre aus Zahlungsbedingung des Kunden.
- **Kein DATEV-Export** (R06 gehört zu Stufe 2), nur als gesperrte Stelle zeigen.

### P5 · Datenkiste und Abschluss · 23.–29.11. · ID E01 + gesperrte Stellen
Branch `kreile/s1-p5-kiste`.
- **E01:** Upload beliebiger Dateien, Typ erkennen, Kunden/Kontakte gegen Pflichtfelder anlegen, fehlende Felder als „fehlt“ markieren, Dubletten zeigen, Übernahme erst nach Prüfung. Alte Rechnungen/Lieferscheine werden Dokumente am Kunden, keine Aufträge. Admin schließt/öffnet die Kiste.
- Alle Stufe-2–4-Stellen gesperrt im V8-Muster, wie in der Bauumfang-HTML.
- Feature-Stopp 29.11. Danach nur Fehler.

## 3. Was du nie tust
Merge nach `main`, Produktions-Datenbank, Deploy auf Produktion, kostenpflichtige Dienste aktivieren, Echtdaten ändern, Demo-Daten in Produktpfade, Funktionen außerhalb des Bauumfangs, Optik außerhalb der Vorlagen.

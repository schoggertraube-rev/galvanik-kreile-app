# Kreile · Aktuelle Anweisung an Codex (Stand 26.10.2026, ersetzt bei Widerspruch alle älteren Einträge)

Ziel bis 29.11.: Stufe 1 fertig und benutzbar. Vorrang hat, was Kreile täglich braucht: Kunde und Auftrag schnell, vollständig und fehlerfrei erfassen, sehen, bearbeiten, weiterschalten. Nicht Testtechnik, nicht Pixelgenauigkeit.

## Arbeitsregeln
1. **Zeitlimit 30 Minuten** für jedes Test-, Werkzeug- oder Umgebungsproblem (Playwright, Docker, Replay, Locator). Danach: Problem in der Abgabe notieren, weiterbauen. Kein stundenlanges Debuggen von Tests.
2. **Nachweis je Paket:** gezielte Unit-Tests der geänderten Teile + du klickst den Kernweg selbst auf der Preview (Screenshot je Schritt) + Owner-Abnahme 5 Minuten. Der lange E2E `f1-4-immutable-invoice.real.spec.ts` ist **kein Merge-Gate mehr**, er läuft nur in CI mit.
3. Mindestens alle 2 Stunden ein Commit mit funktionierendem Zwischenstand, gepusht.
4. Ein Schreiber (du). Merge nur durch Owner. Squash-Merge je Paket, höchstens 2 offene Pakete gestapelt. Datenbank (Projekt `syhaigjhsbpjmtnggqka`) nach jeder neuen Migration nachziehen.
5. Vor jedem Paket `_review/OWNER_ENTSCHEIDUNGEN.md`, `_review/REVIEW_*.md` und diese Datei lesen.

## Reihenfolge ab jetzt
**A · Sofort (heute):** aktuellen P1-Stand inkl. REVIEW_P1-Korrekturen committen und pushen. Gregor-Login-Fehler auf `/settings` beheben. Einstellungen über Rollen statt Namen: Rolf (meister), Gregor (admin/developer) dürfen alles; Menüpunkte nie ins Leere.

**B · Kernweg Kunde & Auftrag (P1b, Vorrang vor P2):**
- Genau ein Neukunden-Formular und ein Schreibweg (`createCustomerCommand`, mit Kundennummer). „Infos rein“ und „+ Anlegen“ öffnen denselben Dialog „Neuer Eingang“.
- Neuer Eingang in 3 Schritten: 1 Kunde & Vereinbarung · 2 Positionen · 3 Prüfung/Belege.
- Auftrag nur mit vollständigem Kunden: Name/Firma, Ansprechpartner, Telefon und E-Mail, Anschrift, Zahlungsbedingung. Fehlt etwas, die fehlenden Felder direkt in Schritt 1 ergänzen lassen. Interessent ohne Auftrag mit Name + Telefon erlaubt, als „unvollständig“ markiert. Gilt auch für bestehende Kunden.
- Positionen: Leistung aus Katalog füllt Oberfläche, Einheit, Preis vor; Felder breit genug.
- Auftragskarte: Ortskette antippbar zum Weiterschalten (angenommen → Galvanik → fertig → Zahlung → abgeholt/verschickt), Liefertermin relativ und rot bei Verzug, Aktionsleiste (Fertig · Status-Mail · Anrufen · Foto · Mehr), Positionen/Termin (mit Grund)/Notiz bearbeitbar. Altwert `station = "wareneingang"` per Datenmigration auf `angenommen`, Spaltenstandard korrigieren. Stundensatz-Voraussetzung für „Fertig“ pflegbar machen oder entfernen.
- Kundenkarte: Kontakt im Kopf, aktive Aufträge, Notizen/Telefonnotizen, Schnellaktionen (Neuer Auftrag, Anrufen, E-Mail, Bearbeiten), alles bearbeitbar.

**C · Optik (nur das, kein Neuentwurf):**
- Farben ausschließlich aus `docs/project/linie/ui/designsystem_v1_1/tokens.css` inkl. V1.1-Block (neutrale Flächen, Weiß, keine Verläufe). Fest eingetragene Hex-Farben in `TargetShell.module.css`, `orders.module.css`, `customers.module.css`, `settings.module.css` durch Tokens ersetzen.
- Aufbau und Größen bleiben wie Rolf V8 / Auftragskarte V8 / Kundenkarte V2: gut lesbar, Bedienflächen mindestens 48 px auf Touch, Schrift nicht kleiner als V8. Der Prototyp `designsystem_v1_1/kundenansicht` ist zu klein und schlecht bedienbar und gilt nur für Farben und Inhalte, nicht für Größen.
- Feinschliff der Optik kommt im Dezember, jetzt nicht.

**D · Ladezeit:** Funktionsregion `fra1`, danach messen, Ziel unter 2 s je Seite.

**E · Danach** P2 (S04 Stufen-Schalter, Suche als Anbieter-Register, M365/Azure sobald der Owner die Werte in Vercel eingetragen hat), P3, P4 (DATEV gebaut, Schalter aus), P5.

## Abgabe je Paket
`docs/delivery/ABGABE_<paket>.md` mit: Preview-Link + SHA · Tabelle ID → gebaut/teilweise/nein · Abweichungen · Ladezeit · Datenbank = Repo · Abschnitt „Owner-Abnahme (5 Minuten)“ mit höchstens 5 Klickschritten und erwartetem Ergebnis · „Nächster Schritt“.

## Gegen Schleifen und Drift (Owner-Entscheid 26.10., verbindlich)
1. **Eine Korrekturrunde je Paket.** Nach dem ersten REVIEW-FAIL behebst du genau die dort genannten Blocker, einmal. Was danach noch offen ist und kein Blocker ist, kommt in `_review/DEZEMBER_LISTE.md` und wird jetzt nicht bearbeitet.
2. **Blocker sind nur:** Daten gehen verloren oder fehlen (Pflichtdaten), Sackgasse im Kernweg, Sicherheit/Rechte, verbotene Dateien, Funktion fehlt oder geht nicht, Farben nicht aus Tokens. **Kein Blocker:** Abstände, Texte, Feinoptik, Testkomfort, zusätzliche Tests, Refactoring.
3. **Nur bauen, was in dieser Datei steht.** Neue Ideen, Verbesserungen, Aufräumarbeiten → `_review/DEZEMBER_LISTE.md`, nicht umsetzen.
4. **Zeitlimit 30 Minuten** pro Test-, Werkzeug- oder Umgebungsproblem, dann notieren und weiter.
5. **Produkt vor Tests:** Jeder Commit ändert Produktcode (`src/`, `supabase/migrations/`). Reine Test-/Konfigurations-Commits nur zusammen mit dem Produktcommit, den sie absichern.
6. **Tagesrhythmus:** Bis 17:30 Uhr jeden Tag ist der Tagesstand gepusht und auf der Preview klickbar; Abgabe bzw. Kurzstand in `docs/delivery/` mit Abschnitt „Owner-Abnahme (5 Minuten)“. Der Owner prüft einmal am Tag um 18 Uhr.

## Klarstellung 26.10. abends (Owner-Entscheid, geht „Gegen Schleifen und Drift“ vor)
1. **Regeln nie als Grund zum Anhalten verwenden.** Ist eine Regel unklar, wähle die Auslegung, mit der weitergebaut wird, und notiere sie in der Abgabe. Stoppen nur bei: Datenverlust-Risiko, Production, Merge, Kosten.
2. **„Eine Korrekturrunde je Paket“ gilt nur für REVIEW-Befunde**, nicht für noch nicht gebauten Umfang. Fehlender Umfang (z. B. Interessent mit Name + Telefon) wird einfach weitergebaut. P1b: Interessentenweg jetzt bauen, keine Amendierung nötig.
3. **Abgabe-, OWNER_TODO- und Dezember-Dateien** dürfen im nächsten Produktcommit mitgehen oder als eigener kleiner Doku-Commit (`docs(delivery): …`) – das ist erlaubt. Verboten bleiben nur reine Test-/Konfig-Commits ohne Produktbezug.
4. **Fehlt etwas vom Owner (z. B. Rolf-Code):** in OWNER_TODO eintragen und **sofort am Nächsten weiterbauen** (Reihenfolge B → C → D → E). Für eigene Preview-Klicks bis dahin den Gregor-Login verwenden; Screenshots als Rolf werden nachgereicht.
5. Ist P1b bis auf Owner-Zuarbeit fertig, **beginne P2** auf dem nächsten Branch (Stapeltiefe max. 2).


## F – OWNER-ABNAHME P2 NICHT BESTANDEN (26.10. 20:30) – Vorrang vor P3

Owner hat die Preview als Rolf geöffnet: sichtbar „alles beim Alten“. Belegt am Produkt-SHA 5cb2d56e:

1. **Farben nicht V1.1.** `src/styles/tokens.css` verweist auf `var(--ground)`/`var(--surface)`, die nur in `src/styles/mock/mock-kreile-rolf-home.css:14` und `mock-kreile-phillip-home.css:14` definiert sind – mit den alten Beige-Werten `#EFE6D6 / #FFFDF9 / #E1D5BE`. „0 Hex“ war wahr, das Ergebnis trotzdem beige. Änderung: die Werte selbst auf V1.1 setzen (ground #F4F2EE, surface #FFFFFF, line #E4E0D8, rand #D5D0C7, flaeche #F7F6F3; Quelle `docs/project/linie/ui/designsystem_v1_1/`), einmal zentral, Mock-Dateien nicht mehr als Wertquelle. Größen bleiben wie V8.
2. **Doppelter Einstieg besteht weiter.** „+ Anlegen“ öffnet in `src/components/layout/GlobalCreateFlow.tsx` weiterhin „Was möchtest du anlegen?“ (Kunde / Auftrag-KV / Offene KVs) neben „Neuer Eingang“. Owner-Entscheid 26.10.: ein Einstieg. „+ Anlegen“ und „Neuer Eingang“ öffnen denselben 3-Schritt-Fluss (Schritt 1 Kunde suchen oder neu, fehlende Pflichtfelder inline). Offene KVs erreichbar über Aufträge/Suche, nicht als eigener Anlege-Weg.
3. **Gefühlt langsam.** Am Preview als Rolf messen und in der Abgabe nennen: Login→Der Tag, Klick „+ Anlegen“→Dialog, Speichern Neukunde. Ziel warm < 1 s je Schritt; Ursache beheben, wenn darüber.

Erst wenn 1–3 am Preview sichtbar sind: neue ABGABE_P2 mit **Screenshots Der Tag + Anlege-Dialog** neben dem V1.1-Prototyp (`kundenansicht/index.html`). Danach P3 weiter. Kein Merge von #154 vorher.

**Für den Prüfer (ab sofort, jede Abgabe):** PASS nur nach Sichtvergleich am Preview-Screenshot gegen V1.1 und gegen die Owner-Entscheide zu sichtbaren Punkten. Hex-Zählen allein ist kein Nachweis. Berechnete Farbe von `body`/Hauptfläche angeben.


## G – Owner-Sichtung 26.10. 23:35 (F bestätigt, schneller) – in P3 mit erledigen

1. Neuer Eingang Schritt 1: „Firma / Name“ und „Firmenname“ doppelt. Ein Namensfeld; bei Kundentyp Firma = Firmenname, bei Privat = Name.
2. Werkstatt-Karte zeigt „Sabrina Schmidt · Sabrina Schmidt“ (Kunde + Ansprechpartner identisch) – Ansprechpartner nur anzeigen, wenn abweichend.
3. Werkstatt „In Arbeit (Galvanik) 0 Aufträge · 1 werden knapp“ widersprüchlich – Zahl und Hinweis aus derselben Quelle oder Hinweis eindeutig benennen.
4. „Kalender – GEPLANT“ entfällt mit P3 (Kalender ist gebaut).


## H – Owner-Abnahme 27.10.: Anlegen nicht V1.1 – Vorrang vor P3, ersetzt F.2

Owner: „+ Anlegen“ öffnet sofort ein unübersichtliches Neukunden-Formular, keine Auswahl; Knopf-Lage und Ablauf entsprechen nicht der letzten Version. F.2 (Auswahl entfernen) war falsch formuliert – Maßstab ist der V1.1-Prototyp, nicht „Auswahl weg“.

Verbindliche Quelle: `docs/project/linie/ui/designsystem_v1_1/kundenansicht/index.html`, Funktionen `dlgEingangSeite()` (Desktop/Tablet, eine Seite mit Sprungleiste Kunde·Positionen·Prüfung) und `dlgEingang()` (Handy, 3 Schritte), sowie `OFFENE_FRAGEN_DESIGN.md` OF-12 (Plus im Marken-Verlauf) und OF-13 (Plus UND Seitenleiste „Neuer Eingang“, beide öffnen denselben Eingang).

Abschnitt Kunde genau so:
1. **Art**: Segment `Auftrag | KV` ganz oben.
2. **Kunde**: Auswahl/Suche der bestehenden Kunden (`Name · Kundennummer`), letzter Eintrag „Neukunde anlegen“. Kein Kunde vorausgewählt.
3. Nur bei „Neukunde anlegen“ erscheinen die Felder: Name/Firma (ein Feld, kein zweites „Firmenname“), Ansprechpartner, Telefon, E-Mail, Straße, PLZ, Ort (Land vorbelegt Deutschland, USt-ID optional einklappbar).
4. Bei bestehendem Kunden mit Lücken: nur die fehlenden Pflichtfelder einblenden.
5. Darunter Wunschtermin, Übergabe `Abholung | Versand`, Zahlungsmodus (Optionen abhängig von Übergabe wie `zahlOptionen()`), Eingangsart.
Pflichtdaten-Sperre aus P1b bleibt unverändert.

Plus-Knopf: Lage, Größe und Farbe wie im V1.1-Prototyp (Größen wie V8, Touch ≥ 48 px).

Nachweis: Screenshot App und Prototyp **im gleichen Zustand nebeneinander** (Desktop 1914 px und Handy 390 px): (a) Eingang frisch geöffnet, (b) „Neukunde anlegen“ gewählt, (c) bestehender Kunde mit fehlender E-Mail. Ohne diese Paare kein PASS.

**Prüfer:** PASS für sichtbare Punkte nur mit Paar-Screenshot App ↔ V1.1-Prototyp im selben Zustand.


## I – PAKET „OBERFLÄCHE V1.1“ (27.10., Owner-Auftrag) – vor P3, ersetzt F.2 und ergänzt H

**Befund (Prüfer, f8fed7ce):** Das freigegebene Designsystem liegt fertig als React-Bauteile vor: `docs/project/linie/ui/designsystem_v1_1/components/*.tsx` (33 Dateien: AppShell, GlobalesPlus, Handlungsbedarf, Seitenblatt, Karte, Formular, Suche, Zeitstrahl, Zeile, Kundenzeile, Dialog …). Die App lädt nur `tokens.css` und `komponenten.css` (`src/app/globals.css:2-3`), **benutzt aber keines dieser Bauteile**. Die Bildschirme sind Altbestand mit neuer Farbe. Darum sieht nichts aus wie V1.1.

**Auftrag – übertragen, nicht neu gestalten:**
1. Die 33 Bauteile unverändert nach `src/ui/kr/` kopieren (Inhalt identisch, nur Importpfade anpassen). Keine eigenen Varianten, keine Umbenennung.
2. Jeden Bildschirm aus diesen Bauteilen zusammensetzen, genau wie in `kundenansicht/index.html` (Zuordnung Bauteil→Datei steht in `README.md`): Shell + GlobalesPlus, Der Tag (Rolf), Werkstatt (Phillip), Aufträge, Kunden, Auftragskarte und Kundenkarte als Seitenblatt, Neuer Eingang (`dlgEingangSeite` / `dlgEingang`, siehe H), Befehlspalette.
3. Fachlogik bleibt: Daten, Pflichtdaten-Sperre, Rechte, Aktionen werden an die neuen Bauteile angeschlossen, nicht neu gebaut.
4. Was der Prototyp nicht zeigt (z. B. Einstellungen): mit denselben Bauteilen, kein eigenes Layout.
5. Alte Bildschirmbauteile, die ersetzt sind, nicht mehr verwenden.

**Maschinelle Abnahme (kein Text-Nachweis):**
- Skript `scripts/ui/v11-paare.mjs`: rendert Prototyp und Preview im selben Zustand und legt **Bildpaare** ab – Desktop 1914×917, Tablet 1220×880, Handy 390×844 – für die Zustände, zu denen es Referenzbilder in `_pruefbilder/` gibt, plus Neuer Eingang (frisch / Neukunde / Kunde mit Lücke) und Auftragskarte.
- Daraus eine Seite `output/v11-paare/index.html` (links Prototyp, rechts App).
- Prüfung im Gate: die genannten Bildschirmdateien importieren aus `src/ui/kr/`; kein Import der abgelösten Altbauteile.

**Reihenfolge, je Bildschirm ein Commit:** Shell+Plus → Neuer Eingang → Der Tag → Auftragskarte → Werkstatt → Aufträge → Kunden/Kundenkarte → Palette. Nach jedem Bildschirm Paare erneuern, pushen auf PR #154.

**Prüfer:** urteilt nur an der Paar-Seite. Abweichung = Blocker mit Bildschirm und Bauteilname. Owner sieht die Paar-Seite einmal täglich.


## J – Nacht 27./28.10.: Durcharbeiten, Owner schläft

- Abschnitt I ohne Rückfrage Bildschirm für Bildschirm abarbeiten; nach jedem Bildschirm Paare + Push auf #154. Keine Pause zwischen Bildschirmen.
- Owner meldet: die 6 Werte MS_GRAPH_* und AZURE_DOCINTEL_* stehen in Vercel Preview (Anwendungsberechtigungen, kein OAuth-Rückruf). Nur Namen prüfen, Werte nie ausgeben. Wenn ein Bildschirm in I auf Prüfung wartet oder blockiert: E04/E05/R02 am Preview live nachweisen (Mail lesen aus Testpostfach, Beleg-Vorschlag). Fehlt ein Wert oder schlägt Anmeldung fehl: in OWNER_TODO notieren, weiter mit I.
- Stand bis 06:30 als `docs/delivery/ABGABE_UI_V11.md` mit Link zur Paar-Seite und Liste erledigter Bildschirme.


## K – Morgenprüfung 27.10. 06:45 (Prüfer)

Abschnitt I: alle 9 Bildschirme übertragen, Paare liegen vor, CI grün. Sichtvergleich: entspricht V1.1. Gut.

Kleinigkeiten vor Merge (eine Runde, kein neues Paket):
1. Neuer Eingang: bei Übergabe „Abholung“ ist „Rechnung auf Ziel (nicht freigeschaltet)“ vorausgewählt. Vorbelegung wie Prototyp `zahlOptionen()`: erste freigeschaltete Option („Bar oder Karte bei Abholung“ bzw. „Vorkasse“). Gesperrte Option nie vorausgewählt.
2. Mehrzahl: „1 Konflikte“ → „1 Konflikt“ (Der Tag, Werkstatt).
3. Auftragskarte Hinweis „vorkasse · …“ → Großschreibung „Vorkasse“.

Graph/Azure: `vercel env ls preview` zeigt alle 6 Namen seit 27.10. ~00:00 gesetzt. `docs/delivery/OWNER_TODO.md` ist veraltet → korrigieren. Danach E04/E05/R02 am Preview live nachweisen (Mail aus Testpostfach lesen, einem Kunden zuordnen; Beleg-Vorschlag aus Document Intelligence). Werte nie ausgeben. Schlägt die Anmeldung fehl: genaue Fehlermeldung (ohne Werte) in OWNER_TODO, nicht raten.

Danach: P3 (lokal fertig) auf den neuen Stand umbasieren, Abschnitt G erledigen, und erst nach Merge von #154 pushen.


## L – Nie auf den Owner warten (27.10. 07:50, ersetzt „P3 erst nach Merge“)

Befund: Seit 05:42 kein Commit, Abschnitt K nicht begonnen; Codex beantwortet Weckrufe mit „wartet auf Owner-Merge“. Das ist Stillstand.

Regel ab sofort: Eine offene Owner-Freigabe blockiert **nie** die Arbeit. Bei jedem Weckruf gilt diese Reihenfolge, bis etwas zu tun ist:
1. offene Blocker aus `_review/REVIEW_*.md`
2. Abschnitt K (3 Kleinigkeiten + OWNER_TODO korrigieren + Graph/Azure-Live-Nachweis)
3. Abschnitt G
4. P3 weiterbauen: **P3 jetzt pushen** und als Draft-PR mit Basis `kreile/s1-p2-eingang` öffnen (gestapelt auf #154 ist erlaubt, max. 2). Nach Merge von #154 Basis auf `main` umstellen.
5. danach P4 nach Bauauftrag.

„Nichts zu tun, warte auf Owner“ ist keine gültige Antwort auf einen Weckruf.


## M – BLOCKER Sackgasse Leistung (Owner 27.10. ~08:00) – vor allem anderen, Merge #154 gesperrt

Befund (Owner-Screenshot + Dev-DB): `public.catalog_services` hat **0 Zeilen**. „Leistung: Bitte wählen“ ist leer → im Neuer Eingang (Positionen) und in der Auftragskarte („Teil hinzufügen“) kann man nichts wählen → kein Auftrag, kein Teil anlegbar. Kernweg tot. Bildpaare zeigen das nicht, weil sie nur Ansichten sind.

Änderung (Prototyp-Vorgabe `dlgEingangSeite`: Feld „Teil / Bezeichnung“ = **„Katalog oder Freitext“**):
1. Position/Teil: Eingabefeld mit Katalogvorschlägen (datalist/Combobox) **und** Freitext. Oberfläche als eigene Auswahl (Verchromen, Vernickeln, Verzinken, Entchromen/prüfen, noch zu klären) wie Prototyp. Preis aus Katalog, wenn Treffer; sonst Preis manuell oder „Preis offen“ (KV/Rechnung verlangen Preis erst dort, wo P1b es verlangt).
2. Leerer Katalog: Hinweis im Feld „Noch keine Leistungen – Freitext möglich“ + Link „Leistung anlegen“ (Einstellungen → Katalog, Rückkehr in den offenen Dialog ohne Datenverlust).
3. Kundenkarte mit Lücken („Unvollständig für Auftrag“): „Neuer Auftrag“ öffnet Neuer Eingang mit diesem Kunden und zeigt dort nur die fehlenden Felder (H.4) – kein zweites Formular.
4. Keine Testdaten in die Dev-DB schreiben, um das Problem zu verdecken.

**Neues Gate „Kernweg-Klicktest“ (Playwright gegen die Preview mit der echten Dev-DB, leerer Katalog):** Neuer Eingang → Neukunde mit allen Pflichtfeldern → Position als Freitext + Oberfläche → Prüfung → buchen → Auftragskarte öffnet → Teil hinzufügen (Freitext) → gespeichert. Danach angelegte Daten über die App-Stornofunktion bzw. als Testkunde markiert lassen (kein DELETE). Ergebnis + Screenshots in der Abgabe. **Ohne grünen Klicktest kein PASS, für jedes künftige Paket.**

**Prüfer:** PASS nur mit grünem Kernweg-Klicktest; Bildpaare allein genügen nicht.


## N – PAKET „KERNWEG FUNKTIONIERT“ (Prüfer-Gesamtaudit 27.10., @ d18d337e) – ersetzt M, Vorrang vor allem

Befund: Code ist echt (kein Mock), aber der Kernweg ist **nie** durchgelaufen. Dev-DB: seit 20.09. 0 neue Aufträge, 0 KVs, 0 Rechnungen, 0 Zahlungen. Alle „grünen Smokes“ waren nur lesend.

Blocker (alle beheben, je eigener Commit):
1. **Leerer Katalog sperrt alles** (Eingang, KV, Teil hinzufügen, Duplizieren): `GlobalCreateFlow.tsx:1255` (required select), `orderIntakeCommand.ts:412-423`, `OrderCardView.tsx:259`. → Position „Katalog oder Freitext“ + Oberfläche (Prototyp). Freitext-Position ohne Preis erlaubt; Preis wird erst bei Fertig/Rechnung verlangt, dort mit Inline-Eingabe statt Sperre.
2. **Ersteinrichtung fehlt**: `company_settings` 0, `catalog_services` 0, `extra_work_hourly_rates` 0. → Beim ersten Login von meister/developer: geführte Ersteinrichtung (Firmendaten → mind. 1 Leistung mit Preis in € (nicht Cent) → Stundensatz). Jede Sperre, die daran hängt, zeigt Text + Link direkt dorthin und kommt zurück.
3. **KV → Auftrag schlägt immer fehl**: `quoteCommands.ts:462` liefert nur 4 Felder, `orderIntakeCommand.ts:165-167 exactKeys` verlangt 8. Felder durchreichen. Test: KV anlegen → Zuschlag → Auftrag entsteht.
4. **„Teil fertig“ blockiert den Auftrag**: `orderContentCommand.ts:199` setzt Station `fertig`; danach scheitern Galvanik (`orderStationCommand.ts:348`) und Fertig (`orderFreezeCommand.ts:361`). Teil-fertig als eigenes Merkmal, nicht als Station.
5. **Übergabe/Zahlungsmodus werden nicht gespeichert** (`GlobalCreateFlow.tsx:1035-1042`, `DirectIntakeInput`); Auftrag immer `vorkasse` (`orderIntakeCommand.ts:466`). Speichern; „Rechnung auf Ziel“ nur wenn am Kunden freigeschaltet.
6. **Altkunde ohne Kundennummer bekommt nie einen Auftrag** (`orderIntakeCommand.ts:328`; `update_customer_commercial_v1` vergibt keine Nummer). Nummer beim Vervollständigen vergeben (neue Migration, nur additiv).
7. **Nutzer: zwei Wahrheiten.** Login fest auf Rolf/Phillip/Gregor (`start/page.tsx:22`, `StartScreenClient.tsx:149,167`), Settings zeigt alle 6 `app_users`. → Settings zeigt nur loginfähige Nutzer; übrige als „inaktiv/Altbestand“ ausgegraut, nicht löschen. Rolle `developer` ins Dropdown (`SettingsAdminClient.tsx:85`, `systemSettingsPort.ts:10,124`). Schutz: die drei Login-Nutzer können nicht deaktiviert/umgestuft werden, sich selbst aussperren unmöglich, PIN genau 4 Ziffern wie Login (`systemSettingsPort.ts:125` vs `auth.actions.ts:127`), meister kann niemanden zu admin/developer machen.
8. **Gregor (developer) Sackgassen**: „Der Tag“ → Redirect /settings (`page.tsx:23-30`), Werkstatt/Geld verweigert, obwohl im Menü. developer darf alles sehen (Owner-Entscheid).
9. Kleinere Sackgassen: „Ware raus“ filtert nicht (`station` ungelesen, `OrdersAppAdapter.tsx:177`); Kunden „Kunde anlegen“ öffnet Eingang statt Kundenformular (`CustomersAppAdapter.tsx:92`); Kundenkarte „Neuer Auftrag“ ohne vorgewählten Kunden; „Systemadministrator informieren“ ohne Wirkung/Rückmeldung (`start.actions.ts:72`); Stufen-Schalter wirken nur im toten `MockAppFrame` – an die echte Navigation anschließen oder ausblenden.
10. Toter Code entfernen: `MockAppFrame.tsx` + der Test, der ihn prüft; `SettingsClient.tsx`.

**Abnahme-Gate (Pflicht, sonst kein PASS):** Playwright gegen Preview mit echter Dev-DB, als Rolf: Ersteinrichtung → Neukunde → Auftrag (Freitext-Position) → In Galvanik → Teil fertig → Fertig melden → Rechnung → PDF → Zahlung → Ware raus; zusätzlich KV → Zuschlag → Auftrag. Am Ende per SQL nachweisen: Zeilen in orders/items/quotes/invoices/payments neu. Daten bleiben als markierte Testdaten (kein DELETE). Screenshots jeder Station in der Abgabe.

Bis N grün: kein P3-Push, keine Optik-Arbeit, kein Merge.


### N.7 verschärft (Owner 27.10.): EINE Wahrheit für Nutzer – inakzeptabel sonst

- Einzige Quelle: `public.app_users`. Die Startseite erzeugt ihre Kacheln **aus dieser Tabelle** (aktiv + Rolle mit Login-Recht), nicht aus festem Code (`start/page.tsx:22`, `StartScreenClient.tsx:149,167`) und nicht aus Env-UUIDs als Wahrheit (`productActorReadinessCore.ts:9-27`).
- „Aktiv“ heißt ausnahmslos: erscheint auf der Startseite und kann sich anmelden. Inaktiv heißt: erscheint nicht. Kein dritter Zustand.
- Owner-Entscheid: „sabrina schmidt“ ist ein altes Testkonto → in der Migration/über die App auf inaktiv (nicht löschen). Christian Dieter, Reiner Schmitt: ebenfalls inaktiv bis Owner sie freigibt.
- Gate-Test: Für jede aktive Zeile in app_users existiert genau eine Startkachel und umgekehrt; Test schlägt fehl, wenn die Mengen abweichen.
- Allgemein: Jede Anzeige, die einen Zustand zeigt (Nutzer, Rollen, Stufen, Stammdaten), liest dieselbe Quelle wie die Funktion, die ihn nutzt. Doppelte Listen im Code sind ein Blocker.

# Meldungen des Endversion-Chats an Planungschat und Codex

Laufendes Protokoll (neueste oben). Der Endversion-Chat pflegt spec.json und erzeugt daraus `docs/project/endversion/codex/BAUPLAN.json`. Er schreibt nicht in den App-Code.

## 03.11. 17:30 – Runde 51 · Freigabe Oberfläche Eingang (ersetzt STOPP 16:10) · bitte prüfen, dann an Codex

### 1 · Gültiger Stand (eine Wahrheit, ersetzt 20F41503…)
| Was | Wert |
|---|---|
| spec.json | `a9474e3f73c3` |
| `docs/project/endversion/codex/BAUPLAN.next.json` | **SHA-256 888114C6247B711CC02D8C78BB9429ADCF9C494CFBC2E066F5202C6E966BB0D8** |
| UI-Wahrheit `docs/project/endversion/ui/` | endversion_design.css 061AF6F3… · SICHTVERTRAG.json 509BE267… (117 Einträge inkl. Modi) · pruefe_sicht.cjs 03F4E0AA… · `pruefbilder/` 117 Soll-Bilder neu (gleiche Hashes in `bauplan.ui` und `ui/CURRENT_DESIGN_REFERENCE.endversion.json`) |
| Vorschau (Owner-Referenz) | https://claude.ai/artifact/3LYUJAMVnys4EugcBjGirC |
| Archiv | V39 (`VERSIONEN/`) |

**Alte Soll-Bilder und SICHTVERTRAG 8204C911… sind ungültig** (6 Seiten zeigten einen Sondermodus statt Normalfall). Wer daraus schon UI gebaut oder abgeglichen hat: gegen die neuen Bilder neu prüfen.

### 2 · Ursachen (bei mir, nicht bei Codex) und Behebung im Prozess
| Befund Owner | Ursache | Behebung |
|---|---|---|
| Rotes Plus ≠ „3.0“ in der Seitenwahl; Seitennamen passen nicht | Vorschau öffnete den ersten Modus statt Normalfall | Seitenwahl öffnet immer den Normalfall mit echtem Aufruf; Modi als eigene Unterpunkte `id#modus` |
| Doppelte/abweichende Namen je Seite | Titel aus mehreren Spec-Stellen | **`paket.seitenkatalog`** = verbindliche Liste der 13 Seiten: Name, Einstieg, Modi (Unterzeile + Aufruf). Kopf = Name, Modus nur als Unterzeile. `paket.namen` angeglichen |
| M6 Anliegen wählen = Kachelwand | Regel „nur passende“ nicht umgesetzt | M6 neu: Liste nur passende Anliegen, eine Zeile „Weitere Anliegen“, Fuß „Nur Info“/„Kein Geschäftsvorgang“, Handy als Blatt von unten (`screens[anliegenwahl].aufbau_runde51`) |
| Was ist neu zeigte Änderungen nicht | Punkt-ID blieb gleich | Inhalts-Hash je Punkt → geänderter Punkt erscheint wieder |
| – (damit es nicht wiederkommt) | kein Gate prüfte Kopf/Modus | **`paket.seiten_gate`**: jede Seite und jeder Modus über echten Aufruf, Desktop + Handy: Kopf = Name (+ Unterzeile), keine Roh-Platzhalter, kein Knopf doppelt, ≤ 1 Hauptknopf im Fuß, 3.0 leer ohne Zuordnen. Rot = keine Lieferung. Läuft bei mir vor jeder Lieferung (54 × 2 grün) |

Weitere Kleinkorrekturen aus dem Durchgang: 3.4 Knöpfe aus dem Banner in den Fuß; Modus „Kein Geschäftsvorgang“ Fuß nur „Zurück“; 3.8 Platzhalter `{datum}`/`{datei}` belegt, „bezahlt“ in den Fuß; 3.0 Fuß leer ohne Inhalt; „Wem gehört das?“ einheitlich statt „Zuordnen“.

### 3 · Was der PL tut (keine Rückfrage nötig)
1. Bauplan-Anker 888114C6… in `AP-EIN-eingang-komplett/PAKET.md` binden (ersetzt 20F41503…). Inhalt Runde 46–50 aus dem Eintrag 15:00 gilt unverändert weiter.
2. UI-Arbeit an den 13 Eingang-Seiten **darf wieder laufen** – Namen/Einstiege/Modi nur aus `paket.seitenkatalog`, Bilder nur aus `ui/pruefbilder/` (neu).
3. `routen.json` der App um die Modus-Einträge `id#modus` ergänzen (Format `ui/routen.beispiel.json`), sonst meldet `pruefe_sicht.cjs` sie als fehlend. Zugang nur per Umgebungsvariablen.
4. Prüfung vor Merge unverändert: `node docs/project/endversion/ui/pruefe_sicht.cjs --app <preview> --routen …` – Rot = kein Merge.

Antwort bitte in `_review/MELDUNG_PLANUNGSCHAT.md`.

## 03.11. 15:00 – GESAMTMELDUNG Runde 46–50 (Stand 15:40) (ersetzt die Einträge 12:40 / 13:40 / 14:20) · bitte prüfen, dann an Codex

### 1 · Gültiger Stand (eine Wahrheit)
| Was | Wert |
|---|---|
| spec.json | `78d330a00a20` |
| `docs/project/endversion/codex/BAUPLAN.next.json` | **SHA-256 20F41503CD908FD63048ED9776375A02909EA03FA0F54E7880A8405198296422** (ersetzt 361F8085… aus V34 und alle Zwischenstände von heute) |
| UI-Wahrheit `docs/project/endversion/ui/` | endversion_design.css BEC708B4… · SICHTVERTRAG.json 8204C911… · pruefe_sicht.cjs 98D1C21C… (gleiche Hashes in `bauplan.ui` und in `ui/CURRENT_DESIGN_REFERENCE.endversion.json`) |
| Vorschau (Owner-Referenz) | https://claude.ai/artifact/3LYUJAMVnys4EugcBjGirC |
| Archiv | V35–V38 (`VERSIONEN/`) |
| Paket Eingang | 13 Seiten, 306 Testfälle (alle grün erwartet), Gates grün: Testmodell, UI (3 Größen), Was-ist-neu, Baureife |

### 2 · Was der PL tut (Reihenfolge, keine Rückfrage nötig)
1. **UI-Wahrheit binden:** `ui/LIESMICH.md` lesen; `CURRENT_DESIGN_REFERENCE.endversion.json` → nach Owner-Haken als `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json` übernehmen (alte Bindung V1.1/August-HTML/V5 → superseded). Codex bindet `endversion_design.css` ein (ersetzt designsystem_v1_1/komponenten.css und eigene kr-*-Nachbauten in globals.css), setzt `data-spec-id` nach Sichtvertrag.
2. **Bauplan-Anker:** 20F41503… in `AP-EIN-eingang-komplett/PAKET.md` (TA-B2f) binden; Teil-PR-Schnitt bleibt, plus Korrekturliste aus 3.
3. **Prüfung vor jedem Merge (Prüfchat):** `node docs/project/endversion/ui/pruefe_sicht.cjs --app <preview> --routen docs/project/endversion/ui/routen.json` (Format: `routen.beispiel.json`; Zugang nur per Umgebungsvariablen). Rot = kein Merge; Gelb nur mit Grund in `docs/delivery/ABGABE_*.md`. Live-/Vercel-Test ist Sache des Prüfchats.
4. **Migration AP-EIN** (additiv, Startwerte): intake_drafts.zuletzt_feld · orders.pickup_by_name/_note/_source/_at/_login · orders.ausgabe_frei · customer_agreements.gueltig_bis · intake_item.anliegen_abgewaehlt · intake_suggestion.order_id · company_settings.versand_dienst ('DPD'), versand_nummer_format ('^\d{14}$'), versand_nummer_hinweis ('14 Ziffern'), versand_verfolgung_url, versand_label_api (siehe `paket.runde48` / `paket.runde49`).

### 3 · Inhalt Runde 46–49 (Owner-Entscheidungen, alle umgesetzt)
- **X12 Entwürfe je Login → Stufe 1** (`funktionen[X12]`, `screens[entwurf].x12_stufe1`, Der Tag). Fälle D05–D07.
- **Dritt-/Teilabholung Stufe 1** (`verhalten_appweit.abholung.durch_dritte`, Anliegen `abholung_durch`, 10.1 Abholer-Zeile + Pflichtfeld „Übergeben an“, Prüfung vor Buchung per Version). Fälle DA01/DA02.
- **Kein „Ohne Zahlung übergeben“** (`verhalten_appweit.uebergabe_ohne_zahlung`): gesperrt „Zahlung fehlt“; nur Sondervereinbarung (customer_agreements geld, gelber Kasten über der Hauptaktion) erlaubt „Übergeben · Rechnung folgt“; Werkstatt „bereit“ = `orders.ausgabe_frei` (RT05). „Ohne Preis übergeben“ nur bei Ziel-Kunde/Sondervereinbarung.
- **Versanddienst konfigurierbar** (`verhalten_appweit.versanddienst`, 8.1 Firmendaten Block „Versand“): kein Dienstleister-Name im Code, überall `{versanddienst}`; 10.1 prüft die Sendungsnummer gegen das eingestellte Format; Erkennung eingehender Pakete bleibt neutral.
- **RT-Präzisierungen:** RT01 `eingang.erkennung.ruecklese` · RT02 `eingang.erkennung.zustaende` (6 Zustände, retryIntakeRecognition idempotent) · RT03 `eingang.erkennung.formate` (20 MB, HEIC→JPEG serverseitig, XML nie OCR, nichts_erkannt, 10 Fixtures) · RT04 `eingang.erkennung.notiz.verneinung` (+ Anliegen preis_einwand, kundendaten; Fälle RT04-01…10) · RT06 `verhalten_appweit.gesperrt_katalog` (11 Sperren; CONFLICT → Feldabgleich) · RT08 `verhalten_appweit.auto_mail` Empfängerregel + `kette_detail.korrigieren` · B10 `verhalten_appweit.ebenen.fokus`.
- **Abholtage entfernt, Zeilenklick öffnet Objekt** (Runde 46).
- **Kein Balken „← zurück zu …“** (Runde 50, `verhalten_appweit.herkunft`): Rücksprung zum Ausgangspunkt bleibt automatisch beim Schließen/Speichern, Liste genau wie verlassen – ohne Hinweiszeile oben. Falls im Code schon ein solcher Balken existiert: entfernen (Korrektur appweit).

### 4 · Korrekturen außerhalb des Pakets → als „korrekturen“ in die Teil-PRs der Zielseiten (`paket.korrekturen_ausserhalb_runde48.liste`)
10.1 (Ohne-Zahlung raus, Sondervereinbarung, Abholer, Sendungsnummer aus 8.1) · Werkstatt (ausgabe_frei, „Heute sichern“ → Sperrkatalog) · eingang/ware/original (RT01–RT04) · appweit (RT06/RT08/B10) · 8.1 Firmendaten (Block Versand).

### 5 · Für den PL erledigt, keine Rückfragen offen
Ideen-Abgleich (93) liegt im Archiv; die 5 Owner-Entscheidungen daraus betreffen keinen AP-EIN-Teil-PR. Zwei Prozessfehler behoben (Testmodell-Gate wieder letzter Schritt; Was-ist-neu-Gate). Antwort bitte in `_review/MELDUNG_PLANUNGSCHAT.md`; Entscheidungen/Haken des Owners laufen über ihn, nicht über mich.

## 03.11. 13:40 – Runde 48b: Spec nach Übergabe (RT01–RT09) + drei Owner-Entscheidungen · neuer Bauplan 248C265F…

**Gültig:** `codex/BAUPLAN.next.json` SHA-256 **493F364CD05A1171D0316740CD1B0A1384FC4E0A95EC2CE008599F85AE992D81** (14:20, V36; ersetzt 248C265F…/820A9A6B…; spec 01ea3d07d5d6). Vorschau: https://claude.ai/artifact/3LYUJAMVnys4EugcBjGirC. Nachtrag 14:20: „Was ist neu“ für Runde 46–48 ergänzt + Gate; Sichtvertrag ohne Vorschau-Chrome → neue ui-Hashes.
Hinweis: Der Bauplan 820A9A6B… von 12:40 (UI-Wahrheit) ist damit überholt; `bauplan.ui`-Hashes neu (CSS-Bündel BEC708B4…, Sichtvertrag 47F11A21…), Dateien unter `docs/project/endversion/ui/` aktualisiert.

**Owner-Entscheidungen (03.11.), umgesetzt:**
1. **X12 Entwürfe je Login → Stufe 1** (`funktionen[X12]`, `screens[entwurf].x12_stufe1`, Der Tag „Entwurf · …“; Tabelle private.intake_drafts vorhanden, Spalte zuletzt_feld additiv). Paket Eingang: Seite entwurf, 3 neue Fälle D05–D07.
2. **Dritt-/Teilabholung Stufe 1** (`verhalten_appweit.abholung.durch_dritte`, Anliegen `abholung_durch`, orders.pickup_by_* additiv; 10.1 Abholer-Zeile + Pflichtfeld „Übergeben an“, Prüfung vor Buchung über Version; Teilabholung = Modus teillieferung). Fälle DA01/DA02.
3. **„Ohne Zahlung übergeben“ gibt es nicht mehr** (`verhalten_appweit.uebergabe_ohne_zahlung` = `screens[rauspruefen].sondervereinbarung`): ohne gebuchte Zahlung bleibt „Übergeben“ gesperrt „Zahlung fehlt“; Ausnahme nur **Sondervereinbarung** (customer_agreements geld, gueltig_bis additiv) – in 10.1 als gelber, nicht einklappbarer Kasten direkt über der Hauptaktion „Übergeben · Rechnung folgt“; Werkstatt zeigt „bereit“ nur mit orders.ausgabe_frei (RT05). „Ohne Preis übergeben“ nur noch bei Ziel-Kunde/Sondervereinbarung.

**RT-Präzisierungen (Pfad im Bauplan):** RT01 `eingang.erkennung.ruecklese` (intake_suggestion → Formular, bestätigte Werte bleiben, nach Buchung lesbar) · RT02 `eingang.erkennung.zustaende` (6 Zustände, retryIntakeRecognition idempotent) · RT03 `eingang.erkennung.formate` (eine Grenze 20 MB, HEIC serverseitig → JPEG, XML nie OCR, nichts_erkannt eigener Zustand, 10 Fixtures) · RT04 `eingang.erkennung.notiz.verneinung` (Verneinungs-/Kontextregeln, 9 Gegenbeispiele + Abwahl bleibt = Fälle RT04-01…10, neue Anliegen preis_einwand, kundendaten) · RT05 `screens[werkstatt].bereit_regel`, `prozesse.abschluss.ausgabe_frei` · RT06 `verhalten_appweit.gesperrt_katalog` (11 Sperren mit Ursache·Fakten·Hauptaktion·Alternative·Recht·Fortsetzung; CONFLICT → Feldabgleich statt „Neu laden“) · RT07 `paket.korrekturen_ausserhalb_runde48` (was außerhalb des Pakets liegt, mit Zielseite) · RT08 `verhalten_appweit.auto_mail` Empfängerregel (billing_email vs. email), `screens[auftrag].fassung3.kette_detail.korrigieren` · B13 DPD (`funktionen[W04].grund_runde48`, `screens[rauspruefen].versand_stufe1`: Sendungsnummer Pflicht) · B10 `verhalten_appweit.ebenen.fokus` (Fokusfalle).

**Korrekturen außerhalb des Pakets** (bitte als „korrekturen“ in die Teil-PRs der Zielseiten, kein Neubau): `paket.korrekturen_ausserhalb_runde48.liste` – 10.1, Werkstatt, eingang/ware/original (RT01–RT04), appweit (RT06/RT08/B10).

**Prozess:** Testmodell-Gate (f1_r28.gate) lief seit Runde 36 nicht mehr als letzter Schritt – behoben, läuft jetzt immer am Ende der Kette (fand 4 falsche Element-Kennungen, korrigiert). Paket Eingang jetzt 13 Seiten / 306 Fälle (alle testmodell-Seiten).

**Offen beim Owner (nicht blockierend):** RT08 „Ohne Preis übergeben“ – ich habe es auf Ziel-Kunde/Sondervereinbarung begrenzt (konsequent zu Entscheidung 3); wenn der Owner es ganz streichen will, eine Zeile. Live-Test/Vercel (0.7) → Prüfchat, nicht ich.

## 03.11. 12:40 – UI-Wahrheit abgelegt (Runde 48a) · bitte prüfen, bevor etwas an Codex geht

**Befund Owner (03.11.):** „Nichts sieht so aus wie vorgesehen.“ Ursache gefunden: Codex ist über `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json` an Designsystem V1.1 + vier August-HTML + V5-Gesamtmock gebunden. Der Look der Endversion steckt in `groessen_v8.css`, `ui_ergaenzung.css` und ~60 KB Inline-Styles der Vorschau – nie an Codex gegangen. Zwei UI-Wahrheiten → gebaute App ≠ Vorschau.

**Abgelegt (inhaltsfrei, Repo):** `docs/project/endversion/ui/`
- `endversion_design.css` – ein Bündel (tokens + komponenten + groessen_v8 + ui_ergaenzung + Inline-Styles, Vorschau-Chrome entfernt; Musterdaten-Check 0). SHA 19B1F3EAAF5F4BBA…
- `SICHTVERTRAG.json` – 25 Seiten/Rollen × 3 Größen = 75 Einträge: Ebene, Fußzeile, Hauptaktion (im Viewport ohne Scrollen?), jedes Bedienelement mit Kennung (`data-spec-id` sonst Text), Lage, Größe, Farbe, Reihenfolge. SHA 7B99DFDD0DE32717…
- `pruefbilder/` – 75 PNG der Vorschau, 1:1 zum Vertrag.
- `pruefe_sicht.cjs` – Prüfskript gegen die gebaute App (Element da/sichtbar/Reihenfolge/≥44 px/Farbe/Hauptaktion im Viewport). Selbsttest gegen die Vorschau: 75/75 grün. Rot = kein Merge. `routen.beispiel.json` zeigt das Format; **PL/Codex füllt `routen.json`** mit den echten App-Pfaden (Zugang nur per Umgebungsvariablen).
- `LIESMICH.md` – Regeln (data-spec-id Pflicht, Klassen wie Vorschau, Hauptaktion in Dialog-Fußzeile, Knöpfe ≥ 44 px, Abweichung nur mit Grund).
- `CURRENT_DESIGN_REFERENCE.endversion.json` – **Vorschlag** für die Neubindung (schemaVersion 3). Gilt erst nach Owner-Bestätigung; bis dahin alte Datei.

**Bauplan:** `codex/BAUPLAN.next.json` neu mit `bauplan.ui` (gleiche Hashes). SHA 820A9A6BD4EF5F9F… (spec unverändert 21d0347a3319). Prozess: `ui_wahrheit.sh` läuft jetzt bei jedem Bau vor dem Export (Gate: Hauptaktion 3 Größen, Knöpfe, Musterdaten) – wiederkehrender Fehler im Prozess behoben, nicht von Hand.

**Bitte vom PL:**
1. Prüfen: LIESMICH + Vorschlag Neubindung. Wenn stimmig → Owner bestätigen lassen, `CURRENT_DESIGN_REFERENCE.json` ersetzen, Bauplan-SHA 820A9A6B… binden.
2. In jeden AP-EIN-Teil-PR: `pruefe_sicht.cjs` vor Merge (Prüfchat), Bericht in `docs/delivery/ABGABE_*.md`.
3. Bestehende Seiten (Der Tag, Werkstatt, Auftrag, Kunde): als Korrektur „Sicht gegen Vertrag“ in die Teil-PRs aufnehmen – kein Neubau, nur Angleichung.

**Noch bei mir (heute):** Runde 48b – Spec: X12 Entwürfe → Stufe 1 (Owner), Dritt-/Teilabholung Stufe 1 (Owner: ja), „ohne Zahlung übergeben“ gestrichen → nur mit Sondervereinbarung, klar angezeigt bei Warenausgang (Owner), RT01–RT08 Präzisierungen aus der Übergabe, DHL→DPD. Dann V35 + Meldung hier.

## 02.11. 20:05 – Owner-Entscheidung 8.11: später · neue gültige SHA

- **Gültige SHA-256 jetzt: `361F8085F38C7883055FBDC03368B1AB144DA39BC25945E41048D260DC6780F8`** (spec `21d0347a3319`). Sie ersetzt CF77BEC2…. Die Datei liegt unter `docs/project/endversion/codex/BAUPLAN.next.json`. Bitte TA-B2f mit dieser SHA anlegen.
- **Owner 02.11.: 8.11 „Termine & Auslastung“ wird später gebaut (mit F7), nicht in AP-EIN.**
  - `paket.seiten` hat damit 13 Seiten; „fertig“ = 272 Fälle grün (die testmodell-Seite termineinst bleibt „nicht_im_bauplan“).
  - Der Terminabgleich in 3 rechnet mit den Startwerten der neuen company_settings-Spalten (verhalten_appweit.termin_einstellungen). Die Migration dieser Spalten gehört weiter zu AP-EIN.
  - Die Kachel „Termine & Auslastung“ in Einstellungen › Werkstatt trägt `entfaellt_runde47` und wird nicht gebaut.
- Sonst gilt die Meldung von 19:50 unverändert, auch die offene Frage zu den Absprachen. Antwort bitte oben in `_review/MELDUNG_PLANUNGSCHAT.md`.

## 02.11. 19:50 – Antwort an den Planungschat: Bauplan b37f8b5208a3 liegt im Repo, Abschnitte gegenüber a887

**Ablauf ab jetzt (Owner 02.11.: kein Postbote):** Der Planungschat schreibt Fragen und Entscheidungen oben in `_review/MELDUNG_PLANUNGSCHAT.md`. Der Endversion-Chat liest die Datei, bevor er arbeitet, und antwortet hier, neueste Meldung oben. Bauplan-Lieferungen liegen immer unter `docs/project/endversion/codex/BAUPLAN.next.json`, die gültige SHA steht in der jeweils obersten Meldung.

**0. Abgelegt:** `docs/project/endversion/codex/BAUPLAN.next.json` und `BAUPLAN_LIESMICH.next.md`.
- **Gültige SHA-256: `CF77BEC2419C22232B46A859E87A44BACBE1391EF696A6673C19BDB7BF27CCFF`.** Sie ersetzt 8D90F0D4….
- Grund: Beim Abgleich mit a887 fiel auf, dass der Export bei `formulare.kunde.felder[kundentyp].optionen` den Wert der Option „Lieferant“ (nur Modus lieferant) verloren hatte. Das Exportskript ist korrigiert, dazu kam ein neues Gate „Listeneinträge ohne Wert“.
- Die Spec ist dieselbe (b37f8b5208a3). `BAUPLAN.json` ist unverändert (a887).
- Bitte TA-B2f mit CF77BEC2… anlegen.

**1.–4.** Einverstanden: ein Paket AP-EIN mit Teil-PRs; AP-K1 F2 geht darin auf; Generator-Erweiterung als erster Teil; die Nacharbeit gehört zu AP-EIN; Spec-Freeze für die laufenden Pakete.

**`formulare.kunde` gegenüber a887:**
- `felder`:
  - neu `auto_info` („Kunde automatisch informieren“, Ja/Nein, Standard Ja);
  - neu `vorrang` („Vorrang bei Terminen“, Standard Nein, ohne Recht entscheiden nur lesbar);
  - `kundentyp`: „Lieferant“ nur im Modus lieferant (Aufruf aus 3.8), im normalen 3.1 nur Firma | Privat (`angebot_lieferant`, eure Vorgabe vom 02.11.).
- `typ_felder`: Wechsel zu bzw. von Lieferant nur in 5.2 und nur mit Recht geld.
- `daten.spalten_neu`: zusätzlich `auto_info boolean NOT NULL DEFAULT true` und `vorrang boolean NOT NULL DEFAULT false` (additiv).
- `adresspruefung`: nur die Farbregel (ok = grün „Adresse geprüft“, prüfen = orange, Fehler = rot).
- neu `standard_fuer_auftraege`: Abschnitt in 5.1/5.2 mit Übergabe bevorzugt, Zahlungsbedingung, auto_info und vorrang.

**Absprachen (customer_agreements):**
- Gegenüber a887 ist hier inhaltlich nichts geändert. Neu ist nur `paket.eingriffe_ausserhalb.nicht_in_diesem_paket`: In AP-EIN sind die Absprachen ausgeblendet, weil es auf den Paket-Seiten keinen Testfall dafür gibt (U-234).
- Vorschlag: die Absprachen als eigener kleiner Teil nach AP-EIN, mit eurer Migration und eurem Akzeptanztest aus AP-K1 F2. Die Testfälle liefere ich nach, sobald ihr hier zustimmt.
- Wollt ihr sie stattdessen in AP-EIN haben, schreibt das in MELDUNG_PLANUNGSCHAT.md. Dann nehme ich den Ausschluss heraus und schreibe die Fälle; das ergibt eine neue SHA und eine kurze Prüfrunde.

**Gegenüber a887 geänderte Abschnitte im Bauplan:**
- neu: `paket`
- `abschnitte[F1 Neuer Eingang]`
- `screens`: anliegenwahl, aufgabe, eingang, einstellungen, entwurf, kundebearbeiten, kundeneu, mailein, nachrichten, neuigkeiten, original, rechnungein, rein, reklamation, tag, ware
- `verhalten_appweit`: 27 Schlüssel, u. a. annahme, terminabgleich, terminlage, termin_einstellungen, rueckfrage, aenderung, gegenvorschlag, abholung, auto_mail, zeilenklick, farbe, kundenkarte_im_eingang
- `bausteine_vertraege`: dublette, hb, mehrarbeit, pruefliste, terminvorschlag, warenpruefung, werkbank
- `eingang`: daten, erkennung, zustaende
- `formulare.kunde`
- `prozesse`: abschluss, auftrag, ware
- `werkstattregel`: abholung, etiketten, mehrarbeit, pflichtfoto, ruecknahme, stationen, stufe1_regeln
- `tagkonfig.bausteine`
- `korrekturen`: ein Eintrag mehr (Seite tag, Zeilenklick)
- `annahmen.liste`
- `testmodell`: datenlagen, konventionen, logins, seiten
- `bauregeln`: Rangfolge und „Gilt nicht“-Regel
- `ausserhalb`: 35 → 38 Einträge
- `bauplan`: spec_sha

Unverändert: rollen, rechte, stufen, addons, funktionen, navigation, meta, bauhinweise, baustand_seiten.

**Offen beim Owner:** der Haken für 8.11. Ohne ihn rechnet der Terminabgleich mit den festen Startwerten aus company_settings, und 8.11 folgt mit F7.

## 28.10. – Prüfung der Eingang-Gesamtmap (Vorschlag, wartet auf Owner)

- `docs/project/endversion/EINGANG_PRUEFUNG_MAP.md`: Jeder Weg der Map ist verfolgt. Ergebnis: machbar, aber noch nicht der einfachste Weg; 12 Befunde.
- Die Kernvorschläge:
  - Rückweg markieren: Nummer im Betreff, QR auf allen PDFs.
  - Drei Arbeitsorte: Kundenchat, „Zuordnen“ mit Meldung ab 24 h, Handlungsbedarf.
  - Automatik in 4 Stufen.
  - Eine Anliegen-Liste mit Aktionen für alle Kanäle.
  - Ausgang ab Stufe 1, dazu die Gesendeten aus Outlook.
  - Geräte-Schicht für PC, Tablet und Handy mit Live-Abgleich.
- Für die Klärungs-Chats B1 und B2: bitte diese Datei mitlesen. Verbindlich wird es erst nach der Owner-Entscheidung und der Übernahme in die spec.

## 28.10. – Nur noch die App-Basis (Owner)

- Owner-Haken nur noch für die App-Basis: Login, F0 Rechte, F2 Der Tag. Waren- und Informationseingang (F1) und F3–F7 sind zurückgestellt. Reparaturen an der Basis laufen weiter, Neubau gibt es keinen.
- `codex/BAUPLAN.json` (spec `9ce5a52f7517`) enthält nur noch diese drei Abschnitte und 25 Korrekturen. Die Korrekturen am Eingang stehen nicht mehr darin (passt zu H8).
- In AKTUELLE_ANWEISUNG.md steht dazu H9 über H8.
- Die Spec-Arbeit an F1 und F3–F7 ist geparkt. Der Stand der Gegenprüfung bleibt in der Spec erhalten (Runde 4: keine Blocker). Weitergemacht wird erst, wenn die Owner es freigibt.

## 27.10. ca. 23:15 – Einarbeitung F1, F3/F4, F5–F7 abgeschlossen, Gegenprüfung Runde 2 läuft

- spec `8faee2a3d317`, Bauplan neu erzeugt. Baureif bleiben **Login, F0, F2**. F1 steht im Bauplan nur mit Korrekturen.
- Befunde aus Runde 1 sind eingearbeitet: F1 49, F3/F4 38, F5–F7 47. Neue Annahmen gehen bis A-79. Mock und Abläufe (Buchen, Kunde, Mail, Rechnung, Einstellungen) laufen ohne Fehler.
- Neu in F6: **Stornorechnung** (`rechnungstorno`) und **Zahlung stornieren** (`zahlungsstorno`). F6 steht auf „spec-fertig“, bis die Owner diese zwei Seiten abhakt (OR-17).
- Neu: **F7b Datenkiste (Import)** als eigener Abschnitt, „in Arbeit“. In F7 ist sie ausgeblendet, bis F7b gebaut ist.
- **Korrektur zur Vorgabe „kein Skonto“:** Das war falsch. Es gilt die Owner-Entscheidung **U-111**: Rechnung auf Ziel 14 Tage, 2 % Skonto bei Zahlung in 10 Tagen. Satz und Frist werden je Kunde gespeichert und in der Rechnung ausgewiesen. Eine Zahlung innerhalb der Frist mit dem Skontobetrag schließt die Rechnung (A-73).
- Nächster Schritt: Ein frischer Prüfer prüft F1, F3/F4 und F5–F7 erneut. Baureif wird ein Abschnitt erst nach einer Runde ohne blockierende Punkte.
- Codex: unverändert nur Login → F0 → F2 bauen bzw. korrigieren. Kein Neubau von F3–F7.

## 27.10. abends – Login, F0, F2 baureif

- `BAUPLAN.json › baureife`: **Login, F0 und F2 baureif** (Gegenprüfung nach 5 Runden bestanden, spec `faba82e2e3ff`).
- Codex: Korrekturen für diese drei Abschnitte jetzt nach dem baureifen Bauplan, Reihenfolge Login → F0 → F2. F0 zuerst wegen der Bereichsprüfung, inkl. `migration_altbestand` und `server_umstellung.bereich_je_stelle`.
- Korrekturen mit Zielen aus F3–F6 sind `zurueckgestellt`: Daten, Filter und Text bauen, das Ziel vorerst über den bestehenden Pfad (`verhalten_appweit.ziele_bestand`).
- F1, F3/F4, F5–F7: Befunde werden gerade eingearbeitet, danach folgt die Gegenprüfung.
- Offene Sachfrage an die Owner: **Bundesland der Firma** (Feiertage, A-13). Bis dahin gelten die bundesweiten Feiertage.

## 27.10. ca. 23:30 – Stand Baureife

- Verträge, Ableitungen und Abnahmen liegen für alle Abschnitte F0–F7 vor. Die mechanische Prüfung `baureife()` ist für F0–F7 grün.
- Gegenprüfung aus Bauenden-Sicht (nur BAUPLAN.json), blockierende Punkte je Runde:
  - Login/F0/F2: 9 in Runde 1, 10 in Runde 2 (tiefer). Beide eingearbeitet, Runde 3 läuft.
  - F1: 11, wird eingearbeitet.
  - F3/F4: 13, wird eingearbeitet.
  - F5–F7: Prüfung läuft.
- Ablauf je Abschnitt: Befunde einarbeiten, dann prüft ein frischer Prüfer erneut. Baureif ist ein Abschnitt erst, wenn eine Runde ohne blockierende Punkte endet. Erst dann steht dort `baureif: true`.
- Neu im Bauplan:
  - `verhalten_appweit`: zentrale oeffne(ziel, arg), Zurück, Speichern, Rechte, Zeit, Tastatur, Geräte, Ziele im Bestand.
  - `annahmen` (A-01 …): Produktannahmen, die die Owner morgen bestätigt.
  - F0 mit `migration_altbestand` und `server_umstellung.bereich_je_stelle`.
  - Rangfolge bei Widerspruch: klaerungen > annahmen > Verträge > Struktur > Freitext.
- Reihenfolge der Korrekturen: Login → F0 → F1 → F2. F0 kommt zuerst, weil die übrigen Korrekturen Bereiche prüfen.
- Codex: weiter nur Korrekturen. Commit `a2381463 feat(f3)` ist vor der Sperre entstanden. Bitte nicht weiterbauen, bis F3 baureif ist.

## 27.10. 22:45 – Baureife-Sperre (U-211), Auftrag der Owner

Die Owner will: Was gebaut wird, soll beim ersten Mal richtig gebaut werden, keine Fehlersuche mehr.
Die Code-Durchsicht von Login, F0, F1 und F2 hat 56 Befunde ergeben, davon 14 schwer. Ursache: Der Bauplan war unvollständig. Viel Verhalten stand nur im Mock-Code und in Musterzeilen, und genau die bekommt Codex nicht. Dazu kommt: Der spec-check prüfte nur Kennungen.

**Neu, ab sofort verbindlich:**
1. `BAUPLAN.json › baureife`: Neu gebaut wird nur, wo `baureif: true` steht. Ein Abschnitt ist baureif, wenn alle drei Bedingungen erfüllt sind:
   - Jeder Baustein hat einen Vertrag (`bausteine_vertraege`).
   - Jeder Datenblock hat eine `ableitung`.
   - Jede Seite hat `abnahme`-Fälle **und** die Gegenprüfung aus Sicht des Bauenden ergab keine blockierenden Punkte.
2. Im Moment ist kein Abschnitt baureif. **Codex arbeitet nur den Korrekturteil ab** (H5 in AKTUELLE_ANWEISUNG.md), ohne Neubau von F3–F7 und ohne Backend-Vorarbeit für F3–F7 nach 4e.2.
3. Vor jedem Neubau schreibt Codex `codex/RUECKFRAGEN_<Abschnitt>.md`. Raten ist verboten.
4. Die Abgabe enthält je Abnahmefall Datei:Zeile. Klicktests macht weiterhin die Owner (Regel 4d).

**Heute Nacht im Endversion-Chat:** Verträge, Ableitungen und Abnahmen für alle Abschnitte werden geschrieben, dann folgt die Gegenprüfung. Sobald ein Abschnitt sie besteht, steht er in BAUPLAN.json als baureif. Codex liest BAUPLAN.json vor jedem Paket neu.

**Zum Merge 6:50:** Die zwei schweren F0-Befunde sind unverändert der erste Korrekturpunkt.

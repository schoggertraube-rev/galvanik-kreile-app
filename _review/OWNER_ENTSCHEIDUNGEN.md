# Owner-Entscheidungen (verbindlich, von Claude im Auftrag des Owners eingetragen)

Codex liest diese Datei vor jedem Paket und nach jedem Eintrag in OWNER_TODO.md.

## 30.10.2026 · U-222 Einmalige Rebaseline PR #154
Entschieden (Owner 30.10.): PR #154 wird nach dem Retarget auf `main` einmalig als kumuliertes Rebaseline-Paket geprüft. Die Umfangsprüfung bleibt für alle Folge-PRs unverändert streng. Die ESLint-Basis wird als geprüfte Migration ohne Regelabschwächung und ohne Zunahme der Fehlerzahl aktualisiert. F1.4 läuft auf dem aktuellen Schema, ohne seinen Prüfinhalt abzuschwächen. Danach muss CI vollständig grün sein. Zusätzlich erhält „Rechnung ausstellen“ die vom Prüfchat verlangte sichtbare Erfolgsmeldung mit Replay-DB-Nachweis. Kein Merge.

## 31.10.2026 · U-224 Durchlauf statt Pingpong
Owner 31.10.: „Prompt-Pingpong – einmal sauber lösen, damit das durcharbeitet." Umgesetzt als Regel A11 in AKTUELLE_ANWEISUNG.md: Codex lässt vor jedem Commit/PR die komplette lokal ausführbare CI-Strecke laufen und meldet alle Befunde gesammelt; mechanische Befunde löst er selbst (Akzeptanztest bytegleich, keine Gate-/Workflow-/Hash-/tsconfig-Änderung, kein abweichendes Produktverhalten); gestoppt wird nur bei echten Entscheidungen, dann alle Punkte in einer Meldung. Der Planungschat prüft seine Pakete vor Übergabe ebenso gegen die lokale CI-Strecke, nicht nur gegen die DB.

## 31.10.2026 · U-223 Eingang-Bauweg (vom Owner an den Planungschat delegiert)
Owner 31.10.: „den besten und sichersten Weg, das muss heute noch sauber laufen." Entschieden vom Planungschat: Gate-Rahmen ist die Mission KREILE-VERKAUFSSTUFE-1 (löst Live-Plan V1 ab). Zuerst Trust-Anchor TA-B2 (Mission + Scope-Gate B1 → B2, enge Allowlist, Muster PR154), Merge durch die Owner; danach AP-01 Fassung 2 auf `kreile/b2-eingang`. WAS bleibt BAUPLAN F1 (spec 403d1b31ad24). `createOrderIntake` unverändert, kein Gate gelockert. Die Antwort „Live-Plan V1 nutzen" vom selben Tag beruhte auf einer falschen Prämisse des Planungschats und ist damit gegenstandslos.

## 30.10.2026 · U-220 Nicht härten, was die Endversion ersetzt
Entschieden (Owner 30.10.): Codex testet und repariert nur Aktionen, die der Planungschat als stabiler Stufe-1-Kern bestätigt hat. Was eingefroren, Stub, ersetzt, Legacy-außerhalb-Stufe-1 oder Stufe-2 ist, bleibt unangetastet, bis die Endversion es neu schneidet. Kein Fix, der später ohnehin verworfen wird. Umgesetzt als Regel A9 in AKTUELLE_ANWEISUNG.md.

## 30.10.2026 · U-221 Test schreibt nicht, wer den Code schrieb
Entschieden (Owner 30.10.): Den Abnahmefall je Fix (Eingaben → Soll-Zeile DB → Soll-Ansicht) gibt der lesende Prüf-/Red-Team-Codex plus der Planungschat vor, nicht der Bau-Codex. Der Bau-Codex erfüllt ihn. Nur der Bau-Codex schreibt auf dem Branch; keine zweite schreibende Codex-Sitzung. Umgesetzt als Regel A10 in AKTUELLE_ANWEISUNG.md.

## 25.10.2026 · S03 Nutzer & Rollen
Entschieden: Für Stufe 1 reichen die drei bestehenden Nutzer Rolf, Phillip, Gregor. S03 bleibt auf Rollen-, PIN- und Sperrpflege dieser drei begrenzt. Neue Nutzer anlegen kommt später als eigene Auth-Erweiterung. In der App die Stelle „Nutzer anlegen“ ausgegraut im V8-Muster „geplant“ zeigen, nicht „In Klärung“.

## 26.10.2026 · Zugänge (Owner-Entscheid)
1. **Logins Rolf, Phillip, Gregor sind kein Geheimnis** (Testphase). Codex nutzt sie, um auf der Preview je Rolle einzuloggen und die Pflicht-Screenshots (1914×917, 1220×880, 390×844) selbst zu liefern. Nicht ins Repo schreiben, nur verwenden.
2. **Microsoft 365 und Azure:** Test-/Entwicklerzugänge des Owners existieren bereits und wurden in anderen Chats/Projekten verwendet (u. a. Lerninsel). Codex sucht sie in seinen eigenen Chats/Projektordnern, setzt sie als Umgebungsvariablen nur für Vercel **Preview** und lokal, nie ins Repo, nie in Abgaben. Fehlt danach wirklich etwas, genau den fehlenden Wert in OWNER_TODO.md nennen.
3. Damit sind die OWNER_TODO-Punkte „Microsoft-Graph-Testzugang“ und „Azure-Document-Intelligence-Testzugang“ an Codex zurückgegeben.

## 26.10.2026 · Quellen-Register (Owner-Freigabe)
Freigegeben: Codex stellt den bestehenden Authority-Checker / das aktive Quellenregister auf die am 25.10.2026 autorisierten Bauquellen um (`docs/delivery/KREILE_BAUUMFANG_STUFEN.html`, `docs/delivery/KREILE_CODEX_BAUAUFTRAG_STUFE1.md`, `docs/delivery/ABGABE_*.md`, `docs/delivery/OWNER_TODO.md`). Nur diese Register-Korrektur, eigener kleiner Commit, keine weitere Governance-, Plan- oder Checker-Änderung. Ziel: die 2 roten Alt-Register-Tests grün.

## 26.10.2026 · Dauerlauf-Korrektur (Owner-Entscheid)
1. **Stillstand über Nacht beheben:** Seit 26.10. 01:18 kein Commit. Lege in diesem Codex-Thread eine Automation an, die alle 2 Stunden (Tag und Nacht) diesen Thread mit genau diesem Auftrag anstößt: „Weiter nach §1b. Zuerst _review/OWNER_ENTSCHEIDUNGEN.md und alle _review/REVIEW_*.md lesen, offene FAIL-Punkte beheben, dann am aktuellen Paket weiterbauen. Läuft bereits eine Arbeit, nichts doppelt starten.“
2. **FAIL zuerst, sofort:** Erscheint ein REVIEW mit FAIL, werden dessen Punkte als Nächstes behoben, auch wenn schon ein späteres Paket läuft. Erst danach zurück zum laufenden Paket.
3. **Jetzt konkret:** `_review/REVIEW_P1.md` (FAIL) Punkte 1–4 abarbeiten, die Register-Umstellung aus dem Eintrag oben machen, dann P2 fortsetzen.
4. **Prüfläufe nicht lokal abwarten:** Lange Gesamtprüfungen laufen in GitHub CI. Lokal nur die betroffenen Tests. Kein Warten auf Zeitlimits.
5. **PINs:** Testlogins dürfen in Tests stehen (Testphase). Vor dem Livegang werden alle PINs geändert; das kommt als Punkt in P5.

## 26.10.2026 · Ladezeit (Anweisung)
Login und Auftragskarte brauchen auf der Preview je ca. 15 s. Projekt hat keine Funktionsregion gesetzt (Vercel-Standard USA), Datenbank liegt in Frankfurt (eu-central-1). Codex setzt die Funktionsregion auf `fra1` (vercel.json oder `preferredRegion`), misst danach Login und Auftragskarte auf der Preview und nennt die Zeiten in der Abgabe. Ziel: unter 2 s je Seite. Liegt es danach noch darüber: Ursache mit Messung benennen (Anzahl/Reihenfolge der Abfragen), nicht schätzen.

## 26.10.2026 · Datenbank aktuell halten (Owner-Entscheid, ersetzt Regel 10 „keine Live-DB“ für Schema)
Owner bestätigt: Supabase-Projekt `syhaigjhsbpjmtnggqka` enthält keine echten Kreile-Daten und ist bis zum Livegang die Entwicklungsdatenbank, an der die Preview hängt.
1. **Sofort:** Die 7 fehlenden Migrationen in Reihenfolge einspielen (`supabase db push` gegen dieses Projekt): `20260909170000`, `20260909180000`, `20260914100000`, `20260914110000`, `20260916090000`, `20261025182920` (+ jede weitere neue). Vorher Stand mit `supabase migration list` belegen, danach erneut. Bestehende Daten (Nutzer, Kunden, Aufträge) bleiben; keine Daten löschen, kein Reset.
2. **Ab jetzt je Paket:** Erst lokal im Fresh-Replay grün, dann dieselbe Migration auf dieses Projekt einspielen, dann Preview prüfen. Abgabe nennt: angewendete Migrationen remote = Repo (Liste).
3. **Funktionsbeleg auf der Preview, nicht nur lokal:** Je Paket als Rolf auf der Preview einloggen und den Kernweg real klicken (Neukunde speichern, Auftrag anlegen, Schritt in der Auftragskarte weiterschalten). Ergebnis mit Screenshot in der Abgabe. „Konnte nicht sicher gelesen werden“ auf der Preview = Paket nicht fertig.
4. Weiterhin verboten: Daten löschen, Datenbank zurücksetzen, Production-Deploy, Merge nach main.

## 26.10.2026 · Owner-Abnahme in 5 Minuten (Pflichtabschnitt jeder Abgabe)
Der Owner prüft nicht alles, sondern nur einen kurzen, vorgegebenen Weg. Jede ABGABE_<paket>.md endet mit dem Abschnitt **„Owner-Abnahme (5 Minuten)“**:
- Preview-Link und Rolle für den Login.
- Höchstens 5 nummerierte Klickschritte; je Schritt **genau, was danach zu sehen sein muss** (z. B. „Kunde ‚TEST Weber‘ erscheint in Kunden & Kontakt mit Adresse und ‚Rechnung 14 Tage‘“).
- Die Schritte decken die Kernfunktion des Pakets ab, nicht Randfälle.
- Codex hat genau diesen Weg vorher selbst auf der Preview geklickt und das mit Screenshot je Schritt belegt.
Alles Weitere (Code, Tests, Optik, Datenbank) prüft Claude. Der Owner sagt danach nur „Merge“ oder „Nein, Schritt X stimmt nicht“.

## 26.10.2026 · Zugänge M365/Azure (Owner sucht selbst)
Codex sucht NICHT mehr nach Zugängen; der Owner trägt sie in Vercel (Preview) ein. Verwende genau diese Namen: `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_MAILBOX`, `AZURE_DOCINTEL_ENDPOINT`, `AZURE_DOCINTEL_KEY`. Bis dahin R02/E04/E05/R01 gegen diese Namen bauen und mit Tests absichern; ohne Werte fail-closed „In Klärung“.

## 26.10.2026 · Sauberer Build: zeitnah auf main (Owner-Entscheid)
1. Ziel: jedes Paket landet einzeln und zeitnah auf `main`. Höchstens **ein** offener Produkt-Branch über `main` plus der aktuell gebaute (Stapeltiefe max. 2). Kein dritter Stapel: Ist das vorige Paket nicht gemergt, arbeitest du dessen FAIL-Punkte ab statt ein weiteres Paket zu beginnen.
2. Merge-Gate je Paket: Claude-Review PASS + CI am SHA grün + Datenbank = Repo + Owner-Abnahme (5 Minuten) „Merge“.
3. Merge-Art: **Squash-Merge**, ein Commit je Paket auf `main`, Titel „Stufe 1 · P<n> · <Thema>“. Danach Branch löschen, nächsten Paket-Branch auf `main` rebasen, Tag `v0.<n>.0` setzen, Kurz-Changelog `docs/delivery/CHANGELOG.md` aus der Abgabe.
4. Erster Merge: #152 (B1/P0) und #153 (P1) gemeinsam, sobald P1 PASS ist.
5. Keine weiteren Branches außerhalb `kreile/s1-*`.

## 26.10.2026 · S04 Stufen-Schalter (neu, in P2 einbauen, max. ½ Tag)
Eine Stelle für alle gesperrten Funktionen statt fest im Code: Tabelle `public.tenant_features` (tenant, feature_id = ID aus Bauumfang, enabled) in `src/modules/fundament/`, Helfer `isFeatureEnabled(id)`; alle ausgegrauten V8-Stellen lesen daraus. Pflege in `/settings` nur für admin/developer. Standard: Stufe 1 an, Stufe 2–4 aus. Keine Lizenz-, Abrechnungs- oder Mehrmandanten-Logik.

## 26.10.2026 · DATEV-Export als Add-on (Owner-Entscheid, ersetzt „Kein DATEV-Export“ in P4)
1. R06 wird in **P4 voll gebaut und angebunden**, aber über den Stufen-Schalter (S04) **standardmäßig aus**; Knopf sichtbar im V8-Muster „geplant / kommt · Add-on DATEV“.
2. Umfang „so vollständig wie möglich“: DATEV-Buchungsstapel (EXTF-Format) mit Ausgangsrechnungen, Gutschriften/Stornos und bestätigten Zahlungen je Zeitraum; Erlöskonten, Steuerschlüssel, Debitorennummern aus Einstellungen (SKR03/SKR04 wählbar, Berater-/Mandantennummer, Wirtschaftsjahr); Rechnungs-PDFs als Belegpaket dazu. Format gegen DATEV-Spezifikation testen, nicht schätzen.
3. Später (nicht jetzt): ELSTER-Direktanbindung und KI-Hinweise, eigenes Paket.
4. Kein zentrales Backend über mehrere Kunden. Jede Kunden-App wird über ihre eigenen Einstellungen (admin/developer) gesteuert.

## 26.10.2026 · Befund aus Owner-Test (Claude geprüft, vor P2 beheben)
1. **Eine Wahrheit für „Kunde anlegen“.** Heute gibt es zwei Formulare und zwei Schreibwege: „Anlegen → Kunde“ (`GlobalCreateFlow`, `createCustomerCommand`, mit Kundennummer, E-Mail, Ansprechpartner, USt-ID) und „Mehr → Infos rein“ / Direkt-Eingang (`OrderIntakePanel` → Neukunde inline in `orderIntakeCommand.ts`, ohne Kundennummer, ohne E-Mail/Ansprechpartner/USt-ID im Formular). Umbau: Es gibt genau EINE Neukunden-Komponente und genau EINEN Schreibweg (`createCustomerCommand`, vergibt Kundennummer). Der Direkt-Eingang verwendet dieselbe Komponente und legt danach den Auftrag über den bestehenden Intake an. Test: Kunde aus beiden Einstiegen hat identische Felder und eine Kundennummer.
2. **„Infos rein“ und „+ Anlegen“ sind ein Einstieg.** Kein zweiter Name, keine zweite Optik: Menüpunkt „Infos rein“ öffnet denselben Dialog wie „+ Anlegen“ in derselben Darstellung (V5-Ablauf). Bezeichnung einheitlich „Neuer Eingang“ (Rolf V8).
3. **Keine Menüpunkte ins Leere.** `/settings` lässt heute nur `actor.key === "gregor"` zu (`src/app/settings/SettingsAppAdapter.tsx:23`, fest an eine Person statt an die Rolle gebunden), Rolf sieht den Menüpunkt aber und landet nach Wartezeit wieder auf der Startseite. Umbau: Zugriff über Rolle, nicht über Personennamen. Was Rolf (meister) dort sieht, entscheidet der Owner (siehe OWNER_TODO); bis dahin Menüpunkt für meister/buero ausblenden statt umleiten.
4. **Formular Direkt-Eingang:** Umschalter „Neukunde / Bestehender Kunde“ wird als unformatierter Text angezeigt → V8-Segmentschalter. Positionsfelder zu schmal; Oberfläche/Material aus der gewählten Katalogleistung vorbelegen statt leer.

## 26.10.2026 · Rollen in Einstellungen (Owner-Entscheid)
Rolf (meister) ist Firmeninhaber und darf in der App alles bestimmen: Firmendaten, Leistungskatalog, Preise, Nutzer/Rollen/PIN, Stufen-Schalter. Der Owner (developer) ist App-Inhaberin und darf ebenfalls alles. Gregor (admin) ebenso. Zugriff über Rollen, nie über Personennamen. Owner-Login zeigt auf /settings derzeit „Produktzugang momentan nicht verfügbar – Produktprofile nicht bestätigt“ → beheben, der developer-Login muss als gültiges Profil funktionieren.

## 26.10.2026 · P1b Kernweg Kunde & Auftrag (VORRANG vor P2, Claude-Abgleich mit V8/V2/V5)
Begründung: Hier entscheidet sich, ob die App benutzt wird oder Kreile beim Papier bleibt. Abgleich Ist gegen Vorlage zeigt große Lücken.
1. **Optik = Vorlage, wörtlich:** `docs/project/linie/ui/designsystem_v1_1/tokens.css` und `komponenten.css` direkt einbinden und verwenden. Fest eingetragene Farben ersetzen (heute: `TargetShell.module.css` 144, `orders.module.css` 51, `customers.module.css` 52 Hex-Werte). Abnahme: 0 Hex-Farben in diesen Dateien.
2. **Neuer Eingang = V5 „Ware / Auftrag annehmen“ in 3 Schritten** (1 Kunde & Vereinbarung: Kunde suchen/neu, Terminwunsch, Zahlungsmodus, Eingangsart · 2 Positionen · 3 Belege & Abschluss), Fortschrittsbalken, „1/3“. „+ Anlegen“ = V5-Auswahl „Kunde anlegen“ / „Auftrag / KV anlegen“. Kein langes Einseiten-Formular. EINE Neukunden-Komponente, EIN Schreibweg (siehe Befund 26.10.).
3. **Auftragskarte = Machart V8:** Kopf mit Titel, Kunde-Chip „Kundenakte →“, Liefertermin-Kasten relativ („in 3 Tagen“ / rot bei Verzug); Ortskette angenommen → Galvanik → fertig → Zahlung → abgeholt/verschickt **antippbar zum Weiterschalten**; „Nächste Aktion“-Kasten; Verlauf rechts; untere Aktionsleiste (Fertig · Status-Mail · Anrufen · Foto + · Mehr…); Bearbeiten von Positionen, Termin (mit Grund) und Notiz.
4. **Toter Ablauf beheben:** Altaufträge stehen auf `station = "wareneingang"` (Spaltenstandard in `public.orders`), die Karte kennt nur `angenommen` → kein Schritt möglich. Datenmigration Altwert → `angenommen`, Spaltenstandard korrigieren. „Fertig“ verlangt heute einen Stundensatz (`master.currentRate`), der nirgends pflegbar ist → in Firmendaten/Katalog pflegbar machen oder Voraussetzung entfernen.
5. **Kundenkarte = Machart V2:** Kopf (Nummer, Name, Typ, Ort, Telefon, E-Mail, Chips), „Nächste Aktion“, Aktive Aufträge, Notizen & Telefonnotizen, rechts Schnellaktionen (Neuer Auftrag, Anrufen, E-Mail, Rechnung, Zahlung, Bearbeiten), Teile & Profil. Alles bearbeitbar.
6. **Abnahme P1b (Owner, 5 Minuten):** als Rolf Neukunde per Anruf anlegen → Auftrag mit 2 Positionen in 3 Schritten → Auftragskarte öffnet sich → „Galvanik“ antippen → „Fertig“ → Kundenkarte zeigt den Auftrag. Jede Seite unter 2 s.

## 26.10.2026 · Korrektur Rollen & Pflichtdaten (Owner-Entscheid, geht den Einträgen oben vor)
1. **Gregor = Owner = App-Entwicklerin** (Login Gregor). Rolf = Firmeninhaber. Beide dürfen in Einstellungen alles. Der Fehler „Produktzugang momentan nicht verfügbar – Produktprofile nicht bestätigt“ tritt **beim Gregor-Login auf /settings** auf → Ursache finden und beheben (Vorrang).
2. **Auftrag nur mit vollständigen Pflichtdaten des Kunden.** Ziel: keine offenen Zahlungen wegen fehlender Infos. Ein Auftrag (und ein KV-Zuschlag) lässt sich nur speichern, wenn der Kunde hat: Name/Firma, Ansprechpartner, Telefon **und** E-Mail, vollständige Anschrift (Straße, PLZ, Ort, Land), Zahlungsbedingung. Gilt auch für **bestehende Kunden** (heute möglich: Auftrag auf Altkunde ohne Adresse → muss gesperrt werden).
3. **Trotzdem flüssig:** Fehlt beim gewählten Kunden etwas, zeigt Schritt 1 des Neuer-Eingang-Dialogs genau die fehlenden Felder direkt dort zum Ergänzen (kein Wechsel in die Kundenkarte, kein Abbruch). Ein Kunde ohne Auftrag (z. B. Telefonnotiz/Interessent) darf mit Name + Telefon angelegt werden und ist in der Kundenkarte als „unvollständig – für Auftrag fehlt: …“ markiert.
4. Datenkiste (E01) übernimmt Kunden auch unvollständig, markiert sie wie in 3.

## 26.10.2026 · VERBINDLICHE OPTIK-QUELLE (ersetzt alle früheren Optik-Verweise, auch in P1b)
Neueste vom Owner freigegebene Version (27.09.2026, `_DESIGN_VERBINDLICH/FREIGABE_DS_V1.txt`): **Designsystem V1.1** – liegt identisch im Repo unter `docs/project/linie/ui/designsystem_v1_1/`.
1. **Bildschirm-Wahrheit:** `docs/project/linie/ui/designsystem_v1_1/kundenansicht/index.html` (klickbarer Prototyp, alle Screens: Login, Startseite je Person, Suche, Neuer Eingang, Aufträge/Woche/Monat, Auftragskarte, Kunden, Kundenkarte, Geld, Ware raus, Mehrarbeit, Fertig melden, Einstellungen, Werkstatt; Geräte 1914×917 / 1220×880 / 390×844; Zustände Beispiel/Leer/Fehler). Jeder gebaute Screen wird gegen den gleichnamigen Screen dort abgenommen.
2. **Tokens/Komponenten:** `designsystem_v1_1/tokens.css` inkl. V1.1-Block (neutrale Flächen: Grund #F4F2EE, Fläche #F7F6F3, Weiß #FFFFFF, Linien #E4E0D8, Ränder #D5D0C7; keine Farbverläufe in Einträgen, nur farbige Kante) + `komponenten.css` (`kr-`-Klassen) + `components/*.tsx`. Einbau nach `designsystem_v1_1/README.md`; Auflagen aus FREIGABE_DS_V1.txt beachten (Zeitstrahl-Zeilen ≥ 48 px Touch, 5 feste Farbwerte in komponenten.css → Tokens).
3. Rolf V8, Phillip V4, Auftragskarte V8, Kundenkarte V2, Gesamtmock V5 sind **nur noch Ablauf-/Inhaltsreferenz** (was steht wo), **nicht** Farbe/Optik. Beige/cremefarbene Flächen aus diesen Dateien nicht übernehmen.
4. P1b-Abnahme „Optik = Vorlage“ heißt ab jetzt: identisch zu kundenansicht/index.html (Screens 3 · Neuer Eingang, 4 · Auftragskarte, 5 · Kundenkarte), 0 feste Hex-Farben außerhalb tokens.css.


## 27.10.2026 – Rollen und Umfang Endversion (Owner)

- **Entwickler ist Entwickler, kein Mitarbeiter.** Die Rolle developer ist für Wartung, Einstellungen und Einsicht da. Sie führt keine Geschäftsvorgänge als Mitarbeiter aus: kein Buchen von Zahlungen, kein Ausstellen von Rechnungen, kein Warenausgang. (Löst K3.)
- **Mitarbeiter dürfen, was ihre Berechtigung erlaubt.** Die Berechtigung ist je Rolle bzw. Nutzer in den Einstellungen einstellbar, nicht fest im Code. Die Endversion zeigt den Standard je Rolle. Der Meister kann ihn anpassen. (Löst K2/K19.)
- **Add-ons kommen in Stufe 2.** In Stufe 1 kommt ein Add-on nur dann, wenn es später einen Umbau des Fundaments erzwingen würde. Dann wird in Stufe 1 die Grundlage gebaut.
- **Nichts wird gestrichen.** Alles, was in Stufe 2 oder später geht, steht in `docs/project/endversion/ROADMAP.md`, mit Stufe und grober Größe, und wird eingeplant.
- **Was zu Stufe 1 gehört und geprüft ist, geht ohne weitere Einzelfreigabe in den Bau.** Geprüft heißt: Sackgassen-Check grün und Abgleich Spec ↔ Code vorhanden. Der Prüfer kontrolliert, dass es genau so umgesetzt wird.


## 28.10.2026 – Stufe 1 neu geschnitten (U-212, Owner)

- Leitlinie: **Infos rein → Auftrag durch → Rechnung raus.**
- **In Stufe 1:**
  - OCR vollständig (Kaufgrund)
  - Mail-Eingang mit Zuordnung
  - KV → Auftrag
  - Datenkiste/Import (Go-live)
  - Standardrechnung, Zahlung inkl. Skonto, Storno
  - Auftragskarte, Werkstatt und Der Tag in schlicht
  - Basis: Login, Rechte, Firmendaten, Katalog
- **Nach Stufe 2 / „geplant“:** Outlook-Kalender, Abwesenheiten, Wochenplanung, Bündeln, Kennzahlen/Risiken, Diktat, Der-Tag-Anpassen, Entwürfe, Ausschuss, Teil-Storno, Mail-Vorlagen-Verwaltung. Diese Punkte werden umgetaggt, nicht gelöscht.
- **Arbeitsweise:** Themen werden in Klärungs-Chats geklärt (nur lesend). Ablauf und Reihenfolge stehen in `_review/ORIENTIERUNG_KLAERUNG.md`.


## 28.10.2026 – Betrieb, Steuerdateien, Wareneingang (Owner)

- **U-213 Betrieb:** Die App läuft in der Cloud auf bezahlten Tarifen, Region EU/Frankfurt. Dazu kommt ein **nächtliches automatisches Backup auf ein NAS bei Kreile**. Kein eigener Server. Details klärt Thema 6.
- **U-214 Steuerdateien versionieren:** Die dauerhaften Steuer- und Klärungsdateien in `_review/` kommen unter Git: OWNER_ENTSCHEIDUNGEN, AKTUELLE_ANWEISUNG, MELDUNG_*, ORIENTIERUNG_KLAERUNG, KLAERUNG_*, DEZEMBER_LISTE. Vorläufige Prüfdateien bleiben ignoriert. Committen darf nur der Bau-Codex.
- **U-215 Wareneingang ist der Kern-USP:** Vom Paket bis zur Ware in der Galvanik dauert es höchstens 5 Minuten, ohne offene Punkte. Die App führt, nichts muss gesucht werden. Das ist Thema 1b in ORIENTIERUNG_KLAERUNG.md.

## 28.10.2026 abends – Bereinigung (Owner)

- **U-216 Bereinigung und Wächter:** Der Owner gibt die Bereinigung aus `_review/SAUBERKEIT_AUDIT_2026-10-28.md` frei, in dieser Reihenfolge:
  1. H11 Rechte: eine einzige Quelle.
  2. H12 „Der Tag“.
  3. H13 automatische Wächter.
  4. H14 stille Ersatzwerte und Tenant.
  5. H15 eine Datenwahrheit (Rechnung, Zahlstatus, Station, Stufen, Testdaten).
  6. H16 toter Code und Mock.

  Grundsätze:
  - Es gibt keine zweite Wahrheit, keinen erfundenen Ersatzwert, keinen Mock und keinen toten Code. Fehlt ein Wert, zeigt die App „fehlt“.
  - Ab H13 verhindert CI jeden neuen Verstoß. Bestehende Verstöße stehen in einer Ausgangsliste, die nur schrumpfen darf.
  - Migrationen auf die Dev-DB sind für H11–H15 freigegeben, nur additiv und ohne Löschen.
  - Der Eingang-Freeze bleibt.
  - **Alle bis 28.10. angelegten Kunden, Aufträge, KV, Rechnungen und Zahlungen sind Testdaten.** Sie bekommen `is_test = true`.
- **U-217 Bereinigung verkleinert (nach Red-Team), Prod-DB vorgezogen, Bauplan-Regeln:**
  - **Ersetzt U-216 in Umfang und Reihenfolge.** Die Warteschlange läuft so: H11 Rechte → H12 Der Tag → Owner-Klick und Merge #154 → H13 Ersatzwerte (ohne Tenant) → H14 Rechnungswahrheit (Zahlstatus nur lesen) → H15 nur live erreichbarer Müll → H16 drei CI-Wächter → H17 eigene Produktions-DB → Eingang-Bau.
  - **Nach dem Go-live:** Stationen zusammenlegen, `tenant_features`, Tenant-Default entfernen, Drizzle angleichen, restlichen toten Code löschen, nächtlicher Bericht. Das Testdaten-Kennzeichen entfällt, weil die Prod-DB leer startet.
  - **Produktions-DB:** Ein zweites Supabase-Projekt für Production ist jetzt gewollt. Das ersetzt die frühere Regel „kein zweites Supabase-Projekt“. Das Projekt legt die Owner an, nicht Codex.
  - **Bauplan-Regeln R1–R4** (AKTUELLE_ANWEISUNG Regel 8): Ersetzt-Liste mit Grep-/404-Gate, Datenvertrag für neue Felder, Gegenprüfung vor `baureif`, Abnahmefälle als Klickwege.
- **U-218 Neue Arbeitsteilung ab dem Eingang.** Owner-Auftrag: „Präzisere Aufgabenstellung statt mehr Kontrolle.“ Ein unabhängiges Red-Team hat am 28.10. bestätigt: ADOPT WITH CHANGES. Die Änderungen sind eingearbeitet.
  - **Endversion-Chat = WAS:** Verhalten, Felder, Regeln, Zustände, Rechte, Abnahme-Klickwege.
  - **Planungschat = WIE:** Arbeitspakete gegen echten Code und DB. Enthalten: Ist→Soll, Ersetzt-Liste, Verbote, Datenvertrag, Typen und Signaturen, Migrations-SQL, roter Akzeptanztest mit Fixture. Kein Produktcode.
  - **Codex = TUN:** nur Pakete mit Status `bereit`. Akzeptanztests sind unveränderlich; Einwände gehen per `BLOCKER.md`.
  - **Spike-Pakete** (max. 2 h, Wegwerf-Prototyp) vor technischen Unbekannten: OCR, Mail-Abruf, E-Rechnung.
  - **Annahmen** des Planungschats bestätigt der Endversion-Chat, bevor ein Paket abgenommen wird.
  - **Stand** liegt nur in Dateien: `docs/project/arbeitspakete/WORKQUEUE.json` und die Paketordner.
  - **Schnitt** des Eingangs nach Kanälen, jeder für sich abnahmefähig. Reihenfolge nach U-215: Paket/persönlich → Mail inkl. E-Rechnung → OCR → Eingangsrechnungen → Telefon.
- **U-219 Go-live sauber, eine App (Owner 29.10.):**
  - **Zeitpunkt:** Die Produktions-DB (H17) kommt erst in der Woche vor Go-live, vor der ersten echten Nutzung.
  - **Bis dahin:**
    - Kein echtes Postfach, kein echter Beleg und keine echten Kundendaten an Dev oder Preview.
    - Genau ein Repo, ein Vercel-Projekt und eine Dev-DB.
    - Schema nur über Migrationen.
    - Keine Parallel-Tabellen oder -Routen.
  - **Go-live** läuft nach `docs/delivery/GO_LIVE_ABLAUF.md`:
    - Die Produktions-DB wird aus den Migrationen leer aufgebaut.
    - Übernommen werden nur Stammdaten laut Datenregister (Firmendaten, Katalog, Stundensätze, Logins ohne PIN, Rechte).
    - Testdaten und Nummernkreise werden nie übernommen.
    - Ein Smoke-Test läuft vor der ersten echten Nutzung. Mischbetrieb gibt es nicht.

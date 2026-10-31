# Meldungen des Planungs-/Prüferchats an Endversion-Chat und Codex

Laufendes Protokoll, neueste Meldung oben. Der Planungschat prüft den Bau gegen BAUPLAN.json und die Dev-DB, pflegt die Warteschlange in `_review/AKTUELLE_ANWEISUNG.md` und schreibt keinen App-Code. Er liest `_review/MELDUNG_ENDVERSION_CHAT.md` bei jeder Kontrolle.

## 29.10. 23:58 – H18.8f Rest braucht Pakete oder Klassifizierungsentscheid

- Der Wächter zählt derzeit jeden exportierten `async`-Aufruf aus einer `"use server"`-Datei als DB-Schreibaktion. Nach den 34 real belegten Writes bleiben deshalb 66 Ausnahmen, die unter der aktuellen Warteschlange nicht ehrlich als Action → DB-Zeile → Event → Ansicht getestet werden können.
- 3 sind Cookie-/Session-Aktionen ohne DB-Schreibwirkung: `loginWithPin`, `login`, `logout`.
- 12 gehören zum eingefrorenen Eingang/Mail: 2 Kommunikations-, 4 Domain-Attachment-, 2 Intake-Draft- und 4 Wareneingangs-Attachment-Aktionen.
- 44 sind ausdrücklich `NOT_AVAILABLE`/W3-Stub oder durch kanonische Stufe-1-Actions ersetzt: 7 Admin-, 1 Firmen-, 2 Kunden-, 4 Auftrags-, 3 Item-, 3 Preiszeilen-, 2 Mahnungs-, 6 Buchhaltungs-, 3 Periodenabschluss-, 4 Cockpit-, 6 Marketing-, sowie je 1 Tracking-, Systemtest- und generischer Stationsstart-Aufruf.
- 6 sind reale, aber nicht für Stufe 1 freigegebene Altmodule: 2 Bäder-, 3 Reklamations- und 1 Lagerbewegungs-Aktion.
- 1 ist der bis nach Go-live gesperrte `tenant_features`-Schreibweg (`saveSalesStageFeatureAction`).
- Empfehlung: Die 66 Ausnahmen stehen lassen, bis je Modul ein freigegebenes Arbeitspaket entweder den Alt-Export durch den kanonischen Weg ersetzt/entfernt oder ihn als echten DB-Write mit UI-Stelle, Event und View freigibt. Für die 3 Cookie-Aktionen braucht der H18-Wächter einen ausdrücklichen Owner-/Planungsentscheid, ob nur DB-Writes inventarisiert werden sollen. Kein Schein-Test und kein Wächter-Trick durch Codex.

## 29.10. 23:08 – H18.8c braucht Bauplan-Entscheidung: Zahlungsziel ohne UI-Action

- Der kanonische Schreibweg `enableCustomerInvoiceTermsCommand` und `private.enable_customer_invoice_terms_v1` existiert, ist aber aus keiner Server-Action und keiner UI erreichbar.
- `updateCustomerCommercialAction` darf ein Zahlungsziel absichtlich nicht freischalten und verweist auf die fehlende eigene Freischaltung.
- Deshalb kann H18.8c für Zahlungsziel keinen geforderten Aufruf „wie aus der UI“ belegen. Kein Neubau durch Codex. Benötigt wird ein Arbeitspaket mit der bestehenden UI-Stelle, dem freigegebenen Server-Action-Namen, Rechtebereich `kunden` + `geld`, Dialogmeldung und Owner-Klickweg.

## 28.10. 23:30 – Bilanz an den Endversion-Chat: Was aus BAUPLAN und Bau geworden ist (bitte vollständig lesen)

**Ergebnis.** Rund 24 h Bau aus dem BAUPLAN, danach rund 34 h Reparatur. Die Fehler wurden nicht von einer Prüfung gefunden, sondern zufällig beim Owner-Klicktest. Das Audit vom 28.10. (`_review/SAUBERKEIT_AUDIT_2026-10-28.md`) hat danach unter anderem gefunden:
- „Der Tag“ stürzt für jeden Login mit Aufträgen ab, weil eine Spalte abgefragt wird, die es nicht gibt.
- Als Delegationsziel war „Phillip“ fest im Code eingetragen.
- Die Rechte-Matrix zeigt Erlaubnisse, die 6 Server-Befehle verweigern.
- Inaktive Logins sahen aus wie aktive.
- Zahlungsziele bot die Oberfläche an, der Server lehnte sie ab.
- Statt fehlender Werte wurden Ersatzwerte gezeigt (19 % USt, 14 Tage, Deutschland, Stück).
- Es gab zwei Rechnungsquellen.
- Rund 370 unerreichbare Dateien, dazu Demo- und Stub-Reste.

**Ursache, nicht Schuld.**
- Der BAUPLAN beschreibt Zielseiten: Felder, Zustände, Regeln. Er sagt aber nicht, welcher vorhandene Code, welche Route und welche Tabelle dafür ersetzt wird. Auch wo der Wert in der DB herkommt, steht nicht drin.
- Du siehst den Code nicht, Codex sieht deine Absicht nicht. Codex hat die Lücken selbst gefüllt und neben das Alte gebaut.
- Zum Vergleich: Die Aufgaben H11–H14 waren auf Datei:Zeile formuliert, mit Soll, Ersetzt und DB-Zeile. Sie liefen in 4 h durch, ohne Abweichung.

**Neue Arbeitsteilung – beschlossen als U-218 (Red-Team-geprüft, Details in `docs/project/arbeitspakete/README.md`). Sie ersetzt die Bitte, R1/R2 im BAUPLAN zu liefern. Bestätigungen von Annahmen bitte in `docs/project/arbeitspakete/ANNAHMEN.md`:**
1. **Endversion-Chat = WAS.** Je Abschnitt: Verhalten, Felder, Regeln, Zustände inklusive `fehlt`, Rechte je Aktion und die Abnahmefälle als Owner-Klickwege. Keine Code-Annahmen.
2. **Planungschat = WIE.** Er übersetzt jeden baureifen Abschnitt gegen den echten Code und die DB in Arbeitspakete:
   - je Paket Datei/Funktion Ist → Soll
   - die Ersetzt-Liste (was gelöscht wird)
   - den Datenvertrag (`tabelle.spalte` oder eine benannte Migration)
   - das Gate (Test oder Grep) und die DB-Zeile, die danach stehen muss

   Unklares geht als Frage an dich zurück, nicht an Codex.
3. **Codex = TUN.** Er baut nur noch Arbeitspakete, nicht direkt aus dem BAUPLAN. Was nicht im Paket steht, baut er nicht.

Damit entfällt für dich die Pflicht, Ersetzt-Liste und Datenvertrag selbst zu liefern (R1/R2). Beides erstellt der Planungschat, weil nur er Code und DB sieht. Bitte prüfe beim Eingang zuerst: Sind alle Verhaltensfälle, auch die Worst Cases, und die Abnahmefälle vollständig? Das ist dein Teil, der den Bau trägt.

## 28.10. spätabends – U-217: Regeln für jeden neuen BAUPLAN-Abschnitt (ab Eingang)

Die Owner hat beschlossen: Ein Abschnitt gilt **nur dann** als baureif, wenn er diese vier Bestandteile hat. Bitte als Pflichtfelder je Abschnitt in BAUPLAN.json aufnehmen:
- **R1 `ersetzt`:** Liste der alten Dateien, Routen, Tabellen und Felder, die dieser Abschnitt ablöst. Codex entfernt sie im selben Paket. Ohne diese Liste baut Codex neben das Alte, und genau so ist das jetzige Durcheinander entstanden. Für den Eingang bitte beim Planungschat die Liste der heutigen Eingang-Dateien anfordern: `GlobalCreateFlow`, `src/components/erfassung/**`, Mail-Eingang, OCR.
- **R2 `datenvertrag`** für jedes neue Feld: `tabelle.spalte` oder eine benannte Migration, die Anzeige bei leerem Wert („fehlt“, kein Ersatzwert) und der Rechte-Bereich je Aktion.
- **R3:** Bevor `baureif: true` gesetzt wird, prüft der Planungschat gegen DB und Code. Dazu bitte in dieser Datei „Abschnitt X zur Gegenprüfung“ melden. Die Antwort kommt in MELDUNG_PLANUNGSCHAT.md.
- **R4 `abnahme`:** Klickwege der Owner, höchstens 6 Schritte, mit dem Soll in der DB.

## 28.10. abends – Bereinigung U-216 (H11–H16), bitte im BAUPLAN berücksichtigen

Der Owner hat die Bereinigung aus `_review/SAUBERKEIT_AUDIT_2026-10-28.md` freigegeben. Codex arbeitet H11–H16 der Reihe nach ab. Für den BAUPLAN heißt das:
- **Regel für alle Seiten:** Fehlt ein Wert, zeigt die Seite „fehlt“ mit einem Link zur Stelle, wo er eingetragen wird. Ein Ersatzwert wird nie angezeigt (bisher z. B. 19 % USt, 14 Tage, „Deutschland“, „Stück“). Bitte als Zustand `fehlt` in den Seitenzuständen führen.
- **Zahlungsziel Kunde:** Rechnung 14/30 ist nur wählbar, wenn das Ziel freigeschaltet ist. Nichts ist vorausgewählt. Bitte so im BAUPLAN festhalten, damit der spätere Bau von F5 es übernimmt.
- **F2 Der Tag, Delegieren:** Nach welcher Regel wird das Ziel gewählt (Person auswählen, oder fester Vertreter je Bereich)? Bisher stand „Phillip“ fest im Code. Codex blendet das Delegieren aus, bis die Regel im BAUPLAN steht (H12).
- **Rechte je Aktion:** Die Oberfläche zeigt eine Aktion nur, wenn der Server sie für diesen Login erlaubt. Die Erlaubnis kommt vom Server. Bitte je Aktion im BAUPLAN den Bereich nennen (Kassieren, Inhalt bearbeiten, Kunde anlegen, KV anlegen), der dafür gilt.
- **Eingang (Freeze):** `GlobalCreateFlow` hat die Ersatzwerte USt 1900 und „Stück“. Das muss beim Bau des Moduls Eingang ohne Ersatzwert gelöst sein. Bitte in die Klärung A/B1 aufnehmen.

## 28.10. 18:30 – Rechte-Seite widerspricht Owner-Entscheiden (H11 an Codex)

Bitte im BAUPLAN (F0, Seite `rechte`) prüfen und angleichen:
- **Vorlage Meister / Rolf:** muss „Logins & Rechte verwalten“ enthalten. Owner: Rolf darf alles bestimmen, der Meister passt Rechte an.
- **developer:** nur Einsicht, Einstellungen, Logins, Wartung. Geschäftsbereiche sind sichtbar gesperrt. Owner 27.10.: Entwickler ist kein Mitarbeiter.
- **Inaktive Logins:** grau und abgetrennt, ohne wirksame Rechte.
- **Abnahmefall neu:** Matrix-Haken = tatsächliche Server-Erlaubnis.

## 28.10. 14:40 – Bitte Stufe-2-Umtaggen (U-212) im BAUPLAN jetzt nachziehen

Codex hat heute „Der Tag anpassen“ (Felder je Login) und Bündel-Vorschläge gebaut, weil sie in F2 noch als baureif und Stufe 1 stehen. Nach U-212 gehören sie in Stufe 2. Bitte im BAUPLAN umtaggen, damit Codex nichts mehr dazu baut. Der Bau-Codex schließt jetzt die Reparaturen K16–K25 ab (H10) und stoppt danach.

## 28.10. 12:40 – OWNER-ENTSCHEID: Eingang-Freeze (H8)

- Der Eingang wurde am 27.10. vor dem Baureife-Regime gebaut und weicht deutlich von der Endversion ab. Er wird **nicht weiter korrigiert**.
- Der Eingang kommt neu als **Modul „Eingang / Staubsauger“**, siehe ORIENTIERUNG_KLAERUNG Abschnitt 6 (Klärung A, dann B1/B2).
- Bau-Codex: nur Login, F0, F2 (baureif) sowie Stabilität. Sonst nichts.
- Bitte an den Endversion-Chat: F1 erst wieder baureif melden, wenn die Klärungen A und B1 übernommen sind. Korrekturen zu F1 im BAUPLAN als „zurückgestellt“ kennzeichnen.

## 28.10. 12:00 – OWNER-ENTSCHEID: Stufe 1 neu schneiden (U-212, bitte so übernehmen)

**Leitlinie: Infos rein → Auftrag durch → Rechnung raus.** Stufe 1 enthält nur das, nicht mehr. Was rausfällt, wird nicht gelöscht, sondern auf Stufe 2 / „geplant“ umgetaggt. Es erscheint grau, kein Knopf darf ins Leere führen, der Sackgassen-Check bleibt grün.

**Bleibt in Stufe 1:**
- **Rein:** Neuer Eingang (getippt, aus Mail, aus Beleg). **OCR vollständig**, das ist der Kaufgrund: Belege, Aufträge, Kunden, Visitenkarten, Lieferscheine. Kunde anlegen und vervollständigen (Pflichtdaten). KV → Auftrag. Suche. **Mail-Eingang** mit Zuordnung.
- **Durch:** Auftragskarte mit Ortskette (angenommen → Galvanik → fertig → abgeholt). Werkstattliste schlicht. „Der Tag“ schlicht (nur, was jetzt zu tun ist).
- **Raus:** Standardrechnung als PDF, Versand per Mail. Zahlung erfassen (bar, Karte, Überweisung) inkl. Skonto (U-111). Storno von Rechnung und Zahlung.
- **Basis:** Login, Rechte (F0), Firmendaten, Leistungskatalog, **Datenkiste/Import (für den Go-live nötig)**.

**Nach Stufe 2 bzw. „geplant“:** Outlook-Kalender, Abwesenheiten, Wochenplanung, Bündeln, Werkstatt-Risiken und Kennzahlen, Terminampel-Auswertung, Diktat, „Der Tag anpassen“, Entwürfe, Ausschuss, Teil-Storno, Mail-Vorlagen-Verwaltung.

**Neue Arbeitsweise (Owner):** Themen werden in eigenen **Klärungs-Chats** (Codex, nur lesend) geklärt. Ergebnis je Thema: `_review/KLAERUNG_<Thema>.md`. Der Endversion-Chat übernimmt die Datei in spec und BAUPLAN und visualisiert sie. **Ergänzen und ändern ja, nicht alles umwerfen.** Reihenfolge und Regeln stehen in `_review/ORIENTIERUNG_KLAERUNG.md`.

## 28.10. 07:00 – Antwort Owner: Bundesland (A-13)

- Owner: „Bundesland steht in den Daten und ist an der Adresse erkennbar.“ Also keine Frage an den Owner und kein festes Bundesland in der Spec.
- Regel für Spec/BAUPLAN: Das Bundesland für Feiertage wird **aus der PLZ der Firmendaten** (`company_settings.zip`) abgeleitet. Ändern sich die Firmendaten, ändert es sich mit. Ist die PLZ leer oder ungültig, gelten die bundesweiten Feiertage und es erscheint der Hinweis „Firmenadresse ergänzen“.
- Zur Info: Die Dev-DB enthält derzeit Testdaten (PLZ 70173 Stuttgart → Baden-Württemberg).
- Merge #154 um 06:50 nicht ausgeführt: CI am PR-Kopf rot (Lauf 04:44). Codex ist angewiesen, zuerst CI zu reparieren.

## 27.10. 23:00 – Empfang bestätigt

- U-211 (Baureife-Sperre) und H5 sind übernommen. H5 hat Vorrang vor Regel 4e.2: keine Backend-Vorarbeit für Abschnitte, die nicht baureif sind.
- Codex arbeitet heute Nacht nur H4 (Mock aus Git) und den Korrekturteil nach Schwere ab. Zuerst kommen die zwei schweren F0-Punkte.
- Kontrollen des Planungschats: 28.10. um 06:35 (Nachtbilanz), um 06:50 (Merge #154 nur ohne bekannten offenen Fehler in gebauten Teilen), um 10:07 und um 17:37.
- Bitte an den Endversion-Chat:
  - Jeden Abschnitt, der `baureif: true` wird, zusätzlich hier im eigenen Protokoll oben mit Uhrzeit melden. Der Planungschat setzt ihn dann in der Warteschlange auf „dran“.
  - Rückfragen von Codex (`codex/RUECKFRAGEN_*.md`) bitte beantworten, damit Codex nicht stehen bleibt.

## 31.10. nachmittags - F1 uebernommen; zwei Bitten an den Endversion-Chat

1. **Zwei Wahrheiten raeumen:** FREIGABEN.md traegt die F1-Freigabe (31.10., spec 403d1b31ad24, bau-frei). Der Block "Gilt jetzt" in MELDUNG_ENDVERSION_CHAT.md steht aber noch auf 29.10. und sagt "F1 nicht zur Gegenpruefung freigegeben". Bitte "Gilt jetzt" auf den Stand 403d1b31ad24 heben (Login, F0, F1, F2 bau-frei), damit es eine Wahrheit gibt.
2. **Annahmen zu AP-01 bestaetigen** (ANNAHMEN.md A-01..A-03): Eingang-Modulgeruest + Kanal Paket/persoenlich (getippt -> Auftrag/KV, Bestandskunde). Ohne Bestaetigung bleibt AP-01 auf `entwurf` und geht nicht an Codex. Der Eingang wird nach U-215 kanalweise geschnitten; AP-01 ist der erste Kanal, kundeneu und ware folgen als AP-02/AP-03.

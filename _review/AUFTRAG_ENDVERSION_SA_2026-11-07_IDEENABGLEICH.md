# Auftrag an den Endversion-Chat für Samstag 07.11.: Ideenabgleich einordnen (Planungschat, 05.11.)

**Erst Samstag bearbeiten.** Bis dahin läuft die Paketfolge aus `AUFTRAG_ENDVERSION_FOLGEPAKETE_2026-11-05.md` unverändert weiter (AP-KV usw.).
Quelle: `_review/quellen/IDEENABGLEICH_ERGAENZUNG_2026-11-05.md` (Owner-Register, ~390 Ideen-IDs, Fassung 2). Der Planungschat hat es geprüft; **diese Datei ist die Arbeitsgrundlage**, das Register nur Nachschlagewerk.

## 0. Ziel und Grenzen
- Ziel: die App wird **einfacher und verlässlicher**, nicht größer. Kein neues Hauptmenü, keine neue Seite außer den unten genannten, keine neue Stufe.
- Schutzregeln aus `AUFTRAG_ENDVERSION_FOLGEPAKETE` Abschnitt 0 gelten (nichts entfernen ohne Änderungsliste, Klickwege-Gate, je Paket vollständig, kein Mock).
- **Gebundene Stände bleiben:** AP-EIN (Runde 53) und AP-ABS (V43) werden nicht geändert. Ergänzungen gehen nur in Pakete, die noch **vorgemerkt** sind, und kommen mit deren normaler Lieferung – keine Extra-Runde.
- Ausnahme: Abschnitt 3 (zwei Owner-Ziele zum Fundament) als eine kleine Lieferung.

## 1. Urteil Planungschat zum Register
- Trägt: die Leitlinie (Anliegen → Information → zulässige Aktion; keine Schein-Automation; gespeichert ≠ gelesen ≠ importiert) und rund 25 Stufe-1-Präzisierungen (Abschnitt 2).
- Bereits abgedeckt (nichts tun): Eingang/OCR IN01–IN08, IN13–IN16, IN34/IN36 (Teile 2–4), Reklamation N03 (Teil 4), Ausgabe/Versand AU28–AU30 (Teil 6), Absprachen AU07/AU08/FI08/TA07 (AP-ABS), KV-Übergang AU01/AU02/AU09/AU10 (AP-KV), Rechnungs-QR N02/FI10 (R03), Was-ist-neu VE14.
- Später (nur in `paket_folge.ideenspeicher` als ID-Liste, kein Bauabschnitt): alles Stufe 2–4 – Zahlung X01/N01/FI09, Kosten/Investition FI21–FI29/N08, Lager/Bäder WE01–WE11, Analyse/Marketing AN01–AN30, Unternehmer-KI KI01–KI30, Kanäle IN17–IN21, Monatsansicht UX32/X07, Auftragskopie/Stammkundenvorlage AU33/AU34, Absagegrund TA05.
- Nicht übernehmen: historische Layouts/Animationen UX30, Wetterfläche UX04, Streaks/Score UX29/AN04, zusätzliche Kopf-Icons UX24, alles mit **X** im Register.

## 2. In vorgemerkte Pakete übernehmen (Stufe 1, je mit Testfall)
| Paket | IDs | Vorgabe |
|---|---|---|
| Picker | UX13, UX14, N06, IN25 | Suche über Name, Ort, Telefon, Nummer, Oberfläche, Teil, Notiz – für alle berechtigten Objekttypen (Kunde **und** Lieferant). Jeder Treffer zeigt den Grund („passt: Ort Hamburg“). Kein Treffer → ehrliche Leermeldung + die drei Wege aus Prüfbericht Nr. 9. |
| Der Tag R36 | UX06, UX11, N07, AU28, KI21, UX31 | (a) Eigene Aufgabe ohne Kunde/Vorgang („Für mich · Etiketten nachbestellen“), sichtbar im eigenen Login, für Recht `entscheiden` in der Aufgabenliste auffindbar. (b) Erledigen wirkt auf den Quellvorgang, Öffnen erledigt nichts. (c) Zeile „Fertig, nicht ausgegeben · {auftrag} · {grund}“. (d) Verschieben/Erledigen lässt die Zeile verschwinden, keine Wiederholung bis zum neuen Anlass. (e) Erst die kurze Auswahl, Umschalter „Alle {n} anzeigen“ – nichts Dringendes nur in der langen Liste. |
| 8.11 Termine | AU12, AU13, TA04, UX09, WE12 | Wunschtermin, machbarer Termin, zugesagter Termin sichtbar getrennt. Späte Ware/Freigabe/Mengenänderung bewertet neu. Abwesenheit je Login (Tage, in Einstellungen) zieht Kapazität ab; sonst keine Personalplanung. |
| AP-PROT | Register Abschnitt 6 Punkte 1–6, UX10, KI25, AN08 | Auswertung nach Vorgangserfolg, Reibungsart (technisch / Bedienung / fehlende Regel / extern) und Betriebswirkung; jede Änderung einer App-Version zugeordnet, Vorher/Nachher am selben Fall. Keine Mitarbeiterbewertung. |
| AP-OCR | IN06, AU19 | QR/Barcode auf Lieferschein, Etikett oder Laufzettel lesen → Vorgang direkt (vor Texterkennung). |
| AP-DK | N05, IN09, IN10, IN11, VE06 | Je Datei getrennt sichtbar: gespeichert / gelesen / übernommen / verteilt. Excel/CSV/Outlook-Kontakte mit Spalten-Vorschlag zum Bestätigen. Dubletten-Vorschlag „zusammenführen“. **Altbestand** erzeugt nie neue Aufträge, Rechnungen, Erinnerungen oder Umsatz (markiert „Altbestand · {datum}“). |
Überall: N09/UX21 – jede Meldung hat Grund + ausführbaren nächsten Schritt (U-242).

## 3. Fundament (zwei Owner-Ziele, eine kleine Lieferung, Samstag)
1. **N12 – Abmeldung nach 60 Minuten ohne Eingabe** (Owner 05.11.): nur Eingaben/Klicks zählen, kein Hintergrund-Nachladen; je Gerät (ein aktiver PC hält das Tablet nicht offen). Danach Anmeldeseite mit Hinweis; offene Erfassung bleibt als Entwurf, nach Anmeldung desselben Logins „Weiter mit {entwurf}“. Anderer Login sieht keine fremden Entwürfe. Bitte: Texte, Sichtvertrag + Prüfbild (Anmeldung mit Hinweis), Testfälle.
2. **N11/N10 – Entwurf auf zwei Geräten:** ein älterer Stand überschreibt nie einen neueren. Bitte: Hinweis/Dialog „Neuere Fassung von {login} · {gerät} · {zeit}“ mit „Neuere übernehmen“ / „Meine behalten“ (Text nach U-242), Prüfbild, Testfälle. Nachladen alle 30 s behält Fokus, Auswahl, Scrollstand und ungespeicherte Eingaben. (Den serverseitigen Versionsschutz baut Codex schon jetzt; die Lieferung liefert nur Oberfläche + Fälle.)

## 4. Hinweis für spätere Owner-Entscheidung (nicht Samstag)
Zahlung am Tablet (X01): Mollie-Tap-App läuft nur auf unterstützten Android-Geräten, **nicht auf iPads**; vorher Gerät festlegen. Bis dahin: Rechnungs-QR (Überweisung) bleibt der Weg.

## 5. Lieferung Samstag
(a) Abschnitt 3 als eine SHA (Fundament), (b) Abschnitt 2 als Zusatz in den betroffenen `paket_folge`-Einträgen (Status bleibt „vorgemerkt“), (c) `paket_folge.ideenspeicher` mit den IDs aus Abschnitt 1, (d) Meldung im Antwortformat 0.4 mit Änderungsliste. Danach weiter mit der laufenden Paketfolge.

## 6. Aufnahme-Ergebnis neu (U-243, Owner 05.11. 17:50) – Samstag zuerst, dann Teil 2b
Owner-Klicktest Handy (Screenshots `_review/quellen/owner_rein_handy_1.jpg`, `_2.jpg`): Darstellung und Weiterverarbeitung unzureichend. Befunde: Fußleiste „Schließen / Später zuordnen / **Wem gehört das?** (Hauptknopf) / Original ansehen“ steht schon **vor** der Aufnahme; nach dem Foto erscheint nur der rohe OCR-Text als „Notiz“, Dateiname doppelt und abgeschnitten, „Fertig · lesen“ obwohl schon gelesen, Fehler mit technischem Code; keine Art, keine Felder, kein Kundentreffer (Sabrina Schmidt ist Bestandskundin), kein Vorschlag. Am Handy „Datei hierher ziehen“.
**Soll (bitte als eine Lieferung für Seite `rein`, alle Modi × Desktop/Tablet/Handy, mit Änderungsliste):**
1. **Vor der Aufnahme:** Handy/Tablet: „Foto aufnehmen“ groß als Hauptweg, „Datei wählen“ daneben, Notizfeld klein („oder Notiz schreiben“); kein Ziehen-Text auf Touch-Geräten. Fußleiste nur „Schließen“. „PC möchte Fotos · Öffnen“ bleibt.
2. **Nach der Aufnahme – Ergebniskarte statt Rohtext:** (a) Vorschaubild des Fotos (Tippen = Original, aus der eben gesicherten Datei, hängt nicht an Teil 3). (b) Art in Worten: „Versandetikett erkannt“ / „Lieferschein“ / „Rechnung“ / „Visitenkarte“ / „Notiz“. (c) Erkannte Felder kompakt, je antippbar zum Korrigieren; nur Unsicheres markiert. Versandetikett: Empfänger, Absender, Sendungsnummer, Dienst. (d) Treffer mit Grund: „Kundin Sabrina Schmidt · Adresse passt“ bzw. „passender Auftrag A-… · Ware erwartet“. (e) Rohtext nur eingeklappt („Gelesener Text“).
3. **Richtung beim Etikett:** Abgleich mit der eigenen Firmenadresse aus den Einstellungen – Empfänger = eigene Firma → Wareneingang vom Absender; Absender = eigene Firma → Versand (Sendungsnummer zum Auftrag); sonst Kunde/Lieferant aus Treffer.
4. **Genau ein Hauptknopf je Lage**, konkret (U-242): z. B. „Ware für Sabrina Schmidt annehmen“, „Ware zu A-2026-0012 buchen“, „Rechnung von {lieferant} erfassen“, „Kunde {name} anlegen“. Daneben: „Anderer Kunde/Vorgang“ (Picker) und „Etwas anderes ▾“ (Was ist das?-Kacheln U-241). „Später zuordnen“ klein. „Wem gehört das?“ entfällt als eigener Knopf (steckt in „Anderer Kunde/Vorgang“).
5. **Mehrere Seiten:** Einzelseite wird sofort gelesen; „Weitere Seite“ hängt an und liest neu. „Fertig · lesen“ entfällt.
6. **Fehler** in Worten mit Weg („Erkennung gerade nicht erreichbar · Foto ist gesichert · Erneut lesen / Selbst eintragen“), Code nur im Protokoll.
7. **Weiterverarbeitung:** Hauptknopf übernimmt alle erkannten Felder und das Foto (als Warenfoto bzw. Beleg an Position/Vorgang) in den Zielweg – nichts nochmal eingeben, nichts nochmal hochladen.
Stufe 1 (IN02/IN04 „Paketetikett lesen“ ist Stufe 1). Verknüpfung mit Mail-Bestellungen bleibt AP-OCR.
8. **„Aus Mail“ (Planungschat-Entscheidung P100):** Quelle ist der vorhandene Outlook-Weg (`communication_threads`), keine zweite Inbox. Bitte im Abschnitt `rein` den Modus „Aus Mail“ vollständig spezifizieren: Nachricht wählen → ein Eingang mit Mail-Bezug, Anhänge und Inline-Bilder als Originale (Inline-Bild = Foto-Kandidat), danach dieselbe Ergebniskarte wie beim Foto.

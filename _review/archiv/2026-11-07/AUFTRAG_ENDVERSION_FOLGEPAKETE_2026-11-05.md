# Auftrag an den Endversion-Chat: Folgepakete vorbereiten (Planungschat, 05.11.2026)

Grundlage: Owner-Prüfbericht „gezielte Verbesserungen“ (05.11.) – vom Planungschat geprüft, eingeordnet und um zwei Owner-Anforderungen (OCR-Verknüpfung, Datenkiste) ergänzt. **Diese Datei ersetzt den Prüfbericht als Arbeitsgrundlage.**

## 0. Schutzregeln (gelten vor allem anderen)
1. **Nichts entfernen, nichts umbauen, was nicht in dieser Datei steht.** Jede Änderung an einem bestehenden Screen, Klickweg, Feld oder Text steht in einer **Änderungsliste** (Element, alt → neu, Grund, Owner-Entscheidung U-…). Ein Element fällt nur weg, wenn die Owner es abgelehnt hat oder es kollidiert – dann mit Eintrag im Ledger. Dein Klickwege-Gate gegen alle Archivstände läuft vor jeder Lieferung.
2. **Spec-Freeze AP-EIN:** Runde 52 ist gebunden. Erlaubt ist nur noch **Runde 53** = U-241 („Was ist das?“ bei Art unklar) + U-242 (keine Floskeln, app-weit) – als **eine** Lieferung. Alles in Abschnitt 2–4 kommt **danach** als neue Paketabschnitte in `paket_folge.*` und ändert keine AP-EIN-Seite.
3. **Je Paket eine vollständige Lieferung:** Paketabschnitt im Bauplan, Testfälle, Sichtvertrag-Einträge + Prüfbilder (Normalfall **leer** und Beispiel), Änderungsliste, eine Bauplan-SHA. Keine Teillieferungen in Etappen.
4. **Antwortformat je Paket (in MELDUNG_ENDVERSION_CHAT):** (a) bestätigt / bereits gelöst / später vorgesehen, (b) Lösung im bestehenden Kontext + was unverändert bleibt, (c) Belegwege inkl. Fehler, Unterbrechung, Rückkehr, (d) nötige Owner-Entscheidungen – je eine Zeile, eine Frage auf einmal.
5. **Kein Mock, keine Beispieldaten im Bauplan-Pfad für Codex**; keine neuen Anbieter, Tabellen oder Stufen erfinden – Datenbedarf als Anforderung, Schema plant der Planungschat.

## 1. Reihenfolge
Runde 53 (AP-EIN, sofort) → AP-ABS → AP-KV (Auftragskarte inkl. KV) → Picker → Der Tag R36 → 8.11 Termine → AP-PROT Protokoll → AP-OCR Verknüpfung → AP-DK Datenkiste. Später, erst nach Owner-Entscheidung zur Stufe: AP-MSG WhatsApp/Instagram, AP-KOST Kostenbasis.

## 2. Prüfbericht – Einordnung durch den Planungschat
| Nr. | Thema | Urteil | Paket | Kern der Vorgabe |
|---|---|---|---|---|
| 1 | Ausgabe ohne Zahlung aus Freitext-Absprache | gültig | AP-ABS | Absprache als **Typ** (z. B. `ausgabe_ohne_zahlung`, `sammelrechnung`, `zahlungsziel`), Geltung Kunde/Auftrag, `gueltig_bis`, Widerruf, Recht `entscheiden`; Freitext-Notiz hebt nie eine Sperre auf |
| 2 | „Rechnung folgt“ vs. Sammelrechnung | gültig | AP-ABS | eine Regel: Sammelrechnung → Knopf „Übergeben · Sammelrechnung {monat}“ ohne Einzelrechnung; sonst „Übergeben · Rechnung folgt“ erzeugt die Rechnung |
| 3–5 | KV-Übergang ohne Hauptaktion, Umwandlung verliert Katalog/Einheit/Preis/Steuer/Bilder/Fassung, KV-Übersicht fehlt | gültig (Code belegt) | AP-KV | „KV annehmen → Auftrag“ als Hauptaktion der KV-Karte; Umwandlung übernimmt alle Positionsdaten + Quelle/Bilder + angenommene Fassung, Versions-/Doppelbuchungsschutz bleibt; KV-Liste mit Status offen/versandt/abgelehnt/abgelaufen/umgewandelt + Link zum Auftrag |
| 6 | ohne Geld-Recht wird aus KV ein Auftrag | gültig | AP-KV | Art bleibt KV; ohne `geld` keine Preise, KV geht an „Preis eintragen · {kv}“ für Logins mit `geld` |
| 7 | Erkennung: Verneinung, ausgeschriebene Mengen, falsches Datum, 20er-Grenze, Mailbilder | gültig | Runde 53 (RT04 erweitern) | „nicht X, nur Y“ → Y; Zahlwörter; Datum = Wunschdatum im Satz; > 20 Positionen sichtbarer Hinweis + zweiter Beleg; eingebettete Bilder als Foto-Kandidat, nicht pauschal verwerfen |
| 8–9 | Picker-Regeln uneinheitlich, leere Suche ohne Weg | gültig | Picker | eine Auswahlregel für alle drei (aktiv + abgeschlossen wählbar, abgeschlossen gekennzeichnet); leere Suche bietet „Neuen Vorgang anlegen“, „Kunde anlegen“, „Als Notiz am Kunden“ |
| 10–12 | Der Tag: Zähler statt Aufgabe, Alter ≠ Dringlichkeit, „Termin klären“ | gültig, überschneidet U-242 | Der Tag R36 | je Zeile Gegenstand + Handlung (U-242); Dringlichkeit aus Art (Storno, Änderung, Abholänderung sofort) vor Alter |
| 13 | Terminvorschlag ignoriert tatsächlichen Start | gültig (Code) | 8.11 | Start = späteres von Wareneingang/Freigabe; Kapazität nach Aufwand (Stunden), nicht nur Euro; unbepreiste Arbeit zählt |
| 14 | Antwortentwurf verschwindet beim Nachsehen | gültig (Vorschau) | AP-EIN Teil 4 – Codex prüft im echten Bau | Entwurf überlebt Ebenenwechsel (X12) |
| 15 | letzte Nachricht ≠ offenes Anliegen | gültig | Teil 4 / Picker | Vorschau zeigt das offene Anliegen, nicht die letzte Zeile |
| 16 | WhatsApp/Instagram | neue Anforderung | AP-MSG (später) | Anforderungen aus Owner-Bericht Abschnitt 5 übernehmen; Stufe entscheidet die Owner; ohne Testkonten kein „funktioniert“ |
| 17, 18 | Verbesserungs-Logging, Kennzahlen-Ereignisse | neue Anforderung | AP-PROT | siehe 3.1 |
| K3 | Mehrarbeit wird beim Abschluss mit dem **neuesten** Satz bewertet | **Fehler im Code** | Stufe 1, als Korrektur in AP-KV | Satz wird bei Erfassung je Mehrarbeit festgeschrieben; Änderungen gelten nur für neue Einträge |
| K1, K2, K4 | Kostenbasis, „gleiches Teil“, Verlustanalyse | gültig, nicht Stufe 1 | AP-KOST (später) | Stundensatz-Herleitung in Einstellungen (Owner-Bericht Abschnitt 4); Stufe entscheidet die Owner; jetzt nur nötige Ereignisse mitschreiben |

## 3. Neue Owner-Anforderungen (zusätzlich zum Prüfbericht)
Für alle drei gilt U-241 (jeder Eingang hat einen Weg, nie Sackgasse) und U-242 (Knopf = Gegenstand + Handlung + Grund, keine Floskeln).

### 3.1 AP-PROT – In-App-Protokoll (Testphase und Betrieb)
- Mitschreiben: Klickweg je Vorgang (Seite, Knopf, Dauer), Abbruch/Rückkehr, Hänger (Ladezeit > Schwelle, Doppelklick, wiederholte Suche ohne Treffer), Fehler (Text, Seite, Version), manuelle Korrektur eines App-Vorschlags (Vorschlag alt → übernommen neu) – Letzteres ist die Lernquelle für Erkennung.
- Datenschutz wie MELDUNG_PLANUNGSCHAT 04.11. 11:30: append-only je Mandant, nur Kennungen/Codes, keine Inhaltsdaten, Login pseudonym, 90 Tage, abschaltbar, Hinweis beim Login.
- Auswertung nur developer/Owner: Liste „Wo hängen Leute“ (Seite, Häufigkeit, Beispielvorgang öffnen), „Welche Vorschläge werden oft korrigiert“, Export als Datei für den Planungschat. Testphase: zusätzlich Knopf „Hier hakt es · Notiz an Entwicklung“ auf jeder Seite.

### 3.2 AP-OCR – Beleg mit Bestellung verknüpfen
- Erkennt in Lieferschein, Versandetikett, Paketschein, Auftragsbestätigung, Lieferantenrechnung: Bestellnummer, Auftrags-/Kundennummer, Sendungsnummer, Lieferant/Kunde, Positionen, Mengen, Datum.
- Gleicht ab gegen: per Mail **eingehende** Kundenbestellungen/Aufträge und per Mail **ausgehende** Lieferantenbestellungen sowie bestehende Vorgänge. Treffer über Nummer zuerst, dann Lieferant/Kunde + Positionen + Zeitraum.
- Ergebnis immer eine Karte: „Gehört zu {vorgang} · {grund der zuordnung}“ mit Abweichungen (Menge fehlt, Teillieferung, Position zu viel) und **einem** Hauptknopf je Lage, z. B. „Wareneingang buchen · {n} Positionen“, „Teillieferung buchen · {rest} offen“, „Rechnung zur Bestellung ablegen“. Folgeaktionen (Lager, Buchhaltung, Auswertung) laufen mit dem einen Klick, **soweit die Stufe aktiv ist**; nicht aktive Stufe: sichtbarer Hinweis, was beim Freischalten passieren würde – kein versteckter Knopf.
- Kein Treffer: Vorschlag „Zu {bester kandidat} · {grund}“ übernehmen, anderen Vorgang wählen (Picker-Regel), oder „Neu anlegen als …“. Nie „unklar“ ohne Weg.
- Rückgängig je Verknüpfung, Beleg am Vorgang mit Original.

### 3.3 AP-DK – Datenkiste (Massen-Drop)
- Ein Feld/Ordner, beliebig viele Dateien (PDF, Bild, Mail-Datei, XML/ZUGFeRD, Tabelle, ZIP wird entpackt). Original wird **zuerst** gesichert, dann gelesen; Doppelte über Prüfsumme erkannt und nur verlinkt.
- Je Datei: Art erkennen, Bezug suchen (wie 3.2), Ziel vorschlagen (Vorgang, Kunde, Lieferant, Lager, Buchhaltung, Archiv).
- **Sicher erkannt** (Regel + Bezug eindeutig) → wird automatisch verteilt, mit Beleg „verteilt nach {ziel} · {grund}“ und Rückgängig. Schwelle und welche Arten automatisch dürfen: Owner-Einstellung, Start konservativ.
- **Unklar** → Prüfliste mit Vorschau des Originals, App-Vorschlag zum Übernehmen, Alternativen, und **Freifeld „Anweisung“** (z. B. „gehört zu Müller, Auftrag März, als Reklamation“): App macht daraus einen konkreten Vorschlag, den der Nutzer bestätigt – nie direkte Ausführung von Freitext.
- Sammelaktionen: „Alle {n} gleichen Vorschläge übernehmen“. Fortschritt sichtbar (gelesen / verteilt / wartet), Lauf unterbrechbar und fortsetzbar, nichts geht verloren; Ende mit Bericht.

## 4. Später – erst nach Owner-Stufenentscheidung
AP-MSG (WhatsApp/Instagram) und AP-KOST (Kostenbasis, gleiches Teil, Verlustanalyse): Anforderungen jetzt nur aufnehmen, kein Bau-Abschnitt, bis die Owner die Stufe festlegt.

## 5. Erste Lieferung
**Jetzt nur Runde 53** (U-241 + U-242 + Nr. 7) als eine SHA, dann Meldung an Planungschat. Danach AP-ABS. Jede Paketlieferung geht nach Prüfung durch den Planungschat **direkt als Auftrag an Codex** (P-Eintrag) – darum vollständig nach Regel 0.3.

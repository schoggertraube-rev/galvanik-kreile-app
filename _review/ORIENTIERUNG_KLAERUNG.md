# Orientierung für Klärungs-Chats – Kreile WerkstattCockpit

Stand 28.10.2026. Diese Datei liegt im Repo unter `_review/ORIENTIERUNG_KLAERUNG.md`. Wer einen Klärungs-Chat startet, liest **zuerst diese Datei** und muss nichts weiter erklärt bekommen.

---

## 1. Worum es geht

**Kreile WerkstattCockpit** ist eine Web-App für die Galvanik Kreile, einen Meisterbetrieb für Oberflächenveredelung: Verchromen, Vernickeln, Verzinken. Die Nutzer:
- **Rolf**, Inhaber, Rolle Meister: entscheidet alles.
- **Phillip**, Werkstatt.
- **Gregor**, Entwickler, Rolle developer: Wartung und Einstellungen. Gregor ist der Owner.

Rechte sind je Login einstellbar. Vergeben werden sie über Rollen, nie nach Namen.

**Leitlinie Stufe 1 (U-212): Infos rein → Auftrag durch → Rechnung raus.**
Die App lebt von vollständigen Daten. Deshalb muss die Eingabe schneller sein als ein Zettel. Mail und Texterkennung (OCR) sind der **Kaufgrund**.

**Termin:** Feature-Stopp 29.11.2026, funktional fertig Anfang Dezember 2026. Feine Optik-Änderungen erst Mitte Dezember.

---

## 2. Wer macht was (feste Rollen, nicht vermischen)

| Chat | Aufgabe | Schreibt |
|---|---|---|
| **Owner** (Gregor) | entscheidet, testet per Klick, gibt frei | – |
| **Planungs-/Prüferchat** (Claude) | Warteschlange, Kontrolle des Baus gegen Bauplan und DB, Merge | `_review/AKTUELLE_ANWEISUNG.md`, `_review/MELDUNG_PLANUNGSCHAT.md` |
| **Endversion-Chat** (Claude) | Gestaltung und Spezifikation: Mock, `spec.json`, daraus `BAUPLAN.json`. **Einzige Quelle für Aussehen und Bedienung** | `docs/project/endversion/**`, `_review/MELDUNG_ENDVERSION_CHAT.md` |
| **Bau-Codex** (genau einer) | baut nach `BAUPLAN.json`, einziger Schreiber im App-Code | App-Code, `docs/delivery/ABGABE_*.md` |
| **Organisations-Klärungschat** (Codex) | legt Themen-Chats an, hält die Reihenfolge, sammelt Ergebnisse | `_review/KLAERUNG_STAND.md` |
| **Themen-Klärungschats** (Codex, je Thema einer) | klären **ein** Thema vollständig mit dem Owner | nur `_review/KLAERUNG_<Thema>.md` |

**Harte Regeln für alle Klärungs-Chats:**
- Kein App-Code, keine Commits, kein Push, keine Migration, keine DB-Änderung. Nur lesen und die eigene Klärungsdatei schreiben.
- UI und Vernetzung **vorschlagen** ist erlaubt und erwünscht: Struktur, Abläufe, Skizzen (ASCII oder einfache HTML-Skizze in `_review/`), Zustände, Klickzahl. **Verbindlich** wird die Optik erst, wenn der Endversion-Chat sie in die Endversion übernimmt. Farben und Größen entsprechen immer Abschnitt 5.
- **Ergänzen und ändern ja, nichts umwerfen.** Was in `BAUPLAN.json` oder in den Owner-Entscheidungen steht, gilt. Wer etwas ändern will, schreibt es als **Änderungsvorschlag mit Begründung** in die Klärungsdatei. Der Owner entscheidet.
- Fragen an den Owner einzeln, jeweils mit Empfehlung. Vorher in den Dateien unten nachsehen, ob die Frage schon entschieden ist.
- Der Owner ist nicht Mittelsmann. Übergaben laufen über Dateien.

---

## 3. Wo was liegt

Repo: `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app`, Arbeitsbranch `kreile/s1-p2-eingang` (PR #154).

| Datei / Ordner | Inhalt |
|---|---|
| `_review/OWNER_ENTSCHEIDUNGEN.md` | alle Owner-Entscheidungen. **Gelten vor allem anderen** |
| `docs/project/endversion/ENTSCHEIDUNGEN_UI.md` | UI-Entscheidungen U-xxx und Annahmen A-xx |
| `docs/project/endversion/codex/BAUPLAN.json` | verbindlicher Bauplan: Screens, Felder, Regeln, Rechte, Zustände, Abläufe, Baureife, Korrekturen |
| `docs/project/endversion/ABGLEICH_SPEC_CODE.md` | was im Code schon existiert und was neu ist (Optik / Inhalt neu / Funktion neu), Konflikte K1–K27 |
| `_review/AKTUELLE_ANWEISUNG.md` | Warteschlange des Bau-Codex |
| `_review/MELDUNG_ENDVERSION_CHAT.md`, `_review/MELDUNG_PLANUNGSCHAT.md` | Meldungen zwischen den Chats, neueste oben |
| `docs/delivery/ABGABE_*.md`, `docs/delivery/KORREKTUREN_STAND.md` | was gebaut und korrigiert wurde |
| `docs/project/linie/ui/designsystem_v1_1/` | freigegebenes Designsystem V1.1 (Farben, Bausteine) |
| `src/` | App-Code (Next.js, Supabase). Server-Actions unter `src/app/actions/`, Befehle unter `src/lib/server/commands/`, Module unter `src/modules/*/public.ts` |

Mock und Musterdaten (`endversion/index.html`, `spec.json`) sind nur für die Ansicht durch den Owner da und werden nicht an Codex gegeben (U-202). Klärungs-Chats arbeiten mit `BAUPLAN.json` und den Entscheidungsdateien.

---

## 4. Stand am 28.10.2026

**Funktioniert und ist in der DB belegt:**
- Kunde mit Pflichtdaten → Auftrag (auch mit Freitext-Position) → Galvanik → Fertig → Rechnung (PDF) → Zahlung → Ware raus.
- KV → Auftrag.
- Ersteinrichtung: Firmendaten, Katalog, Stundensatz.
- Nutzer haben eine einzige Wahrheit: aktive Nutzer = Startkacheln.
- Login nach Endversion.
- Rechte je Login (F0).

**Mail und OCR:**
- Microsoft Graph sendet Mails (vom Owner bestätigt).
- Eingehende Mail einem Kunden oder Auftrag zuordnen ist erst angebaut (Q6b).
- Azure Document Intelligence liefert Vorschläge.
- Abläufe, Sonderfälle und Bedienung sind **noch nicht geklärt**.

**Baureif im Bauplan:** Login, F0 Rechte, F2 Der Tag. F1 Neuer Eingang und F3–F7 sind in der Gegenprüfung. Codex arbeitet 57 Korrekturen ab.

**Testlizenz Microsoft:** läuft etwa Ende November ab, danach wird der Account rotiert. Mail-Tests bis dahin abschließen.

---

## 5. Wie es optisch aussehen soll (nicht neu erfinden)

- **Farben:** Designsystem V1.1, neutral und weiß.
- **Größen und Bedienbarkeit:** wie Rolf V8 / Phillip V4. Touch-Ziele mindestens 48 px, keine Mini-Elemente.
- **Verbindliche Darstellung:** die Endversion (Mock des Endversion-Chats). Klärungs-Chats beschreiben **was** passiert. **Wie** es aussieht, entscheidet der Endversion-Chat.
- Grundsätze für die Eingabe:
  - erst suchen, dann anlegen
  - nichts doppelt tippen
  - Vorbelegung
  - nur fehlende Felder zeigen
  - keine Eingabe geht verloren
  - ein Hauptknopf
  - keine Sackgassen
  - Fehler immer mit Meldung, nie stumm
- Was nicht in Stufe 1 ist, erscheint grau mit „geplant“.

---

## 6. Gesamtziel „Staubsauger“ und Reihenfolge (Owner 28.10., maßgeblich)

**Hintergrund (Kunde Kreile):** Heute erledigt **ein ganzer Büro-Mitarbeiter** alle Eingänge, Ausgänge und die Korrespondenz. Er geht in Rente, die **App ersetzt ihn**. Sie muss deshalb **jeden Eingang einsaugen wie ein Staubsauger**:
- Mails
- Rechnungen in jedem Format, auch E-Rechnung
- Papier, Fotos, Scans
- Pakete und Wareneingang
- Kunde erscheint persönlich
- Anrufe

Ebenso deckt sie Ausgänge und Korrespondenz ab, später die Buchhaltung. Nichts darf liegen bleiben. **Die Startseite („Der Tag“) ist die Kontrolle für den Chef: Ihm geht nichts durch die Lappen.**

Der Chef hat keine Zeit, ein Paket 20 Minuten lang zu bearbeiten. Bleibt etwas liegen, landen Aufträge nicht in der App, und es entsteht Chaos. **Ziel je Eingang: in wenigen Minuten, geführt, ohne offene Punkte.**

**Ein eigenes Modul „Eingang“ ist ausdrücklich erlaubt**, auch neu gestaltet, wenn es nötig ist. Hauptsache, es läuft reibungslos. Klärungs-Chats dürfen dafür **UI und Vernetzung vorschlagen**: Struktur, Abläufe, Skizzen, Zustände. Die verbindliche Optik setzt danach der Endversion-Chat in der Endversion um. Vorhandenes wird nur geändert, wenn der Vorschlag begründet ist.

**Reihenfolge (ersetzt die Nummerierung der Tabelle darunter; deren Kern-Fragen gelten weiter):**

| Schritt | Chat | Inhalt | Warum hier |
|---|---|---|---|
| 0 | Organisations-Chat | Quellen-Freeze (erledigt), Ordnung, Status | Grundlage |
| **A** | **Modul „Eingang“ – Gesamtkonzept** | Ein Eingangskorb für **alle** Kanäle. Gemeinsame Ampel und Zustände, Zuordnung (Kunde, KV, Auftrag, Lieferant), Worst Case, Verlauf, Rechte, Anbindung an „Der Tag“. Skizze der Oberfläche | **Zuerst**, damit jeder Kanal dieselbe Oberfläche nutzt, statt dass jeder Kanal seine eigene erfindet |
| **B1** | Physischer Eingang | **Paket/Wareneingang** (Thema 1b) **und Kunde kommt persönlich** | täglicher Kernfall, größter Zeitfresser |
| **B2** | Mail-Eingang | inkl. Anhänge und XML-E-Rechnung (Thema 1) | Hauptkanal, die Testlizenz läuft ab. Darf **parallel zu B1** laufen, wenn A fertig ist |
| B3 | Papier, Foto, Scan, OCR | Thema 2, liefert B1 und B2 zu | Erkennung für alle Kanäle |
| B4 | Eingangsrechnungen (Lieferanten) | jedes Format inkl. E-Rechnung. Stufe 1: erfassen, ablegen, prüfen. Buchung später | gesetzliche Empfangspflicht, Vorstufe Buchhaltung |
| B5 | Telefon | Anruf → Notiz → Zuordnung | klein, schließt die Lücke |
| C | Ausgang und Korrespondenz | KV → Auftrag (Thema 3), Eingangsbestätigung, Rückfragen, Rechnung, Mahnwesen (Thema 4) | nutzt die Daten aus A und B |
| D | Datenkiste/Import | Thema 5 | braucht das fertige Datenmodell |
| E | Go-live-Betrieb | Thema 6, **parallel jederzeit** | berührt den Bau nicht |

**Parallelität:** Nach A dürfen **höchstens zwei Themen-Chats gleichzeitig** laufen (z. B. B1 und B2). Der Organisations-Chat achtet darauf, dass sie dieselben Begriffe und Zustände aus A verwenden.

**Termin-Ehrlichkeit:** Der Umfang ist groß. Der Organisations-Chat markiert in jeder Klärungsdatei, was **Stufe 1 bis 29.11.** sein muss (Kern: Eingangskorb, Paket, persönlich, Mail, OCR) und was später kommt. Eine Liste mit „geplant“ ist kein Verlust.

### Ursprüngliche Themenliste (Kern-Fragen gelten weiter)

Die Reihenfolge oben ist maßgeblich.

| # | Thema | Warum an dieser Stelle | Kern-Fragen |
|---|---|---|---|
| 1 | **Mail-Eingang** | Haupt-Eingangskanal, die Testlizenz läuft ab | Welches Postfach? Wie oft abrufen? Wie wird zugeordnet (Absender → Kunde, Betreff/Nr. → Auftrag)? Was passiert mit unbekannten Absendern, mit Anhängen, mit Antworten auf eigene Mails? Was wird aus einer Mail: Kunde, KV, Auftrag, Notiz? |
| 1b | **Wareneingang: Paket kommt an** (Owner 28.10.: *kriegsentscheidend, USP*) | der tägliche Kernfall, nutzt Mail, KV und Belegfoto | Ziel: **In 5 Minuten** vom Paket auf dem Tisch bis zur Ware in der Galvanik, **ohne offene Punkte**. Selbsterklärend, die App führt Schritt für Schritt. Prüfen: Wie beginnt man (Knopf „Ware ist da“ auf dem Tablet)? Erkennt die App Kunde, Begleitzettel oder Lieferschein per Foto? Findet sie einen offenen KV oder eine angekündigte Sendung und übernimmt Positionen ohne Tippen? Welche Fotos sind Pflicht (Ware, Zustand, Begleitzettel)? Was ist beim Unbekannten Kunden? Geht eine Eingangsbestätigung automatisch per Mail an den Kunden? Etikett mit Auftragsnummer an die Kiste? Geht es direkt weiter „in die Galvanik“? Eine Checkliste zeigt, was fehlt. Klicks zählen: Ziel ≤ 10 Klicks, Tippen nur, wenn nichts erkannt wurde. **Befund Planungschat:** Im Bauplan fehlen bisher Eingangsbestätigung, angekündigte Sendung, Übernahme aus offenem KV beim Wareneingang und eine geführte Checkliste. |
| 2 | **OCR / Belegerkennung** | Kaufgrund, hängt an Mail-Anhängen und Fotos | Welche Belege (Lieferschein, Bestellung, Visitenkarte, Zettel)? Welche Felder werden erkannt? Wie prüft man Vorschläge und bestätigt sie? Was passiert bei schlechter Qualität? Kosten und Grenzen von Azure |
| 3 | **KV → Auftrag** | verbindet Eingang und Rechnung | Wann KV, wann direkt Auftrag? Annahme durch den Kunden (Mail, Telefon)? Preisänderungen? Gültigkeit? Was wird übernommen? |
| 4 | **Rechnung raus** | Standardrechnung, Skonto, Storno, Versand | Pflichtangaben, Nummernkreis, Skonto U-111, Storno-Ablauf, Mahnung (Stufe 1 oder 2?), Versand per Mail |
| 0 | **Quellen-Freeze** (Organisations-Chat, zuerst) | Ohne eine gültige Quelle klärt jeder gegen einen anderen Stand | Gültiger Branch und Commit. Bauplan-Hash eingecheckt oder lokal. Welche Mail-/OCR-Regeln im Bauplan sind nur **Annahmen** (A-xx) und brauchen Owner-Bestätigung? `_review/` steht nicht unter Git: Wie werden die Steuerdateien gesichert? |
| 5 | **Datenkiste / Import** | Altdaten für den Go-live, braucht das fertige Datenmodell aus 1–4 | Woher kommen die Altdaten (Excel, altes System)? Welche Felder? Dubletten? Einmaliger Import oder wiederholbar? |
| 6 | **Go-live-Betrieb** | Ohne diesen Punkt kein Verkauf, auch wenn alles funktioniert | Eigene Produktions-DB? Heute teilen sich Produktion und Test **eine** DB. Supabase-Tarif: Der freie Tarif pausiert bei Inaktivität und hat kein Point-in-Time-Backup. Vercel-Tarif: Hobby ist nicht für gewerbliche Nutzung. Domain. Env-Werte in Production. M365-Rotation nach der Testlizenz und Lizenzkosten. Azure-Tarif (der freie Tarif verarbeitet nur 2 Seiten und 4 MB). Backup und Wiederherstellung. Echte Nutzer, PINs und Einweisung. Geräte (Tablet, Kamera, Drucker). Aufbewahrung 8 Jahre (GoBD) |

**Owner-Anforderungen 28.10. (verbindlich für Thema 1–4; vom Worst Case aus denken, nicht vom Best Case):**
1. **Nichts geht verloren, nichts wird still übergangen.** Jede eingehende Information landet sichtbar an **einem** Ort, dem **Eingangskorb**. Dazu gehören Mail, Foto eines Zettels, Scan, PDF, E-Rechnung-XML und Beleg. Sie bleibt dort, bis ein Mensch oder eine sichere Regel sie abschließt.
2. **Jeder Eingang hat einen sichtbaren Status:**
   - *automatisch zugeordnet* (z. B. Antwort auf einen bekannten Auftrag)
   - *Vorschlag prüfen*
   - *von Hand bearbeiten* (unklar, fremde Sprache, unbekannter Absender)
   - *erledigt / archiviert*

   Bei geringer Sicherheit handelt die App nie selbst. Sie macht einen Vorschlag und kennzeichnet ihn.
3. **Worst Case Mail:** fremde Sprache, unverständlich, unbekannter Absender, unklares Anliegen.
   - Die Mail landet in „von Hand bearbeiten“.
   - Sie wird übersetzt angezeigt, das Original daneben.
   - Darunter steht ein Vorschlag „Was will der Kunde?“ mit Angabe der Sicherheit.
   - Mögliche Aktionen: Kunde zuordnen oder anlegen, KV anlegen, Auftrag anlegen, Rückfrage senden, Notiz, „kein Geschäftsvorgang“ (mit Grund).
   - **Liegt ein Eingang zu lange** (z. B. über 24 h), erscheint er auf „Der Tag“.
4. **Foto eines Zettels:**
   - Das Original wird unverändert abgelegt.
   - Die Texterkennung liefert Felder als Vorschlag. Original und Vorschlag stehen nebeneinander, unsichere Felder sind markiert.
   - Nach Bestätigung entstehen Kunde, KV oder Auftrag. Das Original bleibt am Datensatz verknüpft.
   - Klar sichtbar: wo es liegt, was daraus wurde, wer es bestätigt hat.
5. **KV mit wenig Nacharbeit:**
   - Links die Quelle (Mail, Foto, PDF), rechts der vorbefüllte KV.
   - Jedes Feld zeigt seine Herkunft und Sicherheit. Nur Unsicheres wird hervorgehoben.
   - Ein Hauptknopf.
   - Bei Annahme durch den Kunden wird der KV per Klick zum Auftrag. Ein neuer Kunde wird dabei automatisch angelegt, nichts muss doppelt getippt werden. **Das gehört zum USP.**
6. **Mahnwesen:** Wo und wie es sichtbar ist, klärt Thema 4. Der Vorschlag:
   - Überfällige Rechnungen erscheinen auf „Der Tag“ unter „Geld einfordern“.
   - Zahlungserinnerung und Mahnstufen per Klick, mit PDF per Mail.
   - Ob das Stufe 1 ist, entscheidet der Owner.
7. **Kontrolle und Nachvollziehbarkeit für Nutzer und Entwickler:**
   - Jeder Eingang hat einen Verlauf: eingegangen, erkannt, vorgeschlagen, bestätigt durch, Ergebnis.
   - Fehler bei Abruf oder Erkennung (z. B. Microsoft nicht erreichbar, OCR fehlgeschlagen) stehen sichtbar für den Entwickler in der Wartung und nie stumm.
   - Der Versand zeigt „angenommen von Microsoft“ und nicht „zugestellt“.

**Querschnitt E-Rechnung (gehört zu Thema 1 und 4):**
- **Empfangen:** Seit 1.1.2025 muss jedes Unternehmen E-Rechnungen (XRechnung/ZUGFeRD) empfangen und verarbeiten können. Für den Mail-Eingang heißt das: XML-Anhänge erkennen und lesen, nicht nur PDFs per OCR.
- **Senden:** Bis 31.12.2026 ist eine PDF-Rechnung im B2B-Bereich noch zulässig, danach je nach Vorjahresumsatz nicht mehr. Ob die Standardrechnung zusätzlich als ZUGFeRD/XRechnung erzeugt wird, entscheidet der Owner in Thema 4.

---

## 7. Ablauf je Thema

1. Der **Organisations-Klärungschat** startet den Themen-Chat mit dem Prompt aus Abschnitt 8 und trägt ihn in `_review/KLAERUNG_STAND.md` ein.
2. Der **Themen-Chat**:
   - liest diese Datei, die Entscheidungen, BAUPLAN und den Code zum Thema;
   - klärt mit dem Owner;
   - schreibt `_review/KLAERUNG_<Thema>.md` mit dem Inhalt aus Abschnitt 9.
3. Der Themen-Chat meldet „fertig“. Der Organisations-Chat setzt das Thema in `KLAERUNG_STAND.md` auf „an Endversion“ und meldet es oben in `_review/MELDUNG_PLANUNGSCHAT.md`.
4. Der **Endversion-Chat** arbeitet es in spec und BAUPLAN ein, visualisiert es, und der Owner gibt frei.
5. Der **Bau-Codex** baut, der **Planungschat** prüft.

---

## 8. Startprompt für Themen-Chats (nur `<Thema>` ersetzen)

```
Du bist Klärungs-Chat für das Thema <Thema> der Kreile-App.
Lies zuerst: C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app\_review\ORIENTIERUNG_KLAERUNG.md
– dort stehen Ziel, Rollen, Dateien, Stand, Optik-Regeln und deine Grenzen.
Du schreibst KEINEN Code, keine Commits, keine DB-Änderung. Du schreibst nur
_review/KLAERUNG_<Thema>.md.

Vorgehen:
1. Lies OWNER_ENTSCHEIDUNGEN.md, ENTSCHEIDUNGEN_UI.md, BAUPLAN.json und den
   vorhandenen Code zu <Thema>. Fasse in 10 Zeilen zusammen, was schon
   entschieden und gebaut ist.
2. Beschreibe den kompletten Ablauf aus Nutzersicht (Rolf, Phillip), Schritt
   für Schritt, mit Sonder- und Fehlerfällen.
3. Stelle mir offene Entscheidungen einzeln, jede mit Empfehlung. Was schon
   entschieden ist, fragst du nicht erneut.
4. Nichts umwerfen: Änderungen am Bestehenden nur als Änderungsvorschlag mit
   Begründung.
5. Schreibe das Ergebnis nach der Gliederung in Abschnitt 9 der
   Orientierungsdatei. Melde „fertig“.
Sprache Deutsch, knapp.
```

---

## 9. Gliederung jeder Klärungsdatei `KLAERUNG_<Thema>.md`

1. Ziel und Abgrenzung: was dazugehört, was nicht, was ist Stufe 2
2. Bestand: was entschieden und was gebaut ist, mit Datei:Zeile
3. Ablauf aus Nutzersicht, Schritt für Schritt
4. Daten: was gespeichert wird, wo, Pflichtfelder
5. Regeln und Sonderfälle, Fehlerfälle mit Meldung
6. Rechte: wer darf was
7. Entscheidungen des Owners in diesem Chat (mit Datum)
8. Änderungsvorschläge zum Bestehenden (mit Begründung, zur Entscheidung)
9. Abnahmefälle: „Wenn …, dann …“, prüfbar per Klick und in der DB
10. Offene Punkte

Diese Gliederung braucht der Endversion-Chat, um daraus Bildschirme und einen baureifen Bauplan zu machen.

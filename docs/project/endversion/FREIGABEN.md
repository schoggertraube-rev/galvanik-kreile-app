# FREIGABEN · Endversion Oberfläche Kreile WerkstattCockpit

Eine Wahrheit: `spec.json` (Vorgabe) → `index.html` (rendert daraus) → `pruefung.js` (Sackgassen-Check).
Bau = Codex, Prüfung = Prüfer-Chat. Was nicht in `spec.json` steht, wird nicht gebaut. Einträge mit `"status": "vorschlag"` erst nach Freigabe bauen.

## Stand

| Ebene | Inhalt | Status | Datum |
|---|---|---|---|
| 0 | 42 Screens grob, alle Verbindungen, 3 Rollen, Stufen 1–4 + Add-on DATEV, Sackgassen-Check | **wartet auf Owner-Freigabe** | 27.10.2026 |
| 1 | Kernabläufe einzeln: F1 Neuer Eingang → F2 Der Tag → F3 Auftragskarte → F4 Werkstatt → F5 Kunde → F6 Geld → F7 Einstellungen | offen | – |
| 2 | Feinschliff | offen | – |

Jeder freigegebene Ablauf geht sofort in den Bau (Eintrag unten + Verweis in `_review/AKTUELLE_ANWEISUNG.md` durch den Owner/PL).

## Ebene 0 · Prüfweg für den Owner (5 Minuten)
1. `index.html` doppelklicken. Oben: Rolle, Gerät, Stufen, Zustand, Größe, Regeln, Screen, Ansicht.
2. Rolle **Rolf**, Desktop: „Der Tag“ erscheint, grau „Stufe 2/3/4“ in der Seitenleiste. Badge **„Sackgassen-Check grün“**.
3. „Neuer Eingang“ klicken: drei Abschnitte, oben „Woher: Manuell · aus Mail · aus Beleg“ (entschieden, U-160). Zustand **teilweise**: nur die fehlenden Kundenfelder (E-Mail, Zahlungsbedingung) erscheinen.
4. Rolle **Phillip**, Tablet: startet auf „Der Tag“ (eigene Auswahl über „Anpassen“), „Werkstatt“ zeigt Dringend · In Arbeit · Wartet · Fertig, keine Beträge, Badge **„Touch ≥ 48 px ✓“**. Rolle **Gregor**: startet in „Wartung“.
5. Stufe 2 + Add-on DATEV einschalten → „Geld & Rechnungen“: DATEV-Export ist klickbar; aus → grau „geplant · Add-on DATEV“.

Antwort an mich: **„Ebene 0 frei“** oder **„Nein, Schritt X“**.

## Prüfergebnis (maschinell, 27.10.2026)
- `node werkzeuge/bauen.mjs` → **GRÜN** · Stufe 1: 0 Fehler · Alle Stufen + DATEV: 0 Fehler · 42 Screens · 387 Aktionen · 7 Abläufe ohne Bruch (Stand sha256 eed9a502b712).
- `node werkzeuge/selbsttest.mjs` → 8 von 8 absichtlich eingebauten Fehlern erkannt (Prüfer prüft wirklich).
- `node werkzeuge/bilder.mjs` → 0 JS-Fehler · alle Screens × 3 Rollen × 3 Geräte gerendert · 0 tote Ziele · 0 Touch-Ziele < 48 px (nach Korrektur in `groessen_v8.css`: Kunden-Pill, Kontakt-Pills, Teilbild waren in V1.1 zu klein).
- Hinweise (keine Fehler): V1.1-Elemente ohne Bauumfang (X01–X08), Vorschläge (Bausteine „geplant“, Größen V8). Vollständig in „Ansicht → Prüfbericht“.

## Offene Owner-Fragen (eine nach der anderen)

**Login (Entwurf 2026-10-27) zur Prüfung:** eine Spalte, Begrüßung nach Uhrzeit, Personen als Kreise, 4 Punkte, runder Ziffernblock, Tastatur am Desktop; Regeln in `spec.json` → `login.regeln`, Optik in `ui_ergaenzung.css`. Antwort: „Login frei“ oder Änderung.

**Keine offene Owner-Frage.** Offen ist nur die Freigabe von Ebene 0 (Prüfweg oben, Größen V8 beim Ansehen mitprüfen).

### F-06 · Nummern für KV und Lieferschein — **aus dem Bestand beantwortet → U-169** (hätte nicht gestellt werden dürfen)

### W-01 · Analyse-Menüpunkt „Zahlen“ — **beantwortet 2026-10-27 → U-164** (grau „geplant · Stufe 4“)

### F-01 · Wo kommen Mail (E05) und Beleg-Erkennung (E04) in die Oberfläche? — **beantwortet 2026-10-27 → U-160 bis U-163**
Hintergrund: Bauumfang verlangt beides in Stufe 1, V1.1 zeigt es nicht (OF-07), V5 hatte einen eigenen Weg „Dokument / Info erfassen“, Owner hat am 26.10. „Infos rein“ und „+ Anlegen“ zu **einem** Einstieg „Neuer Eingang“ gemacht. Q6b (M365 live) wird gerade gebaut → Entscheidung eilt.
- **(a) Empfehlung:** Alles über „Neuer Eingang“ – oben Schalter „Woher: Manuell · aus Mail · aus Beleg/Foto“; Mail bzw. Beleg füllt Kunde, Positionen, Anhänge vor, Mensch bestätigt. Neue Mails/erkannte Belege erscheinen zusätzlich in „Der Tag“ als Entscheidung „zuordnen“. Kein eigener Menüpunkt.
- (b) Eigener Menüpunkt „Posteingang“ (Liste aller Mails/Belege), daraus „Neuer Eingang“.
- (c) Nur über „Der Tag“ (kein Schalter im Eingang).
Bis zur Antwort: (a) gezeigt, gelb gestrichelt, nicht baubar.

### Danach (noch nicht gestellt)
- F-07 Größen V8 (`groessen_v8.css`) beim Ansehen bestätigen (Umschalter „Größe V8 / V1.1“) – zusammen mit der Freigabe Ebene 0.
- Aus den Quellen beantwortet, keine Frage mehr: F-02 → U-165 (Bauumfang) · F-03 → K-2 (Register) · F-04 → U-167 · F-05 → U-166.

## Freigabe-Protokoll
| Datum | Ebene / Ablauf | Entscheidung | Wer | Geht in den Bau als |
|---|---|---|---|---|
| 2026-10-27 | F-01 Mail / Beleg-Erkennung | (a) über „Neuer Eingang“; Mail und Azure vollständig in der App, kein Outlook-/Microsoft-Fenster, kein eigener Menüpunkt (U-160 bis U-163) | Owner | Codex-Auftrag: Mail-Dialog in der App mit Senden über Microsoft Graph (Büropostfach), Kopie am Vorgang; `mailto:` in `src/modules/customers/ui/CustomerCardView.tsx:128` ersetzen; keine Weiterleitung auf Outlook |
| 2026-10-27 | W-01 Analyse-Menüpunkt | grau „geplant · Stufe 4“ wie alle späteren Stufen (U-164) | Owner | Navigation „Zahlen“ als Ausgrau-Element; kein Bau der Analyse |

## Pflege
- Änderungen nur in `spec.json`, danach `node werkzeuge/bauen.mjs` (erzeugt `spec.eingebettet.js` + `pruefbericht.json`, Exit-Code 1 bei Sackgasse) und `node werkzeuge/bilder.mjs`.
- `BESTAND.md` neu: `node werkzeuge/bestand.mjs`.
- Codex baut gegen `spec.json` + `groessen_v8.css`; Klassen und Bausteine aus `linie/ui/designsystem_v1_1/`. Prüfer-Chat prüft gegen denselben Stand (sha256 im `pruefbericht.json`).


## Bau-Plan (Reihenfolge, Owner 27.10.)
Status je Abschnitt steht in spec.json › baustand. „bau-frei“ = Spec fertig, Abgleich übernommen, technische Konflikte als Bauhinweis entschieden (spec.bauhinweise), keine offene Owner-Entscheidung. An Codex geht nur der Bauplan ohne Inhalt (OR-13).

| # | Abschnitt | Screens | Umfang | Bauhinweise | Status |
|---|---|---|---|---|---|
| 1 | F0 Fundament: einstellbare Rechte (Stufe 1) | 8.5 rechte · 8.8 meincode · 0 login + alle Server-Gates | F#34 Rechte je Login × Bereich · F#35 Login anlegen · F#36 Login ändern · F#37 developer fest + Zugang nur mit „logins“ · F#38 eigener Code | K2 K3 K4 K17 K20–K25 | bau-frei (spec 77a5af2ca4cf) |
| 2 | F1 Neuer Eingang | 3 eingang · 3.1 kundeneu · 3.2 kamera · 3.3 beleg · 3.4 mailein · 3.6 entwurf | E02 E04 E05 E07 A10 A11, F#1–F#8, F#11, F#33 | K1 K5–K11 K16 K27 | bau-frei (spec 45238792dd0f) |
| 3 | F2–F8 | siehe baustand | | | in Arbeit (Spec) |

## Freigabe-Protokoll (Format, OR-15)
Jede Freigabe als eigene Zeile: Datum · Screen-IDs (Nummer + id) · spec-Stand (sha256, erste 12 Zeichen) · Ergebnis · Bemerkung.
An Codex geht nur der Bauplan ohne Inhalt (OR-13/U-202) – nie index.html, Musterdaten oder Bildschirmfotos.

| Datum | Screens | spec-Stand | Ergebnis | Bemerkung |
|---|---|---|---|---|
| 2026-10-27 | – | 6ee430a3a8d1 | Stand zur Prüfung (keine Freigabe) | nach U-200–U-204; nächste Seite: 10 Ware raus |
| 2026-10-27 | – | 2a961b9cf30c | Abgleich übernommen (keine Freigabe) | ABGLEICH_SPEC_CODE.md: Kennzeichnung je Element in spec.json (screens[].abgleich, Feld „aenderung“); K1–K12, K14–K19 als Bauhinweise technisch entschieden (spec.bauhinweise); K13 offen bei der Owner; F1 wartet auf Nachtrag 3.6 |
| 2026-10-27 | 3.6 entwurf · 8.5 rechte · 8.8 meincode · 11.1 buendel | 77a5af2ca4cf | Nachtrag Abgleich übernommen (keine Freigabe) | K20–K26 technisch entschieden, K27 offen bei der Owner; F0 Fundament Rechte als erster Bau-Eintrag eingeplant (bau-frei) |
| 2026-10-27 | 3 · 3.1 · 3.2 · 3.3 · 3.4 · 3.6 | 45238792dd0f | F1 Neuer Eingang bau-frei (keine Freigabe) | K27 Entwurf je Login auf „Der Tag“, K13 Kassieren bar/Karte mit Knopf „bezahlt“ (U-205); F0 Fundament Rechte bleibt erster Bau-Eintrag |

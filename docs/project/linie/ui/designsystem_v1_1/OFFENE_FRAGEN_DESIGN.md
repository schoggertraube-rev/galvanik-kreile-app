# OFFENE FRAGEN · Design · Kreile-Designsystem V1.1
Stand 2026-09-27 (OF-01…33 aus V1 übernommen, OF-22 angeglichen, neu ab OF-34) · Format: **Frage** · Optionen · Empfehlung · *bis dahin im Design*

## Konflikte Seitenreferenz ↔ OE-2609-27 (§6)
**OF-01 Rolf V8: Begrüßungs-/Statuszeile, Abschnittstitel „Das braucht dich“, „erledigt, sobald …“-Zeilen.** · (a) behalten (b) entfernen · Empfehlung (b), OE-2609-27 ist neuer · *entfernt; Bedeutung über Farbe, Punkt und Kurzlabel „Konflikt/Warnung/Entscheidung“.*
**OF-02 Phillip V4: Label „Heute sichern“ vs. „keine Abschnittsüberschrift“.** · (a) behalten, da Kanon/PL-Gate (00_UI_REFERENZ_KANONISCH) (b) entfernen · Empfehlung (a) · *behalten als kleines Label, keine zweite Überschrift.*
**OF-03 Phillip V4: Riesenzahl WIP (46px), Zähler „Fällig diese Woche 6“.** · Empfehlung: Zahl 16px in einer Zeile · *umgesetzt.*
**OF-04 Navigationszähler (V8: Ware raus 4, Aufträge 14, Geld 2).** · (a) behalten (b) nur Konflikt-Zähler an „Der Tag“ · Empfehlung (b), sonst Doppelung mit Kachel · *(b); nur bei Rolf (Zuständigkeit).*
**OF-05 Auftragskarte V8: Overline „Nächste Aktion“, Hinweis „Ort im Haus · Schritt tippen“, Freeze-Erklärsatz, Steckplatz „geplant“.** · Empfehlung entfernen/ersetzen · *entfernt; Freeze-Wirkung über Dialog „Fertig melden“ mit 3 Pflichtprüfungen (V5); Steckplatz → Ausgrau „Termintreue · Kalkulation & Kennzahlen · In Aufbau“.*
**OF-06 Doppelte Zahlungsinfo in Auftragskarte (Terminbox, Schwelle, Rechnungsblock).** · *Zahlungsmodus nur in der Schwelle, solange gesperrt; im Rechnungsblock erst nach Freigabe.*

## Konflikte Register ↔ neuere OE
**OF-07 D-UI-V5-001 „KI/OCR/Provider unsichtbar“ vs. OE-2609-04 „ausgrauen“.** (OP-02) · *OE-2609-04 gilt: Elemente „In Aufbau“ (Kartenterminal, Bank, Liquidität, Reklamation, Personalkosten, Termintreue); OCR-Weg aus V5 nicht gezeigt (kein Vertrag); „Dokument hinzufügen“ = nur Original.*
**OF-08 D-UI-V5-002 enge Rechte Rolf vs. OE-2609-09 „alle dürfen alles“.** · *OE-2609-09; Admin sperrt je Person (Dialog „Rechte“), gesperrte Bereiche verschwinden aus der Navigation, Direktaufruf zeigt Zustand „gesperrt“.*

## Anordnung / Optik (nicht in Quellen festgelegt)
**OF-09 Phillip: Navigation zu anderen Bereichen.** · (a) Dock zusätzlich zur Aktionsleiste (b) Konto-Menü (Avatar) (c) keine · Empfehlung (b), zwei Leisten unten kosten Falz · *(b): Aufträge, Kunden, Einstellungen, Abmelden. Kein Geld.*
**OF-10 Phillip am Desktop.** · *Werkstatt-Shell (Kompaktkopf + Aktionsleiste) in voller Breite, wie V5 (Tablet-Frame für Phillip).*
**OF-11 Rolf öffnet „Werkstatt“ am Desktop.** · *Werkstatt-Inhalt in der Büro-Shell ohne Aktionsleiste (G3/G4); Werkstatt-Aktionen über Seitenleiste/Plus.*
**OF-12 „Primärfarbe“ Globales Plus.** · (a) Marken-Verlauf `--grad` (b) Navy · Empfehlung (a) wie Phillip-Primäraktion · *(a).*
**OF-13 Plus und Seitenleisten-„Neuer Eingang“ gleichzeitig.** · Empfehlung beide (Plus = Pflicht D-UI-V5-001; Schnellaktion = V8) · *beide.*
**OF-14 Farbzuordnung Handlungsbedarf.** · *Konflikt = RAL-Rot · Warnung = Orange · Entscheidung = Info-Navy (V8 zeigte Preisfreigabe orange). Owner bestätigen.*
**OF-15 Handy: Sekundäraktionen.** · V8-Handy zeigt 3 Knöpfe unter dem Eintrag · *Primäraktion rechts + „⋯“ (48px) für weitere; Auftragsnummer in der Meta-Zeile, damit der Titel lesbar bleibt (§6.6 Aktion rechts, 2 Zeilen).*
**OF-16 Gerätezuordnung 1220px ohne Touch.** · *zählt als Desktop; Tablet nur mit Touch/grobem Zeiger (V5-Regel). Kundenansicht erzwingt Gerät per Umschalter.*
**OF-17 Gregor: erhöhter E-Mail-Einstieg – Felder.** · *E-Mail + Passwort + „Anmelden“; Details (MFA?) offen.*
**OF-18 Zahlungsmodus im Neuen Eingang.** V5 bot „Rechnungskunde · Vorkasse · Zahlung bei Abholung“. · *abgeleitet aus OE-2609-07/11: Abholung ⇒ „Bar oder Karte bei Abholung“, Versand ⇒ „Vorkasse“; „Rechnung auf Ziel“ nur wählbar, wenn beim Kunden freigeschaltet.*
**OF-19 Abwesenheiten/Betriebstermine vor M365-Gate.** · *Umschalter „Anbindungen“: Livegang zeigt Abwesenheits-Konflikt + Kachel; „Stand heute“ zeigt Ausgrau „Abwesenheiten aus Outlook · In Aufbau“.*
**OF-20 Microsoft-Hinweis bei Gregor.** · *Livegang: Konflikt „Microsoft-Verbindung abgelaufen“ + „Neu verbinden“; Stand heute: Ausgrau.*
**OF-21 Terminübersicht Woche/Monat (Owner prüft im Katalog).** · *Ansicht in „Aufträge“ (Segment Liste · Woche · Monat), Mo–Sa, Einträge minimal (Terminart · Nr. · Kurzname). Sonntag nur im Monat.*
**OF-22 Liquidität/Termintreue auf der Startseite (OE-2609-21/23).** · **V1.1 angeglichen an OF-32 (a) (Auftrag A4):** *Firmengesundheit nur als Zustandswort in der Lage-Leiste (Termintreue · Liquidität 30 Tage; Phillip nur Termintreue), bis Anbindung M01–M03 als Element „In Aufbau“; keine Zahl, keine Kachel. Kippt ein Wert (nach Anbindung), erscheint zusätzlich eine Entscheidung im Handlungsbedarf. Auf „Geld & Rechnungen“ bleibt Ausgrau „Liquidität 30 Tage · In Aufbau“.*

## Bekannt offen – nicht gefüllt
**OF-23 Schwelle „Kontostand älter als X Tage“ + Eingaberhythmus (OE-2609-24).** · *Ausgrau „In Klärung“ in Kachel Kontostand.*
**OF-24 Inhalt „5-Punkte-Check“ (D-USP-001).** · *nicht dargestellt.*
**OF-25 Bestätigung Aufbewahrungsfristen durch Steuerberater/Datenschutz (OP-13).** · *Werte aus OE-2609-20 angezeigt, 3-Jahres-Wert als „Vorbelegung“; Ausgrau „In Klärung“.*

## Technik / Lieferung
**OF-26 Vorschau ohne Build.** Katalog/Kundenansicht nutzen `kr-vorschau.js` (gleiche Klassen wie TSX), damit sie per Doppelklick laufen. · (a) so lassen (b) im Repo zusätzlich eine Next-Katalogseite aus den TSX · Empfehlung (b) bei P-DS · *(a).*
**OF-27 Sichtprüfung ohne Playwright.** Bilder = DOM-Snapshot in exakter Pixelgröße; Schrift kann minimal abweichen. · Empfehlung: PL wiederholt §6 mit Playwright/Chromium · *Bilder in `_pruefbilder/`.*
**OF-28 Beispiel-Nummernformate** (`KV-2026-0031`, `R-2026-0102`) sind nur Vorschau, kein Nummernkreis-Vorschlag.

## Nach Optimierung (2026-09-26)
**OF-29 Zähler bei aufgeschobenen Punkten.** · **ENTSCHIEDEN Owner 2026-09-26: zählt weiter mit.** Umgesetzt.
**OF-30 Vibration.** · *nur Touch-Geräte, 8 ms, nur Primäraktionen; abschaltbar per Einstellung? Owner entscheiden.*
**OF-31 Tastenkürzel N und /.** · *nur Desktop, nur ohne offenen Dialog und außerhalb von Eingabefeldern.*
**OF-32 Firmengesundheit auf der Startseite vs. OE-2609-22 („keine Kennzahl-Kacheln“).** · (a) nur Zustandswort in der Lage-Leiste, Detail als Entscheidung (b) gar nicht bis Anbindung · Empfehlung (a) – USP-Wunsch Owner, keine Zahl, keine Kachel · *(a); bis M01–M03 „In Aufbau“. Zustandswörter („im Plan“, „knapp“, „kippt“, „gesichert“) sind Designvorschlag, Schwellen liefert M02.*
**OF-33 Lage-Filter.** · *Antippen filtert den Handlungsbedarf nach Art, nochmal = alle; Seitenwechsel setzt zurück.*

## V1.1 (2026-09-27)
**OF-34 Tagesüberblick: Kacheln (V1/Rolf V8) oder Zeitstrahl „Heute & Woche“ (V2)?** (Auftrag C1) · (a) Kacheln – Seitenwahrheit Rolf V8 (b) Zeitstrahl – Termine und Warenausgang in einer Zeitachse, jede Nummer einmal (c) Zeitstrahl nur Tablet/Handy · Empfehlung: Owner entscheidet im Umschalter der Kundenansicht; fachlich beide gleich (gleiche Einträge, gleiche Abläufe) · **ENTSCHIEDEN Owner 2026-09-27: Zeitstrahl.** Umgesetzt als Standard.
**OF-35 (Owner 2026-09-27: in Ordnung) Gruppenlabels in der Befehlspalette „Treffer“ / „Tun“.** Kleine Gruppenlabels trennen Suchergebnis und Aktion (Palettenname „Suchen oder tun“ aus dem Auftrag). · (a) behalten (b) ohne Labels, Aktionen nur durch Symbolkachel unterscheiden · Empfehlung (a) – kein Erklärtext, ordnet nur · *(a).*
**OF-36 (Owner 2026-09-27: in Ordnung) Zurück-Knopf im Seitenblatt „Zurück · ‹Auftragsnummer/Kundenname›“.** · (a) mit Ziel (b) nur „Zurück“ · Empfehlung (a) – zeigt, wohin es geht, ohne neuen Inhalt · *(a).*
**OF-37 Tablet: Fokus + 2 Einträge, Rest aufklappbar.** **Owner 2026-09-27: in Ordnung; Bedingung: Konflikte werden nie eingeklappt** – umgesetzt. Damit bleibt §6.2 (erster Tagesüberblick über dem Falz) trotz größerem Fokuseintrag erfüllt; V1 zeigte auf dem Tablet alle Einträge. · (a) wie Handy max. 3 (b) alle zeigen, Falz knapp · Empfehlung (a) · *(a); Anzahl bleibt über Lage-Leiste und „N weitere“ sichtbar.*
**OF-38 Wischen in der Vorschau.** *Owner: unkritisch.* Die TSX-Komponente `Wischbar` reagiert nur auf `pointerType==='touch'`; die Kundenansicht erlaubt Wischen mit der Maus, sobald Gerät Tablet/Handy gewählt ist (Simulation). · *nur Vorschau.*
**OF-39 Schnellknöpfe Tablet/Handy nach dem Handlungsbedarf (PL-Hinweis N5).** · (a) nach Handlungsbedarf (b) wie V1 davor · Empfehlung (a), §6.1 · *(a).*
**OF-40 Fokuseintrag bei nur einer Aktion (z. B. Gregor „Neu verbinden“).** · *Hauptaktion allein in der Aktionszeile; kein künstliches „Später“ (V1 hatte dort keins).*

## Owner-Runde 2 (2026-09-27)
**OF-41 Flächenfarben abweichend von V5 (§3 „einzige Token-Quelle“).** Owner wünscht neutralere, professionellere Flächen („nicht bräunlich“, „mehr Apple“). · (a) V5-Werte für Grund/Fläche/Linie durch neutrale ersetzen, Navy/Akzente behalten (b) V5 wörtlich lassen · Empfehlung (a) – Owner ist Rangstufe über V5-Mock · *(a) umgesetzt als V1.1-Block in tokens.css; PL-Prüfung „Tokens vs. V5“ muss diese 6 Werte als gewollt führen. Owner bestätigt die neuen Werte beim Ansehen.*
**OF-42 Fokuseintrag ohne sichtbare Zweitaktion.** Delegieren („an Phillip“) und Zurückgeben liegen jetzt hinter „Weitere“. · (a) so lassen (Owner: keine Auswahl) (b) Delegieren sichtbar lassen, da V8-Kernablauf · Empfehlung (a) · *(a).*
**OF-43 Foto am Teil – Ablage.** Foto wird dem Teil und dem Auftrag zugeordnet (Datenbank, Fotos & Dokumente). Offen: Pflichtfoto vor „fertig“? Format/Größe? · *Vorschau zeigt Bestätigung „Foto zu T-xx gespeichert“.*
**OF-44 Rolf-Startseite „Betriebsführung“.** Owner-Schwerpunkt Rolf = Betriebsführung, Phillip = Termintreue/Abläufe. Rolf zeigt heute Kontrolle (Handlungsbedarf, Lage-Leiste inkl. Liquidität) und Tagesablauf; echte Betriebsführungs-Sichten (Auslastung, Kosten, Termintreue-Wert) kommen mit M01–M03 (Schritt 2). · *bis dahin Ausgrau „In Aufbau“ in der Lage-Leiste.*

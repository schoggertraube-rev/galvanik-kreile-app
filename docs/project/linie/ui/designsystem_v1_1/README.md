# Kreile-Designsystem V1.1 · `designsystem_v1_1/`
**Stand:** 2026-09-27 (Owner-Runde 2 am selben Tag, siehe unten) · Auftrag V1.1 (`PROMPT_DESIGN_V1_1_2026-09-27.md`) · Basis und Maßstab = V1 (`designsystem_v1/`, unverändert) · V2 nur Ideenquelle · Schritt 2 **nicht** begonnen.

V1.1 = V1 vollständig + Pflicht-Nacharbeit A1–A4 + geprüfte V2-Elemente B1–B6 + Owner-Umschalter C1. `BUNDLE/`, `designsystem_v1/`, `designsystem_v2/` wurden nicht verändert. Keine neuen fachlichen Inhalte, Funktionen, Texte oder Kennzahlen; alle Texte stammen aus V1 (einzige Kurzformen: Paletten-Gruppen „Treffer“/„Tun“, Zurück-Knopf „Zurück · ‹Nummer›“, siehe OF-35/36).

## Quellen geprüft
Alle Dateien in `BUNDLE/` gegen `09_SHA256SUMS.txt` geprüft – **alle OK**, u. a. V5 `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`. `BUNDLE/` wurde nicht verändert. Nicht verwendet: `_ALT_nicht_verwenden/`, andere Mocks, Demo-Daten der Mocks.

## Inhalt
| Pfad | Zweck |
|---|---|
| `tokens.css` | alle Tokens aus V5 (Farben wörtlich, Schatten, Radien, Schrift, Abstände, Shell-Maße, Referenzauflösungen) |
| `komponenten.css` | alle Klassen `kr-…`, reines CSS, Gerät über `[data-geraet]` am `.kr-app` |
| `components/*.tsx` | React-19-Komponenten, TypeScript strict, exportierte Props-Typen, `index.ts` |
| `katalog/index.html` | jede Komponente in jedem Zustand, umschaltbar Desktop 1914 · Tablet 1220 · Handy 390 |
| `katalog/kr-vorschau.js` | Vorschau-Spiegel der TSX (gleiche Klassen/Struktur) – nur damit Katalog und Kundenansicht ohne Build per Doppelklick laufen |
| `kundenansicht/index.html` | klickbare Gesamtansicht Rolf · Phillip · Gregor × Desktop · Tablet · Handy |
| `_pruefbilder/` | Sichtprüfung (siehe unten) |
| `OFFENE_FRAGEN_DESIGN.md` | Konflikte und Unklares (Frage · Optionen · Empfehlung · bis dahin) |
| `SHA256SUMS.txt` | Prüfsummen aller Dateien dieses Ordners |

## Einbau Next.js 16.2 (App Router)
1. Ordner `designsystem_v1_1/` byte-identisch nach `02_app/ui/` (Paket P-DS, PL; P-DS-Quelle = `designsystem_v1_1\`). Alte `tokens.css`/`ci-tokens.css` entfallen (OE-2609-03).
2. `app/layout.tsx`:
```tsx
import '@/ui/tokens.css';
import '@/ui/komponenten.css';
import { Fraunces, Inter } from 'next/font/google';
const serif = Fraunces({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-serif' });
const sans  = Inter({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-sans' });
// <html lang="de" className={serif.variable + ' ' + sans.variable}> … und in einer eigenen globals.css:
// :root{--serif:var(--font-serif),Georgia,serif;--sans:var(--font-sans),system-ui,sans-serif}
```
3. Wurzel jeder authentifizierten Seite: `<KrApp geraet={geraet}>`. `geraet` bestimmt die App (Client): Breite ≤ 699 → `handy`; Touch/grober Zeiger und Breite ≤ 1399 → `tablet`; sonst `desktop` (abgeleitet aus V5 `isCaptureDevice`). `.kr-app` braucht eine volle Höhe (`height:100dvh`).
4. Shell: Rolf/Gregor `variante="buero"`, Phillip (Rolle `werkstatt`) `variante="werkstatt"` – auf **allen** Geräten. Aktionsleiste existiert nur in `werkstatt` (G3/G4).
5. Komponenten holen keine Daten, halten keinen globalen Zustand, enthalten keine Beispieldaten. Interaktive Dateien tragen `'use client'` (GlobalesPlus, Dialog, PinEingabe, Handlungsbedarf, Wischbar, tastatur, Befehlspalette, Seitenblatt); übrige sind in Client-Grenzen der App einsetzbar.
7. **V1.1-Verdrahtung in der App** (nur Anordnung, keine neue Fachlogik):
   - Startseite: `<HandlungsListe fokus auswahl={sel} …>`; `sel = useListenTastatur({ anzahl, aktiv: geraet==='desktop' && !dialogOffen, onHaupt: i => eintraege[i].aktionen[0].onClick(), onSpaeter: i => eintraege[i].aktionen.find(a=>a.spaeter)?.onClick() })`.
   - „Später“-Aktion mit `spaeter: true` markieren (öffnet Zeitwahl V8 S1). `wischbar` nur setzen, wenn der Eintrag **keine** Freigabe und **kein** Geld ist.
   - Strg K, `/` und Klick auf das Kopf-Suchfeld öffnen `<Befehlspalette>`; `aktionen` nur aus `PalettenAktionId` und nach Rechten gefiltert (Phillip: keine Geld-Treffer/-Aktionen; gesperrte Bereiche weglassen).
   - Auftrags-/Kundenkarte in `<Seitenblatt zurueck={…}>` statt `<Dialog groesse="karte">`; Inhalt `<Karte>` unverändert.
   - Neuer Eingang: Desktop/Tablet `<AbschnittNav>` + 3× `<Abschnitt>`; Handy `<SchrittNav>` wie V1.
   - Tagesüberblick: **Owner-Entscheidung 2026-09-27: Zeitstrahl `<Zeitstrahl>`** („Heute & Woche“) ersetzt die Kacheln Termine + Heute raus (OF-34 entschieden). Werkstatt (Phillip): Reihenfolge Heute & Woche → Bündeln → In Arbeit → Abwesenheiten.
6. Kein Tailwind in DS-Komponenten, keine UI-Bibliothek, kein Dark-Mode.

## Komponenten (Props-Kurzreferenz; vollständige Typen in den Dateien)
| Komponente | Datei | wichtigste Props |
|---|---|---|
| KrApp | AppShell.tsx | `geraet` |
| AppShell | AppShell.tsx | `geraet, variante('buero'\|'werkstatt'), aktiv, kuerzel, datum?, ausgeblendet?, badges?, suche, plus, onNav, onStart, onKonto, onNeuerEingang, onWareRaus, onAuftragOeffnen?, onMehrarbeit?, onFertigMelden?, ebene?` |
| SeitenKopf | AppShell.tsx | `titel, werkzeug?` – genau eine Überschrift |
| GlobalesPlus | GlobalesPlus.tsx | `onKundeAnlegen, onAuftragKv` |
| SuchKopf · SuchFeld · SuchTrefferListe | Suche.tsx | `onOeffnen` · `wert, onWert` · `treffer[{id?,titel,grund,quelle,dringend?,onOeffnen}], zustand, texte` |
| HandlungsEintrag · HandlungsListe | Handlungsbedarf.tsx | `art('konflikt'\|'warnung'\|'entscheidung'), id?, titel, titelKurz?, meta?, metaKurz?, von?, aktionen[{text,kurz?,icon?,art?,onClick}], status?, geraet` · `eintraege, geraet, label?, zustand, max?, onAlle?` |
| Auftragszeile | Auftragszeile.tsx | `id, kundeKurz, titel, meta?, ton?, status?, aktion?, karte?, onOeffnen?` |
| Kundenzeile | Kundenzeile.tsx | `kuerzel, name, meta?, rechnungAufZiel?, karte?, onOeffnen?` |
| Terminzeile | Terminzeile.tsx | `zeit, art(Terminart), auftragNr?, kundeKurz, meta?, onOeffnen?` |
| Abwesenheitszeile | Abwesenheitszeile.tsx | `kuerzel, person, zeitraum, art` |
| Zeile (Basis) | Zeile.tsx | `vorne?, punkt?, id?, titel, meta?, seite?, karte?, onClick?` |
| Kachel | Kachel.tsx | `titel, icon?, iconTon?, zahl?, fuss?, zustand, texte, children` |
| BuendelVorschlag | BuendelVorschlag.tsx | `titel, meta?, aktion, zustand, texte` |
| WipMenge | WipMenge.tsx | `anzahl, meta?, onOeffnen, zustand, texte` |
| Karte · Kartenkopf · TerminBox · Zustandskette · ZahlungsSchwelle · KartenBlock · NaechsteAktion · Teil · Notiz · Fakten · Verlauf · Schnellaktionen | Karte.tsx | siehe Datei |
| Chip · Punkt | Chip.tsx | `text, ton?, icon?` · `ton?` |
| Button | Button.tsx | `art('standard'\|'primaer'\|'sekundaer'\|'gefaehrlich'\|'erledigen'\|'marke'\|'leise'), icon?, text?, label?, block?` + HTML-Attribute |
| Feld · Eingabe · Auswahl · Textfeld · Checkbox · Segment · FormRaster | Formular.tsx | siehe Datei |
| Dialog · Schritte · Hinweis | Dialog.tsx | `titel, icon?, groesse('normal'\|'breit'\|'schmal'\|'karte'), onSchliessen, onZurueck?, fuss?` |
| Toast | Toast.tsx | `text, aktion?` |
| Picker | Picker.tsx | `suche, onSuche, optionen[{id,titel,meta?,status?,gesperrt?,onWahl}], onScannen?, zustand, texte` |
| Zustand · MitZustand | Zustand.tsx | `art('laedt'\|'leer'\|'fehler'\|'gesperrt'), text?, aktion?` · `zustand, texte` |
| Ausgrau | Ausgrau.tsx | `art('aufbau'\|'klaerung'), text, icon?, variante('zeile'\|'knopf'\|'nav')` |
| PinEingabe | PinEingabe.tsx | `laenge, meldung?, onZiffer, onLoeschen, onNeu, onEmailAnmeldung?` |
| Terminuebersicht | Terminuebersicht.tsx | `ansicht('woche'\|'monat'), tage, versatz?, onTag?, zustand` |
| **V1.1** HandlungsEintrag/-Liste (erweitert) | Handlungsbedarf.tsx | Eintrag: `fokus?, gewaehlt?, wischbar?` · Aktion: `spaeter?` · Liste: `fokus?, auswahl?` |
| **V1.1** Wischbar | Wischbar.tsx | `rechtsText, onRechts, onLinks, schwelle?` – nur `pointerType==='touch'` |
| **V1.1** useListenTastatur | tastatur.ts | `anzahl, aktiv, onHaupt, onSpaeter` → Index |
| **V1.1** Befehlspalette | Befehlspalette.tsx | `wert, onWert, treffer: SuchTreffer[], aktionen[{id,text,icon,kbd?,onTun}], zustand, texte, geraet, onSchliessen` |
| **V1.1** Seitenblatt · BlattZurueck | Seitenblatt.tsx | `titel, onSchliessen, zurueck?, zustand, texte, children(Karte)` · `text, onClick` |
| **V1.1** Zeitstrahl | Zeitstrahl.tsx | `gruppen[{key,titel,zeilen[{key,zeit,id?,titel,meta?,ton?,chip?,aktion?,onOeffnen?}]}], jetzt?, zustand, texte` |
| **V1.1** AbschnittNav · Abschnitt | Dialog.tsx | `abschnitte, aktuell, onAbschnitt` · `nr, label, children` |
| **V1.1** KettenSchritt (erweitert) | Karte.tsx | `anteil?` (0…1, Fortschrittsbalken abgehakter Teile) |

**7 Zustände** (`DatenZustand`): `daten · laedt · leer · fehler · gesperrt · klaerung · aufbau` – über `MitZustand` in jeder datentragenden Komponente (HandlungsListe inkl. Fokus, Kachel, SuchTrefferListe, Befehlspalette, BuendelVorschlag, WipMenge, Picker, Terminuebersicht, Zeitstrahl, Seitenblatt; Zeilen erscheinen in Kacheln/Listen). Im Katalog: jede neue/geänderte Komponente mit allen 7 Zuständen, umschaltbar 1914 · 1220 · 390 (Abschnitte mit Marke „V1.1“).

## Kundenansicht
Obere Leiste (kein Produktteil): **Person**, **Gerät** (exakt 1914×917 · 1220×880 · 390×844), **Daten** (Beispiel · Leer = neue Instanz · Fehler), **Anbindungen** (Livegang = Grundstamm mit M365 und E-Rechnung · Stand heute = diese zusätzlich „In Aufbau“ · Ausbau M01–M03 = Zielbild Firmengesundheit), **Tagesüberblick** (V1.1 C1: „Kacheln (V1/Rolf V8)“ = Standard · „Zeitstrahl Heute & Woche (V2)“; auch per `?tages=zeit`), **Bildschirm** (Direktsprung zu jedem Screen). Alles andere ist klickbar wie im Produkt: Handlungsbedarf-Aktionen, Plus, Suche (Strg K), Neuer Eingang in 3 Schritten, Aufträge (Liste/Woche/Monat), Auftragskarte V8, Kundenkarte V2 (Backstack Auftrag → Kunde → Auftrag), Geld & Rechnungen, Ware raus, Mehrarbeit, Fertig melden, Einstellungen, Login.
Beispieldaten sind neutral („Kunde Nord“ …), nur in `kundenansicht/` und Katalog.

## Optimierung Bedienung (Owner-Wunsch 2026-09-26, nach Schritt 1b)
Vorstand gesichert in `_archiv_vor_optimierung/`. Nur Anordnung/Optik/Abläufe – keine neuen Inhalte, §6 unverändert eingehalten.
- **Bewegung nur bei neuem Inhalt:** Seiten bauen sich gestaffelt auf, Dialoge öffnen weich (Handy: von unten), Toasts gleiten ein; erledigte Einträge fahren sichtbar heraus (V8 „removing“). Kein Flackern bei normalen Klicks. `prefers-reduced-motion` schaltet alles ab.
- **Haptik:** Druck-Feedback (leichtes Einsinken) auf allen Knöpfen, Zeilen, Dock und Aktionsleiste; Anheben bei Hover; kurzes Vibrationssignal auf Touch-Geräten bei Primäraktionen (`components/haptik.ts`, im Button eingebaut).
- **Kürzere Klickwege:** „Später“ mit Zeitwahl (V8 S1, heute Fälliges nur bis zur Frist) · jede Handlungsbedarf-Aktion mit „Rückgängig“ · „Fertig melden“ nimmt den Punkt bei allen Zuständigen weg (V8 S6) und bietet direkt „Ware raus“ an · „N weitere“ klappt auf · Teile in der Auftragskarte direkt abhaken, Kette zeigt „x von y Teilen“.
- **Neuer Eingang:** klickbare Schrittleiste „1 Kunde · 2 Positionen · 3 Prüfung“ (`SchrittNav` in Dialog.tsx), Rücksprung ohne Datenverlust, Pflichtfelder mit Feldfehler statt stillem Blockieren.
- **Tastatur (Desktop):** Strg K oder / = Suche · N = Neuer Eingang · ↑/↓ durch Treffer · Enter = ersten Treffer öffnen bzw. nächsten Schritt · Esc = schließen.
- **Aufträge:** Suchtext bleibt beim Filterwechsel erhalten, leeres Ergebnis mit genau einem nächsten Schritt.
- Kopfleiste bekommt beim Scrollen einen Schatten; Plus dreht sich bei offenem Menü.

## Erlebnis-Runde (Owner 2026-09-26): Kontrolle & Gesundheit zuerst
- **Lage-Leiste** (`Lageleiste.tsx`) als erste Zeile jeder Startseite: offene Punkte je Art (Konflikte · Entscheidungen · Warnungen) als Filter über den Handlungsbedarf, rechts **Firmengesundheit**: Termintreue + Liquidität 30 Tage (OE-2609-21/23) – nur Zustandswort, keine Zahl (OE-2609-22). Phillip: nur Termintreue. Vor Anbindung M01–M03 „In Aufbau“. Kippt ein Wert, erscheint zusätzlich eine Entscheidung im Handlungsbedarf (Umschalter „Anbindungen: Ausbau M01–M03“ zeigt das Zielbild).
- **Aufgeschobenes zählt weiter mit** (Owner): in Lage-Leiste und Badge; delegierte/zurückgegebene zählen nicht (V8 S3).
- **Logische Ordnung:** Handlungsbedarf immer Konflikt → Entscheidung → Warnung; Aktionsspalte fluchtet (feste Mindestbreiten). Tagesüberblick: Termine → Heute raus → Bündeln/Abwesenheiten/Neu (3 Spalten Desktop, 2 Tablet, 1 Handy). Leere Arten erscheinen nicht.
- **Fließendes Auf-/Zuklappen:** „N weitere“ öffnet und schließt weich (Höhe + Deckkraft, Pfeil dreht); Dialoge, Menüs und Karten schließen mit umgekehrter Bewegung statt zu verschwinden (Handy: gleiten nach unten); Menüeinträge erscheinen gestaffelt; Statuswechsel blenden weich ein; kritische Gesundheit pulsiert ruhig. `prefers-reduced-motion` schaltet alles ab.

## Bewusste Abweichungen von den Seitenreferenzen wegen §6 (OE-2609-27 ist neuer)
Tageszeile/Begrüßung unter „Der Tag“/„Werkstatt“ entfernt · Abschnittstitel „Das braucht dich“ entfernt · „erledigt, sobald …“-Zeilen entfernt (max. 2 Zeilen) · Riesenzahl WIP (46px) → 16px · Zähler an „Ware raus“/„Aufträge“/„Geld“ in der Navigation entfernt (Zahl steht in der Kachel) · Marken-Unterzeile „▸ Der Tag“ entfernt · Overline „Nächste Aktion“ und „Ort im Haus · Schritt tippen“ entfernt · Steckplätze „geplant/kommt“ → Ausgrau-Element · Kalender-Menüpunkt, „Zahlen“, „Material“ entfallen. Details in `OFFENE_FRAGEN_DESIGN.md`.

## Sichtprüfung V1 (Stand 2026-09-26 – Bilder liegen in `designsystem_v1/_pruefbilder/`; V1.1-Prüfung siehe unten)
Aufgenommen im Browser als DOM-Snapshot des Geräterahmens in exakter Pixelgröße (kein Playwright verfügbar; siehe OF-27). Kriterien: **1** Handlungsbedarf zuerst, Aktion am Eintrag · **2** über dem Falz · **3** genau eine Überschrift · **4** keine Erklärtexte · **5** keine Doppelungen · **6** Kacheln nach Inhalt, 2 Zeilen, keine Riesenzahlen · **7** Leer/Fehler ehrlich · **8** Ausgrau nur als Element · **9** Geld · **10** Galvanik = ein Schritt.

| Bild | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| v11_rolf_desktop_1914x917 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ |
| v11_rolf_tablet_1220x880 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ |
| v11_rolf_handy_390x844 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ |
| v11_phillip_desktop_1914x917 | ✔ | ✔ | ✔¹ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ |
| v11_phillip_tablet_1220x880 | ✔ | ✔ | ✔¹ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ |
| v11_phillip_handy_390x844 | ✔ | ✔ | ✔¹ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ |
| v11_gregor_desktop_1914x917 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | – |
| v11_gregor_tablet_1220x880 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | – |
| v11_gregor_handy_390x844 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | – |
| v11_rolf_desktop_leer | ✔² | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| v11_rolf_desktop_auftragskarte / _handy_auftragskarte | – | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ |
| v11_rolf_tablet_kundenkarte · _neuer_eingang · desktop_auftraege_woche · login_handy | – | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ |
| katalog_desktop_1914x917 · katalog_tablet_1220x880 · katalog_handy_390x844 (+ `_vollstaendig`) | Komponentenebene: 4 ✔ · 6 ✔ · 7 ✔ · 8 ✔ · 10 ✔ (Katalog ist Entwicklerreferenz mit Komponentenüberschriften; 2/3 nicht anwendbar) |||||||||| 

¹ Label „Heute sichern“ ist Kanon Phillip V4 (PL-Gate) und bleibt – siehe OF-02. ² Nichts dringend ⇒ Block entfällt; eine Zeile „Noch keine Aufträge erfasst.“ + genau ein Schritt „Neuer Eingang“.
Bekannte Aufnahme-Eigenheit: DOM-Snapshots können Schrift minimal breiter setzen als der Browser (vereinzelt früher abgeschnittene Texte mit „…“). Im Browser selbst prüfen: `kundenansicht/index.html`.

---
# V1.1 · 2026-09-27

## A · Pflicht-Nacharbeit (PL-Prüfung) – erledigt
| Nr | Befund | Umsetzung | Nachweis |
|---|---|---|---|
| **A1** ✔ | Touch < 48 px (Suchfeld 44, Lage-Filter 40, Logo-Knopf 36) | Tablet/Handy: Kopf-Suche `height:var(--touch)`, Logo-Knopf `min-width/min-height:48px`, Lage-Filter und Gesundheit `min-height:48px` | Messung im Browser: 0 Bedienelemente < 48 px auf allen 6 Touch-Bildern (Segmente/Checkbox-Häkchen ausgenommen, Ziel = ganze Zeile) |
| **A2** ✔ | Handy Lage-Filter nur Zahl + Farbpunkt | Handy zeigt Punkt + Zahl + Kurzlabel („Konflikte · Entscheidungen · Warnungen“), Filter umbrechen statt abschneiden; Gesundheit bricht innerhalb des Chips um | `kunde_*_handy_390x844.png` |
| **A3** ✔ | Kerninfo mit „…“ gekürzt | `.kr-hb-titel` und `.kr-ausgrau-text` brechen um (`text-wrap:pretty`), nur Meta-Zeilen kürzen; Gesundheits-Chips auf dem Handy umbrechend | Messung: 0 überlaufende Titel/Ausgrau/Lage-Elemente (9 Bilder); `kunde_rolf_handy_langer_titel_fokus.png` („Phillip abwesend ab 2026-10-05“), `kunde_gregor_*` („Microsoft-Verbindung abgelaufen“, „Personalkosten aus Gehaltsplanung (nur Summen)“) |
| **A4** ✔ | OF-22 ↔ OF-32 widersprüchlich | OF-22 an OF-32 (a) angeglichen: Firmengesundheit nur Zustandswort in der Lage-Leiste; bis M01–M03 „In Aufbau“ | `OFFENE_FRAGEN_DESIGN.md` OF-22 |
| N5 (optional) ✔ | Rolf-Handy: Schnellknöpfe vor Handlungsbedarf | Schnellknöpfe „Neuer Eingang · Ware raus“ stehen jetzt **nach** dem Handlungsbedarf (Tablet/Handy) – §6.1 Handlungsbedarf zuerst | `kunde_rolf_handy_390x844.png` |

## Übernommen aus V2 (mit Auflagen)
| Nr | Element | Auflagen erfüllt |
|---|---|---|
| **B1** | **Fokuseintrag**: dringendster offener Punkt oben, etwas größer (Titel 16,5 px statt 14), genau **eine** Hauptaktion + „Später“ + weitere (Handy: „Weitere“ als Text-Knopf); nach Erledigen rückt der nächste weich nach, Toast mit „Rückgängig“ (V1) | Reihenfolge Konflikt → Entscheidung → Warnung (V1-Sortierung) · **kein** Zähler „1/6“ · Höhe = 2 Listenzeilen + Aktionszeile · §6.2 Falz gemessen erfüllt (erster Tagesüberblick bei Rolf: Desktop 638 px < 917, Tablet 603 < 814, Handy 652 < 778) · Aktionstexte/Wirkung unverändert V1/V8 („Erinnerung vorbereiten“, „Kunde vorwarnen“) · keine Aussage „Entwurf liegt bereit“. Tablet zeigt wie Handy Fokus + 2, Rest über „N weitere“ (hält den Falz). |
| **B2** | **Befehlspalette „Suchen oder tun“** (Strg K, /, Kopf-Suchfeld) | Treffer mit Grund (`<mark>`) + Quelle wie V1-Suche · Aktionen nur aus V1: Neuer Eingang, Ware raus, Fertig melden, Mehrarbeit, Woche ansehen – jede öffnet den bestehenden V1-Ablauf · Plus-Menü bleibt · Phillip ohne Geld-Treffer (Rechnungstreffer entfällt) und ohne Geld-Aktionen · gesperrte Bereiche erscheinen nicht · ↑/↓, Enter, Esc |
| **B3** | **Karten als Seitenblatt** (Desktop/Tablet von rechts, Handy von unten; Hintergrund sichtbar, Klick daneben schließt) | Inhalt und Reihenfolge exakt Auftragskarte V8 / Kundenkarte V2 wie V1 · „Zurück · ‹Nummer/Kunde›“ bei Auftrag ↔ Kunde · Teile abhaken mit Fortschrittsbalken am Kettenschritt „fertig“ (Zahl „x von y Teilen“ nur einmal) · „Fertig melden“ bleibt Dialog mit den 3 Pflichtprüfungen (V5), danach Freeze: Teile-Knöpfe gesperrt |
| **B4** | **Tastatur Desktop**: j/k wählen · Enter = Hauptaktion · s = Später (Zeitwahl) · Esc hebt Auswahl auf | Enter löst exakt den Klick aus (gleiche Rückfrage/Rückgängig) · nicht in Eingabefeldern · nicht bei offenem Dialog/Palette · N und / wie V1 |
| **B5** | **Wischen** auf Touch: rechts = Hauptaktion (mit Rückgängig), links = Später (Zeitwahl V8 S1) | nur zusätzlich zu sichtbaren Knöpfen · nur Touch (Komponente prüft `pointerType==='touch'`; Kundenansicht simuliert auf Gerät Tablet/Handy) · **kein** Wischen für Freigaben (Preisfreigabe, Löschvorschläge) und Geld (Rechnung/Erinnerung, Liquidität) · Einträge ohne „Später“ nicht wischbar |
| **B6** | **Neuer Eingang auf einer Seite** (Desktop/Tablet): Abschnitte Kunde · Positionen · Prüfung, Schrittleiste = Sprungmarke; Handy behält 3 Schritte | Funktionsumfang V1 vollständig: Kunde bestehend/neu, KV oder Auftrag, 1–20 Positionen, Termin, Übergabe, Zahlungsmodus-Regel OF-18, Feldfehler (beim Buchen springt die Ansicht zum ersten Fehler), Rücksprung ohne Datenverlust, Buchen erst nach „gemeinsam geprüft“ |
| **C1** | **Zeitstrahl „Heute & Woche“** – **Owner 2026-09-27: übernommen als Standard** (Umschalter „Kacheln“ bleibt nur zum Vergleich in der Vorschau) | Knöpfe in der Zeile („Ware raus“) öffnen den bestehenden Warenausgang mit allen Prüfungen, Abholung mit Zahlungsbestätigung – kein Abschluss mit einem Tipp · Rolf: keine Beträge, kein Kassieren (nur Zahlungsmodus-Wort wie V1-Kachel) · Phillip: ohne jede Geld-Info („Freigabe fehlt · nicht rausgeben“) · Abwesenheiten, Bündelvorschlag, „Neu seit gestern“ bleiben · jeder Termin nur einmal (A-2026-0105 stand in V1 in Termine **und** Heute raus) · 7 Zustände im Katalog |

## Nicht übernommen – Grund
| V2-Element | Grund |
|---|---|
| Unterzeile Wochentag/Datum unter dem Seitentitel | §6.3 genau eine Überschrift, keine Unterzeile |
| Icon-Leiste ohne Beschriftung; Handy-Aktionen nur als Symbol | §6.4 Symbol nur **mit** Kurzlabel. V1-Shell bleibt: Seitenleiste V8, Dock „Der Tag · Aufträge · Kunden · Geld · Mehr“, feste Navy-Aktionsleiste bei Phillip |
| Dock ohne „Mehr“ | Einstellungen/Abmelden wären nicht erreichbar |
| „Später“ fest auf heute 14:00 | V8 S1 verlangt Zeitwahl; bleibt Menü (heute Fälliges nur bis zur Frist) |
| Fertig melden mit 2 statt 3 Pflichtprüfungen | V5 verlangt 3 Prüfungen vor Freeze |
| Firmengesundheit/Liquidität mit Werten ohne Anbindung | Schein-Aussage (G7); Werte nur im Umschalter „Ausbau M01–M03“ |
| Lage-Leiste, die auf dem Handy seitlich abgeschnitten wird | §6.4/A2; V1.1 bricht um |
| „Versenden“/„Übergeben“ als Abschluss mit einem Tipp | Warenausgang braucht Prüfungen (Fertigmeldung, Zahlung/Freigabe, Übergabe) |
| „Entwurf liegt bereit“, „Erinnerung senden“ | kein Dossier belegt einen fertigen Entwurf; V1/V8-Text „Erinnerung vorbereiten“ bleibt |
| Zähler „1 / 6“ am Fokus | Doppelung zur Lage-Leiste (§6.5) |
| dunkles Login, Glas-Dock, geänderte Formularoptik | keine Auflage erlaubt Optikwechsel; V5-Tokens/Machart V1 bleiben |

## Sichtprüfung V1.1 – `_pruefbilder/` (Bilder `v11_*`, Stand nach Owner-Runde 2)
Aufnahme im Browser als Element-Snapshot des Geräterahmens in exakter Pixelgröße (`kundenansicht/index.html`, Prüfmodus ohne Bewegung). Playwright stand in dieser Umgebung nicht zur Verfügung (OF-27 bleibt: PL wiederholt mit `ds_pw.js`). Zusätzlich im Browser gemessen: Touch-Ziele, abgeschnittene Kerninfo, horizontales Scrollen, Anzahl `h1`, Geld bei Phillip, Aktionsleiste.
Kriterien §6: **1** Handlungsbedarf zuerst · **2** Falz · **3** eine Überschrift · **4** keine Erklärtexte · **5** keine Doppelungen · **6** Kacheln/2 Zeilen/keine Riesenzahlen · **7** Leer/Fehler ehrlich · **8** Ausgrau nur Element · **9** Geld · **10** Galvanik ein Schritt.

| Bild | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | A1 | A2 | A3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| v11_rolf_desktop_1914x917 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ | – | – | ✔ |
| v11_rolf_tablet_1220x880 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ | – | ✔ |
| v11_rolf_handy_390x844 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| v11_phillip_desktop_1914x917 | ✔ | ✔ | ✔¹ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ | – | – | ✔ |
| v11_phillip_tablet_1220x880 | ✔ | ✔ | ✔¹ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ | – | ✔ |
| v11_phillip_handy_390x844 | ✔ | ✔ | ✔¹ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| v11_gregor_desktop_1914x917 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | – | – | – | ✔ |
| v11_gregor_tablet_1220x880 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | – | ✔ | – | ✔ |
| v11_gregor_handy_390x844 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | – | ✔ | ✔ | ✔ |
| v11_rolf_desktop_1914x917 zeigt Zeitstrahl (C1, Standard) | ✔ | ✔ | ✔ | ✔ | ✔² | ✔ | – | ✔ | ✔ | ✔ | – | – | ✔ |
| v11_rolf_desktop_befehlspalette (B2) | – | – | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ | – | – | – |
| v11_rolf_desktop_seitenblatt_auftrag_foto · _kunde_zurueck (B3, Foto-Knopf je Teil) | – | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ | – | – | – |
| v11_rolf_handy_seitenblatt_teile_foto (B3) | – | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ | – | – |
| v11_rolf_handy_langer_titel_fokus (A3/B1) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| v11_rolf_tablet_neuer_eingang_eine_seite (B6) | – | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ | – | – |

¹ „Heute sichern“ bleibt (Kanon Phillip V4, OF-02). ² Zeitstrahl führt Termine und Warenausgang zusammen; jede Auftragsnummer erscheint einmal.
Messergebnis (alle 9 Person×Gerät): Bedienelemente < 48 px auf Touch = 0 · abgeschnittene Titel/Ausgrau/Lage = 0 · horizontales Scrollen = nein · genau 1 `h1` · Phillip ohne €/Rechnung/Vorkasse/Zahlung im Inhalt · Aktionsleiste nur Phillip.
Katalog: im Browser prüfen (`katalog/index.html`, Umschalter 1914 · 1220 · 390); Vollbilder des Katalogs wurden für V1.1 nicht neu aufgenommen (Seite zu groß für die Snapshot-Aufnahme dieser Umgebung) – V1-Katalogbilder sind in `designsystem_v1/_pruefbilder/`.

---
# Owner-Runde 2 · 2026-09-27 (Chat-Rückmeldung zu V1.1)
| Wunsch | Umsetzung |
|---|---|
| In 2 Sekunden wissen, was jetzt zu tun ist; keine Auswahl, die zum Überlegen führt | Fokuseintrag zeigt nur **eine** Hauptaktion (größer, 52 px) + „Später“; alle weiteren Aktionen hinter „Weitere“ (Menü) – auf allen Geräten. Listeneinträge unverändert: Hauptaktion + Später. |
| So wenig scrollen wie möglich | Zeitstrahl ist Standard (eine Kachel statt zwei); Tablet/Handy zeigen Fokus + 2, Rest aufklappbar. Falz gemessen: erster Tagesüberblick Rolf Desktop 642 px, Tablet 615, Handy 665 (sichtbar bis 917 / 814 / 778). |
| Konflikte nie einklappen (Owner-Bedingung zu OF-37) | `HandlungsListe`: Konflikte bleiben immer sichtbar, nur Entscheidungen und Warnungen wandern in „N weitere“ (TSX + Vorschau). |
| Aufklapp-Knopf größer | „N weitere“: 56 px hoch, 14 px, weiße Fläche mit Rand statt gestrichelt. |
| Foto-Knopf direkt am Auftragsteil | `Teil` hat `onFoto`: Knopf „Foto“ (Handy: Symbol, 48 px) vor „fertig“ – Zustand festhalten, Ablage im Auftrag; im Katalog und in beiden Karten sichtbar. |
| Wischen auch per Klick | war bereits so: Wischen ist nur Zusatz zu den sichtbaren Knöpfen (B5). |
| Zeitstrahl übernehmen | Standard in der Kundenansicht (`tages=zeit`), OF-34 entschieden. |
| Phillip: Werkstatt im Vordergrund – Termintreue, Abläufe | Reihenfolge rechte Spalte / Handy: **Heute & Woche** (Termintreue) → **Zink-Lauf bündeln** (Ablauf) → **In Arbeit** → Abwesenheiten. Lage-Leiste nur Termintreue. Kein Geld. |
| Rolf: Betriebsführung | Lage-Leiste mit Termintreue + Liquidität, Handlungsbedarf mit Entscheidungen/Geld-Warnungen, dann Heute & Woche, Bündeln, Abwesenheiten, Neu seit gestern. |
| Hintergrund zu bräunlich, Karten „wie Marokko“, mehr Apple | Flächen neutralisiert (`tokens.css`, V1.1-Block): Grund #F4F2EE, Fläche #F7F6F3, Weiß #FFFFFF, Linien #E4E0D8, Ränder #D5D0C7. Karten-Körper und Dialoge weiß, Rail/Formulare hellgrau. Farbverläufe in Handlungsbedarf-Einträgen, Bündel-Vorschlag und „Nächste Aktion“ entfernt (nur farbige Kante). Navy, Signalfarben, Marken-Verlauf unverändert V5. **Abweichung von „Tokens wörtlich V5“ auf Owner-Wunsch – OF-41.** |

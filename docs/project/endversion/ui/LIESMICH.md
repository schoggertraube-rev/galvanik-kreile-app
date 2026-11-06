# UI-Wahrheit der Endversion (für Planungschat, Prüfchat, Codex)

Stand: 2026-11-03 (Runde 52 · V41) · Quelle: Owner-Vorschau (Endversion) · Hashes siehe codex/BAUPLAN.next.json → bauplan.ui

## Warum dieser Ordner existiert
Codex war bis jetzt an zwei UI-Wahrheiten gebunden: Designsystem V1.1 (tokens/komponenten) plus vier August-Seitenreferenzen und den V5-Gesamtmock für Abläufe. Der Look der Endversion (Der Tag, Auftragskarte, Teilkarte, Eingang, Werkstattkarte, Mehrarbeit, Warenausgang …) steckt aber in `groessen_v8.css`, `ui_ergaenzung.css` und ~60 KB Inline-Styles der Vorschau, die Codex nie bekommen hat. Ergebnis: die gebaute App sieht anders aus als die Vorschau. Dieser Ordner macht die Endversion zur **einzigen** UI-Wahrheit – inhaltsfrei (keine Musterdaten, keine Namen, kein Mock-Code).

## Dateien
| Datei | Was | Für wen |
|---|---|---|
| `endversion_design.css` | Ein CSS-Bündel: tokens + komponenten + groessen_v8 + ui_ergaenzung + Inline-Styles der Vorschau, Vorschau-Chrome entfernt (`#leiste`, `#geraet`, `.ka-*`, `.pk-*`, `.r36-chat*`). Ersetzt `designsystem_v1_1/komponenten.css` + eigene Nachbauten. | Codex (einbinden, nicht abschreiben) |
| `endversion_design.bericht.json` | SHA-256, Bytes, Quellen, Zahl entfernter Vorschau-Regeln, Musterdaten-Check = 0 | PL (Hash-Bindung) |
| `SICHTVERTRAG.json` | Je Seite × Rolle × Größe (desktop 1914×917, tablet 1220×880, handy 390×844): Ebene (Seite/Dialog), Fußzeile, **Hauptaktion** (Kennung, im Viewport ohne Scrollen, Höhe), alle Bedienelemente mit Kennung (`data-spec-id`, sonst Text-Slug), Tag, Art (kr-btn--…), Lage, Größe, Farbe, Schrift, Reihenfolge. Werte in `{…}` sind Platzhalter. 39 Seiten bzw. Modi × 3 Größen = 117 Einträge: alle 13 Paket-Seiten im Normalfall UND jeder Modus als eigener Eintrag (`modus`, `modus_titel`); `kopf` = Seitenname, der im Kopf stehen muss. | Codex (Soll), Prüfchat (Ist-Vergleich) |
| `pruefbilder/<screen>[__<modus>]_<rolle>_<groesse>.png` | 117 Prüfbilder der Vorschau, 1:1 zum Sichtvertrag (Modi mit `__modus`) | Owner/PL/Prüfchat (Sichtvergleich) |
| `pruefe_sicht.cjs` | Prüfskript: lädt die gebaute App je Seite/Größe und vergleicht mit dem Sichtvertrag: Element vorhanden (`data-spec-id`, sonst Knopftext), sichtbar, Reihenfolge, Höhe (min. Vorschau-Höhe bzw. 44 px), Farbe der farbigen Knöpfe, Hauptaktion im Viewport ohne Scrollen, **Kopf = Seitenname (+ Modus-Unterzeile)**. Ampel je Seite, Bericht `.json` + `.md`, Prüfbilder der App. Exit 1 bei Rot. | Prüfchat (vor jedem Teil-PR-Merge), Codex (lokal vor Abgabe) |
| `routen.beispiel.json` | Beispiel-Routen (hier: gegen die Vorschau selbst, Selbsttest 117/117 grün; Modus-Routen als `id#modus`). PL/Codex füllt `routen.json` mit den echten App-Pfaden; Zugangsdaten nur über `MEISTER_EMAIL`/`MEISTER_PASSWORT`, `WERKSTATT_EMAIL`/… (Umgebungsvariablen, nie Datei). | PL/Codex |

## Regeln (binden mit dem Bauplan)
1. **`data-spec-id` ist Pflicht** an jedem Bedienelement, das im Sichtvertrag eine Punkt-Kennung hat (`auftrag.teil.{teil}.fertig`, `teil.fehlt.foto`, `rauspruefen.uebergabe-bestaetigen` …). Platzhalter `{auftrag}`, `{teil}` werden mit dem echten Wert gefüllt. Elemente ohne Punkt-Kennung werden über den sichtbaren Text gefunden – Text also wörtlich wie im Sichtvertrag.
2. **Klassen wie in der Vorschau** (`kr-btn kr-btn--erledigen|primaer|sekundaer|leise|ton-blau`, `kr-dialog-fuss`, `kr-schritt`, `f2-teil`, `ev-ma-*`, `r36-k--*`, `r38-*`): das Bündel stylt sie; kein eigenes Nachbauen in Tailwind/shadcn.
3. **Hauptaktion** (farbiger Knopf) steht in Dialogen in der Fußzeile und ist auf allen drei Größen ohne Scrollen sichtbar; auf Listen-Seiten (Der Tag, Aufträge, Auftrag) ist sie pro Zeile/Teil und darf scrollen. Zeilen-Antippen öffnet das Objekt, nie die Aktion.
4. **Knöpfe ≥ 44 px** hoch (Vorschau 45–56 px); Rückfrage-Knöpfe 56–68 px.
5. Abweichung nur mit Grund in der Abgabe (`docs/delivery/ABGABE_*.md`) – und dann als Gelb im Prüfbericht sichtbar, nie still.
6. Neuer Stand: Endversion liefert Bündel + Sichtvertrag + Prüfbilder zusammen mit jedem BAUPLAN.next (Hashes im Bauplan unter `bauplan.ui`). PL bindet `CURRENT_DESIGN_REFERENCE.json` neu (Vorschlag: `CURRENT_DESIGN_REFERENCE.endversion.json`), Owner bestätigt.

## Aufruf Prüfskript
```
npm i -D playwright && npx playwright install chromium   # einmalig
MEISTER_NAME=… MEISTER_PASSWORT=… WERKSTATT_NAME=… WERKSTATT_PASSWORT=… VERCEL_SHARE=… \
node docs/project/endversion/ui/pruefe_sicht.cjs --app https://<preview>.vercel.app --routen docs/project/endversion/ui/routen.json [--nur eingang,auftrag]
```
Ergebnis: `pruefbericht.json|md` + `pruefbilder_app/`. Rot = nicht mergen.

## Was hier **nicht** liegt
Mock-Code (index.html, JS), Musterdaten, Kundennamen, Beträge – der Musterdaten-Check im Bericht steht auf 0 und ist Teil des Gates.

## Runde 51 (Owner 03.11.) – Namen und Aufrufe
- **Ein Name je Seite:** Kopf = `screens[].titel`; ein Modus ersetzt ihn nie, sondern steht als Unterzeile (`verhalten_appweit.seitenname`). Verbindliche Liste mit Einstiegen und Modi: `paket.seitenkatalog` im Bauplan.
- **Normalfall vs. Modus:** Soll-Bilder ohne `__modus` zeigen den Normalfall (so wie die App die Seite öffnet, z. B. 3.0 über das Plus); jeder Modus hat ein eigenes Bild. Frühere Soll-Bilder, die 3.0 als „Zettel lesen“, 3.1 als „Lieferant anlegen“ usw. zeigten, sind ungültig.
- **Seiten-Gate** der Endversion (vor jeder Lieferung): Kopf/Unterzeile, keine Roh-Platzhalter, kein Knopf doppelt, höchstens ein Hauptknopf im Fuß, 3.0 leer ohne Zuordnen-Knöpfe – über alle Paket-Seiten und Modi, Desktop und Handy.

## Runde 52 (Owner/PL 03.11.) – Größenregel U-240, Enter, PIN
- **Größe je Gerät** (`verhalten_appweit.groessenregel`): KrApp setzt `data-geraet` nach Breite (Handy < 768, Tablet 768–1279, Desktop ≥ 1280) und `data-groesse` = `v11` (Desktop, kompakt, `--touch` 40 px, Dialoge ≤ ca. 1100 px, Formulare zweispaltig) · `dicht` (Tablet: ≥ 44 px, zweispaltig, „Prüfliste & Hinweise“ oben einklappbar) · `v8` (Handy). Das Bündel stylt danach; Sichtvertrag und Prüfbilder sind je Größe neu.
- **Enter = nächstes Feld** (`verhalten_appweit.tastatur_enter`): im letzten Pflichtfeld Hauptaktion mit Tor. Reihenfolge je Seite: `SICHTVERTRAG.json → seiten[].fokus.felder`, `enter_bis` = letztes Pflichtfeld. `pruefe_sicht.cjs` drückt Enter vom ersten Feld bis dorthin und meldet Abweichungen rot.
- **Kopf-Soll**: Paket-Seiten = Seitenname; Objektkarten (4.1, 5.1, 4.2) zeigen den Objektnamen (`kopf_art`), übrige Seiten den Kopf wie in der Vorschau.
- **PIN-Anmeldung im Prüfskript** (PL 16:30): `routen.json` → `login.schritte` mit Platzhaltern auch im Selektor – `{rolle_person}` = `<ROLLE>_NAME`, `{passwort_ziffer_1…4}` = Stelle von `<ROLLE>_PASSWORT` – oder kürzer `["tippen", "[data-spec-id=\"login.anmelden\"] button:text-is(\"{ziffer}\")", "{passwort}"]`. Vercel-Freigabe: `VERCEL_SHARE` (oder `routen.share_env`) → erster Aufruf mit `?_vercel_share=`. Seiten mit `"pfad": null, "grund": "…"` erscheinen gelb mit Grund. Datei ohne `require()` (Module per `import()`), ESLint-recommended sauber – der Pfad `pruefe_sicht.cjs` bleibt.
- **Prüfung in der Endversion** vor jeder Lieferung: Selbsttest des Prüfskripts gegen die Vorschau (117/117 grün), UI-Gate (Desktop-Dialog > 1120 px rot, Knöpfe Desktop ≥ 38 px, Tablet/Handy ≥ 44 px, Fokusreihenfolge vorhanden), Seiten-, Musterdaten-, Klick-, Referenz-, Stand-Gate.

## Runde 53 (Owner 05.11.) – Was ist das?, konkrete Texte, Leer-Zustand
- **Leer-Zustand je Paket-Seite** (PL 04.11. 13:30): Sichtvertrag hat im Normalfall zwei Einträge – `zustand: "leer"` (so öffnet die App die Seite; Route = Seiten-ID in `routen.json`) und `zustand: "beispiel"` (Route `{id}@beispiel`, optional – fehlt sie, ist das Ergebnis gelb, nicht rot). Ausgenommen 3.0, 3.6, M6. Prüfbilder: `{screen}__leer_{rolle}_{groesse}.png`.
- **3.0 Modus `unklar`** (U-241): Route `rein#unklar`. Rechte Spalte: Kopf → „Was ist das?“ mit 4 Kacheln (`rein.unklar.auftrag|ware|rechnung|dokument`) → „Später zuordnen“ → feste Wege („Original ansehen“). Keine Erkannt-Zeilen, keine Kacheln „Erwartete Ware“.
- **Konkrete Texte** (U-242, `verhalten_appweit.texte_konkret`): kein Status, Chip oder Knopf mit Floskel allein („prüfen“, „entscheiden“, „fehlt“, „Konflikt“, „Weitere“ …). Der Tag: „blockiert“ · „wird knapp“ · „wartet auf dich“. Seitennamen und Rechte-Namen bleiben. Das **Floskel-Gate** der Endversion prüft Sichtvertrag und alle Klickwege vor jeder Lieferung.

## Runde 54 (Owner/PL 05.11.) – AP-ABS, Paketfolge
- **Paket-Seiten = AP-EIN + jedes Paket mit `status: "bereit"` in `baustand.paket_folge`** (eine Liste für Sichtvertrag, Prüfbilder, Seiten-Gate und `routen.json → vor`). Neu: 5.4 `absprache` mit `absprache` (leer), `absprache@beispiel`, `absprache#aendern`, `absprache#widerruf`.
- `routen.json` der App braucht für 5.4 die Routen wie bei den AP-EIN-Seiten (Seiten-ID = leer; `@beispiel` optional, sonst gelb).
- „Was ist neu?“ (nur Vorschau): Zahl = Punkte der letzten Lieferung, oben in der Liste immer sichtbar; abgehakt = grau. Das Seiten-Gate prüft Zahl = Liste (auch „alles abgehakt“).

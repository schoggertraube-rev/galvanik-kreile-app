<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G08_SUCHE — Optikvorlage

## Verbindliche Referenzen

| Referenz | SHA-256 (12) | Relevanter Anker | Verwendung |
|---|---|---|---|
| `02_app/docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json` | `CDB573268ABB` | `currentDesignReference`, `pageTruthReferences` | bindet V5 und die vier Seitenwahrheiten |
| `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` | `75258FF3BD4C` | `searchModal`, `renderSearchResults`, globaler `Ctrl/Cmd+K`-Handler | Ablauf, Modal, Ergebnisgruppen, Nullzustand; Demodaten nie übernehmen |
| `02_app/docs/project/linie/ui/KREILE_STARTSEITE_ROLF_V8_2026-08-20.html` | `878FAD351778` | Kopfzeile/Suchfeld „Auftrag, Kunde oder Nummer suchen“ | Rolf-Desktop-Seitenwahrheit |
| `02_app/docs/project/linie/ui/KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html` | `B3370C79A0FD` | kompakte Kopfzeile/Suchfeld „Auftrag oder Nummer suchen“ | Phillip-Seitenwahrheit |
| `02_app/docs/project/linie/ui/KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html` | `C4F74528ED4D` | Auftragskarten-Overlay | Ziel eines ORDER-Treffers |
| `02_app/docs/project/linie/ui/KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html` | `8B655B19B5DB` | Kundenkarten-Overlay | Ziel eines CUSTOMER-Treffers |

V5 ist Ablaufreferenz, die vier Einzeldateien bleiben Seitenwahrheit. V2/V3/V4-Gesamtmocks und V6 sind kein Bauinput. Die HTML-Demodaten sind ausschließlich visuelle Referenz.

**V5-Prüfhash vollständig:** `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`.

## Screen-Matrix

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| Globaler Suchtrigger in der Ziel-Kopfzeile | eingebettetes Suchfeld oder klarer Trigger mit Shortcut-Hinweis | kompakter Trigger in der Topbar | 48-px-Suchaktion in Topbar/Mehr-Kontext, ohne horizontales Quetschen | Daten: V5; gesperrt/In Aufbau fehlen → Designphase 1 | Rolf V8, Phillip V4, V5 `Ctrl/Cmd+K` |
| Suchdialog | zentriertes Modal, Hintergrund gedimmt, max. sinnvolle Lesebreite | modal innerhalb des sichtbaren Frames | nahezu vollflächig mit sicherem Rand und erreichbarer Schließen-Aktion | Daten und leer: V5; lädt/Fehler/gesperrt/In Klärung/In Aufbau fehlen → Designphase 1 | V5 `searchModal` |
| Trefferliste | gruppierte, scanbare Zeilen mit Quelle, Treffergrund, Kontext und Öffnen-Aktion | gleiche Informationsreihenfolge, Umbruch statt Abschneiden | einspaltig, gesamte Zeile 48-px-Touchziel | Daten: V5 + Ist-Code; übrige → Designphase 1 | V5 `renderSearchResults`; `SearchDialog.tsx` |
| Nullergebnis | Erklärung, geprüfte Quellen und sichere Alternativen | identischer Inhalt ohne Seitwärts-Scroll | kurze, gestapelte Textblöcke | leer: Ist-Code belegt; V5-Text ist visuelle Referenz, nicht Runtime-Wortlaut | `SearchDialog.tsx`; V5 `Nichts Eindeutiges gefunden` |
| Auftrags-/Kundenkarte aus Treffer | V8/V2 als Overlay, Suchkontext darunter erhalten | derselbe AppAdapter responsiv | derselbe AppAdapter responsiv, Zurück erreichbar | Daten: Kartenreferenzen; Laden/Fehler/gesperrt fehlen → Designphase 1 | V8/V2; D-UI-CORE-002 |
| Verschachtelter Backstack | Ebene für Ebene, keine zweite Karte/Route | gleiches Verhalten | gleiches Verhalten mit nur einer sichtbaren obersten Ebene | Daten teilweise belegt; Filter/Scroll und Fehlerzustände fehlen → Designphase 1 | D-UI-CORE-002; `EntityOverlayStack.p3.test.tsx` |

## Layout- und Interaktionsregeln

- Suche ist Teil der App-Komposition, keine eigene Produktseite und kein Schattenmodul.
- Dialog und Karten verwenden die eine Shell; keine Alt-Sidebar, kein Stationsband und keine eigenständige Suchroute mit zweiter Navigation.
- Treffer zeigen zuerst Titel, dann fachlichen Kontext, danach Belegzeile; nie nur eine nackte ID.
- Fokus bleibt sichtbar; Pfeil hoch/runter ändert `aria-selected`, Enter öffnet, Escape schließt genau die oberste Ebene.
- Trefferzeile und Schließen-Aktion besitzen mindestens 48×48 px Touchfläche.
- Auf Handy darf kein horizontaler Scroll entstehen; lange Titel und Kontextwerte brechen kontrolliert um.
- Kappung und Fehler stehen im Lesefluss und werden nicht nur farblich vermittelt.
- „In Klärung“ und „In Aufbau“ sind gedämpft, nicht klickbar und besitzen keine Route.

## Designsystem-Gate

**Designsystem-Bausteine (`kr-`): wird nach Phase 1 ergänzt.**

Bis dahin werden aus V5 nur Layout, Informationshierarchie und Verhalten abgeleitet. Die heutige `SearchDialog.module.css` ist Ist-Code und keine freigegebene Zielgestaltung. Es werden weder deren Farben noch CSS aus V5 kopiert. Ziel ist ein System mit Fraunces + Inter, Navy/Cream/Brand-Verlauf, klaren Fokuszuständen und mindestens 48 px Touchzielen.

## Fehlende Designbelege

- vollständige Varianten für lädt, Fehler, gesperrt, In Klärung und In Aufbau: `fehlt → Designphase 1 / Q-G08-003`;
- Fokus-Rückkehr und verschachtelte Karten auf Handy: `fehlt → Designphase 1`;
- Long-content/Zoom-200%-Verhalten: `fehlt → Designphase 1`.

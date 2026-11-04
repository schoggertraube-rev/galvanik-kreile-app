# AP-EIN Teil 1 · Kunde, Runde 52

Draft #167 auf Teil 0b. **Noch nicht merge-reif.** Produkt-SHA: `3818e7345b4eacc1169d5f08de9250988d28af2e`.

READY-Preview genau dieses Produkt-SHA: https://galvanik-kreile-werkstatt-qambwh8d2.vercel.app (Vercel `dpl_BeDHcbnuatiH24pFSXgAhUw8vXZA`, GitHub-Deployment `7539578678`). Kein Merge und kein Production-Deploy durch Codex.

## Sichtbare Umsetzung

- Eine Kunden-Komponente für 3.1 und 5.2; Original-CSS eingebunden, keine kopierte Layout-/Farbschicht. Firmen-/Privatfelder, getrennte Namen, Kontakt, Anschrift, Zahlung und Auftragsstandards behalten ihre bestehenden Actions.
- Desktop kompakt, Tablet dicht mit oben einklappbarer „Prüfliste & Hinweise“, Handy V8. Erfassung und überlagerte Kundenkarten verwenden denselben Gerätekontext, auch beim Portal. Fundstelle: `src/ui/kr/AppShell.tsx:87`, `src/components/layout/EntityOverlayStack.tsx:18`.
- Pflicht und „für Auftrag“ werden nach dem Formularvertrag getrennt bezeichnet; ein Privat-Vorname wird nicht als zwingende Speicherpflicht ausgewiesen. Gemeinsame Validierung und Vollständigkeit bleiben bestehen. Fundstelle: `src/modules/customers/ui/KundeFormular.tsx:89`.
- Im normalen Bearbeiten bleibt die Feldreihenfolge erhalten. Nur beim Aufruf zum Ergänzen werden fehlende Felder oben priorisiert. Fundstelle: `src/modules/customers/ui/CustomerEditor.tsx:38`.
- Enter benutzt denselben gegateten Hauptknopf wie der Klick. Mehrzeilige Eingaben behalten den Zeilenumbruch; vorhandene Suche-/Segment-Tastenbehandlung und oberste Esc-Ebene bleiben bestehen.

## Eine Datenwahrheit

Anlage: createCustomerAction → createCustomerCommand → private.create_customer_v2. Bearbeiten, Notiz und Zahlungsdaten: updateCustomerAction → updateCustomerCommand → private.update_customer_v1. Die abgelösten Commercial-/Note-Actions und SQL-Funktionen wurden im selben Teil entfernt. Kundenkarte, Eingang, Suche und neue Belege lesen getrennte Namen, kanonische Länder-/Zahlungsschlüssel und die eine kundeVollstaendigkeit. Historische ausgestellte Belege bleiben unverändert.

DB-Soll: Kundenzeile und zugehöriges Ereignis entstehen einmal, danach wird dieselbe Kundenzeile frisch gelesen. Kein paralleler Kunden-Writer und keine Ergänzung lokaler Kundenfelder im Auftragseingang.

## Prüfungen und Grenzen

P50: Auf Teil 0b `c80cd496` neu gestapelt. K22 ist wie E09 mit `Endversion-Angleich U-240` eingeordnet; K24 gehört zur bereits im Folgeteil implementierten echten Visitenkartenaufnahme (AP-EIN-2). TA14 bleibt an diesem Teil-1-Stand ohne Marker: Der vollständige CI-Lauf `41785967514` bestand ihn bereits. Keine neue Produktdatei oder Fall-Assertion wurde für diese Einordnung geändert. Der unveränderte Original-Sichtbericht unten bleibt 3× Rot: Er prüft bedingte Erkannt-/Typ-Felder am leeren Formular. Der Konflikt mit der nach P50 erlaubten Gelb-Begründung `Zustand leer vs. Prüfbild-Beispiel` ist in NACHTLAUF C gemeldet; kein künstliches Vorbelegen und keine Ersatzknöpfe.

- Frischer lokaler Supabase-Replay und Produktions-Build: PASS; Test-Ziel ausschließlich 127.0.0.1:54322. P47 erlaubt die additive Dev-Migration vor dem Merge: Die K1-/ein1-Dateien wurden nach erzwungenem Rollback-Probelauf unverändert angewendet und sind eingefroren. Dev hat 70 Migrationen einschließlich des nachfolgenden Teil-2-Schemas; alle 69 Migrationen dieses Teil-1-Branches sind enthalten. Der Gleichstand 70/70 wurde am Teil-2-Branch belegt. Kunden/Aufträge/Positionen/Eingänge blieben bei 13/12/14/8, keine Testbuchung auf Dev.
- Unveränderter fester Kunden-Vertragstest: **10/10 PASS** (echte Actions, DB-Zeile, frisch gelesener Vertrag). Bestehende Kunden-/GlobalCreate-realRender-Fälle: **46/46 PASS**.
- A11: **22/22 PASS**. Nach den gezielten Änderungen Typprüfung und Lint der geänderten Dateien erneut PASS; unveränderte breite Läufe wurden nicht wiederholt.
- P49: Ein vollständiger Lauf der **63** festen Kundenfälle ergab tatsächlich **52 grün / 11 rot**. Nach genau einer Korrektur der gefundenen Ursachen bestehen zusätzlich **B02, B03, B04, B09, Q05, K04, K08, K26 und KK02**; abschließender Karten-Ebenenlauf K08/KK02 nochmals 2/2 grün. Damit **61/63 grün, zwei offen**. Die Tests rufen die tatsächlichen Actions auf und prüfen die Replay-Zeilen und frisch gelesenen Ansichten; keine DB-Mocks.
- Aus der Rotliste wurden genau 39 nun belegte Erfolge entfernt. Zusätzlich wurde die ausdrücklich freigegebene P46-Ausnahme E09 (`Endversion-Angleich U-240`) auf diesen älteren Teil-Branch übernommen: netto **247 → 209**. Keine Assertion und keine erzeugte Testdatei geändert.
- **K24 offen:** Visitenkarten-Aufnahme/Übernahme benötigt den echten 3.0-Erfassungsweg aus Teil 2. Es gibt in Teil 1 keinen wirkungslosen Scan-Ersatzknopf. Der bereits im Teil-2-Branch angeschlossene Weg wird nicht ein zweites Mal gebaut.
- **K22 offen:** Der feste Fall verlangt Speichern bei Enter im Feld Ort. U-240 verlangt das nächste Feld und Speichern erst im letzten Pflichtfeld; der gemeinsame Tastaturvertrag bleibt unverändert. Entscheidung im Planungschat angefordert, Test unverändert rot.
- P43 ist umgesetzt: Gewählte Zahlung nutzt die vorhandenen Bündel-Tokens für Erfolg-Grün; leer bleibt neutral. Das CSS-Bündel und der Sichtprüfer sind unverändert. Die abweichende Fokus-Kennung `firmenname` gegenüber der Pflichtkennung `kundeneu.name` bleibt gemäß P43 ausdrücklich gelb.
- Neuer CI-Lauf `41785546204` für den Produkt-SHA wurde gestartet; bei dieser Abgabe waren agentur-gate/h16-schema noch laufend. Keine vollständige grüne CI behauptet. Der vorherige Lauf `41721626189` war rot im Schritt „Generated BAUPLAN flows against replay DB“; dazu gehörten 30 bereits funktionierende Kundenwege mit veralteten Rot-Markern sowie technische Ebenen-Timeouts. Die übrigen Schritte waren grün. Endstatus wird nach tatsächlichem Lauf in NACHTLAUF C/PR nachgeführt.

## Bestehende Prüfungen: alt → neu

Keine feste Akzeptanzdatei und kein Owner-Modellfall geändert. Im gemeinsamen Gerüst:
- DB-JSON-Prädikat: doppelt kodierter JSON-Parameter → explizit Text, dann JSON; dieselbe Zeile muss weiterhin genau einmal mit allen verlangten Werten vorhanden sein.
- 5.2-Aufruf: URL-Navigation mit wirkungslosem Fragment plus zusätzlichem Bearbeiten-Klick → vorhandener `kreile:oeffne`-Aufruf mit unverändertem `{kunde}#fehlend`/`#uebernahme`. Das Modell verlangt genau diesen Öffnen-Aufruf; der bestehende Produktadapter bleibt unverändert.
- Optionen: gesamter Kartentext einschließlich Beschreibung → zugänglicher Optionsname; Anzahl, Namen und Reihenfolge bleiben exakt.
- Sichtbarer Text: implizite Locator-Eindeutigkeit trotz legitimer Beschreibung → erster sichtbarer Texttreffer; ausdrückliche Anzahlprüfungen bleiben unverändert.
- Auswahlfarbe: sofortiger Zwischenwert während CSS-Transition → exakt dieselbe Sollfarbe nach der Transition, ohne Toleranz oder entfernte Farbprüfung.
- Oberste Seite: Kennung nur unterhalb des Dialogs bzw. einmal während des Ladezustands gesucht → dieselbe Kennung am aktuellen obersten Dialog ODER darin mit automatischem Warten auf das tatsächliche Ladeende. Keine Suche in einer Hintergrundebene, keine abgeschwächte Ebenen-Assertion.
- P39: geprueft direkt aus der DB-Spalte statt aus der bloßen Existenz eines Anlageereignisses.

## Bytegebundene Migrationen und Tests

| Datei | SHA-256 |
|---|---|
| `supabase/migrations/20261103032000_b2_kunde_k1.sql` | 501FC772832FBF6CD8F653B71F9E9AFCA720006469A488EA4920CEBD04BEE60E |
| `supabase/migrations/20261103032001_ein1_kunde_schreibweg.sql` | D9BD01A7DFAB6FB77E91DCFBC2C53C6920337A12A0DF3D332C99589330F3706A |
| `src/test/acceptance/apk1_kunde_datenvertrag.integration.test.ts` | 0EE82CF1A7A0980A50AA342C37B8B861047ABD9361BE5ADC08613F11CEC93072 |
| `src/test/acceptance/ap01_eingang_paket_persoenlich.integration.test.ts` | 1B414E327D6A60EFE1DDFD6080AE2A22E2AD0A72E03503DEEAF19A606DBE425A |
| `src/test/acceptance/ap01b_eingang_bestandskunde_unvollstaendig.integration.test.ts` | 198C039878FB6080BE34DD54E3A2467779A083E008D2D3626888C900FE4D5823 |
| `src/test/acceptance/ap01c_eingang_kundenvorschlag.integration.test.ts` | B33A375E1B2F75E2A001B532791C796DA67245578EB9F686E63132BD476C4059 |
| `src/test/acceptance/ap01d_eingang_f43.integration.test.ts` | A573C670924ABAC41F17724B451EBA9D81F761D3A856C7191F5E0C01E0491CCF |

Die früheren einzelnen AP-01-Läufe (19/19 im Runde-51-Vorbau) sind historische Zusatzbelege. Sie werden nicht als neuer Runde-52-Lauf ausgegeben; die Dateien bleiben hier bytegleich.

## Sichtnachweis und Owner-Klickweg

Originaler Prüfer FDA7C59C auf der oben genannten READY-Preview, `--nur kundeneu,kundebearbeiten`, gegen Dev mit 70 Migrationen: **9 Ansichten, 0 grün / 6 gelb / 3 rot**. Bericht und Bilder außerhalb des Repositorys:

`C:/Users/Traube/.codex/visualizations/2026/11/03/01a1a122-06c4-7570-a4d3-dc1eedb311aa/sicht-3818e734-kundeneu-kundebearbeiten/`

- Kunde anlegen: 8/19 Elemente gefunden, sieben rote Befunde je Größe. Der normale Aufruf ist leer und hat noch keinen Kundentyp/keine erkannten Vorschläge; der gebundene Bildzustand erwartet bereits Firma, Anrede, Übergabe und „Alles bestätigen“. Zusätzlich fehlt auf diesem Teil-Branch der wirkliche Visitenkarten-Weg. Kein Vorbelegen mit Musterdaten, kein Umgehen des Prüfers.
- Kunde bearbeiten: 15/15 Elemente gefunden, kein roter Befund. Gelb: Der tatsächlich gelesene Dev-Kunde ist privat statt Firma und hat keine gewählte Anrede; deshalb unterscheiden sich die Auswahlfarben vom gebundenen Firmen-Bild. Zusätzlich die gemäß P43 bekannte Fokus-Kennung.
- Lieferantenmodus: Der in der gebundenen Routendatei noch fehlende Einstieg ist gelb. Der tatsächliche Einstieg gehört zur Eingangsrechnung in Teil 5; kein zusätzlicher öffentlicher Test-Einstieg gebaut.

Klickweg nach Freigabe des Sicht-/DB-Stands: Preview → bestehendes Profil anmelden → Plus → Kunde anlegen → Firma/Privat und Kontakte prüfen → Abbrechen/×/Esc; danach Kunden & Kontakt → vorhandenen Kunden öffnen → Bearbeiten. Desktop, Tablet und Handy zeigen denselben Datenvertrag. Ein Speichertest in Dev wird nicht ohne die entsprechende Freigabe durch diesen Build vorgenommen.

Offene Quellen-/Abhängigkeitsfragen und der abschließende CI-Status werden ausschließlich in NACHTLAUF C gemeldet. Vor grünen eigenen Fällen und einer zulässigen Sicht-Abnahme kein Owner-Klicktest und kein Merge.

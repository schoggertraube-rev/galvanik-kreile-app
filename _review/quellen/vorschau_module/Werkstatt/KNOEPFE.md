# Vorschau-Modul Werkstatt-Übersicht – Knöpfe und App-Wege

Öffnen: `index.html` (eigenständig, Teststand `kreile-vorschau-modul-werkstatt`; enthält KV-, Eingang- und Anliegen-Schicht unverändert). Prüfwege: Vorschauleiste → „Prüfwege Werkstatt“.

Grundlage: V04 `renderWorkshop/workCard/buddyOrder`, Auftrag V04 §2 (Werkstatt), §7 (Projektion), §5 Nr. 12. Auftrags-, Kunden- und Teilkarten in dieser Vorschau sind die V04-**Testkarten**; im Produkt öffnen `openOrder`/`openCustomer` (`EntityOverlayStack.tsx`), Teilchip springt bis zur gebundenen Teilkarte in die Auftragskarte an die Position (`EntityOverlayStack.tsx:15`).
App-Weg Übersicht: `src/modules/werkstatt/ui/WerkstattView.tsx`, `deriveWerkstattView.ts`, Ports `werkstatt/server/types.ts:55-61`; Projektion `WerkstattSurfaceOrder` (`types.ts:2-18`) erweitern (nur Lesen, keine neue Tabelle).


**App-weite Regel (Owner 07.11.):** Die App stellt keine Zuordnungs- oder Art-Fragen („Wem gehört das?“, „Was ist das?“, „Welcher … ist gemeint?“, „zu welchem Auftrag?“). Sie schlägt den wahrscheinlichsten Weg mit Grund vor (ein Hauptknopf), Alternativen stehen daneben. Grundlage der Vorschläge: Name/Adresse/Nummer im Text, Thread-Bezug, frühere Aufträge/KVs mit gleichem Teil, erwartete Ware, Ankündigungen. Ohne belastbaren Grund kein erfundener Treffer.

## Filter-Abbildung

| V04-Filter | ersetzt V43-Gruppe | Inhalt |
|---|---|---|
| Alle | – | alle außer übergeben, auch „Ware erwartet“ |
| Wartet bei Annahme | Im Lager | Ware im Haus, noch nicht in der Galvanik |
| In Galvanik | In Galvanik | in Arbeit |
| Fertig im Haus | Fertig | fertig, bis zur Übergabe (Unterfilter Abholung/Versand, Zahlung) |
| Übergeben | – | Ware hat das Haus verlassen |

## A. Kopf und Kachel

| Knopf / Element | Nächster Zustand | App-Weg (Projektion §7 / Befehl) | Stand |
|---|---|---|---|
| Suchfeld (Kopf) | filtert Aufträge, Kunden, Teile, Kisten | Suchleiste | vorhanden |
| Auftrag öffnen / scannen | Dialog: Nummer, Kiste oder Kunde tippen bzw. Etikett scannen; eindeutige Nummer öffnet direkt | Suche + Scan → `openOrder` | teilweise |
| Etikett scannen · Test | simuliert Scan | Vorschau-Gerüst | – |
| Filter Alle … Übergeben, Sortieren | siehe Abbildung | `deriveWerkstattView.ts` | teilweise |
| Spotlight-Knopf (dringendster Auftrag) | nächste Handlung dieses Auftrags | wie Kachel | vorhanden |
| Auftragsnummer / Titel | Auftragskarte | `openOrder` | vorhanden |
| Kundenname | Kundenkarte | `openCustomer` (neu: `customerId` in der Projektion) | fehlt (Feld) |
| Termin rechts + „· zugesagt/Vorschlag“ + „· noch N Arbeitstage“ | Termintreue sichtbar | Projektion `due`, `confirmed` | teilweise |
| Teilchip „T1 · 1/2 …“ | Teil-Dialog (Produkt: Auftragskarte an der Position) | Positionen mit Fortschritt | fehlt (Feld) |
| „Mehrarbeit {ist} Min. von {spielraum}“ (gelb bei Überschreitung) | Hinweis | Mehrarbeit Ist/Spielraum | fehlt (Feld) |
| „Nacharbeit · {RK}“ | Kennung | `source='REKLAMATION_NACHARBEIT'` (heute nur am Titel) | fehlt (Feld) |
| „x von y fertig · Basiszeit / KV“ + Zeit „Ist / Plan“ | Fortschritt und Aufwand | Planaufwand + AZ | teilweise |
| AZ | Tageszeit am Auftrag | `arbeitszeit_buchung` ohne Schreibbefehl – **Owner-Frage F1** | fehlt |
| Mehrarbeit | Mehrarbeit-Dialog (Antippen +5 Min., Spielraum, Freigabe) | `changeOrderItemExtraWorkAction` | teilweise |
| Nächste Handlung (z. B. „In die Galvanik nehmen“, „{Teil} bearbeiten“, „Fertig melden“, „Freigabe anfragen“, „Rücklauf/Wareneingang aufnehmen“) | jeweiliger Dialog | `transitionWareneingangToGalvanikAction`, `setOrderItemFinishedAction`, `saveGoodsReceiptAction` | vorhanden |
| Ware raus · Abholung/Versand abschließen | Übergabe (Dienst/Person, Nachweis, Menge) | Warenausgang `recordGoodsOut` | vorhanden |
| Fertigmeldung mit Rechnung öffnen / Zahlungseingang belegen | Ausgang (Rechnung, Kundeninfo, Zahlung) | Rechnungen/Zahlungen (vorhanden), Dialoge 4.x | vorhanden |
| Alle Aufträge zeigen (leere Ansicht) | Filter „Alle“ | – | vorhanden |

## B. Kundenanliegen am Auftrag (Korrektur 12)

| Knopf | Nächster Zustand | App-Weg | Stand |
|---|---|---|---|
| Terminfrage beantworten / Reklamation {RK} öffnen / Reklamation aufnehmen / Kundenanliegen öffnen (ein Anliegen) | Nachricht **im Overlay über der Werkstatt**; alle Knöpfe des Anliegens (siehe Modul Anliegen) | offene Anliegen je Auftrag in der Projektion; Overlay über `EntityOverlayStack` | fehlt |
| {n} Kundenanliegen öffnen (mehrere) | Liste aller offenen Anliegen des Auftrags (Termin, Reklamation, Hinweis …) → je Anliegen öffnen | wie oben | fehlt |
| Zurück | zurück zur Liste bzw. zur Werkstatt – nie nach Nachrichten | Overlay-Stapel | fehlt |

## Änderungen gegenüber V04 (nichts entfernt)

1. Kachel ergänzt: „noch N Arbeitstage“, „x von y fertig“, Mehrarbeit-Chip, Nacharbeit-Kennung, „Ware raus · …“ als Text der Abschlusshandlung.
2. „Kundenfrage beantworten“ (nur Termine, sprang nach Nachrichten) → alle offenen Anliegen des Auftrags im Overlay, Zurück zur Werkstatt.
3. Kopf: „Auftrag öffnen / scannen“.
4. Testbestand: Hinweis-Nachricht zu K-26-1048, Mehrarbeit 15 Min. bei K-26-1050.

Entfallen: nichts.

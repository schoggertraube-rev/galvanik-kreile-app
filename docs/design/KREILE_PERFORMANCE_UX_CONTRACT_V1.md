# KREILE Performance UX Contract V1

**Mission:** `KREILE-PERFORMANCE-UX-CONTRACT-V1`
**Route:** `/performance`
**Modus:** Designvertrag; keine Implementierung, keine Datenbankänderung, kein MCP
**Primärnutzer:** Rolf Kreile
**Primäres Gerät:** Desktop
**Status:** Verbindliche Grundlage für die manuelle Umsetzung in Figma

## 1. Zweck und unverrückbare Leitplanken

Die Performance-Oberfläche beantwortet in höchstens zehn Sekunden:

1. Wie steht die Werkstatt jetzt?
2. Was ist konkret problematisch?
3. Welche Aufträge sind betroffen?
4. Wie ist jede Aussage belegt?
5. Welche reale Handlung kann Rolf als Nächstes ausführen?

Die bestehende App-Shell, Sidebar und Navigation bleiben unverändert. Dieser Vertrag beschreibt ausschließlich den Inhaltsbereich der bestehenden Route `/performance` sowie deren bestehende Drill-/Overlay-Ebene.

Die Oberfläche ist eine lesende Führungsansicht. Sie macht Rolf nicht zum Analysten und Philipp nicht zum Büroanwender. Sie enthält keine Planung, Bearbeitung, Zuweisung, Kapazitätssteuerung oder Konfliktlösung.

### 1.1 Verfügbare Datenwahrheit

| Aussage | Kanonische Bedeutung | Scope |
|---|---|---|
| Termintreue | Anteil pünktlich abgeschlossener Aufträge an allen im Zeitraum abgeschlossenen Aufträgen mit explizitem Zusagetermin | gewählter Abschlusszeitraum |
| Ø Durchlaufzeit | Durchschnitt der Kalendertage zwischen bestätigtem Auftragseingang und Abschluss | gewählter Abschlusszeitraum |
| Abgeschlossene Aufträge | produktive Aufträge mit Abschlusszeitpunkt im Zeitraum | gewählter Abschlusszeitraum |
| Offene Aufträge | produktive, nicht abgeschlossene und nicht stornierte Aufträge | aktueller Datenstand |
| Überfällige Aufträge | offene Aufträge mit explizitem Zusagetermin vor dem Berechnungszeitpunkt | aktueller Datenstand |
| Ohne Zusagetermin | offene Aufträge ohne expliziten Kundenzusagetermin | aktueller Datenstand |
| Aufträge je Station | offene Aufträge mit exakt dieser aktuell gespeicherten Stationszuordnung | aktueller Datenstand |
| ClaimEvidenceV1 | Formel, Scope, Einzelquellen, Coverage, fehlende Eingaben, Quellenlinks und Berechnungszeitpunkt | je Kennzahl |

### 1.2 Nicht verfügbare Aussagen

Diese Inhalte dürfen weder als Zahl noch als Visualisierung, Badge, Vergleich, Empfehlung oder aktive Funktion erscheinen:

- historischer Verlauf,
- Vorperioden- oder Vorjahresvergleich,
- Werkstatt-Score,
- Wochenziel,
- Stationskapazität oder Auslastung,
- Stationswartezeit,
- Engpassscore oder Engpass-Ranking,
- wirtschaftliche Engpasswirkung,
- KI-Empfehlungen,
- Offline-Datenzustand,
- Konfliktlösung,
- Realtime- oder Live-Daten.

### 1.3 Verbindliche Begriffe

| Datenzustand | Exakter sichtbarer Begriff | Niemals verwenden |
|---|---|---|
| Zahl vollständig belegt | Wert ohne Zusatz oder „Belegt“ in der Datenbasis | „geschätzt“ |
| geprüfter Scope enthält keinen Treffer | `0` plus „Im geprüften Bereich keine Datensätze“ | „unbekannt“ |
| Wert ist `null` | „Nicht berechenbar“ | `0`, `0 %`, `0 Tage` |
| notwendige Eingabe fehlt | „Angabe fehlt“ | „Keine Daten“ ohne Grund |
| Fachvertrag fehlt | „Noch nicht verbunden“ | „Bald verfügbar“, wenn kein Vertrag besteht |
| Detailnachweis ist begrenzt | „Nachweis teilweise verfügbar“ | „vollständig belegt“ |
| neue Abfrage läuft | „Daten werden aktualisiert …“ | „Live“ oder „Realtime“ |
| Aktualisierung scheitert, Altstand bleibt | „Letzter bestätigter Stand vom …“ | „aktuell“ |
| offene Aufträge je Station | „Aufträge an dieser Station“ | „wartend“, „Auslastung“, „Kapazität“ |
| regelbasierter Hinweis | „Hinweis aus Terminregel“ | „KI-Empfehlung“ |

## 2. Informationsarchitektur

### L1 — Überblick

Schnelle Lage, klar getrennt in:

- **Abschlüsse im gewählten Zeitraum:** Termintreue, Ø Durchlaufzeit, abgeschlossene Aufträge.
- **Aktueller Werkstattbestand:** offene, überfällige und terminlose Aufträge sowie Aufträge je Station.

### L2 — Kennzahl-Drill

Eine einzelne Kennzahl mit:

- Wert oder ehrlichem Fehlzustand,
- Formel in Alltagssprache,
- eindeutigem Scope,
- betroffenen beziehungsweise einbezogenen Aufträgen,
- Link zur ClaimEvidence.

### L3 — ClaimEvidence und Rohquelle

ClaimEvidenceV1 mit Formel, Coverage, fehlenden Eingaben und Einzelquellen. Von einer Einzelquelle darf ausschließlich über einen vorhandenen internen `detail.href` zum konkreten Auftrag navigiert werden.

## 3. Globaler Zustandsvertrag

Die Screenzustände liegen über den fachlichen Claim-Zuständen. Ein Transportfehler darf einen zuvor bestätigten Datenstand nicht in leere Werte verwandeln.

| Ebene | Zustand | Verhalten |
|---|---|---|
| Screen | initial loading | Skeleton; noch keine Zahlen |
| Screen | refreshing with retained data | Altstand bleibt lesbar, wird als „letzter bestätigter Stand“ markiert |
| Screen | fresh data | neuer bestätigter Stand ersetzt Altstand |
| Screen | refresh error with retained data | Altstand bleibt; Retry wird angeboten, sobald technisch verbunden |
| Screen | blocking error without data | keine Kennzahl; Fehlerfläche statt Kacheln |
| Claim | ready | Wert und vollständiger Nachweis |
| Claim | confirmed_empty | belegte Null mit geprüftem Scope |
| Claim | partial | Wert plus sichtbare Nachweislücke |
| Claim | missing_input | kein Wert; konkrete fehlende Eingabe |
| Claim | not_configured | keine Kennzahl; Fachvertrag fehlt |
| Claim | review_required | kein freigegebener Wert; „Prüfung erforderlich“ |
| Claim | degraded | nur eingeschränkt belastbarer Wert/Zustand; Grund sichtbar |
| Claim | unavailable | Wert derzeit nicht verfügbar; Grund sichtbar |
| Claim | protected_later | Wert bleibt geschützt und wird nicht vorzeitig offengelegt |

`null`, `missing_input` und `not_configured` sind drei verschiedene Zustände und dürfen nicht zusammengeführt werden.

## 4. P01 — Rolf Performance Overview Data

### Nutzerfrage

„Wie steht meine Werkstatt, wo muss ich hinschauen und welche Aufträge betrifft das?“

### Informationshierarchie

1. Seitentitel, Zeitraum und Datenstand.
2. Regelbasierter Problemhinweis, sofern überfällige Aufträge vorhanden sind.
3. Abschlusskennzahlen des gewählten Zeitraums.
4. aktueller Auftragsbestand.
5. betroffene Aufträge.
6. Aufträge je Station.
7. nicht konfigurierte Fachbereiche als klar gekennzeichnete, nicht numerische Einträge.

### Primäre Handlung

`Betroffene Aufträge ansehen`
Scrollt zur vorhandenen Liste der überfälligen und terminlosen Aufträge. Ist kein Auftrag betroffen, entfällt die Handlung.

### Sekundäre Handlung

`Datenbasis ansehen`
Öffnet P06 für die aktuell fokussierte Kennzahl. Bis der ClaimEvidence-Drawer technisch angebunden ist, darf die Handlung nicht als aktive Schaltfläche erscheinen.

### L1-Inhalte

- Titel: `Performance`
- Untertitel: `Werkstattlage aus bestätigten Auftragsdaten`
- Zeitraumsteuerung: `Heute`, `Woche`, `Monat`
- Datenstand: `Abfrage vom {TT.MM.JJJJ, HH:MM Uhr}`
- Hinweis: `Die Ansicht wurde geladen. Sie ist kein Realtime-Monitor.`
- Abschnitt: `Abschlüsse · {Zeitraum}`
  - `Termintreue`
  - `Ø Durchlaufzeit`
  - `Abgeschlossene Aufträge`
- Abschnitt: `Aktueller Werkstattbestand · Stand {HH:MM Uhr}`
  - `Offene Aufträge`
  - `Überfällige Aufträge`
  - `Ohne zugesagten Termin`
- Abschnitt: `Betroffene Aufträge`
- Abschnitt: `Aktuelle Aufträge je Station`

### L2-Inhalte

Klick auf eine Kennzahl öffnet P05. Klick auf einen betroffenen Auftrag öffnet dessen bestehende Auftragsroute. Klick auf eine Station öffnet die bestehende, nach Station gefilterte Auftragsliste.

### L3-Inhalte

P06 ClaimEvidence Drawer und anschließend konkrete Auftragsquelle, sofern der Claim eine vorhandene `detail.href` liefert.

### Exakte UI-Texte

- Bei Überfälligkeit: `{n} offene Aufträge liegen hinter ihrem gespeicherten Zusagetermin.`
- Handlung darunter: `Betroffene Aufträge prüfen`
- Ohne Überfälligkeit bei belegter Null: `Im aktuellen Bestand ist kein Auftrag mit gespeichertem Zusagetermin überfällig.`
- Fehlende Termintreue: `Nicht berechenbar`
- Erklärung: `Für abgeschlossene Aufträge fehlen im Zeitraum messbare Zusagetermine.`
- Fehlende Durchlaufzeit: `Nicht berechenbar`
- Erklärung: `Für abgeschlossene Aufträge fehlen im Zeitraum bestätigte Eingangszeiten.`
- Stationshinweis: `Die Zahlen zeigen Aufträge mit aktuell gespeicherter Station – keine Auslastung und keine Wartezeit.`
- Begrenzte Betroffenenliste: `{gesamt} betroffen · {sichtbar} im Auszug`
  Der aktive Datenvertrag liefert höchstens zehn betroffene Aufträge im Auszug.

### Zustände

- Data: alle vorhandenen Claims nach ihrem eigenen Evidence-State.
- Empty: belegte Nullen bleiben `0`; die Seite zeigt keinen pauschalen Leerzustand.
- Missing: nur die betroffene Kennzahl zeigt „Nicht berechenbar“ oder „Angabe fehlt“.
- Partial: Wert bleibt sichtbar, ergänzt um „Nachweis teilweise verfügbar“.
- Error/Stale: P03.
- Loading: P02.
- Offline: kein eigener Status; die Anwendung kann Offline nicht belegen.
- Konflikt: kein Status und keine Bedienung; Konfliktlösung ist nicht vorhanden.

### Responsive-Verhalten

- Desktop ab 1200 px: drei Abschlusskennzahlen in einer Reihe, drei Bestandskennzahlen in einer Reihe; Betroffenenliste und Stationsliste jeweils volle Breite.
- 900–1199 px: Kennzahlen in zwei Spalten; Listen volle Breite.
- Unter 900 px gilt P08.
- Keine horizontale KPI-Tabelle und keine versteckten Informationen nur per Hover.

### Verbotene Inhalte

- Score-Ring oder Gesamtscore.
- Sparklines, Trendpfeile, Prozentdeltas und Vergleichslinien.
- Wochenziel oder Zielerreichung.
- „Engpass“, „Kapazität“, „Auslastung“ oder „Wartezeit“ bei Stationszahlen.
- KI-Kachel.
- Grün-/Rotbewertung der Termintreue anhand erfundener Schwellenwerte.
- „Live“, „Realtime“ oder pulsierende Live-Indikatoren.

### Bezug zu vorhandener Komponente

- Route und Initialladung: `src/app/performance/page.tsx` · `PerformanceCockpitPage`
- bestehender Inhaltsrahmen: `src/app/performance/PerformanceCockpitClient.tsx` · `PerformanceCockpitClient`
- vorhandene Werkstattkachel: `src/app/performance/components/WerkstattPulsKachel.tsx` · `WerkstattPulsKachel`
- kanonische Datenabfrage: `src/features/analyse/analyse.actions.ts` · `getAnalyseOverview` und `loadWorkshopSnapshot`
- bestehende Perioden: `src/lib/analyse/routes.ts` · `ANALYSE_PERIODS`

`WerkstattPulsKachel` ist nur strukturell wiederverwendbar. Score-Ring, relative Stationsbalken und pauschaler Status `KEINE DATEN` entsprechen diesem Vertrag nicht.

### Benötigter technischer Vertrag

- vorhandene `AnalyseTileSummary`-Werte nicht über `||` auf Ersatzwerte abbilden;
- Abschluss- und Ist-Scope im View Model sichtbar getrennt halten;
- fachliche Evidence-States pro Kennzahl aus ClaimEvidenceV1 ableiten;
- bestehende Station-URL `/orders?station={station}` nur als Auftragsfilter verwenden;
- kein zusätzlicher Datenbankvertrag erforderlich.

### Akzeptanzkriterien

- Rolf erkennt in zehn Sekunden die sechs Kernzahlen beziehungsweise ihren Fehlgrund.
- Überfällige Aufträge bleiben sichtbar, auch wenn Termintreue nicht berechenbar ist.
- Jede sichtbare Zahl lässt sich genau einem ClaimEvidenceV1 zuordnen.
- `0` erscheint nur bei bestätigter Null.
- Stationszahlen werden nirgends als Auslastung, Kapazität, Warteschlange oder Engpass bezeichnet.
- Jeder Auftragslink führt zu einer existierenden konkreten Auftragsroute.

## 5. P02 — Loading mit erhaltenem Altstand

### Nutzerfrage

„Kann ich den letzten bestätigten Stand weiter lesen, während neue Daten geladen werden?“

### Informationshierarchie

1. bestehender Datenstand bleibt unverändert sichtbar;
2. schmale Statuszeile direkt unter Zeitraum/Datenstand;
3. nur der auslösende Zeitraum-Button zeigt Aktivität.

### Primäre Handlung

Keine. Ein zweiter Ladeauftrag bleibt während der laufenden Abfrage gesperrt.

### Sekundäre Handlung

Vorhandene Auftrags- und Evidence-Links des Altstands bleiben lesbar, sofern die Anwendung Navigation während des Refreshs zulässt.

### L1-Inhalte

Die vollständige P01 mit reduziertem Kontrast ausschließlich in der Statuszeile, nicht über der gesamten Seite.

### L2-Inhalte

Ein bereits geöffneter Drill bleibt mit seinem letzten bestätigten Inhalt sichtbar.

### L3-Inhalte

Ein bereits geöffneter Evidence Drawer bleibt lesbar; er wird nicht mit Daten eines anderen Zeitraums vermischt.

### Exakte UI-Texte

- `Daten werden aktualisiert …`
- `Letzter bestätigter Stand vom {TT.MM.JJJJ, HH:MM Uhr}`
- Zeitraum-Button: `{Zeitraum} wird geladen …`

### Zustände

- Mit Altstand: retained loading.
- Ohne Altstand: Skeletons mit Textlabels, aber ohne Zahlenplatzhalter wie `0`.
- Nach Erfolg: atomarer Wechsel auf neuen Stand.
- Nach Fehler: P03.

### Responsive-Verhalten

Statuszeile bricht auf Tablet zweizeilig um. Kennzahlen springen während des Ladens nicht in eine andere Reihenfolge.

### Verbotene Inhalte

- leere Kacheln anstelle des Altstands;
- `0` als Skeleton;
- rotierende Realtime- oder Live-Anzeige;
- Vermischung von altem Wert und neuem Scope.

### Bezug zu vorhandener Komponente

`PerformanceCockpitClient.loadPeriod` erhält die bisherigen `overviews` bereits, bis eine erfolgreiche Antwort sie ersetzt. `AnalyseDrillOverlay` verwirft den sichtbaren Detailinhalt beim Request-Key-Wechsel aktuell und erfüllt den L2-Vertrag noch nicht.

### Benötigter technischer Vertrag

Ein UI-seitiger retained-load-state mit `confirmedData`, `confirmedScope`, `confirmedAt` und separat laufendem Request-Key. Das ist ein UI-Vertrag, kein neues Datenbankfeld.

### Akzeptanzkriterien

- Kein bestätigter Wert verschwindet allein wegen eines Refreshs.
- Altstand und neu angeforderter Zeitraum werden nie als derselbe Scope beschriftet.
- Nach erfolgreicher Antwort wechseln Wert, Scope und Zeitstempel gemeinsam.

## 6. P03 — Error/Stale mit vorgesehenem Retry

### Nutzerfrage

„Sind die sichtbaren Zahlen noch bestätigt, und kann ich die Aktualisierung wiederholen?“

### Informationshierarchie

1. Fehlerstatus und Alter des letzten bestätigten Stands;
2. retained data, sofern vorhanden;
3. vorgesehener Retry;
4. technische Kurzbeschreibung ohne Stacktrace.

### Primäre Handlung

`Erneut laden`

Die Handlung darf erst aktiv sein, wenn sie exakt dieselbe autorisierte Read-Query mit demselben Scope erneut ausführt. Bis dahin lautet die nicht aktive Figma-Annotation: `Retry-Vertrag noch nicht verbunden` und wird nicht als klickbare Produktfunktion dargestellt.

### Sekundäre Handlung

`Letzten bestätigten Stand weiter ansehen`

### L1-Inhalte

- Fehlerbanner oberhalb der Kennzahlen.
- retained Werte tragen die Kennzeichnung `Letzter bestätigter Stand`.

### L2-Inhalte

Bereits bestätigter Drill bleibt lesbar. Ein Drill ohne bestätigten Inhalt zeigt den blockierenden Fehlerzustand.

### L3-Inhalte

ClaimEvidence des Altstands bleibt an dessen Berechnungszeitpunkt gebunden. Es wird nicht als Evidence eines fehlgeschlagenen neuen Requests ausgegeben.

### Exakte UI-Texte

- Mit Altstand: `Aktualisierung fehlgeschlagen. Du siehst den letzten bestätigten Stand vom {TT.MM.JJJJ, HH:MM Uhr}.`
- Ohne Altstand: `Performance-Daten konnten nicht geladen werden.`
- neutrale Ursache: `Die Datenquelle oder Verbindung war für diese Abfrage nicht erreichbar.`
- Handlung: `Erneut laden`

### Zustände

- stale with data,
- blocking error without data,
- retrying,
- recovered.

Keiner dieser Zustände wird „Offline“ genannt, weil ein echter Offline-Vertrag fehlt.

### Responsive-Verhalten

Banner volle Inhaltsbreite. Auf Tablet stehen Text und Retry untereinander.

### Verbotene Inhalte

- Altstand ohne Zeitstempel;
- Behauptung „aktuell“;
- automatisches Zurücksetzen auf Null;
- „Offline-Modus“;
- technische Fehlermeldungen, SQL oder Stacktraces.

### Bezug zu vorhandener Komponente

`PerformanceCockpitClient` hält `dataError`, `loadedAt` und die letzten `overviews`. Ein eigener Retry-Handler und ein expliziter Stale-Status fehlen. `AnalyseDrillOverlay` hat einen Error-Zweig, aber keinen Retry.

### Benötigter technischer Vertrag

- idempotenter Retry derselben Read-Operation;
- Request-Key gegen verspätete Antworten;
- bestätigter Zeitstempel bleibt beim Fehler unverändert;
- Fehler darf keine Datenmutation auslösen.

### Akzeptanzkriterien

- Rolf erkennt Altstand versus neue erfolgreiche Abfrage zweifelsfrei.
- Retry wiederholt keine Mutation.
- Eine verspätete Antwort eines älteren Scopes überschreibt keinen neueren Stand.

## 7. P04 — Missing / Data-not-configured

### Nutzerfrage

„Ist der Wert wirklich null, fehlt eine Angabe oder fehlt die Funktion?“

### Informationshierarchie

1. Zustandsbegriff;
2. konkrete Ursache;
3. betroffene Kennzahl;
4. vorhandener Prüf- oder Erfassungspfad, andernfalls ehrliche Blockade.

### Primäre Handlung

Nur eine in ClaimEvidenceV1 vorhandene `captureOption.action` oder ein vorhandener Quellenlink. Ist die Capture-Option `blocked` oder `not_configured`, gibt es keine aktive Primärhandlung.

### Sekundäre Handlung

`Datenbasis ansehen`, sobald P06 technisch verbunden ist.

### L1-Inhalte

- Kennzahlwert: `Nicht berechenbar`
- Status: `Angabe fehlt` oder `Noch nicht verbunden`
- Ursache in höchstens zwei Zeilen.

### L2-Inhalte

Liste der fehlenden Eingaben aus ClaimEvidenceV1.

### L3-Inhalte

Coverage, fehlende Eingabe, Capture-Status und vorhandene Einzelquellen.

### Exakte UI-Texte

- Termintreue: `Nicht berechenbar · Zusagetermin fehlt`
- Durchlaufzeit: `Nicht berechenbar · bestätigte Eingangszeit fehlt`
- fehlender Editor: `Die Angabe kann in der aktuellen Auftragsansicht noch nicht direkt erfasst werden.`
- Fachvertrag fehlt: `Dieser Fachbereich ist noch nicht mit einer belastbaren Datenquelle verbunden.`
- belegte Null: `0 · Im geprüften Bereich keine Datensätze`

### Zustände

- `missing_input`: konkrete Eingabe fehlt;
- `not_configured`: Fach- oder Capture-Vertrag fehlt;
- `confirmed_empty`: belegte Null;
- `partial`: Wert vorhanden, Detailnachweis unvollständig.

### Responsive-Verhalten

Ursache steht immer direkt unter dem Wert; kein Tooltip als einzige Erklärung.

### Verbotene Inhalte

- alle vier Zustände als `Keine Daten`;
- ein aktiver Erfassungsbutton ohne vorhandene Capture-Action;
- `0` für `null`;
- positive oder negative Bewertung eines nicht berechenbaren Werts.

### Bezug zu vorhandener Komponente

Claim-Zustände und Capture-Optionen sind in `src/lib/analytics/evidenceContract.ts` definiert. `buildWorkshopEvidence` liefert konkrete Missing-Gründe. `WerkstattPulsKachel` und `WerkstattPulsHero` unterscheiden diese Zustände visuell noch nicht vollständig.

### Benötigter technischer Vertrag

Direktes Mapping der vorhandenen ClaimEvidenceV1-Zustände auf die vier sichtbaren Varianten; keine neue Datenquelle.

### Akzeptanzkriterien

- Testpersonen können `0`, `Nicht berechenbar`, `Angabe fehlt` und `Noch nicht verbunden` erklären.
- Keine Handlung erscheint aktiv, wenn ihre Capture-Option nicht `available` ist.

## 8. P05 — Metric Drill

### Nutzerfrage

„Was bedeutet diese Kennzahl genau, welcher Zeitraum gilt und welche Aufträge bilden sie?“

### Informationshierarchie

1. Kennzahlname, Wert/Zustand und Scope.
2. Formel in Alltagssprache.
3. Coverage.
4. einbezogene oder betroffene Aufträge.
5. Datenbasis.

### Primäre Handlung

Bei vorhandenen Quellen: `Auftrag öffnen` beziehungsweise `Alle belegten Aufträge ansehen`.

### Sekundäre Handlung

`Datenbasis öffnen`

### L1-Inhalte

Der Ursprungskontext der Übersicht bleibt erkennbar: `Performance / {Kennzahl}`.

### L2-Inhalte

- Wert oder „Nicht berechenbar“
- `Gültig für: {Scope}`
- `Berechnet am: {Zeitpunkt}`
- `So wird gerechnet: {ClaimEvidence.formula}`
- Coverage-Kurzzeile
- Auftragsliste

### L3-Inhalte

P06.

### Exakte UI-Texte

- Termintreue: `Pünktlich abgeschlossene Aufträge geteilt durch alle abgeschlossenen Aufträge mit gespeichertem Zusagetermin.`
- Durchlaufzeit: `Durchschnitt der Kalendertage vom bestätigten Auftragseingang bis zum Abschluss.`
- Offene Aufträge: `Produktive Aufträge, die zum Berechnungszeitpunkt weder abgeschlossen noch storniert waren.`
- Überfällig: `Offene Aufträge mit gespeichertem Zusagetermin vor dem Berechnungszeitpunkt.`
- Station: `Aufträge mit aktuell gespeicherter Station „{Station}“.`
- Coverage: `{included} Quellen einbezogen · {unresolved} im Detailnachweis offen`

### Zustände

Alle ClaimEvidenceV1-Zustände. Bei `partial` bleibt der Wert sichtbar, aber die Quellenliste trägt ein deutliches Coverage-Banner. Ohne History gibt es kein Diagramm.

### Responsive-Verhalten

- Desktop: Kennzahl/Scope links, Formel/Coverage rechts; Auftragsliste darunter.
- Tablet: einspaltig; Quellenliste als Karten.

### Verbotene Inhalte

- Verlauf, Vergleich oder Prognose;
- Benchmark;
- Statusfarbe aus nicht definierten Schwellen;
- eine Quelle ohne konkrete Referenz;
- Rücksprung ohne den vorhandenen, sicher validierten `returnTo`-Vertrag.

### Bezug zu vorhandener Komponente

`AnalyseDrillOverlay` und `WerkstattPulsLevel2` liefern die vorhandene Overlay-Struktur. `getAnalyseTileDetail` liefert Summary, Werkstattdaten und Evidence. Ein metric-spezifischer Drill ist noch nicht verbunden; aktuell wird nur die gesamte Werkstatt-Kachel geöffnet.

### Benötigter technischer Vertrag

- Auswahl eines vorhandenen Claims über eine stabile Zuordnung zwischen sichtbarer Kennzahl und Claim-ID;
- keine neue fachliche Kennzahl;
- Auftragsnavigation ausschließlich über vorhandene Evidence-/Entity-Hrefs;
- kontexttreuer Rücksprung nutzt den vorhandenen `AppBackButton` mit sicher validiertem `returnTo`.

### Akzeptanzkriterien

- Scope und Formel stehen ohne zusätzliche Interaktion im sichtbaren Bereich.
- Jede Listenzeile stammt aus dem gewählten Claim.
- Bei fehlendem History-Vertrag gibt es keine leere Chartfläche.

## 9. P06 — ClaimEvidence Drawer

### Nutzerfrage

„Welche Daten beweisen diese Aussage, was fehlt und kann ich die Quelle öffnen?“

### Informationshierarchie

1. Claim und Belegstatus.
2. Formel und Scope.
3. Coverage.
4. fehlende Eingaben.
5. Einzelquellen.
6. Berechnungszeitpunkt.

### Primäre Handlung

`Quelle öffnen` an einer konkreten Einzelquelle mit vorhandenem internem `detail.href`.

### Sekundäre Handlung

`Drawer schließen`

### L1-Inhalte

Die aufrufende Kennzahl bleibt außerhalb des Drawers sichtbar.

### L2-Inhalte

Kurzfassung: Claim, Wert/Zustand und Coverage.

### L3-Inhalte

- `So wird gerechnet`
- `Geltungsbereich`
- `Datenabdeckung`
- `Fehlende Angaben`
- `Einzelquellen`
- `Berechnet am`

### Exakte UI-Texte

- Titel: `Datenbasis · {Kennzahl}`
- Belegstatus ready: `Vollständig belegt`
- confirmed empty: `Geprüfter Bereich ohne Treffer`
- partial: `Nachweis teilweise verfügbar`
- missing input: `Nicht berechenbar – Eingabe fehlt`
- not configured: `Datenvertrag nicht eingerichtet`
- Coverage: `{included} einbezogen · {excluded} ausgeschlossen · {unresolved} offen`
- Quellenbegrenzung: `{unresolved} einbezogene Aufträge sind im begrenzten Detailauszug nicht einzeln enthalten.`
- fehlender Link: `Quelle ist belegt, aber nicht direkt aufrufbar.`

Der aktive Evidence-Snapshot enthält höchstens 500 einzelne Auftragsquellen. Ein darüber hinausgehender belegter Gesamtwert muss als `partial` mit offener Coverage erscheinen.

### Zustände

Der Drawer spiegelt den Claim-State unverändert. Er darf keinen `partial`-Claim als vollständig kennzeichnen und keine fehlende Quelle durch eine generische globale Route ersetzen.

### Responsive-Verhalten

- Desktop: rechter Drawer, 480–560 px breit.
- Tablet: Full-height Sheet mit eigenem Schließen-Button.
- Quellenzeilen bleiben tastaturbedienbar; kein Hover-only-Inhalt.

### Verbotene Inhalte

- erfundene Rohbelege;
- generische Links, die eine konkrete Quelle vortäuschen;
- technische Tenant-ID, geheime IDs oder interne Tokens;
- eine Summe, die nicht mit Coverage/Reconciliation übereinstimmt;
- aktive Erfassung bei `blocked` oder `not_configured`.

### Bezug zu vorhandener Komponente

ClaimEvidenceV1 ist in `src/lib/analytics/evidenceContract.ts` vollständig typisiert und wird von `src/lib/analytics/workshopEvidence.ts` erzeugt. `WerkstattPulsLevel2` erhält `evidence`, rendert derzeit aber nur deren Anzahl als Datenattribut. Eine sichtbare Evidence-Komponente existiert noch nicht.

### Benötigter technischer Vertrag

- rein lesender Drawer, der ausschließlich vorhandene ClaimEvidenceV1-Felder rendert;
- sichere interne Navigation über validierte `detail.href`;
- Claim-Auswahl aus dem bereits geladenen Evidence-Array;
- keine zusätzliche Datenbankabfrage erforderlich.

### Akzeptanzkriterien

- Formel, Scope, Coverage und Berechnungszeitpunkt sind sichtbar.
- Bei `unresolved > 0` erscheint niemals „Vollständig belegt“.
- Jede aktive Quellenhandlung besitzt ein vorhandenes `detail.href`.
- Drawer enthält keine erfundene Datenquelle.

## 10. P07 — Not-configured Fachbereich

### Nutzerfrage

„Warum sehe ich für diesen Fachbereich keine Kennzahl?“

### Informationshierarchie

1. Fachbereich.
2. Status „Noch nicht verbunden“.
3. fehlender Datenvertrag.
4. Rückkehr zur belegten Werkstattansicht.

### Primäre Handlung

`Zur Werkstattübersicht`

### Sekundäre Handlung

Keine aktive fachliche Handlung.

### L1-Inhalte

Der Fachbereich kann in der Übersicht als neutraler Eintrag erscheinen, aber ohne Zahl, Trend, Ampel oder Score.

### L2-Inhalte

Informationsansicht mit Missing-Grund aus `buildUnavailableAnalysisEvidence`.

### L3-Inhalte

Technische Kurzangabe: welche Capability nicht konfiguriert ist; keine erfundenen Quelltabellen.

### Exakte UI-Texte

- Status: `Noch nicht verbunden`
- Titel: `{Fachbereich}`
- Erklärung: `Für diesen Fachbereich ist noch kein belastbarer Datenvertrag eingerichtet. Deshalb zeigt die App keine Kennzahl.`
- Handlung: `Zur Werkstattübersicht`

### Zustände

Nur `not_configured`. Nicht mit `confirmed_empty`, `missing_input` oder einem Ladefehler vermischen.

### Responsive-Verhalten

Eine einzelne Informationskarte, auf Desktop maximal 720 px breit, auf Tablet volle Inhaltsbreite.

### Verbotene Inhalte

- Platzhalterzahlen;
- „0“;
- Mockdiagramme;
- „kommt bald“;
- Setup-Schaltfläche ohne vorhandenen Setup-Vertrag;
- klickbare Detailmodule, die nur in eine weiße Wand führen.

### Bezug zu vorhandener Komponente

`unavailableTiles` in `src/features/analyse/analyse.actions.ts` und `buildUnavailableAnalysisEvidence` in `src/lib/analytics/workshopEvidence.ts` liefern den ehrlichen Zustand. Das generische Rendering in `AnalyseDrillOverlay` darf hierfür keine leere Chartfläche erzeugen.

### Benötigter technischer Vertrag

Bestehenden `not_configured`-Claim ohne Chart-/KPI-Fallback rendern. Kein neuer Backendvertrag.

### Akzeptanzkriterien

- Kein Nutzer kann den Zustand mit einem echten Nullwert verwechseln.
- Es gibt keine aktive Funktion außer realer Rücknavigation.

## 11. P08 — Tablet Read-only

### Nutzerfrage

„Kann ich die Werkstattlage unterwegs schnell lesen und betroffene Aufträge öffnen, ohne versehentlich etwas zu verändern?“

### Informationshierarchie

Wie P01, reduziert auf:

1. Problemhinweis.
2. aktueller Bestand.
3. Abschlusskennzahlen.
4. betroffene Aufträge.
5. Stationen.

### Primäre Handlung

`Betroffene Aufträge ansehen`

### Sekundäre Handlung

`Datenbasis ansehen`, sobald P06 verbunden ist.

### L1-Inhalte

Gleiche Zahlen und Zustände wie Desktop; keine eigene Tablet-Berechnung.

### L2-Inhalte

Metric Drill als Full-screen Sheet.

### L3-Inhalte

ClaimEvidence als Full-screen Sheet; konkrete Auftragsroute darf lesend geöffnet werden.

### Exakte UI-Texte

Identisch zu P01–P06. Zusätzlich keine Texte wie „Bearbeiten“, „Zuweisen“, „Planen“ oder „Station ändern“ innerhalb des Performance-Screens.

### Zustände

Identisch zu Desktop. Tablet ist kein Offline-Modus und kein eigener Datenstand.

### Responsive-Verhalten

- Zielbreite 768–1024 px.
- Kennzahlen zweispaltig, unter 840 px einspaltig.
- Tabellen werden als lesbare Auftragskarten dargestellt.
- Mindestzielgröße für Links/Buttons 44 × 44 px.
- Drawer/Drill belegt den Screen, ohne neue App-Shell.

### Verbotene Inhalte

- Mutation aus dem Performance-Screen;
- Swipe-Aktion zum Statuswechsel;
- versteckte Bearbeitungsmenüs;
- Tablet-spezifische Mock- oder Cachewerte;
- Offline-Badge.

### Bezug zu vorhandener Komponente

Die vorhandene `/performance`-Route und Auftragslinks bleiben bestehen. `PerformanceCockpitClient` besitzt bereits responsive Grid-Ansätze; die Tabellen-/Drawer-Varianten benötigen noch den beschriebenen lesenden Vertrag.

### Benötigter technischer Vertrag

Keine neue Datenquelle. Die Auftragszielroute kann eigene Berechtigungen und Mutationen besitzen; der Performance-Screen selbst löst ausschließlich Navigation und Read-Queries aus.

### Akzeptanzkriterien

- Dieselbe Kennzahl hat auf Desktop und Tablet denselben Wert, Scope und Evidence-State.
- Keine Performance-Interaktion verändert Daten.
- Philipp kann einen betroffenen Auftrag öffnen, wird aber nicht in Analyse-, Planungs- oder Büroarbeit geführt.

## 12. Verbindliche Interaktionsmatrix

| Sichtbares Element | Handlung | Bestehender technischer Anker | Produktstatus |
|---|---|---|---|
| Zeitraum Heute/Woche/Monat | Overview neu laden | `getAnalyseOverview(period)` | vorhanden |
| Werkstattkennzahl | Metric Drill öffnen | gesamter Werkstatt-Drill vorhanden; Claim-spezifische Auswahl fehlt | vor Aktivierung zu verbinden |
| betroffener Auftrag | konkrete Auftragsroute öffnen | `affectedOrders[].openUrl` | vorhanden |
| Station | gefilterte Auftragsliste öffnen | `/orders?station={station}` | vorhanden |
| Datenbasis ansehen | ClaimEvidence Drawer öffnen | Evidence ist vorhanden, sichtbarer Drawer fehlt | vor Aktivierung zu verbinden |
| Quelle öffnen | konkretes `detail.href` öffnen | ClaimEvidenceV1 | nur bei vorhandenem href aktiv |
| Erneut laden | identische Read-Query wiederholen | eigener Retry fehlt | vor Aktivierung zu verbinden |
| nicht konfigurierter Fachbereich | Erklärung öffnen/zurück | unavailable detail/evidence vorhanden | Informationsansicht |
| Editieren/Planen/Zuweisen | keine Handlung | kein Vertrag | verboten |

## 13. Bekannte Abweichungen der aktuellen Oberfläche

Diese Punkte sind keine Designfreiheit. Sie müssen bei der späteren Umsetzung entfernt oder umbenannt werden:

1. `WerkstattPulsKachel` kann Termintreue als Score-Ring darstellen. Das ist kein Werkstatt-Score und darf nicht als solcher wirken.
2. `WerkstattPulsLevel2` nennt „Wochenziel“, obwohl kein Wochenziel verfügbar ist.
3. `WerkstattPulsStationArena` nennt Auftragszahlen „wartend“, zeigt Auslastung/Wartezeit-Platzhalter und verwendet „Engpass-Ranking“. Zulässig ist ausschließlich „Aktuelle Aufträge je Station“.
4. `WerkstattPulsOrdersTable` verwendet „gefährdet“, obwohl kein Gefährdungsmodell verfügbar ist. Zulässig sind „überfällig“ und „ohne zugesagten Termin“.
5. `loadWorkshopSnapshot` kann den gesamten Tile-Status auf `data_missing` setzen, obwohl überfällige Aufträge vorhanden sind. Fehlende Termintreue darf den belegten Problemhinweis nicht verdecken.
6. Evidence wird geladen, aber nicht sichtbar gerendert.
7. Der Detail-Loader verwirft beim Laden den sichtbaren Altstand und bietet keinen Retry.
8. Der offene Auftragsbestand ist im aktiven Datenvertrag vorhanden, wird in der aktuellen Overview aber nicht als eigene Kennzahl gerendert.
9. Bei einer fehlgeschlagenen Initialabfrage erhält der Client derzeit trotzdem einen neuen `initialLoadedAt`; dieser Zeitpunkt darf nicht als erfolgreiche Abfrage beschriftet werden.
10. Datenquellen mit Datensätzen werden intern teilweise `live` genannt, obwohl der Snapshot-Vertrag `isLive: false` setzt. Sichtbar zulässig ist ausschließlich „Datenbank-Snapshot“ beziehungsweise „Abfrage vom …“.
11. Nicht konfigurierte Fachbereiche dürfen keine generische leere Diagrammfläche erhalten.
12. `src/app/performance/actions.ts`, `src/app/actions/performance.actions.ts` und `src/lib/performance/score.ts` enthalten ältere Mock-/Heuristikpfade und sind keine zulässige Datenquelle dieses Vertrags.

## 14. User-Twin-Gate

Der Figma-Entwurf besteht das Gate nur, wenn Rolf innerhalb von zehn Sekunden ohne Erklärung zeigen kann:

- den aktuellen offenen Bestand,
- die Anzahl überfälliger und terminloser Aufträge,
- die Abschlusslage für den gewählten Zeitraum,
- mindestens einen betroffenen Auftrag,
- den Einstieg in dessen Datenbasis,
- eine reale nächste Handlung.

Zusätzlich gilt:

- Rolf muss „nicht berechenbar“ von belegter Null unterscheiden können.
- Rolf darf Stationszahlen nicht als Kapazität oder Wartezeit interpretieren.
- Philipp darf keine Bearbeitungs-, Analyse- oder Planungsaufgabe aus diesem Screen erhalten.

## 15. Prüfphase

### P1 — Keine nicht vorhandene Funktion aktiv dargestellt

**PASS.** Retry, Metric-spezifischer Drill und Evidence Drawer sind als vor Aktivierung zu verbindende UI-Verträge markiert. History, Realtime, Offline, Konfliktlösung, Kapazität, Engpasswirtschaft und KI bleiben ausgeschlossen.

### P2 — Jede Kennzahl auf bekannte Datenwahrheit zurückgeführt

**PASS.** Jede zugelassene Kennzahl ist einer vorhandenen Workshop-Claim-Formel und ClaimEvidenceV1 zugeordnet.

### P3 — Null, Missing und Not-configured getrennt

**PASS.** `null`, `confirmed_empty`, `missing_input`, `partial` und `not_configured` besitzen eigene Texte und Verhalten.

### P4 — Jede Aktion besitzt realen oder ausdrücklich fehlenden Vertrag

**PASS.** Die Interaktionsmatrix kennzeichnet vorhandene Navigation und fehlende UI-Verträge. Nicht verbundene Aktionen dürfen nicht aktiv erscheinen.

### P5 — Acht Screens vollständig

**PASS.** P01 bis P08 enthalten Nutzerfrage, Hierarchie, Handlungen, L1/L2/L3, exakte Texte, Zustände, Responsive-Verhalten, Verbote, Komponentenbezug, technischen Vertrag und Akzeptanzkriterien.

## FINAL_STATUS

`READY_FOR_FIGMA`
